import { useEffect, useMemo, useRef, useState } from 'react';
import { File as FileIcon, Lock, Play, X } from 'lucide-react';
import { pickAttachmentEnvelope, resolveSealedAttachment, attachmentIdOf } from '../../crypto/voiceCache.js';

function classify(mimetype) {
  const mime = String(mimetype || '');
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'image', label: 'Photos' },
  { key: 'video', label: 'Videos' },
  { key: 'file', label: 'Files' },
];

function useInView(ref) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect(); // only need to trigger once
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}

/** Decrypts and shows a real thumbnail once scrolled into view. Caches the
 * result into the shared src map so the lightbox/video player reuse it
 * instead of decrypting twice. */
function MediaThumb({ item, cachedEntry, resolveSecretKey, onReady, onClick }) {
  const thumbRef = useRef(null);
  const inView = useInView(thumbRef);
  const [url, setUrl] = useState(cachedEntry?.src || null);
  const [status, setStatus] = useState(cachedEntry?.src ? 'ready' : 'idle');

  useEffect(() => {
    if (url || !inView || item.isViewOnce) return;
    const opened = pickAttachmentEnvelope(item.attachment, resolveSecretKey);
    if (!opened) {
      setStatus('error');
      return;
    }
    let cancelled = false;
    const abortController = new AbortController();

    (async () => {
      setStatus('loading');
      try {
        const mime = item.attachment.mimetype || (item.kind === 'video' ? 'video/mp4' : 'image/jpeg');
        const { url: objectUrl } = await resolveSealedAttachment({
          attachmentId: item.id,
          envelope: opened.envelope,
          secretKey: opened.secretKey,
          mime,
          signal: abortController.signal,
        });
        if (cancelled) return;
        setUrl(objectUrl);
        setStatus('ready');
        onReady?.(item.id, objectUrl, item.attachment.filename);
      } catch (err) {
        if (cancelled || err?.name === 'CanceledError' || err?.name === 'AbortError') return;
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
      // Don't revoke — session cache / src map own this URL.
    };
  }, [inView, url, item, resolveSecretKey, onReady]);

  if (item.isViewOnce) {
    return (
      <div
        ref={thumbRef}
        className="chat-media-thumb"
        style={thumbStyle}
        title="View once — opens from the chat"
      >
        <Lock size={20} strokeWidth={2} />
        <span style={labelStyle}>{item.attachment.filename || 'View once'}</span>
      </div>
    );
  }

  if (item.kind === 'image') {
    return (
      <button
        ref={thumbRef}
        type="button"
        className="chat-media-thumb"
        onClick={() => url && onClick?.(item.id)}
        disabled={!url}
        aria-label="Open image"
        style={{ padding: 0, border: 'none', cursor: url ? 'pointer' : 'default' }}
      >
        {url ? (
          <img src={url} alt={item.attachment.filename || 'Shared image'} loading="lazy" style={imgStyle} />
        ) : (
          <div style={{ ...thumbStyle, opacity: status === 'error' ? 0.5 : 0.7 }}>
            {status === 'error' ? <FileIcon size={20} /> : <span className="skeleton" style={{ width: '100%', height: '100%', display: 'block' }} />}
          </div>
        )}
      </button>
    );
  }

  if (item.kind === 'video') {
    return (
      <button
        ref={thumbRef}
        type="button"
        className="chat-media-thumb"
        onClick={() => url && onClick?.(item.id)}
        disabled={!url}
        aria-label={`Play video ${item.attachment.filename || ''}`}
        style={{ padding: 0, border: 'none', cursor: url ? 'pointer' : 'default', position: 'relative' }}
      >
        {url ? (
          <>
            <video src={url} muted playsInline preload="metadata" style={imgStyle} />
            <Play size={22} strokeWidth={2} style={playOverlayStyle} />
          </>
        ) : (
          <div style={{ ...thumbStyle, opacity: status === 'error' ? 0.5 : 0.7 }}>
            {status === 'error' ? <FileIcon size={20} /> : <span className="skeleton" style={{ width: '100%', height: '100%', display: 'block' }} />}
          </div>
        )}
      </button>
    );
  }

  return (
    <div ref={thumbRef} className="chat-media-file-chip">
      <FileIcon size={16} strokeWidth={2} />
      <span>{item.attachment.filename || 'File'}</span>
    </div>
  );
}

const thumbStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  width: '100%',
  height: '100%',
  background: 'var(--surface-2, #1a1a1a)',
  color: 'var(--text-secondary, #ccc)',
  padding: 8,
  textAlign: 'center',
};
const labelStyle = { fontSize: 11, wordBreak: 'break-all', lineHeight: 1.3 };
const imgStyle = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const playOverlayStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  color: '#fff',
  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))',
  pointerEvents: 'none',
};

