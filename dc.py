'''
ensure you have Python 3.11 installed. You need to install the following libraries using your terminal:
pip install opencv-python mediapipe==0.10.5

Once the camera window opens, click inside the window with your mouse to focus it
Press 'f' to save a Focused image (looking directly at the screen).
Press 'd' to save a Distracted image (looking away, closing eyes, or looking at a phone).
Press 'ESC' to save and exit.

Work in a well-lit room. Avoid strong light sources directly behind you (it makes your face too dark).
Don't stay perfectly still. Slightly tilt your head or change your distance from the camera while collecting images.

When pressing 'd', simulate different scenarios:
Look at your phone.
Close your eyes (simulating sleep).
Look to the far left/right or down

If you wear glasses, collect some images with them on and some with them off.
Please try to collect at least 200 images for each category (400 total per person).
'''




import os
import sys
import getpass
import cv2

# Automatically get the current computer username
username = getpass.getuser()

# Build paths dynamically for any user
paths = [
    f'C:\\Users\\{username}\\AppData\\Roaming\\Python\\Python311\\site-packages',
    f'C:\\Users\\{username}\\AppData\\Local\\Programs\\Python\\Python311\\Lib\\site-packages'
]

for p in paths:
    if os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

try:
    import mediapipe as mp
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5
    )
    print("SUCCESS: Mediapipe Mesh Loaded!")
except AttributeError:
    print("ERROR: Attribute Issue. Checking library structure...")
    print(dir(mp)) # help us see what's inside
    sys.exit()
except Exception as e:
    print(f"STILL ERROR: {e}")
    sys.exit()

# Folder creation
if not os.path.exists('Dataset/Focused'): os.makedirs('Dataset/Focused')
if not os.path.exists('Dataset/Distracted'): os.makedirs('Dataset/Distracted')

cap = cv2.VideoCapture(0)
count = 0

print("SYSTEM STARTING... Press F or D")

while cap.isOpened():
    success, frame = cap.read()
    if not success: break

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb)

    if results.multi_face_landmarks:
        for landmarks in results.multi_face_landmarks:
            h, w, _ = frame.shape
            # Focus on Left Eye
            pts = [33, 133, 159, 145]
            x_pts = [landmarks.landmark[i].x * w for i in pts]
            y_pts = [landmarks.landmark[i].y * h for i in pts]
            
            x1, x2 = int(min(x_pts)) - 10, int(max(x_pts)) + 10
            y1, y2 = int(min(y_pts)) - 10, int(max(y_pts)) + 10
            
            eye = frame[max(0,y1):min(h,y2), max(0,x1):min(w,x2)]

            if eye.size > 0:
                cv2.imshow('EYE_PREVIEW', cv2.resize(eye, (160, 80)))
                
                key = cv2.waitKey(1)
                if key == ord('f'):
                    cv2.imwrite(f'Dataset/Focused/f_{count}.jpg', eye)
                    print(f"Captured: Focused {count}")
                    count += 1
                elif key == ord('d'):
                    cv2.imwrite(f'Dataset/Distracted/d_{count}.jpg', eye)
                    print(f"Captured: Distracted {count}")
                    count += 1
                elif key == 27: break

    cv2.imshow('Main Window', frame)
    if cv2.waitKey(1) == 27: break

cap.release()
cv2.destroyAllWindows()