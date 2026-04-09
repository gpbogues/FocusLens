import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSidebarMouseEnter: () => void;
  onSidebarMouseLeave: () => void;
}

//Added for navigating between login/logout states
const Sidebar = ({ isOpen, onClose, onSidebarMouseEnter, onSidebarMouseLeave }: SidebarProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout(); //clears state immediately, fires /logout in background
    onClose();
    //Scale out the layout before changing to login
    const el = document.querySelector('.layout-container') as HTMLElement | null;
    if (el) {
      el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      el.style.opacity = '0';
      el.style.transform = 'scale(0.92)';
    }
    //Wait for animation to finish before switching forms
    setTimeout(() => {
      if (el) {
        el.style.opacity = '';
        el.style.transform = '';
      }
      navigate('/login');
    }, 400);
  };

  return (
    <>
      <div
        className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
        onMouseEnter={onSidebarMouseEnter}
        onMouseLeave={onSidebarMouseLeave}
      >
        <nav className="sidebar-nav">
          <div className="sidebar-top">
            <Link to="/profile" className="sidebar-item" onClick={onClose}>
              Profile
            </Link>
            <Link to="/sessions" className="sidebar-item" onClick={onClose}>
              Sessions
            </Link>
            <Link to="/metrics" className="sidebar-item" onClick={onClose}>
              Metrics
            </Link>
          </div>
          <div className="sidebar-bottom">
            {/* Only show Log Out button when user is logged in
                Note: since login form is presented at the start,
                no need for login/register buttons, as users will never
                see them anyways */}
            {user && (
              <button className="sidebar-btn sidebar-btn-signin" onClick={handleLogout}>
                Sign Out
              </button>
            )}
          </div>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;