"""
Prerequisites (from repo root, local venv activated):
    pip install -r requirements.txt
    python3 scripts/seed_test_account.py

Step 1, create the demo user on EC2 (one-time, printed at startup if needed).
Step 2, script seeds sessions, chunks, folders, and AI feedback via the API.
"""

import os
import sys
import math
import random
import time
from datetime import datetime, timedelta

import numpy as np
import requests as _http

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
sys.path.insert(0, REPO_ROOT)

# Load rag/.env early so SEED_USER_ID and GROQ_API_KEY are seen before any prompts
_env_path = os.path.join(REPO_ROOT, "rag", ".env")
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip())

try:
    import bcrypt as _bcrypt
except ImportError:
    print("ERROR: bcrypt not installed. Run:  pip install bcrypt")
    sys.exit(1)

from rag.feedback_generator import generate_feedback

# config 
SEED_EMAIL    = "aalthou@okstate.edu"
SEED_PASSWORD = "Test123!"
SEED_USERNAME = "Asaad Althoubi"

START_DATE = datetime(2025, 4, 27)
END_DATE   = datetime(2026, 4, 26)

API_BASE = os.environ.get("API_BASE", "http://100.27.212.225:5000")

# focus archetypes
ARCHETYPES = {
    "High Focus": {
        "weight": 0.25,
        "chunk_weights": {"VF": 0.65, "SF": 0.25, "SU": 0.07, "VU": 0.03},
        "bio": {
            "ear":     (0.015, 0.022),
            "yaw":     (0.030, 0.070),
            "pitch":   (0.220, 0.320),
            "mar":     (0.012, 0.018),
            "eyebrow": (0.030, 0.042),
        },
    },
    "Solid": {
        "weight": 0.30,
        "chunk_weights": {"VF": 0.40, "SF": 0.40, "SU": 0.15, "VU": 0.05},
        "bio": {
            "ear":     (0.013, 0.018),
            "yaw":     (0.050, 0.090),
            "pitch":   (0.190, 0.260),
            "mar":     (0.015, 0.021),
            "eyebrow": (0.027, 0.035),
        },
    },
    "Mixed": {
        "weight": 0.25,
        "chunk_weights": {"VF": 0.25, "SF": 0.25, "SU": 0.30, "VU": 0.20},
        "bio": {
            "ear":     (0.010, 0.016),
            "yaw":     (0.060, 0.110),
            "pitch":   (0.160, 0.230),
            "mar":     (0.017, 0.024),
            "eyebrow": (0.025, 0.032),
        },
    },
    "Struggling": {
        "weight": 0.15,
        "chunk_weights": {"VF": 0.10, "SF": 0.20, "SU": 0.40, "VU": 0.30},
        "bio": {
            "ear":     (0.009, 0.013),
            "yaw":     (0.080, 0.130),
            "pitch":   (0.130, 0.190),
            "mar":     (0.019, 0.027),
            "eyebrow": (0.022, 0.029),
        },
    },
    "Very Bad": {
        "weight": 0.05,
        "chunk_weights": {"VF": 0.05, "SF": 0.10, "SU": 0.20, "VU": 0.65},
        "bio": {
            "ear":     (0.007, 0.012),
            "yaw":     (0.100, 0.160),
            "pitch":   (0.090, 0.160),
            "mar":     (0.022, 0.032),
            "eyebrow": (0.018, 0.025),
        },
    },
}

SESSION_NAMES = [
    "Chapter 3 Review", "Chapter 5 Review", "Chapter 8 Practice",
    "Work Session", "Morning Focus", "Evening Study",
    "Project Planning", "Research Session", "Literature Review",
    "Lecture Notes", "Problem Set #1", "Problem Set #4",
    "Midterm Prep", "Final Exam Review", "Reading Session",
    "Code Review", "Report Writing", "Data Analysis",
    "Thesis Outline", "Study Group Prep", "Algorithm Practice",
    "Concept Review", "Note Taking", "Assignment Work",
    "Lab Report", "Case Study", "Exam Prep",
    "Focused Reading", "Writing Session", "Quick Review",
    "Sprint Planning", "Proposal Draft", "Revision Session",
]

