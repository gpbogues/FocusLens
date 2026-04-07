import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Home.css';

interface Session {
  sessionStart: string;
  sessionEnd: string;
}

//Calculates total session time from start and end strings
const calcTotalDuration = (start: string, end: string): string => {
  const toSeconds = (str: string) => {
    const [datePart, timePart] = str.split('T');             
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = timePart.split('.')[0].split(':').map(Number);  
    return new Date(year, month - 1, day, hours, minutes, seconds).getTime() / 1000;
  };

  //diff is just total time but in seconds, needed to get hours and minutes
  const diff = Math.floor(toSeconds(end) - toSeconds(start));
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

//Formats datetime (how its stored within mysql) into separate date and time display values
const formatDateTime = (dateStr: string) => {
  const [datePart, timePart] = dateStr.split('T');          
  const [year, month, day] = datePart.split('-');
  const [hours, minutes, seconds] = timePart.split('.')[0].split(':');  

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;

  return {
    date: `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`,
    time: `${String(h12).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`,
  };
};

const Home = () => {
  const { user, sessionTrigger } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const API_URL = import.meta.env.VITE_API_URL;

  //Fetches 3 most recent sessions when user is logged in
  useEffect(() => {
    if (!user) return;
    console.log('Home: fetching sessions, sessionTrigger:', sessionTrigger);
    const fetchSessions = async () => {
      try {
        const res = await fetch(`${API_URL}/sessions/${user.userId}`);
        const data = await res.json();
        console.log('Home: sessions fetched:', data);
        if (data.success) {
          setSessions(data.sessions);
        }
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
      }
    };
    fetchSessions();
  }, [user, sessionTrigger]);

  return (
    <div className="home-page">
      <h2 className="page-heading">Session Snapshots</h2>
      {/* Only render snapshots if user is logged in */}
      {user && (
        <div className="snapshots-container">
          {/* Ternary operation where available sessions are checked to see if any exist */}
          {sessions.length === 0 ? (
            <p className="no-sessions">No sessions recorded yet.</p>
          ) : (
            sessions.map((session, animationKey) => {
            const start = formatDateTime(session.sessionStart);
            const end = formatDateTime(session.sessionEnd);
            const duration = calcTotalDuration(session.sessionStart, session.sessionEnd);
            return (
              <div className="snapshot-card" key={`${animationKey}-${session.sessionStart}`}>
                  <div className="snapshot-row">
                    <span className="snapshot-label">Date</span>
                    <span className="snapshot-value">{start.date}</span>
                  </div>
                  <div className="snapshot-row">
                    <span className="snapshot-label">Start Time</span>
                    <span className="snapshot-value">{start.time}</span>
                  </div>
                  <div className="snapshot-row">
                    <span className="snapshot-label">End Time</span>
                    <span className="snapshot-value">{end.time}</span>
                  </div>
                  <div className="snapshot-divider" />
                  <div className="snapshot-row">
                    <span className="snapshot-label">Duration</span>
                    <span className="snapshot-value snapshot-duration">{duration}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default Home;