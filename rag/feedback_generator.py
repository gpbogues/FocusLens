import os, logging, random, requests

logging.getLogger("chromadb.telemetry").setLevel(logging.CRITICAL)

# 1. Get the absolute path to the directory containing THIS file
_current_dir = os.path.dirname(os.path.abspath(__file__))

# 2. Look for .env in that same folder
_env_path = os.path.join(_current_dir, ".env")

# 3. Robustly load environment variables
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                # Set the variable, stripping extra spaces from both key and value
                os.environ[_k.strip()] = _v.strip()
else:
    print(f"[RAG WARNING] .env not found at: {_env_path}", flush=True)

# 4. Set DB_PATH relative to this file as well
DB_PATH = os.path.join(_current_dir, "focus_db")

# Lazy singletons, initialized on first call, reused across sessions
_chroma_client = None
_collection = None


def _ensure_db():
    """Download and extract focus_db from S3 if not present locally."""
    if os.path.isdir(DB_PATH):
        sqlite_path = os.path.join(DB_PATH, "chroma.sqlite3")
        if os.path.exists(sqlite_path):
            import sqlite3
            try:
                conn = sqlite3.connect(sqlite_path)
                cur = conn.cursor()
                cur.execute("SELECT COUNT(*) FROM collections")
                if cur.fetchone()[0] > 0:
                    conn.close()
                    return
                conn.close()
            except Exception:
                pass
        import shutil
        shutil.rmtree(DB_PATH)
    import boto3, tarfile, io
    bucket = os.environ.get("S3_BUCKET", "")
    key    = os.environ.get("S3_FOCUS_DB_KEY", "rag/focus_db.tar.gz")
    region = os.environ.get("AWS_REGION", "us-east-1")
    if not bucket:
        raise RuntimeError("focus_db missing locally and S3_BUCKET not set in rag/.env")
    print("[RAG] focus_db not found — downloading from S3...", flush=True)
    s3 = boto3.client(
        "s3",
        region_name=region,
        aws_access_key_id=os.environ.get("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("S3_SECRET_ACCESS_KEY"),
    )
    obj = s3.get_object(Bucket=bucket, Key=key)
    with tarfile.open(fileobj=io.BytesIO(obj["Body"].read()), mode="r:gz") as tar:
        tar.extractall(path=os.path.dirname(DB_PATH))
    print("[RAG] focus_db ready.", flush=True)


def _get_collection():
    global _chroma_client, _collection
    if _collection is None:
        _ensure_db()
        import chromadb
        from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
        ef = SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
        _chroma_client = chromadb.PersistentClient(path=DB_PATH)
        _collection = _chroma_client.get_collection("focus_research", embedding_function=ef)
    return _collection


def generate_feedback(
    avg_ear: float,
    avg_head_yaw: float,
    avg_head_pitch: float,
    avg_mar: float,
    avg_eyebrow: float,
    distraction_ratio: float,
    chunk_distribution: dict,
    avg_focus_score: float,
    active_duration_minutes: float,
) -> "str | None":
    """
    Generates a 3-section RAG-grounded feedback report for a completed focus session.

    Returns the report string on success.
    Returns None if GROQ_API_KEY is not set (graceful fallback, caller saves session without feedback).
    Raises on ChromaDB or network errors (caller should catch and set status='error').
    """
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
    if not GROQ_API_KEY:
        return None

    # Build human-readable focus timeline from chunk distribution
    CHUNK_LABELS = {
        "VF": "Very Focused",
        "SF": "Somewhat Focused",
        "SU": "Somewhat Unfocused",
        "VU": "Very Unfocused",
    }
    timeline_parts = [
        f"{v}x {CHUNK_LABELS[k]}"
        for k in ("VF", "SF", "SU", "VU")
        if chunk_distribution.get(k, 0) > 0
        for v in [chunk_distribution[k]]
    ]
    timeline_str = ", ".join(timeline_parts) if timeline_parts else "no chunks recorded"

    # Determine primary distraction signals (same thresholds as dmb.py distraction logic)
    active_signals = []
    if avg_ear < 0.012:
        active_signals.append("eye fatigue (low EAR)")
    if avg_head_yaw > 0.09:
        active_signals.append("head movement (looking away)")
    if avg_head_pitch < 0.18:
        active_signals.append("head tilt (drooping)")
    if avg_mar > 0.020:
        active_signals.append("yawning (high MAR)")
    if avg_eyebrow < 0.028:
        active_signals.append("brow tension (low eyebrow)")

    if len(active_signals) > 1:
        primary_cause = "mixed signals (" + ", ".join(active_signals) + ")"
    elif len(active_signals) == 1:
        primary_cause = active_signals[0]
    else:
        primary_cause = "minimal — no dominant distraction signal"

    raw_query = (
        f"## Session Data\n"
        f"- Duration: {active_duration_minutes:.1f} min\n"
        f"- Average focus: {avg_focus_score:.0f}%\n"
        f"- Focus timeline: {timeline_str}\n"
        f"\n## Biometric Signals\n"
        f"- Eye closure (EAR): {avg_ear:.4f} (fatigue threshold: <0.012)\n"
        f"- Head movement (yaw): {avg_head_yaw:.3f} (distraction threshold: >0.09)\n"
        f"- Head tilt (pitch): {avg_head_pitch:.3f} (drooping threshold: <0.18)\n"
        f"- Mouth opening (MAR): {avg_mar:.4f} (yawning threshold: >0.020)\n"
        f"- Eyebrow distance: {avg_eyebrow:.4f} (tension threshold: <0.028)\n"
        f"- Distraction ratio: {distraction_ratio:.1f}%\n"
        f"- Primary distraction signal: {primary_cause}"
    )

    # Build a single broad retrieval query from all active signals
    retrieval_terms = ["attention", "focus", "cognitive performance"]

    if avg_ear < 0.012:
        retrieval_terms += ["eye aspect ratio drowsiness", "microsleep eye closure", "eye fatigue cognitive performance"]
    elif avg_ear < 0.014:
        retrieval_terms += ["eye aspect ratio mental workload", "eye fatigue screen time"]
    else:
        retrieval_terms += ["eye tracking engagement attention"]

    if avg_head_yaw > 0.09:
        retrieval_terms += ["gaze deviation off-screen distraction", "head yaw attention lapse", "task disengagement"]
    elif avg_head_yaw > 0.06:
        retrieval_terms += ["gaze distraction attention wandering", "off-task eye movement"]

    if avg_head_pitch < 0.18:
        retrieval_terms += ["head pitch neck flexion fatigue", "forward head posture cognitive fatigue", "neck drooping drowsiness"]
    elif avg_head_pitch < 0.22:
        retrieval_terms += ["neck posture fatigue productivity", "head tilt attention"]

    if avg_mar > 0.020:
        retrieval_terms += ["yawning mouth opening fatigue drowsiness", "mouth aspect ratio fatigue cognitive performance"]

    if avg_eyebrow < 0.028:
        retrieval_terms += ["eyebrow furrowing cognitive effort attention", "facial action unit cognitive load concentration"]

    if distraction_ratio > 60:
        retrieval_terms += ["sustained attention failure", "attention restoration", "cognitive fatigue recovery"]
    elif distraction_ratio > 35:
        retrieval_terms += ["mind wandering task disengagement", "cognitive load distraction"]

    retrieval_query = " ".join(retrieval_terms)

    # Fetch top-30, deduplicate to 1 chunk per paper, then randomly sample 6 —
    # same signal profile gets different papers each session
    col = _get_collection()
    results = col.query(query_texts=[retrieval_query], n_results=30)
    seen_sources = set()
    pool_chunks, pool_sources = [], []
    for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
        src = meta["source"]
        if src not in seen_sources:
            pool_chunks.append(doc)
            pool_sources.append(src)
            seen_sources.add(src)

    indices = random.sample(range(len(pool_sources)), min(6, len(pool_sources)))
    chunks  = [pool_chunks[i]  for i in indices]
    sources = [pool_sources[i] for i in indices]

    research_context = "\n\n".join(
        f"[From: {os.path.splitext(src)[0][:70]}]\n{chunk}"
        for chunk, src in zip(chunks, sources)
    )

    system_msg = (
        "You are FocusLens AI, embedded in the FocusLens web app that tracks five facial biometric signals "
        "to measure focus: eye aspect ratio (EAR), head yaw, head pitch, mouth aspect ratio (MAR), and "
        "eyebrow distance. Focus quality per 5-minute chunk is labelled VF (Very Focused), SF (Somewhat "
        "Focused), SU (Somewhat Unfocused), or VU (Very Unfocused). Write a post-session report using ONLY "
        "data from this session and the provided research context. Never give generic advice.\n\n"
        "Output exactly three sections using this format with no extra symbols or markdown:\n"
        "Summary:\n<one sentence referencing at least one specific biometric number from this session>\n\n"
        "Recommendation:\n<one actionable tip tied directly to the primary distraction signal, grounded in the research context>\n\n"
        "Highlight:\n<one genuine positive observation drawn from the actual session metrics>\n\n"
        "Each section: 1–2 sentences. Do not add extra sections, preamble, or any markdown symbols."
    )
    user_msg = (
        f"{raw_query}\n\n"
        f"## Research Context\n{research_context}\n\n"
        f"## Task\n"
        f"Using the session data and research above, write the three-section report. "
        f"Every claim must be supported by a specific number from this session or a finding "
        f"from the research context. Do not invent or generalize."
    )

    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}",
        },
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user",   "content": user_msg},
            ],
            "temperature": 0.5,
            "max_tokens": 400,
        },
        timeout=60,
    )
    resp.raise_for_status()
    report = resp.json()["choices"][0]["message"]["content"].strip()

    if sources:
        def _fmt(name, limit=60):
            return name if len(name) <= limit else name[:limit - 3] + "..."
        citations = "\n".join(
            f"{i + 1}. {_fmt(os.path.splitext(src)[0])}"
            for i, src in enumerate(sources)
        )
        report = f"{report}\n\nSources:\n{citations}"

    return report
