"""
Prerequisites (from repo root, venv activated):
    pip install bcrypt
    python scripts/seed_test_account.py
"""

import os
import sys
import math
import random
import sqlite3
import time
from datetime import datetime, timedelta

import numpy as np

# path setup
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
sys.path.insert(0, REPO_ROOT)

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

DB_DEFAULT = os.path.join(REPO_ROOT, "Backend", "Database_backend", "focuslens.db")
DB_PATH    = os.environ.get("DB_PATH", DB_DEFAULT)

# focus archetypes 
# Biometric ranges align with feedback_generator.py thresholds:
#   avg_ear   < 0.012 → eye fatigue
#   avg_head_yaw > 0.09 → head movement
#   avg_head_pitch < 0.18 → head tilt
#   avg_mar   > 0.020 → yawning
#   avg_eyebrow < 0.028 → brow tension
# Per-frame distraction (dmb.py:270): ear<0.012 OR yaw>0.09 OR pitch<0.18
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
    "Deep Work Session", "Morning Focus", "Evening Study",
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
    """Mirror of dmb.py:40-46 — 0-100 scale, used for generate_feedback()."""
    SCORES = {"VF": 100, "SF": 66, "SU": 33, "VU": 0}
    total = sum(counts.values())
    if total == 0:
        return 0.0
    return sum(SCORES[k] * v for k, v in counts.items()) / total


def _compute_avg_focus_db(counts: dict) -> float:
    """Mirror of server.js:324-327 — 0-3 scale, stored in UserSession.avgFocus."""
    SCORES = {"VF": 3, "SF": 2, "SU": 1, "VU": 0}
    total = sum(counts.values())
    if total == 0:
        return 0.0
    return sum(SCORES[k] * v for k, v in counts.items()) / total

# synthetic frame generation 

def _generate_frames(archetype: str, n: int) -> np.ndarray:
    """Return (n, 5) array: [ear, yaw, pitch, mar, eyebrow] per synthetic frame."""
    bio = ARCHETYPES[archetype]["bio"]
    cols = [
        np.random.uniform(*bio["ear"],     n),
        np.random.uniform(*bio["yaw"],     n),
        np.random.uniform(*bio["pitch"],   n),
        np.random.uniform(*bio["mar"],     n),
        np.random.uniform(*bio["eyebrow"], n),
    ]
    return np.column_stack(cols)


def build_stats(archetype: str, chunk_dist: dict, active_secs: int) -> dict:
    """Build _session_last_stats dict matching dmb.py:300-312 exactly."""
    n   = max(500, active_secs * 2)
    arr = _generate_frames(archetype, n)

    # Per-frame distraction: dmb.py:270 — ear<0.012 OR yaw>0.09 OR pitch<0.18
    distracted       = (arr[:, 0] < 0.012) | (arr[:, 1] > 0.09) | (arr[:, 2] < 0.18)
    distraction_ratio = float(np.sum(distracted)) / n * 100.0

    return {
        "avg_ear":                float(np.mean(arr[:, 0])),
        "avg_head_yaw":           float(np.mean(arr[:, 1])),
        "avg_head_pitch":         float(np.mean(arr[:, 2])),
        "avg_mar":                float(np.mean(arr[:, 3])),
        "avg_eyebrow":            float(np.mean(arr[:, 4])),
        "distraction_ratio":      distraction_ratio,
        "chunk_distribution":     dict(chunk_dist),
        "avg_focus_score":        _compute_avg_focus_feedback(chunk_dist),
        "active_duration_minutes": active_secs / 60.0,
    }

# schedule generation 

def _generate_schedule(target: int = 100) -> list:
    """Return list of datetime objects (session start dates), sorted ascending."""
    weeks = 52
    week_indices = list(range(weeks))

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

    # Nudge toward target
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
    for week_i, n in enumerate(counts):
        week_start = START_DATE + timedelta(weeks=week_i)
        day_pool = list(range(7))
        random.shuffle(day_pool)
        for offset in day_pool[:n]:
            d = week_start + timedelta(days=offset)
            if d > END_DATE:
                continue
            dates.append(d)

    dates.sort()
    return dates


def _pick_hour() -> int:
    """Weighted hour: peaks at 9-11 AM and 7-10 PM."""
    pool = (
        list(range(9, 12)) * 4 +
        list(range(12, 15)) * 2 +
        list(range(15, 18)) * 1 +
        list(range(19, 23)) * 4 +
        list(range(7,  9))  * 2
    )
    return random.choice(pool)


