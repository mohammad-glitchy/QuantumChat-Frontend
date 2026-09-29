import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart2, Check } from 'lucide-react';
import { secretboxOpen } from '../crypto/keys.js';
import { resolveGroupAttachment } from '../crypto/voiceCache.js';
import { isEmojiOnlyText, splitEmojis } from '../utils/emojis.js';
import { detectTextDirection } from '../utils/scriptDirection.js';
import AttachmentBubble from './AttachmentBubble.jsx';
import VoicePlayer from './VoicePlayer.jsx';
import LinkifiedText from './LinkifiedText.jsx';

function MentionText({ text }) {
  const parts = [];
  const re = /(@[a-zA-Z0-9_.-]{2,32})/g;
  let last = 0;
  let match;
  while ((match = re.exec(text || ''))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <span key={match.index} className="mention-chip">
        {match[1]}
      </span>
    );
    last = match.index + match[1].length;
  }
  if (last < (text || '').length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function mediaKindFromPayload(payload) {
  const mime = String(payload?.mimetype || '').toLowerCase();
  const name = String(payload?.filename || '').toLowerCase();
  if (
    mime.startsWith('audio/') ||
    /^voice-note/i.test(name) ||
    /\.(mp3|m4a|wav|aac|ogg|oga|opus|flac)$/i.test(name) ||
    (/\.webm$/i.test(name) && (/^voice-note/i.test(name) || mime.startsWith('audio/')))
  ) {
    return 'audio';
  }
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name)) {
    if (mime === 'image/svg+xml' || name.endsWith('.svg')) return 'file';
    return 'image';
  }
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(name)) return 'video';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'file';
}

function GroupFileCard({ payload, isMine }) {
  const [url, setUrl] = useState(null);
  const [status, setStatus] = useState('idle');
  const [mime, setMime] = useState(payload.mimetype || 'application/octet-stream');
  const kind = mediaKindFromPayload(payload);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    async function load() {
      if (!payload?.attachmentId || !payload.key || !payload.nonce) return;
      setStatus('loading');
      try {
        const { url: objectUrl } = await resolveGroupAttachment({
          attachmentId: payload.attachmentId,
          keyB64: payload.key,
          nonce: payload.nonce,
          mime: payload.mimetype || 'application/octet-stream',
          signal: abortController.signal,
          openFn: secretboxOpen,
        });
        if (cancelled) return;
        setMime(payload.mimetype || 'application/octet-stream');
        setUrl(objectUrl);
        setStatus('idle');
      } catch (err) {
        if (cancelled || err?.name === 'CanceledError' || err?.name === 'AbortError') return;
        setStatus('error');
      }
    }
    load();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [payload?.attachmentId, payload?.key, payload?.nonce, payload?.mimetype]);

  if (status === 'loading') {
    if (kind === 'audio') {
      return (
        <div className="voice-player-modern skeleton-voice-loading" aria-label="Loading voice note">
          <div className="voice-main-row">
            <div className="voice-play-btn skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
            <div className="voice-wave-bars" style={{ pointerEvents: 'none' }}>
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  className="voice-wave-bar skeleton"
                  style={{ height: `${20 + ((i * 7) % 65)}%` }}
                />
              ))}
            </div>
          </div>
          <div className="voice-meta-row">
            <div className="voice-meta-left">
              <span className="voice-time-label skeleton" style={{ width: 32, height: 11, borderRadius: 4 }} />
            </div>
          </div>
        </div>
      );
    }
    return <div className="skeleton attachment-preview-placeholder" />;
  }

  if (status === 'error' || !url) {
    return (
      <div className="attachment-chip">
        <span>{payload.filename || 'Encrypted file'}</span>
        <span className="attachment-note">can&apos;t decrypt</span>
      </div>
    );
  }

  if (kind === 'audio') {
    return <VoicePlayer url={url} isMine={isMine} />;
  }
  if (kind === 'image') {
    return <img className="attachment-preview" src={url} alt={payload.filename || 'Image'} />;
  }
  if (kind === 'video') {
    return <video className="attachment-video" src={url} controls playsInline />;
  }
  if (kind === 'pdf') {
    return (
      <iframe
        className="attachment-pdf"
        src={url}
        title={payload.filename || 'PDF'}
        sandbox="allow-same-origin"
      />
    );
  }

  return (
    <div className="attachment-chip">
      <span>{payload.filename || 'File'}</span>
      <a href={url} download={payload.filename || 'download'}>
        Download
      </a>
    </div>
  );
}

