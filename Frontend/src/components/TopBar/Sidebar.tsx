import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

//Added for navigating between login/logout states 
const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  //Light/dark mode toggle, defaults to dark
  //Reads from localStorage for user preference
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    return stored ? stored === 'dark' : true;
  });

  //Apply theme on login and on change, saves preference to localStorage
  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);  //saves preference
  }, [isDark]);

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
            {/* Light/dark mode toggle */}
            <div className="theme-toggle">
              <span>{isDark ? 'Dark mode' : 'Light mode'}</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={!isDark}
                  onChange={() => setIsDark(prev => !prev)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

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