import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { cognitoSignUp, cognitoConfirmSignUp, cognitoResendCode } from '../Login/cognitoAuth';
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
  const { user, updateUser } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;
  const {
    isDarkMode, setIsDarkMode,
    cameraEnabled, setCameraEnabled,
    micEnabled, setMicEnabled,
    avatarId, setAvatarId,
  } = useSettings();

  const selectedAvatar = AVATAR_PRESETS.find(a => a.id === avatarId) ?? AVATAR_PRESETS[0];

  // ── Account section state ──
  const [revealEmail, setRevealEmail] = useState(false);
  const [modal, setModal] = useState<'username' | 'email' | 'email-verify' | 'password' | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailVerifyCode, setEmailVerifyCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const mask = (str: string) => '•'.repeat(str.length);

  const openModal = (type: 'username' | 'email' | 'password') => {
    setModal(type);
    setModalError('');
    setNewUsername('');
    setNewEmail('');
    setEmailVerifyCode('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const closeModal = () => {
    if (modal === 'email-verify' && newEmail) {
      fetch(`${API_URL}/delete-cognito-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      }).catch(() => {});
    }
    setModal(null);
    setModalError('');
  };

  const handleUsernameUpdate = async () => {
    if (!newUsername.trim()) { setModalError('Username cannot be empty'); return; }
    setModalLoading(true);
    try {
      const res = await fetch(`${API_URL}/user/username`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.userId, newUsername }),
      });
      const data = await res.json();
      if (data.success) { updateUser({ username: newUsername }); closeModal(); }
      else setModalError(data.message || 'Failed to update username');
    } catch { setModalError('Server error'); }
    finally { setModalLoading(false); }
  };

  const handleEmailSubmit = async () => {
    if (!newEmail.trim()) { setModalError('Email cannot be empty'); return; }
    setModalLoading(true);
    try {
      const checkRes = await fetch(`${API_URL}/check-email?email=${encodeURIComponent(newEmail)}`);
      const checkData = await checkRes.json();
      if (!checkData.available) { setModalError('Email is already in use'); return; }
      const tempPassword = `Temp@${Math.random().toString(36).slice(2, 10)}1A!`;
      await cognitoSignUp(newEmail, tempPassword, user?.username ?? '');
      setModal('email-verify');
      setModalError('');
    } catch (err: any) {
      setModalError(err.message || 'Failed to send verification code');
    } finally { setModalLoading(false); }
  };

  const handleEmailVerify = async () => {
    if (!emailVerifyCode.trim()) { setModalError('Please enter the verification code'); return; }
    setModalLoading(true);
    try {
      await cognitoConfirmSignUp(newEmail, emailVerifyCode);
      const res = await fetch(`${API_URL}/user/email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.userId, newEmail }),
      });
      const data = await res.json();
      if (data.success) { updateUser({ email: newEmail }); closeModal(); }
      else setModalError(data.message || 'Failed to update email');
    } catch (err: any) {
      setModalError(err.message || 'Invalid verification code');
    } finally { setModalLoading(false); }
  };

  const passwordRequirements = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'A number', met: /\d/.test(newPassword) },
    { label: 'A lowercase letter', met: /[a-z]/.test(newPassword) },
    { label: 'An uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'A special character', met: /[^A-Za-z0-9]/.test(newPassword) },
  ];
  const allRequirementsMet = passwordRequirements.every(r => r.met);

  const handlePasswordUpdate = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setModalError('All fields are required'); return;
    }
    if (newPassword !== confirmPassword) { setModalError('New passwords do not match'); return; }
    if (!allRequirementsMet) { setModalError('Password requirements not met'); return; }
    setModalLoading(true);
    try {
      const res = await fetch(`${API_URL}/user/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.userId, currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) closeModal();
      else setModalError(data.message || 'Failed to update password');
    } catch { setModalError('Server error'); }
    finally { setModalLoading(false); }
  };

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

      {/* Account info */}
      <section className="settings-section">
        <h3 className="settings-section-title">Account</h3>
        <div className="settings-group">
          {/* Username row */}
          <div className="settings-row account-row">
            <div className="settings-row-info">
              <span className="settings-row-desc">Username</span>
              <span className="settings-row-title">{user?.username}</span>
            </div>
            <button className="account-edit-btn" onClick={() => openModal('username')}>Edit</button>
          </div>

          {/* Email row */}
          <div className="settings-row account-row">
            <div className="settings-row-info">
              <span className="settings-row-desc">Email</span>
              <span className="settings-row-title">
                {revealEmail ? user?.email : mask(user?.email ?? '')}
              </span>
            </div>
            <div className="account-row-actions">
              <button className="account-reveal-btn" onClick={() => setRevealEmail(p => !p)}>
                {revealEmail ? 'Hide' : 'Reveal'}
              </button>
              <button className="account-edit-btn" onClick={() => openModal('email')}>Edit</button>
            </div>
          </div>

          {/* Password row */}
          <div className="settings-row account-row">
            <div className="settings-row-info">
              <span className="settings-row-desc">Password</span>
              <span className="settings-row-title">••••••••</span>
            </div>
            <button className="account-edit-btn" onClick={() => openModal('password')}>Edit</button>
          </div>
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

      {/* Username modal */}
      {modal === 'username' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Update Username</h3>
            <input
              className="modal-input"
              type="text"
              placeholder="New username"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
            />
            {modalError && <p className="modal-error">{modalError}</p>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={closeModal}>Cancel</button>
              <button className="modal-save" onClick={handleUsernameUpdate} disabled={modalLoading}>
                {modalLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email modal step 1 */}
      {modal === 'email' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Update Email</h3>
            <p className="modal-subtitle">A verification code will be sent to your new email</p>
            <input
              className="modal-input"
              type="email"
              placeholder="New email address"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
            {modalError && <p className="modal-error">{modalError}</p>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={closeModal}>Cancel</button>
              <button className="modal-save" onClick={handleEmailSubmit} disabled={modalLoading}>
                {modalLoading ? 'Sending...' : 'Send Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email modal step 2 */}
      {modal === 'email-verify' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Verify New Email</h3>
            <p className="modal-subtitle">Enter the 6-digit code sent to {newEmail}</p>
            <input
              className="modal-input"
              type="text"
              placeholder="Verification code"
              value={emailVerifyCode}
              onChange={e => setEmailVerifyCode(e.target.value)}
              maxLength={6}
            />
            <p className="modal-resend" onClick={() => cognitoResendCode(newEmail)}>Resend code</p>
            {modalError && <p className="modal-error">{modalError}</p>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={closeModal}>Cancel</button>
              <button className="modal-save" onClick={handleEmailVerify} disabled={modalLoading}>
                {modalLoading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password modal */}
      {modal === 'password' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Update Password</h3>
            <input
              className="modal-input"
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
            />
            <input
              className="modal-input"
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
            {newPassword.length > 0 && (
              <ul className="modal-requirements">
                {passwordRequirements.map(r => (
                  <li key={r.label} className={r.met ? 'req-met' : 'req-unmet'}>
                    {r.met ? '✓' : '○'} {r.label}
                  </li>
                ))}
              </ul>
            )}
            <input
              className="modal-input"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
            {modalError && <p className="modal-error">{modalError}</p>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={closeModal}>Cancel</button>
              <button className="modal-save" onClick={handlePasswordUpdate} disabled={modalLoading}>
                {modalLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;