export default function ChatMediaModal({
  messages,
  imageSrcMap,
  videoSrcMap,
  resolveSecretKey,
  onImageReady,
  onVideoReady,
  onImageClick,
  onVideoClick,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('all');

  const mediaItems = useMemo(() => {
    return messages
      .filter((m) => m.attachment && attachmentIdOf(m.attachment))
      .map((m) => ({
        id: attachmentIdOf(m.attachment),
        attachment: m.attachment,
        kind: classify(m.attachment?.mimetype),
        isViewOnce: Boolean(m.viewOnce) && !m.viewOnceOpenedAt,
      }))
      .reverse();
  }, [messages]);

  const counts = useMemo(() => {
    const c = { image: 0, video: 0, file: 0 };
    for (const item of mediaItems) c[item.kind] += 1;
    return c;
  }, [mediaItems]);

  const visibleItems = useMemo(
    () => (activeTab === 'all' ? mediaItems : mediaItems.filter((item) => item.kind === activeTab)),
    [mediaItems, activeTab],
  );

  return (
    <div className="create-group-overlay" role="presentation" onClick={onClose}>
      <div
        className="create-group-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-media-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="create-group-modal-header">
          <div className="create-group-modal-heading">
            <h2 id="chat-media-title">Chat media</h2>
            <p>{mediaItems.length} shared file{mediaItems.length === 1 ? '' : 's'}</p>
          </div>
          <button type="button" className="create-group-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Media type"
          style={{ display: 'flex', gap: 6, padding: '0 4px 12px', flexWrap: 'wrap' }}
        >
          {TABS.map((tab) => {
            const count = tab.key === 'all' ? mediaItems.length : counts[tab.key];
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                disabled={tab.key !== 'all' && count === 0}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid var(--border-color, rgba(0,0,0,0.12))',
                  background: active ? 'var(--accent, #7c3aed)' : 'transparent',
                  color: active ? '#fff' : 'inherit',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: tab.key !== 'all' && count === 0 ? 'not-allowed' : 'pointer',
                  opacity: tab.key !== 'all' && count === 0 ? 0.45 : 1,
                }}
              >
                {tab.label}
                {tab.key !== 'all' ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>

        {visibleItems.length === 0 ? (
          <p className="empty-hint">
            {mediaItems.length === 0 ? 'No media shared in this chat yet.' : 'Nothing in this tab yet.'}
          </p>
        ) : (
          <div className="chat-media-grid">
            {visibleItems.map((item) => {
              if (item.kind === 'file') {
                return (
                  <div key={item.id} className="chat-media-file-chip">
                    <FileIcon size={16} strokeWidth={2} />
                    <span>{item.attachment.filename || 'File'}</span>
                  </div>
                );
              }
              const map = item.kind === 'image' ? imageSrcMap : videoSrcMap;
              return (
                <MediaThumb
                  key={item.id}
                  item={item}
                  cachedEntry={map?.get(String(item.id))}
                  resolveSecretKey={resolveSecretKey}
                  onReady={item.kind === 'image' ? onImageReady : onVideoReady}
                  onClick={item.kind === 'image' ? onImageClick : onVideoClick}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}