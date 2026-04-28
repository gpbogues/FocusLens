import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { getGreeting } from '../../utils/greeting';
import './AgentPrompt.css';

const API_URL = import.meta.env.VITE_API_URL;

const SessionsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
    <line x1="5" y1="5.5" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="5" y1="10.5" x2="9" y2="10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const MetricsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor"/>
    <rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor"/>
    <rect x="11" y="1" width="3" height="14" rx="1" fill="currentColor"/>
  </svg>
);

const ProfileIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="5.5" r="2.8" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M2 13.5c0-2.485 2.686-4.5 6-4.5s6 2.015 6 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const StudiesIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2L2 5l6 3 6-3-6-3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M2 5v4c0 1.657 2.686 3 6 3s6-1.343 6-3V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <line x1="14" y1="5" x2="14" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const AboutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
    <line x1="8" y1="7" x2="8" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="5" r="0.8" fill="currentColor"/>
  </svg>
);

const ACTION_MESSAGES: Record<string, string> = {
  navigate_sessions:         'Navigating to your sessions!',
  navigate_sessions_folders: 'Taking you to your session folders!',
  open_session_snapshot:     'Opening your recent session snapshot!',
  navigate_metrics:          'Pulling up your metrics!',
  navigate_profile:          'Heading to your profile!',
  navigate_studies:          'Taking you to the research and studies!',
  navigate_about:            'Heading to the About page!',
  unknown:                   "Not sure about that one, try the quick actions below.",
};

const NAVIGATING_ACTIONS = new Set(['navigate_sessions', 'navigate_sessions_folders', 'navigate_metrics', 'navigate_profile', 'navigate_studies', 'navigate_about']);

interface AgentPromptProps {
  greetingReady?: boolean;
}

const AgentPrompt = ({ greetingReady = true }: AgentPromptProps) => {
  const { user, requestOpenSnapshot } = useAuth();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [responseText, setResponseText] = useState('');
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chips = [
    { label: 'View Sessions', icon: <SessionsIcon />, action: () => navigate('/sessions') },
    { label: 'View Metrics',  icon: <MetricsIcon />,  action: () => navigate('/metrics') },
    { label: 'Edit Profile',  icon: <ProfileIcon />,  action: () => navigate('/profile') },
    { label: 'Studies',       icon: <StudiesIcon />,  action: () => navigate('/studies') },
    { label: 'About',         icon: <AboutIcon />,    action: () => navigate('/about') },
  ];

  useEffect(() => () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }, []);

  const startDismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      setActive(false);
      // Clear text after fade-out finishes so it's visible while fading
      setTimeout(() => setResponseText(''), 700);
    }, 3500);
  };

  const executeAction = (action: string) => {
    setTimeout(() => {
      if (action === 'navigate_sessions') navigate('/sessions');
      else if (action === 'navigate_sessions_folders') navigate('/sessions', { state: { tab: 'folders' } });
      else if (action === 'navigate_metrics') navigate('/metrics');
      else if (action === 'navigate_profile') navigate('/profile');
      else if (action === 'navigate_studies') navigate('/studies');
      else if (action === 'navigate_about') navigate('/about');
      else if (action === 'open_session_snapshot') requestOpenSnapshot();
    }, 600);
  };

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setLoading(true);
    setResponseText('');
    setActive(true);

    try {
      const res = await fetch(`${API_URL}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      const action = data.action ?? 'unknown';
      setResponseText(ACTION_MESSAGES[action] ?? ACTION_MESSAGES.unknown);
      setInput('');
      executeAction(action);
      if (!NAVIGATING_ACTIONS.has(action)) startDismiss();
    } catch {
      setResponseText("Couldn't reach the assistant, try the quick actions below.");
      startDismiss();
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const responseClass = [
    'agent-response',
    loading ? 'agent-response--thinking' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="agent-prompt">
      {greetingReady ? (
        <motion.h1
          className="agent-greeting"
          layoutId="greeting-text"
          transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {getGreeting(user?.username)}
        </motion.h1>
      ) : (
        <h1 className="agent-greeting" style={{ opacity: 0, pointerEvents: 'none' }} aria-hidden>
          {getGreeting(user?.username)}
        </h1>
      )}
      <div className="agent-input-wrap">
        <input
          className="agent-input"
          type="text"
          placeholder="What would you like to do today?"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
      </div>
      <div className={`agent-response-wrap${active ? ' agent-response-wrap--active' : ''}`}>
        <p className={responseClass}>
          {loading ? 'Thinking...' : responseText}
        </p>
      </div>
      <div className="agent-chips">
        {chips.map(chip => (
          <button key={chip.label} className="agent-chip" onClick={chip.action}>
            <span className="agent-chip-icon" aria-hidden="true">{chip.icon}</span>
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AgentPrompt;
