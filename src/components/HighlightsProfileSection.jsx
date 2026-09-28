import { BookmarkPlus, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  deleteHighlight,
  deleteHighlightItem,
  fetchHighlightCoverBlob,
  fetchHighlightItemMediaBlob,
  listHighlights,
} from '../api/highlights.js';

function HighlightRingThumb({ highlight }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    if (highlight.hasCover) {
      fetchHighlightCoverBlob(highlight.id)
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [highlight.id, highlight.hasCover]);

  return (
    <span className="hl-ring-orb" aria-hidden>
      {url ? (
        <img className="hl-ring-cover" src={url} alt="" />
      ) : (
        <span className="hl-ring-emoji">
          {(highlight.name || '?').trim().charAt(0).toUpperCase() || '★'}
        </span>
      )}
    </span>
  );
}

function HighlightViewer({ highlight, isOwner, onClose, onDeleted, onError }) {
  const [index, setIndex] = useState(0);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const item = highlight.items[index];

  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    setMediaUrl(null);
    setLoading(true);
    fetchHighlightItemMediaBlob(highlight.id, item.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setMediaUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) onError?.('Could not load this highlight item');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [highlight.id, item.id]);

  function goNext() {
    if (index < highlight.items.length - 1) setIndex((i) => i + 1);
    else onClose();
  }
  function goPrev() {
    if (index > 0) setIndex((i) => i - 1);
  }

  async function removeItem() {
    if (busy) return;
    setBusy(true);
    try {
      await deleteHighlightItem(highlight.id, item.id);
      if (highlight.items.length <= 1) {
        onDeleted?.();
        onClose();
        return;
      }
      onDeleted?.();
      if (index >= highlight.items.length - 1) setIndex((i) => Math.max(0, i - 1));
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Could not remove item');
    } finally {
      setBusy(false);
    }
  }

  async function removeHighlight() {
    if (busy) return;
    setBusy(true);
    try {
      await deleteHighlight(highlight.id);
      onDeleted?.();
      onClose();
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Could not delete highlight');
      setBusy(false);
    }
  }

  return createPortal(
    <div className="hl-viewer-overlay" onClick={onClose}>
      <div className="hl-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="hl-viewer-top">
          <div className="hl-viewer-title">
            <span className="hl-viewer-emoji" aria-hidden>
              <BookmarkPlus size={22} />
            </span>
            <div>
              <strong>{highlight.name}</strong>
              <span>{highlight.items.length} saved</span>
            </div>
          </div>
          <button type="button" className="hl-viewer-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="hl-viewer-progress">
          {highlight.items.map((it, i) => (
            <span key={it.id} className={i < index ? 'done' : i === index ? 'on' : ''} />
          ))}
        </div>

        <div className="hl-viewer-media">
          {loading && <p className="empty-hint">Loading…</p>}
          {!loading && mediaUrl && item.mediaType === 'image' && <img src={mediaUrl} alt="" />}
          {!loading && mediaUrl && item.mediaType === 'video' && <video src={mediaUrl} autoPlay controls />}
          {!loading && mediaUrl && item.mediaType === 'audio' && <audio src={mediaUrl} autoPlay controls />}
        </div>

        <div className="hl-viewer-nav">
          <button type="button" onClick={goPrev} disabled={index === 0} aria-label="Previous">
            <ChevronLeft size={20} />
          </button>
          <button type="button" onClick={goNext} aria-label="Next">
            <ChevronRight size={20} />
          </button>
        </div>

        {isOwner && (
          <div className="hl-viewer-owner-actions">
            <button type="button" disabled={busy} onClick={removeItem}>
              <Trash2 size={14} aria-hidden />
              Remove this item
            </button>
            <button type="button" className="danger" disabled={busy} onClick={removeHighlight}>
              <Trash2 size={14} aria-hidden />
              Delete highlight
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function HighlightsProfileSection({ userId, isOwner = false, onError }) {
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openIndex, setOpenIndex] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const list = await listHighlights(userId);
      setHighlights(list);
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Failed to load highlights');
      setHighlights([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Nothing saved and it's not your own profile — don't show an empty rail to visitors.
  if (!loading && highlights.length === 0 && !isOwner) return null;

  return (
    <div className="hl-profile-section">
      <div className="hl-profile-heading">
        <h3>Highlights</h3>
      </div>

      {loading && (
        <div className="hl-rail">
          {[1, 2, 3].map((i) => (
            <div key={i} className="hl-ring skeleton-ring" aria-hidden="true">
              <span className="hl-ring-orb skeleton" />
              <span className="skeleton skeleton-line story-skeleton-label" />
            </div>
          ))}
        </div>
      )}

      {!loading && highlights.length === 0 && isOwner && (
        <p className="hl-profile-hint">
          Save a story to a highlight and it'll show up here on your profile.
        </p>
      )}

      {!loading && highlights.length > 0 && (
        <div className="hl-rail">
          {highlights.map((h, i) => (
            <button
              key={h.id}
              type="button"
              className={`hl-ring${h.itemCount > 0 ? ' has-items' : ''}`}
              disabled={h.itemCount === 0}
              onClick={() => setOpenIndex(i)}
            >
              <HighlightRingThumb highlight={h} />
              <span className="hl-ring-label">{h.name}</span>
              {h.itemCount > 0 && <span className="hl-ring-count">{h.itemCount}</span>}
            </button>
          ))}
        </div>
      )}

      {openIndex != null && highlights[openIndex] && (
        <HighlightViewer
          highlight={highlights[openIndex]}
          isOwner={isOwner}
          onClose={() => setOpenIndex(null)}
          onDeleted={load}
          onError={onError}
        />
      )}
    </div>
  );
}