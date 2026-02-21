"""
1. ENVIRONMENT: Ensure you have good lighting (don't sit with a bright window behind you).
2. DIVERSITY: While recording, move your head slowly (Up, Down, Left, Right). 
    Lean closer and further from the camera.
    Tilt your head slightly to the sides.
3. CATEGORIES: Run the script twice. 
   - Once with CATEGORY = 'Focused' (Look at the screen, blink normally).
   - Once with CATEGORY = 'Distracted' (Look at your phone, look out the window, close your eyes, look away from the screen (right/left)).
4. QUANTITY: Aim for 500 images per category.
5. USAGE: Press 's' to Start/Stop recording. Press 'q' to Quit.
// The script will automatically save images .
"""

import cv2
import os
import mediapipe as mp
import time

# --- CONFIGURATION///// Important ---
# Change this to 'Focused' or 'Distracted' before running
CATEGORY = 'Focused' 
SAVE_PATH = os.path.join('Dataset', CATEGORY)
os.makedirs(SAVE_PATH, exist_ok=True)

#MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5
)

# Camera Setup
cap = cv2.VideoCapture(0)
count = 0
recording = False
last_save_time = 0
save_interval = 1.0 # Capture 1 image every  second to ensure data diversity

print(f"--- DATA COLLECTION STARTED FOR: {CATEGORY} ---")
print("INSTRUCTIONS: Move your head slowly and vary your distance from the camera.")

while True:
    ret, frame = cap.read()
    if not ret:
        break
    
    # Flip frame for a mirror effect
    frame = cv2.flip(frame, 1)
    h, w, _ = frame.shape
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_frame)
    
    if results.multi_face_landmarks:
        for landmarks in results.multi_face_landmarks:
            # Points: 33, 133 (Left Eye) | 362, 263 (Right Eye) | 168 (Nose Bridge)
            pts = [33, 133, 362, 263, 168, 107, 336] 
            x_pts = [int(landmarks.landmark[i].x * w) for i in pts]
            y_pts = [int(landmarks.landmark[i].y * h) for i in pts]
            
            # Define Bounding Box with padding
            x1, x2 = max(0, min(x_pts)-25), min(w, max(x_pts)+25)
            y1, y2 = max(0, min(y_pts)-25), min(h, max(y_pts)+25)
            
            # Extract Eye Region
            eye_region = frame[y1:y2, x1:x2]
            
            if eye_region.size > 0:
                # Resize to standard input size for the model
                eye_img = cv2.resize(eye_region, (100, 50))
                cv2.imshow('Preview (Eye Region)', eye_img)
                
                # Logic for delayed saving to avoid duplicate frames
                current_time = time.time()
                if recording and (current_time - last_save_time > save_interval):
                    count += 1
                    # Unique filename using timestamp and counter
                    file_name = f"{CATEGORY}_{int(time.time())}_{count}.jpg"
                    cv2.imwrite(os.path.join(SAVE_PATH, file_name), eye_img)
                    last_save_time = current_time 

    # UI Overlay
    status_color = (0, 255, 0) if recording else (0, 0, 255)
    status_text = "RECORDING..." if recording else "STOPPED (Press 'S')"
    cv2.putText(frame, f"Status: {status_text}", (10, 30), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2)
    cv2.putText(frame, f"Images Captured: {count}", (10, 60), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    
    cv2.imshow('Main Collection Feed', frame)

    # Keyboard Controls
    key = cv2.waitKey(1) & 0xFF
    if key == ord('s'):
        recording = not recording
        print(f"Recording toggled: {recording}")
    elif key == ord('q'):
        break

# Cleanup
cap.release()
cv2.destroyAllWindows()
print(f"Finished! Total images saved in {CATEGORY}: {count}")