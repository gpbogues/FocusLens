import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Profile.css';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;

  //Reveal states for each field
  const [revealUsername, setRevealUsername] = useState(false);
  const [revealEmail, setRevealEmail] = useState(false);
  //not used for now
  const [revealPassword, setRevealPassword] = useState(false);

  //Modal states
  const [modal, setModal] = useState<'username' | 'password' | null>(null);

  //Username modal fields
  const [newUsername, setNewUsername] = useState('');

  //Password modal fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  //Masks a string with dots
  const mask = (str: string) => '•'.repeat(str.length);

  const openModal = (type: 'username' | 'password') => {
    setModal(type);
    setModalError('');
    setNewUsername('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const closeModal = () => {
    setModal(null);
    setModalError('');
  };

  //Handles update of username, database, and authContext
  const handleUsernameUpdate = async () => {
    if (!newUsername.trim()) {
      setModalError('Username cannot be empty');
      return;
    }
    setModalLoading(true);
    try {
      const res = await fetch(`${API_URL}/user/username`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.userId, newUsername }),
      });
      const data = await res.json();
      if (data.success) {
        updateUser({ username: newUsername });
        closeModal();
      } else {
        setModalError(data.message || 'Failed to update username');
      }
    } catch (err) {
      setModalError('Server error');
    } finally {
      setModalLoading(false);
    }
  };

  //Handles password update, validates current password before updating
  const handlePasswordUpdate = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setModalError('All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      setModalError('New passwords does not match');
      return;
    }
    setModalLoading(true);
    try {
      const res = await fetch(`${API_URL}/user/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.userId, currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        closeModal();
      } else {
        setModalError(data.message || 'Failed to update password');
      }
    } catch (err) {
      setModalError('Server error');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="profile-page">

      {/* Banner placeholder for future profile banner */}
      <div className="profile-banner" />

      {/* Profile picture and username header */}
      <div className="profile-header">
        <div className="profile-picture-placeholder" />
        <p className="profile-username">{user?.username ?? 'Username'}</p>
        {/* Edit User Profile button placeholder for future banner/picture editing */}
        <button className="edit-profile-btn">Edit User Profile</button>
      </div>

      {/* Info card */}
      <div className="profile-card">

        {/* Username row */}
        <div className="profile-row">
          <div className="profile-field">
            <span className="profile-label">Username</span>
            <span className="profile-value">
              {revealUsername ? user?.username : mask(user?.username ?? '')}
            </span>
          </div>
          <div className="profile-actions">
            <button className="reveal-btn" onClick={() => setRevealUsername(prev => !prev)}>
              {revealUsername ? 'Hide' : 'Reveal'}
            </button>
            <button className="edit-btn" onClick={() => openModal('username')}>Edit</button>
          </div>
        </div>

        <div className="profile-divider" />

        {/* Email row, reveal only, no edit for now */}
        <div className="profile-row">
          <div className="profile-field">
            <span className="profile-label">Email</span>
            <span className="profile-value">
              {revealEmail ? user?.email : mask(user?.email ?? '')}
            </span>
          </div>
          <div className="profile-actions">
            <button className="reveal-btn" onClick={() => setRevealEmail(prev => !prev)}>
              {revealEmail ? 'Hide' : 'Reveal'}
            </button>
          </div>
        </div>

        <div className="profile-divider" />

        {/* Password row */}
        <div className="profile-row">
          <div className="profile-field">
            <span className="profile-label">Password</span>
            <span className="profile-value">
              {revealPassword ? '(hidden for security)' : '••••••••'}
            </span>
          </div>
          <div className="profile-actions">
            <button className="edit-btn" onClick={() => openModal('password')}>Edit</button>
          </div>
        </div>

      </div>

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