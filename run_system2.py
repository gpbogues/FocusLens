"""libraries: opencv-python, mediapipe, numpy

Press 'q' to quit
"""
import cv2
import mediapipe as mp
import time

# 1. MediaPipe Setup
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(refine_landmarks=True)

cap = cv2.VideoCapture(0)

# Timer and Status Variables
distraction_start_time = None
current_status = "FOCUSED"
DISTRACTION_THRESHOLD = 1.0  # Seconds required to trigger "DISTRACTED" status
HEAD_TURN_THRESHOLD = 0.099   # Sensitivity for head rotation (higher = more freedom)
EYE_EAR_THRESHOLD = 0.012    # Sensitivity for eye closure


while cap.isOpened():
    ret, frame = cap.read()
    if not ret: 
        break
    
    # Mirror the frame for natural interaction
    frame = cv2.flip(frame, 1)
    h, w, _ = frame.shape
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_frame)
    
    display_status = current_status
    color = (0, 255, 0) if current_status == "FOCUSED" else (0, 0, 255)

    if results.multi_face_landmarks:
        landmarks = results.multi_face_landmarks[0]
        
        # --- [1] Calculate EAR (Eye Aspect Ratio) ---
        # Points for upper and lower eyelids
        left_ear = abs(landmarks.landmark[159].y - landmarks.landmark[145].y)
        right_ear = abs(landmarks.landmark[386].y - landmarks.landmark[374].y)
        avg_ear = (left_ear + right_ear) / 2

        # --- [2] Calculate Head Yaw (Turn) ---
        # Using nose and ear landmarks to determine horizontal rotation
        nose = landmarks.landmark[1]
        left_ear_p = landmarks.landmark[234]
        right_ear_p = landmarks.landmark[454]
        head_turn = abs(abs(nose.x - left_ear_p.x) - abs(nose.x - right_ear_p.x))

        # --- [3] Real-time Distraction Logic ---
        is_currently_distracted = (avg_ear < EYE_EAR_THRESHOLD) or (head_turn > HEAD_TURN_THRESHOLD)

        if is_currently_distracted:
            if distraction_start_time is None:
                distraction_start_time = time.time() # Start the timer
            
            elapsed_time = time.time() - distraction_start_time
            
            # Change status only if distraction exceeds the threshold (e.g., 3 seconds)
            if elapsed_time >= DISTRACTION_THRESHOLD:
                current_status = "DISTRACTED"
            
            # Display countdown warning for the presentation
            remaining = max(0, DISTRACTION_THRESHOLD - elapsed_time)
            if current_status == "FOCUSED":
                cv2.putText(frame, f"Warning in: {remaining:.1f}s", (20, 120), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        else:
            # Reset timer and status if the user focuses back
            distraction_start_time = None
            current_status = "FOCUSED"

        # --- [4] Visual Indicators ---
        # Draw a small indicator on the nose for head tracking feedback
        cv2.circle(frame, (int(nose.x*w), int(nose.y*h)), 3, color, -1)

    # --- [5] UI Rendering ---
    color = (0, 255, 0) if current_status == "FOCUSED" else (0, 0, 255)
    # Background rectangle for status bar
    cv2.rectangle(frame, (0, 0), (w, 80), (30, 30, 30), -1)
    cv2.putText(frame, f"USER STATUS: {current_status}", (20, 55), 
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3)
    
    # real time debugging
    print(f"EAR: {avg_ear:.4f} | Head Turn: {head_turn:.4f} | Status: {current_status}", end='\r')

    cv2.imshow('FocusFinder ', frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()