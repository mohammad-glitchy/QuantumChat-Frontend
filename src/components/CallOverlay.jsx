import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  PictureInPicture2,
  ScreenShare,
  ScreenShareOff,
  UserPlus,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';

function attachStream(el, stream, { muted = false } = {}) {
  if (!el) return;
  el.muted = muted;
  if (el.srcObject !== stream) {
    el.srcObject = stream || null;
  }
  if (stream) {
    const playAttempt = el.play();
    if (playAttempt?.catch) playAttempt.catch(() => {});
  }
}

const VideoTile = forwardRef(function VideoTile(
  { stream, muted = false, mirror = false, contain = false, label },
  ref,
) {
  const localRef = useRef(null);
  const setRefs = useCallback(
    (node) => {
      localRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  useEffect(() => {
    attachStream(localRef.current, stream, { muted });
  }, [stream, muted]);

  return (
    <div
      className={`call-video-tile${mirror ? ' mirror' : ''}${contain ? ' is-contain' : ''}`}
    >
      <video ref={setRefs} autoPlay playsInline muted={muted} />
      {label ? <span className="call-video-label">{label}</span> : null}
    </div>
  );
});

/** Always-mounted remote audio sink so late-arriving tracks still play. */
function RemoteAudio({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    attachStream(ref.current, stream, { muted: false });
  }, [stream]);

  useEffect(() => {
    if (!stream) return undefined;
    const onLive = () => attachStream(ref.current, stream, { muted: false });
    const tracks = stream.getAudioTracks();
    for (const track of tracks) {
      track.addEventListener('unmute', onLive);
      track.addEventListener('mute', onLive);
    }
    stream.addEventListener?.('addtrack', onLive);
    stream.addEventListener?.('removetrack', onLive);
    const raf = requestAnimationFrame(onLive);
    return () => {
      cancelAnimationFrame(raf);
      for (const track of tracks) {
        track.removeEventListener('unmute', onLive);
        track.removeEventListener('mute', onLive);
      }
      stream.removeEventListener?.('addtrack', onLive);
      stream.removeEventListener?.('removetrack', onLive);
    };
  }, [stream]);

  return <audio ref={ref} autoPlay playsInline style={{ display: 'none' }} />;
}

function supportsDocumentPip() {
  return typeof window !== 'undefined' && Boolean(window.documentPictureInPicture?.requestWindow);
}

function supportsVideoPip() {
  return (
    typeof document !== 'undefined' &&
    document.pictureInPictureEnabled &&
    typeof HTMLVideoElement !== 'undefined' &&
    HTMLVideoElement.prototype.requestPictureInPicture
  );
}

/** Format elapsed call time as M:SS or H:MM:SS. */
function formatCallDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(mins)}:${pad(secs)}`;
  return `${mins}:${pad(secs)}`;
}

function injectPipStyles(doc) {
  const style = doc.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: #0a2a1e;
      color: #f8e7c9;
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      overflow: hidden;
    }
    .pip-root {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #0a2a1e;
    }
    .pip-video {
      flex: 1;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
    .pip-video.is-cover { object-fit: cover; }
    .pip-bar {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      background: linear-gradient(transparent, rgba(0,0,0,0.75));
    }
    .pip-meta {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .pip-meta strong {
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pip-meta span {
      font-size: 10px;
      opacity: 0.8;
    }
    .pip-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }
    .pip-btn {
      min-width: 44px;
      height: 30px;
      padding: 0 10px;
      border: none;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: rgba(255,255,255,0.16);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
    }
    .pip-btn:hover { background: rgba(255,255,255,0.28); }
    .pip-btn.active { background: rgba(255,255,255,0.35); }
    .pip-btn.hangup { background: #c62828; }
    .pip-avatar {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 42px;
      font-weight: 700;
      letter-spacing: 0.04em;
      background: radial-gradient(circle at 30% 20%, #12402f, #0a2a1e 70%);
    }
  `;
  doc.head.appendChild(style);
}