SESSION_DESCRIPTIONS = [
    "Going through the material from last week's lectures.",
    "Focused on finishing before the deadline.",
    "Reviewing key concepts for the upcoming test.",
    "Working through problem sets.",
    "Needed a productive morning session.",
    "Making good progress on the project.",
    "Long session but stayed focused overall.",
    "Struggled a bit but got through it.",
    "Quick session to review notes.",
    "Pre-exam preparation.",
]


# focus score helpers 

def _compute_avg_focus_feedback(counts: dict) -> float:
    SCORES = {"VF": 100, "SF": 66, "SU": 33, "VU": 0}
    total = sum(counts.values())
    return sum(SCORES[k] * v for k, v in counts.items()) / total if total else 0.0


def _infer_archetype(avg_focus_db: float) -> str:
    if avg_focus_db >= 2.4: return "High Focus"
    if avg_focus_db >= 1.8: return "Solid"
    if avg_focus_db >= 1.2: return "Mixed"
    if avg_focus_db >= 0.5: return "Struggling"
    return "Very Bad"

# synthetic frame generation

def _generate_frames(archetype: str, n: int) -> np.ndarray:
    bio = ARCHETYPES[archetype]["bio"]
    return np.column_stack([
        np.random.uniform(*bio["ear"],     n),
        np.random.uniform(*bio["yaw"],     n),
        np.random.uniform(*bio["pitch"],   n),
        np.random.uniform(*bio["mar"],     n),
        np.random.uniform(*bio["eyebrow"], n),
    ])


def build_stats(archetype: str, chunk_dist: dict, active_secs: int) -> dict:
    n   = max(500, active_secs * 2)
    arr = _generate_frames(archetype, n)
    distracted        = (arr[:, 0] < 0.012) | (arr[:, 1] > 0.09) | (arr[:, 2] < 0.18)
    distraction_ratio = float(np.sum(distracted)) / n * 100.0
    return {
        "avg_ear":                 float(np.mean(arr[:, 0])),
        "avg_head_yaw":            float(np.mean(arr[:, 1])),
        "avg_head_pitch":          float(np.mean(arr[:, 2])),
        "avg_mar":                 float(np.mean(arr[:, 3])),
        "avg_eyebrow":             float(np.mean(arr[:, 4])),
        "distraction_ratio":       distraction_ratio,
        "chunk_distribution":      dict(chunk_dist),
        "avg_focus_score":         _compute_avg_focus_feedback(chunk_dist),
        "active_duration_minutes": active_secs / 60.0,
    }

#  schedule helpers

def _generate_schedule(target: int = 100) -> list:
    weeks          = 52
    week_indices   = list(range(weeks))
    vacation_weeks = set(random.sample(week_indices, 6))
    crunch_pool    = [w for w in week_indices if w not in vacation_weeks]
    crunch_weeks   = set(random.sample(crunch_pool, 8))

    counts = []
    for w in week_indices:
        if w in vacation_weeks:
            counts.append(0)
        elif w in crunch_weeks:
            counts.append(random.randint(4, 5))
        else:
            counts.append(random.randint(1, 3))

    while sum(counts) > target + 5:
        eligible = [i for i, v in enumerate(counts) if v > 1 and i not in crunch_weeks and i not in vacation_weeks]
        if not eligible:
            break
        counts[random.choice(eligible)] -= 1
    while sum(counts) < target - 5:
        eligible = [i for i, v in enumerate(counts) if v < 3 and i not in crunch_weeks and i not in vacation_weeks]
        if not eligible:
            break
        counts[random.choice(eligible)] += 1

    dates = []
    for w, n in enumerate(counts):
        week_start = START_DATE + timedelta(weeks=w)
        days = random.sample(range(7), min(n, 7))
        for d in days:
            dates.append(week_start + timedelta(days=d))
    dates.sort()
    return dates


