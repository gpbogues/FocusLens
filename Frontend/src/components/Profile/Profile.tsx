import { useAuth } from '../../context/AuthContext';
import './Profile.css';

const Profile = () => {
  const { user } = useAuth();

  return (
    <div className="profile-page">
      <h2 className="page-heading">Profile</h2>
      <div className="profile-content">
        <div className="profile-picture-placeholder"></div>
        <p className="account-name">{user ? user.username : 'Account Name'}</p>
        {user && <p className="account-email">{user.email}</p>}
      </div>
    </div>
  );
};

export default Profile;
