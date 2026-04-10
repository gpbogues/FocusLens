import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './AgentPrompt.css';

const getGreeting = (username?: string) => {
  const h = new Date().getHours();
  const name = username ? `, ${username}` : '';
  if (h >= 1 && h < 4) return 'Still at it this late?';
  if (h < 11 || h >= 4) return `Good morning${name}.`;
  if (h < 18) return `Good afternoon${name}.`;
  return `Good evening${name}.`;
};

const AgentPrompt = () => {
  const { user, requestHighlightSession } = useAuth();
  const navigate = useNavigate();

  const chips = [
    { label: 'Start a Session', icon: '▶', action: () => requestHighlightSession() },
    { label: 'View Sessions', icon: '📋', action: () => navigate('/sessions') },
    { label: 'View Metrics', icon: '📊', action: () => navigate('/metrics') },
    { label: 'Edit Profile', icon: '👤', action: () => navigate('/profile') },
  ];

  return (
    <div className="agent-prompt">
      <h1 className="agent-greeting">
        {getGreeting(user?.username)}
      </h1>
      <p className="agent-subtext">What would you like to do today?</p>
      <div className="agent-input-wrap">
        <input
          className="agent-input"
          type="text"
          placeholder="Someone lend me 30k to cover API key costs - Seb"
          disabled
        />
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
