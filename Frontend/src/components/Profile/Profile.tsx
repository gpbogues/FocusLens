import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { cognitoSignUp, cognitoConfirmSignUp, cognitoResendCode } from '../Login/cognitoAuth';
import './Profile.css';

/*
TODOS:

add in profile and banner editing (aws s3)

fix bug of user not being deleted from cognito,
this seems to impact user register as well
*/

const Profile = () => {
  const { user, updateUser } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;

  //Reveal states for each field
  const [revealEmail, setRevealEmail] = useState(false);
  //not used for now
  const [revealPassword, setRevealPassword] = useState(false);

  //Modal states
  const [modal, setModal] = useState<'username' | 'email' | 'email-verify' | 'password' | null>(null);

  //Username modal fields
  const [newUsername, setNewUsername] = useState('');

  //Email modal fields
  const [newEmail, setNewEmail] = useState('');
  const [emailVerifyCode, setEmailVerifyCode] = useState('');

  //Password modal fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  //Masks a string with dots
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

  //Step 1 of email update, checks email availability then sends verification code via cognito
  //Creates temp cognito user same as register to trigger verification email
  const handleEmailSubmit = async () => {
    if (!newEmail.trim()) {
      setModalError('Email cannot be empty');
      return;
    }
    setModalLoading(true);
    try {
      //Uses random temp password since cognito requires a password 
      const tempPassword = `Temp@${Math.random().toString(36).slice(2, 10)}1A!`;
      await cognitoSignUp(newEmail, tempPassword, user?.username ?? '');
      setModal('email-verify');
      setModalError('');
    } catch (err: any) {
      setModalError(err.message || 'Failed to send verification code');
    } finally {
      setModalLoading(false);
    }
  };

  //Step 2 of email update, confirms code then updates sql and authContext
  //Deletes cognito temp user after verification (delete called by server api)
  const handleEmailVerify = async () => {
    if (!emailVerifyCode.trim()) {
      setModalError('Please enter the verification code');
      return;
    }
    setModalLoading(true);
    try {
      //Confirm code with cognito
      await cognitoConfirmSignUp(newEmail, emailVerifyCode);

      //Update email in sql and delete cognito temp user
      const res = await fetch(`${API_URL}/user/email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.userId, newEmail }),
      });
      const data = await res.json();
      if (data.success) {
        updateUser({ email: newEmail });
        closeModal();
      } else {
        setModalError(data.message || 'Failed to update email');
      }
    } catch (err: any) {
      setModalError(err.message || 'Invalid verification code');
    } finally {
      setModalLoading(false);
    }
  };

  //Copied from login.tsx requirements 
  //only checks 'new password' and not 'confirm new password'
  //since they have to match anyways 
  const passwordRequirements = [
    { label: "Password must be at least 8 characters", met: newPassword.length >= 8 },
    { label: "Use a number", met: /\d/.test(newPassword) },
    { label: "Use a lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "Use an uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "Use a special character", met: /[^A-Za-z0-9]/.test(newPassword) },
  ];
  const allRequirementsMet = passwordRequirements.every((r) => r.met);

  //Handles password update, validates current password, and requirements before updating
  const handlePasswordUpdate = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setModalError('All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      setModalError('New passwords does not match');
      return;
    }
    if (!allRequirementsMet) {
      setModalError("Password requirements not met.");
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
              {user?.username}
            </span>
          </div>
          <div className="profile-actions">
            <button className="edit-btn" onClick={() => openModal('username')}>Edit</button>
          </div>
        </div>

        <div className="profile-divider" />

        {/* Email row */}
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
            <button className="edit-btn" onClick={() => openModal('email')}>Edit</button>
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

      {/* Email modal step 1, enter new email */}
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

      {/* Email modal step 2, enter verification code */}
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
            {/* Resend code option using existing cognitoResendCode function */}
            <p className="modal-resend" onClick={() => cognitoResendCode(newEmail)}>
              Resend code
            </p>
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