function ViewOnceGroupFileCard({ payload, isMine, mediaKind, onBurnViewOnce }) {
  const [unlocked, setUnlocked] = useState(false);
  const [url, setUrl] = useState(null);
  const [status, setStatus] = useState('idle');
  const [viewerOpen, setViewerOpen] = useState(false);
  const burnedRef = useRef(false);
  const kind = mediaKind || mediaKindFromPayload(payload);
  const label = kind === 'video' ? 'Video' : kind === 'audio' ? 'Voice note' : 'Photo';

  async function burn() {
    if (burnedRef.current || !onBurnViewOnce) return;
    burnedRef.current = true;
    try {
      await onBurnViewOnce();
    } catch {
      burnedRef.current = false;
    }
  }

  async function openOnce() {
    if (isMine || !payload?.attachmentId || !payload.key || !payload.nonce) return;
    setStatus('loading');
    try {
      const { url: objectUrl } = await resolveGroupAttachment({
        attachmentId: payload.attachmentId,
        keyB64: payload.key,
        nonce: payload.nonce,
        mime: payload.mimetype || 'application/octet-stream',
        openFn: secretboxOpen,
      });
      setUrl(objectUrl);
      setUnlocked(true);
      setStatus('idle');
      if (kind === 'image') setViewerOpen(true);
    } catch {
      setStatus('error');
    }
  }

  if (!unlocked) {
    if (isMine) {
      return (
        <div className="view-once-lock mine">
          <span className="view-once-lock-badge" aria-hidden="true">1</span>
          <span className="view-once-lock-body">
            <strong>View once {label.toLowerCase()}</strong>
            <span>Waiting to be opened · opens once</span>
          </span>
        </div>
      );
    }
    return (
      <button
        type="button"
        className="view-once-lock"
        onClick={openOnce}
        disabled={status === 'loading'}
      >
        <span className="view-once-lock-badge" aria-hidden="true">1</span>
        <span className="view-once-lock-body">
          <strong>Tap to view {label.toLowerCase()}</strong>
          <span>Opens once, then disappears</span>
        </span>
        {status === 'loading' ? <span className="view-once-lock-status">Opening…</span> : null}
        {status === 'error' ? <span className="view-once-lock-status error">Failed — retry</span> : null}
      </button>
    );
  }

  if (!url) return null;

  if (kind === 'audio') {
    return <VoicePlayer url={url} autoPlay onPlayedThrough={burn} />;
  }

  if (kind === 'video') {
    return (
      <div className="attachment-media view-once-media">
        <video
          className="attachment-video"
          src={url}
          controls
          playsInline
          autoPlay
          preload="metadata"
          onEnded={burn}
        />
        <button type="button" className="view-once-done-btn" onClick={burn}>
          Done · remove
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="attachment-media view-once-media">
        <img
          className="attachment-preview"
          src={url}
          alt="View once photo"
          onClick={() => setViewerOpen(true)}
          role="button"
        />
        <button type="button" className="view-once-done-btn" onClick={burn}>
          Done · remove
        </button>
      </div>
      {/* Portal to body: the message list/bubbles are transformed (motion),
          which would trap this position:fixed overlay inside the chat pane. */}
      {viewerOpen ? createPortal(
        <div
          className="lightbox-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setViewerOpen(false);
            burn();
          }}
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              setViewerOpen(false);
              burn();
            }}
            aria-label="Close"
          >
            ✕
          </button>
          <img
            src={url}
            alt="View once photo"
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body,
      ) : null}
    </>
  );
}

