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

  //Slider motion values
  // edgeX: x-position of the top-right and bottom-right corners.
  //        0 = sidebar fully off-screen; SIDEBAR_W = fully open.
  //        Also drives the panel's translateX so they stay in sync.
  // ctrlX: x-position of the quadratic bezier control point (mid-right).
  //        Leads edgeX when opening (bulges ahead), trails when closing.
  const edgeX = useMotionValue(0);
  const ctrlX = useMotionValue(0);

  //panelX: offset so the content panel slides with the edge
  const panelX = useTransform(edgeX, (e) => e - SIDEBAR_W);

  //Live SVG path,recomputed on every frame as the values change
  const d = useTransform(
    [edgeX, ctrlX],
    ([e, c]: number[]) =>
      `M0 0 L${e} 0 Q${c} ${height / 2} ${e} ${height} L0 ${height} Z`,
  );

  //Keep animation controls in refs so we can cancel mid-animation on reversal
  const edgeAnim  = useRef<AnimationPlaybackControls | null>(null);
  const ctrlAnim1 = useRef<AnimationPlaybackControls | null>(null);
  const ctrlAnim2 = useRef<AnimationPlaybackControls | null>(null);

  const stopAll = () => {
    edgeAnim.current?.stop();
    ctrlAnim1.current?.stop();
    ctrlAnim2.current?.stop();
  };

  //Drive the slider whenever isOpen changes 
  useEffect(() => {
    stopAll();

    if (isOpen) {
      //Opening, middle leads, top/bottom trail:
      //  ctrlX races straight to W in ~55% of the open duration.
      //  edgeX takes the full duration (always behind ctrlX).
      //  Because ctrlX > edgeX throughout, the middle bulges outward.
      //  Both land on W at the end, clean flat rectangle, no snap.
      ctrlAnim1.current = animate(ctrlX, SIDEBAR_W, {
        duration: OPEN_DUR * 0.80,
        ease: EASE,
      });
      edgeAnim.current = animate(edgeX, SIDEBAR_W, {
        duration: OPEN_DUR,
        ease: EASE,
      });
    } else {
      //Closing, top/bottom lead, middle trails:
      //  edgeX retracts quickly (65% of close duration).
      //  ctrlX starts after a short delay and finishes last.
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
  //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  //Enable pointer events on the content panel only once the sidebar is mostly open
  const [contentActive, setContentActive] = useState(false);
  useMotionValueEvent(edgeX, 'change', (latest) => {
    setContentActive(latest > SIDEBAR_W * 0.5);
  });

  //Nav item stagger (opacity + y-slide)
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
    //Always mounted, visibility is driven entirely by motion values, not mounting.
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
