import { MoreHorizontal, Pin, Search, Star, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { filterImportantEntries, normalizeImportantEntries } from '../utils/importantMessages.js';
import UserAvatar from './UserAvatar.jsx';

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

function getEntryText(entry) {
  if (entry?.text) return entry.text;
  if (entry?.hasAttachment) return `[${entry.attachmentFilename || 'Attachment'}]`;
  return '[encrypted]';
}

function getAutomaticStatus(entry) {
  if (entry?.importantSource === 'document') return 'Automatically saved · Document';
  if (entry?.importantSource === 'link') return 'Automatically saved · Link';
  return null;
}

function getStaticSenderName(entry, currentUserId, usernameById) {
  if (String(entry?.from) === String(currentUserId)) return 'You';
  if (usernameById && typeof usernameById.get === 'function') {
    return usernameById.get(String(entry?.from)) || 'Member';
  }
  return entry?.senderName || 'Member';
}

export default function StarredMessagesModal({
  entries = [],
  usernameById,
  currentUserId,
  onSelect,
  onUnstar,
  onCopy,
  onRemoveImportant,
  onClose,
  loading = false,
}) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

  const normalizedEntries = useMemo(() => normalizeImportantEntries(entries), [entries]);
  const visibleEntries = useMemo(
    () => filterImportantEntries(normalizedEntries, filter, query),
    [normalizedEntries, filter, query],
  );

  const countLabel =
    normalizedEntries.length === 1
      ? '1 important message'
      : `${normalizedEntries.length} important messages`;

  return (
    <div className="create-group-overlay" role="presentation" onClick={onClose}>
      <div
        className="create-group-modal important-message-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="important-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="create-group-modal-header important-message-header">
          <div className="create-group-modal-heading">
            <h2 id="important-title">Important messages</h2>
            <p>{countLabel}</p>
          </div>
          <button type="button" className="create-group-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="important-message-toolbar">
          <div className="important-message-tabs" role="tablist" aria-label="Important message filters">
            {['all', 'starred', 'important'].map((tab) => (
              <button
                key={tab}
                type="button"
                className={filter === tab ? 'active' : ''}
                onClick={() => setFilter(tab)}
                aria-pressed={filter === tab}
              >
                {tab === 'all' ? 'All' : tab === 'starred' ? 'Starred' : 'Important'}
              </button>
            ))}
          </div>
        </div>

        <label className="important-message-search" aria-label="Search important messages">
          <Search size={15} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search important messages..."
          />
        </label>

        <div className="important-message-list">
          {loading ? (
            <div className="important-message-loading" aria-live="polite">
              <div className="skeleton-message-bubble theirs skeleton" />
              <div className="skeleton-message-bubble mine skeleton" />
              <div className="skeleton-message-bubble theirs skeleton" style={{ width: '55%' }} />
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="important-message-empty" role="status">
              <div className="important-message-empty-icon" aria-hidden="true">⭐</div>
              <h3>No important messages</h3>
              <p>Save messages here to find them quickly later. Starred messages will also appear here.</p>
            </div>
          ) : (
            visibleEntries.map((entry) => {
              const senderName = getStaticSenderName(entry, currentUserId, usernameById);
              const reasons = Array.isArray(entry.reasons) && entry.reasons.length
                ? entry.reasons
                : [entry.isStarred ? 'Starred' : null, entry.isImportant ? 'Important' : null].filter(Boolean);
              const automaticStatus = getAutomaticStatus(entry);
              const conversationLabel = entry.conversationTitle || entry.title || 'Chat';
              const preview = getEntryText(entry);

              return (
                <article
                  key={entry.id}
                  className="important-message-card"
                  onClick={() => onSelect?.(entry)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect?.(entry);
                    }
                  }}
                >
                  <div className="important-message-card-head">
                    <div className="important-message-avatar-wrap">
                      {entry.type === 'group' ? (
                        <span className="avatar group-avatar">
                          <Users size={18} strokeWidth={2} aria-hidden="true" />
                        </span>
                      ) : (
                        <UserAvatar userId={entry.conversationId} name={conversationLabel} />
                      )}
                    </div>

                    <div className="important-message-heading">
                      <div className="important-message-sender-row">
                        <span className="important-message-sender">{senderName}</span>
                        <div className="important-message-badges" aria-label="Message reasons">
                          {reasons.includes('Starred') && <span className="important-message-badge starred"><Star size={12} fill="currentColor" strokeWidth={0} /> Starred</span>}
                          {automaticStatus ? (
                            <span className="important-message-badge important"><Pin size={12} strokeWidth={2.2} /> {automaticStatus}</span>
                          ) : reasons.includes('Important') && <span className="important-message-badge important"><Pin size={12} strokeWidth={2.2} /> Important</span>}
                        </div>
                      </div>
                      {conversationLabel && conversationLabel !== senderName && (
                        <div className="important-message-conversation">{conversationLabel}</div>
                      )}
                    </div>

                    <div className="important-message-actions-wrap">
                      <button
                        type="button"
                        className="important-message-menu-btn"
                        aria-label="Message actions"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuId((current) => current === entry.id ? null : entry.id);
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {openMenuId === entry.id && (
                        <div className="important-message-menu" onClick={(event) => event.stopPropagation()}>
                          <button type="button" onClick={() => { onSelect?.(entry); setOpenMenuId(null); }}>Open in chat</button>
                          {entry.isImportant && onRemoveImportant && (
                            <button type="button" onClick={() => { onRemoveImportant(entry.id); setOpenMenuId(null); }}>Remove from important</button>
                          )}
                          {entry.isStarred && onUnstar && (
                            <button type="button" onClick={() => { onUnstar(entry.id); setOpenMenuId(null); }}>Unstar message</button>
                          )}
                          {onCopy && (
                            <button type="button" onClick={() => { onCopy(entry); setOpenMenuId(null); }}>Copy message</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="important-message-preview">{preview}</div>
                  <div className="important-message-footer">
                    <span>{formatWhen(entry.createdAt)}</span>
                    <span className="important-message-status">
                      {automaticStatus || (reasons.length > 1 ? `${reasons[0]} · ${reasons[1]}` : reasons[0] === 'Starred' ? 'Starred message' : reasons[0] === 'Important' ? 'Saved as important' : 'Important message')}
                    </span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}