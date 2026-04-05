import { Outlet, useLocation } from 'react-router-dom';
import TopBar from '../TopBar/TopBar';
import RightSidebar from '../RightSidebar/RightSidebar';
import './Layout.css';

interface LayoutProps {
  isSessionActive: boolean;
  onToggleSession: () => void;
}

const Layout = ({ isSessionActive, onToggleSession }: LayoutProps) => {
  const location = useLocation();

  return (
    //Key forces remount and replays animation on every navigation
    <div className="layout-container" key={location.pathname}>
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