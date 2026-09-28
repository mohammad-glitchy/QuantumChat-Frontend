// Simple string hash to pick a consistent gradient class per username
function hashUsername(name) {
  let hash = 0;
  if (!name) return 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // force 32-bit int
  }
  return Math.abs(hash) % 10;
}

function formatShortLastSeen(iso) {
  if (!iso) return 'offline';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function UserList({
  users,
  selectedUserId,
  onSelect,
  onHide,
  onBlock,
  loading,
  onlineUsers = new Set(),
  unreadCounts = {},
  lastMessages = {},
}) {
  if (loading) {
    return (
      <div className="user-list">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="user-list-item" style={{ pointerEvents: 'none' }}>
            <div className="skeleton skeleton-avatar" />
            <div className="skeleton-user-info">
              <div className="skeleton skeleton-line short" />
              <div className="skeleton skeleton-line medium" style={{ marginTop: '4px' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="user-list">
      {users.map((u) => {
        const online = !u.isSystemUser && onlineUsers.has(u.id);
        const unread = unreadCounts[u.id] || 0;
        const lastMsg = lastMessages[u.id];

        return (
          <div
            key={u.id}
            className={`user-list-item ${u.id === selectedUserId ? 'active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(u)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(u);
              }
            }}
            aria-label={`Chat with ${u.username || 'Unknown user'}, ${online ? 'online' : 'offline'}${
              unread ? `, ${unread} unread` : ''
            }`}
          >
            <span className={`avatar avatar-gradient-${hashUsername(u.username || '')}`}>
              {(u.username || '?').slice(0, 2).toUpperCase()}
              {online && <span className="online-dot" />}
            </span>
            <span className="user-list-meta">
              <span className="user-list-name">
                {u.username || 'Unknown user'}
                {u.systemRole === 'quantum_ai' && <span className="verified-ai-badge">AI</span>}
              </span>
              {lastMsg ? (
                <span className="user-list-preview">{lastMsg}</span>
              ) : (
                <span className="user-list-lastseen">
                  {u.systemRole === 'quantum_ai' ? 'AI Assistant' : formatShortLastSeen(u.lastLoginAt)}
                </span>
              )}
            </span>
            {unread > 0 && <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>}
            <span className="user-list-actions">
              {!u.isSystemUser && <button
                type="button"
                className="user-list-action-btn"
                title="Hide chat"
                aria-label={`Hide chat with ${u.username}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onHide?.(u);
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>}
              {!u.isSystemUser && <button
                type="button"
                className="user-list-action-btn danger"
                title="Block user"
                aria-label={`Block ${u.username}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onBlock?.(u);
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
              </button>}
            </span>
          </div>
        );
      })}
      {users.length === 0 && <p className="empty-hint">No other users yet.</p>}
    </div>
  );
}