def _pick_archetype() -> str:
    names   = list(ARCHETYPES.keys())
    weights = [ARCHETYPES[a]["weight"] for a in names]
    return random.choices(names, weights=weights, k=1)[0]


def _pick_duration() -> int:
    if random.random() < 0.45:
        return int(random.gauss(25 * 60, 7 * 60))
    return int(random.gauss(75 * 60, 20 * 60))


def _pick_hour() -> int:
    pool = (
        list(range(9, 12)) * 3 +
        list(range(19, 23)) * 3 +
        list(range(7, 9))   * 1 +
        list(range(12, 19)) * 1 +
        [23]
    )
    return random.choice(pool)


def _gen_chunks(archetype: str, n: int) -> tuple:
    weights = ARCHETYPES[archetype]["chunk_weights"]
    labels  = list(weights.keys())
    probs   = list(weights.values())
    ordered = random.choices(labels, weights=probs, k=n)
    dist    = {"VF": 0, "SF": 0, "SU": 0, "VU": 0}
    for lbl in ordered:
        dist[lbl] += 1
    return dist, ordered


def _fmt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")

#  API helpers 

def _api(method: str, path: str, **kwargs):
    resp = getattr(_http, method)(f"{API_BASE}{path}", timeout=30, **kwargs)
    resp.raise_for_status()
    return resp.json()

# user creation 

def ensure_user() -> int:
    """
    If SEED_USER_ID env var is set, use it directly.
    Otherwise generate the bcrypt hash locally, print the one-time SSH sqlite3
    command to create the user on EC2, and prompt for the assigned UserID.
    """
    uid_env = os.environ.get("SEED_USER_ID", "").strip()
    if uid_env:
        print(f"  Using SEED_USER_ID={uid_env}")
        return int(uid_env)

    # Check if user already exists by trying a known-safe query via a session count
    # (no "get user by email" endpoint without auth — we rely on the caller knowing the ID)
    pw_hash = _bcrypt.hashpw(SEED_PASSWORD.encode(), _bcrypt.gensalt(rounds=12)).decode()
    safe_hash = pw_hash.replace("'", "''")  # SQL-escape for sqlite3 shell

    print()
    print("  ACTION REQUIRED ┐")
    print("  Run these two commands in a separate terminal to create the user:  ")
    print()
    print("  # 1. Insert user (run on EC2):")
    print(f"  ssh ubuntu@ec2-100-27-212-225.compute-1.amazonaws.com \\")
    print(f'    "sqlite3 ~/FocusLens/Backend/Database_backend/focuslens.db \\')
    print(f"    \\\"INSERT OR IGNORE INTO UserData (uEmail, uName, uPassword, verified, theme) \\")
    print(f"    VALUES ('{SEED_EMAIL}', '{SEED_USERNAME}', '{safe_hash}', 1, 'dark')\\\"\"")
    print()
    print("  # 2. Get the assigned UserID:")
    print(f"  ssh ubuntu@ec2-100-27-212-225.compute-1.amazonaws.com \\")
    print(f"    \"sqlite3 ~/FocusLens/Backend/Database_backend/focuslens.db \\")
    print(f"    \\\"SELECT UserID FROM UserData WHERE uEmail='{SEED_EMAIL}'\\\"\"")
    print()

    uid = input("  Enter the UserID from step 2: ").strip()
    if not uid.isdigit():
        print("ERROR: UserID must be a number.")
        sys.exit(1)
    return int(uid)

# retry wrapper 

