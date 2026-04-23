"Install requirements: pip install flask flask-cors opencv-python mediapipe joblib numpy requests boto3 awscli chromadb sentence-transformers"
import os
import sys
import time
import threading
import joblib
import numpy as np
import cv2
import mediapipe as mp
import requests
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allows React to communicate with the API

import logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

# Node.js backend URL, set BACKEND_URL env var to your EC2 backend
NODE_API_URL = os.environ.get("BACKEND_URL", "http://100.27.212.225:5000")

# Active session context, set by frontend when session starts
_session_ctx = {"userId": None, "sessionId": None}

# Threading controls
_force_save_event  = threading.Event()  # triggers immediate flush of current chunk
_stop_engine_event = threading.Event()  # signals engine thread to stop and release camera
_is_paused         = threading.Event()  # when set, engine skips frame processing (timer frozen)
_engine_thread     = None               # reference to the running engine thread

# Feedback state — populated after session ends, consumed by frontend during save flow
_feedback_state     = {"status": "idle", "text": None}
_feedback_lock      = threading.Lock()
_feedback_cancelled = threading.Event()
_session_last_stats: "dict | None" = None  # signal averages from the completed session


def _compute_avg_focus(counts: dict) -> float:
    """Maps chunk label counts to a 0–100 focus score."""
    SCORES = {"VF": 100, "SF": 66, "SU": 33, "VU": 0}
    total = sum(counts.values())
    if total == 0:
        return 0.0
    return sum(SCORES[k] * v for k, v in counts.items()) / total


