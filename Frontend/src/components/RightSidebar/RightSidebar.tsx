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

const RightSidebar = ({ isSessionActive, onToggleSession }: RightSidebarProps) => {
  const { user } = useAuth();
  const [sessionStart, setSessionStart] = useState<string>('');
  const [sessionEnd, setSessionEnd] = useState<string>('');

  const API_URL = import.meta.env.VITE_API_URL;    

  const handleToggleSession = async () => {
    if (!isSessionActive) {
      //Starting session
      const startTime = toMySQLDateTime();
      setSessionStart(startTime);
      setSessionEnd('');
    } else {
      //Ending session, and afterwards, post info to backend session API 
      const endTime = toMySQLDateTime();
      setSessionEnd(endTime);

      //f12 console logging 
      console.log('userId:', user?.userId);
      console.log('sessionStart:', sessionStart);
      console.log('sessionEnd:', endTime);

      try {
        //post data to backend API for storage 
        const res =await fetch(`${API_URL}/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.userId,
            sessionStart,
            sessionEnd: endTime,
          }),
        });
        const data = await res.json();
        console.log('Server response:', data);
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