def _call_with_retry(stats: dict, max_retries: int = 5, base_wait: int = 30):
    for attempt in range(max_retries):
        try:
            return generate_feedback(**stats)
        except Exception as e:
            is_rate_limit = "429" in str(e) or "rate" in str(e).lower()
            if is_rate_limit and attempt < max_retries - 1:
                wait = base_wait * (2 ** attempt)
                print(f"    Rate limited — waiting {wait}s (retry {attempt + 2}/{max_retries})...")
                time.sleep(wait)
            else:
                raise

#  session seeding 

def seed_sessions(user_id: int) -> list:
    dates = _generate_schedule(target=100)
    print(f"  Generated {len(dates)} session slots.\n")
    records = []

    for i, date in enumerate(dates):
        archetype   = _pick_archetype()
        duration    = max(600, _pick_duration())
        hour        = _pick_hour()
        start       = date.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
        active_secs = int(duration * random.uniform(0.90, 1.00))
        end         = start + timedelta(seconds=duration)
        name        = random.choice(SESSION_NAMES)
        description = random.choice(SESSION_DESCRIPTIONS) if random.random() < 0.40 else None

        # Start session row with historical timestamp
        r          = _api("post", "/session/start", json={"userId": user_id, "sessionStart": _fmt(start)})
        session_id = r["sessionId"]

        # Insert chunks
        n_chunks           = max(1, math.ceil(active_secs / 300))
        chunk_dist, ordered = _gen_chunks(archetype, n_chunks)
        for label in ordered:
            _api("post", "/session/chunk", json={"sessionId": session_id, "userId": user_id, "chunkStatus": label})

        # Finalize session first so it's saved even if feedback fails
        _api("patch", f"/sessions/{session_id}", json={
            "sessionName":        name,
            "sessionDescription": description,
            "sessionEnd":         _fmt(end),
            "activeDuration":     active_secs,
            "sessionFeedback":    None,
        })

        # Generate AI feedback and patch it in
        stats     = build_stats(archetype, chunk_dist, active_secs)
        feedback  = None
        fb_status = "SKIP (no key)"
        try:
            feedback  = _call_with_retry(stats)
            fb_status = "OK" if feedback else "SKIP (no key)"
        except Exception as e:
            fb_status = f"ERR ({type(e).__name__})"

        if feedback:
            _api("patch", f"/sessions/{session_id}", json={
                "sessionName":        name,
                "sessionDescription": description,
                "sessionEnd":         _fmt(end),
                "activeDuration":     active_secs,
                "sessionFeedback":    feedback,
            })

        records.append({
            "session_id":    session_id,
            "session_start": start,
            "active_secs":   active_secs,
            "name":          name,
            "chunk_dist":    chunk_dist,
            "archetype":     archetype,
            "session_end":   _fmt(end),
        })
        print(f"  [{i+1:3}/{len(dates)}] {_fmt(start)} | {name:<33} | {active_secs//60:3}min | {archetype:<12} | fb: {fb_status}")
        time.sleep(3)

    return records

# resume: find sessions with missing feedback 

def load_pending_sessions(user_id: int) -> list:
    """Fetch all sessions via API, return those with null/empty feedback."""
    all_sessions = []
    page = 1
    while True:
        r    = _api("get", f"/sessions/paginated/{user_id}?page={page}&limit=200")
        rows = r.get("sessions", [])
        all_sessions.extend(rows)
        if len(all_sessions) >= r.get("total", 0) or not rows:
            break
        page += 1

    pending = []
    for s in all_sessions:
        if s.get("sessionFeedback"):
            continue
        session_id = s["SessionID"]
        try:
            chunks_r   = _api("get", f"/sessions/{session_id}/chunks")
            chunk_rows = chunks_r.get("data", [])
        except Exception:
            chunk_rows = []

        chunk_dist = {"VF": 0, "SF": 0, "SU": 0, "VU": 0}
        for c in chunk_rows:
            status = c.get("chunkStatus", "")
            if status in chunk_dist:
                chunk_dist[status] += 1

        try:
            session_start = datetime.strptime(s["sessionStart"], "%Y-%m-%d %H:%M:%S")
        except (ValueError, KeyError):
            session_start = datetime.now()

        pending.append({
            "session_id":    session_id,
            "session_start": session_start,
            "session_end":   s.get("sessionEnd", _fmt(session_start + timedelta(hours=1))),
            "active_secs":   s.get("activeDuration", 600),
            "name":          s.get("sessionName", ""),
            "chunk_dist":    chunk_dist,
            "archetype":     _infer_archetype(s.get("avgFocus") or 0),
        })

    return pending