def _pick_duration() -> int:
    """Bimodal: short ~25 min or long ~75 min, clamped to 10-120 min."""
    mins = random.gauss(25, 8) if random.random() < 0.55 else random.gauss(75, 20)
    return int(max(10, min(120, mins)) * 60)


def _pick_archetype() -> str:
    names   = list(ARCHETYPES.keys())
    weights = [ARCHETYPES[n]["weight"] for n in names]
    return random.choices(names, weights=weights, k=1)[0]


def _gen_chunks(archetype: str, n: int) -> tuple:
    """Returns (counts dict, ordered label list)."""
    weights = ARCHETYPES[archetype]["chunk_weights"]
    labels  = list(weights.keys())
    probs   = list(weights.values())
    ordered = random.choices(labels, weights=probs, k=n)
    counts  = {"VF": 0, "SF": 0, "SU": 0, "VU": 0}
    for lbl in ordered:
        counts[lbl] += 1
    return counts, ordered

# database helpers 

def _fmt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def init_schema(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS UserData (
            UserID        INTEGER PRIMARY KEY AUTOINCREMENT,
            uEmail        TEXT NOT NULL UNIQUE,
            uName         TEXT NOT NULL,
            uPassword     TEXT NOT NULL,
            verified      INTEGER NOT NULL DEFAULT 0,
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            avatarUrl     TEXT NULL DEFAULT NULL,
            cameraEnabled INTEGER,
            micEnabled    INTEGER,
            avatarId      TEXT,
            theme         TEXT NOT NULL DEFAULT 'dark'
        );
        CREATE TABLE IF NOT EXISTS UserSession (
            SessionID          INTEGER PRIMARY KEY AUTOINCREMENT,
            UserID             INTEGER NOT NULL,
            sessionStart       TEXT NOT NULL DEFAULT (datetime('now')),
            sessionEnd         TEXT NOT NULL DEFAULT (datetime('now')),
            activeDuration     INTEGER NOT NULL DEFAULT 0,
            avgFocus           REAL NOT NULL,
            sessionName        TEXT NOT NULL DEFAULT '',
            sessionDescription TEXT NULL,
            sessionFeedback    TEXT NULL,
            FOREIGN KEY (UserID) REFERENCES UserData(UserID) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS SessionChunk (
            ChunkId     INTEGER PRIMARY KEY AUTOINCREMENT,
            SessionID   INTEGER NOT NULL,
            UserID      INTEGER NOT NULL,
            endOfChunk  TEXT NOT NULL DEFAULT (datetime('now')),
            chunkStatus TEXT CHECK(chunkStatus IN ('VF', 'SF', 'VU', 'SU')),
            FOREIGN KEY (SessionID) REFERENCES UserSession(SessionID) ON DELETE CASCADE,
            FOREIGN KEY (UserID)    REFERENCES UserData(UserID)       ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS SessionFolder (
            FolderID          INTEGER PRIMARY KEY AUTOINCREMENT,
            UserID            INTEGER NOT NULL,
            folderName        TEXT NOT NULL,
            folderDescription TEXT NULL,
            createdAt         TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (UserID) REFERENCES UserData(UserID) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS SessionFolderMap (
            FolderID  INTEGER NOT NULL,
            SessionID INTEGER NOT NULL,
            PRIMARY KEY (FolderID, SessionID),
            FOREIGN KEY (FolderID)  REFERENCES SessionFolder(FolderID)  ON DELETE CASCADE,
            FOREIGN KEY (SessionID) REFERENCES UserSession(SessionID)   ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_usersession_userid_start      ON UserSession(UserID, sessionStart DESC);
        CREATE INDEX IF NOT EXISTS idx_usersession_userid_duration   ON UserSession(UserID, activeDuration DESC);
        CREATE INDEX IF NOT EXISTS idx_usersession_userid_focus      ON UserSession(UserID, avgFocus DESC);
        CREATE INDEX IF NOT EXISTS idx_sessionchunk_sessionid        ON SessionChunk(SessionID);
        CREATE INDEX IF NOT EXISTS idx_sessionchunk_userid           ON SessionChunk(UserID);
        CREATE INDEX IF NOT EXISTS idx_usersession_userid_lower_name ON UserSession(UserID, LOWER(sessionName));
        CREATE INDEX IF NOT EXISTS idx_sessionfoldermap_sessionid    ON SessionFolderMap(SessionID);
    """)
    conn.commit()


def upsert_user(conn: sqlite3.Connection) -> int:
    row = conn.execute("SELECT UserID FROM UserData WHERE uEmail = ?", (SEED_EMAIL,)).fetchone()
    if row:
        print(f"  User already exists — reusing UserID={row[0]}")
        return row[0]
    pw_hash = _bcrypt.hashpw(SEED_PASSWORD.encode(), _bcrypt.gensalt(rounds=12)).decode()
    cur = conn.execute(
        "INSERT INTO UserData (uEmail, uName, uPassword, verified, theme) VALUES (?, ?, ?, 1, 'dark')",
        (SEED_EMAIL, SEED_USERNAME, pw_hash),
    )
    conn.commit()
    print(f"  Created: {SEED_EMAIL}  (UserID={cur.lastrowid})")
    return cur.lastrowid

# main seed steps 

def seed_sessions(conn: sqlite3.Connection, user_id: int) -> list:
    dates = _generate_schedule(target=100)
    print(f"  Generated {len(dates)} session slots.\n")
    records = []

    for i, date in enumerate(dates):
        archetype    = _pick_archetype()
        duration     = _pick_duration()
        hour         = _pick_hour()
        start        = date.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
        active_secs  = int(duration * random.uniform(0.90, 1.00))
        end          = start + timedelta(seconds=duration)
        name         = random.choice(SESSION_NAMES)
        description  = random.choice(SESSION_DESCRIPTIONS) if random.random() < 0.40 else None

        cur = conn.execute(
            "INSERT INTO UserSession "
            "(UserID, sessionStart, sessionEnd, activeDuration, avgFocus, sessionName, sessionDescription) "
            "VALUES (?, ?, ?, ?, 0, ?, ?)",
            (user_id, _fmt(start), _fmt(end), active_secs, name, description),
        )
        session_id = cur.lastrowid

        n_chunks              = max(1, math.ceil(active_secs / 300))
        chunk_dist, ordered   = _gen_chunks(archetype, n_chunks)

        for c_i, label in enumerate(ordered):
            chunk_end = start + timedelta(seconds=300 * (c_i + 1))
            conn.execute(
                "INSERT INTO SessionChunk (SessionID, UserID, endOfChunk, chunkStatus) VALUES (?, ?, ?, ?)",
                (session_id, user_id, _fmt(chunk_end), label),
            )

        avg_focus_db = _compute_avg_focus_db(chunk_dist)
        conn.execute("UPDATE UserSession SET avgFocus = ? WHERE SessionID = ?", (avg_focus_db, session_id))
        conn.commit()

        records.append({
            "session_id":    session_id,
            "session_start": start,
            "archetype":     archetype,
            "active_secs":   active_secs,
            "name":          name,
            "chunk_dist":    chunk_dist,
        })
        print(f"  [{i+1:3}/{len(dates)}] {_fmt(start)} | {name:<33} | {active_secs//60:3}min | {archetype}")

    return records


def _infer_archetype(avg_focus_db: float) -> str:
    """Map a stored 0-3 avgFocus back to the closest archetype for biometric generation."""
    if avg_focus_db >= 2.4: return "High Focus"
    if avg_focus_db >= 1.8: return "Solid"
    if avg_focus_db >= 1.2: return "Mixed"
    if avg_focus_db >= 0.5: return "Struggling"
    return "Very Bad"


def load_pending_sessions(conn: sqlite3.Connection, user_id: int) -> list:
    """
    Load sessions that are missing AI feedback from the DB.
    Reconstructs the data shape seed_feedback() expects by reading chunks.
    """
    rows = conn.execute(
        "SELECT SessionID, avgFocus, activeDuration, sessionStart FROM UserSession "
        "WHERE UserID = ? AND (sessionFeedback IS NULL OR sessionFeedback = '') "
        "ORDER BY sessionStart ASC",
        (user_id,),
    ).fetchall()

    if not rows:
        return []

    pending = []
    for session_id, avg_focus_db, active_secs, session_start_str in rows:
        chunk_rows = conn.execute(
            "SELECT chunkStatus FROM SessionChunk WHERE SessionID = ?",
            (session_id,),
        ).fetchall()
        chunk_dist = {"VF": 0, "SF": 0, "SU": 0, "VU": 0}
        for (status,) in chunk_rows:
            if status in chunk_dist:
                chunk_dist[status] += 1

        try:
            session_start = datetime.strptime(session_start_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            session_start = datetime.now()

        pending.append({
            "session_id":    session_id,
            "session_start": session_start,
            "archetype":     _infer_archetype(avg_focus_db or 0),
            "active_secs":   active_secs or 600,
            "name":          "",
            "chunk_dist":    chunk_dist,
        })

    return pending


def _call_with_retry(stats: dict, max_retries: int = 5, base_wait: int = 30):
    """Call generate_feedback with exponential backoff on rate-limit errors."""
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


def seed_feedback(conn: sqlite3.Connection, sessions: list) -> tuple:
    ok = fail = 0
    for i, s in enumerate(sessions):
        stats = build_stats(s["archetype"], s["chunk_dist"], s["active_secs"])
        try:
            feedback = _call_with_retry(stats)
            if feedback:
                conn.execute(
                    "UPDATE UserSession SET sessionFeedback = ? WHERE SessionID = ?",
                    (feedback, s["session_id"]),
                )
                conn.commit()
                ok += 1
                status = "OK"
            else:
                fail += 1
                status = "SKIP (GROQ_API_KEY not set)"
        except Exception as e:
            fail += 1
            status = f"ERROR ({type(e).__name__}: {e})"

        print(f"  [{i+1:3}/{len(sessions)}] SessionID={s['session_id']:4} | {status}")
        time.sleep(3)

    return ok, fail


def seed_folders(conn: sqlite3.Connection, user_id: int, sessions: list):
    study_kw = {"Review", "Prep", "Notes", "Reading", "Exam", "Problem",
                "Lecture", "Lab", "Concept", "Revision", "Research"}
    folders = [
        ("Study Sessions", "Coursework, readings, and exam preparation sessions."),
        ("Deep Work",      "Long uninterrupted sessions over 45 minutes."),
        ("Morning Focus",  "Sessions started before 10 AM."),
    ]
    folder_ids = {}
    for name, desc in folders:
        cur = conn.execute(
            "INSERT INTO SessionFolder (UserID, folderName, folderDescription) VALUES (?, ?, ?)",
            (user_id, name, desc),
        )
        folder_ids[name] = cur.lastrowid

    for s in sessions:
        if any(kw in s["name"] for kw in study_kw):
            conn.execute("INSERT OR IGNORE INTO SessionFolderMap VALUES (?, ?)",
                         (folder_ids["Study Sessions"], s["session_id"]))
        if s["active_secs"] > 45 * 60:
            conn.execute("INSERT OR IGNORE INTO SessionFolderMap VALUES (?, ?)",
                         (folder_ids["Deep Work"], s["session_id"]))
        if s["session_start"].hour < 10:
            conn.execute("INSERT OR IGNORE INTO SessionFolderMap VALUES (?, ?)",
                         (folder_ids["Morning Focus"], s["session_id"]))

    conn.commit()
    for name, fid in folder_ids.items():
        count = conn.execute(
            "SELECT COUNT(*) FROM SessionFolderMap WHERE FolderID = ?", (fid,)
        ).fetchone()[0]
        print(f"  '{name}': {count} sessions")

# entry point 

def main():
    print(f"DB: {DB_PATH}\n")
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")

    print(" 1/4 Schema: ")
    init_schema(conn)
    print("  OK")

    print("\n 2/4 User: ")
    user_id = upsert_user(conn)

    print("\n 3/4 Sessions & chunks: ")
    existing = conn.execute(
        "SELECT COUNT(*) FROM UserSession WHERE UserID = ?", (user_id,)
    ).fetchone()[0]

    if existing > 0:
        print(f"  Found {existing} existing sessions — resuming feedback only.")
        sessions      = None
        pending       = load_pending_sessions(conn, user_id)
        feedback_list = pending
        print(f"  {len(pending)} session(s) missing feedback.\n")
    else:
        sessions      = seed_sessions(conn, user_id)
        feedback_list = sessions
        print(f"\n  Inserted {len(sessions)} sessions.")

    print("\n 4/4 AI Feedback (~3s per session): ")
    if not feedback_list:
        print("  Nothing to do — all sessions already have feedback.")
        ok, fail = 0, 0
    else:
        ok, fail = seed_feedback(conn, feedback_list)
    print(f"\n  Feedback: {ok}/{len(feedback_list)} OK, {fail} skipped/failed.")

    print("\n 5/5 Folders: ")
    folder_count = conn.execute(
        "SELECT COUNT(*) FROM SessionFolder WHERE UserID = ?", (user_id,)
    ).fetchone()[0]
    if folder_count > 0:
        print(f"  Folders already exist ({folder_count}) — skipping.")
    else:
        seed_folders(conn, user_id, sessions or load_pending_sessions(conn, user_id))

    conn.close()
    print(f"\n{'='*50}")
    print(f"Done!  Log in as:  {SEED_EMAIL}")
    print(f"       Password:   {SEED_PASSWORD}")
    print(f"       UserID:     {user_id}")
    print(f"{'='*50}")


if __name__ == "__main__":
    random.seed(42)
    np.random.seed(42)
    main()
