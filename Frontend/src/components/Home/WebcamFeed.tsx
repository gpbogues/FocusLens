import { useEffect, useRef, useState } from 'react';
import './WebcamFeed.css';

interface WebcamFeedProps {
  isActive: boolean;
}

const WebcamFeed = ({ isActive }: WebcamFeedProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setError('');
      } catch (err) {
        console.error('Error accessing webcam:', err);
        setError('Unable to access webcam. Please ensure you have granted camera permissions.');
      }
    };

    const stopWebcam = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setError('');
    };

    if (isActive) {
      startWebcam();
    } else {
      stopWebcam();
    }

    return () => {
      stopWebcam();
    };
  }, [isActive]);

  return (
    <div className="webcam-feed">
      {isActive ? (
        <div className="video-container">
          {error ? (
            <div className="error-message">{error}</div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="video-element"
            />
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