# FaceLandmarker: initialized once in the main thread at startup to avoid
# XNNPACK delegate failures that occur when TFLite is init'd in a daemon thread
def _init_face_landmarker():
    from mediapipe.tasks import python as _mp_tasks
    from mediapipe.tasks.python import vision as _mp_vision
    _model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_landmarker.task")
    if not os.path.exists(_model_path):
        print("[STARTUP] Downloading face_landmarker.task...", flush=True)
        _url = (
            "https://storage.googleapis.com/mediapipe-models/"
            "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        )
        with requests.get(_url, stream=True) as r:
            r.raise_for_status()
            with open(_model_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        print("[STARTUP] Model downloaded.", flush=True)
    _opts = _mp_vision.FaceLandmarkerOptions(
        base_options=_mp_tasks.BaseOptions(model_asset_path=_model_path),
        running_mode=_mp_vision.RunningMode.IMAGE,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return _mp_vision.FaceLandmarker.create_from_options(_opts)

_face_landmarker = _init_face_landmarker()

def save_chunk_via_api(label):
    "POSTs a focus chunk to the Node.js backend (called every 5 min or on early stop)."
    chunk_map = {3: "VF", 2: "SF", 1: "SU", 0: "VU"}
    chunk_status = chunk_map.get(label, "SU")
    if _session_ctx["sessionId"] is None:
        print("[API] No active session - chunk not saved", flush=True)
        return
    try:
        resp = requests.post(f"{NODE_API_URL}/session/chunk", json={
            "sessionId":   _session_ctx["sessionId"],
            "userId":      _session_ctx["userId"],
            "chunkStatus": chunk_status,
        }, timeout=5)
        print(f"[API] Chunk saved -> {chunk_status} ({resp.status_code})", flush=True)
    except Exception as e:
        print(f"[API ERROR] {e}", flush=True)


# Camera stream frame buffer
_frame_bytes = {"data": None}

def focus_engine():
    """
    Runs for the duration of one session.
    Spawned on POST /api/session, exits on POST /api/session/end.
    Opens the camera on entry and releases it on exit — camera is NEVER
    open outside of an active session.
    """

    # Load the model
    _pkl_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "focus_rf_model.pkl")
    print(f"[MODEL] Looking for: {_pkl_path}", flush=True)
    try:
        clf = joblib.load(_pkl_path)
        print("[MODEL] Loaded successfully.")
    except Exception as e:
        clf = None
        print(f"[MODEL] focus_rf_model.pkl not found - rule-based only. ({e})", flush=True)

    face_mesh = _face_landmarker  # initialized in main thread at startup

    # Open camera — only happens during an active session
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print("[ENGINE] Failed to open camera")
        return
    print("[ENGINE] Camera opened - warming up", flush=True)
    _warmup_start = time.time()
    while time.time() - _warmup_start < 8.0:
        _ok, _f = cap.read()
        if _ok and _f is not None and _f.mean() > 10:
            break
        time.sleep(0.05)
    print(f"[ENGINE] Camera ready after {time.time() - _warmup_start:.1f}s", flush=True)

    # Per-chunk control variables (reset every 5 minutes)
    five_min_buffer           = []
    active_session_time       = 0.0
    last_frame_time           = time.time()
    SAVE_INTERVAL             = 300

    distraction_frames_count  = 0
    total_frames_processed    = 0
    consecutive_absent_frames = 0
    ABSENCE_THRESHOLD         = 35

    # Session-level accumulators (NOT reset per chunk — span the full session)
    session_all_frames         = []   # every [ear, head_yaw, head_pitch, mar, eyebrow] row
    session_distraction_frames = 0
    session_total_frames       = 0
    session_active_seconds     = 0.0
    session_chunk_counts       = {"VF": 0, "SF": 0, "SU": 0, "VU": 0}

    # Distance helper
    def get_dist(p1, p2):
        return np.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2)

    # Save function
    def save_report():
        nonlocal five_min_buffer, distraction_frames_count
        nonlocal total_frames_processed, active_session_time
        nonlocal session_all_frames, session_distraction_frames
        nonlocal session_total_frames, session_active_seconds, session_chunk_counts

        chunk_map = {3: "VF", 2: "SF", 1: "SU", 0: "VU"}

        if total_frames_processed > 5:
            distraction_ratio = distraction_frames_count / total_frames_processed
            avg_features      = np.mean(five_min_buffer, axis=0)

            # Model classification
            if clf:
                prediction = int(clf.predict([avg_features])[0])
            else:
                prediction = 1

            if distraction_ratio > 0.40:
                prediction = 1

            # Feed session-level accumulators before resetting chunk buffers
            session_all_frames.extend(five_min_buffer)
            session_distraction_frames += distraction_frames_count
            session_total_frames       += total_frames_processed
            session_active_seconds     += active_session_time
            session_chunk_counts[chunk_map.get(prediction, "SU")] += 1

            # POST chunk to Node.js backend
            save_chunk_via_api(label=prediction)

        # Reset per-chunk buffers for next window
        five_min_buffer           = []
        distraction_frames_count  = 0
        total_frames_processed    = 0
        active_session_time       = 0.0

    # Main Loop, runs until session ends (_stop_engine_event is set)
    print(f"[ENGINE] Entering loop - stop_event={_stop_engine_event.is_set()} cap_open={cap.isOpened()}", flush=True)
    while cap.isOpened() and not _stop_engine_event.is_set():

        # When paused: skip frame processing, keep loop alive, no time accumulation
        if _is_paused.is_set():
            last_frame_time = time.time()  # keep anchor current so resume doesn't spike delta
            time.sleep(0.033)
            continue

        current_time    = time.time()
        delta_time      = current_time - last_frame_time
        last_frame_time = current_time

        ret, frame = cap.read()
        if not ret:
            print("[ENGINE] cap.read() failed - camera lost", flush=True)
            break

        frame     = cv2.flip(frame, 1)
        h, w, _   = frame.shape
        rgb_frame  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame  = np.ascontiguousarray(rgb_frame, dtype=np.uint8)
        _mp_img    = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        results    = face_mesh.detect(_mp_img)
        if total_frames_processed == 0 and consecutive_absent_frames == 1:
            _dbg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "debug_frame.jpg")
            cv2.imwrite(_dbg_path, cv2.cvtColor(rgb_frame, cv2.COLOR_RGB2BGR))
            print(f"[DEBUG] Saved first frame to {_dbg_path} - faces={len(results.face_landmarks)}", flush=True)
        if total_frames_processed < 5:
            print(f"[DEBUG] faces_detected={len(results.face_landmarks)}", flush=True)

        user_detected = False
        if results.face_landmarks:
            user_detected             = True
            consecutive_absent_frames = 0
        else:
            consecutive_absent_frames += 1

        active_session_time += delta_time

        if user_detected:
            lm = results.face_landmarks[0]
            total_frames_processed += 1

            # Feature Extraction
            ear        = (get_dist(lm[159], lm[145]) + get_dist(lm[386], lm[374])) / 2
            nose       = lm[1]
            head_yaw   = abs(get_dist(nose, lm[234]) - get_dist(nose, lm[454]))
            head_pitch = get_dist(lm[10], lm[152])
            mar        = get_dist(lm[13], lm[14])
            eyebrow    = get_dist(lm[105], lm[117])

            # Distraction Logic
            is_temporarily_distracted = (ear < 0.012 or head_yaw > 0.09 or head_pitch < 0.18)

            if is_temporarily_distracted:
                distraction_frames_count += 1

            five_min_buffer.append([ear, head_yaw, head_pitch, mar, eyebrow])

        elif consecutive_absent_frames < ABSENCE_THRESHOLD:
            # Briefly lost face — still tracking
            distraction_frames_count += 1

        # 5-min interval OR early-end signal from frontend
        if active_session_time >= SAVE_INTERVAL or _force_save_event.is_set():
            _force_save_event.clear()
            save_report()
            # If session was ended, exit after flushing the final chunk
            if _stop_engine_event.is_set():
                break

        # Encode frame for MJPEG stream
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        _frame_bytes["data"] = buf.tobytes()

    # Flush remaining data if session ended before the 5-min mark was reached inside the loop
    print(f"[ENGINE] Loop exited - frames={total_frames_processed}", flush=True)
    if total_frames_processed > 50:
        save_report()

    # Persist session-level stats in module state for feedback generation
    global _session_last_stats
    if session_total_frames > 50 and session_all_frames:
        arr = np.array(session_all_frames)
        _session_last_stats = {
            "avg_ear":                float(np.mean(arr[:, 0])),
            "avg_head_yaw":           float(np.mean(arr[:, 1])),
            "avg_head_pitch":         float(np.mean(arr[:, 2])),
            "avg_mar":                float(np.mean(arr[:, 3])),
            "avg_eyebrow":            float(np.mean(arr[:, 4])),
            "distraction_ratio":      session_distraction_frames / session_total_frames * 100,
            "chunk_distribution":     dict(session_chunk_counts),
            "avg_focus_score":        _compute_avg_focus(session_chunk_counts),
            "active_duration_minutes": session_active_seconds / 60.0,
        }
        print(f"[ENGINE] Session stats stored for feedback: {_session_last_stats}", flush=True)
    else:
        _session_last_stats = None
        print("[ENGINE] Not enough data for feedback", flush=True)

    # Clean up
    cap.release()
    _frame_bytes["data"] = None
    print("[ENGINE] Camera released")


