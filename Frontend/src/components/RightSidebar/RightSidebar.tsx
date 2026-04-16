import { useState, useRef, useEffect } from 'react';
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
const DMB_URL = 'http://localhost:5000';

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

const RightSidebar = ({ isSessionActive, onToggleSession, isPaused, onPauseSession, isCollapsed, onToggleCollapse }: RightSidebarProps) => {
  const { user, notifySessionSaved, highlightSession, clearHighlightSession } = useAuth();
  const [sessionStart, setSessionStart] = useState<string>('');
  const [sessionEnd, setSessionEnd] = useState<string>('');
  const [saveModal, setSaveModal] = useState<'confirm' | 'details' | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  //Holds the captured end time and default name while modal is open
  const [pendingEndTime, setPendingEndTime] = useState<string>('');
  const [defaultName, setDefaultName] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL;

  //Date.now() accumulator for active time tracking
  const accumulatedMsRef = useRef<number>(0);
  const lastResumeAtRef = useRef<number>(0);
  //Ref to capture activeDuration at stop time, used in the save modal
  const pendingActiveDurationRef = useRef<number>(0);
  //Pre-created session ID — assigned on Start, used for chunks and finalization
  const sessionIdRef = useRef<number | null>(null);

  //Tracker online/offline status (polls dmb.py every 5s)
  const [trackerOnline, setTrackerOnline] = useState(false);
  //Show/hide camera feed — toggle is purely cosmetic, tracking always runs when session is active
  const [showFeed, setShowFeed] = useState(true);

  //Poll dmb.py status endpoint to detect if the local tracker is running
  useEffect(() => {
    const check = () =>
      fetch(`${DMB_URL}/api/status`, { signal: AbortSignal.timeout(2000) })
        .then(() => setTrackerOnline(true))
        .catch(() => setTrackerOnline(false));
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

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

  //Modal 1: user chose No = discard session
  const handleSaveNo = () => {
    setSaveModal(null);
    //Delete the pre-created session so it doesn't linger in the DB
    if (sessionIdRef.current) {
      fetch(`${API_URL}/sessions/${sessionIdRef.current}`, { method: 'DELETE' })
        .catch(() => {});
      sessionIdRef.current = null;
    }
  };

  //Modal 1: user chose Yes = open details form with defaults pre-filled
  const handleSaveYes = () => {
    const name = toDefaultSessionName();
    setDefaultName(name);
    setSessionName('');
    setSessionDescription('');
    setSaveModal('details');
  };

  //Modal 2: user cancelled = discard session
  const handleDetailsCancel = () => {
    setSaveModal(null);
    //Delete the pre-created session so it doesn't linger in the DB
    if (sessionIdRef.current) {
      fetch(`${API_URL}/sessions/${sessionIdRef.current}`, { method: 'DELETE' })
        .catch(() => {});
      sessionIdRef.current = null;
    }
  };

  //Modal 2: user confirmed = PATCH session with final data
  const handleDetailsConfirm = async () => {
    if (isSaving) return;
    setIsSaving(true);

    const name = sessionName.trim() || defaultName;
    const description = sessionDescription.trim() || 'No Description';

    console.log('sessionId:', sessionIdRef.current);
    console.log('userId:', user?.userId);
    console.log('sessionStart:', sessionStart);
    console.log('sessionEnd:', pendingEndTime);
    console.log('sessionName:', name);
    console.log('sessionDescription:', description);

    try {
      const res = await fetch(`${API_URL}/sessions/${sessionIdRef.current}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionEnd: pendingEndTime,
          sessionName: name,
          sessionDescription: description,
          activeDuration: pendingActiveDurationRef.current,
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
          {/* Tracker status indicator + feed visibility toggle */}
          <div className="tracker-status">
            <div className="tracker-status-left">
              <span className={`tracker-dot ${trackerOnline ? 'online' : 'offline'}`} />
              <span className="tracker-label">Tracker {trackerOnline ? 'Online' : 'Offline'}</span>
            </div>
            <button
              className="feed-toggle-btn"
              onClick={() => setShowFeed(v => !v)}
              title={showFeed ? 'Hide camera feed' : 'Show camera feed'}
            >
              {showFeed ? 'Hide Feed' : 'Show Feed'}
            </button>
          </div>

          {/* Camera feed — only rendered when showFeed is true */}
          {showFeed && (
            <div className="webcam-container">
              <WebcamFeed isActive={isSessionActive} />
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
    </>
  );
};

export default RightSidebar;
