import './Home.css';

const Home = () => {
  return (
    <div className="home-page">
      <h2 className="page-heading">Session Snapshots</h2>
      <div className="snapshots-placeholder">
        <div className="placeholder-card">
          <p className="placeholder-text">Your focus session snapshots will appear here once you start a session.</p>
          <p className="placeholder-subtext">Each snapshot captures a moment during your focus time for later review.</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
