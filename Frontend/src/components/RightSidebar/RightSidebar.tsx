import { useState } from 'react';
import WebcamFeed from '../WebcamFeed/WebcamFeed';
import { useAuth } from '../../context/AuthContext';
import './RightSidebar.css';

interface RightSidebarProps {
  isSessionActive: boolean;
  onToggleSession: () => void;
}

//Format stored time to fit with sql timedate format 
const toMySQLDateTime = (isoString: string) =>
  isoString.slice(0, 19).replace('T', ' ');

const RightSidebar = ({ isSessionActive, onToggleSession }: RightSidebarProps) => {
  const { user } = useAuth();
  const [sessionStart, setSessionStart] = useState<string>('');
  const [sessionEnd, setSessionEnd] = useState<string>('');

  const handleToggleSession = async () => {
    if (!isSessionActive) {
      //Starting session
      const startTime = toMySQLDateTime(new Date().toISOString());
      setSessionStart(startTime);
      setSessionEnd('');
    } else {
      //Ending session, and afterwards, post info to backend session API 
      const endTime = toMySQLDateTime(new Date().toISOString());
      setSessionEnd(endTime);

      try {
        await fetch('http://100.27.212.225:5000/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.userId,
            sessionStart,
            sessionEnd: endTime,
          }),
        });
      } catch (err) {
        console.error('Failed to save session:', err);
      }
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