import WebcamFeed from '../WebcamFeed/WebcamFeed';
import './RightSidebar.css';

interface RightSidebarProps {
  isSessionActive: boolean;
  onToggleSession: () => void;
}

const RightSidebar = ({ isSessionActive, onToggleSession }: RightSidebarProps) => {
  return (
    <aside className="right-sidebar">
      <div className="webcam-container">
        <WebcamFeed isActive={isSessionActive} />
      </div>
      <button
        className={`session-button ${isSessionActive ? 'stop' : 'start'}`}
        onClick={onToggleSession}
      >
        {isSessionActive ? 'Stop Session' : 'Start Session'}
      </button>
    </aside>
  );
};

export default RightSidebar;
