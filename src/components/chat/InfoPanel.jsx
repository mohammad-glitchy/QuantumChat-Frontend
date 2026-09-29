import { Bookmark, Users, Info, LayoutDashboard, X } from 'lucide-react';
import UserAvatar from '../UserAvatar.jsx';
import IconButton from '../ui/IconButton.jsx';

/**
 * Peer/group summary — docked third column on desktop, sheet body on compact.
 */
export default function InfoPanel({
  open,
  onClose,
  selected,
  users = [],
  onOpenProfile,
  onOpenGroupSettings,
  onOpenCommandCenter,
  children,
  embedded = false,
}) {
  if (!open) return null;

  const isGroup = selected?.type === 'group';
  const isSelfChat = Boolean(
    selected?.isSelfChat || selected?.peer?.isSelfChat,
  );
  const peer =
    selected?.peer ||
    users.find((u) => String(u.id) === String(selected?.id));

  const body = selected ? (
    <div className={`qc-info-panel-body${embedded ? ' qc-info-panel-body--sheet' : ''}`}>
      <div className="qc-info-hero">
        {isGroup ? (
          <span className="avatar group-avatar qc-info-avatar">
            <Users size={28} strokeWidth={2} aria-hidden="true" />
          </span>
        ) : isSelfChat ? (
          <span className="avatar group-avatar qc-info-avatar self-chat-avatar">
            <Bookmark size={28} strokeWidth={2} aria-hidden="true" />
          </span>
        ) : (
          <UserAvatar
            userId={selected.id}
            name={selected.title}
            hasAvatar={Boolean(peer?.hasAvatar)}
            className="qc-info-avatar"
          />
        )}
        <h3>{selected.title}</h3>
        {selected.subtitle ? <p>{selected.subtitle}</p> : null}
      </div>
      <div className="qc-info-actions">
        {isGroup ? (
          <>
            <button
              type="button"
              className="qc-info-action cc-info-action-primary"
              onClick={onOpenCommandCenter}
            >
              <LayoutDashboard size={16} /> Command Center
            </button>
            <button type="button" className="qc-info-action" onClick={onOpenGroupSettings}>
              <Info size={16} /> Group settings
            </button>
          </>
        ) : isSelfChat ? (
          <p className="qc-info-note">Encrypted notes only you can read on this account.</p>
        ) : (
          <button type="button" className="qc-info-action" onClick={() => onOpenProfile?.(selected.id)}>
            <Info size={16} /> View profile
          </button>
        )}
      </div>
      {children}
    </div>
  ) : (
    <div className="qc-empty-state qc-empty-state--compact">
      <p>Select a chat to see details</p>
    </div>
  );

  if (embedded) return body;

  return (
    <aside className="qc-info-panel" aria-label="Chat details">
      <header className="qc-info-panel-header">
        <h2>Details</h2>
        <IconButton label="Close details" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </header>
      {body}
    </aside>
  );
}