export default function CallOverlay({
  call,
  localStream,
  remoteStream,
  screenStream,
  screenSharing = false,
  remoteScreen = false,
  muted,
  cameraOff,
  peerLabel,
  minimized = false,
  onToggleMinimize,
  onAccept,
  onReject,
  onHangup,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onOpenAddParticipant,
}) {
  const remoteVideoRef = useRef(null);
  const pipWindowRef = useRef(null);
  const pipVideoRef = useRef(null);
  const [pipActive, setPipActive] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [speakerActive, setSpeakerActive] = useState(false);
  const autoPipAttemptedRef = useRef(false);

  const supportsSpeaker =
    typeof HTMLMediaElement !== 'undefined' &&
    typeof HTMLMediaElement.prototype.setSinkId === 'function';

  const toggleSpeaker = useCallback(async () => {
    if (!supportsSpeaker) return;
    try {
      const devices = await navigator.mediaDevices?.enumerateDevices?.();
      const audioOutputs = (devices || []).filter((d) => d.kind === 'audiooutput');
      const targetDevice = speakerActive
        ? ''
        : (audioOutputs.find((d) => d.deviceId !== 'default' && d.deviceId !== '')?.deviceId || '');

      const mediaElements = document.querySelectorAll('audio, video');
      for (const el of mediaElements) {
        if (typeof el.setSinkId === 'function') {
          await el.setSinkId(targetDevice).catch(() => {});
        }
      }
      setSpeakerActive(!speakerActive);
    } catch {
      /* ignore sink errors */
    }
  }, [speakerActive, supportsSpeaker]);

  const name = peerLabel || call?.peerName || 'User';
  const isIncoming = call?.status === 'incoming';
  const isRinging = call?.status === 'ringing';
  const isActive = call?.status === 'active';
  const inMedia = call?.status === 'connecting' || isActive;
  const showsRemoteVideo = inMedia && (call?.video || remoteScreen);
  const showsOwnScreenOnly = inMedia && screenSharing && !showsRemoteVideo;
  const showsVideo = showsRemoteVideo || showsOwnScreenOnly;
  const canShareScreen =
    typeof onToggleScreenShare === 'function' &&
    inMedia &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getDisplayMedia);
  const canUsePip = inMedia && (supportsDocumentPip() || supportsVideoPip() || Boolean(onToggleMinimize));

  // Live call timer once the peer has answered / media is active.
  useEffect(() => {
    const canTime =
      call &&
      (call.status === 'active' || call.status === 'connecting') &&
      (call.startedAt || call.status === 'active');
    if (!canTime) {
      setElapsedSec(0);
      return undefined;
    }
    const anchor = call.startedAt || Date.now();
    const tick = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - anchor) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [call?.startedAt, call?.status, call]);

  const durationLabel = formatCallDuration(elapsedSec);
  const showDuration =
    isActive || (Boolean(call?.startedAt) && call?.status === 'connecting');
  const activeStatusLabel = (() => {
    if (pipActive) return 'Picture-in-picture';
    if (screenSharing) return 'Sharing screen';
    if (remoteScreen) return `${name} is sharing`;
    if (showDuration) return durationLabel;
    if (call?.status === 'connecting') return 'Connecting…';
    return call?.video ? 'Video call' : 'Voice call';
  })();

  const closeDocumentPip = useCallback(() => {
    const win = pipWindowRef.current;
    pipWindowRef.current = null;
    pipVideoRef.current = null;
    if (win && !win.closed) {
      try {
        win.close();
      } catch {
        // ignore
      }
    }
    setPipActive(false);
  }, []);

  const renderDocumentPip = useCallback(
    (pipWin) => {
      const doc = pipWin.document;
      doc.body.innerHTML = '';
      injectPipStyles(doc);

      const root = doc.createElement('div');
      root.className = 'pip-root';

      const hasRemoteVideo = Boolean(remoteStream?.getVideoTracks?.().some((t) => t.readyState === 'live'));
      let videoEl = null;
      if (hasRemoteVideo) {
        videoEl = doc.createElement('video');
        videoEl.className = `pip-video${remoteScreen ? '' : ' is-cover'}`;
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.muted = true;
        attachStream(videoEl, remoteStream, { muted: true });
        pipVideoRef.current = videoEl;
        root.appendChild(videoEl);
      } else {
        const avatar = doc.createElement('div');
        avatar.className = 'pip-avatar';
        avatar.textContent = (name || '?').slice(0, 2).toUpperCase();
        root.appendChild(avatar);
      }

      const bar = doc.createElement('div');
      bar.className = 'pip-bar';

      const meta = doc.createElement('div');
      meta.className = 'pip-meta';
      const title = doc.createElement('strong');
      title.textContent = name;
      const status = doc.createElement('span');
      status.textContent = remoteScreen
        ? 'Sharing screen'
        : screenSharing
          ? 'You are sharing'
          : showDuration
            ? durationLabel
            : call?.video
              ? 'Video call'
              : 'Voice call';
      meta.append(title, status);

      const actions = doc.createElement('div');
      actions.className = 'pip-actions';

      const muteBtn = doc.createElement('button');
      muteBtn.type = 'button';
      muteBtn.className = `pip-btn${muted ? ' active' : ''}`;
      muteBtn.title = muted ? 'Unmute' : 'Mute';
      muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
      muteBtn.textContent = muted ? 'Unmute' : 'Mute';
      muteBtn.onclick = () => onToggleMute?.();

      const hangupBtn = doc.createElement('button');
      hangupBtn.type = 'button';
      hangupBtn.className = 'pip-btn hangup';
      hangupBtn.title = 'End call';
      hangupBtn.setAttribute('aria-label', 'End call');
      hangupBtn.textContent = 'End';
      hangupBtn.onclick = () => {
        closeDocumentPip();
        onHangup?.();
      };

      const expandBtn = doc.createElement('button');
      expandBtn.type = 'button';
      expandBtn.className = 'pip-btn';
      expandBtn.title = 'Return to call';
      expandBtn.setAttribute('aria-label', 'Return to call');
      expandBtn.textContent = 'Back';
      expandBtn.onclick = () => {
        closeDocumentPip();
        onToggleMinimize?.(false);
      };

      actions.append(muteBtn, expandBtn, hangupBtn);
      bar.append(meta, actions);
      root.appendChild(bar);
      doc.body.appendChild(root);
    },
    [
      call?.startedAt,
      call?.status,
      call?.video,
      closeDocumentPip,
      durationLabel,
      muted,
      name,
      onHangup,
      onToggleMinimize,
      onToggleMute,
      remoteScreen,
      remoteStream,
      screenSharing,
      showDuration,
    ],
  );

  const enterDocumentPip = useCallback(async () => {
    if (!supportsDocumentPip()) return false;
    try {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        closeDocumentPip();
        return true;
      }
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: 380,
        height: 260,
      });
      pipWindowRef.current = pipWin;
      renderDocumentPip(pipWin);
      setPipActive(true);
      onToggleMinimize?.(true);
      pipWin.addEventListener('pagehide', () => {
        pipWindowRef.current = null;
        pipVideoRef.current = null;
        setPipActive(false);
      });
      return true;
    } catch {
      return false;
    }
  }, [closeDocumentPip, onToggleMinimize, renderDocumentPip]);

  const enterVideoPip = useCallback(async () => {
    if (!supportsVideoPip()) return false;
    const video = remoteVideoRef.current;
    if (!video || !video.srcObject) return false;
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
        setPipActive(false);
        return true;
      }
      await video.requestPictureInPicture();
      setPipActive(true);
      onToggleMinimize?.(true);
      return true;
    } catch {
      return false;
    }
  }, [onToggleMinimize]);

  const togglePictureInPicture = useCallback(async () => {
    if (pipActive && pipWindowRef.current && !pipWindowRef.current.closed) {
      closeDocumentPip();
      onToggleMinimize?.(false);
      return;
    }
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture().catch(() => {});
      setPipActive(false);
      onToggleMinimize?.(false);
      return;
    }
    const openedDoc = await enterDocumentPip();
    if (openedDoc) return;
    const openedVideo = await enterVideoPip();
    if (openedVideo) return;
    onToggleMinimize?.();
  }, [
    closeDocumentPip,
    enterDocumentPip,
    enterVideoPip,
    onToggleMinimize,
    pipActive,
  ]);

  // Keep Document PiP contents in sync when mute/stream/name change.
  useEffect(() => {
    const win = pipWindowRef.current;
    if (!win || win.closed) return;
    renderDocumentPip(win);
  }, [renderDocumentPip]);

  useEffect(() => {
    function onLeavePip() {
      setPipActive(false);
    }
    document.addEventListener('leavepictureinpicture', onLeavePip);
    return () => document.removeEventListener('leavepictureinpicture', onLeavePip);
  }, []);

  // Meet-like: when the user leaves the QuantumChat tab mid-call, pop into PiP.
  useEffect(() => {
    if (!inMedia) {
      autoPipAttemptedRef.current = false;
      return undefined;
    }
    function onVisibility() {
      if (document.visibilityState !== 'hidden') return;
      if (autoPipAttemptedRef.current) return;
      if (pipWindowRef.current && !pipWindowRef.current.closed) return;
      if (document.pictureInPictureElement) return;
      autoPipAttemptedRef.current = true;
      enterDocumentPip().then((ok) => {
        if (!ok) enterVideoPip();
      });
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enterDocumentPip, enterVideoPip, inMedia]);

  // Tear down floating PiP when the call ends.
  useEffect(() => {
    if (call) return undefined;
    closeDocumentPip();
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    setPipActive(false);
    return undefined;
  }, [call, closeDocumentPip]);

  if (!call) return null;

  return (
    <div
      className={`call-overlay${minimized || pipActive ? ' is-minimized' : ''}${pipActive ? ' is-pip' : ''}`}
      role="dialog"
      aria-modal={!minimized && !pipActive}
      aria-label="Call"
    >
      <div className={`call-stage${showsVideo ? ' has-video' : ''}`}>
        <div className="call-mini-banner">
          <div>
            <strong>{name}</strong>
            <div className="call-status-text">
              {isIncoming
                ? 'Incoming…'
                : isRinging
                  ? 'Calling…'
                  : activeStatusLabel}
            </div>
          </div>
          <button
            type="button"
            className="call-ctrl"
            onClick={() => {
              if (pipActive) {
                closeDocumentPip();
                if (document.pictureInPictureElement) {
                  document.exitPictureInPicture().catch(() => {});
                }
                setPipActive(false);
              }
              onToggleMinimize?.(false);
            }}
            aria-label="Expand call"
          >
            <Phone size={18} />
          </button>
        </div>

        {showsVideo ? (
          <>
            {showsRemoteVideo ? (
              <VideoTile
                ref={remoteVideoRef}
                stream={remoteStream}
                contain={remoteScreen}
                label={remoteScreen ? `${name}'s screen` : name}
                muted
              />
            ) : (
              <VideoTile stream={screenStream} muted contain label="Your screen" />
            )}
            {showsRemoteVideo && (call.video || screenSharing) ? (
              <div className="call-pip">
                {screenSharing ? (
                  <VideoTile stream={screenStream} muted contain label="Your screen" />
                ) : (
                  <VideoTile stream={localStream} muted mirror label="You" />
                )}
              </div>
            ) : null}
          </>
        ) : (
          <div className="call-audio-hero">
            <div className="call-avatar-ring" aria-hidden="true">
              {(name || '?').slice(0, 2).toUpperCase()}
            </div>
            <h2>{name}</h2>
            <p className="call-status-text">
              {isIncoming
                ? call.video
                  ? 'Incoming video call'
                  : 'Incoming voice call'
                : isRinging
                  ? 'Calling…'
                  : call.status === 'connecting' && !showDuration
                    ? 'Connecting…'
                    : activeStatusLabel}
            </p>
          </div>
        )}

        {inMedia ? <RemoteAudio stream={remoteStream} /> : null}

        <div className="call-controls">
          {isIncoming ? (
            <>
              <button type="button" className="call-ctrl accept" onClick={onAccept} aria-label="Accept call">
                <Phone size={22} />
              </button>
              <button type="button" className="call-ctrl hangup" onClick={onReject} aria-label="Reject call">
                <PhoneOff size={22} />
              </button>
            </>
          ) : (
            <>
              {typeof onToggleMinimize === 'function' ? (
                <button
                  type="button"
                  className="call-ctrl"
                  onClick={() => onToggleMinimize()}
                  aria-label={minimized ? 'Expand call' : 'Minimize call'}
                  title={minimized ? 'Expand call' : 'Minimize call'}
                >
                  <Phone size={18} />
                </button>
              ) : null}
              {canUsePip ? (
                <button
                  type="button"
                  className={`call-ctrl${pipActive ? ' active' : ''}`}
                  onClick={() => {
                    togglePictureInPicture().catch(() => {});
                  }}
                  aria-label={pipActive ? 'Exit picture-in-picture' : 'Picture-in-picture'}
                  title={pipActive ? 'Exit picture-in-picture' : 'Picture-in-picture'}
                >
                  {pipActive ? <X size={18} /> : <PictureInPicture2 size={18} />}
                </button>
              ) : null}
              <button
                type="button"
                className={`call-ctrl${muted ? ' active' : ''}`}
                onClick={onToggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                title={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button
                type="button"
                className={`call-ctrl${cameraOff ? ' active' : ''}`}
                onClick={onToggleCamera}
                aria-label={cameraOff ? 'Camera on' : 'Camera off'}
                title={cameraOff ? 'Camera on' : 'Camera off'}
              >
                {cameraOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
              {supportsSpeaker ? (
                <button
                  type="button"
                  className={`call-ctrl${speakerActive ? ' active' : ''}`}
                  onClick={toggleSpeaker}
                  aria-label={speakerActive ? 'Earpiece' : 'Speaker'}
                  title={speakerActive ? 'Earpiece' : 'Speaker'}
                >
                  {speakerActive ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
              ) : null}
              {canShareScreen ? (
                <button
                  type="button"
                  className={`call-ctrl${screenSharing ? ' active' : ''}`}
                  onClick={onToggleScreenShare}
                  aria-label={screenSharing ? 'Stop sharing screen' : 'Share screen'}
                  title={screenSharing ? 'Stop sharing screen' : 'Share screen'}
                >
                  {screenSharing ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
                </button>
              ) : null}
              {typeof onOpenAddParticipant === 'function' ? (
                <button
                  type="button"
                  className="call-ctrl"
                  onClick={onOpenAddParticipant}
                  aria-label="Add participant"
                  title="Add participant"
                >
                  <UserPlus size={20} />
                </button>
              ) : null}
              <button type="button" className="call-ctrl hangup" onClick={onHangup} aria-label="End call">
                <PhoneOff size={22} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
