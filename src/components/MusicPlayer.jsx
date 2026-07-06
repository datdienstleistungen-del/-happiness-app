import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Music } from 'lucide-react';
import lofiGenerator from '../utils/LofiGenerator';
import './MusicPlayer.css';

export default function MusicPlayer({ videoPlaying = false }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [bars, setBars] = useState([4, 8, 6, 10, 5, 9, 7, 12]);
  const animRef = useRef(null);
  const prevVideoPlaying = useRef(videoPlaying);

  // Animate visualizer bars
  const animate = useCallback(() => {
    if (isPlaying) {
      setBars(prev => prev.map(() => Math.random() * 16 + 4));
    }
    animRef.current = requestAnimationFrame(() => {
      setTimeout(() => animate(), 100);
    });
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, animate]);

  // Duck music when video starts playing
  useEffect(() => {
    if (videoPlaying && !prevVideoPlaying.current) {
      lofiGenerator.duck(0.15);
    } else if (!videoPlaying && prevVideoPlaying.current) {
      lofiGenerator.unduck();
    }
    prevVideoPlaying.current = videoPlaying;
  }, [videoPlaying]);

  const togglePlay = async () => {
    if (isPlaying) {
      lofiGenerator.stop();
      setIsPlaying(false);
    } else {
      await lofiGenerator.start();
      lofiGenerator.setVolume(isMuted ? 0 : volume);
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      lofiGenerator.setVolume(volume);
    } else {
      setIsMuted(true);
      lofiGenerator.setVolume(0);
    }
  };

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (!isMuted) {
      lofiGenerator.setVolume(newVol);
    }
  };

  return (
    <div className="music-player">
      <button className="music-toggle" onClick={togglePlay} title={isPlaying ? 'Musik pausieren' : 'Musik abspielen'}>
        <div className="music-visualizer">
          {bars.map((h, i) => (
            <span
              key={i}
              className={`bar ${isPlaying ? 'active' : ''}`}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>

      <div className="volume-container"
        onMouseEnter={() => setShowVolume(true)}
        onMouseLeave={() => setShowVolume(false)}
      >
        <button className="volume-btn" onClick={toggleMute}>
          {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        {showVolume && (
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="volume-slider"
          />
        )}
      </div>
    </div>
  );
}
