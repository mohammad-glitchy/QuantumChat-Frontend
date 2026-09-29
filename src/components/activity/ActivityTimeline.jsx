import { BellOff } from 'lucide-react';
import ActivityItem from './ActivityItem.jsx';

export default function ActivityTimeline({ items = [], onOpen = () => {} }) {
  if (!items || items.length === 0) return (
    <div className="activity-empty-centered">
      <div className="activity-empty-icon" aria-hidden="true">
        <BellOff size={26} strokeWidth={1.75} />
      </div>
      <h4>No recent activity</h4>
      <p className="empty-hint">When you receive friend requests, mentions, reactions, or group updates, they will appear here.</p>
    </div>
  );

  return (
    <ul className="activity-timeline">
      {items.map((it, idx) => (
        <li key={idx}>
          <ActivityItem item={it} onOpen={() => onOpen(it)} />
        </li>
      ))}
    </ul>
  );
}
