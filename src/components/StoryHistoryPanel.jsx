import { BookmarkPlus, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import client from '../api/client.js';
import { resolveStoryMediaBlob } from '../utils/storyMedia.js';
import HighlightPickerSheet from './HighlightPickerSheet.jsx';
import StoryDraftsPanel from './StoryDraftsPanel.jsx';

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function ActiveTab({ currentUserId, onError, onPreviewStory }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    client
      .get('/stories')
      .then(({ data }) => {
        if (cancelled) return;
        const mine = (data.data || [])
          .filter((s) => String(s.user?.id || s.user) === String(currentUserId))
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setItems(mine);
      })
      .catch((err) => {
        if (cancelled) return;
        onError?.(err.response?.data?.error || err.message || 'Failed to load active stories');
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  if (loading) return <p className="empty-hint">Loading…</p>;
  if (!items.length) return <p className="empty-hint">No active stories right now.</p>;

  return (
    <ul className="story-drafts-list">
      {items.map((item, idx) => (
        <li key={item.id} className="story-drafts-row">
          <div className="story-drafts-meta">
            <span className="story-drafts-badge scheduled">Live</span>
            <strong>{item.mediaType || 'media'}</strong>
            <span className="story-drafts-when">Posted {formatWhen(item.createdAt)}</span>
          </div>
          <div className="story-drafts-actions">
            <button type="button" onClick={() => onPreviewStory?.(items, idx)}>
              Preview
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ArchiveTab({ currentUserId, onError, onChanged, onOpenHighlight }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [highlightBusyId, setHighlightBusyId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await client.get('/stories/mine/archive');
      setItems(data.data || []);
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Failed to load archive');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reshare(id) {
    setBusyId(id);
    try {
      await client.post(`/stories/${id}/reshare`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      onChanged?.();
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Failed to reshare');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    setBusyId(id);
    try {
      await client.delete(`/stories/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      onChanged?.();
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Failed to delete');
    } finally {
      setBusyId(null);
    }
  }

  async function openHighlightFor(story) {
    setHighlightBusyId(story.id);
    try {
      const blob = await resolveStoryMediaBlob(story, currentUserId);
      onOpenHighlight?.(story, blob);
    } catch (err) {
      onError?.(err.message || 'Could not load this story\u2019s media');
    } finally {
      setHighlightBusyId(null);
    }
  }

  if (loading) return <p className="empty-hint">Loading…</p>;
  if (!items.length) return <p className="empty-hint">No expired stories yet — anything that expires stays here.</p>;

  return (
    <ul className="story-drafts-list">
      {items.map((item) => {
        const busy = busyId === item.id;
        const highlightBusy = highlightBusyId === item.id;
        return (
          <li key={item.id} className="story-drafts-row">
            <div className="story-drafts-meta">
              <span className="story-drafts-badge draft">Expired</span>
              <strong>{item.mediaType || 'media'}</strong>
              <span className="story-drafts-when">Expired {formatWhen(item.expiresAt)}</span>
            </div>
            <div className="story-drafts-actions">
              <button type="button" disabled={busy || highlightBusy} onClick={() => openHighlightFor(item)}>
                {highlightBusy ? <Loader2 size={16} className="hl-spin" aria-hidden /> : <BookmarkPlus size={16} aria-hidden />}
                Save to highlight
              </button>
              <button
                type="button"
                className="story-drafts-publish"
                disabled={busy || highlightBusy}
                onClick={() => reshare(item.id)}
              >
                <RotateCcw size={16} aria-hidden />
                {busy ? 'Resharing…' : 'Reshare'}
              </button>
              <button type="button" className="danger" disabled={busy || highlightBusy} onClick={() => remove(item.id)}>
                <Trash2 size={16} aria-hidden />
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function StoryHistoryPanel({
  open,
  onClose,
  currentUserId,
  initialTab = 'active',
  onError,
  onChanged,
  onPreviewDraft,
  onPreviewStory,
}) {
  const [tab, setTab] = useState(initialTab);
  const [highlightTarget, setHighlightTarget] = useState(null); // { story, blob }

  useEffect(() => {
    if (open) setTab(initialTab || 'active');
  }, [open, initialTab]);

  if (!open) return null;

  // Drafts keeps its own full sheet — it already owns edit/schedule/publish
  // flows we don't want to reimplement. Closing it returns to the tab picker
  // rather than closing the whole history flow.
  if (tab === 'drafts') {
    return (
      <StoryDraftsPanel
        open
        onClose={() => setTab('active')}
        onError={onError}
        onChanged={onChanged}
        onPreviewDraft={onPreviewDraft}
      />
    );
  }

  return createPortal(
    <div className="story-drafts-overlay" onClick={onClose}>
      <div className="story-drafts-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="story-drafts-header">
          <h2 className="status-create-title">Story history</h2>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="story-history-tabs">
          {['active', 'archive', 'drafts'].map((t) => (
            <button
              key={t}
              type="button"
              className={`story-history-tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'active' ? 'Active' : t === 'archive' ? 'Archive' : 'Drafts'}
            </button>
          ))}
        </div>

        {tab === 'active' && (
          <ActiveTab currentUserId={currentUserId} onError={onError} onPreviewStory={onPreviewStory} />
        )}

        {tab === 'archive' && (
          <ArchiveTab
            currentUserId={currentUserId}
            onError={onError}
            onChanged={onChanged}
            onOpenHighlight={(story, blob) => setHighlightTarget({ story, blob })}
          />
        )}
      </div>

      {highlightTarget && (
        <HighlightPickerSheet
          open
          onClose={() => setHighlightTarget(null)}
          onError={onError}
          onSaved={() => setHighlightTarget(null)}
          mediaBlob={highlightTarget.blob}
          story={highlightTarget.story}
        />
      )}
    </div>,
    document.body
  );
}