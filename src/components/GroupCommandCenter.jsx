import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  CheckSquare,
  FileText,
  Link2,
  Megaphone,
  Pin,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import client from '../api/client.js';
import { parseGroupPayload } from '../utils/groupPayload.js';
import { getDisplayName } from '../utils/getDisplayName.js';
import useFocusTrap from '../hooks/useFocusTrap.js';

const SECTIONS = [
  { id: 'announcements', label: 'Announcements', icon: Megaphone, color: 'cc-tile--announce' },
  { id: 'events', label: 'Upcoming Events', icon: Calendar, color: 'cc-tile--events' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, color: 'cc-tile--tasks' },
  { id: 'files', label: 'Shared Files', icon: FileText, color: 'cc-tile--files' },
  { id: 'polls', label: 'Polls', icon: BarChart2, color: 'cc-tile--polls' },
  { id: 'important', label: 'Important Messages', icon: Pin, color: 'cc-tile--important' },
  { id: 'members', label: 'Members', icon: Users, color: 'cc-tile--members' },
  { id: 'links', label: 'Important Links', icon: Link2, color: 'cc-tile--links' },
  { id: 'notes', label: 'Group Notes', icon: FileText, color: 'cc-tile--notes' },
  { id: 'ai', label: 'AI Summary', icon: Sparkles, color: 'cc-tile--ai' },
];

function previewText(m) {
  const payload = parseGroupPayload(m?.text || '');
  if (payload.type === 'announcement') return payload.body || 'Announcement';
  if (payload.type === 'poll') return payload.question || 'Poll';
  if (payload.type === 'event') return payload.title || 'Event';
  if (payload.type === 'file') return payload.filename || 'File';
  if (typeof payload.body === 'string' && payload.body) return payload.body;
  const raw = String(m?.text || '').trim();
  if (!raw || raw.startsWith('{')) return m?.kind || 'Message';
  return raw.length > 120 ? `${raw.slice(0, 120)}…` : raw;
}

