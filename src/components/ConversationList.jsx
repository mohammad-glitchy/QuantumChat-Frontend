import { motion } from 'framer-motion';
import { Archive, Ban, BellOff, Bookmark, Check, ChevronLeft, ChevronRight, Lock, Mail, MoreVertical, Phone, Pin, Search, Unlock, UserPlus, Users, UserX, VolumeX, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import client from '../api/client.js';
import { useVault } from '../context/VaultContext.jsx';
import UserAvatar from './UserAvatar.jsx';
import { getDisplayName } from '../utils/getDisplayName.js';

function formatShortRelative(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
function isOnlineUser(u, onlineUserIds) {
  if (!u || !onlineUserIds) return false;
  // Presence snapshot/updates are already privacy-filtered on the server.
  return onlineUserIds.has(String(u.id));
}
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'groups', label: 'Groups' },
  { id: 'friends', label: 'Friends' },
  // { id: 'discover', label: 'Discover' },
  { id: 'public', label: 'Discover' },
  { id: 'archived', label: 'Archived' },
];

const FILTER_WINDOW = 3;
const CONV_MENU_WIDTH = 190;
const CONV_MENU_EST_HEIGHT = 230;

function computeConvMenuPosition(triggerEl) {
  const rect = triggerEl.getBoundingClientRect();
  const gap = 8;
  const pad = 12;
  const spaceBelow = window.innerHeight - rect.bottom - pad;
  const spaceAbove = rect.top - pad;
  const openUp = spaceBelow < CONV_MENU_EST_HEIGHT && spaceAbove > spaceBelow;

  let top = openUp
    ? rect.top - CONV_MENU_EST_HEIGHT - gap
    : rect.bottom + gap;

  top = Math.max(pad, Math.min(top, window.innerHeight - CONV_MENU_EST_HEIGHT - pad));

  const isRtl = document.documentElement.dir === 'rtl';
  let left = 'auto';
  let right = 'auto';

  if (isRtl) {
    left = Math.max(pad, Math.min(rect.left, window.innerWidth - CONV_MENU_WIDTH - pad));
  } else {
    right = window.innerWidth - rect.right;
    right = Math.max(pad, Math.min(right, window.innerWidth - CONV_MENU_WIDTH - pad));
  }

  return { top, left, right, openUp };
}

