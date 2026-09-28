import { Check, CheckCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import client from '../api/client.js';
import { getDisplayName } from '../utils/getDisplayName.js';
import { getMessagePreviewText } from '../utils/messagePreview.js';
import UserAvatar from './UserAvatar.jsx';

function formatTimestamp(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function SectionLabel({ children }) {
  return (
    <div className="message-info-section-label">
      {children}
    </div>
  );
}

function StatusRow({ label, at, isLast }) {
  const formatted = formatTimestamp(at);
  const done = Boolean(at);

  return (
    <div className="message-info-status-row">
      <div className="message-info-status-icon-col">
        <div className={`message-info-status-icon ${done ? 'done' : 'pending'}`}>
          {done ? <CheckCheck size={16} strokeWidth={2.5} /> : <Check size={16} strokeWidth={2.5} />}
        </div>
        {!isLast && <div className="message-info-status-connector" />}
      </div>
      <div className={`message-info-status-content ${isLast ? 'is-last' : ''}`}>
        <div className="message-info-status-label">{label}</div>
        <div className={`message-info-status-time ${done ? '' : 'is-pending'}`}>
          {formatted || 'Not yet'}
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member, type = 'read' }) {
  const { t, i18n } = useTranslation();
  const displayName = getDisplayName(member, i18n.language) || member.displayName || member.username;

  let timestamp = null;
  let Icon = CheckCheck;
  let kind = 'read';

  if (type === 'read') {
    timestamp = member.readAt ? formatTimestamp(member.readAt) : null;
    Icon = CheckCheck;
    kind = 'read';
  } else if (type === 'delivered') {
    timestamp = member.deliveredAt ? formatTimestamp(member.deliveredAt) : null;
    Icon = CheckCheck;
    kind = 'delivered';
  } else {
    timestamp = null;
    Icon = Check;
    kind = 'pending';
  }

  return (
    <div className="message-info-member-row">
      <UserAvatar userId={member.userId} name={displayName} hasAvatar={member.hasAvatar} />
      <div className="message-info-member-info">
        <div className="message-info-member-name" title={displayName}>
          {displayName}
        </div>
        <div className={`message-info-member-status ${kind}`}>
          {timestamp ? (
            <bdi dir="ltr">{timestamp}</bdi>
          ) : (
            <span>{t('messageInfo.notDeliveredYet', 'Not delivered yet')}</span>
          )}
        </div>
      </div>
      <Icon size={16} strokeWidth={2.5} className={`message-info-check-icon ${kind}`} />
    </div>
  );
}

function ReactionRow({ emoji, names }) {
  return (
    <div className="message-info-reaction-row">
      <span className="message-info-reaction-emoji">{emoji}</span>
      <span className="message-info-reaction-names">{names.join(', ')}</span>
    </div>
  );
}

function ReplyRow({ reply, senderName, isMine, onClick }) {
  return (
    <button
      type="button"
      className="message-info-reply-row"
      onClick={onClick}
    >
      <div className="message-info-reply-sender">
        {isMine ? 'You' : senderName || 'Someone'}
      </div>
      <div className="message-info-reply-text">
        {getMessagePreviewText(reply) || (reply.attachment ? '[attachment]' : '[message]')}
      </div>
    </button>
  );
}

export default function MessageInfoModal({ data, usernameById, currentUserId, onClose, onSelectReply }) {
  const { t } = useTranslation();
  const messageId = data?.id;
  const [delivery, setDelivery] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!messageId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    client
      .get(`/messages/${messageId}/info`)
      .then((res) => {
        if (!cancelled) setDelivery(res.data.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || t('messageInfo.error', 'Failed to load message info'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [messageId, t]);

  const groupedReactions = useMemo(() => {
    const map = new Map();
    for (const r of data?.reactions || []) {
      if (!r?.emoji) continue;
      const isMine = String(r.user) === String(currentUserId);
      const name = isMine ? 'You' : usernameById?.get(String(r.user)) || 'Someone';
      const entry = map.get(r.emoji) || { emoji: r.emoji, names: [] };
      entry.names.push(name);
      map.set(r.emoji, entry);
    }
    return [...map.values()];
  }, [data?.reactions, usernameById, currentUserId]);

  const replies = data?.replies || [];
  const { readMembers, deliveredMembers, pendingMembers } = useMemo(() => {
    if (!delivery?.isGroup || !Array.isArray(delivery.members)) {
      return { readMembers: [], deliveredMembers: [], pendingMembers: [] };
    }
    const read = [];
    const delivered = [];
    const pending = [];

    for (const m of delivery.members) {
      if (m.readAt) {
        read.push(m);
      }
      if (m.deliveredAt || m.readAt) {
        delivered.push({
          ...m,
          deliveredAt: m.deliveredAt || m.readAt,
        });
      } else {
        pending.push(m);
      }
    }

    read.sort((a, b) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime());
    delivered.sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime());

    return { readMembers: read, deliveredMembers: delivered, pendingMembers: pending };
  }, [delivery]);

  if (!messageId) return null;

  return (
    <div
      className="message-info-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-info-title"
    >
      <div
        className="message-info-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="message-info-header">
          <h2 id="message-info-title">{t('messageInfo.title', 'Message info')}</h2>
          <button
            type="button"
            className="message-info-close-btn"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="message-info-body">
          {loading && <div className="message-info-hint">{t('common.loading', 'Loading…')}</div>}
          {error && <div className="message-info-error">{error}</div>}

          {!loading && !error && delivery && !delivery.isGroup && (
            <div className="message-info-status-list">
              <StatusRow label={t('messageInfo.delivered', 'Delivered')} at={delivery.deliveredAt} />
              <StatusRow label={t('messageInfo.read', 'Read')} at={delivery.readAt} isLast />
            </div>
          )}

          {!loading && !error && delivery && delivery.isGroup && (
            <div className="message-info-group-summary">
              {delivery.totalRecipients === 0 ? (
                <div className="message-info-hint">
                  {t('messageInfo.noOtherMembers', 'No other members in this group.')}
                </div>
              ) : (
                <>
                  <SectionLabel>
                    <span>{t('messageInfo.readBy', 'Read by')}</span>
                    {' '}
                    <bdi dir="ltr">({readMembers.length})</bdi>
                  </SectionLabel>
                  {readMembers.map((m) => (
                    <MemberRow key={m.userId} member={m} type="read" />
                  ))}

                  <SectionLabel>
                    <span>{t('messageInfo.delivered', 'Delivered')}</span>
                    {' '}
                    <bdi dir="ltr">({deliveredMembers.length})</bdi>
                  </SectionLabel>
                  {deliveredMembers.map((m) => (
                    <MemberRow key={m.userId} member={m} type="delivered" />
                  ))}

                  <SectionLabel>
                    <span>{t('messageInfo.notDeliveredYet', 'Not delivered yet')}</span>
                    {' '}
                    <bdi dir="ltr">({pendingMembers.length})</bdi>
                  </SectionLabel>
                  {pendingMembers.map((m) => (
                    <MemberRow key={m.userId} member={m} type="pending" />
                  ))}
                </>
              )}
            </div>
          )}

          {groupedReactions.length > 0 && (
            <>
              <SectionLabel>{t('messageInfo.reactions', 'Reactions')}</SectionLabel>
              {groupedReactions.map((g) => (
                <ReactionRow key={g.emoji} emoji={g.emoji} names={g.names} />
              ))}
            </>
          )}

          {replies.length > 0 && (
            <>
              <SectionLabel>{t('messageInfo.replies', 'Replies')}</SectionLabel>
              {replies.map((r) => (
                <ReplyRow
                  key={r.id}
                  reply={r}
                  isMine={String(r.from) === String(currentUserId)}
                  senderName={usernameById?.get(String(r.from))}
                  onClick={() => onSelectReply?.(r.id)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}