function eventWhen(m) {
  const payload = parseGroupPayload(m?.text || '');
  if (payload.type !== 'event') return null;
  const when = payload.when ? new Date(payload.when) : null;
  return when && !Number.isNaN(when.getTime()) ? when : null;
}

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function GroupCommandCenter({
  group,
  messages = [],
  currentUserId,
  onClose,
  onUpdated,
  onJumpToMessage,
  onOpenGroupSettings,
  onAskAiSummary,
}) {
  const [view, setView] = useState('home');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const containerRef = useRef(null);

  useFocusTrap(containerRef, true);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape' && !busy) {
        if (view !== 'home') setView('home');
        else onClose?.();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, busy, view]);

  const hub = group?.commandCenter || { tasks: [], links: [], notes: [] };
  const pinnedIds = useMemo(
    () => new Set((group?.pinnedMessageIds || []).map(String)),
    [group?.pinnedMessageIds],
  );
  const adminIds = useMemo(
    () => new Set((group?.admins || []).map(String)),
    [group?.admins],
  );

  const buckets = useMemo(() => {
    const announcements = [];
    const events = [];
    const polls = [];
    const files = [];
    const important = [];
    const now = Date.now();

    for (const m of messages || []) {
      const id = String(m.id || m._id);
      const kind = m.kind || parseGroupPayload(m.text || '').type;
      if (kind === 'announcement') announcements.push(m);
      else if (kind === 'poll') polls.push(m);
      else if (kind === 'event') {
        const when = eventWhen(m);
        if (!when || when.getTime() >= now - 86400000) events.push(m);
      } else if (kind === 'file' || m.attachment) files.push(m);
      if (pinnedIds.has(id)) important.push(m);
    }

    events.sort((a, b) => {
      const wa = eventWhen(a)?.getTime() || 0;
      const wb = eventWhen(b)?.getTime() || 0;
      return wa - wb;
    });

    return { announcements, events, polls, files, important };
  }, [messages, pinnedIds]);

  const counts = {
    announcements: buckets.announcements.length,
    events: buckets.events.length,
    tasks: (hub.tasks || []).filter((t) => !t.done).length,
    files: buckets.files.length,
    polls: buckets.polls.length,
    important: buckets.important.length || (group?.pinnedMessageIds || []).length,
    members: (group?.members || []).length,
    links: (hub.links || []).length,
    notes: (hub.notes || []).length,
    ai: group?.quantumAI?.enabled ? 1 : 0,
  };

  async function hubAction(payload) {
    setBusy(true);
    setError('');
    try {
      const { data } = await client.patch(`/groups/${group.id}/command-center`, payload);
      onUpdated?.(data.data);
      return true;
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addTask(e) {
    e?.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;
    const ok = await hubAction({ action: 'add', section: 'tasks', title });
    if (ok) setTaskTitle('');
  }

  async function addLink(e) {
    e?.preventDefault();
    const title = linkTitle.trim() || 'Link';
    const url = linkUrl.trim();
    if (!url) return;
    const ok = await hubAction({ action: 'add', section: 'links', title, url });
    if (ok) {
      setLinkTitle('');
      setLinkUrl('');
    }
  }

  async function addNote(e) {
    e?.preventDefault();
    const body = noteBody.trim();
    if (!body) return;
    const ok = await hubAction({
      action: 'add',
      section: 'notes',
      title: noteTitle.trim(),
      body,
    });
    if (ok) {
      setNoteTitle('');
      setNoteBody('');
    }
  }

  function memberLabel(m) {
    return getDisplayName(m) || m?.username || m?.email || 'Member';
  }

  function renderMessageList(items, emptyLabel) {
    if (!items.length) {
      return <p className="cc-empty">{emptyLabel}</p>;
    }
    return (
      <ul className="cc-list">
        {items.map((m) => {
          const id = String(m.id || m._id);
          return (
            <li key={id}>
              <button
                type="button"
                className="cc-list-item"
                onClick={() => {
                  onJumpToMessage?.(id);
                  onClose?.();
                }}
              >
                <span className="cc-list-item-title">{previewText(m)}</span>
                <span className="cc-list-item-meta">{formatWhen(m.createdAt)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  function renderSection() {
    switch (view) {
      case 'announcements':
        return renderMessageList(
          buckets.announcements,
          'No announcements yet. Admins can post one from the + menu in chat.',
        );
      case 'events':
        if (!buckets.events.length) {
          return (
            <p className="cc-empty">
              No upcoming events. Create one from the + menu in chat.
            </p>
          );
        }
        return (
          <ul className="cc-list">
            {buckets.events.map((m) => {
              const id = String(m.id || m._id);
              const payload = parseGroupPayload(m.text || '');
              const when = eventWhen(m);
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="cc-list-item"
                    onClick={() => {
                      onJumpToMessage?.(id);
                      onClose?.();
                    }}
                  >
                    <span className="cc-list-item-title">{payload.title || 'Event'}</span>
                    <span className="cc-list-item-meta">
                      {when ? when.toLocaleString() : 'Time TBD'}
                      {payload.where ? ` · ${payload.where}` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        );
      case 'polls':
        return renderMessageList(
          buckets.polls,
          'No polls yet. Create one from the + menu in chat.',
        );
      case 'files':
        return renderMessageList(
          buckets.files,
          'No shared files in this chat yet.',
        );
      case 'important':
        return renderMessageList(
          buckets.important,
          'No pinned messages. Long-press or open a message menu and pin it.',
        );
      case 'members':
        return (
          <ul className="cc-list">
            {(group?.members || []).map((m) => {
              const id = String(m.id || m._id);
              const isAdmin = adminIds.has(id);
              return (
                <li key={id} className="cc-list-item cc-list-item--static">
                  <span className="cc-list-item-title">
                    {memberLabel(m)}
                    {isAdmin ? <span className="cc-badge">Admin</span> : null}
                  </span>
                  <span className="cc-list-item-meta">{m.username ? `@${m.username}` : ''}</span>
                </li>
              );
            })}
          </ul>
        );
      case 'tasks':
        return (
          <div className="cc-hub-section">
            <form className="cc-add-form" onSubmit={addTask}>
              <input
                className="create-group-input"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Add a task…"
                maxLength={200}
                disabled={busy}
              />
              <button type="submit" className="btn-primary cc-add-btn" disabled={busy || !taskTitle.trim()}>
                <Plus size={16} /> Add
              </button>
            </form>
            {(hub.tasks || []).length === 0 ? (
              <p className="cc-empty">No tasks yet. Add the first one above.</p>
            ) : (
              <ul className="cc-list">
                {(hub.tasks || []).map((t) => (
                  <li key={t.id} className={`cc-task-row${t.done ? ' is-done' : ''}`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(t.done)}
                        disabled={busy}
                        onChange={() =>
                          hubAction({
                            action: 'toggle',
                            section: 'tasks',
                            itemId: t.id,
                            done: !t.done,
                          })
                        }
                      />
                      <span>{t.title}</span>
                    </label>
                    <button
                      type="button"
                      className="cc-icon-btn"
                      aria-label="Remove task"
                      disabled={busy}
                      onClick={() =>
                        hubAction({ action: 'remove', section: 'tasks', itemId: t.id })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      case 'links':
        return (
          <div className="cc-hub-section">
            <form className="cc-add-form cc-add-form--stack" onSubmit={addLink}>
              <input
                className="create-group-input"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Title (optional)"
                maxLength={120}
                disabled={busy}
              />
              <input
                className="create-group-input"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                maxLength={2000}
                disabled={busy}
                required
              />
              <button type="submit" className="btn-primary cc-add-btn" disabled={busy || !linkUrl.trim()}>
                <Plus size={16} /> Save link
              </button>
            </form>
            {(hub.links || []).length === 0 ? (
              <p className="cc-empty">No saved links yet.</p>
            ) : (
              <ul className="cc-list">
                {(hub.links || []).map((l) => (
                  <li key={l.id} className="cc-link-row">
                    <a href={l.url} target="_blank" rel="noopener noreferrer">
                      <strong>{l.title || 'Link'}</strong>
                      <span>{l.url}</span>
                    </a>
                    <button
                      type="button"
                      className="cc-icon-btn"
                      aria-label="Remove link"
                      disabled={busy}
                      onClick={() =>
                        hubAction({ action: 'remove', section: 'links', itemId: l.id })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      case 'notes':
        return (
          <div className="cc-hub-section">
            <form className="cc-add-form cc-add-form--stack" onSubmit={addNote}>
              <input
                className="create-group-input"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note title (optional)"
                maxLength={120}
                disabled={busy}
              />
              <textarea
                className="create-group-input"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Shared group note…"
                rows={3}
                maxLength={5000}
                disabled={busy}
              />
              <button type="submit" className="btn-primary cc-add-btn" disabled={busy || !noteBody.trim()}>
                <Plus size={16} /> Add note
              </button>
            </form>
            {(hub.notes || []).length === 0 ? (
              <p className="cc-empty">No group notes yet.</p>
            ) : (
              <ul className="cc-list">
                {(hub.notes || []).map((n) => (
                  <li key={n.id} className="cc-note-card">
                    <div className="cc-note-card-head">
                      <strong>{n.title || 'Note'}</strong>
                      <button
                        type="button"
                        className="cc-icon-btn"
                        aria-label="Remove note"
                        disabled={busy}
                        onClick={() =>
                          hubAction({ action: 'remove', section: 'notes', itemId: n.id })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p>{n.body}</p>
                    <span className="cc-list-item-meta">{formatWhen(n.updatedAt || n.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      case 'ai': {
        const recent = (messages || []).slice(-40);
        const textBits = recent
          .map((m) => previewText(m))
          .filter(Boolean)
          .slice(-12);
        return (
          <div className="cc-hub-section">
            <div className="cc-ai-card">
              <h4>Quick digest</h4>
              <ul className="cc-ai-stats">
                <li>{counts.announcements} announcements</li>
                <li>{counts.events} upcoming events</li>
                <li>{counts.polls} polls</li>
                <li>{counts.files} shared files</li>
                <li>{counts.tasks} open tasks</li>
                <li>{(messages || []).length} messages loaded</li>
              </ul>
              {textBits.length > 0 ? (
                <>
                  <h4>Recent topics</h4>
                  <ul className="cc-ai-topics">
                    {textBits.map((t, i) => (
                      <li key={`${i}-${t.slice(0, 12)}`}>{t}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="cc-empty">Open the group chat first so we can summarize recent messages.</p>
              )}
              {group?.quantumAI?.enabled ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    onAskAiSummary?.();
                    onClose?.();
                  }}
                >
                  <Sparkles size={16} /> Ask QuantumAI in chat
                </button>
              ) : (
                <p className="cc-empty">
                  Enable QuantumAI in{' '}
                  <button type="button" className="cc-text-link" onClick={() => onOpenGroupSettings?.()}>
                    group settings
                  </button>{' '}
                  for AI replies in this group.
                </p>
              )}
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  }

  const activeSection = SECTIONS.find((s) => s.id === view);
  const modal = (
    <div className="create-group-overlay" role="presentation" onClick={() => !busy && onClose?.()}>
      <div
        className="create-group-modal group-settings-modal cc-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Group Command Center"
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="group-settings-chrome cc-chrome">
          <div className="create-group-modal-header">
            <div className="cc-header-row">
              {view !== 'home' ? (
                <button
                  type="button"
                  className="cc-icon-btn"
                  aria-label="Back"
                  onClick={() => setView('home')}
                >
                  <ArrowLeft size={18} />
                </button>
              ) : null}
              <div className="cc-header-titles">
                <h2>{view === 'home' ? 'Command Center' : activeSection?.label || 'Command Center'}</h2>
                <p>{group?.name || 'Group'}</p>
              </div>
              <button type="button" className="create-group-close" aria-label="Close" onClick={onClose}>
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="group-settings-body cc-body">
          {error ? <p className="group-settings-error">{error}</p> : null}

          {view === 'home' ? (
            <>
              <p className="cc-intro">
                Everything important for this group — without scrolling hundreds of messages.
              </p>
              <div className="cc-grid">
                {SECTIONS.map((s) => {
                  const Icon = s.icon;
                  const count = counts[s.id] ?? 0;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`cc-tile ${s.color}`}
                      onClick={() => setView(s.id)}
                    >
                      <Icon size={22} strokeWidth={2} aria-hidden="true" />
                      <span className="cc-tile-label">{s.label}</span>
                      <span className="cc-tile-count">{count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="cc-footer-actions">
                <button type="button" className="btn-secondary" onClick={() => onOpenGroupSettings?.()}>
                  Group settings
                </button>
              </div>
            </>
          ) : (
            renderSection()
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