export default function ConversationList({
  currentUser,
  conversations,
  filter,
  onFilterChange,
  onlineUserIds,
  selectedKey,
  onSelect,
  onCreateGroup,
  onDiscoverJoin,
  onHide,
  onBlock,
  onMute,
  onArchive,
  onPin,
  onToggleVault,
  loading = false,
  searchQuery = '',
  hasMoreContacts = false,
  onLoadMoreContacts,
  friendCandidates = [],
  friendCandidatesLoading = false,
  incomingRequests = [],
  outgoingRequests = [],
  myFriends = [],
  myFriendsLoading = false,
  contactQuery = '',
  onContactQueryChange,
  contactLookupResult = null,
  contactLookupLoading = false,
  contactLookupError = '',
  onLookupContact,
  onSendFriendRequest,
  onCancelFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onOpenFriend,
}) {
  const { t, i18n } = useTranslation();
  const { isUnlocked: vaultUnlocked, isPeerVaulted } = useVault();
  const [discoverItems, setDiscoverItems] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState('');
  const [joiningId, setJoiningId] = useState(null);
  const [openMenuKey, setOpenMenuKey] = useState(null);
  const [filterStart, setFilterStart] = useState(0);
  const panelRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);

  const visibleMyFriends = useMemo(
    () => myFriends.filter((u) => vaultUnlocked || !isPeerVaulted(u.id)),
    [myFriends, vaultUnlocked, isPeerVaulted]
  );
  const visibleFriendCandidates = useMemo(
    () => friendCandidates.filter((u) => vaultUnlocked || !isPeerVaulted(u.id)),
    [friendCandidates, vaultUnlocked, isPeerVaulted]
  );
  const visibleIncomingRequests = useMemo(
    () => incomingRequests.filter((r) => vaultUnlocked || !isPeerVaulted(r.user?.id)),
    [incomingRequests, vaultUnlocked, isPeerVaulted]
  );
  const visibleOutgoingRequests = useMemo(
    () => outgoingRequests.filter((r) => vaultUnlocked || !isPeerVaulted(r.user?.id)),
    [outgoingRequests, vaultUnlocked, isPeerVaulted]
  );
  // Decoy view: hides real friend/request status for a locked vaulted peer
  // entirely, so a lookup-by-email/phone can't be used to confirm the real
  // relationship while locked.
  const displayedContactLookupResult = useMemo(() => {
    if (!contactLookupResult) return null;
    if (!vaultUnlocked && isPeerVaulted(contactLookupResult.id)) {
      return {
        ...contactLookupResult,
        requestStatus: 'none',
        requestId: null,
        __vaultedLocked: true,
      };
    }
    return contactLookupResult;
  }, [contactLookupResult, vaultUnlocked, isPeerVaulted]);

  const friendSet = useMemo(() => {
    const ids = new Set();
    if (Array.isArray(myFriends)) {
      myFriends.forEach((f) => {
        if (f?.id) ids.add(String(f.id));
        if (f?._id) ids.add(String(f._id));
      });
    }
    if (Array.isArray(currentUser?.friends)) {
      currentUser.friends.forEach((id) => ids.add(String(id)));
    }
    return ids;
  }, [myFriends, currentUser?.friends]);

  const { friendItems, otherItems } = useMemo(() => {
    if (filter !== 'all') {
      return { friendItems: conversations, otherItems: [] };
    }
    const friends = [];
    const others = [];
    for (const c of conversations) {
      if (c.type === 'group' || c.isSelfChat || friendSet.has(String(c.id))) {
        friends.push(c);
      } else {
        others.push(c);
      }
    }
    return { friendItems: friends, otherItems: others };
  }, [filter, conversations, friendSet]);

  const pendingFriendCount = incomingRequests.length;

  const orderedFilters = useMemo(() => {
    if (!pendingFriendCount) return FILTERS;
    const friendsTab = FILTERS.find((f) => f.id === 'friends');
    if (!friendsTab) return FILTERS;
    return [
      FILTERS[0],
      friendsTab,
      ...FILTERS.filter((f) => f.id !== 'all' && f.id !== 'friends'),
    ];
  }, [pendingFriendCount]);

  const maxFilterStart = Math.max(0, orderedFilters.length - FILTER_WINDOW);

  const visibleFilters = useMemo(
    () => orderedFilters.slice(filterStart, filterStart + FILTER_WINDOW),
    [orderedFilters, filterStart],
  );

  useEffect(() => {
    const activeIndex = orderedFilters.findIndex((f) => f.id === filter);
    if (activeIndex < 0) return;
    setFilterStart((start) => {
      if (activeIndex < start) return activeIndex;
      if (activeIndex >= start + FILTER_WINDOW) {
        return Math.min(activeIndex - FILTER_WINDOW + 1, maxFilterStart);
      }
      return start;
    });
  }, [filter, orderedFilters, maxFilterStart]);

  useEffect(() => {
    if (!pendingFriendCount) return;
    setFilterStart(0);
  }, [pendingFriendCount]);

  useEffect(() => {
    if (!openMenuKey) return undefined;

    function closeMenu(e) {
      if (!e.target.closest('.conv-row-menu-wrap') && !e.target.closest('.conv-row-dropdown')) {
        setOpenMenuKey(null);
        setMenuPos(null);
      }
    }

    function closeOnEscape(e) {
      if (e.key === 'Escape') {
        setOpenMenuKey(null);
        setMenuPos(null);
      }
    }

    function closeOnScroll(e) {
      // Don't close when scrolling inside the menu itself.
      if (e.target?.closest?.('.conv-row-dropdown')) return;
      setOpenMenuKey(null);
      setMenuPos(null);
    }

    function closeOnResize() {
      setOpenMenuKey(null);
      setMenuPos(null);
    }

    document.addEventListener('pointerdown', closeMenu);
    window.addEventListener('keydown', closeOnEscape);
    // Capture scroll from the conversation list (and nested scrollers).
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnResize);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [openMenuKey]);

  function runMenuAction(action) {
    setOpenMenuKey(null);
    setMenuPos(null);
    action?.();
  }

  const loadDiscover = useCallback(async (q) => {
    setDiscoverLoading(true);
    setDiscoverError('');
    try {
      const { data } = await client.get('/groups/discover', {
        params: q?.trim() ? { q: q.trim() } : undefined,
      });
      setDiscoverItems(data.data || []);
    } catch (err) {
      setDiscoverError(err.response?.data?.error || err.message || 'Failed to load public groups');
      setDiscoverItems([]);
    } finally {
      setDiscoverLoading(false);
    }
  }, []);

  useEffect(() => {
    if (filter !== 'discover' && filter !== 'public') return undefined;
    loadDiscover(searchQuery);
    return undefined;
  }, [filter, searchQuery, loadDiscover]);

  const visibleDiscoverItems =
    filter === 'public' ? discoverItems.filter((g) => g.joinPolicy !== 'request') : discoverItems;
  const discoverEmptyMessage = searchQuery.trim()
    ? filter === 'public'
      ? 'No open public groups match your search.'
      : 'No public groups match your search.'
    : filter === 'public'
      ? 'No open public groups to join right now.'
      : 'No public groups to join right now.';

  async function handleJoin(item) {
    if (!onDiscoverJoin || joiningId) return;
    setJoiningId(item.id);
    try {
      const result = await onDiscoverJoin(item);
      if (result?.pending) {
        setDiscoverItems((prev) =>
          prev.map((g) => (String(g.id) === String(item.id) ? { ...g, joinRequestPending: true } : g))
        );
      } else if (result?.joined) {
        setDiscoverItems((prev) => prev.filter((g) => String(g.id) !== String(item.id)));
      }
    } catch {
      /* toast handled upstream */
    } finally {
      setJoiningId(null);
    }
  }

  const renderConvItem = (c, index, isOtherUser = false) => (
    <motion.div
      key={c.key}
      className={`user-list-item ${c.key === selectedKey ? 'active' : ''} ${c.unread ? 'unread' : ''} ${openMenuKey === c.key ? 'menu-open' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => {
        setOpenMenuKey(null);
        setMenuPos(null);
        onSelect(c);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(c);
        }
      }}
      aria-label={`${c.type === 'group' ? 'Group' : 'Chat'} ${c.title}${c.unreadCount > 0 ? `, ${c.unreadCount} unread` : c.unread ? ', unread' : ''}${c.muted ? ', muted' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.16) }}
      whileHover={{ y: -1 }}
    >
      <span className={`avatar-container ${c.type === 'group' || c.isSelfChat ? 'group' : ''}`}>
        {c.type === 'group' ? (
          <span className="avatar group-avatar">
            <Users size={18} strokeWidth={2} aria-hidden="true" />
          </span>
        ) : c.isSelfChat ? (
          <span className="avatar group-avatar self-chat-avatar">
            <Bookmark size={18} strokeWidth={2} aria-hidden="true" />
          </span>
        ) : (
          <span className="avatar-wrap" style={{ position: 'relative' }}>
            <UserAvatar
              userId={c.id}
              name={c.title}
              hasAvatar={Boolean(c.peer?.hasAvatar)}
              className="conv-row-avatar"
            />
            {c.online && <span className="online-dot" />}
          </span>
        )}
      </span>
      <span className="user-list-meta">
        <span className="user-list-name-row">
          <span className="user-list-name">{c.title}</span>
          {c.pinned && (
            <span className="conv-pinned-icon" title="Pinned" aria-label="Pinned">
              <Pin size={12} strokeWidth={2.2} aria-hidden="true" />
            </span>
          )}
          {c.muted && (
            <span className="conv-muted-icon" title="Muted" aria-label="Muted">
              <BellOff size={12} strokeWidth={2} aria-hidden="true" />
            </span>
          )}
          <span className="conv-row-time">{formatShortRelative(c.lastMessageAt)}</span>
        </span>
        <span className="user-list-sub-row">
          <span className="user-list-lastseen">{c.subtitle || (c.isSelfChat ? 'Notes to self' : '')}</span>
          {(c.unreadCount > 0 || c.unread) && (
            <span className="unread-badge" aria-hidden="true">
              {(c.unreadCount || 1) > 99 ? '99+' : c.unreadCount || 1}
            </span>
          )}
        </span>
      </span>
{!c.isSelfChat && c.type === 'dm' && !c.peer?.isSystemUser && !vaultUnlocked && isPeerVaulted(c.id) && (
      // Decoy view: shows regardless of which filter/tab rendered this row,
      // not just the "all" list's Other-users section. No real
      // friend-request call while locked.
      <button
        type="button"
        className="friend-action-btn add"
        style={{ marginRight: '6px' }}
        onClick={(e) => e.stopPropagation()}
      >
        Add
      </button>
    )}
    {isOtherUser && !c.peer?.isSystemUser && !(!vaultUnlocked && isPeerVaulted(c.id)) && (() => {
        const pendingOut = outgoingRequests.find((r) => String(r.user?.id) === String(c.id));
        const pendingIn = incomingRequests.find((r) => String(r.user?.id) === String(c.id));

        if (pendingOut) {
          return (
            <button
              type="button"
              className="friend-action-btn cancel"
              style={{ marginRight: '6px' }}
              onClick={(e) => {
                e.stopPropagation();
                onCancelFriendRequest?.(pendingOut.id);
              }}
            >
              Cancel
            </button>
          );
        }
        if (pendingIn) {
          return (
            <div className="friend-request-actions" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="friend-action-btn accept"
                aria-label={`Accept request from ${c.title}`}
                onClick={() => onAcceptFriendRequest?.(pendingIn.id)}
              >
                <Check size={15} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                className="friend-action-btn decline"
                aria-label={`Decline request from ${c.title}`}
                onClick={() => onDeclineFriendRequest?.(pendingIn.id)}
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>
          );
        }
        return (
          <button
            type="button"
            className="friend-action-btn add"
            style={{ marginRight: '6px' }}
            onClick={(e) => {
              e.stopPropagation();
              onSendFriendRequest?.(c.id);
            }}
          >
            Add
          </button>
        );
      })()}

      {(onHide || onBlock || onMute || onArchive || onPin) && (
        <div className="conv-row-menu-wrap" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`conv-row-menu ${openMenuKey === c.key ? 'open' : ''}`}
            aria-label={`Options for ${c.title}`}
            aria-haspopup="menu"
            aria-expanded={openMenuKey === c.key}
            onClick={(e) => {
              e.stopPropagation();
              if (openMenuKey === c.key) {
                setOpenMenuKey(null);
                setMenuPos(null);
                return;
              }
              setMenuPos(computeConvMenuPosition(e.currentTarget));
              setOpenMenuKey(c.key);
            }}
          >
            <MoreVertical size={16} />
          </button>
          {openMenuKey === c.key && menuPos
            ? createPortal(
                <div
                  className={`conv-row-dropdown open${menuPos.openUp ? ' open-up' : ''}`}
                  role="menu"
                  aria-label={`Conversation options for ${c.title}`}
                  style={{
                    position: 'fixed',
                    top: menuPos.top,
                    right: menuPos.right,
                    left: menuPos.left,
                    bottom: 'auto',
                  }}
                >
                  <div className="conv-row-dropdown-title">Conversation options</div>
                  {onPin && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runMenuAction(() => onPin(c))}
                    >
                      <Pin size={14} /> {c.pinned ? 'Unpin chat' : 'Pin chat'}
                    </button>
                  )}
                  {onMute && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runMenuAction(() => onMute(c))}
                    >
                      <VolumeX size={14} /> {c.muted ? 'Unmute' : 'Mute'}
                    </button>
                  )}
                  {onArchive && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runMenuAction(() => onArchive(c))}
                    >
                      <Archive size={14} /> {c.archived ? 'Unarchive' : 'Archive'}
                    </button>
                  )}
                  {c.type === 'dm' && onHide && !c.isSelfChat && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runMenuAction(() => onHide(c.peer || c))}
                    >
                      <X size={14} /> Hide chat
                    </button>
                  )}
                 {c.type === 'dm' && onToggleVault && !c.isSelfChat && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runMenuAction(() => onToggleVault(c))}
                    >
                     {isPeerVaulted(c.id) ? (
                        <>
                          <Unlock size={14} /> Remove from vault
                        </>
                      ) : (
                        <>
                          <Lock size={14} /> Add to vault
                        </>
                      )}
                    </button>
                  )}
                  {c.type === 'dm' && onBlock && !c.isSelfChat && (
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => runMenuAction(() => onBlock(c.peer || c))}
                    >
                      <Ban size={14} /> Block user
                    </button>
                  )}
                </div>,
                document.body,
              )
            : null}
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="conversation-panel" ref={panelRef}>
      <div className="sidebar-filters-wrap">
        <button
          type="button"
          className="sidebar-filter-nav"
          aria-label="Previous filters"
          disabled={filterStart <= 0}
          onClick={() => setFilterStart((start) => Math.max(0, start - 1))}
        >
          <ChevronLeft size={16} strokeWidth={2.25} aria-hidden="true" />
        </button>

        <div className="sidebar-filters" role="tablist" aria-label="Conversation filters">
          {visibleFilters.map((f) => {
            const showFriendBadge = f.id === 'friends' && pendingFriendCount > 0;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                aria-label={
                  showFriendBadge
                    ? `Friends, ${pendingFriendCount} pending request${pendingFriendCount === 1 ? '' : 's'}`
                    : f.label
                }
                className={`sidebar-filter-btn${filter === f.id ? ' active' : ''}${
                  showFriendBadge ? ' has-requests' : ''
                }`}
                onClick={() => onFilterChange(f.id)}
              >
                <span className="sidebar-filter-label">
                  {f.id === 'all'
                    ? t('common.all', 'All')
                    : f.id === 'unread'
                      ? t('nav.unread', 'Unread')
                      : f.id === 'groups'
                        ? t('nav.groups', 'Groups')
                        : f.id === 'friends'
                          ? t('common.friendsOnly', 'Friends')
                          : f.label}
                </span>
                {showFriendBadge ? (
                  <span className="sidebar-filter-badge" aria-hidden="true">
                    {pendingFriendCount > 9 ? '9+' : pendingFriendCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="sidebar-filter-nav"
          aria-label="Next filters"
          disabled={filterStart >= maxFilterStart}
          onClick={() => setFilterStart((start) => Math.min(maxFilterStart, start + 1))}
        >
          <ChevronRight size={16} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>

      <div className="sidebar-create-row">
        <button type="button" className="create-group-btn" onClick={onCreateGroup}>
          <UserPlus size={16} strokeWidth={2} aria-hidden="true" />
          {t('nav.newChat', 'New group')}
        </button>
      </div>

      {filter === 'discover' || filter === 'public' ? (
        <div className="user-list discover-list">
          {discoverLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="user-list-item" style={{ pointerEvents: 'none' }}>
                <div className="skeleton skeleton-avatar" />
                <div className="skeleton-user-info">
                  <div className="skeleton skeleton-line short" />
                  <div className="skeleton skeleton-line medium" style={{ marginTop: '4px' }} />
                </div>
              </div>
            ))
          ) : discoverError ? (
            <p className="empty-hint">{discoverError}</p>
          ) : visibleDiscoverItems.length === 0 ? (
            <p className="empty-hint">{discoverEmptyMessage}</p>
          ) : (
            visibleDiscoverItems.map((g, index) => (
              <motion.div
                key={g.id}
                className="user-list-item discover-item"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.16) }}
              >
                <span className="avatar-container group">
                  <span className="avatar group-avatar">
                    <Users size={18} strokeWidth={2} aria-hidden="true" />
                  </span>
                </span>
                <span className="user-list-meta">
                  <span className="user-list-name-row">
                    <span className="user-list-name">{g.name}</span>
                    <span className="discover-badge">
                      {g.joinPolicy === 'request' ? 'Request' : 'Open'}
                    </span>
                  </span>
                  <span className="user-list-lastseen">
                    {g.description?.trim()
                      ? g.description.trim().slice(0, 64)
                      : `${g.memberCount || 0} members`}
                  </span>
                </span>
                <button
                  type="button"
                  className="discover-join-btn"
                  disabled={Boolean(joiningId) || g.joinRequestPending}
                  onClick={() => handleJoin(g)}
                >
                  {g.joinRequestPending
                    ? 'Pending'
                    : joiningId === g.id
                      ? '…'
                      : g.joinPolicy === 'request'
                        ? 'Request'
                        : 'Join'}
                </button>
              </motion.div>
            ))
          )}
        </div>
      ) : filter === 'friends' ? (
        <div className="user-list friends-list">
         <div className="friend-requests-incoming">
            <p className="friend-requests-heading">
              Requests
              {visibleIncomingRequests.length + visibleOutgoingRequests.length > 0 ? (
                <span className="friend-section-count">
                  {visibleIncomingRequests.length + visibleOutgoingRequests.length}
                </span>
              ) : null}
            </p>
            {visibleIncomingRequests.length === 0 && visibleOutgoingRequests.length === 0 ? (
              <div className="friends-empty-card" role="status">
                <UserPlus size={20} strokeWidth={1.75} aria-hidden="true" />
                <p className="friends-empty-title">No pending requests</p>
                <p className="friends-empty-copy">
                  Incoming requests and ones you&apos;ve sent appear here until they&apos;re accepted.
                </p>
              </div>
            ) : (
              <>
                {visibleIncomingRequests.map((r) => {
                  const reqName = getDisplayName(r.user, i18n.language) || r.user.displayName || r.user.username;
                  return (
                    <div key={`in-${r.id}`} className="user-list-item friend-request-item">
                      <span className="avatar-wrap" style={{ position: 'relative' }}>
                        <UserAvatar
                          userId={r.user.id}
                          name={reqName}
                          hasAvatar={Boolean(r.user.hasAvatar)}
                        />
                        {isOnlineUser(r.user, onlineUserIds) && <span className="online-dot" />}
                      </span>
                      <span className="user-list-meta">
                        <span className="user-list-name">{reqName}</span>
                        <span className="user-list-lastseen">Wants to connect · @{r.user.username}</span>
                        {r.moderationWarning?.reportedByMultiple && (
                          <span className="friend-request-safety-warning">
                            ⚠ Reported by multiple people
                            {r.moderationWarning.commonReason ? ` · ${r.moderationWarning.commonReason.replace(/_/g, ' ')}` : ''}
                          </span>
                        )}
                      </span>
                      <div className="friend-request-actions">
                        <button
                          type="button"
                          className="friend-action-btn accept"
                          aria-label={`Accept request from ${reqName}`}
                          onClick={() => onAcceptFriendRequest?.(r.id)}
                        >
                          <Check size={15} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          className="friend-action-btn decline"
                          aria-label={`Decline request from ${reqName}`}
                          onClick={() => onDeclineFriendRequest?.(r.id)}
                        >
                          <X size={15} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {visibleOutgoingRequests.map((r) => {
                  const outName = getDisplayName(r.user, i18n.language) || r.user.displayName || r.user.username;
                  return (
                    <div key={`out-${r.id}`} className="user-list-item friend-request-item">
                      <span className="avatar-wrap" style={{ position: 'relative' }}>
                        <UserAvatar
                          userId={r.user.id}
                          name={outName}
                          hasAvatar={Boolean(r.user.hasAvatar)}
                        />
                        {isOnlineUser(r.user, onlineUserIds) && <span className="online-dot" />}
                      </span>
                      <span className="user-list-meta">
                        <span className="user-list-name">{outName}</span>
                        <span className="user-list-lastseen">Pending · @{r.user.username}</span>
                      </span>
                      <div className="friend-request-actions">
                        <button
                          type="button"
                          className="friend-action-btn cancel"
                          aria-label={`Cancel request to ${outName}`}
                          onClick={() => onCancelFriendRequest?.(r.id)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

         <div className="friend-connections">
            <p className="friend-requests-heading">
              Your friends
              {visibleMyFriends.length > 0 ? (
                <span className="friend-section-count">{visibleMyFriends.length}</span>
              ) : null}
            </p>
            {myFriendsLoading ? (
              [1, 2].map((i) => (
                <div key={i} className="user-list-item friend-skeleton-item" style={{ pointerEvents: 'none' }}>
                  <div className="skeleton skeleton-avatar" />
                  <div className="skeleton-user-info">
                    <div className="skeleton skeleton-line short" />
                    <div className="skeleton skeleton-line medium" style={{ marginTop: '4px' }} />
                  </div>
                </div>
              ))
           ) : visibleMyFriends.length === 0 ? (
              <div className="friends-empty-card" role="status">
                <Users size={20} strokeWidth={1.75} aria-hidden="true" />
                <p className="friends-empty-title">No friends yet</p>
                <p className="friends-empty-copy">
                  Accept a request above, or add someone from People below.
                </p>
              </div>
            ) : (
              visibleMyFriends
                .filter((u) => {
                  const q = searchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return `${u.displayName || ''} ${u.username || ''}`.toLowerCase().includes(q);
                })
                .map((u, index) => (
                  <motion.div
                    key={u.id}
                    className="user-list-item friend-connection-item"
                    role="button"
                    tabIndex={0}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.16) }}
                    onClick={() => onOpenFriend?.(u)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenFriend?.(u);
                      }
                    }}
                  >
                    <span className="avatar-wrap" style={{ position: 'relative' }}>
                      <UserAvatar
                        userId={u.id}
                        name={getDisplayName(u, i18n.language) || u.displayName || u.username}
                        hasAvatar={Boolean(u.hasAvatar)}
                      />
                      {isOnlineUser(u, onlineUserIds) && <span className="online-dot" />}
                    </span>
                    <span className="user-list-meta">
                      <span className="user-list-name">{getDisplayName(u, i18n.language) || u.displayName || u.username}</span>
                      <span className="user-list-lastseen">@{u.username}</span>
                    </span>
                    <span className="friend-chat-hint">Chat</span>
                  </motion.div>
                ))
            )}
          </div>

          <div className="friend-contact-lookup">
            <p className="friend-requests-heading">
              <Mail size={14} strokeWidth={2.2} aria-hidden="true" />
              Find via phone or email
            </p>
            <form
              className="friend-contact-form"
              onSubmit={(e) => {
                e.preventDefault();
                onLookupContact?.();
              }}
            >
              <div className="friend-contact-input-wrap">
                <Phone size={15} strokeWidth={2} aria-hidden="true" className="friend-contact-input-icon" />
                <input
                  type="text"
                  className="friend-contact-input"
                  value={contactQuery}
                  onChange={(e) => onContactQueryChange?.(e.target.value)}
                  placeholder="Email or phone number"
                  autoComplete="off"
                  inputMode="email"
                  aria-label="Find friend by email or phone"
                />
              </div>
              <button
                type="submit"
                className="friend-contact-submit"
                disabled={contactLookupLoading || !contactQuery.trim()}
              >
                {contactLookupLoading ? '…' : <Search size={15} strokeWidth={2.4} aria-hidden="true" />}
                <span>Find</span>
              </button>
            </form>
           {contactLookupError ? (
              <p className="friend-contact-error" role="alert">{contactLookupError}</p>
            ) : null}
            {displayedContactLookupResult ? (
              <motion.div
                className="user-list-item friend-candidate-item"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="avatar-wrap" style={{ position: 'relative' }}>
                  <UserAvatar
                    userId={displayedContactLookupResult.id}
                    name={getDisplayName(displayedContactLookupResult, i18n.language) || displayedContactLookupResult.displayName || displayedContactLookupResult.username}
                    hasAvatar={Boolean(displayedContactLookupResult.hasAvatar)}
                  />
                  {isOnlineUser(displayedContactLookupResult, onlineUserIds) && <span className="online-dot" />}
                </span>
                <span className="user-list-meta">
                  <span className="user-list-name">
                    {getDisplayName(displayedContactLookupResult, i18n.language) || displayedContactLookupResult.displayName || displayedContactLookupResult.username}
                  </span>
                  <span className="user-list-lastseen">
                    @{displayedContactLookupResult.username}
                    {displayedContactLookupResult.matchedBy
                      ? ` · matched by ${displayedContactLookupResult.matchedBy}`
                      : ''}
                  </span>
                </span>
                {displayedContactLookupResult.requestStatus === 'friends' ? (
                  <button
                    type="button"
                    className="friend-action-btn add"
                    onClick={() => onOpenFriend?.(displayedContactLookupResult)}
                  >
                    Chat
                  </button>
                ) : displayedContactLookupResult.requestStatus === 'pending_sent' ? (
                  <button
                    type="button"
                    className="friend-action-btn cancel"
                    onClick={() => onCancelFriendRequest?.(displayedContactLookupResult.requestId)}
                  >
                    Cancel
                  </button>
                ) : displayedContactLookupResult.requestStatus === 'pending_received' ? (
                  <div className="friend-request-actions">
                    <button
                      type="button"
                      className="friend-action-btn accept"
                      onClick={() => onAcceptFriendRequest?.(displayedContactLookupResult.requestId)}
                    >
                      <Check size={15} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      className="friend-action-btn decline"
                      onClick={() => onDeclineFriendRequest?.(displayedContactLookupResult.requestId)}
                    >
                      <X size={15} strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="friend-action-btn add"
                    onClick={
                      displayedContactLookupResult.__vaultedLocked
                        ? undefined
                        : () => onSendFriendRequest?.(displayedContactLookupResult.id)
                    }
                  >
                    Add
                  </button>
                )}
              </motion.div>
            ) : null}
          </div>

          <p className="friend-requests-heading">People</p>
          {friendCandidatesLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="user-list-item friend-skeleton-item" style={{ pointerEvents: 'none' }}>
                <div className="skeleton skeleton-avatar" />
                <div className="skeleton-user-info">
                  <div className="skeleton skeleton-line short" />
                  <div className="skeleton skeleton-line medium" style={{ marginTop: '4px' }} />
                </div>
              </div>
            ))
          ) : friendCandidates.length === 0 ? (
            <div className="friends-empty-card" role="status">
              <Users size={20} strokeWidth={1.75} aria-hidden="true" />
              <p className="friends-empty-title">
                {searchQuery.trim() ? 'No matches' : 'No one new right now'}
              </p>
              <p className="friends-empty-copy">
                {searchQuery.trim()
                  ? 'Try a different name or username.'
                  : 'Search above to find people, or wait for new accounts to appear.'}
              </p>
            </div>
          ) : (
            friendCandidates.map((u, index) => (
              <motion.div
                key={u.id}
                className="user-list-item friend-candidate-item"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.16) }}
              >
                <span className="avatar-wrap" style={{ position: 'relative' }}>
                  <UserAvatar userId={u.id} name={getDisplayName(u, i18n.language) || u.displayName || u.username} hasAvatar={Boolean(u.hasAvatar)} />
                  {isOnlineUser(u, onlineUserIds) && <span className="online-dot" />}
                </span>
                <span className="user-list-meta">
                  <span className="user-list-name">{getDisplayName(u, i18n.language) || u.displayName || u.username}</span>
                  <span className="user-list-lastseen">@{u.username}</span>
                </span>
                {u.requestStatus === 'pending_sent' ? (
                  <button
                    type="button"
                    className="friend-action-btn cancel"
                    onClick={() => onCancelFriendRequest?.(u.requestId)}
                  >
                    Cancel
                  </button>
                ) : u.requestStatus === 'pending_received' ? (
                  <div className="friend-request-actions">
                    <button
                      type="button"
                      className="friend-action-btn accept"
                      aria-label={`Accept request from ${u.displayName || u.username}`}
                      onClick={() => onAcceptFriendRequest?.(u.requestId)}
                    >
                      <Check size={15} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      className="friend-action-btn decline"
                      aria-label={`Decline request from ${u.displayName || u.username}`}
                      onClick={() => onDeclineFriendRequest?.(u.requestId)}
                    >
                      <UserX size={15} strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="friend-action-btn add"
                    onClick={() => onSendFriendRequest?.(u.id)}
                  >
                    Add
                  </button>
                )}
              </motion.div>
            ))
          )}
        </div>
      ) : loading ? (
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
      ) : (
        <div className="user-list">
{filter === 'all' ? (
  <>
    {friendItems.length > 0 && (
      <>
        <p className="friend-requests-heading" style={{ padding: '0 12px 4px' }}>Friends</p>
        {friendItems.map((c, index) => renderConvItem(c, index, false))}
      </>
    )}
    {otherItems.length > 0 && (
      <>
        <p
          className="friend-requests-heading"
          style={{ marginTop: friendItems.length > 0 ? '12px' : '0px', padding: '0 12px 4px' }}
        >
          Other users
        </p>
        {otherItems.map((c, index) => renderConvItem(c, index, true))}
      </>
    )}
  </>
) : (
  conversations.map((c, index) => renderConvItem(c, index, false))
)}
          {conversations.length === 0 && (
            <p className="empty-hint">
              {searchQuery.trim()
                ? 'No users or groups match your search.'
                : filter === 'unread'
                  ? 'No unread conversations.'
                  : filter === 'groups'
                    ? 'No groups yet. Create one to get started.'
                    : filter === 'archived'
                      ? 'No archived conversations.'
                      : 'No conversations yet.'}
            </p>
          )}
          {hasMoreContacts && !searchQuery.trim() && (
            <button
              type="button"
              className="load-older-btn"
              onClick={onLoadMoreContacts}
            >
              Load more contacts
            </button>
          )}
        </div>
      )}

    </div>
  );
}