export default function GroupMessageContent({
  message,
  payload,
  currentUserId,
  onVotePoll,
  resolveSecretKey,
  attachment,
  isMine,
  onImagePreview,
  onImageReady,
  onVideoPreview,
  onVideoReady,
  onBurnViewOnce,
}) {
  if (!payload || payload.type === 'text') {
    const body = payload?.body ?? message?.text ?? '';
    if (isEmojiOnlyText(body)) {
      const tokens = splitEmojis(body);
      const sizeClass =
        tokens.length === 1 ? ' is-single' : tokens.length <= 3 ? ' is-few' : ' is-many';
      return (
        <span
          className={`message-text message-text--emoji-only${sizeClass}`}
          aria-label={body}
        >
          {tokens.map((emoji, i) => (
            <span
              key={`${emoji}-${i}`}
              className="message-emoji-anim"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {emoji}
            </span>
          ))}
        </span>
      );
    }
    return (
      <div
        className={`message-text ${detectTextDirection(body) === 'rtl' ? 'is-rtl' : 'is-ltr'}`}
        dir={detectTextDirection(body)}
      >
        <LinkifiedText text={body} />
      </div>
    );
  }

  if (payload.type === 'announcement') {
    return (
      <div
        className="group-announcement"
        dir={detectTextDirection(payload.body)}
      >
        <span className="group-kind-badge">Announcement</span>
        <LinkifiedText text={payload.body || ''} />
      </div>
    );
  }

  if (payload.type === 'event') {
    return (
      <div
        className="group-event-card"
        dir={detectTextDirection(payload.title || payload.notes)}
      >
        <span className="group-kind-badge">Event</span>
        <strong>{payload.title || 'Event'}</strong>
        {payload.when && <div className="group-event-row">When: {new Date(payload.when).toLocaleString()}</div>}
        {payload.where && <div className="group-event-row">Where: {payload.where}</div>}
        {payload.notes && <div className="group-event-notes">{payload.notes}</div>}
      </div>
    );
  }

  if (payload.type === 'poll') {
    const votes = Array.isArray(message.pollVotes) ? message.pollVotes : [];
    const total = votes.length;
    const myVote = votes.find((v) => {
      const uId = v?.user?._id || v?.user?.id || v?.user;
      return String(uId) === String(currentUserId);
    });
    const options = Array.isArray(payload.options) ? payload.options : [];
    const pollDir = detectTextDirection(payload.question);
    const isRtl = pollDir === 'rtl';

    return (
      <div
        className={`group-poll-card ${isMine ? 'is-mine' : 'is-theirs'} ${isRtl ? 'is-rtl' : ''}`}
        dir={isRtl ? 'rtl' : undefined}
      >
        <div className="group-poll-header">
          <span className="group-poll-badge">
            <BarChart2 size={11} strokeWidth={2.5} className="group-poll-badge-icon" />
            POLL
          </span>
        </div>
        <h4 className="group-poll-question">{payload.question}</h4>
        <div className="group-poll-options">
          {options.map((opt, idx) => {
            const count = votes.filter((v) => Number(v.optionIndex) === idx).length;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const selected = myVote != null && Number(myVote.optionIndex) === idx;
            const optDir = detectTextDirection(opt);

            return (
              <button
                key={idx}
                type="button"
                className={`group-poll-option ${selected ? 'selected' : ''}`}
                onClick={() => onVotePoll?.(message.id || message._id, idx)}
                disabled={!onVotePoll}
                aria-pressed={selected}
              >
                <span
                  className="group-poll-fill"
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
                <div className="group-poll-option-inner">
                  <div className="group-poll-option-left">
                    <span
                      className={`group-poll-radio ${selected ? 'checked' : ''}`}
                      aria-hidden="true"
                    >
                      {selected && (
                        <Check size={11} strokeWidth={3.2} className="group-poll-radio-check" />
                      )}
                    </span>
                    <span className="group-poll-option-text" dir={optDir === 'rtl' ? 'rtl' : undefined}>
                      {opt}
                    </span>
                  </div>
                  <div className="group-poll-option-stats">
                    <span className="group-poll-pct">{pct}%</span>
                    <span className="group-poll-count">
                      {count} {count === 1 ? 'vote' : 'votes'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="group-poll-footer">
          <span className="group-poll-total">
            {total} {total === 1 ? 'vote' : 'votes'}
          </span>
          <span className="group-poll-status" aria-hidden="true">
            • {myVote ? 'Voted' : 'Select an option to vote'}
          </span>
        </div>
      </div>
    );
  }

  if (payload.type === 'file') {
    if (message.viewOnce && message.viewOnceOpenedAt) {
      return (
        <AttachmentBubble
          viewOnce
          viewOnceOpened
          viewOnceMediaKind={message.viewOnceMediaKind || mediaKindFromPayload(payload)}
        />
      );
    }
    if (message.viewOnce) {
      return (
        <ViewOnceGroupFileCard
          payload={payload}
          isMine={isMine}
          mediaKind={message.viewOnceMediaKind}
          onBurnViewOnce={onBurnViewOnce}
        />
      );
    }
    return <GroupFileCard payload={payload} isMine={isMine} />;
  }

  if (attachment) {
    return (
      <AttachmentBubble
        attachment={attachment}
        isMine={isMine}
        resolveSecretKey={resolveSecretKey}
        onImagePreview={onImagePreview}
        onImageReady={onImageReady}
        onVideoPreview={onVideoPreview}
        onVideoReady={onVideoReady}
        viewOnce={Boolean(message.viewOnce)}
        viewOnceOpened={Boolean(message.viewOnceOpenedAt)}
        viewOnceMediaKind={message.viewOnceMediaKind}
        onBurnViewOnce={onBurnViewOnce}
      />
    );
  }

  return <LinkifiedText text={message?.text || ''} />;
}
