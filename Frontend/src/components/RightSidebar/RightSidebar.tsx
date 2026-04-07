import { useState } from 'react';
import WebcamFeed from '../WebcamFeed/WebcamFeed';
import { useAuth } from '../../context/AuthContext';
import './RightSidebar.css';

interface RightSidebarProps {
  isSessionActive: boolean;
  onToggleSession: () => void;
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

const PYTHON_URL = 'http://localhost:5000';

const RightSidebar = ({ isSessionActive, onToggleSession }: RightSidebarProps) => {
  const { user, notifySessionSaved } = useAuth();
  const [sessionStart, setSessionStart] = useState<string>('');
  const [sessionEnd, setSessionEnd] = useState<string>('');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const API_URL = import.meta.env.VITE_API_URL;

  const handleToggleSession = async () => {
    if (!isSessionActive) {
      //Starting session: create session in RDS, get sessionId, tell dmb.py
      const startTime = toMySQLDateTime();
      setSessionStart(startTime);
      setSessionEnd('');

      try {
        const res = await fetch(`${API_URL}/session/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.userId, sessionStart: startTime }),
        });
        const data = await res.json();
        console.log('Session started:', data);

        if (data.success) {
          setSessionId(data.sessionId);
          //Tell dmb.py which user/session is now active
          await fetch(`${PYTHON_URL}/api/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user?.userId, sessionId: data.sessionId }),
          });
        }
      } catch (err) {
        console.error('Failed to start session:', err);
      }
    } else {
      //Ending session: flush dmb.py buffer, then finalize in RDS
      const endTime = toMySQLDateTime();
      setSessionEnd(endTime);

      console.log('userId:', user?.userId);
      console.log('sessionStart:', sessionStart);
      console.log('sessionEnd:', endTime);

      try {
        //Tell dmb.py to flush any partial chunk data (handles < 5 min sessions)
        await fetch(`${PYTHON_URL}/api/session/end`, { method: 'POST' });

        //Finalize session in RDS (sets sessionEnd + computes avgFocus from chunks)
        const res = await fetch(`${API_URL}/session/${sessionId}/end`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionEnd: endTime }),
        });
        const data = await res.json();
        console.log('Session ended:', data);

        //Notify Home.tsx to refresh snapshots after successful save
        if (data.success) {
          console.log('RightSidebar: session saved, notifying Home');
          notifySessionSaved();
        }
      } catch (err) {
        console.error('Failed to end session:', err);
      }

      setSessionId(null);
    }
    onToggleSession();
  };

  return (
    <aside className="right-sidebar">
      <div className="webcam-container">
        <WebcamFeed isActive={isSessionActive} />
      </div>
      <button
        className={`session-button ${isSessionActive ? 'stop' : 'start'}`}
        onClick={handleToggleSession}
      >
        {isSessionActive ? 'Stop Session' : 'Start Session'}
      </button>
      <div className="session-info-box">
        <span className="session-info-label">Session Start Time</span>
        <span className="session-info-value">{sessionStart || '—'}</span>
      </div>
      <div className="session-info-box">
        <span className="session-info-label">Session End Time</span>
        <span className="session-info-value">{sessionEnd || '—'}</span>
      </div>
    </aside>
  );
};

export default RightSidebar;