def retry_feedback(sessions: list):
    """Push feedback to sessions that are missing it."""
    ok = fail = 0
    for i, s in enumerate(sessions):
        stats     = build_stats(s["archetype"], s["chunk_dist"], s["active_secs"])
        feedback  = None
        fb_status = "SKIP (no key)"
        try:
            feedback  = _call_with_retry(stats)
            fb_status = "OK" if feedback else "SKIP (no key)"
        except Exception as e:
            fail += 1
            fb_status = f"ERR ({type(e).__name__})"
            print(f"  [{i+1:3}/{len(sessions)}] SessionID={s['session_id']} | {fb_status}")
            time.sleep(3)
            continue

        if feedback:
            _api("patch", f"/sessions/{s['session_id']}", json={
                "sessionName":        s["name"],
                "sessionDescription": None,
                "sessionEnd":         s["session_end"],
                "activeDuration":     s["active_secs"],
                "sessionFeedback":    feedback,
            })
            ok += 1
        else:
            fail += 1

        print(f"  [{i+1:3}/{len(sessions)}] SessionID={s['session_id']} | {fb_status}")
        time.sleep(3)

    return ok, fail

# folder seeding 

def seed_folders(user_id: int, sessions: list):
    study_kw = {"Review", "Prep", "Notes", "Reading", "Exam", "Problem",
                "Lecture", "Lab", "Concept", "Revision", "Research"}
    folders = [
        ("Study Sessions", "Coursework, readings, and exam preparation sessions."),
        ("Work",      "Long uninterrupted sessions over 45 minutes."),
        ("Morning Focus",  "Sessions started before 10 AM."),
    ]
    for fname, fdesc in folders:
        r         = _api("post", "/folders", json={"userId": user_id, "folderName": fname, "folderDescription": fdesc})
        folder_id = r["folderId"]
        count     = 0
        for s in sessions:
            matched = False
            if fname == "Study Sessions" and any(kw in s["name"] for kw in study_kw):
                matched = True
            elif fname == "Work" and s["active_secs"] > 45 * 60:
                matched = True
            elif fname == "Morning Focus" and s["session_start"].hour < 10:
                matched = True
            if matched:
                _api("post", f"/folders/{folder_id}/sessions", json={"sessionId": s["session_id"]})
                count += 1
        print(f"  '{fname}': {count} sessions")

# recent sessions (past 7 days)

