import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from '../TopBar/TopBar';
import RightSidebar from '../RightSidebar/RightSidebar';
import './Layout.css';

interface LayoutProps {
  isSessionActive: boolean;
  onToggleSession: () => void;
  isPaused: boolean;
  onPauseSession: () => void;
}

const Layout = ({ isSessionActive, onToggleSession, isPaused, onPauseSession }: LayoutProps) => {
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  return (
    <div className="layout-container">
      <TopBar isSessionActive={isSessionActive} isPaused={isPaused} />
      <div className="layout-body">
        <main className="main-content">
          <Outlet />
        </main>
        <RightSidebar
          isSessionActive={isSessionActive}
          onToggleSession={onToggleSession}
          isPaused={isPaused}
          onPauseSession={onPauseSession}
          isCollapsed={isRightCollapsed}
          onToggleCollapse={() => setIsRightCollapsed(prev => !prev)}
        />
      </div>
    </div>
  );
};

export default Layout;