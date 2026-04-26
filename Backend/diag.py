"""
Used for frame debug
Run this from the FocusLens folder while sitting in front of your camera:
    python diag.py
"""
import os, sys, time
import cv2, numpy as np, mediapipe as mp
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision as mp_vision

base = os.path.dirname(os.path.abspath(__file__))
pkl  = os.path.join(base, "focus_rf_model.pkl")
task = os.path.join(base, "face_landmarker.task")

print("PATH CHECK")
print(f"  focus_rf_model.pkl : {'EXISTS' if os.path.exists(pkl) else 'MISSING'} -> {pkl}")
print(f"  face_landmarker.task: {'EXISTS' if os.path.exists(task) else 'MISSING'} -> {task}")

print("\nCAMERA + FACE DETECTION")
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
if not cap.isOpened():
    print("  Camera failed to open"); sys.exit(1)

print("  Warming up camera (2 s), be in front of camera")
time.sleep(2)

opts = mp_vision.FaceLandmarkerOptions(
    base_options=mp_tasks.BaseOptions(model_asset_path=task),
    running_mode=mp_vision.RunningMode.IMAGE,
    num_faces=1,
    min_face_detection_confidence=0.1,
)
lm = mp_vision.FaceLandmarker.create_from_options(opts)

detected = 0
for i in range(30):
    ret, frame = cap.read()
    if not ret:
        print(f"  Frame {i}: read failed"); continue
    rgb = np.ascontiguousarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), dtype=np.uint8)
    r = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    n = len(r.face_landmarks)
    detected += n
    print(f"  Frame {i:02d}: brightness={frame.mean():.0f}  faces={n}")

cap.release()
print(f"\nTotal faces detected across 30 frames: {detected}")
if detected == 0:
    print("  -> Detection failed")
else:
    print("  -> Detection working")
