import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  Tv,
  AlertTriangle,
  Radio
} from 'lucide-react';

const CONFIRM_KEYS = new Set(['Enter', 'Select', 'Ok', 'OK', 'Center', 'DPadCenter', ' ']);
const CONFIRM_CODES = new Set([13, 23, 66]);
export const isRemoteConfirmKey = (e) => CONFIRM_KEYS.has(e.key) || CONFIRM_CODES.has(e.keyCode || e.which);

const BACK_KEYS = new Set(['Escape', 'Back', 'BrowserBack', 'GoBack', 'Backspace']);
const BACK_CODES = new Set([27, 4, 8]);
export const isRemoteBackKey = (e) => BACK_KEYS.has(e.key) || BACK_CODES.has(e.keyCode || e.which);

const UP_KEYS = new Set(['ArrowUp', 'Up', 'VolumeUp']);
const UP_CODES = new Set([38, 19]);
const isDpadUp = (e) => UP_KEYS.has(e.key) || UP_CODES.has(e.keyCode);

const DOWN_KEYS = new Set(['ArrowDown', 'Down', 'VolumeDown']);
const DOWN_CODES = new Set([40, 20]);
const isDpadDown = (e) => DOWN_KEYS.has(e.key) || DOWN_CODES.has(e.keyCode);

