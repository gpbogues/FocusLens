import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

//Added for navigating between login/logout states 
const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
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
            {/* Ternary operation of checking if user is logged in */}
            {user ? (
              //User logged in, only show log out button
              <button className="sidebar-btn sidebar-btn-signin" onClick={handleLogout}>
                Log Out
              </button>
            ) : (
              //User not logged in, show sign in AND sign up buttons
              <>
                <Link to="/login" className="sidebar-btn sidebar-btn-signin" onClick={onClose}>
                  Sign In
                </Link>
                {/* Changed so that sign up will bring up registration form instead of login */}
                <Link to="/login" state={{ stage: 'register' }} className="sidebar-btn sidebar-btn-signup" onClick={onClose}>
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;