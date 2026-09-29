import { Clock, Eye, Pencil, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import client from '../api/client.js';
import { useToast } from './ToastProvider.jsx';
import { defaultScheduleLocalValue } from './StoryPublishControls.jsx';

const TTL_PRESETS = [
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '6 hours', ms: 6 * 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { label: '3 days', ms: 3 * 24 * 60 * 60 * 1000 },
  { label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
];

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

function defaultScheduleLocalValueFromIso(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return defaultScheduleLocalValue();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function StoryDraftsPanel({ open, onClose, onError, onChanged, onPreviewDraft }) {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [editId, setEditId] = useState(null);
  const [editTtl, setEditTtl] = useState(TTL_PRESETS[2].ms);
  const [editAllowReplies, setEditAllowReplies] = useState(true);
  const [editSchedule, setEditSchedule] = useState(false);
  const [scheduleLocal, setScheduleLocal] = useState(defaultScheduleLocalValue);

  async function load() {
    setLoading(true);
    try {
      const { data } = await client.get('/stories/mine/drafts');
      setItems(data.data || []);
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Failed to load drafts');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    setEditId(null);
    setStatusMessage('');
    load();
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  function openEdit(item) {
    setEditId(item.id);
    setEditTtl(item.ttlMs || TTL_PRESETS[2].ms);
    setEditAllowReplies(item.allowReplies !== false);
    setEditSchedule(item.status === 'scheduled');
    setScheduleLocal(
      item.publishAt ? defaultScheduleLocalValueFromIso(item.publishAt) : defaultScheduleLocalValue()
    );
  }

  async function saveEdit(id) {
    setBusyId(id);
    try {
      const payload = {
        ttlMs: editTtl,
        allowReplies: editAllowReplies,
        status: editSchedule ? 'scheduled' : 'draft',
      };
      if (editSchedule) {
        const at = new Date(scheduleLocal);
        if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now() + 30_000) {
          onError?.('Pick a schedule time at least 30 seconds from now');
          setBusyId(null);
          return;
        }
        payload.publishAt = at.toISOString();
      }
      await client.patch(`/stories/${id}`, payload);
      setEditId(null);
      await load();
      onChanged?.();
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Failed to save changes');
    } finally {
      setBusyId(null);
    }
  }

  /** Publish immediately — no extra confirmation. */
  async function publishNow(id) {
    setBusyId(id);
    setStatusMessage('Publishing your status…');
    showToast('Publishing your status…', 'info');
    try {
      await client.post(`/stories/${id}/publish`, {});
      const next = items.filter((i) => i.id !== id);
      setItems(next);
      setEditId(null);
      setStatusMessage('Status published');
      showToast('Status published', 'success');
      onChanged?.();
      if (next.length === 0) {
        // Brief pause so the success toast/message is readable before the panel closes.
        setTimeout(() => onClose?.(), 700);
      } else {
        setTimeout(() => setStatusMessage(''), 2500);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to publish';
      setStatusMessage('');
      onError?.(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function convertToDraft(id) {
    setBusyId(id);
    try {
      await client.patch(`/stories/${id}`, { status: 'draft' });
      await load();
      onChanged?.();
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Failed to update draft');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    setBusyId(id);
    try {
      await client.delete(`/stories/${id}`);
      const next = items.filter((i) => i.id !== id);
      setItems(next);
      if (editId === id) setEditId(null);
      onChanged?.();
      if (next.length === 0) onClose?.();
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Failed to delete');
    } finally {
      setBusyId(null);
    }
  }

  return createPortal(
    <div className="story-drafts-overlay" onClick={onClose}>
      <div
        className="story-drafts-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Drafts and scheduled"
      >
        <div className="story-drafts-header">
          <h2 className="status-create-title">Drafts &amp; scheduled</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="status-create-subtitle">Edit, preview, schedule, or publish when ready</p>

        {statusMessage ? (
          <p
            className={`story-drafts-status${statusMessage.toLowerCase().includes('published') ? ' success' : ''}`}
            role="status"
            aria-live="polite"
          >
            {statusMessage}
          </p>
        ) : null}

        {loading && <p className="empty-hint">Loading…</p>}
        {!loading && items.length === 0 && !statusMessage && (
          <p className="empty-hint">No drafts or scheduled statuses yet.</p>
        )}
        {!loading && items.length === 0 && statusMessage ? (
          <p className="empty-hint">Your status is live on My status.</p>
        ) : null}

        <ul className="story-drafts-list">
          {items.map((item) => {
            const busy = busyId === item.id;
            const editing = editId === item.id;
            return (
              <li key={item.id} className="story-drafts-row">
                <div className="story-drafts-meta">
                  <span className={`story-drafts-badge ${item.status}`}>
                    {item.status === 'scheduled' ? 'Scheduled' : 'Draft'}
                  </span>
                  <strong>{item.mediaType || 'media'}</strong>
                  <span className="story-drafts-when">
                    {item.status === 'scheduled'
                      ? `Goes live ${formatWhen(item.publishAt)}`
                      : `Saved ${formatWhen(item.updatedAt || item.createdAt)}`}
                  </span>
                </div>

                {editing && (
                  <div className="story-drafts-edit-panel">
                    <p className="story-composer-ttl-label">Visible for (after publish)</p>
                    <div className="story-composer-ttl-presets">
                      {TTL_PRESETS.map((p) => (
                        <button
                          key={p.ms}
                          type="button"
                          className={`story-ttl-preset ${editTtl === p.ms ? 'active' : ''}`}
                          disabled={busy}
                          onClick={() => setEditTtl(p.ms)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <label className="story-composer-check" style={{ margin: '8px 0' }}>
                      <input
                        type="checkbox"
                        checked={editAllowReplies}
                        disabled={busy}
                        onChange={(e) => setEditAllowReplies(e.target.checked)}
                      />
                      <span>Allow replies</span>
                    </label>
                    <label className="story-composer-check" style={{ margin: '0 0 8px' }}>
                      <input
                        type="checkbox"
                        checked={editSchedule}
                        disabled={busy}
                        onChange={(e) => setEditSchedule(e.target.checked)}
                      />
                      <span>Schedule for later</span>
                    </label>
                    {editSchedule && (
                      <input
                        type="datetime-local"
                        className="story-schedule-input"
                        value={scheduleLocal}
                        disabled={busy}
                        onChange={(e) => setScheduleLocal(e.target.value)}
                      />
                    )}
                    <div className="story-drafts-edit-actions">
                      <button type="button" className="story-composer-secondary" disabled={busy} onClick={() => setEditId(null)}>
                        Cancel
                      </button>
                      <button type="button" className="story-composer-post" disabled={busy} onClick={() => saveEdit(item.id)}>
                        {busy ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="story-drafts-actions">
                  <button type="button" title="Edit" disabled={busy} onClick={() => openEdit(item)}>
                    <Pencil size={16} aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    title="Preview"
                    disabled={busy}
                    onClick={() => onPreviewDraft?.(item)}
                  >
                    <Eye size={16} aria-hidden />
                    Preview
                  </button>
                  <button
                    type="button"
                    className="story-drafts-publish"
                    title="Publish now"
                    disabled={busy}
                    onClick={() => publishNow(item.id)}
                  >
                    <Upload size={16} aria-hidden />
                    {busy && busyId === item.id ? 'Publishing…' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    title="Schedule"
                    disabled={busy}
                    onClick={() => {
                      openEdit(item);
                      setEditSchedule(true);
                    }}
                  >
                    <Clock size={16} aria-hidden />
                    Schedule
                  </button>
                  {item.status === 'scheduled' && (
                    <button type="button" disabled={busy} onClick={() => convertToDraft(item.id)}>
                      Unschedule
                    </button>
                  )}
                  <button type="button" className="danger" disabled={busy} onClick={() => remove(item.id)}>
                    <Trash2 size={16} aria-hidden />
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body
  );
}
