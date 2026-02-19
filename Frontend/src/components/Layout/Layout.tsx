import { Outlet } from 'react-router-dom';
import TopBar from '../TopBar/TopBar';
import RightSidebar from '../RightSidebar/RightSidebar';
import './Layout.css';

interface LayoutProps {
  isSessionActive: boolean;
  onToggleSession: () => void;
}

const Layout = ({ isSessionActive, onToggleSession }: LayoutProps) => {
  return (
    <div className="layout-container">
      <TopBar />
      <div className="layout-body">
        <main className="main-content">
          <Outlet />
        </main>
        <RightSidebar
          isSessionActive={isSessionActive}
          onToggleSession={onToggleSession}
        />
      </div>
    </div>
  );
};

export default Layout;
