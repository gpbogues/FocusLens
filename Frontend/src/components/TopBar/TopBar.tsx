import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import './TopBar.css';

interface TopBarProps {
  isSessionActive?: boolean;
  isPaused?: boolean;
}

const TopBar = ({ isSessionActive, isPaused }: TopBarProps) => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTitleClick = () => navigate('/');
  const closeSidebar = () => setIsSidebarOpen(false);

  const openSidebar = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setIsSidebarOpen(true);
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setIsSidebarOpen(false), 150);
  };

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  return (
    <>
      <header className="top-bar">
        <div className="top-bar-left">
          <button
            className="menu-trigger"
            onMouseEnter={openSidebar}
            onMouseLeave={scheduleClose}
          >
            ☰
          </button>
          <button className="home-btn" onClick={handleTitleClick} title="Home">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
              <polyline points="9 21 9 12 15 12 15 21"/>
            </svg>
          </button>
        </div>
        <h1 className="top-bar-title" onClick={handleTitleClick}>
          FocusLens
        </h1>
        <div className="top-bar-right">
          {isSessionActive && (
            <div className={`session-indicator${isPaused ? ' paused' : ''}`}>
              <span className="session-indicator-dot" />
              <span className="session-indicator-label">{isPaused ? 'Session Paused' : 'Session Active'}</span>
            </div>
          )}
        </div>
      </header>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        onSidebarMouseEnter={cancelClose}
        onSidebarMouseLeave={scheduleClose}
      />
    </>
  );
};

export default TopBar;
