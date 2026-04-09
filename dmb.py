"""
The team connects React via /api/status and /api/video_feed.
Session context is received via /api/session (POST) when the user starts a session.
Every 5 active minutes (or on early stop via /api/session/end), a chunk is POSTed
to the Node.js backend which writes it to AWS RDS SessionChunk.

Install requirements:
pip install flask flask-cors opencv-python mediapipe joblib numpy requests
"""

import time
import threading
import joblib
import numpy as np
import cv2
import mediapipe as mp
import requests
from datetime import datetime
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
 
app = Flask(__name__)
CORS(app)  # Allows React to communicate with the API

# Node.js backend URL — chunks are POSTed here
NODE_API_URL = "http://localhost:3000"

# Active session context — set by frontend when session starts
_session_ctx = {"userId": None, "sessionId": None}

# Signal from /api/session/end to trigger an early save
_force_save_event = threading.Event()

def save_chunk_via_api(label):
    """POSTs a focus chunk to the Node.js backend (called every 5 min or on early stop)."""
    chunk_map = {3: "VF", 2: "SF", 1: "SU", 0: "VU"}
    chunk_status = chunk_map.get(label, "SU")
    if _session_ctx["sessionId"] is None:
        print("[API] No active session — chunk not saved")
        return
    try:
        resp = requests.post(f"{NODE_API_URL}/session/chunk", json={
            "sessionId":   _session_ctx["sessionId"],
            "userId":      _session_ctx["userId"],
            "chunkStatus": chunk_status,
        }, timeout=5)
        print(f"[API] Chunk saved → {chunk_status} ({resp.status_code})")
    except Exception as e:
        print(f"[API ERROR] {e}")
 
 
#   Shared State — React reads this via /api/status
live_state = {
    "status":               "INITIALIZING",  # FOCUSED / DISTRACTED / USER ABSENT / ...
    "color":                "gray",          # green / red / yellow / orange / gray
    "ear":                  0.0,
    "head_yaw":             0.0,
    "head_pitch":           0.0,
    "distraction_ratio":    0.0,
    "active_session_time":  0,
    "remaining_seconds":    300,
    "user_present":         False,
    "last_report":          None,            # last saved report
    # uration tracking (live, resets every 5 active minutes) 
    "focused_seconds":      0,              # total seconds spent FOCUSED this session
    "distracted_seconds":   0,              # total seconds spent DISTRACTED this session
}
 
