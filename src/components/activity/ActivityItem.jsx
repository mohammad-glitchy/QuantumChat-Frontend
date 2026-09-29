import { formatDistanceToNow } from 'date-fns';
import { UserPlus, Users, AtSign, SmilePlus, Bell, ChevronRight } from 'lucide-react';

const ICONS = {
  friend_request: UserPlus,
  group: Users,
  mention: AtSign,
  reaction: SmilePlus,
};

export default function ActivityItem({ item = {}, onOpen = () => {} }) {
  const when = item.at ? formatDistanceToNow(new Date(item.at), { addSuffix: true }) : '';
  let title = '';
  const actor = item.actorIsCurrentUser ? 'You' : (item.actorLabel || item.actorName || 'Someone');
  const originalAuthor = item.originalAuthorIsCurrentUser ? 'your' : (item.originalAuthorLabel ? `${item.originalAuthorLabel}'s` : 'a');
  switch (item.type) {
    case 'friend_request':
      title = item.actorLabel || item.actorIsCurrentUser ? `${actor} sent you a friend request` : 'New friend request';
      break;
    case 'mention':
      title = `${actor} mentioned you${item.groupName ? ` in ${item.groupName}` : ''}`;
      break;
    case 'reaction':
      title = `${actor} reacted${item.emoji ? ` ${item.emoji}` : ''} to ${originalAuthor} message`;
      break;
    case 'group':
      if (item.action === 'deleted') {
        title = `${item.groupName || 'Group'} was deleted by ${actor}`;
      } else {
        title = `${actor} ${item.action || 'updated'} the group${item.groupName ? ` ${item.groupName}` : ''}`;
      }
      break;
    default:
      title = item.type || 'Activity';
  }

  const Icon = ICONS[item.type] || Bell;
  const iconClass = ICONS[item.type] ? `type-${item.type}` : 'type-default';

  return (
    <div
      className="activity-item"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <span className={`activity-item-icon ${iconClass}`} aria-hidden="true">
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <div className="activity-item-main">
        <div className="activity-item-title">{title}</div>
        {item.preview ? <div className="activity-item-preview">{item.preview}</div> : null}
        <div className="activity-item-meta">{when}</div>
      </div>
      <ChevronRight size={16} className="activity-item-chevron" aria-hidden="true" />
    </div>
  );
}