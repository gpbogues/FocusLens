import './Profile.css';

const Profile = () => {
  return (
    <div className="profile-page">
      <h2 className="page-heading">Profile</h2>
      <div className="profile-content">
        <div className="profile-picture-placeholder"></div>
        <p className="account-name">Account Name</p>
      </div>
    </div>
  );
};

export default Profile;
