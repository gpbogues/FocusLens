import './Sidebar.css';

interface SidebarProps {
  isSessionActive: boolean;
  onToggleSession: () => void;
}

const Sidebar = ({ isSessionActive, onToggleSession }: SidebarProps) => {
  return (
    <div className="sidebar">
      <button
        className={`session-button ${isSessionActive ? 'stop' : 'start'}`}
        onClick={onToggleSession}
      >
        {isSessionActive ? 'Stop Session' : 'Start Session'}
      </button>
    </div>
  );
};

export default Sidebar;
