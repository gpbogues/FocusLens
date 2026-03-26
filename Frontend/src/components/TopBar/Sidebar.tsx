import { Link } from 'react-router-dom';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      <div className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <nav className="sidebar-nav">
          <div className="sidebar-top">
            <Link to="/profile" className="sidebar-item" onClick={onClose}>
              Profile
            </Link>
            <Link to="/metrics" className="sidebar-item" onClick={onClose}>
              Metrics
            </Link>
          </div>
          <div className="sidebar-bottom">
            <Link to="/login" className="sidebar-btn sidebar-btn-signin" onClick={onClose}>
              Sign In
            </Link>
            <Link to="/login" className="sidebar-btn sidebar-btn-signup" onClick={onClose}>
              Sign Up
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