# Camera stream frame buffer
_frame_bytes = {"data": None}
 
 
# Model + MediaPipe logic runs in this background thread
def focus_engine():
    """Runs in a separate background thread."""
 
    # . Load the model 
    try:
        clf = joblib.load("focus_rf_model.pkl")
        print("[MODEL] Loaded successfully.")
    except Exception:
        clf = None
        print("[MODEL] focus_rf_model.pkl not found — rule-based only.")
 
    #  MediaPipe setup 
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh    = mp_face_mesh.FaceMesh(refine_landmarks=True)
    cap          = cv2.VideoCapture(0)
 
    #  Control variables 
    five_min_buffer           = []
    active_session_time       = 0.0
    last_frame_time           = time.time()
    SAVE_INTERVAL             = 300        # 300 active seconds
 
    distraction_frames_count  = 0
    total_frames_processed    = 0
    consecutive_absent_frames = 0
    ABSENCE_THRESHOLD         = 35
 
    distraction_start_time    = None
    TIME_TO_DISTRACT          = 3.0
 
    #  Duration accumulators 
    focused_seconds           = 0.0
    distracted_seconds        = 0.0
 
    #  Distance helper 
    def get_dist(p1, p2):
        return np.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2)
 
    # Save function 
    def save_report():
        nonlocal five_min_buffer, distraction_frames_count
        nonlocal total_frames_processed, active_session_time
        nonlocal focused_seconds, distracted_seconds
 
        if total_frames_processed > 50:
            distraction_ratio = distraction_frames_count / total_frames_processed
            avg_features      = np.mean(five_min_buffer, axis=0)
 
            # Model classification 
            if clf:
                prediction = int(clf.predict([avg_features])[0])
            else:
                prediction = 1
 
            daisee_map = {0: "Very Distracted", 1: "Distracted",
                          2: "Focused",         3: "Very Focused"}
 
            if distraction_ratio > 0.40:
                prediction  = 1
                status_text = "Distracted"
            else:
                status_text = daisee_map.get(prediction, "Unknown")
 
            # POST chunk to Node.js backend
            save_chunk_via_api(label=prediction)
 
            live_state["last_report"] = {
                "time":              datetime.now().strftime("%I:%M:%S %p"),
                "status":            status_text,
                "label":             prediction,
                "distraction_ratio": f"{distraction_ratio:.2%}",
            }
 
        # Reset session 
        five_min_buffer           = []
        distraction_frames_count  = 0
        total_frames_processed    = 0
        active_session_time       = 0.0
        focused_seconds           = 0.0
        distracted_seconds        = 0.0
 
    #  Main Loop 
    while cap.isOpened():
        current_time    = time.time()
        delta_time      = current_time - last_frame_time
        last_frame_time = current_time
 
        ret, frame = cap.read()
        if not ret:
            break
 
        frame     = cv2.flip(frame, 1)
        h, w, _   = frame.shape
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results   = face_mesh.process(rgb_frame)
 
        user_detected = False
        if results.multi_face_landmarks:
            user_detected             = True
            consecutive_absent_frames = 0
        else:
            consecutive_absent_frames += 1
 
        # LOGIC: Only update timers and buffers if user is PRESENT
        if user_detected:
            active_session_time += delta_time
 
            lm = results.multi_face_landmarks[0].landmark
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
                if distraction_start_time is None:
                    distraction_start_time = time.time()
 
                if (time.time() - distraction_start_time) >= TIME_TO_DISTRACT:
                    current_logic_status = "DISTRACTED"
                    display_color        = "red"
                else:
                    current_logic_status = "STAY FOCUSED!"
                    display_color        = "yellow"
            else:
                distraction_start_time = None
                current_logic_status   = "FOCUSED"
                display_color          = "green"
 
            five_min_buffer.append([ear, head_yaw, head_pitch, mar, eyebrow])
            d_ratio = distraction_frames_count / total_frames_processed
 
            # Accumulate duration per status
            if current_logic_status == "FOCUSED":
                focused_seconds    += delta_time
            elif current_logic_status == "DISTRACTED":
                distracted_seconds += delta_time
 
            # Update shared state
            live_state.update({
                "status":              current_logic_status,
                "color":               display_color,
                "ear":                 round(ear, 4),
                "head_yaw":            round(head_yaw, 4),
                "head_pitch":          round(head_pitch, 4),
                "distraction_ratio":   round(d_ratio, 4),
                "active_session_time": int(active_session_time),
                "remaining_seconds":   max(0, int(SAVE_INTERVAL - active_session_time)),
                "user_present":        True,
                "focused_seconds":     int(focused_seconds),
                "distracted_seconds":  int(distracted_seconds),
            })
 
        elif consecutive_absent_frames < ABSENCE_THRESHOLD:
            # Briefly lost face 
            active_session_time      += delta_time
            distraction_frames_count += 1
            live_state["status"]      = "TRACKING..."
            live_state["user_present"] = True
        else:
            # User truly gone: FREEZE 
            live_state["status"]            = "USER ABSENT"
            live_state["color"]             = "orange"
            live_state["user_present"]      = False
            live_state["remaining_seconds"] = max(0, int(SAVE_INTERVAL - active_session_time))
            distraction_start_time          = None
 
        # Check 300 active seconds OR early-end signal from frontend
        if active_session_time >= SAVE_INTERVAL or _force_save_event.is_set():
            _force_save_event.clear()
            save_report()
 
        # Encode frame for stream
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        _frame_bytes["data"] = buf.tobytes()
 
    cap.release()
 
 
#   API Endpoints — call these from frontend

@app.route("/api/session", methods=["POST"])
def set_session():
    """
    Called by the frontend when a session starts.
    Body: { userId, sessionId }
    """
    data = request.get_json()
    _session_ctx["userId"]    = data.get("userId")
    _session_ctx["sessionId"] = data.get("sessionId")
    print(f"[SESSION] Started — userId={_session_ctx['userId']} sessionId={_session_ctx['sessionId']}")
    return jsonify({"ok": True})


@app.route("/api/session/end", methods=["POST"])
def end_session():
    """
    Called by the frontend when the session stops (including early stop < 5 min).
    Signals the engine thread to flush buffered data immediately, then clears session context.
    """
    _force_save_event.set()
    time.sleep(0.5)  # give engine thread one frame cycle to process the flush
    _session_ctx["userId"]    = None
    _session_ctx["sessionId"] = None
    print("[SESSION] Ended — context cleared")
    return jsonify({"ok": True})


@app.route("/api/status")
def api_status():
    """
    Full live state as JSON.
    React calls this every second, for example:
        fetch('http://localhost:5000/api/status')
    """
    return jsonify(live_state)
 
 
@app.route("/api/video_feed")
def api_video_feed():
    """
    MJPEG camera stream.
    In React:
        <img src="http://localhost:5000/api/video_feed" />
    """
    def generate():
        while True:
            frame = _frame_bytes.get("data")
            if frame:
                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")
            time.sleep(0.033)  # ~30fps
 
    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")
 
 
# main
if __name__ == "__main__":
    # Start FocusLens engine in the background
    t = threading.Thread(target=focus_engine, daemon=True)
    t.start()
 
    # Start Flask
    app.run(host="0.0.0.0", port=5000, debug=False)
 