def seed_recent_sessions(user_id: int) -> list:
    today   = datetime(2026, 4, 27)
    # 2-3 sessions per day for a natural-looking week
    offsets = sorted(random.sample(range(7), 5) + random.sample(range(7), 2))
    dates   = [today - timedelta(days=d) for d in offsets]
    records = []
    print(f"  Seeding {len(dates)} recent sessions (past 7 days)...")

    for i, date in enumerate(dates):
        archetype   = _pick_archetype()
        duration    = max(600, _pick_duration())
        hour        = _pick_hour()
        start       = date.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
        active_secs = int(duration * random.uniform(0.90, 1.00))
        end         = start + timedelta(seconds=duration)
        name        = random.choice(SESSION_NAMES)
        description = random.choice(SESSION_DESCRIPTIONS) if random.random() < 0.40 else None

        r          = _api("post", "/session/start", json={"userId": user_id, "sessionStart": _fmt(start)})
        session_id = r["sessionId"]

        n_chunks            = max(1, math.ceil(active_secs / 300))
        chunk_dist, ordered = _gen_chunks(archetype, n_chunks)
        for label in ordered:
            _api("post", "/session/chunk", json={"sessionId": session_id, "userId": user_id, "chunkStatus": label})

        # Save session first so it's persisted even if feedback fails
        _api("patch", f"/sessions/{session_id}", json={
            "sessionName":        name,
            "sessionDescription": description,
            "sessionEnd":         _fmt(end),
            "activeDuration":     active_secs,
            "sessionFeedback":    None,
        })

        stats     = build_stats(archetype, chunk_dist, active_secs)
        feedback  = None
        fb_status = "SKIP (no key)"
        try:
            feedback  = _call_with_retry(stats)
            fb_status = "OK" if feedback else "SKIP (no key)"
        except Exception as e:
            fb_status = f"ERR ({type(e).__name__})"

        if feedback:
            _api("patch", f"/sessions/{session_id}", json={
                "sessionName":        name,
                "sessionDescription": description,
                "sessionEnd":         _fmt(end),
                "activeDuration":     active_secs,
                "sessionFeedback":    feedback,
            })

        records.append({
            "session_id":    session_id,
            "session_start": start,
            "active_secs":   active_secs,
            "name":          name,
            "chunk_dist":    chunk_dist,
            "archetype":     archetype,
            "session_end":   _fmt(end),
        })
        print(f"  [{i+1:2}/{len(dates)}] {_fmt(start)} | {name:<33} | {active_secs//60:3}min | {archetype:<12} | fb: {fb_status}")
        time.sleep(3)

    return records


#  entry point

def main():
    print(f"API: {API_BASE}\n")

    print("1/3  User:")
    user_id = ensure_user()

    print("\n2/3  Sessions & chunks (+ AI feedback, ~3s each):")
    try:
        check    = _api("get", f"/sessions/paginated/{user_id}?page=1&limit=1")
        existing = check.get("total", 0)
    except Exception as e:
        print(f"  WARNING: could not check existing sessions: {e}")
        existing = 0

    if existing > 0:
        print(f"  Found {existing} existing sessions — seeding recent sessions first...")
        recent = seed_recent_sessions(user_id)
        print(f"  Inserted {len(recent)} recent sessions.\n")
        print(f"  Checking for missing feedback...")
        pending = load_pending_sessions(user_id)
        print(f"  {len(pending)} session(s) missing feedback.")
        if pending:
            ok, fail = retry_feedback(pending)
            print(f"\n  Feedback retry: {ok}/{len(pending)} OK, {fail} skipped/failed.")
        sessions = recent
    else:
        sessions = seed_sessions(user_id)
        print(f"\n  Inserted {len(sessions)} sessions.")

    print("\n3/3  Folders:")
    try:
        fr = _api("get", f"/folders/{user_id}")
        if fr.get("folders"):
            print(f"  Folders already exist ({len(fr['folders'])}) — skipping.")
        else:
            if sessions is None:
                # Build minimal session list from pending for folder mapping
                all_r    = _api("get", f"/sessions/paginated/{user_id}?page=1&limit=200")
                sessions = [
                    {
                        "session_id":    s["SessionID"],
                        "session_start": datetime.strptime(s["sessionStart"], "%Y-%m-%d %H:%M:%S"),
                        "active_secs":   s.get("activeDuration", 0),
                        "name":          s.get("sessionName", ""),
                    }
                    for s in all_r.get("sessions", [])
                ]
            seed_folders(user_id, sessions)
    except Exception as e:
        print(f"  WARNING: folder step failed: {e}")

    print(f"\n{'='*52}")
    print(f"Done!  Email:      {SEED_EMAIL}")
    print(f"       Password:   {SEED_PASSWORD}")
    print(f"       UserID:     {user_id}")
    print(f"{'='*52}")


if __name__ == "__main__":
    random.seed(42)
    np.random.seed(42)
    main()
