import { useState } from 'react';
import './WebcamFeed.css';

const DMB_URL = import.meta.env.VITE_DMB_URL ?? 'http://localhost:5000';

interface WebcamFeedProps {
  isActive: boolean;
  isPaused: boolean;
}

const WebcamFeed = ({ isActive, isPaused }: WebcamFeedProps) => {
  const [streamError, setStreamError] = useState(false);

  return (
    <div className="webcam-feed">
      {isActive ? (
        <div className="video-container">
          {streamError ? (
            <div className="error-message">Tracker offline - start dmb.py to enable feed</div>
          ) : (
            <>
              <img
                key={isActive ? 'feed-active' : 'feed-inactive'}
                src={`${DMB_URL}/api/video_feed`}
                alt="Live camera feed"
                className="video-element"
                onError={() => setStreamError(true)}
                onLoad={() => setStreamError(false)}
              />
              {isPaused && (
                <div className="paused-overlay">
                  <span className="paused-label">Paused</span>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="placeholder">
          <p>Click "Start Session" to begin webcam feed</p>
        </div>
      )}
    </div>
  );
};

export default WebcamFeed;
