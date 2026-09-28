import { useEffect, useRef, useState, useMemo } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import useVoicePlaybackRate from '../hooks/useVoicePlaybackRate.js';

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Generate an aesthetic, organic audio waveform based on a seed string
function generateWaveformBars(seedStr, count = 28) {
  let hash = 0;
  for (let i = 0; i < (seedStr || '').length; i++) {
    hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const bars = [];
  for (let i = 0; i < count; i++) {
    // Generate organic pseudo-random heights between 20% and 100%
    const pseudo = Math.abs(Math.sin(hash + i * 1.43) * 0.55 + Math.cos(i * 0.77) * 0.45);
    const heightPct = Math.round(20 + pseudo * 80);
    bars.push(Math.max(20, Math.min(100, heightPct)));
  }
  return bars;
}

function VoiceSpeedControl({ rate, setRate, allowedRates }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function closeOnOutsidePointer(event) {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="voice-speed-control" ref={containerRef}>
      <button
        type="button"
        className="voice-speed-pill"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((open) => !open);
        }}
        aria-label="Playback speed"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {rate}x
      </button>
      {isOpen && (
        <div className="voice-speed-menu" role="listbox" aria-label="Playback speed options">
          {allowedRates.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === rate}
              className={`voice-speed-option ${option === rate ? 'selected' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                setRate(option);
                setIsOpen(false);
              }}
            >
              {option}x
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VoicePlayer({ url, onPlayedThrough, isMine = false, autoPlay = false }) {
  const audioRef = useRef(null);
  const waveTrackRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const burnedRef = useRef(false);
  const fixingDurationRef = useRef(false);
  const autoPlayedRef = useRef(false);
  const { rate, setRate, ALLOWED_RATES } = useVoicePlaybackRate();

  const bars = useMemo(() => generateWaveformBars(url, 24), [url]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, [url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  function maybeBurn() {
    if (burnedRef.current) return;
    burnedRef.current = true;
    onPlayedThrough?.();
  }

  // MediaRecorder webm blobs (Chrome/Android) don't carry a real duration
  // header — audio.duration comes back Infinity/NaN on loadedmetadata.
  function fixInfiniteDuration(audio) {
    if (fixingDurationRef.current) return;
    fixingDurationRef.current = true;
    audio.currentTime = 1e101;
    const onTimeUpdate = () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.currentTime = 0;
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      fixingDurationRef.current = false;
      if (autoPlay && !autoPlayedRef.current) {
        autoPlayedRef.current = true;
        audio.play().catch(() => {});
      }
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
  }

  async function togglePlay(e) {
    e?.stopPropagation?.();
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) {
        await audio.play();
        setPlaying(true);
      } else {
        audio.pause();
        setPlaying(false);
      }
    } catch {
      setPlaying(false);
    }
  }

  function handleSeek(e) {
    e?.stopPropagation?.();
    const audio = audioRef.current;
    const track = waveTrackRef.current;
    if (!audio || !track) return;
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * (audio.duration || duration || 0);
    if (Number.isFinite(targetTime)) {
      audio.currentTime = targetTime;
      setCurrentTime(targetTime);
      setProgress(ratio);
    }
  }

  // WhatsApp-style: show duration when paused at 0, count up elapsed when active
  const displaySeconds = playing || currentTime > 0 ? currentTime : duration;

  return (
    <div className={`voice-player-modern ${isMine ? 'is-mine' : 'is-theirs'} ${playing ? 'is-playing' : ''}`}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget;
          audio.playbackRate = rate;
          const d = audio.duration;
          if (Number.isFinite(d) && d > 0) {
            setDuration(d);
            if (autoPlay && !autoPlayedRef.current) {
              autoPlayedRef.current = true;
              audio.play().catch(() => {});
            }
          } else {
            fixInfiniteDuration(audio);
          }
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (fixingDurationRef.current) return;
          setCurrentTime(a.currentTime);
          setProgress(a.duration && Number.isFinite(a.duration) ? a.currentTime / a.duration : 0);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCurrentTime(0);
          maybeBurn();
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />

      {/* Row 1: Play button + Waveform sharing the same vertical center */}
      <div className="voice-main-row">
        <button
          type="button"
          className="voice-play-btn"
          onClick={togglePlay}
          aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        >
          {playing ? (
            <Pause size={13} fill="currentColor" stroke="none" className="voice-btn-icon" />
          ) : (
            <Play size={13} fill="currentColor" stroke="none" className="voice-btn-icon voice-btn-icon--play" />
          )}
        </button>

        {/* Interactive Waveform Seeking */}
        <div
          ref={waveTrackRef}
          className="voice-wave-bars"
          onClick={handleSeek}
          role="slider"
          aria-label="Seek voice message"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
        >
          {bars.map((h, i) => {
            const barProgress = i / (bars.length - 1);
            const isFilled = barProgress <= progress;
            return (
              <span
                key={i}
                className={`voice-wave-bar ${isFilled ? 'filled' : ''}`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Row 2: Bottom Metadata indented flush beneath the waveform */}
      <div className="voice-meta-row">
        <div className="voice-meta-left">
          <span className="voice-time-label">
            <Mic size={11} className="voice-mic-icon" />
            <span>{formatDuration(displaySeconds)}</span>
          </span>

          <VoiceSpeedControl rate={rate} setRate={setRate} allowedRates={ALLOWED_RATES} />
        </div>
      </div>
    </div>
  );
}
