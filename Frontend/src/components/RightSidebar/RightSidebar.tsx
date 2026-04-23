import { useState, useRef } from 'react';
import WebcamFeed from '../WebcamFeed/WebcamFeed';
import { useAuth } from '../../context/AuthContext';
import './RightSidebar.css';

interface RightSidebarProps {
  isSessionActive: boolean;
  onToggleSession: () => void;
  isPaused: boolean;
  onPauseSession: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// dmb.py Flask server — always runs locally on the user's machine
const DMB_URL = import.meta.env.VITE_DMB_URL ?? 'http://localhost:5000';

//Format stored time to fit with sql timedate format
//Updated to return user current time based off of local timezone,
//before was simpler but used UTC time for everyone, which created offsets
const toMySQLDateTime = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

//Generate default session name as date + time in AM/PM format
const toDefaultSessionName = () => {
  const now = new Date();
  return (
    now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
    ' ' +
    now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  );
};

type FeedbackStatus = 'idle' | 'generating' | 'ready' | 'error' | 'unavailable';

const RightSidebar = ({ isSessionActive, onToggleSession, isPaused, onPauseSession, isCollapsed, onToggleCollapse }: RightSidebarProps) => {
  const { user, notifySessionSaved, highlightSession, clearHighlightSession } = useAuth();
  const [sessionStart, setSessionStart] = useState<string>('');
  const [sessionEnd, setSessionEnd] = useState<string>('');
  const [saveModal, setSaveModal] = useState<'confirm' | 'details' | 'feedback' | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  //Holds the captured end time and default name while modal is open
  const [pendingEndTime, setPendingEndTime] = useState<string>('');
  const [defaultName, setDefaultName] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL;

  //Feedback state
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>('idle');
  const feedbackPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  //Date.now() accumulator for active time tracking
  const accumulatedMsRef = useRef<number>(0);
  const lastResumeAtRef = useRef<number>(0);
  //Ref to capture activeDuration at stop time, used in the save modal
  const pendingActiveDurationRef = useRef<number>(0);
  //Pre-created session ID — assigned on Start, used for chunks and finalization
  const sessionIdRef = useRef<number | null>(null);
  // Capture name/description at Modal 2 confirm time for use in Modal 3 save
  const pendingNameRef = useRef<string>('');
  const pendingDescRef = useRef<string>('');

  //Show/hide camera feed — toggle is purely cosmetic, tracking always runs when session is active
  const [showFeed, setShowFeed] = useState(true);

  const stopFeedbackPoll = () => {
    if (feedbackPollRef.current) {
      clearInterval(feedbackPollRef.current);
      feedbackPollRef.current = null;
    }
  };

  //Polls GET /api/session/feedback every 3s until ready, error, or unavailable (max 2 min)
  const startFeedbackPolling = () => {
    stopFeedbackPoll();
    let polls = 0;
    feedbackPollRef.current = setInterval(async () => {
      polls++;
      try {
        const res  = await fetch(`${DMB_URL}/api/session/feedback`);
        const data = await res.json();
        if (data.status === 'ready') {
          stopFeedbackPoll();
          setFeedbackText(data.text);
          setFeedbackStatus('ready');
        } else if (data.status === 'error' || data.status === 'unavailable' || polls >= 40) {
          stopFeedbackPoll();
          setFeedbackStatus(data.status === 'unavailable' ? 'unavailable' : 'error');
        }
        // 'generating': keep polling
      } catch {
        stopFeedbackPoll();
        setFeedbackStatus('unavailable');
      }
    }, 3000);
  };

  const handleToggleSession = async () => {
    if (!isSessionActive) {
      //Starting session: reset accumulator, record start time
      accumulatedMsRef.current = 0;
      lastResumeAtRef.current = Date.now();
      const startTime = toMySQLDateTime();
      setSessionStart(startTime);
      setSessionEnd('');

      //Pre-create the session in DB so dmb.py has a real sessionId for chunk tagging
      try {
        const startRes = await fetch(`${API_URL}/session/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.userId, sessionStart: startTime }),
        });
        const startData = await startRes.json();
        sessionIdRef.current = startData.sessionId ?? null;
      } catch (err) {
        console.error('Failed to pre-create session:', err);
        sessionIdRef.current = null;
      }

      //Tell dmb.py to open camera and begin tracking (best-effort — works even if offline)
      fetch(`${DMB_URL}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.userId, sessionId: sessionIdRef.current }),
      }).catch(() => console.warn('[dmb.py] unreachable on start'));

      onToggleSession();
    } else {
      //Stopping session: finalize active duration, capture end time, show save prompt
      if (!isPaused) {
        accumulatedMsRef.current += Date.now() - lastResumeAtRef.current;
      }
      pendingActiveDurationRef.current = Math.round(accumulatedMsRef.current / 1000);
      const endTime = toMySQLDateTime();
      setSessionEnd(endTime);
      setPendingEndTime(endTime);

      //Signal dmb.py to flush the final chunk and release the camera
      fetch(`${DMB_URL}/api/session/end`, { method: 'POST' })
        .catch(() => console.warn('[dmb.py] unreachable on end'));

      onToggleSession();
      setSaveModal('confirm');
    }
  };

  const handlePauseResume = () => {
    if (!isPaused) {
      //Pausing: accumulate elapsed active time since last resume
      accumulatedMsRef.current += Date.now() - lastResumeAtRef.current;
    } else {
      //Resuming: reset the resume anchor
      lastResumeAtRef.current = Date.now();
    }
    //Toggle dmb.py pause/resume (best-effort)
    fetch(`${DMB_URL}/api/session/pause`, { method: 'POST' })
      .catch(() => console.warn('[dmb.py] unreachable on pause'));
    onPauseSession();
  };

  //Modal 1: user chose No = discard session (generation not yet started)
  const handleSaveNo = () => {
    setSaveModal(null);
    //Delete the pre-created session so it doesn't linger in the DB
    if (sessionIdRef.current) {
      fetch(`${API_URL}/sessions/${sessionIdRef.current}`, { method: 'DELETE' })
        .catch(() => {});
      sessionIdRef.current = null;
    }
  };

  //Modal 1: user chose Yes = open details form
  const handleSaveYes = () => {
    const name = toDefaultSessionName();
    setDefaultName(name);
    setSessionName('');
    setSessionDescription('');
    setSaveModal('details');
  };

  //Modal 2: user cancelled = discard session (no generation to cancel yet)
  const handleDetailsCancel = () => {
    stopFeedbackPoll();
    setFeedbackText(null);
    setFeedbackStatus('idle');
    setSaveModal(null);
    //Delete the pre-created session so it doesn't linger in the DB
    if (sessionIdRef.current) {
      fetch(`${API_URL}/sessions/${sessionIdRef.current}`, { method: 'DELETE' })
        .catch(() => {});
      sessionIdRef.current = null;
    }
  };

  //Modal 2: user confirmed = capture name/description, kick off generation, advance to feedback modal
  const handleDetailsConfirm = () => {
    if (isSaving) return;
    pendingNameRef.current = sessionName.trim() || defaultName;
    pendingDescRef.current = sessionDescription.trim() || 'No Description';
    setFeedbackStatus('generating');
    fetch(`${DMB_URL}/api/session/feedback/generate`, { method: 'POST' }).catch(() => {});
    startFeedbackPolling();
    setSaveModal('feedback');
  };

  //Modal 3: user clicked "Got it" = save session with feedback to DB
  const handleFeedbackGotIt = async () => {
    if (isSaving) return;
    setIsSaving(true);
    stopFeedbackPoll();

    console.log('sessionId:', sessionIdRef.current);
    console.log('sessionName:', pendingNameRef.current);
    console.log('sessionDescription:', pendingDescRef.current);
    console.log('feedbackStatus:', feedbackStatus);

    try {
      const res = await fetch(`${API_URL}/sessions/${sessionIdRef.current}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionEnd:         pendingEndTime,
          sessionName:        pendingNameRef.current,
          sessionDescription: pendingDescRef.current,
          activeDuration:     pendingActiveDurationRef.current,
          sessionFeedback:    feedbackText ?? null,
        }),
      });
      const data = await res.json();
      console.log('Server response:', data);

      //Notify Home.tsx to refresh snapshots after successful save
      if (data.success) {
        console.log('RightSidebar: session saved, notifying Home');
        notifySessionSaved();
      }
    } catch (err) {
      console.error('Failed to save session:', err);
    }

    sessionIdRef.current = null;
    setIsSaving(false);
    setSaveModal(null);
    setFeedbackText(null);
    setFeedbackStatus('idle');
  };

  return (
    <>
      <aside className={`right-sidebar${isCollapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-header">
          <button
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            <span className={`collapse-chevron${isCollapsed ? ' flipped' : ''}`} />
          </button>
        </div>
        <div className="sidebar-content">
          {/* Feed visibility toggle */}
          <button
            className="feed-toggle-btn"
            onClick={() => setShowFeed(v => !v)}
            title={showFeed ? 'Hide camera feed' : 'Show camera feed'}
          >
            {showFeed ? 'Hide Feed' : 'Show Feed'}
          </button>

          {/* Camera feed — only rendered when showFeed is true */}
          {showFeed && (
            <div className="webcam-container">
              <WebcamFeed isActive={isSessionActive} isPaused={isPaused} />
            </div>
          )}

          {isSessionActive ? (
            <div className="session-button-row">
              <button
                className={`session-button ${isPaused ? 'resume' : 'pause'}`}
                onClick={handlePauseResume}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button className="session-button stop" onClick={handleToggleSession}>
                Stop
              </button>
            </div>
          ) : (
            <button
              className={`session-button start${highlightSession ? ' highlight-pulse' : ''}`}
              onClick={handleToggleSession}
              onAnimationEnd={() => { if (highlightSession) clearHighlightSession(); }}
            >
              Start Session
            </button>
          )}
          <div className="session-info-box">
            <span className="session-info-label">Session Start Time</span>
            <span className="session-info-value">{sessionStart || '—'}</span>
          </div>
          <div className="session-info-box">
            <span className="session-info-label">Session End Time</span>
            <span className="session-info-value">{sessionEnd || '—'}</span>
          </div>
        </div>
      </aside>

      {/* Modal 1: Save session confirmation */}
      {saveModal === 'confirm' && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="modal-title">Save this session?</h3>
            <p className="modal-subtitle">Would you like to save this session to your history?</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={handleSaveNo}>No</button>
              <button className="modal-save" onClick={handleSaveYes}>Yes</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Session name and description */}
      {saveModal === 'details' && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="modal-title">Session Details</h3>
            <p className="modal-subtitle">Give your session a name and description.</p>
            <input
              className="modal-input"
              type="text"
              placeholder={defaultName}
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
            />
            <textarea
              className="modal-input modal-textarea"
              placeholder="No Description"
              value={sessionDescription}
              onChange={e => setSessionDescription(e.target.value)}
              rows={3}
            />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={handleDetailsCancel}>Cancel</button>
              <button className="modal-save" onClick={handleDetailsConfirm} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: AI Focus Feedback */}
      {saveModal === 'feedback' && (
        <div className="modal-overlay">
          <div className="modal-box modal-box-feedback">
            <h3 className="modal-title">AI Focus Feedback</h3>

            {feedbackStatus === 'generating' && (
              <div className="feedback-loading-row">
                <span className="feedback-spinner" />
                <p className="modal-subtitle">Analyzing your session with research-backed insights</p>
              </div>
            )}

            {feedbackStatus === 'ready' && feedbackText && (
              <div className="feedback-content">
                {feedbackText.split('\n').map((line, i) => {
                  const isHeader = line.startsWith('**') && line.endsWith('**');
                  return line.trim() ? (
                    <p key={i} className={isHeader ? 'feedback-section-header' : 'feedback-body'}>
                      {isHeader ? line.replace(/\*\*/g, '') : line}
                    </p>
                  ) : null;
                })}
              </div>
            )}

            {(feedbackStatus === 'error' || feedbackStatus === 'unavailable') && (
              <p className="modal-subtitle feedback-unavailable">
                {feedbackStatus === 'unavailable'
                  ? 'AI feedback is not configured (no GROQ_API_KEY). Your session will still be saved.'
                  : 'Could not generate feedback right now. Your session will still be saved.'}
              </p>
            )}

            <div className="modal-actions">
              <button
                className="modal-save"
                onClick={handleFeedbackGotIt}
                disabled={isSaving || feedbackStatus === 'generating'}
              >
                {feedbackStatus === 'generating'
                  ? 'Please wait'
                  : isSaving
                  ? 'Saving'
                  : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RightSidebar;
