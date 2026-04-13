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

  const handleToggleSession = async () => {
    if (!isSessionActive) {
      //Starting session: reset accumulator, record start time
      accumulatedMsRef.current = 0;
      lastResumeAtRef.current = Date.now();
      const startTime = toMySQLDateTime();
      setSessionStart(startTime);
      setSessionEnd('');
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
    onPauseSession();
  };

  //Modal 1: user chose No = discard session
  const handleSaveNo = () => {
    setSaveModal(null);
    console.log('RightSidebar: user chose not to save session, session discarded');
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
    console.log('RightSidebar: user cancelled save, session discarded');
  };

  //Modal 2: user confirmed = POST session to backend
  const handleDetailsConfirm = async () => {
    if (isSaving) return;
    setIsSaving(true);

    const name = sessionName.trim() || defaultName;
    const description = sessionDescription.trim() || 'No Description';

    console.log('userId:', user?.userId);
    console.log('sessionStart:', sessionStart);
    console.log('sessionEnd:', pendingEndTime);
    console.log('sessionName:', name);
    console.log('sessionDescription:', description);

    try {
      const res = await fetch(`${API_URL}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.userId,
          sessionStart,
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
          <div className="webcam-container">
            <WebcamFeed isActive={isSessionActive} />
          </div>
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