const LivePlayer = forwardRef(function LivePlayer({ channel, onPreviousChannel, onNextChannel }, ref) {
  const videoRef = useRef(null);
  const playerWrapperRef = useRef(null);
  const hlsRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);

  const triggerShowControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  }, []);

  // Show controls on channel change/load, then auto-hide after 4 seconds
  useEffect(() => {
    triggerShowControls();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [channel, triggerShowControls]);

  const waitingTimeoutRef = useRef(null);

  const handleWaiting = useCallback(() => {
    if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
    waitingTimeoutRef.current = setTimeout(() => {
      setIsLoading(true);
    }, 250);
  }, []);

  const handlePlaying = useCallback(() => {
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
    setIsLoading(false);
    setIsPlaying(true);
  }, []);

  // ── Initialize or Switch Stream ────────────────────────────
  const loadStream = useCallback((streamUrl) => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');

    // Safely reset video element pipeline and destroy existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.pause();
    video.removeAttribute('src');
    video.load();

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 10,
        maxBufferLength: 20,
        maxMaxBufferLength: 30,
        maxBufferSize: 20 * 1000 * 1000,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 5,
        manifestLoadingTimeOut: 5000,
        manifestLoadingMaxRetry: 2,
        levelLoadingTimeOut: 5000,
        levelLoadingMaxRetry: 2,
        fragLoadingTimeOut: 5000,
        fragLoadingMaxRetry: 2,
        startFragPrefetch: true,
      });

      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch(() => {
              // Autoplay with sound was blocked by browser policy; retry muted
              video.muted = true;
              setIsMuted(true);
              video.play().then(() => setIsPlaying(true)).catch(() => { });
            });
        }
      });

      // Clear loading as soon as first media fragment is buffered in RAM
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        setIsLoading(false);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('LivePlayer: Network error, attempting rapid reload...', data);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('LivePlayer: Media decoder error, recovering...', data);
              hls.recoverMediaError();
              break;
            default:
              console.error('LivePlayer: Unrecoverable stream error:', data);
              hls.destroy();
              setHasError(true);
              setIsLoading(false);
              setErrorMessage('Stream offline or blocked by broadcaster.');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari / iOS HLS support
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        video.play().then(() => setIsPlaying(true)).catch(() => {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => { });
        });
      });

      video.addEventListener('error', () => {
        setIsLoading(false);
        setHasError(true);
        setErrorMessage('Stream offline or blocked.');
      });
    } else {
      setIsLoading(false);
      setHasError(true);
      setErrorMessage('HLS playback is not supported on this browser.');
    }
  }, []);

  useEffect(() => {
    if (channel?.streamUrl) {
      loadStream(channel.streamUrl);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel, loadStream]);

  // ── Sync Video Play/Pause State ────────────────────────────
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    triggerShowControls();

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => { });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [triggerShowControls]);

  const [showVolumeToast, setShowVolumeToast] = useState(false);
  const volumeToastTimerRef = useRef(null);

  const adjustVolume = useCallback((delta) => {
    const video = videoRef.current;
    if (!video) return;

    triggerShowControls();

    setShowVolumeToast(true);
    if (volumeToastTimerRef.current) clearTimeout(volumeToastTimerRef.current);
    volumeToastTimerRef.current = setTimeout(() => {
      setShowVolumeToast(false);
    }, 2000);

    setVolume((prev) => {
      let next = Math.round((prev + delta) * 20) / 20; // 5% step
      if (next > 1) next = 1;
      if (next < 0) next = 0;

      video.volume = next;
      const muted = next === 0;
      video.muted = muted;
      setIsMuted(muted);
      return next;
    });
  }, [triggerShowControls]);

  // ── Screen Orientation Helpers ────────────────────────────
  const lockLandscape = useCallback(async () => {
    try {
      if (window.screen?.orientation?.lock) {
        await window.screen.orientation.lock('landscape');
      } else if (window.screen?.lockOrientation) {
        window.screen.lockOrientation('landscape');
      } else if (window.screen?.mozLockOrientation) {
        window.screen.mozLockOrientation('landscape');
      } else if (window.screen?.msLockOrientation) {
        window.screen.msLockOrientation('landscape');
      }
    } catch {
      // Ignored if browser/OS or security policy restricts orientation lock
    }
  }, []);

  const unlockOrientation = useCallback(() => {
    try {
      if (window.screen?.orientation?.unlock) {
        window.screen.orientation.unlock();
      } else if (window.screen?.unlockOrientation) {
        window.screen.unlockOrientation();
      } else if (window.screen?.mozUnlockOrientation) {
        window.screen.mozUnlockOrientation();
      } else if (window.screen?.msUnlockOrientation) {
        window.screen.msUnlockOrientation();
      }
    } catch {
      // Ignore
    }
  }, []);

  // ── Fullscreen Controls ────────────────────────────────────
  const enterFullscreen = useCallback(async () => {
    const wrapper = playerWrapperRef.current;
    const video = videoRef.current;
    if (!wrapper) return;

    if (document.fullscreenElement || document.webkitFullscreenElement) {
      await lockLandscape();
      return;
    }

    const req = wrapper.requestFullscreen || wrapper.webkitRequestFullscreen || wrapper.mozRequestFullScreen || wrapper.msRequestFullscreen;
    if (req) {
      try {
        await req.call(wrapper);
        await lockLandscape();
      } catch {
        if (video?.webkitEnterFullscreen) {
          try {
            video.webkitEnterFullscreen();
          } catch { }
        }
      }
    } else if (video?.webkitEnterFullscreen) {
      try {
        video.webkitEnterFullscreen();
      } catch { }
    }
  }, [lockLandscape]);

  const exitFullscreen = useCallback(() => {
    unlockOrientation();
    if (!document.fullscreenElement && !document.webkitFullscreenElement) return;
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    exit?.call(document).catch(() => { });
  }, [unlockOrientation]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement || isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [enterFullscreen, exitFullscreen, isFullscreen]);

  useImperativeHandle(ref, () => ({
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    isPlaying,
    isFullscreen
  }), [enterFullscreen, exitFullscreen, toggleFullscreen, isPlaying, isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const activeFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(activeFs);
      if (activeFs) {
        lockLandscape();
      } else {
        unlockOrientation();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      unlockOrientation();
    };
  }, [lockLandscape, unlockOrientation]);

  // Handle native iOS video fullscreen events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onBegin = () => setIsFullscreen(true);
    const onEnd = () => {
      setIsFullscreen(false);
      unlockOrientation();
    };

    video.addEventListener('webkitbeginfullscreen', onBegin);
    video.addEventListener('webkitendfullscreen', onEnd);
    return () => {
      video.removeEventListener('webkitbeginfullscreen', onBegin);
      video.removeEventListener('webkitendfullscreen', onEnd);
    };
  }, [unlockOrientation]);

  // ── TV Remote & Keyboard Navigation ────────────────────────
  useEffect(() => {
    const handleRemoteKey = (e) => {
      // Don't intercept when user is typing in search input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return;
      }

      // Handle 'F' key to toggle fullscreen
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // In fullscreen mode:
      if (document.fullscreenElement || isFullscreen) {
        // Back / ESC button exits fullscreen mode
        if (isRemoteBackKey(e)) {
          e.preventDefault();
          e.stopPropagation();
          exitFullscreen();
          return;
        }

        // D-pad Up and Down control volume
        if (isDpadUp(e)) {
          e.preventDefault();
          adjustVolume(0.05);
          return;
        }
        if (isDpadDown(e)) {
          e.preventDefault();
          adjustVolume(-0.05);
          return;
        }

        if (isRemoteConfirmKey(e)) {
          e.preventDefault();
          if (!showControls) {
            triggerShowControls();
          } else {
            togglePlay();
          }
          return;
        }
      } else {
        // In non-fullscreen mode:
        // If focus is on the video player and user presses Enter or OK, open in fullscreen by default!
        if (isRemoteConfirmKey(e) && (document.activeElement === playerWrapperRef.current || document.activeElement === videoRef.current)) {
          e.preventDefault();
          enterFullscreen();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleRemoteKey);
    return () => window.removeEventListener('keydown', handleRemoteKey);
  }, [showControls, triggerShowControls, togglePlay, isFullscreen, adjustVolume, toggleFullscreen, exitFullscreen, enterFullscreen]);

  // ── Volume & Mute Controls ─────────────────────────────────
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (e) => {
    const video = videoRef.current;
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (video) {
      video.volume = newVol;
      video.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  };

  return (
    <div
      className={`livetv-player-wrapper ${!showControls && isPlaying ? 'hide-cursor' : ''}`}
      ref={playerWrapperRef}
      tabIndex={0}
      onDoubleClick={toggleFullscreen}
      onMouseMove={triggerShowControls}
      onMouseEnter={triggerShowControls}
      onTouchStart={triggerShowControls}
      onClick={(e) => {
        if (e.target === videoRef.current || e.target === playerWrapperRef.current) {
          if (!showControls) {
            triggerShowControls();
          } else {
            togglePlay();
          }
        }
      }}
    >
      <video
        ref={videoRef}
        className="livetv-video-element"
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onCanPlay={handlePlaying}
        onTimeUpdate={() => {
          if (videoRef.current && videoRef.current.currentTime > 0) {
            setIsLoading(false);
          }
        }}
      />

      {/* Visible small circle loading spinner only - does NOT block or dim the stream */}
      {isLoading && !hasError && (
        <div className="livetv-player-loading-circle">
          <div className="livetv-small-spinner" />
        </div>
      )}

      {/* Stream Error State */}
      {hasError && (
        <div className="livetv-player-error">
          <AlertTriangle size={36} color="#ff5555" style={{ marginBottom: 12 }} />
          <div className="livetv-error-title">Stream Offline</div>
          <div className="livetv-error-desc">
            {errorMessage || 'This live feed is currently unavailable or geo-restricted.'}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="livetv-retry-btn"
              onClick={() => channel?.streamUrl && loadStream(channel.streamUrl)}
            >
              <RotateCcw size={14} style={{ display: 'inline', marginRight: 6 }} />
              Retry
            </button>
            {onNextChannel && (
              <button
                type="button"
                className="livetv-retry-btn"
                style={{ background: '#262626', color: '#ffffff' }}
                onClick={onNextChannel}
              >
                Next Channel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen / Remote Volume HUD Toast */}
      {showVolumeToast && (
        <div className="livetv-volume-hud">
          {isMuted || volume === 0 ? (
            <VolumeX size={18} color="#ef4444" />
          ) : (
            <Volume2 size={18} color="#fdd835" />
          )}
          <div className="livetv-volume-hud-bar">
            <div
              className="livetv-volume-hud-fill"
              style={{ width: `${isMuted ? 0 : Math.round(volume * 100)}%` }}
            />
          </div>
          <span>{isMuted ? 'Muted' : `${Math.round(volume * 100)}%`}</span>
        </div>
      )}

      {/* Overlay Controls */}
      <div className={`livetv-player-overlay ${showControls ? 'is-visible' : ''}`}>
        {/* Top Bar inside Video: Clean without channel name */}
        <div className="livetv-overlay-top" style={{ justifyContent: 'flex-end' }}>
          <div className="livetv-badge">
            <span className="livetv-pulse-dot" />
            LIVE
          </div>
        </div>

        {/* Bottom Controls inside Video */}
        <div className="livetv-overlay-bottom">
          <div className="livetv-overlay-actions">
            {/* Play / Pause */}
            <button
              type="button"
              className="livetv-control-btn"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            {/* Mute / Unmute */}
            <button
              type="button"
              className="livetv-control-btn"
              onClick={(e) => {
                e.stopPropagation();
                triggerShowControls();
                toggleMute();
              }}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {/* Volume Slider */}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                triggerShowControls();
                handleVolumeChange(e);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 70,
                accentColor: 'var(--accent-yellow, #fdd835)',
                cursor: 'pointer'
              }}
              title="Volume"
            />
          </div>

          <div className="livetv-overlay-actions">
            {/* Fullscreen */}
            <button
              type="button"
              className="livetv-control-btn"
              onClick={(e) => {
                e.stopPropagation();
                triggerShowControls();
                toggleFullscreen();
              }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default LivePlayer;
