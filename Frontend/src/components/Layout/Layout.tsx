import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from '../TopBar/TopBar';
import RightSidebar from '../RightSidebar/RightSidebar';
import './Layout.css';

interface LayoutProps {
  isSessionActive: boolean;
  onToggleSession: () => void;
}

const Layout = ({ isSessionActive, onToggleSession }: LayoutProps) => {
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  return (
    <div className="layout-container">
      <TopBar isSessionActive={isSessionActive} />
      <div className="layout-body">
        <main className="main-content">
          <Outlet />
        </main>
        <RightSidebar
          isSessionActive={isSessionActive}
          onToggleSession={onToggleSession}
          isCollapsed={isRightCollapsed}
          onToggleCollapse={() => setIsRightCollapsed(prev => !prev)}
        />
      </div>
    </div>
  );
};

export default Layout;