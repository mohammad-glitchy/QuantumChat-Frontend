import { useTranslation } from 'react-i18next';
import BrandLogo from '../BrandLogo.jsx';
import ConversationList from '../ConversationList.jsx';
import NotificationPermissionBanner from '../NotificationPermissionBanner.jsx';
import SidebarMenu from '../SidebarMenu.jsx';
import StoriesRail from '../StoriesRail.jsx';
import { getDisplayName } from '../../utils/getDisplayName.js';

/**
 * Left conversation pane — list, filters, stories.
 */
export default function ConversationPane({
  user,
  canChat,
  sidebarOpen,
  onCloseSidebar,
  onSettings,
  onLogout,
   onMarkAllRead,
  vaultEnabled,
  vaultUnlocked,
  onOpenVault,
  storiesRailRef,
  users,
  onStoriesError,
  notifSettings,
  search,
  onSearchChange,
  conversations,
  filter,
  onFilterChange,
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
  loadingUsers,
    hasMoreContacts,
  onLoadMoreContacts,
  friendCandidates,
  friendCandidatesLoading,
  incomingRequests,
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
  onlineUserIds,  
  onOpenStarred,
}) {
  const { t, i18n } = useTranslation();

  return (
    <>
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={onCloseSidebar}
        aria-hidden={!sidebarOpen}
      />
      <aside className={`sidebar qc-conversation-pane ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-brand-mark">
              <BrandLogo size={40} />
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-username">{getDisplayName(user, i18n.language) || user.username}</div>
              <div className="sidebar-lastseen sidebar-status-online">{t('common.online', 'online')}</div>
            </div>
          </div>
          <div className="sidebar-header-actions">
         <SidebarMenu
            onSettings={onSettings}
            onLogout={onLogout}
            onMarkAllRead={onMarkAllRead}
            onOpenStarred={onOpenStarred}
            vaultEnabled={vaultEnabled}
            vaultUnlocked={vaultUnlocked}
            onOpenVault={onOpenVault}
          />
          </div>
        </div>
        <NotificationPermissionBanner />
        {canChat && (
          <>
            <StoriesRail
              ref={storiesRailRef}
              currentUser={user}
              users={users}
              onError={onStoriesError}
              notifSettings={notifSettings}
            />
            <div className="sidebar-search">
              <input
                placeholder={t('nav.searchChats', 'Search conversations…')}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                aria-label={t('nav.searchChats', 'Search conversations')}
              />
            </div>
          </>
        )}
        {canChat ? (
          <ConversationList
            currentUser={user}
            conversations={conversations}
            filter={filter}
            onFilterChange={onFilterChange}
            selectedKey={selectedKey}
            onSelect={onSelect}
            onCreateGroup={onCreateGroup}
            onDiscoverJoin={onDiscoverJoin}
          onHide={onHide}
            onBlock={onBlock}
            onMute={onMute}
            onArchive={onArchive}
            onPin={onPin}
            onToggleVault={onToggleVault}
            loading={loadingUsers}
            searchQuery={search}
            friendCandidates={friendCandidates}
            friendCandidatesLoading={friendCandidatesLoading}
            incomingRequests={incomingRequests}
            outgoingRequests={outgoingRequests}
            myFriends={myFriends}
            myFriendsLoading={myFriendsLoading}
            contactQuery={contactQuery}
            onContactQueryChange={onContactQueryChange}
            contactLookupResult={contactLookupResult}
            contactLookupLoading={contactLookupLoading}
            contactLookupError={contactLookupError}
            onLookupContact={onLookupContact}
            onSendFriendRequest={onSendFriendRequest}
            onCancelFriendRequest={onCancelFriendRequest}
            onAcceptFriendRequest={onAcceptFriendRequest}
            onDeclineFriendRequest={onDeclineFriendRequest}
            onOpenFriend={onOpenFriend}
            onlineUserIds={onlineUserIds} 
            hasMoreContacts={hasMoreContacts}
            onLoadMoreContacts={onLoadMoreContacts}
          />
        ) : (
          <p className="empty-hint">Set up your device key to see people.</p>
        )}
      </aside>
    </>
  );
}
