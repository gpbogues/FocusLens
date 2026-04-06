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
  const fromLogin = location.state?.fromLogin === true;

  return (
    //Ternary to ensure animation occurs on login only 
    <div className={`layout-container ${fromLogin ? 'animate-in' : ''}`}>
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