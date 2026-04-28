import { useRef, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useMotionValueEvent,
  type AnimationPlaybackControls,
} from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSidebarMouseEnter: () => void;
  onSidebarMouseLeave: () => void;
}

const SIDEBAR_W = 260;
const OPEN_DUR  = 0.75;
const CLOSE_DUR = 0.75;
const EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];
const NAV_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];

const Sidebar = ({ isOpen, onClose, onSidebarMouseEnter, onSidebarMouseLeave }: SidebarProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  //Track sidebar height so the SVG fills it correctly
  const [height, setHeight] = useState(window.innerHeight - 60);
  useEffect(() => {
    const handleResize = () => setHeight(window.innerHeight - 60);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const edgeX = useMotionValue(0);
  const ctrlX = useMotionValue(0);

  const panelX = useTransform(edgeX, (e) => e - SIDEBAR_W);

  const d = useTransform(
    [edgeX, ctrlX],
    ([e, c]: number[]) =>
      `M0 0 L${e} 0 Q${c} ${height / 2} ${e} ${height} L0 ${height} Z`,
  );

  const edgeAnim  = useRef<AnimationPlaybackControls | null>(null);
  const ctrlAnim1 = useRef<AnimationPlaybackControls | null>(null);
  const ctrlAnim2 = useRef<AnimationPlaybackControls | null>(null);

  const stopAll = () => {
    edgeAnim.current?.stop();
    ctrlAnim1.current?.stop();
    ctrlAnim2.current?.stop();
  };

  useEffect(() => {
    stopAll();

    if (isOpen) {
      ctrlAnim1.current = animate(ctrlX, SIDEBAR_W, {
        duration: OPEN_DUR * 0.80,
        ease: EASE,
      });
      edgeAnim.current = animate(edgeX, SIDEBAR_W, {
        duration: OPEN_DUR,
        ease: EASE,
      });
    } else {
      edgeAnim.current = animate(edgeX, 0, {
        duration: CLOSE_DUR * 0.78,
        ease: EASE,
      });
      ctrlAnim1.current = animate(ctrlX, 0, {
        delay: CLOSE_DUR * 0.06,
        duration: CLOSE_DUR * 0.75,
        ease: EASE,
      });
    }
  }, [isOpen]);

  const [contentActive, setContentActive] = useState(false);
  useMotionValueEvent(edgeX, 'change', (latest) => {
    setContentActive(latest > SIDEBAR_W * 0.5);
  });

  const navItemVariants = {
    open: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.3 + i * 0.07, duration: 0.35, ease: NAV_EASE },
    }),
    closed: { opacity: 0, y: 8, transition: { duration: 0.15 } },
  };

  const handleLogout = () => {
    logout();
    onClose();
    const el = document.querySelector('.layout-container') as HTMLElement | null;
    if (el) {
      el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      el.style.opacity = '0';
      el.style.transform = 'scale(0.92)';
    }
    setTimeout(() => {
      if (el) {
        el.style.opacity = '';
        el.style.transform = '';
      }
      navigate('/login');
    }, 400);
  };

  const routes = ['profile', 'sessions', 'metrics', 'about', 'studies'] as const;

  return (
    <div
      className="sidebar-wrapper"
      onMouseEnter={onSidebarMouseEnter}
      onMouseLeave={onSidebarMouseLeave}
    >
      {/* Curved SVG background */}
      <svg
        className="sidebar-bg"
        viewBox={`0 0 ${SIDEBAR_W} ${height}`}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: SIDEBAR_W, height }}
      >
        <motion.path d={d} fill="var(--color-bg-surface)" />
      </svg>

      {/* Content panel, transparent bg, translates with edgeX */}
      <motion.div
        className="sidebar"
        style={{ x: panelX, pointerEvents: contentActive ? 'auto' : 'none' }}
      >
        <nav className="sidebar-nav">
          <div className="sidebar-top">
            {routes.map((route, i) => (
              <motion.div
                key={route}
                custom={i}
                variants={navItemVariants}
                animate={isOpen ? 'open' : 'closed'}
                initial="closed"
              >
                <Link to={`/${route}`} className="sidebar-item" onClick={onClose}>
                  {route.charAt(0).toUpperCase() + route.slice(1)}
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="sidebar-bottom">
            {user && (
              <motion.div
                custom={routes.length}
                variants={navItemVariants}
                animate={isOpen ? 'open' : 'closed'}
                initial="closed"
              >
                <button className="sidebar-btn sidebar-btn-signin" onClick={handleLogout}>
                  Sign Out
                </button>
              </motion.div>
            )}
          </div>
        </nav>
      </motion.div>
    </div>
  );
};

export default Sidebar;
