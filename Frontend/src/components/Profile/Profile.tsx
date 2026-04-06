import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import './Profile.css';

const AVATAR_PRESETS = [
  { id: 'fox',    emoji: '🦊', bg: '#f97316' },
  { id: 'wolf',   emoji: '🐺', bg: '#6b7280' },
  { id: 'lion',   emoji: '🦁', bg: '#eab308' },
  { id: 'eagle',  emoji: '🦅', bg: '#3b82f6' },
  { id: 'dragon', emoji: '🐉', bg: '#8b5cf6' },
  { id: 'cat',    emoji: '🐱', bg: '#ec4899' },
  { id: 'robot',  emoji: '🤖', bg: '#14b8a6' },
  { id: 'alien',  emoji: '👾', bg: '#a855f7' },
];

const Profile = () => {
  const { user } = useAuth();
  const {
    isDarkMode, setIsDarkMode,
    cameraEnabled, setCameraEnabled,
    micEnabled, setMicEnabled,
    avatarId, setAvatarId,
  } = useSettings();

  const selectedAvatar = AVATAR_PRESETS.find(a => a.id === avatarId) ?? AVATAR_PRESETS[0];

  return (
    <div className="profile-page">
      <h2 className="page-heading">Profile</h2>

      {/* Profile card */}
      <section className="profile-card">
        <div
          className="profile-avatar-display"
          style={{ backgroundColor: selectedAvatar.bg }}
        >
          <span className="profile-avatar-emoji">{selectedAvatar.emoji}</span>
        </div>
        <div className="profile-info">
          <p className="account-name">{user ? user.username : 'Guest'}</p>
          {user && <p className="account-email">{user.email}</p>}
        </div>
      </section>

      {/* Avatar picker */}
      <section className="settings-section">
        <h3 className="settings-section-title">Choose Avatar</h3>
        <div className="avatar-grid">
          {AVATAR_PRESETS.map(avatar => (
            <button
              key={avatar.id}
              className={`avatar-option ${avatarId === avatar.id ? 'avatar-selected' : ''}`}
              style={{ backgroundColor: avatar.bg }}
              onClick={() => setAvatarId(avatar.id)}
              aria-label={`Select ${avatar.id} avatar`}
            >
              <span className="avatar-option-emoji">{avatar.emoji}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Settings */}
      <section className="settings-section">
        <h3 className="settings-section-title">Settings</h3>

        <div className="settings-group">
          <p className="settings-group-label">Appearance</p>
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Dark Mode</span>
              <span className="settings-row-desc">Toggle between dark and light theme</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={isDarkMode}
                onChange={e => setIsDarkMode(e.target.checked)}
              />
              <span className="toggle-track">
                <span className="toggle-thumb" />
              </span>
            </label>
          </div>
        </div>

        <div className="settings-group">
          <p className="settings-group-label">Privacy</p>
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Camera</span>
              <span className="settings-row-desc">Allow webcam access during sessions</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={cameraEnabled}
                onChange={e => setCameraEnabled(e.target.checked)}
              />
              <span className="toggle-track">
                <span className="toggle-thumb" />
              </span>
            </label>
          </div>
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Microphone</span>
              <span className="settings-row-desc">Allow microphone access during sessions</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={micEnabled}
                onChange={e => setMicEnabled(e.target.checked)}
              />
              <span className="toggle-track">
                <span className="toggle-thumb" />
              </span>
            </label>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Profile;
