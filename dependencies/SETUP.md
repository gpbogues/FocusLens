# FocusFindr - Setup & Dependencies

## Prerequisites

| Tool       | Version  | Download                                      |
|------------|----------|-----------------------------------------------|
| Node.js    | 18+      | https://nodejs.org/                            |
| npm        | 9+       | (included with Node.js)                        |
| Python     | 3.11     | https://www.python.org/downloads/release/python-3110/ |
| Git        | any      | https://git-scm.com/                           |

---

## Frontend (React + Vite + TypeScript)

Located in `Frontend/`

### Install
```bash
cd Frontend
npm install
```

### Run
```bash
npm run dev
```

### Dependencies (installed automatically via npm install)
- react 19
- react-dom 19
- react-router-dom 7
- vite 7
- typescript 5.9
- eslint 9

---

## Python / Data Collection (dc.py)

Located at project root

### Install

**Option A — Using the requirements file (recommended):**
```bash
pip install -r requirements.txt
```

**Option B — Manual install:**
```bash
pip install opencv-python mediapipe==0.10.5
```

> **Note:** mediapipe is pinned to version 0.10.5 for compatibility.

### Run
```bash
python dc.py
```

### Dependencies
- opencv-python (cv2) — webcam capture and image processing
- mediapipe 0.10.5 — face mesh / landmark detection

---

## Quick Start (full project)

```bash
# 1. Clone the repo
git clone <repo-url>
cd FocusFindr

# 2. Set up Python environment
python3.11 -m venv venv311
source venv311/bin/activate        # macOS/Linux
# venv311\Scripts\activate         # Windows
pip install -r requirements.txt

# 3. Set up Frontend
cd Frontend
npm install
npm run dev

# 4. Run data collection (in a separate terminal)
cd ..
python dc.py
```

---

## Troubleshooting

- **mediapipe import errors** — Make sure you are using Python 3.11, not a newer version. mediapipe 0.10.5 does not support Python 3.12+.
- **Camera not opening** — Ensure no other app is using the webcam. On macOS, grant terminal camera permission in System Settings > Privacy & Security > Camera.
- **npm install fails** — Make sure Node.js 18+ is installed (`node --version`).
