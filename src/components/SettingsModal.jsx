import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Search } from 'lucide-react';
import client, { getMyReferrals, unmuteChat, updatePrivacySettings } from '../api/client.js';

import {
  approveDeviceLink,
  buildQrPayload,
  createDeviceLinkRequest,
  listDeviceSessions as listLinkedDeviceSessions,
  rejectDeviceLink,
  revokeDeviceSession as revokeDeviceSessionApi,
  sendDeviceLinkEmail as sendDeviceLinkEmailApi
} from '../api/deviceLink.js';
import { connectSocket, getSocket } from '../api/socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotificationSettings } from '../context/NotificationSettingsContext.jsx';
import { APP_ICONS, FUN_THEMES, useTheme } from '../context/ThemeContext.jsx';
import { getCurrentKeySet, getSessionId } from '../crypto/keyStorage.js';
import { decryptVaultPayload, encryptVaultPayload } from '../crypto/keyVault.js';
import { SUPPORTED_LANGUAGES, setAppLanguage } from '../i18n/index.js';
import {
  disablePushNotifications,
  enablePushNotifications,
  getNotificationPermission,
} from '../utils/pushNotifications.js';
import { playReceiveSound, unlockAudio } from '../utils/sounds.js';
import { detectBrowserTimezone, getTimezoneList } from '../utils/timezones.js';
import { publicInviteLink } from '../utils/publicAppUrl.js';
import { formatLastSeen } from '../utils/formatLastSeen.js';
import DeviceLinkRequestModal from './DeviceLinkRequestModal.jsx';
import DeviceLinkSetupModal from './DeviceLinkSetupModal.jsx';
import ThemeSwitcher, { FunThemeSwitcher } from './ThemeSwitcher.jsx';
import PrivacySelect from './ui/PrivacySelect.jsx';
import UserAvatar, { bustAvatarCache } from './UserAvatar.jsx';

function parseMutedKey(key, myId) {
  if (!key) return null;
  if (key.startsWith('group:')) {
    return { type: 'group', id: key.slice('group:'.length) };
  }
  if (key.startsWith('dm:')) {
    const [a, b] = key.slice('dm:'.length).split(':');
    const otherId = String(a) === String(myId) ? b : a;
    return { type: 'dm', id: otherId };
  }
  return null;
}

function formatMuteExpiry(expiresAt) {
  if (!expiresAt) return 'Muted forever';
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return 'Muted forever';
  return `Muted until ${date.toLocaleString()}`;
}

function ToggleRow({ label, hint, checked, onChange, disabled, className = '', showStatusBadge = false }) {
  return (
    <button
      type="button"
      className={`settings-row ${className}`.trim()}
      onClick={() => !disabled && onChange?.(!checked)}
      disabled={disabled}
    >
      <span className="settings-row-left">
        <span className="settings-row-label">{label}</span>
        {hint ? <span className="settings-row-hint">{hint}</span> : null}
      </span>
      <span className="settings-row-right">
        {showStatusBadge && (
          <span className={`settings-status-chip ${checked ? 'active' : ''}`}>
            {checked ? 'Enabled' : 'Off'}
          </span>
        )}
        <span className={`menu-switch ${checked ? 'on' : ''}`} aria-hidden="true">
          <span className="menu-switch-knob" />
        </span>
      </span>
    </button>
  );
}

const TABS = [
  ['profile', 'Profile'],
  ['privacy', 'Privacy'],
  ['notifications', 'Notifications'],
  ['security', 'Security'],
  ['blocked', 'Blocked'],
  ['data', 'Data'],
];

const THEME_LABELS = {
  light: 'Light',
  dark: 'Dark',
  eyecare: 'Eyecare',
  moonveil: 'Moonveil',
  sakura: 'Sakura',
  sunset: 'Sunset Ember',
  aurora: 'Aurora',
  ocean: 'Bioluminescent',
  nebula: 'Nebula',
  dreamcloud: 'Dreamcloud',
};

