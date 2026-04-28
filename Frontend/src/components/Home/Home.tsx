import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { getGreeting } from '../../utils/greeting';
import AgentPrompt from './AgentPrompt';
import Preloader from '../Preloader/Preloader';
import './Home.css';

interface Session {
  sessionStart: string;
  sessionEnd: string;
  activeDuration?: number;
}

const calcTotalDuration = (start: string, end: string | null | undefined, activeDuration?: number): string => {
  if (!end) return 'In progress';

  let totalSecs: number;
  if ((activeDuration ?? 0) > 0) {
    totalSecs = activeDuration!;
  } else {
    const toSeconds = (str: string) => {
      const normalized = str.replace(' ', 'T');
      const [datePart, timePart] = normalized.split('T');
      if (!timePart) return 0;
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes, seconds] = timePart.split('.')[0].split(':').map(Number);
      return new Date(year, month - 1, day, hours, minutes, seconds).getTime() / 1000;
    };
    totalSecs = Math.floor(toSeconds(end) - toSeconds(start));
  }

  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const formatDateTime = (dateStr: string | null | undefined) => {
  if (!dateStr) return { date: '—', time: '—' };
  const normalized = dateStr.replace(' ', 'T');
  const [datePart, timePart] = normalized.split('T');
  if (!timePart) return { date: datePart, time: '—' };
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

const DRAWER_HEIGHT = 380;
const HANDLE_HEIGHT = 48;

const Home = () => {
  const { user, sessionTrigger, openSnapshot, clearOpenSnapshot } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; wasOpen: boolean } | null>(null);
  const API_URL = import.meta.env.VITE_API_URL;

  const [fromLogin] = useState(() => {
    const flag = sessionStorage.getItem('fromLogin') === '1';
    if (flag) sessionStorage.removeItem('fromLogin');
    return flag;
  });
  const [preloaderActive, setPreloaderActive] = useState(fromLogin);
  const [bgVisible, setBgVisible] = useState(fromLogin);
  const [greetingReady, setGreetingReady] = useState(!fromLogin);

  useEffect(() => {
    if (!openSnapshot) return;
    setDrawerOpen(true);
    clearOpenSnapshot();
  }, [openSnapshot, clearOpenSnapshot]);

  useEffect(() => {
    if (!user) return;
    console.log('Home: fetching sessions, sessionTrigger:', sessionTrigger);
    const fetchSessions = async () => {
      try {
        const res = await fetch(`${API_URL}/sessions/${user.userId}`, { credentials: 'include' });
        const data = await res.json();
        console.log('Home: sessions fetched:', data);
        if (data.success) {
          setSessions(data.sessions);
          setAnimKey(k => k + 1);
        }
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
      }
    };
    fetchSessions();
  }, [user, sessionTrigger]);

  useEffect(() => {
    if (!fromLogin) return;
    let flipTimer: ReturnType<typeof setTimeout>;
    const holdTimer = setTimeout(() => {
      setBgVisible(false);
      setPreloaderActive(false);
      flipTimer = setTimeout(() => setGreetingReady(true), 80);
    }, 1800);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(flipTimer);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { startY: e.clientY, wasOpen: drawerOpen };
    drawerRef.current?.classList.add('dragging');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const delta = e.clientY - dragState.current.startY;
    const maxDown = dragState.current.wasOpen ? DRAWER_HEIGHT - HANDLE_HEIGHT : 0;
    const maxUp = dragState.current.wasOpen ? 0 : -(DRAWER_HEIGHT - HANDLE_HEIGHT);
    setDragOffset(Math.max(maxUp, Math.min(maxDown, delta)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const delta = e.clientY - dragState.current.startY;
    drawerRef.current?.classList.remove('dragging');
    if (Math.abs(delta) < 8) {
      setDrawerOpen(o => {
        if (!o) setAnimKey(k => k + 1);
        return !o;
      });
    } else {
      const next = delta < -40 ? true : delta > 40 ? false : dragState.current.wasOpen;
      if (next && !dragState.current.wasOpen) setAnimKey(k => k + 1);
      setDrawerOpen(next);
    }
    setDragOffset(0);
    dragState.current = null;
  };

  return (
    <>
    <div className="home-page">
      <div className="home-main-content">
        <AgentPrompt greetingReady={greetingReady} />
      </div>

      {user && (
        <div
          className={`session-drawer${drawerOpen ? ' open' : ''}`}
          ref={drawerRef}
          style={{ '--drag-offset': `${dragOffset}px` } as React.CSSProperties}
        >
          <div
            className="drawer-handle-bar"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div className="drawer-pill" />
            <span className="drawer-tab-label">Session Snapshots</span>
          </div>

          <div className="drawer-content">
            {sessions.length === 0 ? (
              <p className="no-sessions">No sessions recorded yet.</p>
            ) : (
              <div className="sessions-grid" key={animKey}>
                {sessions.map((session, animationKey) => {
                  const start = formatDateTime(session.sessionStart);
                  const end = formatDateTime(session.sessionEnd);
                  const duration = calcTotalDuration(session.sessionStart, session.sessionEnd, session.activeDuration);
                  return (
                    <div
                      className="snapshot-card"
                      key={`${animationKey}-${session.sessionStart}`}
                      style={{ animationDelay: `${animationKey * 60}ms` }}
                    >
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
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>

    <AnimatePresence>
      {bgVisible && (
        <motion.div
          className="preloader-bg-overlay"
          initial={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
        />
      )}
    </AnimatePresence>

    {preloaderActive && (
      <Preloader greetingText={getGreeting(user?.username)} />
    )}
    </>
  );
};

export default Home;