# API Endpoints

@app.route("/api/session", methods=["POST"])
def set_session():
    """
    Called by the frontend when a session starts.
    Resets all flags and spawns the engine thread, which opens the camera.
    Body: { userId, sessionId }
    """
    global _engine_thread, _session_last_stats
    data = request.get_json()
    _session_ctx["userId"]    = data.get("userId")
    _session_ctx["sessionId"] = data.get("sessionId")

    # Reset all control flags for a fresh session
    _stop_engine_event.clear()
    _force_save_event.clear()
    _is_paused.clear()

    # Clear previous session's feedback state so stale results aren't returned
    _session_last_stats = None
    _feedback_cancelled.clear()
    with _feedback_lock:
        _feedback_state["status"] = "idle"
        _feedback_state["text"]   = None

    # Spawn engine thread — camera opens inside focus_engine()
    _engine_thread = threading.Thread(target=focus_engine, daemon=True)
    _engine_thread.start()

    print(f"[SESSION] Started - userId={_session_ctx['userId']} sessionId={_session_ctx['sessionId']}", flush=True)
    return jsonify({"ok": True})


@app.route("/api/session/end", methods=["POST"])
def end_session():
    """
    Called by the frontend when the session stops.
    Signals engine to flush the final chunk and release the camera.
    """
    _force_save_event.set()   # flush final chunk
    _stop_engine_event.set()  # stop engine loop → cap.release()
    time.sleep(0.5)           # give engine one frame cycle to process
    _session_ctx["userId"]    = None
    _session_ctx["sessionId"] = None
    print("[SESSION] Ended - camera released", flush=True)
    return jsonify({"ok": True})


