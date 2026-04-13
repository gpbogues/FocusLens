import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { getGreeting } from '../../utils/greeting';
import './AgentPrompt.css';

const API_URL = import.meta.env.VITE_API_URL;

const ACTION_MESSAGES: Record<string, string> = {
  navigate_sessions: 'Navigating to your sessions!',
  navigate_metrics:  'Pulling up your metrics!',
  navigate_profile:  'Heading to your profile!',
  start_session:     'Start Session is ready in the sidebar!',
  unknown:           "Not sure about that one, try the quick actions below.",
};

const NAVIGATING_ACTIONS = new Set(['navigate_sessions', 'navigate_metrics', 'navigate_profile']);

interface AgentPromptProps {
  greetingReady?: boolean;
}

const AgentPrompt = ({ greetingReady = true }: AgentPromptProps) => {
  const { user, requestHighlightSession } = useAuth();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [responseText, setResponseText] = useState('');
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chips = [
    { label: 'Start a Session', icon: '▶', action: () => requestHighlightSession() },
    { label: 'View Sessions',  icon: '📋', action: () => navigate('/sessions') },
    { label: 'View Metrics',   icon: '📊', action: () => navigate('/metrics') },
    { label: 'Edit Profile',   icon: '👤', action: () => navigate('/profile') },
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
      else if (action === 'navigate_metrics') navigate('/metrics');
      else if (action === 'navigate_profile') navigate('/profile');
      else if (action === 'start_session') requestHighlightSession();
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
            <span className="agent-chip-icon">{chip.icon}</span>
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AgentPrompt;