export default function SettingsModal({
  user,
  onClose,
  onImportKeys,
  onGenerateKeys,
  onUserUpdated,
  onLogout,
  onExportChat,
  initialTab = 'profile',
  className = '',
}) {
  const { t, i18n } = useTranslation();
  const { theme, appIcon, setAppIcon } = useTheme();
  const { importKeys, keyringSync, keyringNeedsResync, verifyKeySync } = useAuth();
  const { settings: notifSettings, updateSettings: updateNotifSettings } = useNotificationSettings();
  const closeRef = useRef(null);
  const keyInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const [tab, setTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
 

 
  
  const bodyRef = useRef(null);

  useEffect(() => {
    const container = bodyRef.current;
    if (!container) return;
    
    const query = searchQuery.trim().toLowerCase();
    
    const blocks = container.querySelectorAll('.settings-section > div, .settings-section > button, .settings-section > ul');
    
    blocks.forEach(block => {
      block.style.display = '';
      const items = block.querySelectorAll('.settings-field, .settings-row, .settings-skin-card, .privacy-friend-item, .settings-lang-card, li');
      items.forEach(item => item.style.display = '');

      if (!query) return;

      if (!block.textContent.toLowerCase().includes(query)) {
        block.style.display = 'none';
        return;
      }

      const title = block.querySelector('.settings-section-title, h3, h4, strong');
      if (title && title.textContent.toLowerCase().includes(query)) {
        return; 
      }

      items.forEach(item => {
        if (!item.textContent.toLowerCase().includes(query)) {
          item.style.display = 'none';
        }
      });
    });
  }, [searchQuery, tab]);  

  const [activeLang, setActiveLang] = useState(() => user?.preferredLanguage || i18n.language || 'en');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [notifPermission, setNotifPermission] = useState(() => getNotificationPermission());

  async function handleLanguageChange(langCode) {
    setActiveLang(langCode);
    setAppLanguage(langCode);
    try {
      await client.patch('/users/me/language', { language: langCode });
      onUserUpdated?.({ ...user, preferredLanguage: langCode });
    } catch (err) {
      console.warn('Failed to persist preferred language to backend:', err);
    }
  }

  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [statusText, setStatusText] = useState(user?.statusText || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [dateOfBirth, setDateOfBirth] = useState(
    user?.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : '',
  );
  const [timezone, setTimezone] = useState(user?.timezone || detectBrowserTimezone());
  const timezoneOptions = useState(getTimezoneList)[0];
  const [transliteratedNames, setTransliteratedNames] = useState(() => ({
    ur: user?.transliteratedNames?.ur || '',
    ar: user?.transliteratedNames?.ar || '',
    fa: user?.transliteratedNames?.fa || '',
    hi: user?.transliteratedNames?.hi || '',
    zh: user?.transliteratedNames?.zh || '',
    ru: user?.transliteratedNames?.ru || '',
  }));

  useEffect(() => {
    if (user?.transliteratedNames) {
      setTransliteratedNames({
        ur: user.transliteratedNames.ur || '',
        ar: user.transliteratedNames.ar || '',
        fa: user.transliteratedNames.fa || '',
        hi: user.transliteratedNames.hi || '',
        zh: user.transliteratedNames.zh || '',
        ru: user.transliteratedNames.ru || '',
      });
    }
  }, [user]);
  const [privacy, setPrivacy] = useState({
    lastSeen: user?.privacy?.lastSeen || 'everyone',
    readReceipts: typeof user?.privacy?.readReceipts === 'boolean'
      ? (user.privacy.readReceipts ? 'everyone' : 'nobody')
      : (user?.privacy?.readReceipts || 'everyone'),
    typingIndicator: user?.privacy?.typingIndicator !== false,
    onlineStatus: user?.privacy?.onlineStatus || (user?.privacy?.online === 'nobody' ? 'selected' : (user?.privacy?.online || 'everyone')),
    onlineStatusVisibleTo: Array.isArray(user?.privacy?.onlineStatusVisibleTo)
      ? user.privacy.onlineStatusVisibleTo.map((id) => String(id._id || id))
      : [],
    whoCanMessage: user?.privacy?.whoCanMessage || 'everyone',
    discoverable: user?.privacy?.discoverable || 'everyone',
    story: user?.privacy?.story || 'everyone',
    storyViewers: Array.isArray(user?.privacy?.storyViewers)
      ? user.privacy.storyViewers.map((id) => String(id._id || id))
      : [],
    profileVisibility: user?.privacy?.profileVisibility || 'everyone',
    birthdayVisibility: user?.privacy?.birthdayVisibility || 'everyone',
    whoCanMention: user?.privacy?.whoCanMention || 'everyone',
    whoCanAddToGroups: user?.privacy?.whoCanAddToGroups || 'everyone',
    whoCanInviteViaGroupLink: user?.privacy?.whoCanInviteViaGroupLink || 'everyone',
    whoCanCreateGroupsWithMe: user?.privacy?.whoCanCreateGroupsWithMe || 'everyone',
    groupMentions: user?.privacy?.groupMentions || 'everyone',
    screenshotProtection: user?.privacy?.screenshotProtection === true,
    viewStoriesAnonymously: user?.privacy?.viewStoriesAnonymously === true,
  });
  const [friendsList, setFriendsList] = useState([]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [blocked, setBlocked] = useState([]);
  const [deletePassword, setDeletePassword] = useState('');
  const [sessions, setSessions] = useState([]);
  const [deviceLinkModalOpen, setDeviceLinkModalOpen] = useState(false);
  const [deviceLinkSetupModalOpen, setDeviceLinkSetupModalOpen] = useState(false);
  const [deviceLinkRequest, setDeviceLinkRequest] = useState(null);
  const [deviceLinkBusy, setDeviceLinkBusy] = useState(false);
  const [deviceLinkState, setDeviceLinkState] = useState('idle');
  const [deviceLinkQr, setDeviceLinkQr] = useState('');
  const [deviceLinkExpiresAt, setDeviceLinkExpiresAt] = useState(null);
  const [deviceLinkTimeLeft, setDeviceLinkTimeLeft] = useState(0);
  const [deviceLinkError, setDeviceLinkError] = useState('');
  const [deviceLinkLinkId, setDeviceLinkLinkId] = useState('');
  const [deviceLinkToken, setDeviceLinkToken] = useState('');
  const [deviceLinkLoading, setDeviceLinkLoading] = useState(false);
  const [deviceLinkStatusText, setDeviceLinkStatusText] = useState('');
  const [deviceLinkEmail, setDeviceLinkEmail] = useState('');
  const [deviceLinkEmailBusy, setDeviceLinkEmailBusy] = useState(false);
  const [deviceLinkEmailMessage, setDeviceLinkEmailMessage] = useState('');
  const [deviceLinkConfirmOpen, setDeviceLinkConfirmOpen] = useState(false);
  const [deviceLinkConfirmSession, setDeviceLinkConfirmSession] = useState(null);
  const [deviceLinkRefreshing, setDeviceLinkRefreshing] = useState(false);
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [vaultPassphraseConfirm, setVaultPassphraseConfirm] = useState('');
  const [vaultHasBackup, setVaultHasBackup] = useState(false);
  const [blindnessReport, setBlindnessReport] = useState(null);
  const [blindnessBusy, setBlindnessBusy] = useState(false);
  const [totpSetup, setTotpSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpPassword, setTotpPassword] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [directoryGroups, setDirectoryGroups] = useState([]);
  const shownName = user?.displayName || user?.username || 'You';
  const currentSessionId = getSessionId();
  const [verifyLinkUrl, setVerifyLinkUrl] = useState('');
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function onKeyDown(e) {
      if (e.key === 'Escape') onCloseRef.current?.();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []); // safe: onClose is read via ref, so no dep needed

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (tab !== 'blocked') return;
    client
      .get('/users/me/blocked')
      .then((res) => setBlocked(res.data.data || []))
      .catch(() => setBlocked([]));
  }, [tab]);

  useEffect(() => {
    if (tab !== 'security') return;
    let cancelled = false;
    setDeviceLinkError('');
    setDeviceLinkStatusText('');
    client
      .get('/users/me/sessions')
      .then((res) => {
        if (!cancelled) setSessions(res.data.data || []);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    client
      .get('/users/me/vault')
      .then(() => {
        if (!cancelled) setVaultHasBackup(true);
      })
      .catch(() => {
        if (!cancelled) setVaultHasBackup(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);
  useEffect(() => {
    if (tab !== 'notifications') return;
    setNotifPermission(getNotificationPermission());
    client.get('/users').then((res) => setDirectoryUsers(res.data.data || [])).catch(() => setDirectoryUsers([]));
    client.get('/groups').then((res) => setDirectoryGroups(res.data.data || [])).catch(() => setDirectoryGroups([]));
  }, [tab]);

  async function enableBrowserNotifications() {
    setBusy(true);
    setError('');
    setOk('');
    unlockAudio();
    const res = await enablePushNotifications();
    setNotifPermission(res.permission || getNotificationPermission());
    if (res.permission === 'granted') {
      await updateNotifSettings({
        webNotifications: { ...(notifSettings.webNotifications || {}), enabled: true },
      });
      setOk(
        res.push
          ? 'Browser notifications enabled (including when QuantumChat is closed)'
          : 'Browser notifications enabled'
      );
    } else {
      setError(res.error || 'Could not enable notifications');
    }
    setBusy(false);
  }

  async function testNotificationSound() {
    unlockAudio();
    setError('');
    setOk('');
    const scale =
      typeof notifSettings?.soundVolume === 'number' ? notifSettings.soundVolume / 100 : 0.8;
    playReceiveSound(scale);

    let permission = getNotificationPermission();
    if (permission === 'default') {
      const res = await enablePushNotifications();
      permission = res.permission || getNotificationPermission();
      setNotifPermission(permission);
    }

    if (permission === 'granted' && notifSettings?.webNotifications?.enabled !== false) {
      try {
        // eslint-disable-next-line no-new
        new Notification('QuantumChat', {
          body: 'Test notification — you will see alerts like this for new messages.',
          icon: '/logo.png',
          silent: false,
          tag: 'quantumchat-test',
        });
        setOk('Played test sound and showed a notification');
      } catch {
        setOk('Played test sound');
      }
    } else if (permission === 'denied') {
      setError('Notifications are blocked in the browser. Allow them in site settings, then try again.');
    } else {
      setOk('Played test sound');
    }
  }
  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setAvatarBusy(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const { data } = await client.post('/users/me/avatar', form);
      bustAvatarCache(user.id);
      onUserUpdated?.(data.data);
      setOk('Profile photo updated');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload profile photo');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setBusy(true);
    setError('');
    try {
      const { data } = await client.delete('/users/me/avatar');
      bustAvatarCache(user.id);
      onUserUpdated?.(data.data);
      setOk('Profile photo removed');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove photo');
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setBusy(true);
    setError('');
    setOk('');
    try {
      const { data } = await client.patch('/users/me', {
        username: username.trim(),
        displayName: displayName.trim(),
        bio: bio.trim(),
        statusText: statusText.trim(),
        phone: phone.trim(),
        dateOfBirth: dateOfBirth || '',
        timezone,
        transliteratedNames,
      });
      onUserUpdated?.(data.data);
      setOk('Profile saved');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (tab !== 'privacy' && tab !== 'notifications') return;

    client
      .get('/users/friends')
      .then((res) => setFriendsList(res.data.data || []))
      .catch(() => setFriendsList([]));
  }, [tab]);

  const [referralInfo, setReferralInfo] = useState(null);
  const [referralLoading, setReferralLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'invite') return;
    setReferralLoading(true);
    getMyReferrals()
      .then((res) => setReferralInfo(res.data))
      .catch(() => setReferralInfo(null))
      .finally(() => setReferralLoading(false));
  }, [tab]);

  function inviteShareText(link) {
    return `Join me on QuantumChat, a private end-to-end encrypted messenger: ${link}`;
  }

  const shareInviteLink = referralInfo
    ? publicInviteLink(referralInfo.referralCode, referralInfo.referralLink)
    : '';

  async function shareInviteNative() {
    if (!shareInviteLink) return;
    const text = inviteShareText(shareInviteLink);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on QuantumChat', text, url: shareInviteLink });
      } catch {
        // user cancelled share sheet
      }
    } else {
      copyInviteLink();
    }
  }

  async function copyInviteLink() {
    if (!shareInviteLink) return;
    try {
      await navigator.clipboard.writeText(shareInviteLink);
      setOk('Invite link copied');
    } catch {
      setError('Could not copy link');
    }
  }

  useEffect(() => {
    if (tab !== 'security') return undefined;
    const socket = getSocket() || connectSocket();
    if (!socket) return undefined;

    const handleLinkRequest = (payload) => {
      setDeviceLinkRequest(payload);
      setDeviceLinkModalOpen(true);
      setDeviceLinkState('request');
      setDeviceLinkStatusText('A new device is waiting for your approval.');
      setDeviceLinkError('');
    };

    const handleLinked = async () => {
      await refreshDeviceSessions();
    };

    const handleRevoked = async () => {
      await refreshDeviceSessions();
    };

    socket.on('device:link-request', handleLinkRequest);
    socket.on('device:linked', handleLinked);
    socket.on('device:revoked', handleRevoked);
    return () => {
      socket.off('device:link-request', handleLinkRequest);
      socket.off('device:linked', handleLinked);
      socket.off('device:revoked', handleRevoked);
    };
  }, [tab]);

  async function updatePrivacyField(key, val) {
    const updated = { ...privacy, [key]: val };
    setPrivacy(updated);
    setBusy(true);
    setError('');
    setOk('');
    try {
      const res = await updatePrivacySettings(updated);
      if (res?.data && typeof res.data === 'object') {
        setPrivacy((prev) => ({ ...prev, ...res.data }));
      }
      onUserUpdated?.(res.user || { ...user, privacy: res.data || updated });
      if (key === 'typingIndicator') {
        const socket = getSocket() || connectSocket();
        socket?.emit('privacy:typing-indicator', { enabled: Boolean(val) });
      }
      if (key === 'screenshotProtection') {
        setOk(
          val
            ? 'Screenshot protection on — only your chats are protected for others'
            : 'Screenshot protection off'
        );
      } else {
        setOk('Privacy settings saved');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save privacy');
    } finally {
      setBusy(false);
    }
  }
  /**
   * Turning this ON is a one-way trade-off the user might not fully register from
   * the hint text alone — it also silently disables their own "who viewed my
   * story" list. Confirm explicitly before flipping it on. Turning it back off
   * has no such downside, so that direction needs no confirmation.
   */
  function toggleViewStoriesAnonymously(nextVal) {
    if (nextVal === true) {
      const confirmed = window.confirm(
        'Turn on "View stories anonymously"?\n\n' +
          "You'll no longer see who viewed your own stories while this is on — only the view count. " +
          'You can turn it back off anytime to see viewer names again.'
      );
      if (!confirmed) return;
    }
    updatePrivacyField('viewStoriesAnonymously', nextVal);
  }
  function toggleSelectedFriend(friendId) {
    const current = new Set(privacy.onlineStatusVisibleTo || []);
    if (current.has(friendId)) {
      current.delete(friendId);
    } else {
      current.add(friendId);
    }
    updatePrivacyField('onlineStatusVisibleTo', [...current]);
  }

  function toggleStatusNotificationFriend(friendId) {
    const current = new Set(notifSettings.statusNotificationsSelectedFriends || []);
    if (current.has(friendId)) {
      current.delete(friendId);
    } else {
      current.add(friendId);
    }
    updateNotifField('statusNotificationsSelectedFriends', [...current]);
  }

  function toggleStoryViewer(friendId) {
    const current = new Set(privacy.storyViewers || []);
    if (current.has(friendId)) {
      current.delete(friendId);
    } else {
      current.add(friendId);
    }
    updatePrivacyField('storyViewers', [...current]);
  }

  async function savePrivacy() {
    updatePrivacyField('lastSeen', privacy.lastSeen);
  }
  async function updateNotifField(key, val) {
    setBusy(true);
    setError('');
    setOk('');
    const res = await updateNotifSettings({ [key]: val });
    if (res.success) {
      setOk('Notification settings saved');
    } else {
      setError(res.error || 'Failed to save notification settings');
    }
    setBusy(false);
  }
  async function updateNotifNested(parentKey, childKey, val) {
    setBusy(true);
    setError('');
    setOk('');

    if (parentKey === 'webNotifications' && childKey === 'enabled' && val === true) {
      unlockAudio();
      const perm = await enablePushNotifications();
      setNotifPermission(perm.permission || getNotificationPermission());
      if (perm.permission !== 'granted') {
        setError(perm.error || 'Allow notifications in your browser to enable this');
        setBusy(false);
        return;
      }
    }

    if (parentKey === 'webNotifications' && childKey === 'enabled' && val === false) {
      await disablePushNotifications();
    }

    const nextParent = { ...(notifSettings[parentKey] || {}), [childKey]: val };
    const res = await updateNotifSettings({ [parentKey]: nextParent });
    if (res.success) {
      setOk('Notification settings saved');
    } else {
      setError(res.error || 'Failed to save notification settings');
    }
    setBusy(false);
  }
  async function unmuteFromList(key) {
    const parsed = parseMutedKey(key, user?.id);
    if (!parsed) return;
    setBusy(true);
    setError('');
    setOk('');
    try {
      const res = await unmuteChat(parsed.type === 'group' ? { groupId: parsed.id } : { peerId: parsed.id });
      if (res?.data) onUserUpdated?.(res.data);
      setOk('Chat unmuted');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unmute chat');
    } finally {
      setBusy(false);
    }
  }
  async function changePassword() {
    setBusy(true);
    setError('');
    setOk('');
    try {
      await client.post('/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setOk('Password updated');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setBusy(false);
    }
  }

  async function start2faSetup() {
    setTotpBusy(true);
    setError('');
    setOk('');
    try {
      const { data } = await client.post('/auth/2fa/setup');
      setTotpSetup(data.data);
      setTotpCode('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start 2FA setup');
    } finally {
      setTotpBusy(false);
    }
  }

  async function confirmEnable2fa() {
    setTotpBusy(true);
    setError('');
    setOk('');
    try {
      const { data } = await client.post('/auth/2fa/enable', { token: totpCode.trim() });
      onUserUpdated?.(data.data.user);
      setTotpSetup(null);
      setTotpCode('');
      setOk('Two-factor authentication enabled');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to enable 2FA');
    } finally {
      setTotpBusy(false);
    }
  }

  async function confirmDisable2fa() {
    setTotpBusy(true);
    setError('');
    setOk('');
    try {
      const { data } = await client.post('/auth/2fa/disable', {
        password: totpPassword,
        token: totpCode.trim(),
      });
      onUserUpdated?.(data.data.user);
      setTotpPassword('');
      setTotpCode('');
      setOk('Two-factor authentication disabled');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disable 2FA');
    } finally {
      setTotpBusy(false);
    }
  }

  async function refreshDeviceSessions() {
    setDeviceLinkRefreshing(true);
    try {
      const data = await listLinkedDeviceSessions();
      setSessions(data || []);
    } catch {
      setSessions([]);
    } finally {
      setDeviceLinkRefreshing(false);
    }
  }

  function closeDeviceLinkModal() {
    setDeviceLinkModalOpen(false);
    setDeviceLinkRequest(null);
    setDeviceLinkState('idle');
    setDeviceLinkError('');
    setDeviceLinkStatusText('');
  }

  function closeDeviceLinkSetupModal() {
    setDeviceLinkSetupModalOpen(false);
    setDeviceLinkLoading(false);
    setDeviceLinkError('');
    setDeviceLinkStatusText('');
  }

  async function openDeviceLinkModal() {
    setDeviceLinkError('');
    setDeviceLinkStatusText('Preparing a new device link…');
    setDeviceLinkLoading(true);
    setDeviceLinkSetupModalOpen(true);
    try {
      const payload = await createDeviceLinkRequest();
      const qrPayload = buildQrPayload(payload.linkId, payload.token);
      const qrUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 220 });
      setDeviceLinkLinkId(payload.linkId);
      setDeviceLinkToken(payload.token);
      setDeviceLinkExpiresAt(payload.expiresAt);
      setDeviceLinkQr(qrUrl);
      setDeviceLinkState('waiting');
      setDeviceLinkStatusText('Scan the QR code or paste the payload from the new device.');
    } catch (err) {
      setDeviceLinkState('idle');
      setDeviceLinkSetupModalOpen(true);
      setDeviceLinkError(err?.response?.data?.error || err?.message || 'Unable to prepare the pairing request.');
    } finally {
      setDeviceLinkLoading(false);
    }
  }

  async function confirmDeviceLinkApprove() {
    if (!deviceLinkRequest?.linkId) return;
    setDeviceLinkBusy(true);
    try {
      await approveDeviceLink(deviceLinkRequest.linkId);
      setDeviceLinkState('approved');
      setDeviceLinkStatusText('Device linked successfully.');
      await refreshDeviceSessions();
      setDeviceLinkModalOpen(false);
      setDeviceLinkRequest(null);
    } catch (err) {
      setDeviceLinkError(err?.response?.data?.error || err?.message || 'Unable to approve the link request.');
    } finally {
      setDeviceLinkBusy(false);
    }
  }

  async function confirmDeviceLinkReject() {
    if (!deviceLinkRequest?.linkId) return;
    setDeviceLinkBusy(true);
    try {
      await rejectDeviceLink(deviceLinkRequest.linkId);
      setDeviceLinkState('rejected');
      setDeviceLinkStatusText('The link request was rejected.');
    } catch (err) {
      setDeviceLinkError(err?.response?.data?.error || err?.message || 'Unable to reject the link request.');
    } finally {
      setDeviceLinkBusy(false);
    }
  }

  async function sendDeviceLinkEmail() {
    if (!deviceLinkLinkId || !deviceLinkToken) {
      setDeviceLinkError('Create a new pairing request first.');
      return;
    }
    if (!deviceLinkEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(deviceLinkEmail)) {
      setDeviceLinkError('Enter a valid email address.');
      return;
    }
    setDeviceLinkEmailBusy(true);
    setDeviceLinkEmailMessage('');
    try {
      const result = await sendDeviceLinkEmailApi({ linkId: deviceLinkLinkId, token: deviceLinkToken });
      setDeviceLinkEmailMessage(result?.message || 'Pairing link sent.');
    } catch (err) {
      setDeviceLinkError(err?.response?.data?.error || 'Unable to send the pairing link.');
    } finally {
      setDeviceLinkEmailBusy(false);
    }
  }

  async function revokeDeviceSession(sessionId) {
    const isSelf = sessionId && currentSessionId && sessionId === currentSessionId;
    if (
      isSelf &&
      !window.confirm('Revoke this device? You will be signed out here.')
    ) {
      return;
    }
    setBusy(true);
    setError('');
    setOk('');
    try {
      if (!isSelf) {
        await revokeDeviceSessionApi(sessionId);
      } else {
        await client.delete(`/users/me/sessions/${sessionId}`);
      }
      if (isSelf) {
        onLogout?.();
        return;
      }
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      setOk('Device session revoked');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to revoke session');
    } finally {
      setBusy(false);
    }
  }

  async function loadBlindnessReport() {
    setBlindnessBusy(true);
    setError('');
    try {
      const { data } = await client.get('/trust/blindness');
      setBlindnessReport(data.data || null);
    } catch (err) {
      setBlindnessReport(null);
      setError(err.response?.data?.error || 'Failed to load blindness report');
    } finally {
      setBlindnessBusy(false);
    }
  }

  async function backupToVault() {
    if (!vaultPassphrase || vaultPassphrase.length < 8) {
      setError('Vault passphrase must be at least 8 characters');
      return;
    }
    if (vaultPassphrase !== vaultPassphraseConfirm) {
      setError('Passphrase confirmation does not match');
      return;
    }
    const keySet = getCurrentKeySet(user.id);
    if (!keySet.length) {
      setError('No local keys to back up — import or generate keys first');
      return;
    }
    setBusy(true);
    setError('');
    setOk('');
    try {
      const secretKeysJson = JSON.stringify(keySet.map((k) => k.secretKey));
      const payload = await encryptVaultPayload(vaultPassphrase, secretKeysJson);
      await client.put('/users/me/vault', payload);
      setVaultHasBackup(true);
      setVaultPassphrase('');
      setVaultPassphraseConfirm('');
      setOk('Keys backed up to encrypted vault');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Vault backup failed');
    } finally {
      setBusy(false);
    }
  }

  async function restoreFromVault() {
    if (!vaultPassphrase) {
      setError('Enter your vault passphrase to restore');
      return;
    }
    setBusy(true);
    setError('');
    setOk('');
    try {
      const { data } = await client.get('/users/me/vault');
      const secretKeysJson = await decryptVaultPayload(vaultPassphrase, data.data);
      const secretKeys = JSON.parse(secretKeysJson);
      if (!Array.isArray(secretKeys)) {
        throw new Error('Vault contents are invalid');
      }
      await importKeys(secretKeys);
      setVaultPassphrase('');
      setVaultPassphraseConfirm('');
      setOk('Keys restored from vault');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Vault restore failed');
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    setBusy(true);
    setError('');
    setOk('');
    setVerifyLinkUrl('');
    try {
      const { data } = await client.post('/auth/resend-verification');
      onUserUpdated?.(data.data.user);
      setOk(data.data.message || 'Verification email sent — check your inbox');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend verification');
    } finally {
      setBusy(false);
    }
  }

  async function unblock(id) {
    setBusy(true);
    try {
      const { data } = await client.delete(`/users/${id}/block`);
      onUserUpdated?.(data.data);
      setBlocked((prev) => prev.filter((u) => String(u.id) !== String(id)));
      setOk('User unblocked');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unblock');
    } finally {
      setBusy(false);
    }
  }

  async function downloadData() {
    setBusy(true);
    setError('');
    try {
      const { data } = await client.get('/users/me/export');
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quantumchat-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setOk('Account data downloaded (ciphertext messages not included)');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download data');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!deletePassword) {
      setError('Enter your password to delete the account');
      return;
    }
    if (
      !window.confirm(
        'Permanently delete your account? Encrypted message history on the server will be removed. Local keys on this device should be backed up first.'
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await client.delete('/users/me', { data: { password: deletePassword } });
      onLogout?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete account');
      setBusy(false);
    }
  }

  return (
    <div className="create-group-overlay" role="presentation" onClick={onClose}>
      <div
        className={`settings-modal settings-modal-wide ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-modal-header">
          <div className="settings-modal-heading">
            <h2 id="settings-title">{t('settings.title', 'Settings')}</h2>
            <p>
              {
                {
                  profile: t('settings.profile.subtitle', 'Manage your public identity, avatar, and system preferences'),
                  privacy: t('settings.privacy.subtitle', 'Control who can view your profile info, last seen, and activity'),
                  notifications: t('settings.notifications.subtitle', 'Configure sound alerts, push notifications, and quiet hours'),
                  security: t('settings.security.subtitle', 'Manage encryption keys, active sessions, and multi-factor authentication'),
                  blocked: t('settings.blocked.subtitle', 'Review blocked contacts and moderation settings'),
                  data: t('settings.data.subtitle', 'Export archives, manage storage usage, and account data'),
                }[tab] || t('settings.subtitle', 'Profile, privacy, security, and app preferences')
              }
            </p>
          </div>
          <button ref={closeRef} type="button" className="settings-close settings-close-btn" onClick={onClose} aria-label={t('common.close', 'Close')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

       {/* Added Search Box */}
        <div className="settings-search-bar" style={{ padding: '0 24px 12px 24px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 36, top: 10, color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search settings..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px 12px 8px 36px', 
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        <nav className="settings-tabs settings-nav" aria-label="Settings sections">
          {[
            {
              id: 'profile',
              label: t('settings.tabs.profile', 'Profile'),
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              ),
            },
            {
              id: 'privacy',
              label: t('settings.tabs.privacy', 'Privacy'),
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              ),
            },
            {
              id: 'notifications',
              label: t('settings.tabs.notifications', 'Notifications'),
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              ),
            },
            {
              id: 'security',
              label: t('settings.tabs.security', 'Security'),
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              ),
            },
            {
              id: 'blocked',
              label: t('settings.tabs.blocked', 'Blocked'),
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
              ),
            },
            {
              id: 'data',
              label: t('settings.tabs.data', 'Data'),
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
              ),
            },
            {
              id: 'invite',
              label: t('settings.tabs.invite', 'Invite'),
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="17" y1="11" x2="23" y2="11" />
                </svg>
              ),
            },
          ].map((tItem) => (
            <button
              key={tItem.id}
              type="button"
              className={`settings-tab ${tab === tItem.id ? 'active' : ''}`}
              aria-current={tab === tItem.id ? 'page' : undefined}
              onClick={() => {
                setTab(tItem.id);
                setSearchQuery(''); // clear search if they click a tab manually

                setError('');
                setOk('');
              }}
            >
              <span className="settings-tab-icon">{tItem.icon}</span>
              <span className="settings-tab-label">{tItem.label}</span>
            </button>
          ))}
        </nav>

        <div className="settings-body" ref={bodyRef}>
          {ok && <div className="settings-ok">{ok}</div>}
          {verifyLinkUrl && (
            <div className="settings-ok">
              <a href={verifyLinkUrl} target="_blank" rel="noopener noreferrer">
                {verifyLinkUrl}
              </a>
            </div>
          )}
          {(tab === 'profile' || searchQuery) && (
            <section className="settings-section">
              {/* Identity & Avatar Card */}
              <div className="settings-identity">
                <div className="settings-avatar-stack">
                  <UserAvatar
                    userId={user?.id}
                    name={shownName}
                    hasAvatar={user?.hasAvatar}
                    size="lg"
                  />
                  <button
                    type="button"
                    className="settings-avatar-edit"
                    disabled={avatarBusy}
                    onClick={() => avatarInputRef.current?.click()}
                    aria-label={t('settings.profile.changeAvatar', 'Change photo')}
                    title={t('settings.profile.changeAvatar', 'Change photo')}
                  >
                    {avatarBusy ? (
                      <span className="settings-btn-spinner" aria-hidden="true" />
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    )}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    hidden
                    onChange={handleAvatarChange}
                  />
                </div>
                <div className="settings-account-meta">
                  <div className="settings-account-name-row">
                    <span className="settings-account-name">{shownName}</span>
                    {user?.username && (
                      <span className="settings-account-handle">@{user.username}</span>
                    )}
                  </div>
                  <div className="settings-account-email-row">
                    <span className="settings-account-email">{user?.email}</span>
                    <span className={`settings-status-chip ${user?.emailVerified ? 'active' : 'unverified'}`}>
                      {user?.emailVerified ? (
                        <>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Verified
                        </>
                      ) : (
                        <>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          Unverified
                        </>
                      )}
                    </span>
                  </div>
                  <div className="settings-photo-actions">
                    <button
                      type="button"
                      className="settings-btn ghost settings-btn-sm"
                      disabled={avatarBusy}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      {avatarBusy ? t('common.loading', 'Uploading…') : t('settings.profile.changeAvatar', 'Change photo')}
                    </button>
                    {user?.hasAvatar && (
                      <button type="button" className="settings-btn ghost settings-btn-sm" disabled={busy} onClick={removeAvatar}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        </svg>
                        {t('settings.profile.removeAvatar', 'Remove')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {!user?.emailVerified && (
                <div className="settings-verify-banner">
                  <div className="settings-verify-banner-left">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="settings-verify-icon" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div>
                      <strong>Confirm your email</strong>
                      <p>Verify to unlock full account recovery and security alerts.</p>
                    </div>
                  </div>
                  <button type="button" className="settings-btn primary settings-btn-sm settings-verify-resend-btn" disabled={busy} onClick={resendVerification}>
                    {t('settings.profile.resendVerifyEmail', 'Resend link')}
                  </button>
                </div>
              )}

              {/* Language Selector Fieldset */}
              <div className="settings-fieldset">
                <h3 className="settings-section-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  {t('settings.language.title', 'Language & Region')}
                </h3>
                <p className="settings-section-copy">{t('settings.language.subtitle', 'Choose your interface language')}</p>
                <div className="settings-lang-grid" role="radiogroup" aria-label={t('settings.language.selectLanguage', 'Interface Language')}>
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const isActive = (activeLang || i18n.language || 'en') === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        className={`settings-lang-card ${isActive ? 'active' : ''}`}
                        onClick={() => handleLanguageChange(lang.code)}
                      >
                        <span className="settings-lang-native">{lang.nativeName}</span>
                        <span className="settings-lang-english">{lang.name}</span>
                        {isActive && <span className="settings-lang-check">✓</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="settings-field-hint">
                  {t('settings.language.languageHint', 'Changes apply immediately across the entire app.')}
                </p>
              </div>

              {/* Personal Information Fieldset */}
              <div className="settings-fieldset">
                <h3 className="settings-section-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  {t('settings.profile.aboutYou', 'About you')}
                </h3>
                <div className="settings-field-row">
                  <label className="settings-field">
                    <span>{t('settings.profile.username', 'Username')}</span>
                    <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} autoComplete="username" />
                  </label>
                  <label className="settings-field">
                    <span>{t('settings.profile.displayName', 'Display name')}</span>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={60}
                      placeholder="Shown to others"
                    />
                  </label>
                </div>

                <label className="settings-field">
                  <span>{t('settings.profile.bio', 'Bio')}</span>
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} placeholder={t('settings.profile.bioPlaceholder', 'A short line about you')} />
                </label>

                <div className="settings-field-row">
                  <label className="settings-field">
                    <span>{t('settings.profile.status', 'Status')}</span>
                    <input
                      value={statusText}
                      onChange={(e) => setStatusText(e.target.value)}
                      maxLength={100}
                      placeholder={t('settings.profile.statusPlaceholder', 'e.g. Busy studying, In a meeting')}
                    />
                    <p className="settings-section-copy">
                      {t('settings.profile.statusHint', 'A custom status shown on your profile. Separate from your online state.')}
                      {statusText.trim() ? (
                        <>
                          {' '}
                          <button
                            type="button"
                            className="settings-link-btn"
                            onClick={() => setStatusText('')}
                          >
                            {t('settings.profile.clearStatus', 'Clear status')}
                          </button>
                        </>
                      ) : null}
                    </p>
                  </label>
                  <label className="settings-field">
                    <span>{t('settings.profile.phone', 'Phone')}</span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={32}
                      placeholder="+1 555 0100"
                      inputMode="tel"
                    />
                    <p className="settings-section-copy">
                      {t('settings.profile.phoneHint', 'Friends can find you by this number. Never shown on your public profile.')}
                    </p>
                  </label>
                </div>

                <div className="settings-field-row">
                  <label className="settings-field">
                    <span>{t('settings.profile.dateOfBirth', 'Date of birth')}</span>
                    <input
                      type="date"
                      value={dateOfBirth}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                    />
                    <p className="settings-section-copy">
                      {t(
                        'settings.profile.dateOfBirthHint',
                        'Optional. Your friends get a reminder on your birthday — the date itself is never shown on your profile.',
                      )}
                    </p>
                  </label>

                  <label className="settings-field">
                    <span>{t('settings.profile.timezone', 'Timezone')}</span>
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      {timezoneOptions.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                    <p className="settings-section-copy">
                      {t(
                        'settings.profile.timezoneHint',
                        'Used to time your birthday reminder to your actual local midnight. Change it anytime — for example after traveling.',
                      )}
                    </p>
                  </label>
                </div>

                <button type="button" className="settings-btn primary" disabled={busy} onClick={saveProfile}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  {busy ? t('common.saving', 'Saving…') : t('settings.profile.saveProfile', 'Save profile')}
                </button>
              </div>

              {/* Appearance Fieldset */}
              <div className="settings-fieldset settings-appearance">
                <h3 className="settings-section-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.562C22 6.5 17.5 2 12 2z" />
                  </svg>
                  {t('settings.appearance.title', 'Appearance')}
                </h3>
                <p className="settings-section-copy">
                  {t('settings.appearance.currentLook', 'Current look')}: <strong>{THEME_LABELS[theme] || theme}</strong>
                </p>

                <div className="settings-skin-card settings-skin-card--mode">
                  <header className="settings-skin-card-head">
                    <div>
                      <h4 className="settings-skin-card-title">{t('settings.appearance.displayMode', 'Display mode')}</h4>
                      <p className="settings-skin-card-hint">{t('settings.appearance.modeHint', 'Everyday light, dark, or eyecare')}</p>
                    </div>
                  </header>
                  <div className="settings-skin-card-body settings-skin-card-body--mode">
                    <ThemeSwitcher />
                  </div>
                </div>

                <div className="settings-skin-split">
                  <div className="settings-skin-card settings-skin-card--themes">
                    <header className="settings-skin-card-head">
                      <div>
                        <h4 className="settings-skin-card-title">{t('settings.appearance.dreamyThemes', 'Dreamy themes')}</h4>
                        <p className="settings-skin-card-hint">
                          {FUN_THEMES.includes(theme)
                            ? `${THEME_LABELS[theme] || theme} is active`
                            : t('settings.appearance.pickDecorativeSkin', 'Pick a decorative skin')}
                        </p>
                      </div>
                      <span className="settings-skin-badge" aria-hidden="true">FX</span>
                    </header>
                    <div className="settings-skin-card-body">
                      <FunThemeSwitcher />
                    </div>
                  </div>

                  <div className="settings-skin-card settings-skin-card--icons">
                    <header className="settings-skin-card-head">
                      <div>
                        <h4 className="settings-skin-card-title">{t('settings.appearance.appIcon', 'App icon')}</h4>
                        <p className="settings-skin-card-hint">{t('settings.appearance.appIconHint', 'Browser tab & shortcut color')}</p>
                      </div>
                      <span className="settings-skin-badge settings-skin-badge--soft" aria-hidden="true">Icon</span>
                    </header>
                    <div className="settings-skin-card-body">
                      <div className="settings-icon-grid" role="list">
                        {APP_ICONS.map((icon) => (
                          <button
                            key={icon.id}
                            type="button"
                            className={`settings-icon-pick ${appIcon === icon.id ? 'active' : ''}`}
                            onClick={() => setAppIcon(icon.id)}
                            aria-pressed={appIcon === icon.id}
                            aria-label={icon.label}
                            title={icon.label}
                          >
                            <span
                              className="settings-icon-ring"
                              style={{ background: icon.swatch }}
                              aria-hidden="true"
                            />
                            <img src={icon.file} alt="" />
                            {appIcon === icon.id ? <span className="settings-icon-check">✓</span> : null}
                            <span className="settings-icon-name">{icon.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Session & Logout Fieldset */}
              <div className="settings-fieldset settings-fieldset-danger">
                <h3 className="settings-section-title settings-danger-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  {t('settings.session.title', 'Session')}
                </h3>
                <p className="settings-section-copy">
                  {t('settings.session.logoutDesc', 'Sign out on this browser. Your encryption keys stay on this device for the next login.')}
                </p>
                <button type="button" className="settings-btn ghost settings-btn-danger-hover" onClick={() => onLogout?.()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  {t('settings.session.logoutButton', 'Log out')}
                </button>
              </div>
            </section>
          )}

          {(tab === 'privacy' || searchQuery) && (
            <section className="settings-section">
              <div className="settings-fieldset">
                <h3 className="settings-section-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Profile &amp; Activity Privacy
                </h3>
                <p className="settings-section-copy">
                  Manage who can view your profile info, last seen, online status, and stories.
                </p>

                <div className="settings-privacy-grid">
                  <PrivacySelect
                    label="Who Can See My Profile"
                    description="Control visibility of bio, phone number, and detailed profile info"
                    value={privacy.profileVisibility}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'friends', label: 'Friends Only' },
                      { value: 'onlyMe', label: 'Only Me' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updatePrivacyField('profileVisibility', v)}
                  />

                  <PrivacySelect
                    label="Show My Account To"
                    description="Account discoverability in user search"
                    value={privacy.discoverable}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'nobody', label: 'No One' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updatePrivacyField('discoverable', v)}
                  />

                  <PrivacySelect
                    label="Who Can See My Birthday"
                    description="Control who can view your birthday on your profile"
                    value={privacy.birthdayVisibility}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'friends', label: 'Friends Only' },
                      { value: 'onlyMe', label: 'Only Me' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updatePrivacyField('birthdayVisibility', v)}
                  />

                  <PrivacySelect
                    label="Who Can View My Stories"
                    description="Control who can see your posted stories"
                    value={privacy.story}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'friends', label: 'Friends Only' },
                      { value: 'nobody', label: 'No One' },
                      { value: 'selected', label: 'Selected People' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updatePrivacyField('story', v)}
                  />

                  {privacy.story === 'selected' && (
                    <div className="privacy-friend-picker privacy-picker-fullwidth">
                      <div className="privacy-picker-header">
                        <span className="privacy-friend-picker-heading">
                          Friends permitted to see your stories
                        </span>
                        <span className="privacy-picker-counter">
                          {(privacy.storyViewers || []).length} of {friendsList.length} selected
                        </span>
                      </div>
                      {friendsList.length === 0 ? (
                        <p className="privacy-select-description">No friends added yet.</p>
                      ) : (
                        friendsList.map((f) => {
                          const fId = String(f.id || f._id);
                          const isChecked = (privacy.storyViewers || []).includes(fId);
                          return (
                            <label key={fId} className="privacy-friend-item">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={busy}
                                onChange={() => toggleStoryViewer(fId)}
                              />
                              <UserAvatar userId={f.id} name={f.displayName || f.username} size="xs" />
                              <span>{f.displayName || f.username}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                  <ToggleRow
                    label="View stories anonymously"
                    hint="Your name is hidden when you view others' stories — but you also won't be able to see who viewed yours"
                    checked={privacy.viewStoriesAnonymously === true}
                    disabled={busy}
                    onChange={toggleViewStoriesAnonymously}
                    className="settings-toggle-tile"
                    showStatusBadge={true}
                  />
                  <PrivacySelect
                    label="Last Seen"
                    description="Who can see your last active time"
                    value={privacy.lastSeen}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'friends', label: 'Friends Only' },
                      { value: 'nobody', label: 'No One' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updatePrivacyField('lastSeen', v)}
                  />

                  <PrivacySelect
                    label="Online Status"
                    description="Who can see when you are online"
                    value={privacy.onlineStatus}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'friends', label: 'Friends Only' },
                      { value: 'selected', label: 'Selected People' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updatePrivacyField('onlineStatus', v)}
                  />

                  {privacy.onlineStatus === 'selected' && (
                    <div className="privacy-friend-picker privacy-picker-fullwidth">
                      <div className="privacy-picker-header">
                        <span className="privacy-friend-picker-heading">
                          Friends permitted to see online status
                        </span>
                        <span className="privacy-picker-counter">
                          {(privacy.onlineStatusVisibleTo || []).length} of {friendsList.length} selected
                        </span>
                      </div>
                      {friendsList.length === 0 ? (
                        <p className="privacy-select-description">No friends added yet.</p>
                      ) : (
                        friendsList.map((f) => {
                          const fId = String(f.id || f._id);
                          const isChecked = (privacy.onlineStatusVisibleTo || []).includes(fId);
                          return (
                            <label key={fId} className="privacy-friend-item">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={busy}
                                onChange={() => toggleSelectedFriend(fId)}
                              />
                              <UserAvatar userId={f.id} name={f.displayName || f.username} size="xs" />
                              <span>{f.displayName || f.username}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}

                  <PrivacySelect
                    label="Read Receipts"
                    description="Who can see when you have read their messages"
                    value={privacy.readReceipts}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'friends', label: 'Friends Only' },
                      { value: 'nobody', label: 'No One' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updatePrivacyField('readReceipts', v)}
                  />

                  <ToggleRow
                    label="Typing indicator"
                    hint="Show others when you are typing a message"
                    checked={privacy.typingIndicator !== false}
                    disabled={busy}
                    onChange={(v) => updatePrivacyField('typingIndicator', v)}
                    className="settings-toggle-tile"
                    showStatusBadge={true}
                  />
                </div>
              </div>

              <div className="settings-fieldset">
                <h3 className="settings-section-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Messaging &amp; Mentions
                </h3>
                <p className="settings-section-copy">
                  Control who can direct message you and tag you in general mentions.
                </p>

                <div className="settings-privacy-grid">
                  <PrivacySelect
                    label="Who Can Direct Message You"
                    description="Control who can send you direct messages"
                    value={privacy.whoCanMessage}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'friends', label: 'Friends Only' },
                      { value: 'friendsOfFriends', label: 'Friends of Friends' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updatePrivacyField('whoCanMessage', v)}
                  />

                  <PrivacySelect
                    label="Who Can Mention You"
                    description="General 1:1 and direct mention permissions"
                    value={privacy.whoCanMention}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'friends', label: 'Friends Only' },
                      { value: 'nobody', label: 'No One' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updatePrivacyField('whoCanMention', v)}
                  />
                </div>
              </div>

              <div className="settings-fieldset">
                <h3 className="settings-section-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Group Privacy &amp; Permissions
                </h3>
                <p className="settings-section-copy">
                  Manage group invitations, group creation permissions, and group-specific mentions.
                </p>

                <div className="settings-privacy-grid">
                  <PrivacySelect
                    label="Who Can Add Me to Groups"
                    description="Control who can add you directly to group chats"
                    value={privacy.whoCanAddToGroups}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'friends', label: 'Friends Only' },
                      { value: 'nobody', label: 'No One' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updatePrivacyField('whoCanAddToGroups', v)}
                  />

                  <PrivacySelect
                    label="Who Can Invite Me via Group Links"
                    description="Control whether you can join groups via invite links"
                    value={privacy.whoCanInviteViaGroupLink}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'friends', label: 'Friends Only' },
                      { value: 'nobody', label: 'No One' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updatePrivacyField('whoCanInviteViaGroupLink', v)}
                  />

                  <PrivacySelect
                    label="Who Can Create Groups with Me"
                    description="Control who can select you as an initial member of a new group"
                    value={privacy.whoCanCreateGroupsWithMe}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'friends', label: 'Friends Only' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updatePrivacyField('whoCanCreateGroupsWithMe', v)}
                  />

                  {/* Note: distinct scope from general mentions (whoCanMention) */}
                  <PrivacySelect
                    label="Group Mentions"
                    description="Control who can @-mention you inside group chats specifically"
                    value={privacy.groupMentions}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'adminsOnly', label: 'Admins Only' },
                      { value: 'nobody', label: 'No One' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updatePrivacyField('groupMentions', v)}
                  />
                </div>
              </div>

              <div className="settings-fieldset settings-fieldset-shield">
                <div className="settings-shield-header">
                  <h3 className="settings-section-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    Screenshot Protection
                  </h3>
                  <span className={`settings-shield-status ${privacy.screenshotProtection === true ? 'active' : ''}`}>
                    {privacy.screenshotProtection === true ? 'ACTIVE GUARD' : 'STANDBY'}
                  </span>
                </div>
                <p className="settings-section-copy">
                  When enabled, only <strong>your</strong> chats and profile are
                  protected — other people cannot freely screenshot them on their
                  device (best-effort on web, stronger on mobile). Chats with people
                  who have not turned this on stay normal. Enabling it does not
                  protect every chat you open, and it does not block screenshots of
                  Settings or other app screens.
                </p>

                <div className="settings-shield-badges">
                  <span className="settings-shield-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    Capture Shield
                  </span>
                  <span className="settings-shield-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    Blackout on Web
                  </span>
                  <span className="settings-shield-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    Recording Block
                  </span>
                </div>

                <ToggleRow
                  label="Screenshot protection"
                  hint="Protect only your chats for people who view them — not every chat on your device"
                  checked={privacy.screenshotProtection === true}
                  disabled={busy}
                  onChange={(v) => updatePrivacyField('screenshotProtection', v)}
                  showStatusBadge={true}
                />
              </div>
            </section>
          )}
          {(tab === 'notifications' || searchQuery) && (
            <section className="settings-section">
              {/* Group 1: Message & Activity Alerts */}
              <div className="settings-fieldset">
                <h3 className="settings-section-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Message &amp; Activity Alerts
                </h3>
                <p className="settings-section-copy">
                  Configure notification rules for direct messages, groups, status updates, previews, and badges.
                </p>

                <div className="settings-privacy-grid">
                  <PrivacySelect
                    label="Message Notifications"
                    description="Which messages should notify you"
                    value={notifSettings.messageNotifications}
                    options={[
                      { value: 'all', label: 'All Messages' },
                      { value: 'direct_only', label: 'Only Direct Messages' },
                      { value: 'all_except_reactions', label: 'All Except Reactions' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updateNotifField('messageNotifications', v)}
                  />

                  <PrivacySelect
                    label="Group Notifications"
                    description="Which group messages should notify you"
                    value={notifSettings.groupNotifications}
                    options={[
                      { value: 'all', label: 'All Messages' },
                      { value: 'mentions_only', label: 'Mentions Only' },
                      { value: 'important_only', label: 'Announcements Only' },
                      { value: 'off', label: 'Off' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updateNotifField('groupNotifications', v)}
                  />

                  <PrivacySelect
                    label="Status Notifications"
                    description="When to notify you about friend statuses"
                    value={notifSettings.statusNotifications}
                    options={[
                      { value: 'all', label: 'All Friend Statuses' },
                      { value: 'selected', label: 'Selected Friends' },
                      { value: 'off', label: 'Off' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updateNotifField('statusNotifications', v)}
                  />

                  {notifSettings.statusNotifications === 'selected' && (
                    <div className="privacy-friend-picker">
                      <span className="privacy-select-description" style={{ marginBottom: 4 }}>
                        Friends whose stories notify you:
                      </span>
                      {friendsList.length === 0 ? (
                        <p className="privacy-select-description">No friends added yet.</p>
                      ) : (
                        friendsList.map((f) => {
                          const fId = String(f.id || f._id);
                          const isChecked = (notifSettings.statusNotificationsSelectedFriends || []).includes(fId);
                          return (
                            <label key={fId} className="privacy-friend-item">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={busy}
                                onChange={() => toggleStatusNotificationFriend(fId)}
                              />
                              <UserAvatar userId={f.id} name={f.displayName || f.username} size="xs" />
                              <span>{f.displayName || f.username}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}

                  <PrivacySelect
                    label="Message Preview"
                    description="How much of a message to reveal in alerts"
                    value={notifSettings.messagePreview}
                    options={[
                      { value: 'full', label: 'Show Full Message' },
                      { value: 'sender_only', label: 'Show Sender Only' },
                      { value: 'hidden', label: 'Hide Preview' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updateNotifField('messagePreview', v)}
                  />

                  <PrivacySelect
                    label="Notification Priority"
                    description="How prominently notifications are displayed"
                    value={notifSettings.priority}
                    options={[
                      { value: 'high', label: 'High (Banner)' },
                      { value: 'normal', label: 'Normal' },
                      { value: 'silent', label: 'Silent' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updateNotifField('priority', v)}
                  />

                  <PrivacySelect
                    label="Badge Count"
                    description="Whether to show unread count on app icon"
                    value={notifSettings.badgeCount}
                    options={[
                      { value: 'show', label: 'Show Badge' },
                      { value: 'hidden', label: 'Hide' },
                    ]}
                    disabled={busy}
                    onChange={(v) => updateNotifField('badgeCount', v)}
                  />
                </div>
              </div>

              {/* Group 2: Sounds & Haptics */}
              <div className="settings-fieldset">
                <h3 className="settings-section-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                  Sounds &amp; Haptics
                </h3>
                <p className="settings-section-copy">
                  Customize notification audio, volume, vibration patterns, and incoming call alerts.
                </p>

                <ToggleRow
                  label="Notification sounds"
                  hint="Play an audio chime when new notifications arrive"
                  checked={notifSettings.soundEnabled !== false}
                  disabled={busy}
                  onChange={(v) => updateNotifField('soundEnabled', v)}
                  showStatusBadge={true}
                />

                {notifSettings.soundEnabled && (
                  <div className="settings-sound-volume-bar">
                    <label className="settings-field">
                      <span className="settings-sound-volume-label">
                        <span>Alert Volume</span>
                        <span className="settings-volume-badge">{notifSettings.soundVolume}%</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={notifSettings.soundVolume}
                        disabled={busy}
                        onChange={(e) => updateNotifField('soundVolume', Number(e.target.value))}
                        className="settings-range-slider"
                      />
                    </label>
                  </div>
                )}

                <PrivacySelect
                  label="Vibration Pattern"
                  description="Haptic vibration behavior for incoming alerts"
                  value={notifSettings.vibration}
                  options={[
                    { value: 'on', label: 'Standard Vibration' },
                    { value: 'off', label: 'Off' },
                    { value: 'custom', label: 'Custom Pattern' },
                  ]}
                  disabled={busy}
                  onChange={(v) => updateNotifField('vibration', v)}
                />

                <div className="settings-subdivider" />
                <h4 className="settings-subhead">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="settings-subhead-icon" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  Incoming Call Alerts
                </h4>

                <div className="settings-privacy-grid">
                  <ToggleRow
                    label="Voice call alerts"
                    hint="Ring on incoming audio calls"
                    checked={notifSettings.callNotifications?.voiceCallEnabled}
                    disabled={busy}
                    onChange={(v) => updateNotifNested('callNotifications', 'voiceCallEnabled', v)}
                    showStatusBadge={true}
                  />
                  <ToggleRow
                    label="Video call alerts"
                    hint="Ring on incoming video calls"
                    checked={notifSettings.callNotifications?.videoCallEnabled}
                    disabled={busy}
                    onChange={(v) => updateNotifNested('callNotifications', 'videoCallEnabled', v)}
                    showStatusBadge={true}
                  />
                  <ToggleRow
                    label="Call vibration"
                    hint="Vibrate device during incoming rings"
                    checked={notifSettings.callNotifications?.vibrateOnCall}
                    disabled={busy}
                    onChange={(v) => updateNotifNested('callNotifications', 'vibrateOnCall', v)}
                    showStatusBadge={true}
                  />
                  <ToggleRow
                    label="Missed call reminders"
                    hint="Prompt when an incoming call was missed"
                    checked={notifSettings.callNotifications?.missedCallReminders}
                    disabled={busy}
                    onChange={(v) => updateNotifNested('callNotifications', 'missedCallReminders', v)}
                    showStatusBadge={true}
                  />
                </div>
              </div>

              {/* Group 3: Quiet Hours & Reminders */}
              <div className="settings-fieldset">
                <h3 className="settings-section-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  Quiet Hours &amp; Reminders
                </h3>
                <p className="settings-section-copy">
                  Silence notifications automatically during scheduled rest hours and set milestone alerts.
                </p>

                <ToggleRow
                  label="Do Not Disturb"
                  hint="Silence notifications during quiet hours"
                  checked={notifSettings.doNotDisturb?.enabled}
                  disabled={busy}
                  onChange={(v) => updateNotifNested('doNotDisturb', 'enabled', v)}
                  showStatusBadge={true}
                />

                {notifSettings.doNotDisturb?.enabled && (
                  <div className="settings-field-row">
                    <label className="settings-field">
                      <span>Quiet hours start</span>
                      <input
                        type="time"
                        value={notifSettings.doNotDisturb?.startTime || '22:00'}
                        disabled={busy}
                        onChange={(e) => updateNotifNested('doNotDisturb', 'startTime', e.target.value)}
                      />
                    </label>
                    <label className="settings-field">
                      <span>Quiet hours end</span>
                      <input
                        type="time"
                        value={notifSettings.doNotDisturb?.endTime || '07:00'}
                        disabled={busy}
                        onChange={(e) => updateNotifNested('doNotDisturb', 'endTime', e.target.value)}
                      />
                    </label>
                  </div>
                )}

                <div className="settings-subdivider" />

                <ToggleRow
                  label="Birthday Reminders"
                  hint="Get a reminder 5 minutes before a friend's birthday begins"
                  checked={notifSettings.birthdayReminders !== false}
                  disabled={busy}
                  onChange={(v) => updateNotifField('birthdayReminders', v)}
                  showStatusBadge={true}
                />
              </div>

              {/* Group 4: Desktop & Web Notifications */}
              <div className="settings-fieldset">
                <h3 className="settings-section-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  Desktop &amp; Web Notifications
                </h3>
                <p className="settings-section-copy">
                  Show system alerts (with sound) when QuantumChat is in the background or another app is open.
                </p>

                <div className="settings-row settings-row-static">
                  <span className="settings-row-left">
                    <span className="settings-row-label">Browser permission</span>
                    <span className="settings-row-hint">
                      {notifPermission === 'granted'
                        ? 'Allowed — alerts can appear outside QuantumChat'
                        : notifPermission === 'denied'
                          ? 'Blocked — allow QuantumChat in your browser site settings'
                          : notifPermission === 'unsupported'
                            ? 'Not supported in this browser'
                            : 'Not decided yet — click Enable below'}
                    </span>
                  </span>
                  <span className="settings-row-right">
                    <span className={`settings-status-chip ${notifPermission === 'granted' ? 'active' : ''}`}>
                      {notifPermission === 'granted' ? 'Allowed' : notifPermission === 'denied' ? 'Blocked' : 'Pending'}
                    </span>
                    {notifPermission !== 'granted' && notifPermission !== 'unsupported' ? (
                      <button
                        type="button"
                        className="settings-btn primary"
                        disabled={busy}
                        onClick={enableBrowserNotifications}
                      >
                        Enable
                      </button>
                    ) : null}
                  </span>
                </div>

                <div className="settings-privacy-grid">
                  <ToggleRow
                    label="Enable browser notifications"
                    hint="Popup alerts when you are in another tab"
                    checked={notifSettings.webNotifications?.enabled !== false}
                    disabled={busy}
                    onChange={(v) => updateNotifNested('webNotifications', 'enabled', v)}
                    showStatusBadge={true}
                  />
                  <ToggleRow
                    label="Play notification sound on web"
                    hint="Use system sound on background alerts"
                    checked={notifSettings.webNotifications?.soundOnWeb !== false}
                    disabled={busy}
                    onChange={(v) => updateNotifNested('webNotifications', 'soundOnWeb', v)}
                    showStatusBadge={true}
                  />
                </div>

                <ToggleRow
                  label="Sync read notifications across devices"
                  hint="Dismiss alerts when read on another device"
                  checked={notifSettings.webNotifications?.syncReadAcrossDevices !== false}
                  disabled={busy}
                  onChange={(v) => updateNotifNested('webNotifications', 'syncReadAcrossDevices', v)}
                  showStatusBadge={true}
                />

                <button
                  type="button"
                  className="settings-btn ghost settings-btn-test"
                  disabled={busy}
                  onClick={testNotificationSound}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                  Test sound &amp; notification
                </button>
              </div>

              {/* Group 5: Media Downloads & Muted Chats */}
              <div className="settings-fieldset">
                <h3 className="settings-section-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Media Downloads &amp; Muted Chats
                </h3>
                <p className="settings-section-copy">
                  Control automatic media fetching and manage conversations you've silenced.
                </p>

                <h4 className="settings-subhead">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="settings-subhead-icon" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Auto-Download Preferences
                </h4>

                <div className="settings-privacy-grid">
                  <ToggleRow
                    label="Auto-download photos"
                    hint="Load incoming images automatically"
                    checked={notifSettings.mediaSettings?.autoDownloadImages !== false}
                    disabled={busy}
                    onChange={(v) => updateNotifNested('mediaSettings', 'autoDownloadImages', v)}
                    showStatusBadge={true}
                  />
                  <ToggleRow
                    label="Auto-download videos"
                    hint="Load videos automatically (uses more data)"
                    checked={notifSettings.mediaSettings?.autoDownloadVideos === true}
                    disabled={busy}
                    onChange={(v) => updateNotifNested('mediaSettings', 'autoDownloadVideos', v)}
                    showStatusBadge={true}
                  />
                </div>

                <ToggleRow
                  label="Only on Wi-Fi"
                  hint="Pause auto-download while on mobile data, where supported"
                  checked={notifSettings.mediaSettings?.wifiOnly !== false}
                  disabled={busy}
                  onChange={(v) => updateNotifNested('mediaSettings', 'wifiOnly', v)}
                  showStatusBadge={true}
                />

                <div className="settings-subdivider" />

                <h4 className="settings-subhead">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="settings-subhead-icon" aria-hidden="true">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                  Muted Conversations
                </h4>

                {!Array.isArray(user?.mutedChats) || user.mutedChats.length === 0 ? (
                  <p className="settings-section-copy settings-empty-hint">No muted chats.</p>
                ) : (
                  user.mutedChats.map((m) => {
                    const parsed = parseMutedKey(m.conversationKey, user?.id);
                    if (!parsed) return null;
                    const name =
                      parsed.type === 'group'
                        ? directoryGroups.find((g) => String(g.id) === String(parsed.id))?.name || 'Unknown group'
                        : directoryUsers.find((u) => String(u.id) === String(parsed.id))?.displayName ||
                        directoryUsers.find((u) => String(u.id) === String(parsed.id))?.username ||
                        'Unknown user';
                    return (
                      <div key={m.conversationKey} className="settings-row settings-row-static">
                        <span className="settings-row-left">
                          <span className="settings-row-label">{name}</span>
                          <span className="settings-row-hint">{formatMuteExpiry(m.expiresAt)}</span>
                        </span>
                        <button
                          type="button"
                          className="settings-btn ghost settings-btn-sm"
                          disabled={busy}
                          onClick={() => unmuteFromList(m.conversationKey)}
                        >
                          Unmute
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}
          {(tab === 'security' || searchQuery) && (
            <section className="settings-section">
              {/* Group 1: Authentication & Two-Factor (2FA) */}
              <div className="settings-fieldset">
                <h3 className="settings-section-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Authentication &amp; Password
                </h3>
                <p className="settings-section-copy">
                  Update your master account password and manage two-factor authentication (TOTP).
                </p>

                <div className="settings-field-row">
                  <label className="settings-field">
                    <span>Current password</span>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="Enter current password"
                    />
                  </label>
                  <label className="settings-field">
                    <span>New password</span>
                    <input
                      type="password"
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  className="settings-btn primary"
                  disabled={busy || !currentPassword || newPassword.length < 8}
                  onClick={changePassword}
                >
                  Update password
                </button>

                <div className="settings-subdivider" />

                <div className="settings-subhead-row">
                  <h4 className="settings-subhead">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="settings-subhead-icon" aria-hidden="true">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    Two-Factor Authentication (TOTP)
                  </h4>
                  <span className={`settings-status-chip ${user?.totpEnabled ? 'active' : ''}`}>
                    {user?.totpEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <p className="settings-section-copy">
                  {user?.totpEnabled
                    ? 'TOTP is active. You will be prompted for an authenticator code when signing in on a new device.'
                    : 'Add an authenticator app (Google Authenticator, Authy, etc.) for secondary verification during sign-in.'}
                </p>

                {!user?.totpEnabled && !totpSetup && (
                  <button
                    type="button"
                    className="settings-btn primary"
                    disabled={totpBusy}
                    onClick={start2faSetup}
                  >
                    {totpBusy ? 'Preparing…' : 'Enable 2FA'}
                  </button>
                )}

                {!user?.totpEnabled && totpSetup && (
                  <div className="settings-totp-setup-box">
                    <p className="settings-section-copy">
                      Scan this otpauth URL in your authenticator, or enter the secret manually:
                    </p>
                    <code className="settings-totp-code">
                      {totpSetup.secret}
                    </code>
                    <p className="settings-totp-url">
                      {totpSetup.otpauthUrl}
                    </p>
                    <label className="settings-field">
                      <span>Verification code</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        autoComplete="one-time-code"
                      />
                    </label>
                    <div className="settings-key-actions">
                      <button
                        type="button"
                        className="settings-btn primary"
                        disabled={totpBusy || totpCode.length !== 6}
                        onClick={confirmEnable2fa}
                      >
                        Confirm &amp; enable
                      </button>
                      <button
                        type="button"
                        className="settings-btn ghost"
                        disabled={totpBusy}
                        onClick={() => {
                          setTotpSetup(null);
                          setTotpCode('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {user?.totpEnabled && (
                  <div className="settings-totp-disable-box">
                    <div className="settings-field-row">
                      <label className="settings-field">
                        <span>Password</span>
                        <input
                          type="password"
                          value={totpPassword}
                          onChange={(e) => setTotpPassword(e.target.value)}
                          autoComplete="current-password"
                          placeholder="Confirm password"
                        />
                      </label>
                      <label className="settings-field">
                        <span>Authenticator code</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          autoComplete="one-time-code"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="settings-btn ghost settings-btn-danger-hover"
                      disabled={totpBusy || !totpPassword || totpCode.length !== 6}
                      onClick={confirmDisable2fa}
                    >
                      Disable 2FA
                    </button>
                  </div>
                )}
              </div>

              {/* Group 2: Linked Devices & Sessions */}
              <div className="settings-fieldset">
                <div className="settings-shield-header">
                  <h3 className="settings-section-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    Linked Devices &amp; Sessions
                  </h3>
                  <span className="settings-status-chip active">
                    {sessions.length} {sessions.length === 1 ? 'Device' : 'Devices'}
                  </span>
                </div>
                <p className="settings-section-copy">
                  Manage active web and mobile client sessions connected to your account. Revoking signs that device out immediately.
                </p>
                <div className="settings-key-actions settings-actions-mb">
                  <button type="button" className="settings-btn primary" onClick={openDeviceLinkModal} disabled={deviceLinkLoading}>
                    {deviceLinkLoading ? 'Preparing…' : '+ Link a new device'}
                  </button>
                  <button type="button" className="settings-btn ghost" onClick={refreshDeviceSessions} disabled={deviceLinkRefreshing}>
                    {deviceLinkRefreshing ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>
                {deviceLinkStatusText ? <p className="settings-section-copy">{deviceLinkStatusText}</p> : null}
                {deviceLinkError ? <p className="settings-section-copy settings-error-text">{deviceLinkError}</p> : null}

                {sessions.length === 0 ? (
                  <p className="settings-section-copy settings-empty-hint">No linked devices yet.</p>
                ) : (
                  sessions.map((s) => {
                    const isCurrent = currentSessionId && s.sessionId === currentSessionId;
                    const label = s.label || 'Unknown device';
                    const browser = s.userAgent ? (s.userAgent.includes('Chrome') ? 'Chrome' : 'Browser') : 'Browser';
                    const isMobile = s.userAgent ? (s.userAgent.includes('Android') || s.userAgent.includes('iPhone')) : false;
                    const os = s.userAgent ? (s.userAgent.includes('Windows') ? 'Windows' : s.userAgent.includes('Android') ? 'Android' : s.userAgent.includes('Mac') ? 'macOS' : 'Unknown') : 'Unknown';
                    return (
                      <div key={s.sessionId} className="settings-row settings-row-static settings-device-row">
                        <div className="settings-device-item-left">
                          <div className="settings-device-avatar">
                            {isMobile ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                <line x1="12" y1="18" x2="12.01" y2="18" />
                              </svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                <line x1="8" y1="21" x2="16" y2="21" />
                                <line x1="12" y1="17" x2="12" y2="21" />
                              </svg>
                            )}
                          </div>
                          <span className="settings-row-left">
                            <span className="settings-row-label">
                              {label}
                              {isCurrent ? <span className="settings-current-device-tag">This device</span> : null}
                            </span>
                            <span className="settings-row-hint">
                              {browser} · {os}
                              {s.lastSeenAt ? ` · Last active ${formatLastSeen(s.lastSeenAt, { prefix: '' })}` : ''}
                            </span>
                          </span>
                        </div>
                        {!isCurrent ? (
                          <button
                            type="button"
                            className="settings-btn ghost settings-btn-sm"
                            disabled={busy}
                            onClick={() => revokeDeviceSession(s.sessionId)}
                          >
                            Log out
                          </button>
                        ) : (
                          <span className="settings-status-chip active">Current</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Group 3: Cryptographic Key Vault & Keyring */}
              <div className="settings-fieldset">
                <div className="settings-shield-header">
                  <h3 className="settings-section-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    Encrypted Key Vault &amp; Keyring
                  </h3>
                  <span className={`settings-status-chip ${vaultHasBackup ? 'active' : ''}`}>
                    {vaultHasBackup ? 'Vault Backup Exists' : 'No Backup'}
                  </span>
                </div>
                <p className="settings-section-copy">
                  Backup your private keys wrapped with an AES-GCM passphrase. The server stores only ciphertext and can never inspect keys.
                </p>

                <div className="settings-field-row">
                  <label className="settings-field">
                    <span>Vault passphrase</span>
                    <input
                      type="password"
                      value={vaultPassphrase}
                      onChange={(e) => setVaultPassphrase(e.target.value)}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                    />
                  </label>
                  <label className="settings-field">
                    <span>Confirm passphrase</span>
                    <input
                      type="password"
                      value={vaultPassphraseConfirm}
                      onChange={(e) => setVaultPassphraseConfirm(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Repeat passphrase"
                    />
                  </label>
                </div>

                <div className="settings-key-actions">
                  <button
                    type="button"
                    className="settings-btn primary"
                    disabled={busy || !vaultPassphrase}
                    onClick={backupToVault}
                  >
                    Backup to vault
                  </button>
                  <button
                    type="button"
                    className="settings-btn ghost"
                    disabled={busy || !vaultPassphrase}
                    onClick={restoreFromVault}
                  >
                    Restore from vault
                  </button>
                </div>

                <div className="settings-subdivider" />

                <h4 className="settings-subhead">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="settings-subhead-icon" aria-hidden="true">
                    <circle cx="8" cy="15" r="4" />
                    <line x1="10.85" y1="12.15" x2="19" y2="4" />
                    <line x1="18" y1="5" x2="20" y2="7" />
                    <line x1="15" y1="8" x2="17" y2="10" />
                  </svg>
                  Local Keyring Synchronization
                </h4>

                {keyringSync?.status === 'synced' && (
                  <div className="settings-key-sync-banner synced">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span>Local keyring matches server public keys ({keyringSync.localMatchCount}/{keyringSync.serverKeys.length}).</span>
                  </div>
                )}

                {keyringNeedsResync && (
                  <div className="settings-key-sync-banner warning">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>Local keyring is out of sync with the server ({keyringSync?.localMatchCount ?? 0}/{keyringSync?.serverKeys?.length ?? 5} keys). Regenerate keys to restore end-to-end encryption.</span>
                  </div>
                )}

                <div className="settings-key-actions">
                  <button type="button" className="settings-btn ghost" onClick={() => verifyKeySync().catch(() => { })}>
                    Verify key sync
                  </button>
                  <button type="button" className="settings-btn ghost" onClick={() => keyInputRef.current?.click()}>
                    Import keys.txt
                  </button>
                  <input ref={keyInputRef} type="file" accept=".txt" hidden onChange={onImportKeys} />
                  <button type="button" className="settings-btn primary" onClick={onGenerateKeys}>
                    {keyringNeedsResync ? 'Regenerate & resync keys' : 'Generate new keys'}
                  </button>
                </div>
              </div>

              {/* Group 4: Zero-Knowledge Architecture & Server Blindness */}
              <div className="settings-fieldset">
                <h3 className="settings-section-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                  Zero-Knowledge Architecture &amp; Trust
                </h3>
                <p className="settings-section-copy">
                  The server relays cryptographically sealed ciphertext payloads and is technically incapable of decrypting message plaintext.
                </p>
                <button
                  type="button"
                  className="settings-btn ghost"
                  disabled={blindnessBusy}
                  onClick={loadBlindnessReport}
                >
                  {blindnessBusy ? 'Loading telemetry…' : 'View server blindness report'}
                </button>
                {blindnessReport && (
                  <div className="settings-blindness-card">
                    <div className="settings-blindness-grid">
                      <div className="settings-blindness-tile">
                        <span className="settings-blindness-label">Ciphertexts Relayed</span>
                        <strong className="settings-blindness-val">{blindnessReport.ciphertextsRelayed}</strong>
                      </div>
                      <div className="settings-blindness-tile">
                        <span className="settings-blindness-label">Plaintext Held</span>
                        <strong className="settings-blindness-val highlight">{blindnessReport.plaintextHeld}</strong>
                      </div>
                      <div className="settings-blindness-tile">
                        <span className="settings-blindness-label">Searchable Index</span>
                        <strong className="settings-blindness-val">{blindnessReport.searchableMessageIndex ? 'Active' : 'Disabled (Zero-Knowledge)'}</strong>
                      </div>
                    </div>
                    {blindnessReport.note ? <p className="settings-blindness-note">{blindnessReport.note}</p> : null}
                  </div>
                )}
              </div>
            </section>
          )}

          {(tab === 'blocked' || searchQuery) && (
            <section className="settings-section">
              <div className="settings-fieldset">
                <div className="settings-shield-header">
                  <h3 className="settings-section-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                    </svg>
                    Blocked Contacts &amp; Safety
                  </h3>
                  <span className={`settings-status-chip ${blocked.length > 0 ? 'active' : ''}`}>
                    {blocked.length} {blocked.length === 1 ? 'Blocked' : 'Blocked'}
                  </span>
                </div>
                <p className="settings-section-copy">
                  Blocked users cannot send you direct messages, view your status, or initiate calls. They will not be notified that they were blocked.
                </p>

                {blocked.length === 0 ? (
                  <div className="settings-empty-state-card">
                    <div className="settings-empty-state-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                    </div>
                    <h4 className="settings-empty-state-title">No blocked contacts</h4>
                    <p className="settings-empty-state-desc">
                      Your block list is clean. You can block any contact directly from their chat menu or profile page.
                    </p>
                  </div>
                ) : (
                  <div className="settings-blocked-list">
                    {blocked.map((u) => (
                      <div key={u.id} className="settings-row settings-row-static settings-blocked-item">
                        <div className="settings-blocked-user-info">
                          <UserAvatar
                            userId={u.id}
                            name={u.displayName || u.username}
                            hasAvatar={u.hasAvatar}
                            size="md"
                          />
                          <div className="settings-blocked-meta">
                            <span className="settings-blocked-name">
                              {u.displayName || u.username}
                            </span>
                            <span className="settings-blocked-handle">
                              @{u.username}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="settings-btn ghost settings-btn-sm settings-btn-unblock"
                          disabled={busy}
                          onClick={() => unblock(u.id)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                          </svg>
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="settings-subdivider" />

                <div className="settings-safety-hint">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="settings-safety-hint-icon" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>
                    Blocking applies to 1-on-1 chats. If you share mutual group chats with a blocked contact, you may still see their group messages.
                  </span>
                </div>
              </div>
            </section>
          )}

          {(tab === 'data' || searchQuery) && (
            <section className="settings-section">
              {/* Group 1: Data Portability & Exports */}
              <div className="settings-fieldset">
                <div className="settings-shield-header">
                  <h3 className="settings-section-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Data Export &amp; Archiving
                  </h3>
                  <span className="settings-status-chip active">
                    JSON / E2EE
                  </span>
                </div>
                <p className="settings-section-copy">
                  Download a copy of your account profile and metadata, or export the currently open conversation decrypted locally on this device.
                </p>

                <div className="settings-privacy-grid">
                  <div className="settings-export-card">
                    <div className="settings-export-header">
                      <div className="settings-export-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <ellipse cx="12" cy="5" rx="9" ry="3" />
                          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                        </svg>
                      </div>
                      <div className="settings-export-info">
                        <strong className="settings-export-title">Account Archive</strong>
                        <span className="settings-export-desc">Metadata, contacts &amp; public keys</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="settings-btn ghost settings-export-btn"
                      disabled={busy}
                      onClick={downloadData}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download data (JSON)
                    </button>
                  </div>

                  <div className="settings-export-card">
                    <div className="settings-export-header">
                      <div className="settings-export-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <div className="settings-export-info">
                        <strong className="settings-export-title">Active Chat Export</strong>
                        <span className="settings-export-desc">Decrypted message history</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="settings-btn ghost settings-export-btn"
                      disabled={busy || !onExportChat}
                      onClick={() => onExportChat?.()}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                      Export current chat
                    </button>
                  </div>
                </div>

                <div className="settings-subdivider" />

                <div className="settings-safety-hint">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="settings-safety-hint-icon" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>
                    Exported chats are decrypted locally using your private keys. Store all exported transcripts in a secure, encrypted folder.
                  </span>
                </div>
              </div>

              {/* Group 2: Danger Zone */}
              <div className="settings-fieldset settings-fieldset-danger">
                <div className="settings-shield-header">
                  <h3 className="settings-section-title settings-danger-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Danger Zone
                  </h3>
                  <span className="settings-status-chip settings-status-chip-danger">
                    Irreversible
                  </span>
                </div>
                <p className="settings-section-copy">
                  Permanently delete your QuantumChat account, public keys, and all server-side records. You will lose access to all encrypted conversation queues immediately.
                </p>

                <label className="settings-field">
                  <span>Confirm account password</span>
                  <input
                    type="password"
                    placeholder="Enter your password to authorize deletion"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </label>

                <button
                  type="button"
                  className="settings-btn danger settings-btn-delete"
                  disabled={busy || !deletePassword}
                  onClick={deleteAccount}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  Delete account permanently
                </button>
              </div>
            </section>
          )}

          {tab === 'invite' && (
            <section className="settings-section">
              <div className="settings-fieldset">
                <h3 className="settings-section-title">Invite friends</h3>
                <p className="settings-section-copy">
                  Share your personal invite link. When someone joins using it, they'll show up below.
                </p>
                {referralLoading ? (
                  <p className="settings-section-copy">Loading…</p>
                ) : referralInfo ? (
                  <>
                    <label className="settings-field">
                      <span>Your invite link</span>
                      <input readOnly value={shareInviteLink} onFocus={(e) => e.target.select()} />
                    </label>
                    <div className="settings-key-actions">
                      <button type="button" className="settings-btn primary" onClick={shareInviteNative}>
                        Share
                      </button>
                      <button type="button" className="settings-btn ghost" onClick={copyInviteLink}>
                        Copy link
                      </button>
                    </div>
                    <div className="invite-quick-share">
                    <a
                      className="settings-btn ghost"
                      href={`https://wa.me/?text=${encodeURIComponent(inviteShareText(shareInviteLink))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      >
                      WhatsApp
                    </a>

                    <a className="settings-btn ghost"
                    href={`mailto:?subject=${encodeURIComponent('Join me on QuantumChat')}&body=${encodeURIComponent(inviteShareText(shareInviteLink))}`}
                      >
                    Email
                  </a>

               <a className="settings-btn ghost"
                href={`sms:?&body=${encodeURIComponent(inviteShareText(shareInviteLink))}`}
                      >
                Text message
              </a>
            </div>
                  </>
        ) : (
        <p className="settings-section-copy">Could not load your invite link.</p>
                )}
      </div>

      <div className="settings-fieldset">
        <h3 className="settings-section-title">
          People you've invited {referralInfo ? `(${referralInfo.invitedCount})` : ''}
        </h3>
        {!referralInfo?.invitedUsers?.length ? (
          <p className="settings-section-copy">No one has joined with your link yet.</p>
        ) : (
          <ul className="group-member-list">
            {referralInfo.invitedUsers.map((u) => (
              <li key={u.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <UserAvatar userId={u.id} name={u.displayName || u.username} hasAvatar={u.hasAvatar} size="sm" />
                  <div>
                    <strong>{u.displayName || u.username}</strong>
                    <span className="group-member-meta">
                      Joined {new Date(u.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
        </div >
      </div >
      <DeviceLinkSetupModal
        open={deviceLinkSetupModalOpen}
        qrDataUrl={deviceLinkQr}
        loading={deviceLinkLoading}
        statusText={deviceLinkStatusText}
        error={deviceLinkError}
        timeLeft={deviceLinkExpiresAt ? Math.max(0, new Date(deviceLinkExpiresAt).getTime() - Date.now()) : 0}
        onClose={closeDeviceLinkSetupModal}
      />
      <DeviceLinkRequestModal
        open={deviceLinkModalOpen}
        request={deviceLinkRequest}
        busy={deviceLinkLoading || deviceLinkBusy}
        onApprove={confirmDeviceLinkApprove}
        onReject={confirmDeviceLinkReject}
        onClose={closeDeviceLinkModal}
      />
    </div >
  );
}