@app.route("/api/session/pause", methods=["POST"])
def toggle_pause():
    """
    Toggles pause state. When paused, engine skips frame processing
    and time accumulation is frozen. Frontend session timer also pauses.
    """
    if _is_paused.is_set():
        _is_paused.clear()
        print("[SESSION] Resumed", flush=True)
    else:
        _is_paused.set()
        print("[SESSION] Paused", flush=True)
    return jsonify({"paused": _is_paused.is_set()})


@app.route("/api/session/feedback/generate", methods=["POST"])
def generate_session_feedback():
    """
    Called by frontend when user clicks 'Yes' on the save confirm modal.
    Spawns a background thread to run RAG + Groq feedback generation.
    Frontend polls GET /api/session/feedback for status.
    """
    if _session_last_stats is None:
        with _feedback_lock:
            _feedback_state["status"] = "unavailable"
            _feedback_state["text"]   = None
        print("[FEEDBACK] No session stats — unavailable", flush=True)
        return jsonify({"ok": True})

    _feedback_cancelled.clear()
    with _feedback_lock:
        _feedback_state["status"] = "generating"
        _feedback_state["text"]   = None

    stats_snapshot = dict(_session_last_stats)

    def _run(stats):
        try:
            # Lazy import — avoids loading SentenceTransformer at Flask startup
            _rag_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rag")
            if _rag_path not in sys.path:
                sys.path.insert(0, _rag_path)
            from feedback_generator import generate_feedback

            print("[FEEDBACK] Generating...", flush=True)
            report = generate_feedback(**stats)

            if _feedback_cancelled.is_set():
                print("[FEEDBACK] Cancelled — discarding result", flush=True)
                return

            with _feedback_lock:
                if report is None:
                    _feedback_state["status"] = "unavailable"
                    print("[FEEDBACK] No GROQ_API_KEY — unavailable", flush=True)
                else:
                    _feedback_state["status"] = "ready"
                    _feedback_state["text"]   = report
                    print("[FEEDBACK] Ready", flush=True)

        except Exception as e:
            print(f"[FEEDBACK] Error: {e}", flush=True)
            if not _feedback_cancelled.is_set():
                with _feedback_lock:
                    _feedback_state["status"] = "error"
                    _feedback_state["text"]   = None

    threading.Thread(target=_run, args=(stats_snapshot,), daemon=True).start()
    return jsonify({"ok": True})


@app.route("/api/session/feedback/cancel", methods=["POST"])
def cancel_session_feedback():
    """
    Called by frontend when user cancels from the name/description modal.
    Sets the cancellation flag so the background thread discards its result.
    """
    _feedback_cancelled.set()
    with _feedback_lock:
        _feedback_state["status"] = "idle"
        _feedback_state["text"]   = None
    print("[FEEDBACK] Cancelled", flush=True)
    return jsonify({"ok": True})


@app.route("/api/session/feedback", methods=["GET"])
def get_session_feedback():
    """
    Polled by frontend after user clicks 'Yes' to save.
    Returns: { status: 'idle'|'generating'|'ready'|'error'|'unavailable', text: str|null }
    """
    with _feedback_lock:
        return jsonify(dict(_feedback_state))


@app.route("/api/video_feed")
def api_video_feed():
    """
    MJPEG camera stream.
    In React:
        <img src="http://localhost:5000/api/video_feed" />
    Returns empty stream when no session is active (no frames in buffer).
    """
    def generate():
        while True:
            frame = _frame_bytes.get("data")
            if frame:
                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")
            time.sleep(0.033)  # ~30fps

    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")


# main: Flask starts idle, engine spawns only when a session begins
if __name__ == "__main__":
    print(f"[CONFIG] Backend URL: {NODE_API_URL}")
    print("[CONFIG] Engine idle - camera will open when a session starts.", flush=True)
    app.run(host="0.0.0.0", port=5000, debug=False)
