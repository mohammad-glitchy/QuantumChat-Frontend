import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Layers, UserPlus, Users, AtSign, SmilePlus, MessageSquare, Clock, Sparkles } from 'lucide-react';
import client from '../api/client.js';
import ActivityTimeline from '../components/activity/ActivityTimeline.jsx';
import ScreenTimeChart from '../components/activity/ScreenTimeChart.jsx';
import '../styles/activity.css';
import activityStore from '../utils/activityStore.js';
import { useNavigate } from 'react-router-dom';

const FILTERS = [
  { id: 'all', label: 'All', icon: Layers },
  { id: 'friend_request', label: 'Friend Requests', icon: UserPlus },
  { id: 'group', label: 'Groups', icon: Users },
  { id: 'mention', label: 'Mentions', icon: AtSign },
  { id: 'reaction', label: 'Reactions', icon: SmilePlus },
];

export default function Activity() {
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [conversationCount, setConversationCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const loadActivity = () => {
      const res = activityStore.getEvents({ filter, limit: 200, cursor: 0 });
      setItems(res.data || []);
    };

    loadActivity();
    window.addEventListener('qc:activity:updated', loadActivity);
    return () => window.removeEventListener('qc:activity:updated', loadActivity);
  }, [filter]);

  useEffect(() => {
    let active = true;
    Promise.all([
      client.get('/users', { params: { limit: 100 } }),
      client.get('/groups', { params: { limit: 100 } }),
    ]).then(([usersRes, groupsRes]) => {
      if (!active) return;
      const users = usersRes.data?.data || [];
      const groups = groupsRes.data?.data || [];
      setConversationCount(users.length + groups.length);
    }).catch(() => {
      if (active) setConversationCount(0);
    });
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => ({ conversations: conversationCount }), [conversationCount]);

  return (
    <div className="activity-page">
      <div className="activity-container">
        <header className="page-header">
          <div className="page-header-top">
            <button
              type="button"
              className="activity-back-button"
              onClick={() => navigate('/chat')}
              aria-label="Back to chat"
              title="Back to chat"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Back to chat</span>
            </button>
            <div className="activity-badge">
              <span className="activity-badge-dot" />
              <span>Activity Hub</span>
            </div>
          </div>
          <div className="page-header-title-wrap">
            <h1>Chat Activity</h1>
            <p className="muted">Recent friend requests, group events, mentions, and screen time.</p>
          </div>
        </header>

        <div className="activity-grid">
          <main className="activity-main">
            <div className="activity-controls">
              <div className="segmented" role="tablist" aria-label="Activity filter">
                {FILTERS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={filter === id}
                    className={`seg-btn ${filter === id ? 'active' : ''}`}
                    onClick={() => setFilter(id)}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="card activity-feed-card">
              <div className="activity-feed-head">
                <h3>
                  <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                  <span>Recent activity</span>
                </h3>
                <span className="feed-count-badge">
                  {items.length} {items.length === 1 ? 'event' : 'events'}
                </span>
              </div>
              <div className="activity-feed-body">
                <ActivityTimeline
                  items={items}
                  onOpen={(it) => {
                    if (it.conversationKey) {
                      if (it.conversationKey.startsWith('group:')) navigate(`/chat/g/${it.targetId || ''}`);
                      else if (it.conversationKey.startsWith('dm:')) navigate(`/chat/${it.targetId || ''}`);
                    }
                  }}
                />
              </div>
            </div>
          </main>

          <aside className="activity-side">
            <div className="card activity-stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon-wrap">
                  <MessageSquare size={18} />
                </div>
                <span className="stat-badge">Active</span>
              </div>
              <div className="stat-card-body">
                <div className="big-count">{counts.conversations}</div>
                <div className="stat-card-label">Conversations</div>
                <p className="muted">Direct chats & group channels joined</p>
              </div>
            </div>

            <div className="card activity-stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon-wrap">
                  <Clock size={18} />
                </div>
                <span className="stat-badge">Analytics</span>
              </div>
              <div className="stat-card-body">
                <ScreenTimeChart />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
