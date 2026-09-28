import { Bookmark, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  deleteHighlight,
  deleteHighlightItem,
  fetchHighlightCoverBlob,
  fetchHighlightItemMediaBlob,
  getHighlight,
  listHighlights,
} from '../api/highlights.js';
import { useAuth } from '../context/AuthContext.jsx';

const coverCache = new Map();

function HighlightRing({ highlight, onClick }) {
  const [coverUrl, setCoverUrl] = useState(null);
  const empty = !highlight.itemCount;

  useEffect(() => {
    let revoked = false;
    let objectUrl;
    if (!highlight.hasCover) {
      setCoverUrl(null);
      return undefined;
    }
    const cached = coverCache.get(highlight.id);
    if (cached) {
      setCoverUrl(cached);
      return undefined;
    }
    fetchHighlightCoverBlob(highlight.id)
      .then((blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        coverCache.set(highlight.id, objectUrl);
        setCoverUrl(objectUrl);
      })
      .catch(() => {
        if (!revoked) setCoverUrl(null);
      });
    return () => {
      revoked = true;
    };
  }, [highlight.id, highlight.hasCover]);

  return (
    <button
      type="button"
      className={`hl-ring${empty ? ' empty' : ''}${!empty ? ' has-items' : ''}`}
      onClick={onClick}
      disabled={empty}
      aria-label={`${highlight.name} highlight`}
    >
      <span className="hl-ring-orb">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="hl-ring-cover" />
        ) : (
          <span className="hl-ring-emoji" aria-hidden>
            {(highlight.name || '?').trim().charAt(0).toUpperCase() || '★'}
          </span>
        )}
      </span>
      <span className="hl-ring-label">{highlight.name}</span>
      {highlight.itemCount > 0 ? <span className="hl-ring-count">{highlight.itemCount}</span> : null}
    </button>
  );
}

function HighlightViewer({ highlightId, isOwner, onClose, onChanged, onError }) {
  const [highlight, setHighlight] = useState(null);
  const [index, setIndex] = useState(0);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getHighlight(highlightId)
      .then((data) => {
        if (!cancelled) {
          setHighlight(data);
          setIndex(0);
        }
      })
      .catch((err) => {
        onError?.(err.response?.data?.error || err.message || 'Could not open highlight');
        onClose?.();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [highlightId]);

  const item = highlight?.items?.[index];

  useEffect(() => {
    let cancelled = false;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setMediaUrl(null);
    if (!highlight?.id || !item?.id) return undefined;

    fetchHighlightItemMediaBlob(highlight.id, item.id)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setMediaUrl(url);
      })
      .catch(() => {
        if (!cancelled) setMediaUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [highlight?.id, item?.id]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min((highlight?.items?.length || 1) - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [highlight?.items?.length, onClose]);

  async function removeItem() {
    if (!highlight || !item || busy) return;
    setBusy(true);
    try {
      const updated = await deleteHighlightItem(highlight.id, item.id);
      onChanged?.();
      if (!updated.itemCount) {
        onClose?.();
        return;
      }
      setHighlight(updated);
      setIndex((i) => Math.min(i, updated.itemCount - 1));
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Could not remove');
    } finally {
      setBusy(false);
    }
  }

  async function removeHighlight() {
    if (!highlight || busy) return;
    setBusy(true);
    try {
      await deleteHighlight(highlight.id);
      coverCache.delete(highlight.id);
      onChanged?.();
      onClose?.();
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Could not delete highlight');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="hl-viewer-overlay" onClick={onClose}>
      <div className="hl-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="hl-viewer-top">
          <div className="hl-viewer-title">
            <span className="hl-viewer-emoji" aria-hidden>
              {(highlight?.name || '?').trim().charAt(0).toUpperCase() || '★'}
            </span>
            <div>
              <strong>{highlight?.name || 'Highlight'}</strong>
              <span>
                {loading ? 'Loading…' : `${(index || 0) + 1} / ${highlight?.items?.length || 0}`}
              </span>
            </div>
          </div>
          <button type="button" className="hl-viewer-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="hl-viewer-progress">
          {(highlight?.items || []).map((it, i) => (
            <span key={it.id} className={i === index ? 'on' : i < index ? 'done' : ''} />
          ))}
        </div>

        <div className="hl-viewer-media">
          {!mediaUrl && !loading && <p className="empty-hint">Could not load media</p>}
          {!mediaUrl && loading && <p className="empty-hint">Loading…</p>}
          {mediaUrl && item?.mediaType === 'image' && <img src={mediaUrl} alt="" />}
          {mediaUrl && item?.mediaType === 'video' && <video src={mediaUrl} controls autoPlay />}
          {mediaUrl && item?.mediaType === 'audio' && <audio src={mediaUrl} controls autoPlay />}
        </div>

        <div className="hl-viewer-nav">
          <button type="button" disabled={index <= 0} onClick={() => setIndex((i) => i - 1)} aria-label="Previous">
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            disabled={!highlight?.items || index >= highlight.items.length - 1}
            onClick={() => setIndex((i) => i + 1)}
            aria-label="Next"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {isOwner && (
          <div className="hl-viewer-owner-actions">
            <button type="button" disabled={busy || !item} onClick={removeItem}>
              <Trash2 size={15} /> Remove item
            </button>
            <button type="button" className="danger" disabled={busy} onClick={removeHighlight}>
              Delete highlight
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/**
 * Profile highlights rail — Instagram-style circles under the avatar.
 * The server already limits empty (itemCount: 0) highlights to their
 * owner, so no client-side ownership filtering of the list is needed.
 */
export default function ProfileHighlights({ userId, onError }) {
  const { user } = useAuth();
  const isOwner = String(user?.id) === String(userId);
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    try {
      const list = await listHighlights(userId);
      setHighlights(list);
    } catch (err) {
      setHighlights([]);
      onError?.(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!loading && highlights.length === 0) return null;

  return (
    <section className="hl-profile-section" aria-label="Story highlights">
      <div className="hl-profile-heading">
        <Bookmark size={15} aria-hidden />
        <h3>Highlights</h3>
      </div>
      <div className="hl-rail">
        {loading
          ? [1, 2, 3].map((i) => (
              <div key={i} className="hl-ring skeleton-ring" aria-hidden>
                <span className="hl-ring-orb skeleton" />
                <span className="hl-ring-label skeleton skeleton-line" />
              </div>
            ))
          : highlights.map((h) => (
              <HighlightRing key={h.id} highlight={h} onClick={() => h.itemCount && setActiveId(h.id)} />
            ))}
      </div>
      {isOwner && !loading && (
        <p className="hl-profile-hint">Save stories from My status → Save to highlight</p>
      )}
      {activeId && (
        <HighlightViewer
          highlightId={activeId}
          isOwner={isOwner}
          onClose={() => setActiveId(null)}
          onChanged={load}
          onError={onError}
        />
      )}
    </section>
  );
}