import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  Bookmark,
  HelpCircle,
  Info,
  LayoutDashboard,
  MessageSquare,
  Mic,
  Phone,
  Pin,
  Plus,
  Send,
  Settings2,
  Smile,
  Square,
  Users,
  Video,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { streamQuantumAI } from "../api/aiClient.js";
import { fetchChatTheme, fetchGroupChatTheme, fetchGroupWallpaperImageUrl, fetchThemeCatalog, fetchWallpaperImageUrl } from '../api/chatThemes.js';
import client, { muteChat, unmuteChat } from "../api/client.js";
import { postPresenceHeartbeat } from "../api/presence.js";
import { connectSocket, getSocket } from "../api/socket.js";
import { getPeerVaultDecoyStatus } from "../api/vault.js";
import AIAssistantPanel from "../components/AIAssistantPanel.jsx";
import CallOverlay from "../components/CallOverlay.jsx";
import CameraCapture from "../components/CameraCapture.jsx";
import ChatEmptyState from "../components/chat/ChatEmptyState.jsx";
import ChatMediaModal from "../components/chat/ChatMediaModal.jsx";
import ChatOptionsMenu from "../components/chat/ChatOptionsMenu.jsx";
import ChatShell from "../components/chat/ChatShell.jsx";
import ComposerPlusSheet from "../components/chat/ComposerPlusSheet.jsx";
import ConversationPane from "../components/chat/ConversationPane.jsx";
import InfoPanel from "../components/chat/InfoPanel.jsx";
import MediaSendPreview from "../components/chat/MediaSendPreview.jsx";
import MessageActionSheet from "../components/chat/MessageActionSheet.jsx";
import SwipeableMessage from "../components/chat/SwipeableMessage.jsx";
import ChatThemeModal from '../components/ChatThemeModal.jsx';
import ClearChatModal from "../components/ClearChatModal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import CreateGroupModal from "../components/CreateGroupModal.jsx";
import DateSeparator from "../components/DateSeparator.jsx";
import DragDropOverlay from "../components/DragDropOverlay.jsx";
import EditHistoryModal from "../components/EditHistoryModal.jsx";
import EmojiPicker from "../components/EmojiPicker.jsx";
import ForwardModal from "../components/ForwardModal.jsx";
import GroupSettingsModal from "../components/GroupSettingsModal.jsx";
import GroupCommandCenter from "../components/GroupCommandCenter.jsx";
import ImageLightbox from "../components/ImageLightbox.jsx";
import MeetingOverlay from "../components/MeetingOverlay.jsx";
import MessageInfoModal from "../components/MessageInfoModal.jsx";
import MessageSearch from "../components/MessageSearch.jsx";
import SettingsModal from "../components/SettingsModal.jsx";
import StarredMessagesModal from "../components/StarredMessagesModal.jsx";
import TimeCapsuleModal from "../components/TimeCapsuleModal.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import TypingIndicator from "../components/TypingIndicator.jsx";
import BottomSheet from "../components/ui/BottomSheet.jsx";
import UserAvatar from "../components/UserAvatar.jsx";
import UserProfileModal from "../components/UserProfileModal.jsx";
import VaultSetupModal from "../components/VaultSetupModal.jsx";
import VaultUnlockModal from "../components/VaultUnlockModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotificationSettings } from "../context/NotificationSettingsContext.jsx";
import { useVault } from "../context/VaultContext.jsx";
import { sealBytesAsync, secretboxSealAsync } from "../crypto/encryptFileAsync.js";
import {
  downloadKeyFile,
  formatKeyFile,
  parseKeyFile,
} from "../crypto/keyFile.js";
import {
  pickRandom,
  sealMessage,
  unsealMessage
} from "../crypto/keys.js";
import {
  findSecretKeyForPublicKey,
  getCurrentKeySet,
} from "../crypto/keyStorage.js";
import { compressVideo } from "../crypto/videoCompressor.js";
import {
  attachmentIdOf,
  normalizeAttachment,
  pickRecorderMimeType,
} from "../crypto/voiceCache.js";
import useMeetingCall from "../hooks/useMeetingCall.js";
import { useScreenshotProtection } from "../hooks/useScreenshotProtection.js";
import useWebRTCCall from "../hooks/useWebRTCCall.js";
import { getWallpaperBackground, getWallpaperFx, preloadWallpaper } from '../theme/wallpaperBackgrounds.js';
import activityStore from "../utils/activityStore.js";
import { getOfflineMedia, removeOfflineMedia, saveOfflineMedia, updateOfflineMedia } from "../utils/offlineMediaQueue.js";
import {
  getAllOfflineMessages,
  getOfflineMessages,
  removeOfflineMessage,
  saveOfflineMessage,
} from "../utils/offlineMessageQueue.js";
import {
  getArchivedChatKeys,
  getChatDraft,
  getInfoPanelOpen,
  getMutedChatKeys,
  getPinnedChatKeys,
  isChatMuted,
  saveChatDraft,
  setInfoPanelOpen,
  setLastQuickReaction,
  toggleArchiveChat,
  toggleMuteChat,
  togglePinChat
} from "../utils/chatPrefs.js";
import {
  chatPathForSelection,
  selectionFromParams,
} from "../utils/chatRoutes.js";
import { updateFaviconBadge } from "../utils/faviconBadge.js";
import { getDisplayName } from "../utils/getDisplayName.js";
import {
  encodeAnnouncement,
  encodeEvent,
  encodeGroupFile,
  encodePoll,
  extractMentions,
  isGroupAdmin,
} from "../utils/groupPayload.js";
import {
  getHiddenChatIds,
  hideChat,
  unhideChat,
} from "../utils/hiddenChats.js";
import {
  clearAllStarred,
  clearAutoImportantRemoval,
  deleteMessageForMe,
  getAutoImportantRemovedIds,
  getDeletedForMeIds,
  getPinnedIds,
  getStarredEntries,
  getStarredIds,
  rememberAutoImportantRemoval,
  restoreStarredEntries,
  togglePinnedMessage,
  toggleStarredMessage,
} from "../utils/messageExtras.js";
import {
  getAutomaticImportantSource,
  isAutomaticImportantMessage,
} from "../utils/importantMessages.js";
import { getMessagePreviewText } from "../utils/messagePreview.js";
import {
  buildGroupedNotificationText,
  playNotificationSound,
  shouldNotify,
  showNotificationPopup
} from "../utils/notificationDispatch.js";
import { enablePushNotifications } from "../utils/pushNotifications.js";
import {
  conversationKeyForGroup,
  conversationKeyForUser,
  getConversationActivity,
  getUnreadCount,
  incrementUnreadCount,
  isUnreadConversation,
  markConversationRead,
  setConversationActivity,
} from "../utils/readState.js";
import { shouldEnforceScreenshotProtection } from "../utils/screenshotProtection.js";
import { formatLastSeen } from "../utils/formatLastSeen.js";
import { playReceiveSound, playSendSound, startIncomingRingSound, unlockAudio } from "../utils/sounds.js";

const DEFAULT_CHAT_THEME = { presetId: 'default', bubbleColorId: 'default', wallpaperId: 'none' };

const MAX_VOICE_SECONDS = 60;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB — matches backend MAX_ATTACHMENT_SIZE
// Ciphertext above this size uploads in sequential chunks instead of one
// request body — must match backend CHUNK_SIZE in middleware/upload.js.
const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB

/** Never invent "online" from a timestamp — only real presence may say online. */
function formatLastSeenLabel(iso) {
  if (!iso) return "last seen recently";
  return formatLastSeen(iso);
}

function formatVoiceTimer(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isViewOnceEligibleFile(file) {
  if (!file) return false;
  const mime = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  if (mime === 'image/svg+xml' || name.endsWith('.svg')) return false;
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name)) return true;
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(name)) return true;
  if (
    mime.startsWith('audio/') ||
    /\.(webm|ogg|mp3|m4a|wav|aac)$/i.test(name) ||
    /^voice-note/i.test(name)
  ) {
    return true;
  }
  return false;
}

function isMediaPreviewFile(file) {
  if (!file) return false;
  const mime = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  if (mime === 'image/svg+xml' || name.endsWith('.svg')) return false;
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name)) return true;
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(name)) return true;
  if (mime.startsWith('audio/') || /\.(webm|ogg|mp3|m4a|wav|aac)$/i.test(name) || /^voice-note/i.test(name)) {
    return true;
  }
  return false;
}

function memberId(m) {
  return String(m?.id || m?._id || m);
}
function parseStoryPayload(text) {
  if (!text) return null;
  try {
    const obj = JSON.parse(text);
    if (obj?.type === "story_reaction" || obj?.type === "story_reply") return obj;
  } catch {
    // not a story payload
  }
  return null;
}
// Check if two ISO dates fall on the same calendar day
function isSameDay(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Whether a message belongs to a Clear-chat scope bucket. */
function messageMatchesClearScope(message, scope) {
  if (scope === "all") return true;
  const category = message?.mediaCategory;
  const hasAttachment = Boolean(
    message?.attachment &&
      (typeof message.attachment === "object"
        ? message.attachment.id || message.attachment._id
        : message.attachment),
  );
  if (scope === "text") return !category && !hasAttachment;
  return category === scope;
}

export default function Chat() {
  const { t, i18n } = useTranslation();
  const {
    user,
    logout,
    regenerateKeys,
    importKeys,
    hasLocalKeyring,
    keyringNeedsResync,
    keyringSync,
    updateSessionUser,
  } = useAuth();
  const { showToast } = useToast();
  const { isUnlocked: vaultUnlocked, isPeerVaulted, vaultEnabled, addPeer: addVaultPeer, removePeer: removeVaultPeer, lock: lockVault } = useVault();
  const [showVaultSetup, setShowVaultSetup] = useState(false);
  const [showVaultUnlock, setShowVaultUnlock] = useState(false);
  const [pendingVaultPeerId, setPendingVaultPeerId] = useState(null);
  const { settings: notifSettings } = useNotificationSettings();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith("/chat/settings");
  const settingsTab = params.tab || "profile";

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null); // { type: 'dm'|'group', id, ... }
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [importError, setImportError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [hiddenChatIds, setHiddenChatIds] = useState(() =>
    getHiddenChatIds(user?.id),
  );
  const [mutedKeys, setMutedKeys] = useState(() => getMutedChatKeys(user?.id));
  const [archivedKeys, setArchivedKeys] = useState(() =>
    getArchivedChatKeys(user?.id),
  );
  const [pinnedChatKeys, setPinnedChatKeys] = useState(() =>
    getPinnedChatKeys(user?.id),
  );
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [clearChatOpen, setClearChatOpen] = useState(false);
  const [clearChatBusy, setClearChatBusy] = useState(false);
  const [activityTick, setActivityTick] = useState(0);
  const [friendCandidates, setFriendCandidates] = useState([]);
  const [friendCandidatesLoading, setFriendCandidatesLoading] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [myFriends, setMyFriends] = useState([]);
  const [myFriendsLoading, setMyFriendsLoading] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [contactLookupResult, setContactLookupResult] = useState(null);
  const [contactLookupLoading, setContactLookupLoading] = useState(false);
  const [contactLookupError, setContactLookupError] = useState("");
  // Custom UI feature states
  const [searchOpen, setSearchOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [groupTypingUsers, setGroupTypingUsers] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const [deletedForMeIds, setDeletedForMeIds] = useState(() =>
    getDeletedForMeIds(user?.id),
  );
  const [starredIds, setStarredIds] = useState(() => getStarredIds(user?.id));
  const [importantEntries, setImportantEntries] = useState([]);
  const [importantLoading, setImportantLoading] = useState(false);
  const [showStarredMessages, setShowStarredMessages] = useState(false);
  const [showChatMedia, setShowChatMedia] = useState(false);
  const [starredScope, setStarredScope] = useState('all'); // 'all' | 'chat'
  const [pendingJumpMessageId, setPendingJumpMessageId] = useState(null);
  const [pinnedIds, setPinnedIds] = useState([]);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [forwardBusy, setForwardBusy] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [extrasTick, setExtrasTick] = useState(0);
  const [uploads, setUploads] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [disappearSeconds, setDisappearSeconds] = useState(0);
  const importantEntriesRef = useRef([]);
  const [capsuleUnlocksAt, setCapsuleUnlocksAt] = useState("");
  const [showCapsulePicker, setShowCapsulePicker] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaPreviewSending, setMediaPreviewSending] = useState(false);
  const [mediaCompressing, setMediaCompressing] = useState(false);
  const [mediaCompressProgress, setMediaCompressProgress] = useState(0);
  const [mediaCompressPhase, setMediaCompressPhase] = useState('encoding');
  const [videoPlayer, setVideoPlayer] = useState(null);
  const [allowForward, setAllowForward] = useState(true);
  const [forwardUntilSeconds, setForwardUntilSeconds] = useState(0);
  const [gallery, setGallery] = useState(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);
  const [groupComposerMenu, setGroupComposerMenu] = useState(null);
  const [pollDraft, setPollDraft] = useState(null);
  const [eventDraft, setEventDraft] = useState(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [pendingAnnouncement, setPendingAnnouncement] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false);
  const [moderationBannerDismissed, setModerationBannerDismissed] = useState(false);
  const [composerHelpOpen, setComposerHelpOpen] = useState(false);
  const [composerPlusOpen, setComposerPlusOpen] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifSending, setGifSending] = useState(false);
  const [infoPanelOpen, setInfoPanelOpenState] = useState(() =>
    getInfoPanelOpen(),
  );
  const [actionSheetMessage, setActionSheetMessage] = useState(null);
  const [messageInfoData, setMessageInfoData] = useState(null);
  const [editHistoryMessage, setEditHistoryMessage] = useState(null);
  const [callMinimized, setCallMinimized] = useState(false);
  const [isMobileShell, setIsMobileShell] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 768px)").matches
      : false,
  );
  /** Phones + tablets: info as sheet, collapse secondary header actions */
  const [isCompactChrome, setIsCompactChrome] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 1023px)").matches
      : false,
  );
  const [decoyThreadExists, setDecoyThreadExists] = useState(false);
  const [themeCatalog, setThemeCatalog] = useState(null);
  const [chatTheme, setChatTheme] = useState(DEFAULT_CHAT_THEME);
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState(null);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [usersCursor, setUsersCursor] = useState(null);
  const [usersHasMore, setUsersHasMore] = useState(false);
  const [groupsCursor, setGroupsCursor] = useState(null);
  const [groupsHasMore, setGroupsHasMore] = useState(false);
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef(null);
  const draftConversationKeyRef = useRef(null);
  const draftReadyConversationKeyRef = useRef(null);

  useEffect(() => {
    if (
      !user?.id ||
      !draftConversationKeyRef.current ||
      draftReadyConversationKeyRef.current !== draftConversationKeyRef.current
    ) return;
    void saveChatDraft(user.id, draftConversationKeyRef.current, draft);
  }, [draft, user?.id]);

  useEffect(() => {
    const mqMobile = window.matchMedia("(max-width: 768px)");
    const mqCompact = window.matchMedia("(max-width: 1023px)");
    const syncMobile = () => setIsMobileShell(mqMobile.matches);
    const syncCompact = () => setIsCompactChrome(mqCompact.matches);
    syncMobile();
    syncCompact();
    mqMobile.addEventListener?.("change", syncMobile);
    mqCompact.addEventListener?.("change", syncCompact);
    return () => {
      mqMobile.removeEventListener?.("change", syncMobile);
      mqCompact.removeEventListener?.("change", syncCompact);
    };
  }, []);
  // Screen-time tracking is session-level now — see ScreenTimeTracker.jsx,
  // mounted once above <Routes> in App.jsx so it survives navigation
  // between /chat, /chat/activity, etc.
  useEffect(() => {
    const cores = navigator.hardwareConcurrency || 4;
    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      cores <= 4;
    document.body.classList.toggle("low-fx", reduced);
    return () => document.body.classList.remove("low-fx");
  }, []);

  useEffect(() => {
    if (!hasLocalKeyring) return;
    fetchThemeCatalog()
      .then(setThemeCatalog)
      .catch(() => { }); // Non-critical — the picker just won't open without it; chat still works.
  }, [hasLocalKeyring]);

 useEffect(() => {
    setThemeModalOpen(false);

    if (!selected || (selected.type !== "dm" && selected.type !== "group")) {
      setChatTheme(DEFAULT_CHAT_THEME);
      return;
    }

    let cancelled = false;
    const fetcher = selected.type === "group" ? fetchGroupChatTheme : fetchChatTheme;

    fetcher(selected.id).then((theme) => {
      if (!cancelled) {
        setChatTheme(theme);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  // The custom wallpaper endpoint returns raw bytes (auth-gated, owner-only)
  // rather than a public URL, so it has to be fetched as a blob and turned
  // into an object URL, same as attachment previews elsewhere in this app.
useEffect(() => {
    if (
      !selected ||
      (selected.type !== "dm" && selected.type !== "group") ||
      chatTheme.wallpaperId !== "custom"
    ) {
      setCustomWallpaperUrl(null);
      return;
    }

    let cancelled = false;
    let urlToRevoke = null;
    const fetchUrl = selected.type === "group" ? fetchGroupWallpaperImageUrl : fetchWallpaperImageUrl;

    fetchUrl(selected.id).then((url) => {
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }

      urlToRevoke = url;
      setCustomWallpaperUrl(url);
    });

    return () => {
      cancelled = true;
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke);
      }
    };
  }, [selected, chatTheme.wallpaperId, chatTheme.updatedAt]);

  useEffect(() => {
    if (chatTheme?.wallpaperId) preloadWallpaper(chatTheme.wallpaperId);
  }, [chatTheme.wallpaperId]);
  useEffect(() => {
    if (!gifPickerOpen) return undefined;
    const q = gifQuery.trim() || 'trending';
    const timer = setTimeout(async () => {
      setGifLoading(true);
      try {
        const { data } = await client.get('/gifs/search', { params: { q } });
        setGifResults(data.data || []);
      } catch {
        setGifResults([]);
      } finally {
        setGifLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [gifPickerOpen, gifQuery]);
  const messageListRef = useRef(null);
  const bottomRef = useRef(null);
  const typingPeerTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  /** REST typing target while Socket.IO is unavailable (Vercel). */
  const presenceTypingRef = useRef({ to: null, groupId: null });
  const pendingNotificationsRef = useRef(new Map()); // convKey -> [{ senderName, text }]
  const loadingOlderRef = useRef(false);
  const oldestCreatedAtRef = useRef(null);
  const loadOlderMessagesRef = useRef(null);
  const fileInputRef = useRef(null);
  const keyFileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const selectedRef = useRef(null);
  const userRef = useRef(user);
  const messagesRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const recordStartedAtRef = useRef(0);
  const notifiedCallIdRef = useRef(null);
  const dragCountRef = useRef(0);
   const imageSrcMapRef = useRef(new Map());
  const videoSrcMapRef = useRef(new Map());
  const aiAbortRef = useRef(null);
  const usersRef = useRef([]);
  const groupsRef = useRef([]);
  const storiesRailRef = useRef(null);
  const retryingOutboxRef = useRef(new Set());
  selectedRef.current = selected;
  userRef.current = user;
  messagesRef.current = messages;
  usersRef.current = users;
  groupsRef.current = groups;

  function stopTyping({ emit = true } = {}) {
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = null;
    const target = presenceTypingRef.current;
    presenceTypingRef.current = { to: null, groupId: null };
    if (!emit || (!target.to && !target.groupId)) return;
    const socket = getSocket();
    if (!socket?.connected) return;
    socket.emit(
      "typing:stop",
      target.to ? { to: target.to } : { groupId: target.groupId },
    );
  }

  function pendingMessageFromOutbox(entry) {
    return {
      id: `outbox-${entry.id}`,
      _id: `outbox-${entry.id}`,
      from: user.id,
      ...(entry.type === "group" ? { group: entry.conversationId } : { to: entry.conversationId }),
      text: entry.displayText,
      createdAt: entry.queuedAt,
      _status: "waiting",
      _pending: true,
      replyTo: entry.replyTo || null,
    };
  }

  function syncTypingPrivacy() {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit("privacy:typing-indicator", {
        enabled: userRef.current?.privacy?.typingIndicator !== false,
      });
    }
  }

  const resolveActivityActor = useCallback((actorId) => {
    if (actorId == null) return {};
    const normalizedId = String(actorId);
    if (String(user?.id) === normalizedId) return { actorLabel: "you", actorIsCurrentUser: true };
    const actor = usersRef.current.find((candidate) => String(candidate.id || candidate._id) === normalizedId);
    return {
      actorLabel: actor?.displayName || actor?.username,
      actorIsCurrentUser: false,
    };
  }, [user?.id]);

  const webrtc = useWebRTCCall({
    userId: user?.id,
    resolvePeerPublicKeys: async (peerId) => {
      if (String(peerId) === String(user?.id)) return user?.publicKeys || [];
      const peer =
        (selectedRef.current?.type === "dm" &&
          String(selectedRef.current.id) === String(peerId) &&
          selectedRef.current.peer) ||
        usersRef.current.find((u) => String(u.id) === String(peerId));
      return peer?.publicKeys || [];
    },
    onMissed: (call) => {
      showToast("Call ended or declined", "info");
      if (notifSettings?.callNotifications?.missedCallReminders === false) return;
      if (!shouldNotify(notifSettings, { kind: "call" })) return;
      const caller =
        users.find((u) => String(u.id) === String(call?.peerId))?.displayName ||
        users.find((u) => String(u.id) === String(call?.peerId))?.username ||
        "Someone";
      showNotificationPopup(
        { title: caller, body: "Missed call" },
        notifSettings,
        () => { },
      );
    },
    onEnd: async (info) => {
      try {
        if (info.role !== "caller") return;
        const peerId = String(info.peerId);
        const peer = usersRef.current.find((u) => String(u.id) === peerId);
        const myKey = pickRandom(getCurrentKeySet(user.id));
        const recipientKeys = (peer?.publicKeys || []).filter(Boolean);
        if (!myKey?.publicKey || recipientKeys.length === 0) return;
        const payload = JSON.stringify({
          __type: "call",
          callId: info.callId,
          video: info.video,
          role: info.role,
          answered: !!info.answered,
          durationSeconds: Number(info.durationSeconds) || 0,
          reason: info.reason || null,
          endedAt: new Date().toISOString(),
        });
        const forRecipient = sealMessage(payload, pickRandom(recipientKeys));
        const forSender = sealMessage(payload, myKey.publicKey);
        const { data } = await client.post("/messages", {
          to: peerId,
          forRecipient,
          forSender,
        });
        recordActivityFromMessage(data.data);
        setMessages((prev) => {
          const id = String(data.data.id || data.data._id);
          if (prev.some((m) => String(m.id || m._id) === id)) return prev;
          return [...prev, decorate(data.data)];
        });
        playSendSound();
        setTimeout(() => scrollToBottom("smooth"), 50);
      } catch (err) {
        /* ignore send errors */
      }
    },
  });

  // Sends a reply typed directly into a notification's inline text field,
  // entirely in the background — no navigation, no window focus, no change
  // to whatever the user is currently looking at. Standalone rather than
  // reusing handleSend()/selected/draft, since those are tied to the
  // CURRENTLY VISIBLE conversation. Only handles the plain-DM case, since
  // that's the only path the backend currently attaches a Reply action to.
  async function sendReplyInBackground(peerId, text) {
    const trimmed = (text || '').trim();
    console.log('[reply] sendReplyInBackground called', { peerId, textLength: trimmed.length });
    if (!trimmed || !peerId) {
      console.warn('[reply] aborting: missing text or peerId', { trimmed, peerId });
      return;
    }
    try {
      let replyPeer =
        String(peerId) === String(user.id)
          ? selfPeer
          : users.find((u) => String(u.id) === String(peerId));

      if (!replyPeer?.publicKeys?.length) {
        console.log('[reply] peer not found/no keys in local users list, fetching fresh:', peerId);
        try {
          const { data } = await client.get(`/users/${peerId}`);
          replyPeer = data?.data || null;
        } catch (fetchErr) {
          console.error('[reply] failed to fetch peer directly', fetchErr);
        }
      }

      const myKey = pickRandom(getCurrentKeySet(user.id));
      const recipientKeys = (replyPeer?.publicKeys || []).filter(Boolean);
      console.log('[reply] resolved peer', { found: Boolean(replyPeer), recipientKeyCount: recipientKeys.length, haveOwnKey: Boolean(myKey?.publicKey) });
      if (!myKey?.publicKey || recipientKeys.length === 0) {
        console.error('[reply] aborting: missing encryption keys', { hasMyKey: Boolean(myKey?.publicKey), recipientKeyCount: recipientKeys.length });
        showToast('Missing encryption keys for this conversation', 'error');
        return;
      }
      const forRecipient = sealMessage(trimmed, pickRandom(recipientKeys));
      const forSender = sealMessage(trimmed, myKey.publicKey);
      console.log('[reply] posting message to server...');
      const { data } = await client.post('/messages', { to: peerId, forRecipient, forSender });
      console.log('[reply] sent successfully', data?.data?._id || data?.data?.id);
      recordActivityFromMessage(data.data);
    } catch (err) {
      console.error('[reply] send failed', err);
      showToast(err.response?.data?.error || err.message || 'Failed to send reply', 'error');
    }
  }

  // ---- Notification action handling (Reply / Mark as Read / call actions) ---
  const [notificationAction, setNotificationAction] = useState(null);

  // Path A — cold boot via openWindow(), action arrives as query params.
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has('reply')) {
      const raw = searchParams.get('reply');
      const typed = raw && raw !== '1' ? decodeURIComponent(raw) : '';
      setNotificationAction({ type: 'reply', text: typed });
      navigate(location.pathname, { replace: true });
    } else if (searchParams.has('acceptCall')) {
      setNotificationAction({ type: 'accept_call', callId: searchParams.get('acceptCall') });
      navigate(location.pathname, { replace: true });
    } else if (searchParams.has('declineCall')) {
      setNotificationAction({ type: 'decline_call', callId: searchParams.get('declineCall') });
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    function onSwMessage(event) {
      const msg = event.data;
      if (!msg || msg.type !== 'quantumchat-notification-action') return;
      console.log('[reply] received SW message', msg);

      if (msg.action === 'reply' && msg.text) {
        sendReplyInBackground(msg.peerId, msg.text);
        return;
      }

      if (msg.url) {
        const targetPath = msg.url.split('?')[0];
        if (locationRef.current.pathname !== targetPath) navigateRef.current(targetPath);
      }
      if (msg.action === 'reply') {
        setNotificationAction({ type: 'reply', text: '' });
      } else if (msg.action === 'accept_call') {
        setNotificationAction({ type: 'accept_call', callId: msg.callId });
      } else if (msg.action === 'decline_call') {
        setNotificationAction({ type: 'decline_call', callId: msg.callId });
      }
    }
    console.log('[reply] SW message listener attached');
    navigator.serviceWorker?.addEventListener('message', onSwMessage);
    return () => {
      console.log('[reply] SW message listener detached');
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Executes whatever `notificationAction` currently holds (Path A only, or
  // Path B's non-silent cases), once it's actually safe to: the right
  // conversation must be loaded, and for a reply with text, the recipient's
  // public key must actually be available.
  const pendingAutoSendRef = useRef(false);
  useEffect(() => {
    if (!notificationAction) return;

    if (notificationAction.type === 'reply') {
      const targetId = params.groupId || params.peerId;
      const selectedMatches = selected && String(selected.id) === String(targetId);
      const peerReady =
        selectedMatches &&
        (selected.type === 'group' || Boolean(resolveDmPeer(selected)?.publicKeys?.length));

      if (!notificationAction.text) {
        if (selectedMatches || selected) {
          textareaRef.current?.focus();
          setNotificationAction(null);
        }
        return;
      }
      if (peerReady) {
        setDraft(notificationAction.text);
        pendingAutoSendRef.current = true;
        setNotificationAction(null);
      }
      return;
    }

    if (
      notificationAction.type === 'accept_call' &&
      webrtc.call &&
      String(webrtc.call.callId || webrtc.call.id) === String(notificationAction.callId)
    ) {
      webrtc.acceptCall().catch(() => showToast('Could not access microphone/camera', 'error'));
      setNotificationAction(null);
      return;
    }

    if (
      notificationAction.type === 'decline_call' &&
      webrtc.call &&
      String(webrtc.call.callId || webrtc.call.id) === String(notificationAction.callId)
    ) {
      webrtc.rejectCall();
      setNotificationAction(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationAction, selected, users, webrtc.call, params.peerId, params.groupId]);

  useEffect(() => {
    if (pendingAutoSendRef.current && draft) {
      pendingAutoSendRef.current = false;
      handleSend({ preventDefault: () => { } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  useEffect(() => {
    const call = webrtc.call;
    if (!call || call.role !== "callee" || call.status !== "incoming") return;

    const enabled = call.video
      ? notifSettings?.callNotifications?.videoCallEnabled !== false
      : notifSettings?.callNotifications?.voiceCallEnabled !== false;
    if (!enabled || !shouldNotify(notifSettings, { kind: "call" })) return;

    const caller =
      users.find((u) => String(u.id) === String(call.peerId))?.displayName ||
      users.find((u) => String(u.id) === String(call.peerId))?.username ||
      "Someone";

    if (notifiedCallIdRef.current !== call.callId) {
      notifiedCallIdRef.current = call.callId;
      showNotificationPopup(
        {
          title: caller,
          body: call.video ? "Incoming video call" : "Incoming voice call",
          requireInteraction: true,
          silent: false,
          tag: `call:${call.callId}`,
        },
        notifSettings,
        () => {
          window.focus();
        },
      );
      if (notifSettings?.callNotifications?.vibrateOnCall && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    }

    const volumeScale =
      typeof notifSettings?.soundVolume === "number"
        ? notifSettings.soundVolume / 100
        : 0.8;
    const stopRing =
      notifSettings?.soundEnabled === false
        ? () => { }
        : startIncomingRingSound(volumeScale);

    return () => {
      stopRing();
    };
  }, [webrtc.call, users, notifSettings]);

  useEffect(() => {
    if (!webrtc.call) setCallMinimized(false);
  }, [webrtc.call]);

  // Unlock Web Audio after the first user gesture so later alerts can play
  // even when QuantumChat is in a background tab.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const meetingCall = useMeetingCall({
    userId: user?.id,
    resolveGroupMembers: async (groupId) => {
      const group =
        (selectedRef.current?.type === "group" &&
          String(selectedRef.current.id) === String(groupId) &&
          selectedRef.current.group) ||
        groupsRef.current.find((g) => String(g.id) === String(groupId));
      if (!group) return null;
      return { groupName: group.name, members: group.members || [] };
    },
    onEnd: async (info) => {
      try {
        if (info.role !== "host") return;
        const group = groupsRef.current.find(
          (g) => String(g.id) === String(info.groupId),
        );
        if (!group) return;
        const payload = JSON.stringify({
          __type: "meeting",
          meetingId: info.meetingId,
          video: info.video,
          participantCount: info.participantCount,
          durationSeconds: Number(info.durationSeconds) || 0,
          reason: info.reason || null,
          endedAt: new Date().toISOString(),
        });
        const isPublic = group.visibility === "public";
        const body = { kind: "text" };
        if (isPublic) {
          body.content = payload;
        } else {
          body.envelopes = sealGroupEnvelopes(payload, group);
        }
        const { data } = await client.post(
          `/groups/${group.id}/messages`,
          body,
        );
        recordActivityFromMessage(data.data);
        setMessages((prev) => {
          const id = String(data.data.id || data.data._id);
          if (prev.some((m) => String(m.id || m._id) === id)) return prev;
          return [...prev, decorate(data.data)];
        });
        playSendSound();
        setTimeout(() => scrollToBottom("smooth"), 50);
      } catch (err) {
        /* ignore send errors */
      }
    },
  });

  const bumpActivity = useCallback(() => setActivityTick((n) => n + 1), []);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    if (messageListRef.current) {
      const el = messageListRef.current;
      el.scrollTo({
        top: el.scrollHeight,
        behavior,
      });
    }
    setHasUnread(false);
  }, []);

  const handleScroll = useCallback(() => {
    if (!messageListRef.current) return;
    const el = messageListRef.current;
    const isUp = el.scrollHeight - el.scrollTop - el.clientHeight > 150;
    if (!isUp) {
      setHasUnread(false);
    }
    if (el.scrollTop < 80 && hasMoreMessages && !loadingOlderRef.current) {
      loadOlderMessagesRef.current?.();
    }
  }, [hasMoreMessages]);

  const resolveMySecretKey = useCallback(
    (targetPublicKeyHex) =>
      findSecretKeyForPublicKey(user.id, targetPublicKeyHex),
    [user],
  );

  const decorate = useCallback(
    (raw) => {
      const isMine = String(raw.from) === String(user.id);
      let text = null;
      let hasEnvelope = false;

      if (
        raw.group &&
        typeof raw.content === "string" &&
        raw.content.length > 0
      ) {
        text = raw.content;
        hasEnvelope = true;
      } else if (raw.group && Array.isArray(raw.envelopes)) {
        const mine = raw.envelopes.find(
          (e) => String(e.user) === String(user.id),
        );
        hasEnvelope = Boolean(mine?.targetPublicKey);
        if (mine?.targetPublicKey) {
          const mySecretKey = resolveMySecretKey(mine.targetPublicKey);
          text = mySecretKey ? unsealMessage(mine, mySecretKey) : null;
        }
      } else {
        const envelope = isMine ? raw.forSender : raw.forRecipient;
        hasEnvelope = Boolean(envelope?.targetPublicKey);
        if (envelope?.targetPublicKey) {
          const mySecretKey = resolveMySecretKey(envelope.targetPublicKey);
          text = mySecretKey ? unsealMessage(envelope, mySecretKey) : null;
        }
      }

      const reactions = (raw.reactions || []).map((r) => {
        if (r.emoji && !r.forRecipient && !r.forSender) {
          return { ...r, user: String(r.user), emoji: r.emoji };
        }
        const mineReaction = String(r.user) === String(user.id);
        const reactionEnvelope = mineReaction ? r.forSender : r.forRecipient;
        if (!reactionEnvelope?.targetPublicKey) {
          return { ...r, user: String(r.user), emoji: null };
        }
        const sk = resolveMySecretKey(reactionEnvelope.targetPublicKey);
        return {
          ...r,
          user: String(r.user),
          emoji: sk ? unsealMessage(reactionEnvelope, sk) : null,
        };
      });

      return {
        ...raw,
        id: raw.id || raw._id,
        attachment: normalizeAttachment(raw.attachment),
        text: hasEnvelope ? text : null,
        reactions,
        replyTo: raw.replyTo
          ? (() => {
            const parent = raw.replyTo;
            const parentMine = String(parent.from) === String(user.id);
            let parentText = null;
            if (
              parent.group &&
              typeof parent.content === "string" &&
              parent.content.length > 0
            ) {
              parentText = parent.content;
            } else if (parent.group && Array.isArray(parent.envelopes)) {
              const mine = parent.envelopes.find(
                (e) => String(e.user) === String(user.id),
              );
              if (mine?.targetPublicKey) {
                const sk = resolveMySecretKey(mine.targetPublicKey);
                parentText = sk ? unsealMessage(mine, sk) : null;
              }
            } else {
              const env = parentMine ? parent.forSender : parent.forRecipient;
              if (env?.targetPublicKey) {
                const sk = resolveMySecretKey(env.targetPublicKey);
                parentText = sk ? unsealMessage(env, sk) : null;
              }
            }
            return {
              id: parent.id || parent._id,
              from: parent.from,
              text: parentText,
            };
          })()
          : null,
      };
    },
    [user, resolveMySecretKey],
  );

  // Refs so Important-messages mapping can use latest directory/decrypt
  // helpers without re-fetching (and re-toasting) every time users/groups change.
  const importantDecorateRef = useRef(decorate);
  importantDecorateRef.current = decorate;
  const importantUsersRef = useRef(users);
  importantUsersRef.current = users;
  const importantGroupsRef = useRef(groups);
  importantGroupsRef.current = groups;

  const loadImportantMessages = useCallback(async () => {
    if (!user?.id) return;
    setImportantLoading(true);
    try {
      const { data } = await client.get('/messages/important');
      const markedAtById = new Map(
        (data?.data?.entries || []).map((entry) => [String(entry.messageId), entry.markedAt]),
      );
      const directoryUsers = importantUsersRef.current;
      const directoryGroups = importantGroupsRef.current;
      const next = (data?.data?.messages || []).map((raw) => {
        const message = importantDecorateRef.current(raw);
        const messageId = String(message.id || message._id);
        const groupId = raw.group ? String(raw.group) : null;
        const group = groupId
          ? directoryGroups.find((candidate) => String(candidate.id) === groupId)
          : null;
        const peerId = raw.group
          ? groupId
          : String(raw.from) === String(user.id) ? raw.to : raw.from;
        const peer = peerId
          ? directoryUsers.find((candidate) => String(candidate.id) === String(peerId))
          : null;
        const type = groupId ? 'group' : 'dm';
        const title = group?.name || getDisplayName(peer, i18n.language) || 'Chat';
        return {
          ...message,
          id: messageId,
          type,
          conversationId: groupId || peerId,
          conversationKey: groupId ? conversationKeyForGroup(groupId) : conversationKeyForUser(peerId),
          title,
          from: raw.from,
          createdAt: raw.createdAt,
          hasAttachment: Boolean(message.attachment),
          attachmentFilename: message.attachment?.filename || null,
          important: true,
          isImportant: true,
          importantAt: markedAtById.get(messageId) || null,
        };
      });
      setImportantEntries(next);
    } catch (err) {
      setImportantEntries([]);
      // Background prefetch — never surface raw validation noise like
      // "Invalid user id" (happens when an older API treats "important" as a
      // peer id). Chat itself still works.
      const status = err.response?.status;
      const msg = err.response?.data?.error || '';
      if (status && status !== 400 && status !== 404 && msg !== 'Invalid user id') {
        showToast(msg || "Couldn't load Important messages", 'error');
      }
    } finally {
      setImportantLoading(false);
    }
  }, [getDisplayName, i18n.language, showToast, user?.id]);

  useEffect(() => {
    if (hasLocalKeyring) void loadImportantMessages();
  }, [hasLocalKeyring, loadImportantMessages]);

  useEffect(() => {
    importantEntriesRef.current = importantEntries;
  }, [importantEntries]);

  const markMessageImportantIfNeeded = useCallback(async (rawMessage) => {
    if (!rawMessage || !user?.id) return;
    const messageId = String(rawMessage.id || rawMessage._id || '');
    if (!messageId) return;
    const alreadyImportant = importantEntriesRef.current.some((entry) => String(entry.id || entry._id) === messageId);
    if (alreadyImportant) return;
    const autoSource = getAutomaticImportantSource(rawMessage);
    if (!autoSource) return;
    if (getAutoImportantRemovedIds(user.id).includes(messageId)) return;

    try {
      await client.post(`/messages/${messageId}/important`);
      setImportantEntries((current) => [{
        ...rawMessage,
        id: messageId,
        title: rawMessage.title || 'Chat',
        conversationId: rawMessage.conversationId || rawMessage.group || rawMessage.to || rawMessage.from,
        type: rawMessage.group ? 'group' : 'dm',
        hasAttachment: Boolean(rawMessage.attachment || rawMessage.attachments?.length),
        attachmentFilename: rawMessage.attachment?.filename || rawMessage.attachments?.[0]?.filename || null,
        text: rawMessage.text || rawMessage.content || null,
        important: true,
        isImportant: true,
        importantAt: new Date().toISOString(),
        importantSource: autoSource,
      }, ...current]);
    } catch (err) {
      // Ignore duplicate or noisy auto-save failures; the backend already
      // guards against repeated writes for the same message.
    }
  }, [user?.id]);

  const recordActivityFromMessage = useCallback(
    (raw) => {
      const at = raw.createdAt || new Date().toISOString();
      const from = raw.from;
      let key;
      if (raw.group) {
        key = conversationKeyForGroup(
          typeof raw.group === "object" ? raw.group.id || raw.group._id : raw.group,
        );
      } else {
        const otherId =
          String(raw.from) === String(user.id) ? raw.to : raw.from;
        if (!otherId) return;
        key = conversationKeyForUser(otherId);
      }
      const prev = getConversationActivity(user.id, key);
      if (
        prev?.at === at &&
        String(prev?.from || "") === String(from || "")
      ) {
        return;
      }
      setConversationActivity(user.id, key, { at, from });
      bumpActivity();
    },
    [user.id, bumpActivity],
  );

  const loadDirectory = useCallback(() => {
    if (!hasLocalKeyring) return;
    setLoadingUsers(true);

    const usersReq = client
      .get("/users", { params: { limit: 20 } })
      .then((res) => {
        setUsers(res.data.data || []);
        setUsersHasMore(Boolean(res.data.meta?.hasMore));
        setUsersCursor(res.data.meta?.nextCursor || null);
      })
      .catch((err) =>
        showToast(err.response?.data?.error || "Failed to load users", "error"),
      );

    const groupsReq = client
      .get("/groups", { params: { limit: 20 } })
      .then((res) => {
        setGroups(res.data.data || []);
        setGroupsHasMore(Boolean(res.data.meta?.hasMore));
        setGroupsCursor(res.data.meta?.nextCursor || null);
      })
      .catch(() => setGroups([]));

    Promise.allSettled([usersReq, groupsReq]).finally(() =>
      setLoadingUsers(false),
    );
  }, [hasLocalKeyring]);
  const loadMoreContacts = useCallback(() => {
    if (!hasLocalKeyring) return;
    if (usersHasMore) {
      client
        .get("/users", { params: { limit: 20, cursor: usersCursor } })
        .then((res) => {
          setUsers((prev) => [...prev, ...(res.data.data || [])]);
          setUsersHasMore(Boolean(res.data.meta?.hasMore));
          setUsersCursor(res.data.meta?.nextCursor || null);
        })
        .catch(() => { });
    }
    if (groupsHasMore) {
      client
        .get("/groups", { params: { limit: 20, cursor: groupsCursor } })
        .then((res) => {
          setGroups((prev) => [...prev, ...(res.data.data || [])]);
          setGroupsHasMore(Boolean(res.data.meta?.hasMore));
          setGroupsCursor(res.data.meta?.nextCursor || null);
        })
        .catch(() => { });
    }
  }, [hasLocalKeyring, usersHasMore, usersCursor, groupsHasMore, groupsCursor]);
  const loadFriendDiscover = useCallback(
    async (q) => {
      setFriendCandidatesLoading(true);
      try {
        const { data } = await client.get("/users/discover", {
          params: q?.trim() ? { q: q.trim() } : undefined,
        });
        setFriendCandidates(data.data || []);
      } catch (err) {
        showToast(
          err.response?.data?.error || "Failed to load people",
          "error",
        );
      } finally {
        setFriendCandidatesLoading(false);
      }
    },
    [showToast],
  );

  const loadFriendRequests = useCallback(async () => {
    try {
      const { data } = await client.get("/users/friend-requests");
      setIncomingRequests(data.data?.incoming || []);
      setOutgoingRequests(data.data?.outgoing || []);
    } catch {
      // non-fatal
    }
  }, []);

  const loadMyFriends = useCallback(async () => {
    setMyFriendsLoading(true);
    try {
      const { data } = await client.get("/users/friends");
      setMyFriends(data.data || []);
    } catch {
      setMyFriends([]);
    } finally {
      setMyFriendsLoading(false);
    }
  }, []);

  /** Instantly reflect an accepted friendship (socket or poll) — no page reload. */
  const applyAcceptedFriendship = useCallback(
    (friend, requestId) => {
      const friendId = String(friend?.id || friend?._id || "");
      if (!friendId) return;

      const current = userRef.current;
      if (current) {
        const friends = Array.from(
          new Set([...(current.friends || []).map(String), friendId]),
        );
        updateSessionUser({ ...current, friends });
      }

      setMyFriends((prev) => {
        if (prev.some((f) => String(f.id || f._id) === friendId)) return prev;
        return [
          {
            id: friendId,
            displayName: friend.displayName,
            username: friend.username,
            hasAvatar: friend.hasAvatar,
            ...friend,
          },
          ...prev,
        ];
      });

      setOutgoingRequests((prev) =>
        prev.filter((r) => {
          if (requestId && String(r.id) === String(requestId)) return false;
          return String(r.user?.id) !== friendId;
        }),
      );
      setIncomingRequests((prev) =>
        prev.filter((r) => {
          if (requestId && String(r.id) === String(requestId)) return false;
          return String(r.user?.id) !== friendId;
        }),
      );

      setContactLookupResult((prev) =>
        prev && String(prev.id) === friendId
          ? { ...prev, requestStatus: "friends", requestId: null }
          : prev,
      );
    },
    [updateSessionUser],
  );

  const isFriendWith = useCallback(
    (peerId) => {
      const id = String(peerId || "");
      if (!id) return false;
      if ((user.friends || []).map(String).includes(id)) return true;
      return myFriends.some((f) => String(f.id || f._id) === id);
    },
    [user?.friends, myFriends],
  );

  const handleLookupContact = useCallback(async () => {
    const raw = contactQuery.trim();
    setContactLookupError("");
    setContactLookupResult(null);
    if (!raw) {
      setContactLookupError("Enter an email or phone number");
      return;
    }

    const looksEmail = raw.includes("@");
    const looksPhone = /^[\d\s+\-().]{7,}$/.test(raw);
    if (!looksEmail && !looksPhone) {
      setContactLookupError("Enter a valid email or phone number");
      return;
    }

    setContactLookupLoading(true);
    try {
      const params = looksEmail
        ? { email: raw.toLowerCase() }
        : { phone: raw };
      const { data } = await client.get("/users/lookup", { params });
      if (!data.data) {
        setContactLookupError(
          looksEmail
            ? "No verified account found for that email"
            : "No account found for that phone number",
        );
        return;
      }
      setContactLookupResult(data.data);
    } catch (err) {
      setContactLookupError(
        err.response?.data?.error || "Lookup failed — try again",
      );
    } finally {
      setContactLookupLoading(false);
    }
  }, [contactQuery]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);
  useEffect(() => {
    const q = search.trim();
    if (!q || filter === "discover" || filter === "public" || filter === "friends") {
      setSearchResults(null);
      return undefined;
    }
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const [usersRes, groupsRes] = await Promise.all([
          client.get("/users", { params: { q, limit: 20 } }),
          client.get("/groups", { params: { q, limit: 20 } }),
        ]);
        setSearchResults({
          users: usersRes.data.data || [],
          groups: groupsRes.data.data || [],
        });
      } catch {
        setSearchResults({ users: [], groups: [] });
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(searchDebounceRef.current);
  }, [search, filter]);
  useEffect(() => {
    if (!user?.id || !Array.isArray(user.mutedChats)) return;
    const now = Date.now();
    const serverMutedKeys = user.mutedChats
      .filter((m) => m.expiresAt == null || new Date(m.expiresAt).getTime() > now)
      .map((m) => String(m.conversationKey));
    const serverSet = new Set(serverMutedKeys);

    // Server is the source of truth once user.mutedChats has loaded — fully replace,
    // not merge, so unmutes actually take effect (not just adds).
    setMutedKeys(serverMutedKeys);

    // Reconcile chatPrefs.js localStorage both ways too, since isChatMuted() elsewhere
    // (socket handlers, sound-on-message checks) reads directly from localStorage, not from state.
    const localSet = new Set(getMutedChatKeys(user.id).map(String));
    serverSet.forEach((key) => {
      if (!localSet.has(key)) toggleMuteChat(user.id, key);
    });
    localSet.forEach((key) => {
      if (!serverSet.has(key)) toggleMuteChat(user.id, key);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.mutedChats]);
  useEffect(() => {
    if (!user?.id) return;
    loadMyFriends();
    loadFriendRequests();
  }, [user?.id, loadMyFriends, loadFriendRequests]);

  useEffect(() => {
    if (!user?.id) return undefined;

    let cancelled = false;
    let inFlight = false;
    let primed = false;
    const knownFriendIds = new Set(
      (userRef.current?.friends || []).map(String),
    );

    async function syncFriendState() {
      if (cancelled || inFlight) return;
      if (document.visibilityState === "hidden") return;

      const socketConnected = Boolean(getSocket()?.connected);
      const hasPending =
        outgoingRequests.length > 0 || incomingRequests.length > 0;
      // Keep polling while requests are pending (acceptances must show without
      // reload). Also poll when Socket.IO is unavailable (e.g. Vercel API).
      if (socketConnected && !hasPending) return;

      inFlight = true;
      try {
        const [reqRes, friendsRes, meRes] = await Promise.all([
          client.get("/users/friend-requests"),
          client.get("/users/friends"),
          client.get("/users/me").catch(() => null),
        ]);
        if (cancelled) return;

        setIncomingRequests(reqRes.data?.data?.incoming || []);
        setOutgoingRequests(reqRes.data?.data?.outgoing || []);

        const friends = friendsRes.data?.data || [];
        setMyFriends(friends);

        const newlyAccepted = friends.filter((f) => {
          const id = String(f.id || f._id);
          return id && !knownFriendIds.has(id);
        });
        friends.forEach((f) => {
          const id = String(f.id || f._id);
          if (id) knownFriendIds.add(id);
        });

        if (meRes?.data?.data) {
          updateSessionUser(meRes.data.data);
        } else {
          newlyAccepted.forEach((f) => applyAcceptedFriendship(f));
        }

        if (primed && newlyAccepted.length === 1 && hasPending) {
          const name =
            newlyAccepted[0].displayName ||
            newlyAccepted[0].username ||
            "Someone";
          showToast(`${name} accepted your friend request`, "success");
        }
        primed = true;
      } catch {
        // non-fatal
      } finally {
        inFlight = false;
      }
    }

    const hasPending =
      outgoingRequests.length > 0 || incomingRequests.length > 0;
    const intervalMs = hasPending ? 4000 : 12000;
    const timer = window.setInterval(syncFriendState, intervalMs);
    if (hasPending || !getSocket()?.connected) {
      syncFriendState();
    }
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // Intentionally omit myFriends / user.friends from deps — knownFriendIds
    // is seeded once per effect run; length of pending queues drives restarts.
  }, [
    user?.id,
    outgoingRequests.length,
    incomingRequests.length,
    updateSessionUser,
    applyAcceptedFriendship,
    showToast,
  ]);

  useEffect(() => {
    if (filter === "all") {
      loadMyFriends();
    }
    if (filter !== "friends") return;
    loadFriendDiscover(search);
    loadFriendRequests();
    loadMyFriends();
  }, [filter, search, loadFriendDiscover, loadFriendRequests, loadMyFriends]);
  // Socket routing and listener hooks
  useEffect(() => {
    if (!hasLocalKeyring) return;
    connectSocket();
    const socket = getSocket();
    if (!socket) return undefined;

    function isCurrentConversation(raw) {
      const current = selectedRef.current;
      if (!current) return false;
      if (raw.group) {
        return (
          current.type === "group" && String(current.id) === String(raw.group)
        );
      }
      const otherId = String(raw.from) === String(user.id) ? raw.to : raw.from;
      return current.type === "dm" && String(current.id) === String(otherId);
    }

    function handleIncoming(raw) {
      if (raw.group) {
        // group messages
      } else {
        const otherId =
          String(raw.from) === String(user.id) ? raw.to : raw.from;
        const blocked = (user.blockedUsers || []).map(String);
        if (blocked.includes(String(otherId))) return;
      }

      recordActivityFromMessage(raw);

      const isCurrent = isCurrentConversation(raw);
      const fromSelf = String(raw.from) === String(user.id);

      if (!fromSelf) {
        const convKey = raw.group
          ? conversationKeyForGroup(
            typeof raw.group === "object" ? raw.group.id || raw.group._id : raw.group,
          )
          : conversationKeyForUser(
            String(raw.from) === String(user.id) ? raw.to : raw.from,
          );

        // Count unread only when the message is for a chat that isn't open.
        if (!isCurrent) {
          incrementUnreadCount(user.id, convKey);
          bumpActivity();
        }

        const muted = isChatMuted(user.id, convKey);
        const isMention = Array.isArray(raw.mentionedUserIds)
          ? raw.mentionedUserIds.map(String).includes(String(user.id))
          : false;
        if (isMention) {
          const messageId = raw.id || raw._id;
          const groupId = typeof raw.group === "object" ? raw.group.id || raw.group._id : raw.group;
          const groupName = typeof raw.group === "object" ? raw.group.name : undefined;
          const actorId = raw.from;
          const actor = resolveActivityActor(actorId);
          const decoratedMessage = decorate(raw);
          const mentionId = messageId || (actorId && (groupId || raw.to) ? `${actorId}:${groupId || raw.to}` : null);
          if (mentionId) {
            activityStore.appendEvent({
              id: mentionId,
              type: "mention",
              actorId,
              actorName: actor.actorLabel,
              actorIsCurrentUser: actor.actorIsCurrentUser,
              targetId: groupId || raw.to,
              messageId,
              groupId,
              groupName: groupName || groupsRef.current.find((candidate) => String(candidate.id || candidate._id) === String(groupId))?.name,
              preview: decoratedMessage.text,
              conversationKey: groupId ? `group:${groupId}` : raw.to ? `dm:${raw.from}` : undefined,
            });
          }
        }
        const decoratedForNotif = decorate(raw);
              if (raw.timeCapsule && raw.capsuleDeliveredAt) {
        showToast('✨ A time capsule just unlocked!', 'success', 5000);
      }
        const storyPayload = parseStoryPayload(decoratedForNotif.text);
        const reactionsExcluded =
          notifSettings?.messageNotifications === "all_except_reactions" &&
          storyPayload?.type === "story_reaction";
        const notifyOk =
          !muted &&
          !reactionsExcluded &&
          (storyPayload
            ? notifSettings?.statusNotifications !== "off"
            : shouldNotify(notifSettings, {
              kind: raw.group ? "group" : "dm",
              isMention,
              isAnnouncement: raw.kind === "announcement",   // NEW
            }));

        if (notifyOk) {
          const tabHidden = document.visibilityState === "hidden";
          // Alert when another chat arrives, or when this tab is in the background.
          const shouldAlert = !isCurrent || tabHidden;
          if (shouldAlert) {
            playNotificationSound(notifSettings);
            const senderName =
              users.find((u) => String(u.id) === String(raw.from))?.displayName ||
              users.find((u) => String(u.id) === String(raw.from))?.username ||
              "Someone";
            const groupName = raw.group
              ? groups.find((g) => String(g.id) === String(raw.group))?.name
              : null;

            const buffer = pendingNotificationsRef.current.get(convKey) || [];
            buffer.push({ senderName, text: decoratedForNotif.text });
            pendingNotificationsRef.current.set(convKey, buffer);

            const { title, body } = buildGroupedNotificationText(buffer, {
              isGroup: Boolean(raw.group),
              groupName,
              notifSettings,
            });

            // The notification's tag must match exactly what the server's
            // push uses (backend/src/utils/conversationKey.js), or the
            // IndexedDB content-cache lookup in sw.js's push handler always
            // misses and silently falls back to generic "New message" text.
            // Groups already matched (`group:${id}` both sides); DMs did
            // NOT — the client's own `convKey` here is `dm:${peerId}` while
            // the server sorts both participant ids together, so build the
            // matching tag separately rather than reusing convKey.
            const pushTag = raw.group
              ? `group:${raw.group}`
              : `dm:${[String(raw.from), String(raw.to)].sort().join(':')}`;
            console.log('[notif] client-computed pushTag =', JSON.stringify(pushTag), { from: raw.from, to: raw.to, group: raw.group });


            showNotificationPopup(
              {
                title,
                body,
                tag: pushTag,
                actions: [
                  { action: 'reply', title: 'Reply', type: 'text', placeholder: 'Type a reply…' },
                  { action: 'mark_read', title: 'Mark as Read' },
                ],
                data: {
                  url: raw.group ? `/chat/g/${raw.group}` : `/chat/${String(raw.from) === String(user.id) ? raw.to : raw.from}`,
                  kind: raw.group ? 'group' : 'dm',
                  fromUserId: String(raw.from) === String(user.id) ? String(raw.to) : String(raw.from),
                },
              },
              notifSettings,
              () => {
                const target = raw.group
                  ? { key: convKey, type: "group", id: raw.group }
                  : {
                    key: convKey,
                    type: "dm",
                    id: String(raw.from) === String(user.id) ? raw.to : raw.from,
                  };
                handleSelectConversation(target);
              });
          } else if (!muted) {
            playReceiveSound(
              typeof notifSettings?.soundVolume === "number"
                ? notifSettings.soundVolume / 100
                : 1,
            );
          }
        }
      }

      // Always acknowledge delivery as soon as the client receives the message
      // over the socket, regardless of whether this conversation is currently open.
      if (String(raw.from) !== String(user.id)) {
        const socket = getSocket();
        socket?.emit("message:delivered", { messageId: raw.id || raw._id });
      }

      // Only mutate the open thread for the active conversation.
      if (!isCurrent) return;

      if (!fromSelf && selectedRef.current?.key) {
        markConversationRead(
          user.id,
          selectedRef.current.key,
          raw.createdAt || new Date().toISOString(),
        );
        bumpActivity();
      }

      setMessages((prev) => {
        const id = String(raw.id || raw._id);
        if (prev.some((m) => String(m.id || m._id) === id)) return prev;

        let next;
        // Replace the oldest optimistic bubble in this conversation (FIFO)
        // so own sends don't double when the socket arrives before HTTP.
        if (String(raw.from) === String(user.id)) {
          let replaced = false;
          const confirmed = decorate(raw);
          next = [];
          for (const m of prev) {
            if (
              !replaced &&
              m._pending &&
              String(m.from) === String(user.id) &&
              (raw.group
                ? String(m.group || "") === String(raw.group)
                : String(m.to || "") === String(raw.to))
            ) {
              next.push({
                ...confirmed,
                text: m.text ?? confirmed.text,
                _pending: undefined,
                _status: undefined,
              });
              replaced = true;
              continue;
            }
            next.push(m);
          }
          if (!replaced) next.push(confirmed);
        } else {
          next = [...prev, decorate(raw)];
        }

        if (messageListRef.current) {
          const el = messageListRef.current;
          const isUp = el.scrollHeight - el.scrollTop - el.clientHeight > 150;
          if (isUp) {
            setHasUnread(true);
          } else {
            setTimeout(() => scrollToBottom("smooth"), 50);
          }
        }
        return next;
      });
      void markMessageImportantIfNeeded(raw);

      if (String(raw.from) !== String(user.id)) {
        const socket = getSocket();

        const rawGroupId =
          raw.group && typeof raw.group === "object"
            ? raw.group.id || raw.group._id
            : raw.group;

        if (
          selectedRef.current?.type === "group" &&
          rawGroupId &&
          String(selectedRef.current.id) === String(rawGroupId)
        ) {
          socket?.emit("message:read", {
            messageId: raw.id || raw._id,
            groupId: selectedRef.current.id,
          });
          client
            .post(`/groups/${selectedRef.current.id}/messages/read`)
            .catch(() => { });
        } else if (
          selectedRef.current?.type === "dm" &&
          String(selectedRef.current.id) === String(raw.from)
        ) {
          socket?.emit("message:read", { messageId: raw.id || raw._id });
          client
            .post(`/messages/${selectedRef.current.id}/read`)
            .catch(() => { });
        }
      }
    }

    function handleDeleted(payload) {
      const id = String(payload?.id || "");
      if (!id) return;
      setMessages((prev) => prev.filter((m) => String(m.id || m._id) !== id));
    }

    function handleExpired(payload) {
      const id = String(payload?.id || "");
      if (!id) return;
      setMessages((prev) => prev.filter((m) => String(m.id || m._id) !== id));
    }

    function handleReaction(raw) {
      const messageId = String(raw?.id || raw?._id || raw?.messageId || raw?.message?.id || raw?.message?._id || "");
      if (!messageId) return;

      // raw is a full-message snapshot, not a delta — diff its decrypted
      // reactions against what we last rendered for this message to find
      // out WHO just reacted and with WHAT emoji. raw.from is the message's
      // original author, never the reactor — do not use it for actorId.
      const decorated = decorate(raw);
      const prevMessage = messagesRef.current.find(
        (candidate) => String(candidate.id || candidate._id) === messageId,
      );
      const prevReactions = prevMessage?.reactions || [];
      const nextReactions = decorated.reactions || [];
      const changed = nextReactions.find((next) => {
        const prev = prevReactions.find((p) => String(p.user) === String(next.user));
        return !prev || prev.emoji !== next.emoji;
      });

      if (changed) {
        const actorId = changed.user;
        const actor = resolveActivityActor(actorId);
        const groupId = typeof raw?.group === "object" ? raw.group.id || raw.group._id : raw?.group;
        const groupName = typeof raw?.group === "object" ? raw.group.name : groupsRef.current.find((candidate) => String(candidate.id || candidate._id) === String(groupId))?.name;
        const originalAuthor = resolveActivityActor(decorated.from);
        activityStore.appendEvent({
          id: `${messageId}:${actorId}:${changed.emoji || "clear"}:${Date.now()}`,
          type: "reaction",
          targetId: messageId,
          messageId,
          actorId,
          actorName: actor.actorLabel,
          actorIsCurrentUser: actor.actorIsCurrentUser,
          emoji: changed.emoji,
          groupId,
          groupName,
          preview: decorated.text,
          originalAuthorLabel: originalAuthor.actorLabel,
          originalAuthorIsCurrentUser: originalAuthor.actorIsCurrentUser,
          reactedByYou: actor.actorIsCurrentUser,
          conversationKey: groupId ? `group:${groupId}` : undefined,
        });
      }

      if (changed && String(actorId) !== String(user.id)) {
        const convKey = groupId
          ? conversationKeyForGroup(groupId)
          : conversationKeyForUser(String(decorated.from) === String(user.id) ? decorated.to : decorated.from);
        const muted = isChatMuted(user.id, convKey);
        if (!muted && shouldNotify(notifSettings, { kind: 'reaction' })) {
          playNotificationSound(notifSettings);
          showNotificationPopup(
            {
              title: 'QuantumChat',
              body: `${actor.actorLabel} reacted ${changed.emoji || ''} to your message`,
              tag: groupId ? `group:${groupId}` : `dm:${[String(user.id), String(actorId)].sort().join(':')}`,
            },
            notifSettings,
            () =>
              handleSelectConversation(
                groupId ? { key: convKey, type: 'group', id: groupId } : { key: convKey, type: 'dm', id: actorId },
              ),
          );
        }
      }

      if (!isCurrentConversation(raw)) return;
      setMessages((prev) =>
        prev.map((m) => (String(m.id || m._id) === messageId ? decorated : m)),
      );
    }

    function handleEdited(raw) {
      const id = String(raw?.id || raw?._id || "");
      if (!id) return;
      if (!isCurrentConversation(raw)) return;
      setMessages((prev) =>
        prev.map((m) => (String(m.id || m._id) === id ? decorate(raw) : m)),
      );
    }

    function handleViewOnceOpened(raw) {
      const id = String(raw?.id || raw?._id || "");
      if (!id) return;
      // Prefer updating by id if the message is already on screen — more
      // reliable than conversation matching when from/to/group shapes differ.
      setMessages((prev) => {
        const idx = prev.findIndex((m) => String(m.id || m._id) === id);
        if (idx === -1) return prev;
        const current = prev[idx];
        const decorated = decorate(raw);
        const next = [...prev];
        next[idx] = {
          ...decorated,
          // Keep decrypted text if the opened payload stripped envelopes.
          text: decorated.text ?? current.text,
        };
        return next;
      });
    }

    function handleGroupNew(payload = {}) {
      const group = payload?.group || payload;
      const groupId = group?.id || group?._id || payload?.groupId;
      if (groupId) {
        activityStore.appendEvent({
          id: `new:${groupId}`,
          type: "group",
          targetId: groupId,
          groupId,
          groupName: group?.name || payload?.groupName,
          action: "created",
          actorId: payload?.actorId || payload?.createdBy,
          ...resolveActivityActor(payload?.actorId || payload?.createdBy),
        });
      }
      setGroups((prev) => {
        if (!groupId) return prev;

        if (prev.some((g) => String(g.id || g._id) === String(groupId))) {
          return prev.map((g) =>
            String(g.id || g._id) === String(groupId) ? group : g,
          );
        }
        return [group, ...prev];
      });
    }
    async function handleFriendRequestNew(payload = {}) {
      const request = payload?.request || payload;
      const requestId = request.id || request._id || request.requestId || payload.requestId;
      const actorId = request.from || request.senderId || request.userId || payload.from;
      const actor = resolveActivityActor(actorId);
      if (requestId || actorId) {
        activityStore.appendEvent({
          id: requestId || `from:${actorId}`,
          type: "friend_request",
          actorId,
          actorName: actor.actorLabel,
          actorIsCurrentUser: actor.actorIsCurrentUser,
          targetId: request.to || request.recipientId || user?.id,
        });
      }
      loadFriendRequests();
      showToast("New friend request", "info");
    }
    async function handleFriendRequestAccepted(payload = {}) {
      const friend = payload?.friend;
      const requestId = payload?.id || payload?.requestId;
      if (friend) {
        applyAcceptedFriendship(friend, requestId);
        const name = friend.displayName || friend.username || "Someone";
        showToast(`You're now friends with ${name}`, "success");
      }

      try {
        const { data } = await client.get("/users/me");
        if (data?.data) updateSessionUser(data.data);
      } catch {
        // non-fatal
      }

      loadDirectory();
      loadFriendRequests();
      loadMyFriends();
      loadFriendDiscover(search);
    }
    async function handleFriendRemoved(payload = {}) {
      const removedBy = payload?.by;
      if (removedBy && userRef.current) {
        const nextFriends = (userRef.current.friends || [])
          .map(String)
          .filter((id) => id !== String(removedBy));
        updateSessionUser({ ...userRef.current, friends: nextFriends });
        setMyFriends((prev) =>
          prev.filter((f) => String(f.id || f._id) !== String(removedBy)),
        );
      }
      try {
        const { data } = await client.get("/users/me");
        if (data?.data) updateSessionUser(data.data);
      } catch {
        // non-fatal
      }
      loadDirectory();
      loadMyFriends();
    }

    function handleGroupUpdated(payload = {}) {
      const group = payload?.group || payload;
      const groupId = group.id || group._id || payload.groupId;
      if (!groupId) return;
      activityStore.appendEvent({
        id: `updated:${groupId}`,
        type: "group",
        targetId: groupId,
        groupId,
        groupName: group.name || payload.groupName,
        action: "updated",
        actorId: payload.actorId || payload.updatedBy,
        ...resolveActivityActor(payload.actorId || payload.updatedBy),
      });
      setGroups((prev) => {
        if (prev.some((g) => String(g.id) === String(groupId))) {
          return prev.map((g) =>
            String(g.id) === String(groupId) ? group : g,
          );
        }
        return [group, ...prev];
      });
      const current = selectedRef.current;
      if (
        current?.type === "group" &&
        String(current.id) === String(groupId)
      ) {
        const memberCount = (group.members || []).length;
        const desc = (group.description || "").trim();
        setSelected((prev) =>
          prev
            ? {
              ...prev,
              group,
              title: group.name || prev.title,
              subtitle: desc
                ? desc.slice(0, 60) + (desc.length > 60 ? "…" : "")
                : `${memberCount} member${memberCount === 1 ? "" : "s"}`,
            }
            : prev,
        );
        setPinnedIds((group.pinnedMessageIds || []).map(String));
      }
    }

    function handleGroupDeleted(payload = {}) {
      const id = payload.id || payload._id || payload.groupId || payload.group?.id || payload.group?._id;
      if (!id) return;
      activityStore.appendEvent({
        id: `deleted:${id}`,
        type: "group",
        targetId: id,
        groupId: id,
        groupName: payload.groupName || payload.group?.name,
        action: "deleted",
        actorId: payload.actorId || payload.deletedBy,
        ...resolveActivityActor(payload.actorId || payload.deletedBy),
      });
      setGroups((prev) => prev.filter((g) => String(g.id) !== String(id)));
      const current = selectedRef.current;
      if (current?.type === "group" && String(current.id) === String(id)) {
        setSelected(null);
        setMessages([]);
        setShowGroupSettings(false);
        setShowCommandCenter(false);
        if (location.pathname !== "/chat") navigate("/chat");
      }
    }

    function handlePollUpdate(raw) {
      const id = String(raw?.id || raw?._id || "");
      if (!id) return;
      if (!isCurrentConversation(raw)) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m.id || m._id) === id
            ? { ...decorate(raw), pollVotes: raw.pollVotes || [] }
            : m,
        ),
      );
    }

     function handleMentionNew(payload = {}) {
      const message = payload?.message || payload;
      const from = message.from || message.senderId || payload.from;
      const messageId = message.id || message._id || message.messageId || payload.messageId;
      const groupId = message.groupId || message.group || payload.groupId;
      const mentionId = messageId || (from && groupId ? `${from}:${groupId}` : null);
      if (mentionId) {
        activityStore.appendEvent({
          id: mentionId,
          type: "mention",
          actorId: from,
          targetId: groupId || message.to || payload.to,
          messageId,
          conversationKey: groupId ? `group:${groupId}` : undefined,
        });
      }

      const isSelf = String(from) === String(user.id);
      const username = isSelf
        ? user.username
        : users.find((u) => String(u.id) === String(from))?.username;
      const groupName = groupId
        ? groups.find((g) => String(g.id) === String(groupId))?.name
        : null;

      const convKey = groupId ? conversationKeyForGroup(groupId) : null;
      const muted = convKey ? isChatMuted(user.id, convKey) : false;
      const current = selectedRef.current;
      const isCurrent =
        groupId && current?.type === "group" && String(current.id) === String(groupId);

      // Mentions always alert unless the chat itself is muted — a mention
      // is a direct call-out, so it shouldn't be silently downgraded to a
      // toast the way a routine group message can be.
      if (isSelf || muted) {
        showToast(`${username || "Someone"} mentioned you`);
        return;
      }

      playNotificationSound(notifSettings);
      showNotificationPopup(
        {
          title: groupName || "Group mention",
          body: `${username || "Someone"} mentioned you`,
          tag: groupId ? `group:${groupId}` : undefined,
          data: {
            url: groupId ? `/chat/g/${groupId}` : undefined,
            kind: "group",
          },
        },
        notifSettings,
        () => {
          if (groupId) {
            handleSelectConversation({ key: convKey, type: "group", id: groupId });
          }
          if (messageId) handleSearchResult(messageId);
        },
      );

      if (!isCurrent) {
        showToast(`${username || "Someone"} mentioned you in ${groupName || "a group"}`);
      }
    }

    function handleTypingStart({ from, groupId } = {}) {
      console.log('[TYPING-DBG] typing:start received', { from, groupId, currentSelected: selectedRef.current?.id, currentType: selectedRef.current?.type });
      const current = selectedRef.current;
      if (!current) { console.log('[TYPING-DBG] no current selected, ignoring'); return; }
      if (
        groupId &&
        current.type === "group" &&
        String(groupId) === String(current.id)
      ) {
        if (String(from) === String(user.id)) { console.log('[TYPING-DBG] own typing, ignoring'); return; }
        const activeGroup = groups.find((g) => String(g.id) === String(current.id)) || current.group;
        let u = users.find((u) => String(u.id) === String(from));
        console.log('[TYPING-DBG] resolved user from users array:', u);
        if (!u) {
          const member = (activeGroup?.members || []).find(
            (m) => String(m.user?._id || m.user?.id || m.id || m._id) === String(from)
          );
          u = member?.user || member;
          console.log('[TYPING-DBG] resolved user from group members:', u);
        }
        const name = u?.username || "Someone";
        const hasAvatar = u?.hasAvatar || !!u?.avatarPath;
        const userObj = { id: from, username: name, hasAvatar };
        console.log('[TYPING-DBG] setting groupTypingUsers with', userObj);

        setGroupTypingUsers((prev) => {
          const filtered = prev.filter(p => String(p.id) !== String(from));
          return [...filtered, userObj].slice(-5);
        });
        clearTimeout(typingPeerTimeoutRef.current);
        typingPeerTimeoutRef.current = setTimeout(
          () => setGroupTypingUsers([]),
          3000,
        );
        return;
      }
      console.log('[TYPING-DBG] group condition not matched — groupId:', groupId, 'current.type:', current?.type, 'current.id:', current?.id);
      if (current.type !== "dm") return;
      if (String(from) !== String(current.id)) return;
      setPeerTyping(true);
      clearTimeout(typingPeerTimeoutRef.current);
      typingPeerTimeoutRef.current = setTimeout(
        () => setPeerTyping(false),
        4000,
      );
    }

    function handleTypingStop({ from, groupId } = {}) {
      const current = selectedRef.current;
      if (!current) return;
      if (
        groupId &&
        current.type === "group" &&
        String(groupId) === String(current.id)
      ) {
        setGroupTypingUsers((prev) => prev.filter((u) => String(u.id) !== String(from)));
        return;
      }
      if (current.type !== "dm") return;
      if (String(from) !== String(current.id)) return;
      setPeerTyping(false);
    }

    function handlePresenceSnapshot({ onlineUserIds: ids } = {}) {
      setOnlineUserIds(new Set((ids || []).map(String)));
    }

    function handlePresenceUpdate({ userId, online, lastLoginAt } = {}) {
      const id = String(userId);
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (online) next.add(id);
        else next.delete(id);
        return next;
      });
      if (lastLoginAt) {
        setUsers((prev) =>
          prev.map((u) =>
            String(u.id) === id ? { ...u, lastLoginAt } : u,
          ),
        );
        setSelected((cur) => {
          if (!cur || cur.type !== "dm" || String(cur.id) !== id) return cur;
          if (cur.peer?.lastLoginAt === lastLoginAt) return cur;
          return {
            ...cur,
            peer: { ...(cur.peer || {}), lastLoginAt },
          };
        });
      }
    }

    function handleMessageStatus(payload) {
      if (!payload) return;
      if (payload.groupId && Array.isArray(payload.messageIds)) {
        const idSet = new Set(payload.messageIds.map(String));
        const rUid = String(payload.userId || "");
        const readAt = payload.readAt ? new Date(payload.readAt).toISOString() : null;
        const deliveredAt = (payload.deliveredAt || payload.readAt)
          ? new Date(payload.deliveredAt || payload.readAt).toISOString()
          : null;
        setMessages((prev) =>
          prev.map((m) => {
            const mid = String(m.id || m._id);
            if (!idSet.has(mid)) return m;
            const existingRead = (m.readBy || []).filter((r) => String(r.user) !== rUid);
            const existingDelivered = (m.deliveredTo || []).filter((d) => String(d.user) !== rUid);
            const nextDelivered = deliveredAt
              ? [...existingDelivered, { user: rUid, at: deliveredAt }]
              : m.deliveredTo || [];
            const nextRead = readAt
              ? [...existingRead, { user: rUid, at: readAt }]
              : m.readBy || [];
            return {
              ...m,
              deliveredTo: nextDelivered,
              readBy: nextRead,
            };
          }),
        );
        return;
      }
      if (payload.bulk && payload.conversationWith) {
        const peer = String(payload.conversationWith);
        setMessages((prev) =>
          prev.map((m) =>
            String(m.to) === peer || String(m.from) === peer
              ? {
                ...m,
                deliveredAt: m.deliveredAt || payload.readAt,
                readAt:
                  String(m.from) === String(user.id)
                    ? payload.readAt || m.readAt
                    : m.readAt,
              }
              : m,
          ),
        );
        return;
      }
      const id = String(payload.id || "");
      if (!id) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m.id || m._id) === id
            ? {
              ...m,
              deliveredAt: payload.deliveredAt || m.deliveredAt,
              readAt: payload.readAt || m.readAt,
              _status: undefined,
            }
            : m,
        ),
      );
    }

    function handleChatCleared(payload = {}) {
      // Multi-device sync: another of this user's sessions cleared a chat.
      // Scoped clears (photos only, etc.) must NOT wipe the whole thread —
      // only drop matching messages. Full "all" clears empty the view.
      const current = selectedRef.current;
      if (!current) return;
      const matchesGroup =
        payload.groupId &&
        current.type === "group" &&
        String(current.id) === String(payload.groupId);
      const matchesDm =
        payload.peerId &&
        current.type === "dm" &&
        String(current.id) === String(payload.peerId);
      if (!matchesGroup && !matchesDm) return;

      const scopes = Array.isArray(payload.scopes) && payload.scopes.length
        ? payload.scopes.map(String)
        : ["all"];
      if (scopes.includes("all")) {
        setMessages([]);
        return;
      }

      const clearedAtMs = payload.clearedAt
        ? new Date(payload.clearedAt).getTime()
        : Date.now();

      setMessages((prev) =>
        prev.filter((m) => {
          const createdMs = new Date(m.createdAt || 0).getTime();
          if (createdMs > clearedAtMs) return true;
          return !scopes.some((scope) => messageMatchesClearScope(m, scope));
        }),
      );
    }

    function handleChatClearUndone(payload = {}) {
      // Another of this user's sessions undid a clear — re-fetch if we're
      // looking at that conversation so hidden messages come back.
      const current = selectedRef.current;
      if (!current) return;
      const matchesGroup =
        payload.groupId &&
        current.type === "group" &&
        String(current.id) === String(payload.groupId);
      const matchesDm =
        payload.peerId &&
        current.type === "dm" &&
        String(current.id) === String(payload.peerId);
      if (!matchesGroup && !matchesDm) return;

      const endpoint =
        current.type === "group"
          ? `/groups/${current.id}/messages`
          : `/messages/${current.id}`;
      setLoadingMessages(true);
      client
        .get(endpoint, { params: { limit: 80, markRead: 0 } })
        .then((res) => {
          setMessages((res.data.data || []).map((raw) => decorateRef.current(raw)));
        })
        .catch(() => {})
        .finally(() => setLoadingMessages(false));
    }

    function handleUserStatus(payload = {}) {
      const { userId: statusUserId } = payload;
      if (!statusUserId) return;
      const nextStatus = payload.statusText || "";
      // Reflect the new custom status in the contact list...
      setUsers((prev) =>
        prev.map((u) =>
          String(u.id) === String(statusUserId) ? { ...u, statusText: nextStatus } : u,
        ),
      );
      // ...the currently-open DM (so the header/peer view updates live)...
      setSelected((prev) =>
        prev && prev.type === "dm" && String(prev.id) === String(statusUserId)
          ? {
            ...prev,
            statusText: nextStatus,
            peer: prev.peer ? { ...prev.peer, statusText: nextStatus } : prev.peer,
          }
          : prev,
      );
      // ...and our own session (when this is our own status echoed back to us).
      if (String(statusUserId) === String(user.id)) {
        updateSessionUser({ ...userRef.current, statusText: nextStatus });
      }
    }

    socket.on("message:new", handleIncoming);
    socket.on("message:deleted", handleDeleted);
    socket.on("message:expired", handleExpired);
    socket.on("message:reaction", handleReaction);
    socket.on("message:edited", handleEdited);
    socket.on("message:view-once-opened", handleViewOnceOpened);
    socket.on("group:new", handleGroupNew);
    socket.on("group:updated", handleGroupUpdated);
    socket.on("group:deleted", handleGroupDeleted);
    socket.on("message:poll", handlePollUpdate);
    socket.on("mention:new", handleMentionNew);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);
    socket.on("presence:snapshot", handlePresenceSnapshot);
    socket.on("presence:update", handlePresenceUpdate);
    socket.on("message:status", handleMessageStatus);
    socket.on("friend:request:new", handleFriendRequestNew);
    socket.on("friend:request:accepted", handleFriendRequestAccepted);
    socket.on("friend:removed", handleFriendRemoved);
    socket.on("chat:cleared", handleChatCleared);
    socket.on("chat:clear-undone", handleChatClearUndone);
    socket.on("user:status", handleUserStatus);

    // Auth may connect the socket before Chat mounts, so the initial
    // presence:snapshot is easy to miss. Re-request whenever listeners attach
    // and again after every reconnect.
  function requestPresence() {
  if (socket.connected) {
    socket.emit("presence:request");
    syncTypingPrivacy();
  }
  }
  socket.on("connect", requestPresence);
  requestPresence();

    return () => {
      socket.off("message:new", handleIncoming);
      socket.off("message:deleted", handleDeleted);
      socket.off("message:expired", handleExpired);
      socket.off("message:reaction", handleReaction);
      socket.off("message:edited", handleEdited);
      socket.off("message:view-once-opened", handleViewOnceOpened);
      socket.off("group:new", handleGroupNew);
      socket.off("group:updated", handleGroupUpdated);
      socket.off("group:deleted", handleGroupDeleted);
      socket.off("message:poll", handlePollUpdate);
      socket.off("mention:new", handleMentionNew);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
      socket.off("presence:snapshot", handlePresenceSnapshot);
      socket.off("presence:update", handlePresenceUpdate);
      socket.off("message:status", handleMessageStatus);
      socket.off("friend:request:new", handleFriendRequestNew);
      socket.off("friend:request:accepted", handleFriendRequestAccepted);
      socket.off("friend:removed", handleFriendRemoved);
      socket.off("chat:cleared", handleChatCleared);
      socket.off("chat:clear-undone", handleChatClearUndone);
      socket.off("user:status", handleUserStatus);
  socket.off("connect", requestPresence);
  stopTyping({ emit: false });
  clearTimeout(typingPeerTimeoutRef.current);
  setPeerTyping(false);
  setGroupTypingUsers([]);
  };
  }, [
    hasLocalKeyring,
    user,
    users,
    groups,
    decorate,
    scrollToBottom,
    recordActivityFromMessage,
    bumpActivity,
    showToast,
    notifSettings,
    applyAcceptedFriendship,
    updateSessionUser,
    loadDirectory,
    loadFriendRequests,
    loadMyFriends,
    loadFriendDiscover,
    search,
  ]);

  // Production (Vercel API) has no Socket.IO — poll REST presence/typing instead.
  useEffect(() => {
    if (!hasLocalKeyring || !user?.id) return undefined;

    let cancelled = false;
    let inFlight = false;
    let lastSocketPeerSyncAt = 0;
    let lastWatchedPeerId = null;

    async function syncPresence() {
      if (cancelled || inFlight) return;
      if (document.visibilityState === "hidden") return;
      const socket = getSocket();
      const socketConnected = Boolean(socket?.connected);

      const current = selectedRef.current;
      const watchPeerId =
        current?.type === "dm" &&
          !current.isSelfChat &&
          String(current.id) !== String(user.id)
          ? String(current.id)
          : null;
      const watchGroupId =
        current?.type === "group" ? String(current.id) : null;
      const typing = presenceTypingRef.current || {};

      // Socket owns live online/typing. Still heartbeat when watching a peer so
      // last-seen stays fresh (and as full fallback when the socket is down).
      if (socketConnected) {
        if (!watchPeerId) return;
        const peerChanged = watchPeerId !== lastWatchedPeerId;
        lastWatchedPeerId = watchPeerId;
        // Avoid hammering the DB every 2s while Socket.IO is already connected.
        if (!peerChanged && Date.now() - lastSocketPeerSyncAt < 12_000) return;
        lastSocketPeerSyncAt = Date.now();
      }

      inFlight = true;
      try {
        const data = await postPresenceHeartbeat({
          typingTo: typing.to || null,
          typingGroupId: typing.groupId || null,
          watchPeerId,
          watchGroupId,
        });

        if (cancelled) return;

        if (!socketConnected) {
          setOnlineUserIds(new Set((data.onlineUserIds || []).map(String)));
        }

        const peerPresence = data.peerPresence;
        if (peerPresence?.userId) {
          const peerId = String(peerPresence.userId);
          if (peerPresence.lastLoginAt) {
            setUsers((prev) =>
              prev.map((u) =>
                String(u.id) === peerId
                  ? { ...u, lastLoginAt: peerPresence.lastLoginAt }
                  : u,
              ),
            );
            setSelected((cur) => {
              if (!cur || cur.type !== "dm" || String(cur.id) !== peerId) return cur;
              if (cur.peer?.lastLoginAt === peerPresence.lastLoginAt) return cur;
              return {
                ...cur,
                peer: { ...(cur.peer || {}), lastLoginAt: peerPresence.lastLoginAt },
              };
            });
          }
        }

        if (socketConnected) return;

        const events = Array.isArray(data.typing) ? data.typing : [];
        if (watchPeerId) {
          const peerTypingNow = events.some(
            (t) => String(t.from) === watchPeerId && !t.groupId,
          );
          setPeerTyping(peerTypingNow);
        } else {
          setPeerTyping(false);
        }

        if (watchGroupId) {
          const typingUserObjs = events
            .filter((t) => String(t.groupId) === watchGroupId && String(t.from) !== String(user.id))
            .map((t) => {
              const u = usersRef.current.find(
                (x) => String(x.id) === String(t.from),
              );
              return {
                id: t.from,
                username: u?.username || u?.displayName || "Someone",
                hasAvatar: u?.hasAvatar || Boolean(u?.avatarPath),
              };
            });
          const unique = typingUserObjs.filter(
            (u, i, arr) => arr.findIndex(x => String(x.id) === String(u.id)) === i
          ).slice(-5);
          setGroupTypingUsers(unique);
        } else {
          setGroupTypingUsers([]);
        }
      } catch {
        // Keep retrying; transient failures should not require a reload.
      } finally {
        inFlight = false;
      }
    }

    syncPresence();
    const timer = window.setInterval(syncPresence, 2000);
    const onVisible = () => {
      if (document.visibilityState === "visible") syncPresence();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", syncPresence);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", syncPresence);
    };
  }, [hasLocalKeyring, user?.id]);

  const selectedKey = selected?.key;
  const selectedType = selected?.type;
  const selectedId = selected?.id;
  const decorateRef = useRef(decorate);
  decorateRef.current = decorate;
  const recordActivityRef = useRef(recordActivityFromMessage);
  recordActivityRef.current = recordActivityFromMessage;
  const scrollToBottomRef = useRef(scrollToBottom);
  scrollToBottomRef.current = scrollToBottom;
  const bumpActivityRef = useRef(bumpActivity);
  bumpActivityRef.current = bumpActivity;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const loadedThreadKeyRef = useRef(null);

  useEffect(() => {
    if (!selectedKey || !selectedId || !hasLocalKeyring) return undefined;

    const threadKey = selectedKey;
    const threadType = selectedType;
    const threadId = selectedId;
    // DMs must use a real Mongo ObjectId — reserved paths like "important"
    // or "settings" must never hit GET /messages/:userId.
    if (
      threadType === "dm" &&
      !/^[a-f0-9]{24}$/i.test(String(threadId))
    ) {
      return undefined;
    }
    const switching = loadedThreadKeyRef.current !== threadKey;
    loadedThreadKeyRef.current = threadKey;

    setDisappearSeconds(0);
    setMediaPreview(null);
    let cancelled = false;
    setPeerTyping(false);
    setHasMoreMessages(false);
    oldestCreatedAtRef.current = null;

    if (switching) {
      if (threadType === "group") {
        setPinnedIds(
          (selectedRef.current?.group?.pinnedMessageIds || []).map(String),
        );
      } else {
        setPinnedIds(getPinnedIds(user.id, threadKey));
      }
      // Only flash skeletons when opening a different conversation — not on
      // sidebar activity / URL-sync object identity churn.
      setLoadingMessages(true);
      setMessages([]);
    }

    const endpoint =
      threadType === "group"
        ? `/groups/${threadId}/messages`
        : `/messages/${threadId}`;

    client
      .get(endpoint, { params: { limit: 80, markRead: 1 } })
      .then((res) => {
        if (cancelled) return;
        const next = (res.data.data || []).map((raw) => decorateRef.current(raw));
        getOfflineMessages(user.id, threadKey).then((queued) => {
          if (!cancelled) setMessages([...next, ...queued.map(pendingMessageFromOutbox)]);
        });
        setHasMoreMessages(Boolean(res.data.meta?.hasMore));
        oldestCreatedAtRef.current = next[0]?.createdAt || null;
        if (next.length) {
          recordActivityRef.current(next[next.length - 1]);
        }
        setMessages(next);
        markConversationRead(user.id, threadKey);
        bumpActivityRef.current();
        if (threadType === "dm") {
          client.post(`/messages/${threadId}/read`).catch(() => { });
        } else if (threadType === "group") {
          client.post(`/groups/${threadId}/messages/read`).catch(() => { });
        }
        setTimeout(() => scrollToBottomRef.current("auto"), 50);
      })
      .catch((err) => {
        if (cancelled) return;
        showToastRef.current(
          err.response?.data?.error || "Failed to load messages",
          "error",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });

    return () => {
      cancelled = true;
    };
    // vaultUnlocked included so locking/unlocking mid-session re-fetches this
    // thread. The request already carries the correct x-vault-token via
    // client.js's interceptor, so the server swaps between the decoy and
    // real message set automatically — this just re-triggers that fetch.
  }, [selectedKey, selectedType, selectedId, hasLocalKeyring, user.id, vaultUnlocked]);
  // Vault: only fetch/show "has decoy messages" when actually unlocked and
  // viewing a vaulted DM — this call itself 403s if locked (server-enforced),
  // but skip it entirely rather than firing a doomed request every switch.
  useEffect(() => {
    if (
      !selected ||
      selected.type !== "dm" ||
      selected.isSelfChat ||
      !vaultUnlocked ||
      !isPeerVaulted(selected.id)
    ) {
      setDecoyThreadExists(false);
      return;
    }
    let cancelled = false;
    getPeerVaultDecoyStatus(selected.id)
      .then((res) => {
        if (!cancelled) setDecoyThreadExists(Boolean(res?.data?.hasDecoyMessages));
      })
      .catch(() => {
        if (!cancelled) setDecoyThreadExists(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, vaultUnlocked, isPeerVaulted]);
  // Vercel's serverless API cannot keep a Socket.IO connection alive.
  // Sync the open conversation frequently so both participants see new
  // messages and view-once opens without reloading. Still poll (slower)
  // when a socket is connected — view-once / receipt updates can be missed
  // if signaling is on a separate host from the message API.
  useEffect(() => {
    if (!selectedKey || !selectedId || !hasLocalKeyring) return undefined;

    let cancelled = false;
    let inFlight = false;
    const threadType = selectedType;
    const threadId = selectedId;
    const threadKey = selectedKey;
    const endpoint =
      threadType === "group"
        ? `/groups/${threadId}/messages`
        : `/messages/${threadId}`;

    function messageNeedsMerge(message, next) {
      if (!next) return false;
      const attachmentId = (m) =>
        String(m?.attachment?.id || m?.attachment?._id || m?.attachment || "");
      return (
        next.text !== message.text ||
        String(next.readAt || "") !== String(message.readAt || "") ||
        String(next.deliveredAt || "") !== String(message.deliveredAt || "") ||
        String(next.editedAt || "") !== String(message.editedAt || "") ||
        String(next.viewOnceOpenedAt || "") !==
        String(message.viewOnceOpenedAt || "") ||
        String(next.viewOnceOpenedBy || "") !==
        String(message.viewOnceOpenedBy || "") ||
        attachmentId(next) !== attachmentId(message) ||
        (next.reactions || []).length !== (message.reactions || []).length
      );
    }

    async function syncOpenConversation() {
      if (cancelled || inFlight || document.visibilityState === "hidden") {
        return;
      }

      inFlight = true;
      try {
        const { data } = await client.get(endpoint, {
          params: { limit: 80, markRead: 1 },
        });
        if (cancelled) return;

        const latest = (data.data || []).map((raw) => decorateRef.current(raw));
        const currentIds = new Set(
          messagesRef.current.map((message) =>
            String(message.id || message._id),
          ),
        );
        const socketLive = Boolean(getSocket()?.connected);
        const receivedNewMessage =
          !socketLive &&
          latest.some(
            (message) =>
              !currentIds.has(String(message.id || message._id)) &&
              String(message.from) !== String(user.id),
          );

        setMessages((current) => {
          const existingIds = new Set(
            current.map((message) => String(message.id || message._id)),
          );
          const latestById = new Map(
            latest.map((message) => [
              String(message.id || message._id),
              message,
            ]),
          );

          let changed = false;
          const merged = current.map((message) => {
            const id = String(message.id || message._id);
            const next = latestById.get(id);
            if (!next || !messageNeedsMerge(message, next)) return message;
            changed = true;
            // Prefer keeping already-decrypted text when the server payload
            // no longer carries envelopes (e.g. after view-once open).
            return {
              ...next,
              text: next.text ?? message.text,
            };
          });
          for (const message of latest) {
            const id = String(message.id || message._id);
            if (!existingIds.has(id)) {
              merged.push(message);
              changed = true;
            }
          }
          if (!changed) return current;
          merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          return merged;
        });

        const last = latest.at(-1);
        if (last) {
          recordActivityRef.current(last);
          markConversationRead(user.id, threadKey);
        }
        if (receivedNewMessage) {
          if (!isChatMuted(user.id, threadKey)) playReceiveSound();
          setTimeout(() => scrollToBottomRef.current("smooth"), 50);
        }
      } catch {
        // Keep retrying; a temporary network failure should not require reload.
      } finally {
        inFlight = false;
      }
    }

    const intervalMs = getSocket()?.connected ? 2500 : 1200;
    const timer = window.setInterval(syncOpenConversation, intervalMs);
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") syncOpenConversation();
    };
    window.addEventListener("focus", syncOpenConversation);
    document.addEventListener("visibilitychange", syncWhenVisible);
    syncOpenConversation();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", syncOpenConversation);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [selectedKey, selectedType, selectedId, hasLocalKeyring, user.id]);
  // Global inbox sync: covers every conversation, not just the one that's
  // open. syncOpenConversation above only refreshes the active thread, so
  // without this, other chats never update (no unread badge, no sidebar
  // reorder, no notification sound) until the user manually clicks into
  // them. Uses the backend's /messages/sync cursor endpoint, which is
  // built for exactly this (see messageController.js syncMessages) but
  // was previously never called from the frontend.
  const lastSyncCursorRef = useRef(null);

  useEffect(() => {
    if (!hasLocalKeyring || !user?.id) return undefined;

    let cancelled = false;
    let inFlight = false;
    // Start from "now" so we don't replay a user's entire recent history
    // as unread on first load — only genuinely new messages count.
    if (!lastSyncCursorRef.current) {
      lastSyncCursorRef.current = new Date().toISOString();
    }

    async function globalSync() {
      if (cancelled || inFlight) return;
      if (document.visibilityState === "hidden") return;
      // When a real socket is connected it already delivers message:new
      // live — skip polling so we don't double-process.
      if (getSocket()?.connected) return;

      inFlight = true;
      try {
        const { data } = await client.get("/messages/sync", {
          params: { since: lastSyncCursorRef.current },
        });
        if (cancelled) return;

        const rows = data?.data || [];
        if (data?.meta?.cursor) lastSyncCursorRef.current = data.meta.cursor;
        if (!rows.length) return;

        const current = selectedRef.current;
        const openThreadRows = [];

        for (const raw of rows) {
          const fromSelf = String(raw.from) === String(user.id);

          // Figure out which conversation this row belongs to.
          let convKey;
          let isCurrent = false;
          if (raw.group) {
            const groupId =
              typeof raw.group === "object"
                ? raw.group.id || raw.group._id
                : raw.group;
            convKey = conversationKeyForGroup(groupId);
            isCurrent =
              current?.type === "group" &&
              String(current.id) === String(groupId);
          } else {
            const otherId = fromSelf ? raw.to : raw.from;
            if (!otherId) continue;
            convKey = conversationKeyForUser(otherId);
            isCurrent =
              current?.type === "dm" && String(current.id) === String(otherId);
          }

          recordActivityRef.current(raw);

          if (isCurrent) {
            // Let the merge below handle inserting it into the open thread.
            openThreadRows.push(raw);
            if (!fromSelf) {
              markConversationRead(
                user.id,
                current.key,
                raw.createdAt || new Date().toISOString(),
              );
            }
            continue;
          }

          if (fromSelf) continue; // own sends elsewhere already handled by their own flow

          // Not the open thread: just bump unread + maybe notify.
          incrementUnreadCount(user.id, convKey);
          bumpActivityRef.current();

          const muted = isChatMuted(user.id, convKey);
          if (!muted && notifSettings) {
            const decorated = decorateRef.current(raw);
            const isMention = Array.isArray(raw.mentionedUserIds)
              ? raw.mentionedUserIds.map(String).includes(String(user.id))
              : false;
            const notifyOk = shouldNotify(notifSettings, {
              kind: raw.group ? "group" : "dm",
              isMention,
            });
            if (notifyOk) {
              playNotificationSound(notifSettings);
              const senderName =
                usersRef.current.find((u) => String(u.id) === String(raw.from))
                  ?.displayName ||
                usersRef.current.find((u) => String(u.id) === String(raw.from))
                  ?.username ||
                "Someone";
              const groupName = raw.group
                ? groupsRef.current.find(
                  (g) => String(g.id) === String(raw.group),
                )?.name
                : null;
              const buffer = pendingNotificationsRef.current.get(convKey) || [];
              buffer.push({ senderName, text: decorated.text });
              pendingNotificationsRef.current.set(convKey, buffer);
              const { title, body } = buildGroupedNotificationText(buffer, {
                isGroup: Boolean(raw.group),
                groupName,
                notifSettings,
              });
              showNotificationPopup(
                { title, body, tag: convKey },
                notifSettings,
                () => {
                  const target = raw.group
                    ? { key: convKey, type: "group", id: raw.group }
                    : { key: convKey, type: "dm", id: raw.from };
                  handleSelectConversation(target);
                },
              );
            }
          }
        }

        // Merge any rows belonging to the currently open thread, same
        // dedupe-by-id pattern used elsewhere in this file.
        if (openThreadRows.length) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => String(m.id || m._id)));
            const toAdd = openThreadRows
              .filter((raw) => !ids.has(String(raw.id || raw._id)))
              .map((raw) => decorateRef.current(raw));
            if (!toAdd.length) return prev;
            const merged = [...prev, ...toAdd];
            merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            return merged;
          });
          setTimeout(() => scrollToBottomRef.current("smooth"), 50);
        }
      } catch {
        // Keep retrying on the next tick; a blip shouldn't require reload.
      } finally {
        inFlight = false;
      }
    }

    globalSync();
    const timer = window.setInterval(globalSync, 3000);
    const onVisible = () => {
      if (document.visibilityState === "visible") globalSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", globalSync);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", globalSync);
    };
  }, [hasLocalKeyring, user?.id, notifSettings]);
  const loadOlderMessages = useCallback(async () => {
    if (
      !selected ||
      !hasMoreMessages ||
      loadingOlderRef.current ||
      !oldestCreatedAtRef.current
    )
      return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const el = messageListRef.current;
    const prevHeight = el?.scrollHeight || 0;
    const endpoint =
      selected.type === "group"
        ? `/groups/${selected.id}/messages`
        : `/messages/${selected.id}`;
    try {
      const { data } = await client.get(endpoint, {
        params: { limit: 40, before: oldestCreatedAtRef.current, markRead: 0 },
      });
      const older = (data.data || []).map(decorate);
      setHasMoreMessages(Boolean(data.meta?.hasMore));
      if (older.length) {
        oldestCreatedAtRef.current = older[0].createdAt;
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => String(m.id || m._id)));
          const merged = [
            ...older.filter((m) => !ids.has(String(m.id || m._id))),
            ...prev,
          ];
          return merged;
        });
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - prevHeight;
        });
      }
    } catch {
      // ignore
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [selected, hasMoreMessages, decorate]);

  loadOlderMessagesRef.current = loadOlderMessages;

  // Keep auto-scroll only when near bottom for new messages — avoid jump on older loads.
  // Scroll the list container itself. scrollIntoView() on bottomRef defaults to
  // block:'start', which pins the sentinel to the top and clips the last bubble.
  useEffect(() => {
    if (loadingOlder) return;
    const el = messageListRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (!nearBottom) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [messages, loadingOlder]);

  const canChat = hasLocalKeyring;
  const isGroupChat = selected?.type === "group";

  useEffect(() => {
    if (!canChat) return;
    // Keep Web Push subscribed so OS toasts work while using other apps (e.g. Cursor).
    // Do not prompt from this effect — browsers block permission without a user gesture.
    enablePushNotifications({ requestPermission: false }).catch(() => { });
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        enablePushNotifications({ requestPermission: false }).catch(() => { });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [canChat]);

  const usernameById = useMemo(() => {
    const map = new Map();
    for (const u of users) map.set(String(u.id), getDisplayName(u, i18n.language));
    map.set(String(user.id), getDisplayName(user, i18n.language));
    for (const g of groups) {
      for (const m of g.members || []) {
        const id = memberId(m);
        const memberUser = m.user || m;
        map.set(id, getDisplayName(memberUser, i18n.language) || m.username || "Member");
      }
    }
    return map;
  }, [users, groups, user, i18n.language]);

  const selfPeer = useMemo(() => {
    if (!user?.id) return null;
    return {
      id: user.id,
      username: user.username,
      displayName: getDisplayName(user, i18n.language),
      avatarUrl: user.avatarUrl || null,
      hasAvatar: Boolean(user.hasAvatar || user.avatarUrl),
      publicKeys: user.publicKeys || [],
      lastLoginAt: user.lastLoginAt || null,
      isSelfChat: true,
      transliteratedNames: user.transliteratedNames || {},
    };
  }, [user, i18n.language]);

  const resolveDmPeer = useCallback(
    (conversation) => {
      if (!conversation || conversation.type === "group") return null;
      if (String(conversation.id) === String(user?.id)) return selfPeer;
      const fromList = users.find((u) => String(u.id) === String(conversation.id));
      const peer = conversation.peer;
      // Prefer live users[] fields (lastLoginAt) over a stale selected.peer snapshot.
      if (fromList && peer) return { ...peer, ...fromList };
      return fromList || peer || null;
    },
    [user?.id, selfPeer, users],
  );

  const ensurePeerKeys = useCallback(
    async (targetConversation) => {
      if (!targetConversation || targetConversation.type === "group") return [];
      let peer = resolveDmPeer(targetConversation);
      let keys = (peer?.publicKeys || []).filter(Boolean);
      if (keys.length > 0) return keys;

      const peerId = targetConversation.id;
      if (!peerId || String(peerId) === String(user?.id)) return [];

      try {
        const { data } = await client.get(`/users/${peerId}`);
        const freshUser = data?.data;
        if (freshUser) {
          const freshKeys = (freshUser.publicKeys || []).filter(Boolean);
          setUsers((prev) => {
            const idx = prev.findIndex((u) => String(u.id) === String(peerId));
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...freshUser };
              return copy;
            }
            return [...prev, freshUser];
          });
          setSelected((cur) => {
            if (!cur || cur.type !== "dm" || String(cur.id) !== String(peerId)) return cur;
            return {
              ...cur,
              title: cur.title === "Chat" ? (getDisplayName(freshUser, i18n.language) || freshUser.username || "Chat") : cur.title,
              peer: { ...(cur.peer || {}), ...freshUser },
            };
          });
          return freshKeys;
        }
      } catch (err) {
        console.warn("[ensurePeerKeys] failed to fetch public keys for peer", peerId, err);
      }
      return [];
    },
    [resolveDmPeer, user?.id, i18n.language],
  );

  const screenshotProtectionOn = useMemo(
    () =>
      shouldEnforceScreenshotProtection({
        viewerId: user?.id,
        selected,
        profileUserId,
        users,
        groups,
        resolveDmPeer,
      }),
    [user?.id, selected, profileUserId, users, groups, resolveDmPeer],
  );
  // Only protect the open chat thread — Settings and other app overlays stay capturable.
  useScreenshotProtection(screenshotProtectionOn && !showSettings, {
    scope: "chat",
    targetSelector: ".chat-main",
    onAttempt: (reason) => {
      showToast(
        reason === "screenshot"
          ? "Screenshot blocked — this contact protects their chat"
          : "Screen capture blocked — this contact protects their chat",
        "info",
        3500,
      );
    },
  });

  const conversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    const hidden = new Set(hiddenChatIds);
    const items = [];
    const activeUsers = searchResults ? searchResults.users : users;
    const activeGroups = searchResults ? searchResults.groups : groups;
    const muted = new Set(mutedKeys.map(String));
    const archived = new Set(archivedKeys.map(String));
    const pinned = new Set(pinnedChatKeys.map(String));

    if (user?.id && selfPeer) {
      const key = conversationKeyForUser(user.id);
      const activity = getConversationActivity(user.id, key);
      const unreadCount = getUnreadCount(user.id, key);
      const unread =
        unreadCount > 0 ||
        isUnreadConversation(user.id, key, activity?.at, activity?.from);
      items.push({
        key,
        type: "dm",
        id: user.id,
        title: "Message yourself",
        subtitle: "Notes to self",
        searchText:
          `message yourself notes to self ${user.username || ""}`.toLowerCase(),
        lastLoginAt: activity?.at || null,
        lastMessageAt: activity?.at || null,
        unread,
        unreadCount: unreadCount > 0 ? unreadCount : unread ? 1 : 0,
        sortAt: activity?.at || "",
        peer: selfPeer,
        muted: muted.has(String(key)),
        archived: archived.has(String(key)),
        pinned: pinned.has(String(key)),
        online: false,
        isSelfChat: true,
      });
    }

    for (const u of activeUsers) {
      if (String(u.id) === String(user.id)) continue;
      const key = conversationKeyForUser(u.id);
      const activity = getConversationActivity(user.id, key);
      const unreadCount = getUnreadCount(user.id, key);
      const unread =
        unreadCount > 0 ||
        isUnreadConversation(user.id, key, activity?.at, activity?.from);
      const online =
        onlineUserIds.has(String(u.id));
      items.push({
        key,
        type: "dm",
        id: u.id,
        title: getDisplayName(u, i18n.language) || "Unknown user",
        subtitle: null,
        searchText:
          `${getDisplayName(u, i18n.language) || ""} ${u.displayName || ""} ${u.username || ""} ${u.email || ""}`.toLowerCase(),
        lastLoginAt: u.lastLoginAt,
        lastMessageAt: activity?.at || null,
        unread,
        unreadCount: unreadCount > 0 ? unreadCount : unread ? 1 : 0,
        sortAt: activity?.at || "",
        peer: u,
        muted: muted.has(String(key)),
        archived: archived.has(String(key)),
        pinned: pinned.has(String(key)),
        online,
      });
    }

    for (const g of activeGroups) {
      const key = conversationKeyForGroup(g.id);
      const activity = getConversationActivity(user.id, key);
      const unreadCount = getUnreadCount(user.id, key);
      const unread =
        unreadCount > 0 ||
        isUnreadConversation(user.id, key, activity?.at, activity?.from);
      const memberCount = (g.members || []).length;
      const desc = (g.description || "").trim();
      items.push({
        key,
        type: "group",
        id: g.id,
        title: g.name,
        subtitle: desc
          ? desc.slice(0, 48) + (desc.length > 48 ? "…" : "")
          : `${memberCount} member${memberCount === 1 ? "" : "s"}`,
        searchText: `${g.name || ""} ${g.description || ""}`.toLowerCase(),
        lastLoginAt: g.updatedAt,
        lastMessageAt: activity?.at || null,
        unread,
        unreadCount: unreadCount > 0 ? unreadCount : unread ? 1 : 0,
        sortAt: activity?.at || g.updatedAt || g.createdAt || "",
        group: g,
        muted: muted.has(String(key)),
        archived: archived.has(String(key)),
        pinned: pinned.has(String(key)),
        online: false,
      });
    }

    if (selected && messages.length) {
      const last = messages[messages.length - 1];
      const lastAt = last?.createdAt;
      if (lastAt) {
        for (const item of items) {
          if (item.type !== selected.type || String(item.id) !== String(selected.id)) {
            continue;
          }
          const prevMs = item.lastMessageAt
            ? new Date(item.lastMessageAt).getTime()
            : 0;
          const nextMs = new Date(lastAt).getTime();
          if (Number.isFinite(nextMs) && nextMs >= prevMs) {
            item.lastMessageAt = lastAt;
            item.sortAt = lastAt;
          }
          break;
        }
      }
    }

    items.sort((a, b) => {
      if (a.isSelfChat !== b.isSelfChat) return a.isSelfChat ? -1 : 1;
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      return String(b.sortAt).localeCompare(String(a.sortAt));
    });

    return items.filter((c) => {
      if (c.type === "dm" && !q && !c.isSelfChat && hidden.has(String(c.id)))
        return false;
      // Vault: while locked, a vaulted DM never appears in the ambient list
      // (no tab, no leak). Searching for the contact by name still surfaces
      // it — opening it from there is exactly what routes into the decoy
      // thread instead of real history.
      if (
        c.type === "dm" &&
        !c.isSelfChat &&
        !vaultUnlocked &&
        !q &&
        isPeerVaulted(c.id)
      ) {
        return false;
      }
      if (filter === "archived") {
        if (!archived.has(String(c.key))) return false;
      } else if (archived.has(String(c.key))) {
        return false;
      }
      if (filter === "discover") return false;
      if (filter === "groups" && c.type !== "group") return false;
      if (filter === "unread" && !c.unread) return false;
      if (!searchResults && q && !(c.searchText || "").includes(q)) return false;
      return true;
    });
  }, [
    users,
    groups,
    user.id,
    user.username,
    selfPeer,
    search,
    filter,
    activityTick,
    hiddenChatIds,
    mutedKeys,
    archivedKeys,
    pinnedChatKeys,
    onlineUserIds,
    searchResults,
    vaultUnlocked,
    isPeerVaulted,
    selected,
    messages,
  ]);

  // Update browser tab unread count prefix (must run after conversations is defined)
  useEffect(() => {
    const totalUnread = conversations.reduce(
      (acc, c) => acc + (c.unreadCount || (c.unread ? 1 : 0)),
      0,
    );
    const showBadge = notifSettings?.badgeCount !== "hidden";
    const prefix = showBadge && totalUnread > 0 ? `(${totalUnread}) ` : "";
    document.title = selected
      ? `${prefix}${selected.title} — QuantumChat`
      : `${prefix}QuantumChat`;
    updateFaviconBadge(showBadge && totalUnread > 0);
  }, [selected, activityTick, conversations, notifSettings?.badgeCount]);

  // URL deep-link sync — restore selection from /chat/:peerId or /chat/g/:groupId
  useEffect(() => {
    if (isSettingsRoute) {
      setShowSettings(true);
      return;
    }
    if (!params.peerId && !params.groupId) return;
    let fromUrl = selectionFromParams(params, conversations);
    if (!fromUrl) return;
    if (
      fromUrl.type === "dm" &&
      String(fromUrl.id) === String(user.id) &&
      selfPeer
    ) {
      fromUrl = {
        ...fromUrl,
        title: "Message yourself",
        subtitle: "Notes to self",
        peer: selfPeer,
        isSelfChat: true,
      };
    }
    if (
      selected &&
      selected.type === fromUrl.type &&
      String(selected.id) === String(fromUrl.id)
    ) {
      if (fromUrl.peer || fromUrl.group?.name) {
        setSelected((prev) => {
          if (!prev) return fromUrl;
          const samePeer =
            String(prev.peer?.id || "") === String(fromUrl.peer?.id || "") &&
            prev.peer?.displayName === fromUrl.peer?.displayName &&
            prev.peer?.lastLoginAt === fromUrl.peer?.lastLoginAt &&
            prev.peer?.hasAvatar === fromUrl.peer?.hasAvatar;
          const sameGroup =
            String(prev.group?.id || prev.group?._id || "") ===
            String(fromUrl.group?.id || fromUrl.group?._id || "") &&
            prev.group?.name === fromUrl.group?.name &&
            prev.group?.updatedAt === fromUrl.group?.updatedAt &&
            String(prev.group?.pinnedMessageIds || "") ===
            String(fromUrl.group?.pinnedMessageIds || "");
          if (
            prev.title === fromUrl.title &&
            prev.subtitle === fromUrl.subtitle &&
            samePeer &&
            sameGroup
          ) {
            return prev;
          }
          return { ...prev, ...fromUrl };
        });
      }
      return;
    }
    applyConversationSelection(fromUrl, { syncUrl: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.peerId, params.groupId, conversations, isSettingsRoute, selfPeer, user.id]);

  function applyConversationSelection(c, { syncUrl = true } = {}) {
  stopTyping();
  clearTimeout(typingPeerTimeoutRef.current);
  setPeerTyping(false);
  setGroupTypingUsers([]);
  if (!c) {
  setSelected(null);
  setMessages([]);
      if (syncUrl && !isSettingsRoute) navigate("/chat");
      return;
    }
    if (c.type === "dm" && hiddenChatIds.includes(String(c.id))) {
      setHiddenChatIds(unhideChat(user.id, c.id));
    }
    setSelected(c);
    setError("");
    draftConversationKeyRef.current = c.key;
    draftReadyConversationKeyRef.current = null;
    setDraft("");
    getChatDraft(user.id, c.key).then((savedDraft) => {
      if (draftConversationKeyRef.current === c.key) {
        draftReadyConversationKeyRef.current = c.key;
        setDraft(savedDraft);
      }
    });
    setReplyTo(null);
    setEditingMessage(null);
    setShowEmojiPicker(false);
    setSearchOpen(false);
    setSidebarOpen(false);
    setGallery(null);
    setGroupComposerMenu(null);
    setMentionOpen(false);
    setPendingAnnouncement(false);
    setShowGroupSettings(false);
    setShowCommandCenter(false);
    setProfileUserId(null);
    setPeerTyping(false);
    setGroupTypingUsers([]);
    imageSrcMapRef.current = new Map();
    markConversationRead(user.id, c.key);
    pendingNotificationsRef.current.delete(c.key);
    bumpActivity();
    const socket = getSocket();
    if (socket && c.type === "group") {
      socket.emit("group:join", { groupId: c.id });
    }
    if (syncUrl) {
      const next = chatPathForSelection(c);
      if (location.pathname !== next) navigate(next);
    }
    if (c.type === "dm" && !c.isSelfChat && (!c.peer?.publicKeys?.length || c.title === "Chat")) {
      ensurePeerKeys(c).catch(() => {});
    }
  }

  function handleSelectConversation(c) {
    applyConversationSelection(c, { syncUrl: true });
  }
  function handleOpenStarredEntry(entry) {
    setShowStarredMessages(false);
    const target =
      entry.type === "group"
        ? conversations.find((c) => c.type === "group" && String(c.id) === String(entry.conversationId))
        : conversations.find((c) => c.type === "dm" && String(c.id) === String(entry.conversationId));

    const selection = target || {
      key: entry.conversationKey,
      type: entry.type,
      id: entry.conversationId,
      title: entry.title,
    };

    setPendingJumpMessageId(entry.id);
    handleSelectConversation(selection);
  }

  function handleBackToList() {
    applyConversationSelection(null, { syncUrl: true });
  }
  async function handleMarkAllRead() {
    const unreadConvos = conversations.filter((c) => c.unread);
    if (!unreadConvos.length) {
      showToast("No unread conversations", "info");
      return;
    }

    const dmReadRequests = [];
    for (const c of unreadConvos) {
      markConversationRead(user.id, c.key);
      if (c.type === "dm" && !c.isSelfChat) {
        dmReadRequests.push(client.post(`/messages/${c.id}/read`).catch(() => { }));
      }
    }

    bumpActivity();
    if (dmReadRequests.length) {
      await Promise.allSettled(dmReadRequests);
    }
    showToast("All conversations marked as read", "success");
  }

  function toggleInfoPanel() {
    setInfoPanelOpenState((open) => {
      const next = !open;
      setInfoPanelOpen(next);
      return next;
    });
  }

  function closeInfoPanel() {
    setInfoPanelOpenState(false);
    setInfoPanelOpen(false);
  }

  async function handleCreateGroup({
    name,
    memberIds,
    visibility,
    joinPolicy,
  }) {
    const { data } = await client.post("/groups", {
      name,
      memberIds,
      visibility,
      joinPolicy,
    });
    const group = data.data;
    const groupId = group?.id || group?._id;
    if (groupId) {
      activityStore.appendEvent({
        id: `new:${groupId}`,
        type: "group",
        targetId: groupId,
        groupId,
        groupName: group.name,
        action: "created",
        actorId: user?.id,
        actorLabel: "you",
        actorIsCurrentUser: true,
      });
    }
    setGroups((prev) => {
      if (prev.some((g) => String(g.id) === String(group.id))) return prev;
      return [group, ...prev];
    });
    handleSelectConversation({
      key: conversationKeyForGroup(group.id),
      type: "group",
      id: group.id,
      title: group.name,
      subtitle: `${(group.members || []).length} members`,
      group,
    });
  }

  async function handleDiscoverJoin(item) {
    if (!item?.id) return;
    try {
      if (item.joinPolicy === "request") {
        await client.post(`/groups/${item.id}/join-requests`);
        showToast("Join request sent", "success");
        return { pending: true };
      }
      const { data } = await client.post(`/groups/${item.id}/join`);
      const group = data.data;
      setGroups((prev) => {
        if (prev.some((g) => String(g.id) === String(group.id))) {
          return prev.map((g) =>
            String(g.id) === String(group.id) ? group : g,
          );
        }
        return [group, ...prev];
      });
      setFilter("all");
      handleSelectConversation({
        key: conversationKeyForGroup(group.id),
        type: "group",
        id: group.id,
        title: group.name,
        subtitle: `${(group.members || []).length} members`,
        group,
      });
      showToast(`Joined ${group.name}`, "success");
      return { joined: true, group };
    } catch (err) {
      showToast(
        err.response?.data?.error || err.message || "Could not join group",
        "error",
      );
      throw err;
    }
  }
  async function handleSendFriendRequest(userId) {
    try {
      const { data } = await client.post("/users/friend-requests", { to: userId });
      if (data?.data?.status === "accepted") {
        if (data?.data?.me) updateSessionUser(data.data.me);
        showToast("You are now friends", "success");
        loadMyFriends();
      } else {
        showToast("Friend request sent", "success");
      }
      loadFriendDiscover(search);
      loadFriendRequests();
      setContactLookupResult((prev) =>
        prev && String(prev.id) === String(userId)
          ? {
            ...prev,
            requestStatus:
              data?.data?.status === "accepted" ? "friends" : "pending_sent",
            requestId: data?.data?.id || data?.data?.requestId || prev.requestId,
          }
          : prev,
      );
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to send request", "error");
    }
  }

  function handleNotFriendsError(err, fallbackRecipientId) {
    const errData = err?.response?.data || err?.data || err;
    if (errData?.code === 'NOT_FRIENDS') {
      const targetId = errData.recipientId || fallbackRecipientId;
      showToast(
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span>Unable to send message — you're not friends with this user. Add them as a friend first.</span>
          {targetId && (
            <button
              type="button"
              style={{
                alignSelf: 'flex-start',
                padding: '4px 10px',
                fontSize: '0.8rem',
                fontWeight: '600',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                marginTop: '2px',
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleSendFriendRequest(targetId);
              }}
            >
              Add Friend
            </button>
          )}
        </div>,
        "error",
        6000
      );
      return true;
    }
    return false;
  }

  async function handleCancelFriendRequest(requestId) {
    try {
      await client.delete(`/users/friend-requests/${requestId}`);
      setOutgoingRequests((prev) =>
        prev.filter((r) => String(r.id) !== String(requestId)),
      );
      loadFriendDiscover(search);
      loadFriendRequests();
      setContactLookupResult((prev) =>
        prev && String(prev.requestId) === String(requestId)
          ? { ...prev, requestStatus: "none", requestId: null }
          : prev,
      );
      showToast("Friend request cancelled", "success");
    } catch (err) {
      showToast(
        err.response?.data?.error || "Failed to cancel request",
        "error",
      );
    }
  }

  async function executeAcceptFriendRequest(requestId) {
    try {
      const pending = incomingRequests.find(
        (r) => String(r.id) === String(requestId),
      );
      const { data } = await client.post(
        `/users/friend-requests/${requestId}/accept`,
      );
      if (pending?.user) {
        applyAcceptedFriendship(pending.user, requestId);
      }
      if (data?.data?.me) {
        updateSessionUser(data.data.me);
      } else {
        try {
          const meRes = await client.get("/users/me");
          if (meRes.data?.data) updateSessionUser(meRes.data.data);
        } catch {
          // non-fatal
        }
      }
      showToast("Friend request accepted", "success");
      loadDirectory();
      loadFriendDiscover(search);
      loadMyFriends();
    } catch (err) {
      showToast(
        err.response?.data?.error || "Failed to accept request",
        "error",
      );
    }
  }

  function handleAcceptFriendRequest(requestId) {
    const pending = incomingRequests.find(
      (r) => String(r.id) === String(requestId),
    );
    if (pending?.moderationWarning?.reportedByMultiple) {
      const reasonText = pending.moderationWarning.commonReason
        ? ` The most common reason given is "${pending.moderationWarning.commonReason.replace(/_/g, ' ')}".`
        : '';
      setConfirmDialog({
        type: "accept-with-warning",
        requestId,
        title: "Safety warning",
        message: `${pending.user?.displayName || pending.user?.username || 'This account'} has been reported by multiple people.${reasonText} Do you still want to accept this friend request?`,
        confirmLabel: "Accept anyway",
        danger: true,
      });
      return;
    }
    executeAcceptFriendRequest(requestId);
  }

  async function handleDeclineFriendRequest(requestId) {
    try {
      await client.post(`/users/friend-requests/${requestId}/decline`);
      setIncomingRequests((prev) =>
        prev.filter((r) => String(r.id) !== String(requestId)),
      );
      loadFriendDiscover(search);
      setContactLookupResult((prev) =>
        prev && String(prev.requestId) === String(requestId)
          ? { ...prev, requestStatus: "none", requestId: null }
          : prev,
      );
    } catch (err) {
      showToast(
        err.response?.data?.error || "Failed to decline request",
        "error",
      );
    }
  }
  function sealGroupEnvelopes(plaintext, group) {
    const members = group.members || [];
    const envelopes = [];
    for (const member of members) {
      const id = memberId(member);
      let publicKey;
      if (String(id) === String(user.id)) {
        publicKey = pickRandom(getCurrentKeySet(user.id))?.publicKey;
      } else {
        const keys = (member.publicKeys || []).filter(Boolean);
        publicKey = pickRandom(keys);
      }
      if (!publicKey) {
        throw new Error(`Missing encryption keys for ${member.username || id}`);
      }
      envelopes.push({ user: id, ...sealMessage(plaintext, publicKey) });
    }
    return envelopes;
  }

  function buildForwardPolicy() {
    if (allowForward && forwardUntilSeconds <= 0) return undefined;
    const policy = { allowForward };
    if (allowForward && forwardUntilSeconds > 0) {
      policy.forwardUntil = new Date(
        Date.now() + forwardUntilSeconds * 1000,
      ).toISOString();
    }
    return policy;
  }

  function mergeConfirmedMessage(prev, { tempId, serverRaw, displayText }) {
    const serverId = String(serverRaw.id || serverRaw._id);
    const confirmed = {
      ...decorate(serverRaw),
      ...(displayText != null ? { text: displayText } : {}),
      _pending: undefined,
      _status: undefined,
    };
    let sawServer = false;
    const next = [];
    for (const m of prev) {
      const mid = String(m.id || m._id);
      if (tempId && mid === String(tempId)) {
        if (!sawServer) {
          next.push(confirmed);
          sawServer = true;
        }
        continue;
      }
      if (mid === serverId) {
        if (!sawServer) {
          next.push(confirmed);
          sawServer = true;
        }
        continue;
      }
      next.push(m);
    }
    if (!sawServer) next.push(confirmed);
    return next;
  }

  async function sendGroupPayload(
    plaintext,
    { kind, mentionedUserIds, tempId, displayText, replyToId, attachmentId, viewOnce, clientMessageId } = {},
  ) {
    if (!selected || selected.type !== "group") {
      throw new Error("No group selected");
    }
    const group =
      selected.group ||
      groups.find((g) => String(g.id) === String(selected.id));
    if (!group) {
      throw new Error("Group not found");
    }
    const isPublic = group.visibility === "public";
    const payload = { kind: kind || "text" };
    if (clientMessageId) payload.clientMessageId = clientMessageId;
    if (isPublic) {
      payload.content = plaintext;
    } else {
      payload.envelopes = sealGroupEnvelopes(plaintext, group);
    }
    if (mentionedUserIds?.length) payload.mentionedUserIds = mentionedUserIds;
    const reply = replyToId ?? (replyTo ? replyTo.id || replyTo._id : null);
    if (reply) payload.replyTo = reply;
    if (attachmentId) payload.attachmentId = attachmentId;
    if (viewOnce) payload.viewOnce = true;
    if (disappearSeconds > 0) payload.expiresInSeconds = disappearSeconds;
    const forwardPolicy = buildForwardPolicy();
    if (forwardPolicy) payload.forwardPolicy = forwardPolicy;
    if (clientMessageId) {
      await saveOfflineMessage(user.id, {
        id: clientMessageId,
        type: "group",
        conversationId: selected.id,
        conversationKey: selected.key,
        displayText: displayText ?? plaintext,
        payload,
      });
    }
    const { data } = await client.post(
      `/groups/${selected.id}/messages`,
      payload,
    );
    if (clientMessageId) await removeOfflineMessage(user.id, clientMessageId);
    recordActivityFromMessage(data.data);
    setMessages((prev) =>
      mergeConfirmedMessage(prev, {
        tempId,
        serverRaw: data.data,
        displayText: displayText ?? plaintext,
      }),
    );
    return data.data;
  }

  async function retryOfflineMessage(entry) {
    if (!entry?.id || retryingOutboxRef.current.has(entry.id)) return;
    retryingOutboxRef.current.add(entry.id);
    try {
      const endpoint = entry.type === "group"
        ? `/groups/${entry.conversationId}/messages`
        : "/messages";
      const { data } = await client.post(endpoint, entry.payload);
      await removeOfflineMessage(user.id, entry.id);
      recordActivityFromMessage(data.data);
      setMessages((prev) =>
        mergeConfirmedMessage(prev, {
          tempId: `outbox-${entry.id}`,
          serverRaw: data.data,
          displayText: entry.displayText,
        }),
      );
      playSendSound();
    } catch {
      // Keep the encrypted request in the outbox for the next reconnect.
    } finally {
      retryingOutboxRef.current.delete(entry.id);
    }
  }

  function isRetryableSendError(err) {
    if (err?.code === "OUTBOX_UNAVAILABLE") return false;
    const status = err?.response?.status;
    return !status || status === 408 || status === 429 || status >= 500;
  }

  async function retryOfflineMessages(conversationKey) {
    if (!navigator.onLine || !user?.id) return;
    const entries = conversationKey
      ? await getOfflineMessages(user.id, conversationKey)
      : await getAllOfflineMessages(user.id);
    await Promise.all(entries.map((entry) => retryOfflineMessage(entry)));
  }

  useEffect(() => {
    const retry = () => retryOfflineMessages();
    window.addEventListener("online", retry);
    retry();
    return () => window.removeEventListener("online", retry);
  }, [selected?.key, user?.id]);

  async function saveEncryptedAINote(text) {
    if (!selected || !text?.trim()) return;
    try {
      if (selected.type === "group") {
        await sendGroupPayload(text, { kind: "ai_note" });
      } else {
        const peer = resolveDmPeer(selected);
        const myKey = pickRandom(getCurrentKeySet(user.id));
        const recipientKeys = (peer?.publicKeys || []).filter(Boolean);
        if (!myKey?.publicKey || !recipientKeys.length)
          throw new Error("Missing encryption keys");
        const { data } = await client.post("/messages", {
          to: selected.id,
          forRecipient: sealMessage(text, pickRandom(recipientKeys)),
          forSender: sealMessage(text, myKey.publicKey),
          kind: "ai_note",
        });
        setMessages((current) => [...current, decorate(data.data)]);
      }
      showToast("Encrypted AI note saved", "success");
    } catch (err) {
      if (!handleNotFriendsError(err, selected?.id)) {
        showToast(
          err.response?.data?.error || err.message || "Could not save AI note",
          "error",
        );
      }
    }
  }
  async function handleToggleVault(peerId) {
    if (isPeerVaulted(peerId)) {
      try {
        await removeVaultPeer(peerId);
        showToast("Removed from vault", "success");
      } catch (err) {
        showToast(err.response?.data?.error || "Failed to remove from vault", "error");
      }
      return;
    }
    if (!vaultEnabled) {
      setPendingVaultPeerId(peerId);
      setShowVaultSetup(true);
      return;
    }
    try {
      await addVaultPeer(peerId);
      showToast("Added to vault", "success");
      if (selected?.type === "dm" && String(selected.id) === String(peerId)) {
        applyConversationSelection(null);
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to add to vault", "error");
    }
  }
  function handleHideChat(u) {
    const peerId = String(u.id);
    setHiddenChatIds(hideChat(user.id, peerId));
    if (selected?.type === "dm" && String(selected.id) === peerId) {
      applyConversationSelection(null);
    }
  }

  function handleBlockUser(u) {
    setConfirmDialog({
      type: "block",
      user: u,
      title: `Block ${u.username}?`,
      message:
        "They’ll be removed from your list and you won’t be able to message each other. Chat history is kept.",
      confirmLabel: "Block",
      danger: true,
    });
  }

  async function executeBlockUser(u) {
    try {
      setConfirmBusy(true);
      const { data } = await client.post(`/users/${u.id}/block`);
      updateSessionUser(data.data);
      setUsers((prev) =>
        prev.filter((peer) => String(peer.id) !== String(u.id)),
      );
      setHiddenChatIds(hideChat(user.id, u.id));
      if (selected?.type === "dm" && String(selected.id) === String(u.id)) {
        applyConversationSelection(null);
      }
      setError("");
      setConfirmDialog(null);
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to block user", "error");
      setConfirmDialog(null);
    } finally {
      setConfirmBusy(false);
    }
  }
  function handleClearChat() {
    if (!selected) return;
    setClearChatOpen(true);
  }

  async function executeClearChatScoped(scopes) {
    if (!selected) return;
    const type = selected.type;
    const id = selected.id;
    const conversationKey = selected.key;
    const clearingStarred = scopes.includes("starred");
    const CONTENT_SCOPES = ["photo", "video", "voice", "document", "text"];
    let serverScopes = scopes.filter((s) => s !== "starred");
    // Selecting every content type is a full clear — use the single 'all'
    // watermark so we don't leave five overlapping scoped entries.
    if (CONTENT_SCOPES.every((k) => serverScopes.includes(k))) {
      serverScopes = ["all"];
    }

    // Snapshot for Undo (toast stays up ~8s).
    const previousClearedEntries = (user.clearedConversations || [])
      .filter((c) => c && c.conversationKey === conversationKey)
      .map((c) => ({
        conversationKey: c.conversationKey,
        scope: c.scope || "all",
        clearedAt: c.clearedAt,
      }));
    const previousMessages =
      selectedRef.current &&
      selectedRef.current.type === type &&
      String(selectedRef.current.id) === String(id)
        ? messages
        : null;
    const previousStarredEntries = clearingStarred
      ? getStarredEntries(user.id)
      : null;

    try {
      setClearChatBusy(true);

      if (serverScopes.length) {
        const payload =
          type === "group"
            ? { groupId: id, scopes: serverScopes }
            : { peerId: id, scopes: serverScopes };
        const { data } = await client.post("/users/me/clear-chat", payload);
        // Server confirmed — persist the updated watermarks to the session.
        // No optimistic clear: if the request had failed, existing messages
        // stay intact.
        if (data?.data) updateSessionUser(data.data);
      }

      if (clearingStarred) {
        setStarredIds(clearAllStarred(user.id));
      }

      const current = selectedRef.current;
      if (current && current.type === type && String(current.id) === String(id)) {
        if (serverScopes.includes("all")) {
          setMessages([]);
        } else if (serverScopes.length) {
          // Re-fetch rather than blanking outright — a scoped clear (e.g. just
          // photos) should still leave the remaining messages visible.
          setLoadingMessages(true);
          const endpoint = type === "group" ? `/groups/${id}/messages` : `/messages/${id}`;
          try {
            const res = await client.get(endpoint, { params: { limit: 80, markRead: 0 } });
            setMessages((res.data.data || []).map((raw) => decorateRef.current(raw)));
          } finally {
            setLoadingMessages(false);
          }
        }
      }

      const toastLabel = serverScopes.includes("all")
        ? "Chat cleared"
        : serverScopes.length
          ? "Selected messages cleared"
          : clearingStarred
            ? "Starred messages cleared"
            : "Chat cleared";

      let undoUsed = false;
      showToast(toastLabel, "success", 8000, {
        actionLabel: "Undo",
        onAction: () => {
          if (undoUsed) return;
          undoUsed = true;
          void undoClearChat({
            type,
            id,
            previousClearedEntries,
            previousMessages,
            previousStarredEntries,
            hadServerClear: serverScopes.length > 0,
          });
        },
      });
      setClearChatOpen(false);
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to clear chat", "error");
    } finally {
      setClearChatBusy(false);
    }
  }

  async function undoClearChat({
    type,
    id,
    previousClearedEntries,
    previousMessages,
    previousStarredEntries,
    hadServerClear,
  }) {
    try {
      if (hadServerClear) {
        const payload =
          type === "group"
            ? { groupId: id, restoreEntries: previousClearedEntries }
            : { peerId: id, restoreEntries: previousClearedEntries };
        const { data } = await client.post("/users/me/clear-chat/undo", payload);
        if (data?.data) updateSessionUser(data.data);
      }

      if (previousStarredEntries) {
        setStarredIds(restoreStarredEntries(user.id, previousStarredEntries));
      }

      const current = selectedRef.current;
      if (current && current.type === type && String(current.id) === String(id)) {
        if (Array.isArray(previousMessages)) {
          setMessages(previousMessages);
        } else {
          setLoadingMessages(true);
          const endpoint = type === "group" ? `/groups/${id}/messages` : `/messages/${id}`;
          try {
            const res = await client.get(endpoint, { params: { limit: 80, markRead: 0 } });
            setMessages((res.data.data || []).map((raw) => decorateRef.current(raw)));
          } finally {
            setLoadingMessages(false);
          }
        }
      }

      showToast("Clear undone", "success", 2500);
    } catch (err) {
      showToast(err.response?.data?.error || "Could not undo clear", "error");
    }
  }
  async function handleUnblockUser(peerId) {
    try {
      const { data } = await client.delete(`/users/${peerId}/block`);
      updateSessionUser(data.data);
      showToast('User unblocked', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to unblock', 'error');
    }
  }
  // Keydown to trigger search (Ctrl+K)
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  function handleSearchResult(messageId) {
    setSearchOpen(false);
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.animation = "none";
      el.offsetHeight; // trigger reflow
      el.style.animation = "msgIn 400ms ease both";
    }
  }

  // Textarea composition handlers
  function handleDraftChange(e) {
    const value = e.target.value;
    setDraft(value);

    if (selected?.type === "group") {
      const atMatch = value.match(/(^|\s)@([a-zA-Z0-9_.-]{0,32})$/);
      if (atMatch) {
        setMentionQuery(atMatch[2].toLowerCase());
        setMentionOpen(true);
      } else {
        setMentionOpen(false);
        setMentionQuery("");
      }
    } else {
      setMentionOpen(false);
      setMentionQuery("");
    }

    if (!selected || selected.peer?.isSystemUser) return;
    if (
      selected.type === "dm" &&
      (selected.isSelfChat || String(selected.id) === String(user.id))
    )
      return;
    if (user?.privacy?.typingIndicator === false) return;
    const socket = getSocket() || connectSocket();

    if (selected.type === "dm") {
      presenceTypingRef.current = { to: String(selected.id), groupId: null };
      if (socket?.connected) {
        socket.emit("typing:start", { to: String(selected.id) });
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          presenceTypingRef.current = { to: null, groupId: null };
          if (socket.connected) socket.emit("typing:stop", { to: String(selected.id) });
        }, 2500);
      } else {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          presenceTypingRef.current = { to: null, groupId: null };
        }, 2500);
      }
    } else if (selected.type === "group") {
      presenceTypingRef.current = { to: null, groupId: String(selected.id) };
      if (socket?.connected) {
        console.log('[TYPING-DBG] emitting typing:start for group', selected.id);
        socket.emit("typing:start", { groupId: String(selected.id) });
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          presenceTypingRef.current = { to: null, groupId: null };
          if (socket.connected) {
            socket.emit("typing:stop", { groupId: String(selected.id) });
          }
        }, 2500);
      } else {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          presenceTypingRef.current = { to: null, groupId: null };
        }, 2500);
      }
    }
  }

  function insertMention(username) {
    setDraft((prev) =>
      prev.replace(/@([a-zA-Z0-9_.-]{0,32})$/, `@${username} `),
    );
    setMentionOpen(false);
    setMentionQuery("");
    textareaRef.current?.focus();
  }

  function handleTextareaInput(e) {
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function handleTextareaKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  async function sendPrivateQuantumAIMessage(text) {
    const peer = resolveDmPeer(selected);
    const myKeys = getCurrentKeySet(user.id);
    const myKey = pickRandom(myKeys);
    const quantumAIKey = pickRandom((peer?.publicKeys || []).filter(Boolean));
    if (!myKey?.publicKey || !quantumAIKey)
      throw new Error("Missing QuantumAI encryption keys");

    const { data: storedPrompt } = await client.post("/messages", {
      to: selected.id,
      forRecipient: sealMessage(text, quantumAIKey),
      forSender: sealMessage(text, myKey.publicKey),
    });
    setMessages((current) => [...current, decorate(storedPrompt.data)]);

    const assistantMessageId = `quantum-ai-assistant-${Date.now()}`;
    setMessages((current) => [
      ...current,
      {
        id: assistantMessageId,
        from: selected.id,
        to: user.id,
        text: "",
        createdAt: new Date().toISOString(),
        quantumAI: true,
      },
    ]);
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setAiBusy(true);
    try {
      let finalPayload;
      const recentContext = messages
        .filter((message) => message.text)
        .slice(-20)
        .map(
          (message) =>
            `${String(message.from) === String(user.id) ? "User" : "QuantumAI"}: ${message.text}`,
        );
      await streamQuantumAI({
        message: text,
        context: recentContext,
        link: { quantumChatPeerId: user.id },
        ephemeral: true,
        signal: controller.signal,
        onChunk: (chunk) =>
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId
                ? { ...message, text: `${message.text || ""}${chunk}` }
                : message,
            ),
          ),
        onDone: (payload) => {
          finalPayload = payload;
        },
      });
      if (!finalPayload?.content?.trim()) {
        throw new Error("QuantumAI returned an empty response");
      }
      if (
        finalPayload.receipt &&
        finalPayload.requestId &&
        finalPayload.contentHash
      ) {
        const { data: storedAnswer } = await client.post(
          "/messages/quantum-ai-response",
          {
            content: finalPayload.content,
            contentHash: finalPayload.contentHash,
            requestId: finalPayload.requestId,
            receipt: finalPayload.receipt,
            model: finalPayload.model,
          },
        );
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? decorate(storedAnswer.data)
              : message,
          ),
        );
      } else {
        // Stream succeeded but AI backend could not sign a receipt (missing shared secret).
        // Keep the visible reply so chat is usable; history won't be sealed until secrets match.
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? {
                ...message,
                text: finalPayload.content,
                kind: "ai",
              }
              : message,
          ),
        );
        showToast(
          "QuantumAI replied, but QUANTUM_AI_SERVICE_SECRET is missing/mismatched — reply was not sealed into chat history",
          "info",
        );
      }
    } catch (err) {
      let fallback = "QuantumAI failed to respond.";

      if (err?.name === "AbortError") {
        fallback = "Request cancelled.";
      } else if (err.message?.includes("empty response")) {
        fallback = "QuantumAI returned no reply.";
      } else if (err.message?.includes("signed response")) {
        fallback = "Invalid AI response.";
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
              ...message,
              text: message.text?.trim() || fallback,
              failed: true,
            }
            : message,
        ),
      );

      showToast(
        err instanceof Error ? err.message : "QuantumAI failed to respond",
        "error",
      );
      throw err;
    }
  }

  async function invokeGroupQuantumAI(prompt, group) {
    const quantumAI = (group.members || []).find(
      (member) => member.systemRole === "quantum_ai",
    );
    if (!group.quantumAI?.enabled || !quantumAI) {
      showToast("A group admin must add and enable QuantumAI first", "error");
      return;
    }
    const maxContext = Math.min(group.quantumAI.maxContextMessages ?? 5, 20);
    const context = messages
      .filter((message) => message.text && message.kind !== "ai")
      .slice(-maxContext)
      .map((message) => message.text);

    setAiBusy(true);
    let finalPayload;
    const controller = new AbortController();
    aiAbortRef.current = controller;
    try {
      await streamQuantumAI({
        message:
          prompt.replace(/@QuantumAI\b/gi, "").trim() ||
          "Help with this conversation.",
        context,
        link: { groupId: selected.id, quantumChatPeerId: user.id },
        ephemeral: true,
        signal: controller.signal,
        onDone: (payload) => {
          finalPayload = payload;
        },
      });
      if (!finalPayload?.content?.trim()) {
        throw new Error("QuantumAI returned an empty group response");
      }
      if (
        finalPayload.receipt &&
        finalPayload.contentHash &&
        finalPayload.requestId
      ) {
        const { data } = await client.post(
          `/groups/${selected.id}/quantum-ai-response`,
          {
            content: finalPayload.content,
            contentHash: finalPayload.contentHash,
            requestId: finalPayload.requestId,
            receipt: finalPayload.receipt,
            model: finalPayload.model,
          },
        );
        setMessages((current) => {
          const id = String(data.data.id || data.data._id);
          return current.some(
            (message) => String(message.id || message._id) === id,
          )
            ? current
            : [...current, decorate(data.data)];
        });
      } else {
        showToast(
          "QuantumAI replied, but QUANTUM_AI_SERVICE_SECRET is missing/mismatched — group reply was not sealed",
          "info",
        );
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        showToast(
          err instanceof Error ? err.message : "QuantumAI group reply failed",
          "error",
        );
      }
    } finally {
      setAiBusy(false);
      aiAbortRef.current = null;
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || !selected) return;
    if (
      aiBusy &&
      (selected.peer?.systemRole === "quantum_ai" ||
        /@QuantumAI\b/i.test(draft))
    ) {
      showToast("QuantumAI is already responding", "error");
      return;
    }

  stopTyping();

    try {
      if (
        selected.type === "dm" &&
        selected.peer?.systemRole === "quantum_ai"
      ) {
        const prompt = draft.trim();
        setDraft("");
        await sendPrivateQuantumAIMessage(prompt);
        playSendSound();
        setTimeout(() => scrollToBottom("smooth"), 50);
        return;
      }

      if (editingMessage) {
        if (selected.type === "group") {
          const group =
            selected.group ||
            groups.find((g) => String(g.id) === String(selected.id));
          if (!group) {
            showToast("Group not found", "error");
            return;
          }
          const editBody =
            group.visibility === "public"
              ? { content: draft }
              : { envelopes: sealGroupEnvelopes(draft, group) };
          const { data } = await client.patch(
            `/messages/${editingMessage.id || editingMessage._id}`,
            editBody,
          );
          setMessages((prev) =>
            prev.map((m) =>
              String(m.id || m._id) ===
                String(editingMessage.id || editingMessage._id)
                ? decorate(data.data)
                : m,
            ),
          );
        } else {
          const myKey = pickRandom(getCurrentKeySet(user.id));
          let recipientKeys = (resolveDmPeer(selected)?.publicKeys || []).filter(Boolean);
          if (recipientKeys.length === 0 && selected) {
            recipientKeys = await ensurePeerKeys(selected);
          }
          if (!myKey?.publicKey || recipientKeys.length === 0) {
            showToast("Missing encryption keys for this conversation", "error");
            return;
          }
          const forRecipient = sealMessage(draft, pickRandom(recipientKeys));
          const forSender = sealMessage(draft, myKey.publicKey);
          const { data } = await client.patch(
            `/messages/${editingMessage.id || editingMessage._id}`,
            {
              forRecipient,
              forSender,
            },
          );
          setMessages((prev) =>
            prev.map((m) =>
              String(m.id || m._id) ===
                String(editingMessage.id || editingMessage._id)
                ? decorate(data.data)
                : m,
            ),
          );
        }
        setEditingMessage(null);
        setDraft("");
        setReplyTo(null);
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        return;
      }

      if (selected.type === "group") {
        const group =
          selected.group ||
          groups.find((g) => String(g.id) === String(selected.id));
        if (!group) {
          showToast("Group not found", "error");
          return;
        }
        const asAnnouncement =
          pendingAnnouncement || draft.trim().startsWith("/announce");
        const bodyText = asAnnouncement
          ? draft.trim().replace(/^\/announce\s*/i, "")
          : draft;
        const plaintext = asAnnouncement
          ? encodeAnnouncement(bodyText)
          : bodyText;
               const allMentionedUserIds = extractMentions(bodyText, group.members || []);
        const mentionedUserIds = allMentionedUserIds.filter((mid) => {
          const member = (group.members || []).find((m) => String(memberId(m)) === String(mid));
          return member ? !mentionBlockReason(member) : true;
        });
        if (mentionedUserIds.length < allMentionedUserIds.length) {
          const blockedNames = allMentionedUserIds
            .filter((mid) => !mentionedUserIds.includes(mid))
            .map((mid) => {
              const member = (group.members || []).find((m) => String(memberId(m)) === String(mid));
              return member?.username;
            })
            .filter(Boolean);
          if (blockedNames.length) {
            showToast(
              `${blockedNames.join(", ")} won't be notified — mentions are turned off for them`,
              "info",
            );
          }
        }
        const kind = asAnnouncement ? "announcement" : "text";
        const clientMessageId = crypto.randomUUID();
        const tempId = `outbox-${clientMessageId}`;
        const replySnapshot = replyTo;
        const draftSnapshot = draft;

        setDraft("");
        setReplyTo(null);
        setMentionOpen(false);
        setPendingAnnouncement(false);
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        setMessages((prev) => [
          ...prev,
          {
            id: tempId,
            _id: tempId,
            from: user.id,
            group: selected.id,
            text: plaintext,
            kind,
            createdAt: new Date().toISOString(),
            _status: "sending",
            _pending: true,
            replyTo: replySnapshot
              ? {
                id: replySnapshot.id || replySnapshot._id,
                from: replySnapshot.from,
                text: replySnapshot.text,
              }
              : null,
          },
        ]);
        playSendSound();
        markConversationRead(user.id, selected.key);
        bumpActivity();
        setTimeout(() => scrollToBottom("smooth"), 50);

        try {
          await sendGroupPayload(plaintext, {
            kind,
            mentionedUserIds,
            tempId,
            clientMessageId,
            displayText: plaintext,
            replyToId: replySnapshot
              ? replySnapshot.id || replySnapshot._id
              : null,
          });
          if (!asAnnouncement && /(^|\s)@QuantumAI\b/i.test(bodyText)) {
            await invokeGroupQuantumAI(bodyText, group);
          }
        } catch (err) {
          if (isRetryableSendError(err)) {
            setMessages((prev) => prev.map((m) =>
              String(m.id || m._id) === tempId ? { ...m, _status: "waiting" } : m,
            ));
          } else {
            await removeOfflineMessage(user.id, clientMessageId);
            setMessages((prev) => prev.filter((m) => String(m.id || m._id) !== tempId));
            setDraft(draftSnapshot);
            setReplyTo(replySnapshot);
          }
          throw err;
        }
      } else {
        const myKey = pickRandom(getCurrentKeySet(user.id));
        let recipientKeys = (resolveDmPeer(selected)?.publicKeys || []).filter(Boolean);
        if (recipientKeys.length === 0 && selected) {
          recipientKeys = await ensurePeerKeys(selected);
        }
        if (!myKey?.publicKey || recipientKeys.length === 0) {
          showToast("Missing encryption keys for this conversation", "error");
          return;
        }
        const draftSnapshot = draft;
        const replySnapshot = replyTo;
        const clientMessageId = crypto.randomUUID();
        const tempId = `outbox-${clientMessageId}`;
        const plaintext = draft;

        setDraft("");
        setCapsuleUnlocksAt("");
        setShowCapsulePicker(false);
        setReplyTo(null);
        setMentionOpen(false);
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        setMessages((prev) => [
          ...prev,
          {
            id: tempId,
            _id: tempId,
            from: user.id,
            to: selected.id,
            text: plaintext,
            createdAt: new Date().toISOString(),
            _status: "sending",
            _pending: true,
            replyTo: replySnapshot
              ? {
                id: replySnapshot.id || replySnapshot._id,
                from: replySnapshot.from,
                text: replySnapshot.text,
              }
              : null,
          },
        ]);
        playSendSound();
        markConversationRead(user.id, selected.key);
        bumpActivity();
        setTimeout(() => scrollToBottom("smooth"), 50);

        try {
          const forRecipient = sealMessage(plaintext, pickRandom(recipientKeys));
          const forSender = sealMessage(plaintext, myKey.publicKey);
          const body = { to: selected.id, forRecipient, forSender };
          body.clientMessageId = clientMessageId;
          if (replySnapshot) body.replyTo = replySnapshot.id || replySnapshot._id;
          if (disappearSeconds > 0) body.expiresInSeconds = disappearSeconds;
          if (capsuleUnlocksAt) {
            body.timeCapsule = true;
            body.unlocksAt = new Date(capsuleUnlocksAt).toISOString();
          }
          const forwardPolicy = buildForwardPolicy();
          if (forwardPolicy) body.forwardPolicy = forwardPolicy;
          await saveOfflineMessage(user.id, {
            id: clientMessageId,
            type: "dm",
            conversationId: selected.id,
            conversationKey: selected.key,
            displayText: plaintext,
            payload: body,
          });
          const { data } = await client.post("/messages", body);
          await removeOfflineMessage(user.id, clientMessageId);
          recordActivityFromMessage(data.data);
          setMessages((prev) =>
            mergeConfirmedMessage(prev, {
              tempId,
              serverRaw: data.data,
              displayText: plaintext,
            }),
          );
        } catch (err) {
          if (isRetryableSendError(err)) {
            setMessages((prev) => prev.map((m) =>
              String(m.id || m._id) === tempId ? { ...m, _status: "waiting" } : m,
            ));
          } else {
            await removeOfflineMessage(user.id, clientMessageId);
            setMessages((prev) => prev.filter((m) => String(m.id || m._id) !== tempId));
            setDraft(draftSnapshot);
            setReplyTo(replySnapshot);
          }
          throw err;
        }
      }
    } catch (err) {
      if (!handleNotFriendsError(err, selected?.id)) {
        showToast(
          err.response?.data?.error || err.message || "Failed to send message",
          "error",
        );
      }
    }
  }
  async function sendGifMessage(gifUrl) {
    if (!selected || gifSending) return;
    setGifSending(true);
    try {
      const resp = await fetch(gifUrl);
      if (!resp.ok) throw new Error('Could not download GIF');
      const blob = await resp.blob();
      const file = new File([blob], `gif-${Date.now()}.gif`, {
        type: blob.type || 'image/gif',
      });
      await sendAttachmentFile(file, { quiet: true });
      setGifPickerOpen(false);
      setGifQuery('');
      setGifResults([]);
    } catch (err) {
      if (!handleNotFriendsError(err, selected?.id)) {
        showToast(err.message || 'Failed to send GIF — try again', 'error');
      }
    } finally {
      setGifSending(false);
    }
  }
  // Uploads one already-encrypted blob to our proxy endpoint (POST
  // /attachments/init hands back the pendingUploadId this targets), which
  // forwards the bytes to Cloudinary.
  async function putCiphertext(
    blob,
    filename,
    { pendingUploadId, slot, signal, onProgress },
  ) {
    const formData = new FormData();
    formData.append("file", blob, filename);
    await client.put(
      `/attachments/pending/${pendingUploadId}/bytes?slot=${slot}`,
      formData,
      { signal, onUploadProgress: onProgress },
    );
    return undefined;
  }

  // Large-file path: same durable result as putCiphertext, but sent as
  // sequential small requests instead of one big body — Vercel's
  // serverless functions reject an oversized single request body outright,
  // which is what actually broke video uploads.
    async function putCiphertextChunked(
    cipherBytes,
    { pendingUploadId, slot, signal, onProgress },
  ) {
    const total = cipherBytes.byteLength;
    const totalChunks = Math.max(1, Math.ceil(total / CHUNK_SIZE));
    const CONCURRENCY = 4; // parallel round-trips per slot — chunks carry their own index, order doesn't matter server-side
    const loadedByChunk = new Array(totalChunks).fill(0);
    const report = () => {
      const sent = loadedByChunk.reduce((a, b) => a + b, 0);
      onProgress?.({ loaded: sent, total });
    };

    async function uploadChunk(chunkIndex) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, total);
      const chunkBlob = new Blob([cipherBytes.subarray(start, end)], {
        type: "application/octet-stream",
      });

      await client.put(
        `/attachments/pending/${pendingUploadId}/chunk?slot=${slot}&chunkIndex=${chunkIndex}&totalChunks=${totalChunks}`,
        chunkBlob,
        { signal, headers: { "Content-Type": "application/octet-stream" } },
      );

      loadedByChunk[chunkIndex] = end - start;
      report();
    }

    let nextIndex = 0;
    async function worker() {
      while (nextIndex < totalChunks) {
        const chunkIndex = nextIndex;
        nextIndex += 1;
        await uploadChunk(chunkIndex);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, totalChunks) }, worker),
    );
    return undefined;
  }
  async function sendAttachmentFile(file, { plainBytes, quiet, viewOnce = false, offlineId, skipOutbox = false, offlineEntry } = {}) {
    if (
      !file ||
      !selected ||
      (selected.type !== "dm" && selected.type !== "group")
    )
      return;

    if (file.size > MAX_FILE_SIZE) {
      showToast(
        `File too large (${formatFileSize(file.size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`,
        "error",
      );
      return;
    }

    const uploadId = offlineId || crypto.randomUUID();
    const controller = new AbortController();
    setUploads((prev) => [
      ...prev,
      { id: uploadId, name: file.name, progress: 0, controller },
    ]);
    const pendingMessageId = `outbox-${uploadId}`;
    setMessages((prev) => {
      if (prev.some((message) => String(message.id || message._id) === pendingMessageId)) return prev;
      return [...prev, {
        id: pendingMessageId,
        _id: pendingMessageId,
        from: user.id,
        ...(selected.type === "group" ? { group: selected.id } : { to: selected.id }),
        text: file.name || "Attachment",
        createdAt: new Date().toISOString(),
        _status: "sending",
        _pending: true,
        _mediaPending: true,
      }];
    });

    try {
      if (selected.type === "group") {
        const fileBytes =
          plainBytes || new Uint8Array(await file.arrayBuffer());
        const sealed = await secretboxSealAsync(fileBytes);
        if (!skipOutbox) await saveOfflineMedia(user.id, {
          id: uploadId,
          type: "group",
          conversationId: selected.id,
          conversationKey: selected.key,
          filename: file.name,
          mimetype: file.type || "application/octet-stream",
          viewOnce,
          sealedKey: sealed.key,
          sealedNonce: sealed.nonce,
          sourceBytes: fileBytes,
        });
        const mimeType = file.type || "application/octet-stream";
        const cipherBlob = new Blob([sealed.cipherBytes], { type: mimeType });
        const useChunked = sealed.cipherBytes.byteLength > CHUNK_SIZE;

        const initRes = await client.post(
          "/attachments/init",
          {
            groupId: selected.id,
            clientUploadId: uploadId,
            secretboxNonce: sealed.nonce,
            filename: file.name,
            mimetype: mimeType,
            size: cipherBlob.size,
          },
          { signal: controller.signal },
        );
        const initData = initRes.data.data;
        const pendingUploadId = initData.pendingUploadId;
        let attachment = initData.finalizedAttachmentId
          ? { id: initData.finalizedAttachmentId, filename: file.name, mimetype: mimeType, size: file.size }
          : null;

        const onRecipientProgress = (event) => {
          if (!event.total) return;
          const progress = Math.min(
            100,
            Math.round((event.loaded / event.total) * 100),
          );
          setUploads((prev) =>
            prev.map((u) => (u.id === uploadId ? { ...u, progress } : u)),
          );
        };

        const recipientDirectUploadId = attachment ? undefined : (useChunked
          ? await putCiphertextChunked(sealed.cipherBytes, {
              pendingUploadId,
              slot: "recipient",
              signal: controller.signal,
              onProgress: onRecipientProgress,
            })
          : await putCiphertext(cipherBlob, file.name, {
              pendingUploadId,
              slot: "recipient",
              signal: controller.signal,
              onProgress: onRecipientProgress,
            }));
        if (!attachment) {
          const finalizeRes = await client.post(
            "/attachments/finalize",
            { pendingUploadId: initData.pendingUploadId, clientUploadId: uploadId, recipientDirectUploadId },
            { signal: controller.signal },
          );
          attachment = finalizeRes.data.data;
          await updateOfflineMedia(user.id, uploadId, { finalizedAttachmentId: attachment.id });
        }
        const plaintext = encodeGroupFile({
          attachmentId: attachment.id,
          key: offlineEntry?.sealedKey || sealed.key,
          nonce: offlineEntry?.sealedNonce || sealed.nonce,
          filename: attachment.filename || file.name,
          mimetype:
            attachment.mimetype || file.type || "application/octet-stream",
          size: attachment.size || file.size,
        });
        const wantViewOnce = viewOnce && isViewOnceEligibleFile(file);
        await sendGroupPayload(plaintext, {
          kind: "file",
          attachmentId: attachment.id,
          clientMessageId: uploadId,
          tempId: pendingMessageId,
          ...(wantViewOnce ? { viewOnce: true } : {}),
        });
        await removeOfflineMedia(user.id, uploadId);
        playSendSound();
        if (!quiet) showToast("File sent successfully", "success", 3000);
        setTimeout(() => scrollToBottom("smooth"), 50);
        return;
      }

      const myKey = pickRandom(getCurrentKeySet(user.id));
      let recipientKeys = (resolveDmPeer(selected)?.publicKeys || []).filter(Boolean);
      if (recipientKeys.length === 0 && selected) {
        recipientKeys = await ensurePeerKeys(selected);
      }
      if (!myKey?.publicKey || recipientKeys.length === 0) {
        showToast("Missing encryption keys for this conversation", "error");
        return;
      }
      const recipientPublicKey = pickRandom(recipientKeys);
      const fileBytes = plainBytes || new Uint8Array(await file.arrayBuffer());
      if (!skipOutbox) await saveOfflineMedia(user.id, {
        id: uploadId,
        type: "dm",
        conversationId: selected.id,
        conversationKey: selected.key,
        filename: file.name,
        mimetype: file.type || "application/octet-stream",
        viewOnce,
        sourceBytes: fileBytes,
      });
      // Safe to run concurrently: each call only transfers its OWN output
      // buffer back (see cryptoWorker.js) — fileBytes itself is never
      // transferred, so there's nothing shared to race on.
      const [forRecipientFile, forSenderFile] = await Promise.all([
        sealBytesAsync(fileBytes, recipientPublicKey),
        sealBytesAsync(fileBytes, myKey.publicKey),
      ]);
      const mimeType = file.type || "application/octet-stream";
      const useChunked = forRecipientFile.cipherBytes.byteLength > CHUNK_SIZE;
      const recipientBlob = new Blob([forRecipientFile.cipherBytes], {
        type: mimeType,
      });
      const senderBlob = new Blob([forSenderFile.cipherBytes], {
        type: mimeType,
      });

      const initRes = await client.post(
        "/attachments/init",
        {
          recipientId: selected.id,
          clientUploadId: uploadId,
          filename: file.name,
          mimetype: mimeType,
          size: recipientBlob.size,
          nonce: forRecipientFile.nonce,
          ephemeralPublicKey: forRecipientFile.ephemeralPublicKey,
          targetPublicKey: forRecipientFile.targetPublicKey,
          forSenderNonce: forSenderFile.nonce,
          forSenderEphemeralPublicKey: forSenderFile.ephemeralPublicKey,
          forSenderTargetPublicKey: forSenderFile.targetPublicKey,
        },
        { signal: controller.signal },
      );
      const initData = initRes.data.data;
      const existingAttachmentId = initData.finalizedAttachmentId;
      const pendingUploadId = initData.pendingUploadId;
      const sender = initData.sender;

      let recipientLoaded = 0;
      let senderLoaded = 0;
      const totalBytes = recipientBlob.size + senderBlob.size;
      const reportProgress = () => {
        if (!totalBytes) return;
        const progress = Math.min(
          100,
          Math.round(((recipientLoaded + senderLoaded) / totalBytes) * 100),
        );
        setUploads((prev) =>
          prev.map((u) => (u.id === uploadId ? { ...u, progress } : u)),
        );
      };
      const recipientUploadPromise = existingAttachmentId ? Promise.resolve(undefined) : (useChunked
        ? putCiphertextChunked(forRecipientFile.cipherBytes, {
            pendingUploadId,
            slot: "recipient",
            signal: controller.signal,
            onProgress: (event) => {
              recipientLoaded = event.loaded || 0;
              reportProgress();
            },
          })
        : putCiphertext(recipientBlob, file.name, {
            pendingUploadId,
            slot: "recipient",
            signal: controller.signal,
            onProgress: (event) => {
              recipientLoaded = event.loaded || 0;
              reportProgress();
            },
          }));

      const senderUploadPromise = existingAttachmentId ? Promise.resolve(undefined) : (sender
        ? useChunked
          ? putCiphertextChunked(forSenderFile.cipherBytes, {
              pendingUploadId,
              slot: "sender",
              signal: controller.signal,
              onProgress: (event) => {
                senderLoaded = event.loaded || 0;
                reportProgress();
              },
            })
          : putCiphertext(senderBlob, file.name, {
              pendingUploadId,
              slot: "sender",
              signal: controller.signal,
              onProgress: (event) => {
                senderLoaded = event.loaded || 0;
                reportProgress();
              },
            })
        : Promise.resolve(undefined));

      // Recipient and sender ciphertext are independent objects server-side
      // — concurrent upload roughly halves wall-clock time versus two full
      // round trips back to back.
      const [recipientDirectUploadId, senderDirectUploadId] = await Promise.all([
        recipientUploadPromise,
        senderUploadPromise,
      ]);

      let attachmentId = existingAttachmentId;
      if (!attachmentId) {
        const finalizeRes = await client.post(
          "/attachments/finalize",
          { pendingUploadId, clientUploadId: uploadId, recipientDirectUploadId, senderDirectUploadId },
          { signal: controller.signal },
        );
        attachmentId = finalizeRes.data.data.id;
        await updateOfflineMedia(user.id, uploadId, { finalizedAttachmentId: attachmentId });
      }

      const forRecipient = sealMessage("", recipientPublicKey);
      const forSender = sealMessage("", myKey.publicKey);
      const msgBody = {
        to: selected.id,
        clientMessageId: uploadId,
        forRecipient,
        forSender,
        attachmentId,
      };
      if (disappearSeconds > 0) msgBody.expiresInSeconds = disappearSeconds;
      const wantViewOnce = viewOnce && isViewOnceEligibleFile(file);
      if (wantViewOnce) msgBody.viewOnce = true;
      const forwardPolicy = buildForwardPolicy();
      if (forwardPolicy && !wantViewOnce) msgBody.forwardPolicy = forwardPolicy;
      const { data } = await client.post("/messages", msgBody);
      await removeOfflineMedia(user.id, uploadId);
      recordActivityFromMessage(data.data);
      setMessages((prev) => mergeConfirmedMessage(prev, {
        tempId: pendingMessageId,
        serverRaw: data.data,
        displayText: file.name,
      }));
      void markMessageImportantIfNeeded(data.data);
      playSendSound();
      if (!quiet) showToast("File sent successfully", "success", 3000);
      setTimeout(() => scrollToBottom("smooth"), 50);
    } catch (err) {
      if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") {
        showToast("Upload cancelled", "info", 2500);
        return;
      }
      if (!handleNotFriendsError(err, selected?.id)) {
        showToast(
          err.response?.data?.error || err.message || "Upload failed",
          "error",
        );
      }
      if (isRetryableSendError(err)) {
        setMessages((prev) => prev.map((message) =>
          String(message.id || message._id) === pendingMessageId
            ? { ...message, _status: "waiting" }
            : message,
        ));
      } else {
        setMessages((prev) => prev.filter((message) => String(message.id || message._id) !== pendingMessageId));
      }
    } finally {
      setUploads((prev) => prev.filter((u) => u.id !== uploadId));
    }
  }

  async function retryOfflineMediaForSelection() {
    if (!navigator.onLine || !user?.id || !selected?.key) return;
    const entries = (await getOfflineMedia(user.id)).filter(
      (entry) => entry.conversationKey === selected.key,
    );
    for (const entry of entries) {
      const file = new File([entry.sourceBytes], entry.filename || 'attachment', {
        type: entry.mimetype || 'application/octet-stream',
      });
      await sendAttachmentFile(file, {
        plainBytes: entry.sourceBytes,
        viewOnce: entry.viewOnce === true,
        offlineId: entry.id,
        skipOutbox: true,
        offlineEntry: entry,
        quiet: true,
      });
    }
  }

  useEffect(() => {
    const retry = () => retryOfflineMediaForSelection().catch(() => {});
    window.addEventListener('online', retry);
    retry();
    return () => window.removeEventListener('online', retry);
  }, [selected?.key, user?.id]);
  async function sendAttachmentFiles(filesOrFile, { viewOnce = false } = {}) {
    const list = Array.isArray(filesOrFile)
      ? filesOrFile
      : filesOrFile
        ? [filesOrFile]
        : [];
    const files = list.filter(Boolean);
    if (
      !files.length ||
      !selected ||
      (selected.type !== "dm" && selected.type !== "group")
    )
      return;

    let ok = 0;
    let failed = 0;
    // A handful of files in flight at once — each does its own encryption
    // (queued safely on the shared crypto worker) and its own upload, so
    // this is a real speedup for a multi-photo batch without saturating
    // the network the way, say, 20-at-once would.
    const FILE_CONCURRENCY = 3;
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < files.length) {
        const i = nextIndex;
        nextIndex += 1;
        const file = files[i];
        try {
          await sendAttachmentFile(file, { quiet: files.length > 1, viewOnce });
          ok += 1;
        } catch (err) {
          failed += 1;
          showToast(
            err.response?.data?.error ||
            err.message ||
            `Failed to send ${file.name}`,
            "error",
          );
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(FILE_CONCURRENCY, files.length) }, worker),
    );

    if (files.length > 1 && ok > 0) {
      showToast(
        `${ok} file${ok === 1 ? "" : "s"} sent${failed ? `, ${failed} failed` : ""}`,
        failed ? "error" : "success",
        3500,
      );
    }
  }

  async function queueAttachmentFiles(filesOrFile) {
    const list = Array.isArray(filesOrFile)
      ? filesOrFile
      : filesOrFile
        ? [filesOrFile]
        : [];
    const files = list.filter(Boolean);
    if (
      !files.length ||
      !selected ||
      (selected.type !== "dm" && selected.type !== "group")
    )
      return;

    const mediaFiles = files.filter(isMediaPreviewFile);
    const otherFiles = files.filter((f) => !isMediaPreviewFile(f));

    if (otherFiles.length) {
      await sendAttachmentFiles(otherFiles);
    }

    if (mediaFiles.length) {
      setMediaPreview({ files: mediaFiles, index: 0, viewOnce: false, compress: false });
    }
  }
  // WhatsApp-style bulk send: commits every picked photo/video at once
  // instead of tapping Send once per item. Deliberately skips per-item
  // view-once/compress — those stay on the one-at-a-time flow below, since
  // asking per-photo would defeat the point of a bulk action.
  async function handleSendAllMedia() {
    if (!mediaPreview || mediaPreviewSending || mediaCompressing) return;
    const files = mediaPreview.files;
    if (!files?.length) {
      setMediaPreview(null);
      return;
    }
    setMediaPreviewSending(true);
    try {
      await sendAttachmentFiles(files);
    } finally {
      setMediaPreviewSending(false);
      setMediaPreview(null);
    }
  }

  async function handleMediaPreviewSend() {
    if (!mediaPreview || mediaPreviewSending || mediaCompressing) return;
    const file = mediaPreview.files[mediaPreview.index];
    if (!file) {
      setMediaPreview(null);
      return;
    }

    let fileToSend = file;
    if (mediaPreview.compress && String(file.type || "").startsWith("video/")) {
      setMediaCompressing(true);
      setMediaCompressProgress(0);
      try {
        fileToSend = await compressVideo(
          file,
          (progress) => setMediaCompressProgress(progress),
          (phase) => setMediaCompressPhase(phase),
        );
      } catch (err) {
        showToast(
          err.message || "Compression failed — sending original video",
          "error",
        );
        fileToSend = file;
      } finally {
        setMediaCompressing(false);
        setMediaCompressProgress(0);
        setMediaCompressPhase('encoding');
      }
    }

    setMediaPreviewSending(true);
    try {
      await sendAttachmentFile(fileToSend, {
        viewOnce: mediaPreview.viewOnce,
        quiet: mediaPreview.files.length > 1,
      });
      const nextIndex = mediaPreview.index + 1;
      if (nextIndex < mediaPreview.files.length) {
        setMediaPreview({
          files: mediaPreview.files,
          index: nextIndex,
          viewOnce: false,
          compress: false,
        });
      } else {
        setMediaPreview(null);
      }
    } catch (err) {
      showToast(
        err.response?.data?.error || err.message || "Failed to send media",
        "error",
      );
    } finally {
      setMediaPreviewSending(false);
    }
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (
      !files.length ||
      !selected ||
      (selected.type !== "dm" && selected.type !== "group")
    )
      return;
    await queueAttachmentFiles(files);
  }

  function handlePaste(e) {
    if (
      !selected ||
      (selected.type !== "dm" && selected.type !== "group") ||
      sendingVoice ||
      recording
    )
      return;
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    const imageFiles = [];
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const named =
            file.name && file.name !== "image.png"
              ? file
              : new File([file], `paste-${Date.now()}.png`, {
                type: file.type || "image/png",
              });
          imageFiles.push(named);
        }
      }
    }
    if (!imageFiles.length) return;
    e.preventDefault();
    queueAttachmentFiles(imageFiles).catch((err) => {
      showToast(err.message || "Paste upload failed", "error");
    });
  }

  // Drag and drop events
  function handleDragEnter(e) {
    e.preventDefault();
    dragCountRef.current += 1;
    if (dragCountRef.current === 1) setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragCountRef.current -= 1;
    if (dragCountRef.current === 0) setIsDragging(false);
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDrop(e) {
    e.preventDefault();
    dragCountRef.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) {
      queueAttachmentFiles(files).catch((err) => {
        showToast(err.message || "File drop failed", "error");
      });
    }
  }

  function handleImageReady(id, src, filename) {
    if (!id || !src) return;
    imageSrcMapRef.current.set(String(id), { src, alt: filename || "Image" });
  }

  function handleImagePreview(id) {
    const items = [];
    for (const m of messages) {
      const attId = attachmentIdOf(m.attachment);
      if (!attId) continue;
      const entry = imageSrcMapRef.current.get(String(attId));
      if (entry) items.push({ id: String(attId), ...entry });
    }
    if (!items.length) {
      const fallback = imageSrcMapRef.current.get(String(id));
      if (fallback) {
        setGallery({ items: [{ id: String(id), ...fallback }], index: 0 });
      }
      return;
    }
    const index = Math.max(
      0,
      items.findIndex((it) => it.id === String(id)),
    );
    setGallery({ items, index: index < 0 ? 0 : index });
  }

  function handleVideoReady(id, src, filename) {
    if (!id || !src) return;
    videoSrcMapRef.current.set(String(id), { src, alt: filename || "Video" });
  }

  function handleVideoPreview(id) {
    const entry = videoSrcMapRef.current.get(String(id));
    if (!entry) return;
    setVideoPlayer({ src: entry.src, filename: entry.alt });
  }

  function clearRecordingResources({ keepChunks = false } = {}) {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    if (!keepChunks) recordChunksRef.current = [];
    setRecordSeconds(0);
    setRecording(false);
  }

  async function startVoiceRecording() {
    if (
      !selected ||
      (selected.type !== "dm" && selected.type !== "group") ||
      recording ||
      sendingVoice
    )
      return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      showToast("Voice notes are not supported in this browser", "error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordChunksRef.current = [];
      recordStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) recordChunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        clearRecordingResources();
        showToast("Voice recording failed", "error");
      };

      recorder.onstop = async () => {
        const chunks = recordChunksRef.current.slice();
        const type = (recorder.mimeType || mimeType || "audio/webm").split(
          ";",
        )[0];
        clearRecordingResources();
        if (!chunks.length) {
          showToast("No audio captured — try again", "error");
          return;
        }

        const blob = new Blob(chunks, { type: type || "audio/webm" });
        if (blob.size < 256) {
          showToast("Recording too short — hold a bit longer", "error");
          return;
        }

        const ext = type.includes("mp4")
          ? "m4a"
          : type.includes("ogg")
            ? "ogg"
            : "webm";
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, {
          type: type || "audio/webm",
        });
        const plainBytes = new Uint8Array(await blob.arrayBuffer());

        setSendingVoice(true);
        try {
          await sendAttachmentFile(file, { plainBytes });
        } catch (err) {
          showToast(
            err.response?.data?.error || "Failed to send voice note",
            "error",
          );
        } finally {
          setSendingVoice(false);
        }
      };

      recorder.start(200);
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - recordStartedAtRef.current) / 1000,
        );
        setRecordSeconds(elapsed);
        if (elapsed >= MAX_VOICE_SECONDS) {
          stopVoiceRecording();
        }
      }, 200);
    } catch {
      clearRecordingResources();
      showToast("Microphone permission is required for voice notes", "error");
    }
  }

  function stopVoiceRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      clearRecordingResources();
      return;
    }
    try {
      if (recorder.state === "recording") recorder.requestData();
    } catch {
      // ignore
    }
    recorder.stop();
  }

  function cancelVoiceRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = () => clearRecordingResources();
      try {
        recorder.stop();
      } catch {
        clearRecordingResources();
      }
      return;
    }
    clearRecordingResources();
  }

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaStreamRef.current)
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (!pendingJumpMessageId) return;
    const el = document.getElementById(`msg-${pendingJumpMessageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.animation = "none";
      el.offsetHeight;
      el.style.animation = "msgIn 400ms ease both";
      setPendingJumpMessageId(null);
    }
  }, [messages, pendingJumpMessageId]);

  useEffect(() => {
    if (!pendingJumpMessageId || !selected || loadingMessages) return;
    const idStr = String(pendingJumpMessageId);
    const found = messages.some((m) => String(m.id || m._id) === idStr);
    if (found) return; // the other effect (scroll-into-view) will handle it
    if (!hasMoreMessages || loadingOlderRef.current) {
      // Nothing more to load and still not found — give up gracefully.
      if (!hasMoreMessages) {
        setPendingJumpMessageId(null);
        showToast("Couldn't locate that message — it may have been deleted", "info");
      }
      return;
    }
    loadOlderMessages();
  }, [pendingJumpMessageId, selected, messages, hasMoreMessages, loadingMessages, loadOlderMessages, showToast]);
  function handleDeleteMessage(messageId) {
    if (!messageId) return;
    setConfirmDialog({
      type: "delete",
      messageId,
      title: "Delete message?",
      message:
        "This removes the message for everyone. It will disappear for both of you with no trace.",
      confirmLabel: "Delete",
      danger: true,
    });
  }

  function handleDeleteForMe(messageId) {
    setDeletedForMeIds(deleteMessageForMe(user.id, messageId));
    setExtrasTick((n) => n + 1);
    showToast("Message removed for you", "success");
  }

  async function handleBurnViewOnce(message) {
    const messageId = message?.id || message?._id;
    if (!messageId) return;
    const { data } = await client.post(`/messages/${messageId}/view-once`);
    if (data?.data) {
      setMessages((prev) =>
        prev.map((m) =>
          String(m.id || m._id) === String(messageId) ? decorate(data.data) : m,
        ),
      );
    }
  }

  function handleCopyMessage(message) {
    if (!message?.text) return;
    navigator.clipboard?.writeText(message.text).then(
      () => showToast("Copied to clipboard", "success"),
      () => showToast("Could not copy message", "error"),
    );
  }

  function handleStarMessage(messageId) {
    if (!messageId || !selected) return;
    const msg = messages.find((m) => String(m.id || m._id) === String(messageId));
    const nextIds = toggleStarredMessage(
      user.id,
      msg || { id: messageId },
      { key: selected.key, type: selected.type, id: selected.id, title: selected.title },
    );
    setStarredIds(nextIds);
    setExtrasTick((n) => n + 1);
  }

  async function handleImportantMessage(messageOrId) {
    const messageId = String(messageOrId?.id || messageOrId?._id || messageOrId || '');
    if (!messageId) return;
    const message = typeof messageOrId === 'object'
      ? messageOrId
      : messages.find((candidate) => String(candidate.id || candidate._id) === messageId);
    const previous = importantEntries;
    const existing = previous.some((entry) => String(entry.id || entry._id) === messageId);

    if (existing) {
      const wasAutomatic = Boolean(getAutomaticImportantSource(message || previous.find((entry) => String(entry.id || entry._id) === messageId) || {}));
      if (wasAutomatic) {
        rememberAutoImportantRemoval(user.id, messageId);
      }
      setImportantEntries((current) => current.filter((entry) => String(entry.id || entry._id) !== messageId));
      try {
        await client.delete(`/messages/${messageId}/important`);
        showToast('Removed from Important messages', 'success');
      } catch (err) {
        setImportantEntries(previous);
        showToast(err.response?.data?.error || "Couldn't remove message. Try again.", 'error');
      }
      return;
    }

    clearAutoImportantRemoval(user.id, messageId);
    const rawConversation = selected;
    const optimistic = {
      ...message,
      id: messageId,
      type: rawConversation?.type || (message?.group ? 'group' : 'dm'),
      conversationId: rawConversation?.id || (message?.group ? message.group : message?.from),
      conversationKey: rawConversation?.key || null,
      title: rawConversation?.title || 'Chat',
      isImportant: true,
      important: true,
      importantAt: new Date().toISOString(),
      hasAttachment: Boolean(message?.attachment),
      attachmentFilename: message?.attachment?.filename || null,
      importantSource: getAutomaticImportantSource(message || {}),
    };
    setImportantEntries((current) => [optimistic, ...current]);
    try {
      await client.post(`/messages/${messageId}/important`);
      showToast('Message saved to Important messages', 'success');
    } catch (err) {
      setImportantEntries(previous);
      showToast(err.response?.data?.error || "Couldn't save message. Try again.", 'error');
    }
  }

  async function handlePinMessage(messageId) {
    if (!selected?.key) return;
    if (selected.type === "group") {
      const pinned = (selected.group?.pinnedMessageIds || []).map(String);
      const isPinned = pinned.includes(String(messageId));
      try {
        const { data } = isPinned
          ? await client.delete(`/groups/${selected.id}/pins/${messageId}`)
          : await client.post(`/groups/${selected.id}/pins/${messageId}`);
        const group = data.data;
        setGroups((prev) =>
          prev.map((g) => (String(g.id) === String(group.id) ? group : g)),
        );
        setSelected((prev) =>
          prev ? { ...prev, group, title: group.name || prev.title } : prev,
        );
        setPinnedIds((group.pinnedMessageIds || []).map(String));
        setExtrasTick((n) => n + 1);
      } catch (err) {
        showToast(err.response?.data?.error || "Failed to update pin", "error");
      }
      return;
    }
    setPinnedIds(togglePinnedMessage(user.id, selected.key, messageId));
    setExtrasTick((n) => n + 1);
  }

  async function handleVotePoll(messageId, optionIndex) {
    if (!messageId || optionIndex == null || selected?.type !== "group") return;
    try {
      const { data } = await client.post(
        `/groups/messages/${messageId}/poll-vote`,
        { optionIndex },
      );
      setMessages((prev) =>
        prev.map((m) =>
          String(m.id || m._id) === String(messageId)
            ? { ...decorate(data.data), pollVotes: data.data.pollVotes || [] }
            : m,
        ),
      );
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to vote", "error");
    }
  }
  function handleShowMessageInfo(message) {
    const id = message?.id || message?._id;
    if (!id) return;
    const idStr = String(id);
    const replies = visibleMessages
      .filter((m) => m.replyTo && String(m.replyTo.id) === idStr)
      .map((m) => ({
        id: String(m.id || m._id),
        from: m.from,
        text: m.text,
        createdAt: m.createdAt,
      }));
    setMessageInfoData({
      id: idStr,
      reactions: message.reactions || [],
      replies,
    });
  }
  function handleShowEditHistory(message) {
    if (!message) return;
    setEditHistoryMessage(message);
  }

  function handleSelectReplyFromInfo(replyId) {
    setMessageInfoData(null);
    handleSearchResult(replyId);
  }
  function handleJumpToReply(replyId) {
    if (!replyId) return;
    handleSearchResult(String(replyId));
  }

  async function handleForwardToConversation(target) {
    if (!forwardMessage?.text || !target || target.type !== "dm") return;
    setForwardBusy(true);
    try {
      const originalId = forwardMessage.id || forwardMessage._id;
      if (originalId) {
        try {
          const check = await client.get(
            `/messages/${originalId}/forward-check`,
          );
          if (check.data?.data?.allowed === false) {
            showToast(
              check.data.data.reason ||
              "Forwarding not allowed for this message",
              "error",
            );
            return;
          }
        } catch (checkErr) {
          const reason =
            checkErr.response?.data?.data?.reason ||
            checkErr.response?.data?.error ||
            "Forwarding not allowed for this message";
          if (
            checkErr.response?.status === 403 ||
            checkErr.response?.status === 404
          ) {
            showToast(reason, "error");
            return;
          }
          // Network / unexpected: still attempt send; server will enforce.
        }
      }

      const myKey = pickRandom(getCurrentKeySet(user.id));
      let recipientKeys = (resolveDmPeer(target)?.publicKeys || []).filter(Boolean);
      if (recipientKeys.length === 0 && target) {
        recipientKeys = await ensurePeerKeys(target);
      }
      if (!myKey?.publicKey || recipientKeys.length === 0) {
        showToast("Missing encryption keys for this conversation", "error");
        return;
      }
      const forRecipient = sealMessage(
        forwardMessage.text,
        pickRandom(recipientKeys),
      );
      const forSender = sealMessage(forwardMessage.text, myKey.publicKey);
      const { data } = await client.post("/messages", {
        to: target.id,
        forRecipient,
        forSender,
        forwardedFrom: {
          username: user.username,
          messageId: originalId,
        },
      });
      if (selected?.key === target.key) {
        setMessages((prev) => {
          const id = String(data.data.id || data.data._id);
          if (prev.some((m) => String(m.id || m._id) === id)) return prev;
          return [...prev, decorate(data.data)];
        });
      }
      showToast(`Forwarded to ${target.title}`, "success");
      setForwardMessage(null);
    } catch (err) {
      if (!handleNotFriendsError(err, target?.id)) {
        showToast(
          err.response?.data?.error || "Failed to forward message",
          "error",
        );
      }
    } finally {
      setForwardBusy(false);
    }
  }

  async function executeDeleteMessage(messageId) {
    try {
      setConfirmBusy(true);
      await client.delete(`/messages/${messageId}`);
      setMessages((prev) =>
        prev.filter((m) => String(m.id || m._id) !== String(messageId)),
      );
      setConfirmDialog(null);
    } catch (err) {
      showToast(
        err.response?.data?.error || "Failed to delete message",
        "error",
      );
      setConfirmDialog(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  function closeConfirmDialog() {
    if (confirmBusy) return;
    setConfirmDialog(null);
  }

  async function handleConfirmDialog() {
    if (!confirmDialog) return;
    if (confirmDialog.type === "block") {
      await executeBlockUser(confirmDialog.user);
      return;
    }
    if (confirmDialog.type === "delete") {
      await executeDeleteMessage(confirmDialog.messageId);
      return;
    }
    if (confirmDialog.type === "regenerate-keys") {
      await handleGenerateKeys();
    }
  }

  async function handleReactMessage(messageId, emoji) {
    if (!messageId || !emoji || !selected) return;
    try {
      const existing = messages.find(
        (m) => String(m.id || m._id) === String(messageId),
      );
      const myReaction = (existing?.reactions || []).find(
        (r) => String(r.user) === String(user.id),
      );
      if (myReaction?.emoji === emoji) {
        const { data } = await client.post(`/messages/${messageId}/reactions`, {
          clear: true,
        });
        setMessages((prev) =>
          prev.map((m) =>
            String(m.id || m._id) === String(messageId)
              ? decorate(data.data)
              : m,
          ),
        );
        return;
      }

      const myKey = pickRandom(getCurrentKeySet(user.id));
      let recipientKeys = [];
      if (selected.type === "group") {
        const group =
          selected.group ||
          groups.find((g) => String(g.id) === String(selected.id));
        const targetId =
          String(existing?.from) === String(user.id)
            ? (group?.members || [])
              .map((m) => String(m.id || m._id))
              .find((id) => id !== String(user.id))
            : existing?.from;
        const member = (group?.members || []).find(
          (m) => String(m.id || m._id) === String(targetId),
        );
        recipientKeys = (member?.publicKeys || []).filter(Boolean);
      } else {
        recipientKeys = (resolveDmPeer(selected)?.publicKeys || []).filter(Boolean);
        if (recipientKeys.length === 0 && selected) {
          recipientKeys = await ensurePeerKeys(selected);
        }
      }
      if (!myKey?.publicKey || recipientKeys.length === 0) {
        showToast("Missing encryption keys for this conversation", "error");
        return;
      }
      const forRecipient = sealMessage(emoji, pickRandom(recipientKeys));
      const forSender = sealMessage(emoji, myKey.publicKey);
      const { data } = await client.post(`/messages/${messageId}/reactions`, {
        forRecipient,
        forSender,
      });
      setMessages((prev) =>
        prev.map((m) =>
          String(m.id || m._id) === String(messageId) ? decorate(data.data) : m,
        ),
      );
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to add reaction", "error");
    }
  }

  function insertEmoji(emoji) {
    setDraft((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  }

  async function handleGenerateKeys() {
    try {
      const { keySet } = await regenerateKeys();
      const content = formatKeyFile({
        username: user.username,
        email: user.email,
        secretKeys: keySet.map((k) => k.secretKey),
      });
      downloadKeyFile(content);
      showToast("New keys generated and synchronized successfully", "success");
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || "Failed to generate keys",
      );
      showToast("Failed to generate keys", "error");
    }
  }

  function requestGenerateKeys() {
    const isResync = keyringNeedsResync;
    setConfirmDialog({
      type: "regenerate-keys",
      title: isResync
        ? "Regenerate & resync encryption keys?"
        : "Generate new encryption keys?",
      message: isResync
        ? "Your local keyring does not match the public keys stored on the server. Regenerating publishes a fresh 5-key pool to the server and saves matching secrets on this device. Sealed stories and messages encrypted with the old pool will stay unreadable."
        : "This creates a new 5-key pool on this device and publishes it to the server. Save the downloaded keys.txt backup. Messages and sealed stories encrypted with any previous keys will stay unreadable.",
      confirmLabel: isResync ? "Regenerate & resync" : "Generate new keys",
      danger: true,
    });
  }

  async function handleImportKeyFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const secretKeys = parseKeyFile(text);
      await importKeys(secretKeys);
      setImportError("");
      showToast("Encryption key file imported successfully", "success");
    } catch (err) {
      setImportError(err.message || "Failed to import keys.txt");
      showToast(err.message || "Key import failed", "error");
    }
  }

  function handleLogout() {
    setLogoutConfirmOpen(true);
  }

  function confirmLogout() {
    setLogoutConfirmOpen(false);
    logout();
  }

  async function handleStartCall(video) {
    if (!selected || selected.type !== "dm") return;
    if (selected.isSelfChat || String(selected.id) === String(user.id)) return;
    try {
      await webrtc.startCall({
        peerId: selected.id,
        peerName: title,
        video,
      });
    } catch (err) {
      showToast(
        err.response?.data?.error ||
        err.message ||
        "Could not start the call. Check your connection and try again.",
        "error",
      );
    }
  }

  async function handleStartMeeting(video) {
    if (!selected || selected.type !== "group") return;
    try {
      await meetingCall.startMeeting({
        groupId: selected.id,
        video,
      });
    } catch (err) {
      showToast(
        err.response?.data?.error ||
        err.message ||
        "Could not start the meeting. Check your connection and try again.",
        "error",
      );
    }
  }

  // Only sent-bubble color and wallpaper vary by theme — received bubbles
  // stay the default white so text stays readable regardless of which
  // theme color is picked. When the theme is 'default', the var is left
  // unset so the original hardcoded CSS (gradient bubble, transparent
  // background) shows through untouched.
  const themeStyle = useMemo(() => {
    const vars = {};
    if (themeCatalog && chatTheme.bubbleColorId && chatTheme.bubbleColorId !== 'default') {
      const bubble = themeCatalog.bubbleColors.find((b) => b.id === chatTheme.bubbleColorId);
      if (bubble) {
        vars['--bubble-mine'] = bubble.mine;
        // `fg` is optional on older catalog responses — falls back to the
        // app theme's default (white in dark/eyecare, dark text in light)
        // via the CSS `var(--bubble-mine-fg, ...)` fallback if omitted.
        if (bubble.fg) {
          vars['--bubble-mine-fg'] = bubble.fg;
          vars['--bubble-mine-time'] = `color-mix(in srgb, ${bubble.fg} 78%, transparent)`;
        }
      }
    }
    if (chatTheme.wallpaperId === 'custom' && customWallpaperUrl) {
      vars['--chat-wallpaper'] = `url("${customWallpaperUrl}") center/cover no-repeat`;
    } else if (chatTheme.wallpaperId && chatTheme.wallpaperId !== 'none' && chatTheme.wallpaperId !== 'custom') {
      vars['--chat-wallpaper'] = getWallpaperBackground(chatTheme.wallpaperId);
    }
    return vars;
  }, [themeCatalog, chatTheme, customWallpaperUrl]);

  const title = useMemo(() => {
    if (!selected) return "Select a conversation";
    if (selected.type === "dm") {
      const peer = resolveDmPeer(selected);
      if (peer) return getDisplayName(peer, i18n.language);
    }
    return selected.title || (selected.type === "group" ? "Group" : "Chat");
  }, [selected, resolveDmPeer, i18n.language]);

  const headerSubtitle = useMemo(() => {
    if (!selected) return null;
    if (selected.type === "group") {
      if (groupTypingUsers.length) {
        return groupTypingUsers.length === 1
          ? `${groupTypingUsers[0].username} is typing…`
          : `${groupTypingUsers.slice(0, 2).map(u => u.username).join(", ")} typing…`;
      }
      const group =
        selected.group ||
        groups.find((g) => String(g.id) === String(selected.id));
      const desc = (group?.description || "").trim();
      const publicHint =
        group?.visibility === "public" ? "Public · not encrypted" : null;
      if (desc) {
        const short = desc.length > 72 ? `${desc.slice(0, 72)}…` : desc;
        return publicHint ? `${publicHint} · ${short}` : short;
      }
      const count = (group?.members || []).length;
      const base = count ? `${count} members` : "Group chat";
      return publicHint ? `${publicHint} · ${base}` : base;
    }
    const peer = resolveDmPeer(selected);
    if (selected.isSelfChat || peer?.isSelfChat) return "Notes to self";
    if (peer?.systemRole === "quantum_ai")
      return aiBusy ? "generating…" : "AI Assistant";
    if (peerTyping) return "typing…";
    // Server already filtered presence by the peer's onlineStatus privacy.
    const presenceLabel = onlineUserIds.has(String(selected.id))
      ? "online"
      : formatLastSeenLabel(peer?.lastLoginAt);
    const customStatus = (peer?.statusText || "").trim();
    if (customStatus) {
      return presenceLabel ? `${presenceLabel} · ${customStatus}` : customStatus;
    }
    return presenceLabel;
  }, [
    selected,
    groups,
    resolveDmPeer,
    onlineUserIds,
    peerTyping,
    groupTypingUsers,
    aiBusy,
  ]);

  const activeGroup = useMemo(() => {
    if (!selected || selected.type !== "group") return null;
    return (
      selected.group ||
      groups.find((g) => String(g.id) === String(selected.id)) ||
      null
    );
  }, [selected, groups]);

  const canPostInGroup = useMemo(() => {
    if (!activeGroup) return true;
    if (!activeGroup.onlyAdminsCanPost) return true;
    return isGroupAdmin(activeGroup, user.id);
  }, [activeGroup, user.id]);

  const iAmGroupAdmin = useMemo(
    () => Boolean(activeGroup && isGroupAdmin(activeGroup, user.id)),
    [activeGroup, user.id],
  );

  function mentionBlockReason(m) {
    const policy = m.privacy?.groupMentions || "everyone";
    if (policy === "nobody") return "mentions_off";
    if (policy === "adminsOnly" && !iAmGroupAdmin) return "admins_only";
    return null;
  }

  const mentionSuggestions = useMemo(() => {
    if (!mentionOpen || !activeGroup) return [];
    const q = mentionQuery || "";
    return (activeGroup.members || [])
      .filter((m) => {
        const id = memberId(m);
        if (String(id) === String(user.id)) return false;
        const name = (m.username || "").toLowerCase();
        return !q || name.startsWith(q);
      })
      .slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionOpen, mentionQuery, activeGroup, user.id, iAmGroupAdmin]);

  async function submitPollDraft(e) {
    e?.preventDefault?.();
    if (!pollDraft || !selected || selected.type !== "group") return;
    const options = (pollDraft.options || [])
      .map((o) => o.trim())
      .filter(Boolean);
    if (!pollDraft.question.trim() || options.length < 2) {
      showToast("Poll needs a question and at least 2 options", "error");
      return;
    }
    try {
      await sendGroupPayload(
        encodePoll({ question: pollDraft.question, options }),
        { kind: "poll" },
      );
      setPollDraft(null);
      playSendSound();
      setTimeout(() => scrollToBottom("smooth"), 50);
    } catch (err) {
      showToast(
        err.response?.data?.error || err.message || "Failed to create poll",
        "error",
      );
    }
  }

  async function submitEventDraft(e) {
    e?.preventDefault?.();
    if (!eventDraft || !selected || selected.type !== "group") return;
    if (!eventDraft.title.trim()) {
      showToast("Event needs a title", "error");
      return;
    }
    try {
      await sendGroupPayload(encodeEvent(eventDraft), { kind: "event" });
      setEventDraft(null);
      playSendSound();
      setTimeout(() => scrollToBottom("smooth"), 50);
    } catch (err) {
      showToast(
        err.response?.data?.error || err.message || "Failed to create event",
        "error",
      );
    }
  }

  function mergeUpdatedGroup(group) {
    const groupId = group?.id || group?._id;
    if (!groupId) return;
    activityStore.appendEvent({
      id: `updated:${groupId}`,
      type: "group",
      targetId: groupId,
      groupId,
      groupName: group.name,
      action: "updated",
      actorId: user?.id,
      actorLabel: "you",
      actorIsCurrentUser: true,
    });
    setGroups((prev) =>
      prev.map((g) => (String(g.id) === String(group.id) ? group : g)),
    );
    setSelected((prev) => {
      if (
        !prev ||
        prev.type !== "group" ||
        String(prev.id) !== String(group.id)
      )
        return prev;
      const memberCount = (group.members || []).length;
      const desc = (group.description || "").trim();
      return {
        ...prev,
        group,
        title: group.name || prev.title,
        subtitle: desc
          ? desc.slice(0, 60) + (desc.length > 60 ? "…" : "")
          : `${memberCount} member${memberCount === 1 ? "" : "s"}`,
      };
    });
    setPinnedIds((group.pinnedMessageIds || []).map(String));
  }

  function handleLeftOrDeletedGroup(groupId) {
    const group = groupsRef.current.find((g) => String(g.id || g._id) === String(groupId));
    if (groupId) {
      activityStore.appendEvent({
        id: `deleted:${groupId}`,
        type: "group",
        targetId: groupId,
        groupId,
        groupName: group?.name,
        action: "deleted",
        actorId: user?.id,
        actorLabel: "you",
        actorIsCurrentUser: true,
      });
    }
    setGroups((prev) => prev.filter((g) => String(g.id) !== String(groupId)));
    if (selected?.type === "group" && String(selected.id) === String(groupId)) {
      applyConversationSelection(null);
    }
    setShowGroupSettings(false);
    setShowCommandCenter(false);
    setProfileUserId(null);
  }

  const headerOnline = useMemo(() => {
    if (!selected || selected.type !== "dm") return false;
    if (selected.isSelfChat || String(selected.id) === String(user.id))
      return false;
    // Trust live presence only — lastLoginAt must not imply online.
    return onlineUserIds.has(String(selected.id));
  }, [selected, onlineUserIds, user.id]);

  const visibleMessages = useMemo(() => {
    const deleted = new Set(deletedForMeIds.map(String));
    return messages.filter((m) => !deleted.has(String(m.id || m._id)));
  }, [messages, deletedForMeIds, extrasTick]);

  const pinnedMessages = useMemo(() => {
    const set = new Set(pinnedIds.map(String));
    return visibleMessages.filter((m) => set.has(String(m.id || m._id)));
  }, [visibleMessages, pinnedIds]);

  // Build message list with date separators
  const messagesWithSeparators = useMemo(() => {
    const items = [];
    visibleMessages.forEach((m, i) => {
      const prev = visibleMessages[i - 1];
      if (!prev || !isSameDay(prev.createdAt, m.createdAt)) {
        const d = new Date(m.createdAt);
        const dayKey = Number.isNaN(d.getTime())
          ? `sep-${i}`
          : `sep-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        items.push({
          type: "separator",
          date: m.createdAt,
          key: dayKey,
        });
      }
      items.push({ type: "message", data: m, key: m.id || m._id });
    });
    return items;
  }, [visibleMessages]);

  // Floating chat bubbles for empty state
  const floatingBubbles = useMemo(() => {
    const sizes = [28, 22, 32, 18, 26];
    return sizes.map((size, i) => (
      <div key={i} className="chat-empty-floater">
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
    ));
  }, []);

  return (
    <ChatShell
      threadOpen={Boolean(selected)}
      infoOpen={infoPanelOpen && Boolean(selected) && !isCompactChrome}
      aiOpen={aiPanelOpen}
    >
      <ConversationPane
        user={user}
        canChat={canChat}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        onSettings={() => {
          setShowSettings(true);
          navigate("/chat/settings");
        }}
        onLogout={handleLogout}
        onMarkAllRead={handleMarkAllRead}
        vaultEnabled={vaultEnabled}
        vaultUnlocked={vaultUnlocked}
        onOpenVault={() => {
          if (!vaultEnabled) {
            setShowVaultSetup(true);
            return;
          }
          if (vaultUnlocked) {
            lockVault();
            showToast("Vault locked", "info");
            return;
          }
          setShowVaultUnlock(true);
        }}
        storiesRailRef={storiesRailRef}
        users={users}
        onStoriesError={(msg) => {
          const text = String(msg || 'Something went wrong with your status');
          setError(text);
          showToast(text, 'error');
        }}
        notifSettings={notifSettings}
        search={search}
        onSearchChange={setSearch}
        conversations={conversations}
        filter={filter}
        onFilterChange={setFilter}
        selectedKey={selected?.key}
        onSelect={handleSelectConversation}
        onCreateGroup={() => setShowCreateGroup(true)}
        onDiscoverJoin={handleDiscoverJoin}
        onHide={handleHideChat}
        onBlock={handleBlockUser}
        onMute={(c) => {
          const wasMuted = mutedKeys.map(String).includes(String(c.key));
          setMutedKeys(toggleMuteChat(user.id, c.key));
          const payload = c.type === "group" ? { groupId: c.id } : { peerId: c.id };
          const request = wasMuted
            ? unmuteChat(payload)
            : muteChat({ ...payload, duration: "always" });
          request.catch(() => {
            // Local toggle already reflects the change; server sync failed silently.
            // It will resync from server data on next login/session refresh.
          });
        }}
        onArchive={(c) => {
          setArchivedKeys(toggleArchiveChat(user.id, c.key));
        }}
        onPin={(c) => {
          setPinnedChatKeys(togglePinChat(user.id, c.key));
          showToast(c.pinned ? "Chat unpinned" : "Chat pinned", "info");
        }}
        onToggleVault={(c) => handleToggleVault(c.id)}
        loadingUsers={loadingUsers}
        hasMoreContacts={!searchResults && (usersHasMore || groupsHasMore)}
        onLoadMoreContacts={loadMoreContacts}
        friendCandidates={friendCandidates}
        friendCandidatesLoading={friendCandidatesLoading}
        incomingRequests={incomingRequests}
        outgoingRequests={outgoingRequests}
        myFriends={myFriends}
        myFriendsLoading={myFriendsLoading}
        contactQuery={contactQuery}
        onContactQueryChange={(value) => {
          setContactQuery(value);
          setContactLookupError("");
          if (contactLookupResult) setContactLookupResult(null);
        }}
        contactLookupResult={contactLookupResult}
        contactLookupLoading={contactLookupLoading}
        contactLookupError={contactLookupError}
        onLookupContact={handleLookupContact}
        onSendFriendRequest={handleSendFriendRequest}
        onCancelFriendRequest={handleCancelFriendRequest}
        onAcceptFriendRequest={handleAcceptFriendRequest}
        onDeclineFriendRequest={handleDeclineFriendRequest}
        onOpenFriend={(friend) => {
          const key = conversationKeyForUser(friend.id);
          handleSelectConversation({
            key,
            type: "dm",
            id: friend.id,
            title: friend.displayName || friend.username || "Friend",
            subtitle: null,
            peer: friend,
            muted: isChatMuted(user.id, key),
            archived: false,
            online: onlineUserIds.has(String(friend.id)),
          });
        }}
        onlineUserIds={onlineUserIds}
        onOpenStarred={() => {
          setStarredScope('all');
          setShowStarredMessages(true);
        }}
      />

      <main
        className="chat-main"
        onDragEnter={
          canChat &&
            selected &&
            (selected.type === "dm" || selected.type === "group")
            ? handleDragEnter
            : undefined
        }
        onDragLeave={
          canChat &&
            selected &&
            (selected.type === "dm" || selected.type === "group")
            ? handleDragLeave
            : undefined
        }
        onDragOver={
          canChat &&
            selected &&
            (selected.type === "dm" || selected.type === "group")
            ? handleDragOver
            : undefined
        }
        onDrop={
          canChat &&
            selected &&
            (selected.type === "dm" || selected.type === "group")
            ? handleDrop
            : undefined
        }
        style={selected ? themeStyle : undefined}
      >
        {canChat && selected && themeStyle['--chat-wallpaper'] && (
          <div
            className="chat-wallpaper-layer"
            data-wallpaper-fx={getWallpaperFx(chatTheme.wallpaperId) || undefined}
            aria-hidden="true"
          />
        )}
        {!canChat && (
          <div className="key-unlock">
            <div className="key-unlock-card">
              <div className="key-unlock-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h2 className="key-unlock-title">Unlock your encryption keys</h2>
              <p className="key-unlock-copy">
                This browser does not have keys for{" "}
                <strong>
                  {user?.username || user?.email || "this account"}
                </strong>{" "}
                yet. Import your <strong>keys.txt</strong> once — they stay on
                this device, so you will not be asked again on the next login.
                Keys from another account will be rejected.
              </p>
              {importError && <div className="auth-error">{importError}</div>}
              <div className="key-unlock-actions">
                <button
                  type="button"
                  className="key-unlock-primary"
                  onClick={() => keyFileInputRef.current?.click()}
                >
                  Import keys.txt for this account
                </button>
                <input
                  ref={keyFileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  hidden
                  onChange={handleImportKeyFile}
                />
                <button
                  type="button"
                  className="key-unlock-secondary"
                  onClick={requestGenerateKeys}
                >
                  Lost your keys? Generate new set
                </button>
              </div>
              <p className="key-unlock-hint">
                Generating new keys keeps you chatting, but messages encrypted
                with your old keys stay unreadable.
              </p>
            </div>
          </div>
        )}

        {canChat && (
          <>
            {keyringNeedsResync && (
              <div className="email-verify-banner key-sync-banner">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    flex: 1,
                  }}
                >
                  <span>
                    Your local encryption keys do not match the public keys
                    stored on the server ({keyringSync?.localMatchCount ?? 0}/
                    {keyringSync?.serverKeys?.length ?? 5} matched). Sealed
                    stories and new messages may fail to decrypt until you
                    resync.
                  </span>
                  <button
                    type="button"
                    className="email-verify-banner-btn"
                    onClick={requestGenerateKeys}
                  >
                    Regenerate &amp; resync keys
                  </button>
                </div>
              </div>
            )}
            {user && !user.emailVerified && !emailBannerDismissed && (
              <div className="email-verify-banner email-verify-banner-dismissible">
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span>Verify your email</span>
                  <button
                    type="button"
                    className="email-verify-banner-btn"
                    onClick={async () => {
                      try {
                        const { data } = await client.post(
                          "/auth/resend-verification",
                        );
                        const verifyUrl = data?.data?.verifyUrl;
                        showToast(
                          verifyUrl
                            ? `Verification link: ${verifyUrl}`
                            : "Verification email sent",
                          verifyUrl ? "info" : "success",
                        );
                      } catch (err) {
                        showToast(
                          err.response?.data?.error ||
                          "Could not resend verification",
                          "error",
                        );
                      }
                    }}
                  >
                    Resend
                  </button>
                </div>
                <button
                  type="button"
                  className="email-verify-banner-dismiss"
                  onClick={() => setEmailBannerDismissed(true)}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {user && user.moderation?.status === 'flagged' && !moderationBannerDismissed && (
              <div className="email-verify-banner email-verify-banner-dismissible moderation-warning-banner">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>
                    Your account has been reported by multiple people. Continued violations of
                    community guidelines may result in restrictions.
                  </span>
                </div>
                <button
                  type="button"
                  className="email-verify-banner-dismiss"
                  onClick={() => setModerationBannerDismissed(true)}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <header className="chat-header">
              <div className="chat-header-left">
                <button
                  type="button"
                  className="mobile-back-btn"
                  onClick={handleBackToList}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
                </button>
                {selected ? (
                  <div
                    className={`chat-header-peer${selected.type === "group" ||
                      (selected.type === "dm" &&
                        !selected.isSelfChat &&
                        String(selected.id) !== String(user.id))
                      ? " clickable"
                      : ""
                      }`}
                    role={
                      selected.type === "group" ||
                        (selected.type === "dm" &&
                          !selected.isSelfChat &&
                          String(selected.id) !== String(user.id))
                        ? "button"
                        : undefined
                    }
                    tabIndex={
                      selected.type === "group" ||
                        (selected.type === "dm" &&
                          !selected.isSelfChat &&
                          String(selected.id) !== String(user.id))
                        ? 0
                        : undefined
                    }
                    onClick={
                      selected.type === "group"
                        ? () => setShowGroupSettings(true)
                        : selected.type === "dm" &&
                          !selected.isSelfChat &&
                          String(selected.id) !== String(user.id)
                          ? () => setProfileUserId(selected.id)
                          : undefined
                    }
                    onKeyDown={
                      selected.type === "group" ||
                        (selected.type === "dm" &&
                          !selected.isSelfChat &&
                          String(selected.id) !== String(user.id))
                        ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (selected.type === "group")
                              setShowGroupSettings(true);
                            else setProfileUserId(selected.id);
                          }
                        }
                        : undefined
                    }
                    title={
                      selected.type === "dm" &&
                        !selected.isSelfChat &&
                        String(selected.id) !== String(user.id)
                        ? "View profile"
                        : selected.type === "group"
                          ? "Group settings"
                          : undefined
                    }
                  >
                    {selected.type === "group" ? (
                      <span className="avatar group-avatar chat-header-avatar">
                        <Users size={18} strokeWidth={2} aria-hidden="true" />
                      </span>
                    ) : selected.isSelfChat ||
                      String(selected.id) === String(user.id) ? (
                      <span className="avatar group-avatar chat-header-avatar self-chat-avatar">
                        <Bookmark
                          size={18}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </span>
                    ) : (
                      <span className="chat-header-avatar-wrap">
                        <UserAvatar
                          userId={selected.id}
                          name={title}
                          hasAvatar={Boolean(resolveDmPeer(selected)?.hasAvatar)}
                          className="chat-header-avatar"
                        />
                        {headerOnline && (
                          <span className="online-dot" aria-hidden="true" />
                        )}
                      </span>
                    )}
                    <div className="chat-header-text">
                      <span className="chat-header-title">
                        {title}
                        {screenshotProtectionOn ? (
                          <span className="chat-screenshot-shield" title="Screenshot protection is active in this chat">
                            Protected
                          </span>
                        ) : null}
                      </span>
                      {headerSubtitle && (
                        <span
                          className={`chat-header-status ${headerOnline ? "status-online" : ""}`}
                        >
                          {headerSubtitle}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="chat-header-title muted">{title}</span>
                )}
              </div>
              <div className="chat-header-actions">
                {selected?.type === "dm" &&
                  !selected?.isSelfChat &&
                  String(selected?.id) !== String(user.id) &&
                  !selected?.peer?.isSystemUser &&
                  selected?.peer?.systemRole !== "quantum_ai" && (
                    <>


                      <button
                        className="icon-btn"
                        type="button"
                        title="Voice call"
                        aria-label="Voice call"
                        onClick={() => handleStartCall(false)}
                      >
                        <Phone size={18} strokeWidth={2} aria-hidden="true" />
                      </button>
                      <button
                        className="icon-btn"
                        type="button"
                        title="Video call"
                        aria-label="Video call"
                        onClick={() => handleStartCall(true)}
                      >
                        <Video size={18} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </>
                  )}
                {selected?.type === "group" && (
                  <>
                    <button
                      className="icon-btn"
                      type="button"
                      title="Start voice meeting"
                      aria-label="Start voice meeting"
                      onClick={() => handleStartMeeting(false)}
                    >
                      <Phone size={18} strokeWidth={2} aria-hidden="true" />
                    </button>
                    <button
                      className="icon-btn"
                      type="button"
                      title="Start video meeting"
                      aria-label="Start video meeting"
                      onClick={() => handleStartMeeting(true)}
                    >
                      <Video size={18} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </>
                )}
                {aiBusy && (
                  <button
                    className="icon-btn active"
                    type="button"
                    onClick={() => aiAbortRef.current?.abort()}
                    title="Stop QuantumAI"
                  >
                    <Square size={17} />
                  </button>
                )}
                <button
                  className={`icon-btn accent chat-header-action-secondary${aiPanelOpen ? " active" : ""}`}
                  type="button"
                  onClick={() => setAiPanelOpen((open) => !open)}
                  title="Open QuantumAI"
                  aria-label="Open QuantumAI"
                  aria-pressed={aiPanelOpen}
                >
                  <MessageSquare size={18} strokeWidth={2} aria-hidden="true" />
                </button>
                {selected?.type === "group" && (
                  <>
                    <button
                      className="icon-btn chat-header-action-secondary"
                      onClick={() => setShowCommandCenter(true)}
                      title="Command Center"
                      aria-label="Command Center"
                    >
                      <LayoutDashboard size={18} strokeWidth={2} aria-hidden="true" />
                    </button>
                    <button
                      className="icon-btn chat-header-action-secondary"
                      onClick={() => setShowGroupSettings(true)}
                      title="Group settings"
                      aria-label="Group settings"
                    >
                      <Settings2 size={18} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </>
                )}
                {selected && (
                  <button
                    className={`icon-btn chat-header-action-secondary${infoPanelOpen ? " active" : ""}`}
                    onClick={toggleInfoPanel}
                    title="Chat details"
                    aria-label="Chat details"
                    aria-pressed={infoPanelOpen}
                  >
                    <Info size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
                {selected && (
                  <ChatOptionsMenu
                    isGroup={selected.type === "group"}
                    isBlocked={(user.blockedUsers || [])
                      .map(String)
                      .includes(String(selected.id))}
                    isMuted={mutedKeys
                      .map(String)
                      .includes(String(selected.key))}
                    isVaulted={
                      selected.type === "dm" &&
                      !selected.isSelfChat &&
                      isPeerVaulted(selected.id)
                    }
                    compactExtras={isCompactChrome}
                    onOpenAi={() => setAiPanelOpen((open) => !open)}
                    onOpenInfo={toggleInfoPanel}
                    onOpenGroupSettings={
                      selected.type === "group"
                        ? () => setShowGroupSettings(true)
                        : undefined
                    }
                    onOpenCommandCenter={
                      selected.type === "group"
                        ? () => setShowCommandCenter(true)
                        : undefined
                    }
                    onToggleVault={
                      selected.type === "dm" && !selected.isSelfChat
                        ? () => handleToggleVault(selected.id)
                        : undefined
                    }
                    onToggleBlock={() => {
                      const isBlocked = (user.blockedUsers || [])
                        .map(String)
                        .includes(String(selected.id));
                      if (isBlocked) handleUnblockUser(selected.id);
                      else handleBlockUser(resolveDmPeer(selected));
                    }}
                    onToggleMute={() => {
                      const wasMuted = mutedKeys
                        .map(String)
                        .includes(String(selected.key));
                      setMutedKeys(toggleMuteChat(user.id, selected.key));
                      const payload =
                        selected.type === "group"
                          ? { groupId: selected.id }
                          : { peerId: selected.id };
                      const request = wasMuted
                        ? unmuteChat(payload)
                        : muteChat({ ...payload, duration: "always" });
                      request.catch(() => { });
                    }}
                    onClearChat={handleClearChat}
                    onSearch={() => setSearchOpen(true)}
                    onWallpaper={
  selected.type === "group" || (selected.type === "dm" && !selected.isSelfChat)
    ? () => setThemeModalOpen(true)
    : undefined
}
                    onStarred={() => {
                      setStarredScope("chat");
                      setShowStarredMessages(true);
                    }}
                    onMedia={() => setShowChatMedia(true)}
                  />
                )}
              </div>
            </header>

            {searchOpen && selected && (
              <MessageSearch
                messages={visibleMessages.map((m) => ({
                  id: m.id || m._id,
                  text: m.text,
                  timestamp: m.createdAt,
                }))}
                onResultSelect={handleSearchResult}
                isOpen={searchOpen}
                onClose={() => setSearchOpen(false)}
              />
            )}

            {!selected ? (
              <ChatEmptyState
                variant="welcome"
                title="Pick a conversation"
                copy="Choose someone from the sidebar, open Friends to connect, or start a new group. Messages stay end-to-end encrypted on your device."
                actionLabel="New group"
                onAction={() => setShowCreateGroup(true)}
              />
            ) : (
              <>
                {pinnedMessages.length > 0 && (
                  <div className="pinned-messages-bar">
                    {pinnedMessages.slice(0, 3).map((m) => (
                      <button
                        key={m.id || m._id}
                        type="button"
                        className="pinned-message-chip"
                        onClick={() => handleSearchResult(m.id || m._id)}
                      >
                        <Pin size={12} />
                        <span>
                          {getMessagePreviewText(m) ||
                            (m.attachment ? "Attachment" : "Pinned message")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {isDragging && (
                  <DragDropOverlay
                    isVisible={true}
                    onFileDrop={queueAttachmentFiles}
                  />
                )}

                <AnimatePresence mode="wait">
                  <motion.div
                    key={selected.key}
                    className="message-list"
                    ref={messageListRef}
                    onScroll={handleScroll}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {loadingOlder && (
                      <div className="load-older-hint">
                        Loading earlier messages…
                      </div>
                    )}
                    {hasMoreMessages && !loadingOlder && (
                      <button
                        type="button"
                        className="load-older-btn"
                        onClick={loadOlderMessages}
                      >
                        Load earlier messages
                      </button>
                    )}
                    {loadingMessages ? (
                      <>
                        <div className="skeleton-message-bubble theirs skeleton" />
                        <div className="skeleton-message-bubble mine skeleton" />
                        <div
                          className="skeleton-message-bubble theirs skeleton"
                          style={{ width: "45%" }}
                        />
                        <div
                          className="skeleton-message-bubble mine skeleton"
                          style={{ width: "35%" }}
                        />
                      </>
                    ) : messagesWithSeparators.length === 0 ? (
                      <div className="thread-empty-state" role="status">
                        <MessageSquare
                          size={22}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        <p className="thread-empty-title">No messages yet</p>
                        <p className="thread-empty-copy">
                          Say hello — your message is sealed before it leaves
                          this device.
                        </p>
                      </div>
                    ) : (
                      messagesWithSeparators.map((item, index) => {
                        if (item.type === "separator") {
                          return (
                            <DateSeparator key={item.key} date={item.date} />
                          );
                        }

                        const m = item.data;
                        const prevMsg =
                          index > 0 &&
                            messagesWithSeparators[index - 1].type === "message"
                            ? messagesWithSeparators[index - 1].data
                            : null;
                        const isGrouped =
                          prevMsg &&
                          String(prevMsg.from) === String(m.from) &&
                          new Date(m.createdAt) - new Date(prevMsg.createdAt) <
                          120000;
                        const mid = String(m.id || m._id);

                        return (
                          <div
                            key={item.key}
                            id={`msg-${mid}`}
                            className="message-item"
                          >
                            <SwipeableMessage
                              message={m}
                              isMine={String(m.from) === String(user.id)}
                              onReply={(msg) => {
                                setEditingMessage(null);
                                setReplyTo(msg);
                                textareaRef.current?.focus();
                              }}
                              onLongPress={(msg) => setActionSheetMessage(msg)}
                              onDoubleTap={(msg) => {
                                // Double-click / double-tap = reply only (not a quick reaction)
                                setEditingMessage(null);
                                setReplyTo(msg);
                                textareaRef.current?.focus();
                              }}
                              currentUserId={user.id}
                              resolveSecretKey={resolveMySecretKey}
                              grouped={isGrouped}
                              starred={starredIds.map(String).includes(mid)}
                              important={importantEntries.some((entry) => String(entry.id || entry._id) === mid)}
                              pinned={pinnedIds.map(String).includes(mid)}
                              showReadReceipts={
                                user.privacy?.readReceipts !== false &&
                                user.privacy?.readReceipts !== 'nobody'
                              }
                              groupRecipientCount={
                                isGroupChat && activeGroup?.members
                                  ? activeGroup.members.filter(
                                    (gm) => String(gm._id || gm.id || gm) !== String(user.id),
                                  ).length
                                  : undefined
                              }
                              senderLabel={
                                isGroupChat
                                  ? usernameById.get(String(m.from)) || "Member"
                                  : undefined
                              }
                              replyPreview={
                                m.replyTo
                                  ? {
                                    label:
                                      usernameById.get(
                                        String(m.replyTo.from),
                                      ) || "Message",
                                    text:
                                      getMessagePreviewText(m.replyTo) ||
                                      (m.replyTo.attachment ? "[Attachment]" : "[encrypted]"),
                                  }
                                  : null
                              }
                              onDelete={handleDeleteMessage}
                              onDeleteForMe={handleDeleteForMe}
                              onReact={(id, emoji) => {
                                if (emoji) setLastQuickReaction(emoji);
                                handleReactMessage(id, emoji);
                              }}
                              onCopy={handleCopyMessage}
                              onForward={setForwardMessage}
                              onStar={handleStarMessage}
                              onImportant={handleImportantMessage}
                              onPin={handlePinMessage}
                              onVotePoll={
                                isGroupChat ? handleVotePoll : undefined
                              }
                              onJumpToReply={handleJumpToReply}
                              onImagePreview={handleImagePreview}
                              onImageReady={handleImageReady}
                              onVideoPreview={handleVideoPreview}
                              onVideoReady={handleVideoReady}
                              onBurnViewOnce={handleBurnViewOnce}
                              onShowInfo={handleShowMessageInfo}
                              onShowEditHistory={handleShowEditHistory}
                              onOpenStory={(storyId) =>
                                storiesRailRef.current?.openStoryById(storyId)
                              }
                              onEdit={
                                m.text &&
                                  !String(m.text).trim().startsWith('{"__qc')
                                  ? (msg) => {
                                    setReplyTo(null);
                                    setEditingMessage(msg);
                                    setDraft(msg.text || "");
                                  }
                                  : undefined
                              }
                            />
                          </div>
                        );
                      })
                    )}
  <TypingIndicator
  isTyping={peerTyping && selected.type === "dm"}
  username={selected.title}
  usernames={selected.type === "group" ? groupTypingUsers : []}
  />
                    <div ref={bottomRef} />
                  </motion.div>
                </AnimatePresence>

                {hasUnread && (
                  <button
                    className="scroll-bottom-pill"
                    onClick={() => scrollToBottom("smooth")}
                    aria-label="Scroll to bottom to view new messages"
                  >
                    <span>New messages</span>
                    <ArrowDown size={16} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                )}

                {selected?.type === "dm" &&
                  !selected.isSelfChat &&
                  String(selected.id) !== String(user.id) &&
                  !selected.peer?.isSystemUser &&
                  (() => {
                    const vaultedLocked = !vaultUnlocked && isPeerVaulted(selected.id);
                    const isRealFriend = isFriendWith(selected.id);

                    if (!vaultedLocked && isRealFriend) return null;

                    if (vaultedLocked) {
                      // Decoy view: always "not friends", regardless of the
                      // real relationship. Does NOT call the real
                      // friend-request API — clicking it must not mutate
                      // actual friend state while impersonating the locked
                      // decoy thread.
                      return (
                        <div className="composer-context" style={{ margin: "0 16px 8px" }}>
                          <div className="composer-context-copy">
                            <strong>Not friends yet</strong>
                            <span>Add {title} as a friend</span>
                          </div>
                          <button
                            type="button"
                            className="friend-action-btn add"
                            onClick={() => showToast("Friend request sent", "success")}
                          >
                            Add Friend
                          </button>
                        </div>
                      );
                    }

                    const pending = outgoingRequests.find(
                      (r) => String(r.user.id) === String(selected.id)
                    );
                    return (
                      <div className="composer-context" style={{ margin: "0 16px 8px" }}>
                        <div className="composer-context-copy">
                          <strong>Not friends yet</strong>
                          <span>Add {title} as a friend</span>
                        </div>
                        {pending ? (
                          <button
                            type="button"
                            className="friend-action-btn cancel"
                            onClick={() => handleCancelFriendRequest(pending.id)}
                          >
                            Cancel request
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="friend-action-btn add"
                            onClick={() => handleSendFriendRequest(selected.id)}
                          >
                            Add Friend
                          </button>
                        )}
                      </div>
                    );
                  })()}

                {recording ? (
                  <div className="composer composer-recording">
                    <button
                      type="button"
                      className="attach-button voice-cancel-btn"
                      onClick={cancelVoiceRecording}
                      aria-label="Cancel voice note"
                    >
                      <X size={20} strokeWidth={2} aria-hidden="true" />
                    </button>
                    <div className="voice-recording-status">
                      <span className="voice-recording-dot" />
                      <span>Recording {formatVoiceTimer(recordSeconds)}</span>
                      <span className="voice-recording-hint">
                        max {MAX_VOICE_SECONDS}s
                      </span>
                    </div>
                    <button
                      type="button"
                      className="send-button voice-stop-btn"
                      onClick={stopVoiceRecording}
                      aria-label="Send voice note"
                    >
                      <Square
                        size={16}
                        fill="currentColor"
                        strokeWidth={0}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                ) : !canPostInGroup ? (
                  <div className="composer-shell">
                    <div
                      className="composer-hint"
                      style={{ justifyContent: "center", padding: "14px" }}
                    >
                      Only admins can post in this group
                    </div>
                  </div>
                ) : (
                  <div className="composer-shell">
                    {showEmojiPicker && (
                      <EmojiPicker
                        onPick={insertEmoji}
                        onClose={() => setShowEmojiPicker(false)}
                      />
                    )}
                    {(replyTo || editingMessage) && (
                      <div className="composer-context">
                        <div className="composer-context-copy">
                          <strong>
                            {editingMessage ? "Editing message" : "Replying to"}
                          </strong>
                          <span>
                            {editingMessage
                              ? getMessagePreviewText(editingMessage) || ""
                              : getMessagePreviewText(replyTo) ||
                                (replyTo?.attachment ? "[Attachment]" : "[encrypted message]")}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="composer-context-close"
                          aria-label="Cancel"
                          onClick={() => {
                            setReplyTo(null);
                            setEditingMessage(null);
                            setPendingAnnouncement(false);
                            if (editingMessage) setDraft("");
                          }}
                        >
                          <X size={16} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                    {pendingAnnouncement && !replyTo && !editingMessage && (
                      <div className="composer-context">
                        <div className="composer-context-copy">
                          <strong>Announcement</strong>
                          <span>Next send will post as an announcement</span>
                        </div>
                        <button
                          type="button"
                          className="composer-context-close"
                          aria-label="Cancel announcement mode"
                          onClick={() => setPendingAnnouncement(false)}
                        >
                          <X size={16} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                    {mentionOpen && mentionSuggestions.length > 0 && (
                      <div
                        className="composer-context"
                        style={{
                          flexDirection: "column",
                          alignItems: "stretch",
                          gap: 4,
                        }}
                      >
                        {mentionSuggestions.map((m) => {
                          const reason = mentionBlockReason(m);
                          const blocked = Boolean(reason);
                          return (
                            <button
                              key={memberId(m)}
                              type="button"
                              className="composer-context-close"
                              style={{
                                width: "100%",
                                justifyContent: "space-between",
                                display: "flex",
                                alignItems: "center",
                                borderRadius: 8,
                                padding: "6px 10px",
                                fontSize: 13,
                                opacity: blocked ? 0.55 : 1,
                                cursor: blocked ? "not-allowed" : "pointer",
                              }}
                              disabled={blocked}
                              onClick={() => {
                                if (blocked) return;
                                insertMention(m.username);
                              }}
                            >
                              <span>@{m.username}</span>
                              {blocked && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "var(--warning-text, #fbbf24)",
                                  }}
                                >
                                  {reason === "mentions_off"
                                    ? "Mentions off"
                                    : "Admins only"}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="composer-tools-bar qc-composer-tools-slim">
                      <button
                        type="button"
                        className={`composer-tools-btn ${composerHelpOpen ? "active" : ""}`}
                        onClick={() => setComposerHelpOpen((v) => !v)}
                        aria-label="Keyboard shortcuts"
                      >
                        <HelpCircle size={16} />
                      </button>
                      {composerHelpOpen && (
                        <div className="composer-help-popover">
                          <span>
                            <kbd>Enter</kbd> send
                          </span>
                          <span>
                            <kbd>Shift</kbd>+<kbd>Enter</kbd> new line
                          </span>
                          <span>
                            <kbd>Ctrl</kbd>+<kbd>V</kbd> paste image
                          </span>
                        </div>
                      )}
                    </div>
                    <form
                      className="composer"
                      onSubmit={handleSend}
                      style={{ position: "relative" }}
                    >
                      <button
                        type="button"
                        className={`attach-button ${composerPlusOpen ? "active" : ""}`}
                        onClick={() => setComposerPlusOpen(true)}
                        aria-label="More message actions"
                        disabled={sendingVoice || uploads.length > 0}
                      >
                        <Plus size={20} strokeWidth={2} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`attach-button ${showEmojiPicker ? "active" : ""}`}
                        onClick={() => setShowEmojiPicker((v) => !v)}
                        aria-label="Open emoji picker"
                        disabled={sendingVoice}
                      >
                        <Smile size={20} strokeWidth={2} aria-hidden="true" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        hidden
                        multiple
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.odt,.rtf,.zip,.rar,.7z,.txt,.csv,.json"
                        onChange={handleFileChange}
                      />
                      <textarea
                        ref={textareaRef}
                        dir="auto"
                        placeholder={
                          sendingVoice
                            ? t('chat.sendingVoice', 'Sending voice note…')
                            : uploads.length
                              ? t('chat.placeholderUploading', 'Uploading encrypted file…')
                              : pendingAnnouncement
                                ? t('chat.placeholderAnnouncement', 'Write an announcement…')
                                : isGroupChat
                                  ? t('chat.placeholderGroup', 'Type an encrypted group message… @mention')
                                  : selected?.isSelfChat ||
                                    String(selected?.id) === String(user.id)
                                    ? t('chat.placeholderSelf', 'Write a note to yourself…')
                                    : t('chat.placeholderDirect', 'Type an encrypted message…')
                        }
                        value={draft}
                        onChange={handleDraftChange}
                        onInput={handleTextareaInput}
                        onKeyDown={handleTextareaKeyDown}
                        onPaste={handlePaste}
                        aria-label={t('chat.placeholderDirect', 'Type message body')}
                        disabled={sendingVoice}
                        rows={1}
                      />
                      {draft.trim() ? (
                        <button
                          type="submit"
                          className="send-button"
                          aria-label="Send encrypted message"
                          disabled={sendingVoice}
                        >
                          <Send size={18} strokeWidth={2} aria-hidden="true" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="send-button voice-mic-btn"
                          onClick={startVoiceRecording}
                          aria-label="Record voice note"
                          disabled={sendingVoice || uploads.length > 0}
                        >
                          <Mic size={18} strokeWidth={2} aria-hidden="true" />
                        </button>
                      )}
                    </form>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
      {themeModalOpen && selected && (selected.type === "dm" || selected.type === "group") && (
  <ChatThemeModal
    peerId={selected.type === "dm" ? selected.id : undefined}
    groupId={selected.type === "group" ? selected.id : undefined}
    theme={chatTheme}
    catalog={themeCatalog}
    onApplied={(updated) => setChatTheme(updated)}
    onClose={() => setThemeModalOpen(false)}
  />
)}

      {aiPanelOpen && (
        <AIAssistantPanel
          conversation={selected}
          messages={messages}
          onClose={() => setAiPanelOpen(false)}
          onInsertDraft={(text) => {
            setDraft(text);
            setAiPanelOpen(false);
            textareaRef.current?.focus();
          }}
          onSaveEncryptedNote={saveEncryptedAINote}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        danger={confirmDialog?.danger}
        busy={confirmBusy}
        onCancel={closeConfirmDialog}
        onConfirm={handleConfirmDialog}
      />

      <ClearChatModal
        open={clearChatOpen && Boolean(selected)}
        busy={clearChatBusy}
        hasStarredInChat={
          selected ? getStarredEntries(user.id).some((e) => e.conversationKey === selected.key) : false
        }
        onCancel={() => !clearChatBusy && setClearChatOpen(false)}
        onConfirm={executeClearChatScoped}
      />

      <CallOverlay
        call={webrtc.call}
        localStream={webrtc.localStream}
        remoteStream={webrtc.remoteStream}
        screenStream={webrtc.screenStream}
        screenSharing={webrtc.screenSharing}
        remoteScreen={webrtc.remoteScreen}
        muted={webrtc.muted}
        cameraOff={webrtc.cameraOff}
        peerLabel={
          webrtc.call
            ? users.find((u) => String(u.id) === String(webrtc.call.peerId))
              ?.displayName ||
            users.find((u) => String(u.id) === String(webrtc.call.peerId))
              ?.username ||
            webrtc.call.peerName
            : ""
        }
        onAccept={() =>
          webrtc
            .acceptCall()
            .catch(() =>
              showToast("Could not access microphone/camera", "error"),
            )
        }
        onReject={webrtc.rejectCall}
        onHangup={webrtc.hangup}
        onToggleMute={webrtc.toggleMute}
        onToggleCamera={webrtc.toggleCamera}
        onToggleScreenShare={() =>
          webrtc.toggleScreenShare().catch((err) => {
            // Dismissing the browser's picker isn't an error worth reporting.
            if (err?.name === "NotAllowedError" || err?.name === "AbortError")
              return;
            showToast("Could not share your screen", "error");
          })
        }
        minimized={callMinimized}
        onToggleMinimize={(next) =>
          setCallMinimized((v) => (typeof next === "boolean" ? next : !v))
        }
        onOpenAddParticipant={() => setShowAddParticipantModal(true)}
      />

      <MeetingOverlay
        meeting={meetingCall.meeting}
        participants={meetingCall.participants}
        localStream={meetingCall.localStream}
        muted={meetingCall.muted}
        cameraOff={meetingCall.cameraOff}
        resolveParticipantName={(peerId) =>
          users.find((u) => String(u.id) === String(peerId))?.displayName ||
          users.find((u) => String(u.id) === String(peerId))?.username
        }
        onJoin={() =>
          meetingCall
            .joinMeeting()
            .catch(() =>
              showToast("Could not access microphone/camera", "error"),
            )
        }
        onDecline={meetingCall.declineMeeting}
        onLeave={meetingCall.leaveMeeting}
        onEndForAll={meetingCall.endMeetingForAll}
        onToggleMute={meetingCall.toggleMute}
        onToggleCamera={meetingCall.toggleCamera}
        onOpenAddParticipant={() => setShowAddParticipantModal(true)}
      />

      {showAddParticipantModal && (
        <AddParticipantModal
          users={users}
          currentParticipantIds={
            meetingCall.meeting
              ? [user?.id, ...Array.from(meetingCall.participants.keys())]
              : webrtc.call
                ? [user?.id, webrtc.call.peerId]
                : [user?.id]
          }
          onClose={() => setShowAddParticipantModal(false)}
          onAddParticipant={async (targetUser) => {
            try {
              if (meetingCall.meeting) {
                await meetingCall.inviteParticipant(targetUser);
                showToast(`Invited ${targetUser.displayName || targetUser.username} to call`, "success");
              } else if (webrtc.call) {
                const originalPeerId = webrtc.call.peerId;
                const originalPeerUser = users.find((u) => String(u.id) === String(originalPeerId));
                await meetingCall.startMeeting({
                  video: Boolean(webrtc.call.video),
                });
                await meetingCall.inviteParticipant({ id: originalPeerId, publicKeys: originalPeerUser?.publicKeys || [] });
                await meetingCall.inviteParticipant(targetUser);
                webrtc.hangup();
                showToast(`Created group meeting & invited ${targetUser.displayName || targetUser.username}`, "success");
              }
            } catch (err) {
              showToast("Could not invite participant", "error");
            }
          }}
        />
      )}

      {showCreateGroup && (
        <CreateGroupModal
          users={users}
          onClose={() => setShowCreateGroup(false)}
          onCreate={handleCreateGroup}
        />
      )}

      {showGroupSettings && activeGroup && (
  <GroupSettingsModal
    group={activeGroup}
    currentUserId={user.id}
    users={users}
    onClose={() => setShowGroupSettings(false)}
    onUpdated={mergeUpdatedGroup}
    onLeftOrDeleted={handleLeftOrDeletedGroup}
    onOpenChatTheme={() => {
      setShowGroupSettings(false);
      setThemeModalOpen(true);
    }}
  />
)}
      {showCommandCenter && activeGroup && (
        <GroupCommandCenter
          group={activeGroup}
          messages={messages}
          currentUserId={user.id}
          onClose={() => setShowCommandCenter(false)}
          onUpdated={mergeUpdatedGroup}
          onJumpToMessage={(messageId) => setPendingJumpMessageId(String(messageId))}
          onOpenGroupSettings={() => {
            setShowCommandCenter(false);
            setShowGroupSettings(true);
          }}
          onAskAiSummary={() => {
            setDraft(
              "@QuantumAI Please summarize this group: key announcements, open tasks, upcoming events, and recent decisions.",
            );
            setShowCommandCenter(false);
            showToast("Review the draft, then send to ask QuantumAI", "info");
          }}
        />
      )}
      {profileUserId && (
        <UserProfileModal
          userId={profileUserId}
          seed={
            (selected?.type === "dm" &&
              String(selected.id) === String(profileUserId) &&
              selected.peer) ||
            users.find((u) => String(u.id) === String(profileUserId)) ||
            null
          }
          online={onlineUserIds.has(String(profileUserId))}
          muted={isChatMuted(user.id, conversationKeyForUser(profileUserId))}
          archived={archivedKeys
            .map(String)
            .includes(String(conversationKeyForUser(profileUserId)))}
          isFriend={isFriendWith(profileUserId)}
          onRemoveFriend={async (peer) => {
            try {
              await client.delete(`/users/friends/${peer.id}`);
              try {
                const { data } = await client.get("/users/me");
                if (data?.data) updateSessionUser(data.data);
              } catch {
                // non-fatal
              }
              showToast("Friend removed", "success");
              setProfileUserId(null);
              loadDirectory();
              loadMyFriends();
              loadFriendDiscover(search);
            } catch (err) {
              showToast(
                err.response?.data?.error || "Failed to remove friend",
                "error",
              );
            }
          }}
          onMute={() => {
            const key = conversationKeyForUser(profileUserId);
            const wasMuted = mutedKeys.map(String).includes(String(key));
            setMutedKeys(toggleMuteChat(user.id, key));
            const request = wasMuted
              ? unmuteChat({ peerId: profileUserId })
              : muteChat({ peerId: profileUserId, duration: "always" });
            request
              .then((res) => {
                if (res?.data) updateSessionUser(res.data);
              })
              .catch(() => { });
          }}
          onArchive={() => {
            const key = conversationKeyForUser(profileUserId);
            setArchivedKeys(toggleArchiveChat(user.id, key));
          }}
          onHide={(peer) => {
            handleHideChat(peer);
            setProfileUserId(null);
            showToast("Chat hidden", "success");
          }}
          onBlock={(peer) => {
            setProfileUserId(null);
            handleBlockUser(peer);
          }}
          onOpenAiPanel={() => setAiPanelOpen(true)}
          onClose={() => setProfileUserId(null)}
          onLoaded={(data) => {
            if (!data?.id) return;
            setUsers((prev) => {
              const id = String(data.id);
              const idx = prev.findIndex((u) => String(u.id) === id);
              if (idx < 0) return prev;
              const next = [...prev];
              next[idx] = { ...next[idx], ...data };
              return next;
            });
            setSelected((cur) => {
              if (
                !cur ||
                cur.type !== "dm" ||
                String(cur.id) !== String(data.id)
              )
                return cur;
              return {
                ...cur,
                peer: { ...(cur.peer || {}), ...data },
                title: data.displayName || data.username || cur.title,
              };
            });
          }}
        />
      )}
      {showChatMedia && (
        <ChatMediaModal
          messages={visibleMessages}
          imageSrcMap={imageSrcMapRef.current}
          videoSrcMap={videoSrcMapRef.current}
          resolveSecretKey={resolveMySecretKey}
          onImageReady={handleImageReady}
          onVideoReady={handleVideoReady}
          onImageClick={(id) => {
            setShowChatMedia(false);
            handleImagePreview(id);
          }}
          onVideoClick={(id) => {
            setShowChatMedia(false);
            handleVideoPreview(id);
          }}
          onClose={() => setShowChatMedia(false)}
        />
      )}
      {pollDraft && (
        <div
          className="create-group-overlay"
          onClick={() => setPollDraft(null)}
        >
          <form
            className="create-group-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitPollDraft}
          >
            <div className="create-group-modal-header">
              <div className="create-group-modal-heading">
                <h2>Create poll</h2>
                <p>Question and options are encrypted end-to-end</p>
              </div>
              <button
                type="button"
                className="create-group-close"
                onClick={() => setPollDraft(null)}
              >
                <X size={18} />
              </button>
            </div>
            <label className="create-group-field">
              <span className="create-group-label">Question</span>
              <input
                className="create-group-input"
                value={pollDraft.question}
                onChange={(e) =>
                  setPollDraft((d) => ({ ...d, question: e.target.value }))
                }
                placeholder="Ask something…"
                autoFocus
              />
            </label>
            {(pollDraft.options || []).map((opt, idx) => (
              <label key={idx} className="create-group-field">
                <span className="create-group-label">Option {idx + 1}</span>
                <input
                  className="create-group-input"
                  value={opt}
                  onChange={(e) =>
                    setPollDraft((d) => {
                      const options = [...d.options];
                      options[idx] = e.target.value;
                      return { ...d, options };
                    })
                  }
                  placeholder={`Choice ${idx + 1}`}
                />
              </label>
            ))}
            <div className="create-group-actions">
              {(pollDraft.options || []).length < 4 && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setPollDraft((d) => ({ ...d, options: [...d.options, ""] }))
                  }
                >
                  Add option
                </button>
              )}
              <button type="submit" className="confirm-btn">
                Send poll
              </button>
            </div>
          </form>
        </div>
      )}

      {eventDraft && (
        <div
          className="create-group-overlay"
          onClick={() => setEventDraft(null)}
        >
          <form
            className="create-group-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitEventDraft}
          >
            <div className="create-group-modal-header">
              <div className="create-group-modal-heading">
                <h2>Create event</h2>
                <p>Details are sealed for group members only</p>
              </div>
              <button
                type="button"
                className="create-group-close"
                onClick={() => setEventDraft(null)}
              >
                <X size={18} />
              </button>
            </div>
            <label className="create-group-field">
              <span className="create-group-label">Title</span>
              <input
                className="create-group-input"
                value={eventDraft.title}
                onChange={(e) =>
                  setEventDraft((d) => ({ ...d, title: e.target.value }))
                }
                placeholder="Event name"
                autoFocus
              />
            </label>
            <label className="create-group-field">
              <span className="create-group-label">When</span>
              <input
                className="create-group-input"
                type="datetime-local"
                value={eventDraft.when}
                onChange={(e) =>
                  setEventDraft((d) => ({ ...d, when: e.target.value }))
                }
              />
            </label>
            <label className="create-group-field">
              <span className="create-group-label">Where</span>
              <input
                className="create-group-input"
                value={eventDraft.where}
                onChange={(e) =>
                  setEventDraft((d) => ({ ...d, where: e.target.value }))
                }
                placeholder="Location (optional)"
              />
            </label>
            <label className="create-group-field">
              <span className="create-group-label">Notes</span>
              <input
                className="create-group-input"
                value={eventDraft.notes}
                onChange={(e) =>
                  setEventDraft((d) => ({ ...d, notes: e.target.value }))
                }
                placeholder="Extra details (optional)"
              />
            </label>
            <div className="create-group-actions">
              <button type="submit" className="confirm-btn">
                Send event
              </button>
            </div>
          </form>
        </div>
      )}

      {showSettings && (
        <SettingsModal
          user={user}
          initialTab={settingsTab}
          className="qc-settings-sheet"
          onClose={() => {
            setShowSettings(false);
            if (isSettingsRoute) navigate(selected ? chatPathForSelection(selected) : "/chat");
          }}
          onImportKeys={handleImportKeyFile}
          onGenerateKeys={requestGenerateKeys}
          onUserUpdated={updateSessionUser}
          onLogout={() => {
            setShowSettings(false);
            handleLogout();
          }}
          onExportChat={() => {
            if (!selected || !messages.length) {
              showToast("Open a chat to export", "info");
              return;
            }
            const lines = visibleMessages
              .map((m) => {
                const who =
                  String(m.from) === String(user.id)
                    ? "You"
                    : usernameById.get(String(m.from)) || "User";
                return `[${new Date(m.createdAt).toLocaleString()}] ${who}: ${m.text || (m.attachment ? "[attachment]" : "[encrypted]")
                  }`;
              })
              .join("\n");
            const blob = new Blob([lines], { type: "text/plain" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `quantumchat-${selected.title || "chat"}.txt`;
            a.click();
            showToast("Chat exported from this device", "success");
          }}
        />
      )}

      {forwardMessage && (
        <ForwardModal
          conversations={conversations}
          busy={forwardBusy}
          onClose={() => !forwardBusy && setForwardMessage(null)}
          onForward={handleForwardToConversation}
        />
      )}
      {showVaultSetup && (
        <VaultSetupModal
          onClose={() => {
            setShowVaultSetup(false);
            setPendingVaultPeerId(null);
          }}
          onCreated={async () => {
            setShowVaultSetup(false);
            if (pendingVaultPeerId) {
              try {
                await addVaultPeer(pendingVaultPeerId);
                showToast("Added to vault", "success");
                if (
                  selected?.type === "dm" &&
                  String(selected.id) === String(pendingVaultPeerId)
                ) {
                  applyConversationSelection(null);
                }
              } catch (err) {
                showToast(
                  err.response?.data?.error || "Failed to add to vault",
                  "error",
                );
              }
            }
            setPendingVaultPeerId(null);
          }}
        />
      )}
      {showVaultUnlock && (
        <VaultUnlockModal
          onClose={() => setShowVaultUnlock(false)}
          onUnlocked={() => {
            setShowVaultUnlock(false);
            showToast("Vault unlocked", "success");
          }}
        />
      )}
      {showStarredMessages && (
        <StarredMessagesModal
          entries={
            (starredScope === 'chat' && selected
              ? [...importantEntries, ...getStarredEntries(user.id)].filter((e) => e.conversationKey === selected.key)
              : [...importantEntries, ...getStarredEntries(user.id)])
          }
          usernameById={usernameById}
          currentUserId={user.id}
          onSelect={handleOpenStarredEntry}
          onCopy={(entry) => {
            const text = entry?.text || (entry?.attachmentFilename ? `[${entry.attachmentFilename}]` : '');
            if (!text) return;
            navigator.clipboard?.writeText(text).then(
              () => showToast('Copied to clipboard', 'success'),
              () => showToast('Could not copy message', 'error'),
            );
          }}
          onUnstar={(id) => {
            const nextIds = toggleStarredMessage(user.id, { id }, null);
            setStarredIds(nextIds);
            setExtrasTick((n) => n + 1);
          }}
          onRemoveImportant={handleImportantMessage}
          loading={importantLoading}
          onClose={() => {
            setShowStarredMessages(false);
            setStarredScope('all');
          }}
        />
      )}
      {messageInfoData && (
        <MessageInfoModal
          data={messageInfoData}
          usernameById={usernameById}
          currentUserId={user.id}
          onSelectReply={handleSelectReplyFromInfo}
          onClose={() => setMessageInfoData(null)}
        />
      )}
      {editHistoryMessage && (
        <EditHistoryModal
          message={editHistoryMessage}
          currentUserId={user.id}
          resolveSecretKey={resolveMySecretKey}
          onClose={() => setEditHistoryMessage(null)}
        />
      )}
      {logoutConfirmOpen && (
        <ConfirmDialog
          open={logoutConfirmOpen}
          title="Log out of QuantumChat?"
          message="You will be signed out on this browser. Your encryption keys stay saved here, so you can log back in without importing keys.txt again."
          confirmLabel="Log out"
          cancelLabel="Stay"
          danger={true}
          onConfirm={confirmLogout}
          onCancel={() => setLogoutConfirmOpen(false)}
        />
      )}

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => {
          queueAttachmentFiles(file).catch((err) => {
            showToast(err.message || "Camera upload failed", "error");
          });
        }}
      />

      <TimeCapsuleModal
  open={showCapsulePicker}
  onCancel={() => setShowCapsulePicker(false)}
  onConfirm={(iso) => {
    setCapsuleUnlocksAt(iso);
    setShowCapsulePicker(false);
  }}
/>

      <ImageLightbox
        isOpen={Boolean(gallery)}
        items={gallery?.items || []}
        index={gallery?.index || 0}
        onIndexChange={(next) =>
          setGallery((g) => (g ? { ...g, index: next } : g))
        }
        onClose={() => setGallery(null)}
      />

      {videoPlayer && (
        <div
          className="lightbox-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setVideoPlayer(null)}
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setVideoPlayer(null)}
            aria-label="Close"
          >
            ✕
          </button>
          <video
            src={videoPlayer.src}
            controls
            autoPlay
            playsInline
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <MediaSendPreview
        open={Boolean(mediaPreview?.files?.length)}
        file={mediaPreview?.files?.[mediaPreview.index]}
        index={mediaPreview?.index ?? 0}
        total={mediaPreview?.files?.length ?? 1}
        viewOnce={Boolean(mediaPreview?.viewOnce)}
        onToggleViewOnce={() =>
          setMediaPreview((prev) =>
            prev ? { ...prev, viewOnce: !prev.viewOnce } : prev,
          )
        }
        compress={Boolean(mediaPreview?.compress)}
        onToggleCompress={() =>
          setMediaPreview((prev) =>
            prev ? { ...prev, compress: !prev.compress } : prev,
          )
        }
        compressing={mediaCompressing}
        compressProgress={mediaCompressProgress}
        compressPhase={mediaCompressPhase}
        onSend={handleMediaPreviewSend}
        onSendAll={handleSendAllMedia}
        onClose={() => !mediaPreviewSending && !mediaCompressing && setMediaPreview(null)}
        sending={mediaPreviewSending || mediaCompressing}
      />

      <ComposerPlusSheet
        open={composerPlusOpen}
        onClose={() => setComposerPlusOpen(false)}
        onAttach={() => fileInputRef.current?.click()}
        onCamera={() => setCameraOpen(true)}
        showGroupTools={isGroupChat}
        canAnnounce={Boolean(
          isGroupChat && activeGroup && isGroupAdmin(activeGroup, user.id),
        )}
        onPoll={() => setPollDraft({ question: "", options: ["", ""] })}
        onEvent={() =>
          setEventDraft({ title: "", when: "", where: "", notes: "" })
        }
        onGif={() => setGifPickerOpen(true)}
        onAnnounce={() => {
          setPendingAnnouncement(true);
          textareaRef.current?.focus();
        }}
        disappearSeconds={disappearSeconds}
        onCycleDisappear={() => {
          const steps = [0, 30, 300, 3600, 86400, 604800];
          const i = steps.indexOf(disappearSeconds);
          setDisappearSeconds(steps[(i + 1) % steps.length]);
        }}
        onTimeCapsule={() => setShowCapsulePicker(true)}
        capsuleActive={Boolean(capsuleUnlocksAt)}
        allowForward={allowForward}
        onToggleForward={() => setAllowForward((v) => !v)}
        forwardUntilSeconds={forwardUntilSeconds}
        onCycleForwardUntil={() => {
          const steps = [0, 3600, 86400, 604800];
          const i = steps.indexOf(forwardUntilSeconds);
          setForwardUntilSeconds(steps[(i + 1) % steps.length]);
        }}
      />
      <BottomSheet open={gifPickerOpen} onClose={() => setGifPickerOpen(false)} title="Send a GIF">
        <div style={{ padding: '0 4px 8px' }}>
          <input
            type="text"
            value={gifQuery}
            onChange={(e) => setGifQuery(e.target.value)}
            placeholder="Search GIFs"
            autoFocus
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, marginBottom: 10 }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, maxHeight: 320, overflow: 'auto' }}>
            {gifLoading && <p className="empty-hint" style={{ gridColumn: '1 / -1' }}>Searching…</p>}
            {!gifLoading && gifResults.length === 0 && <p className="empty-hint" style={{ gridColumn: '1 / -1' }}>No GIFs found</p>}
            {gifResults.map((gif) => (
              <button
                key={gif.id}
                type="button"
                disabled={gifSending}
                style={{ padding: 0, border: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => sendGifMessage(gif.url)}
              >
                <img src={gif.previewUrl} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>
      <MessageActionSheet
        open={Boolean(actionSheetMessage)}
        onClose={() => setActionSheetMessage(null)}
        message={actionSheetMessage}
        isMine={
          actionSheetMessage
            ? String(actionSheetMessage.from) === String(user.id)
            : false
        }
        starred={
          actionSheetMessage
            ? starredIds
              .map(String)
              .includes(
                String(actionSheetMessage.id || actionSheetMessage._id),
              )
            : false
        }
        important={
          actionSheetMessage
            ? importantEntries.some(
              (entry) => String(entry.id || entry._id) === String(actionSheetMessage.id || actionSheetMessage._id),
            )
            : false
        }
        pinned={
          actionSheetMessage
            ? pinnedIds
              .map(String)
              .includes(
                String(actionSheetMessage.id || actionSheetMessage._id),
              )
            : false
        }
        canEdit={Boolean(
          actionSheetMessage?.text &&
          !String(actionSheetMessage.text).trim().startsWith('{"__qc') &&
          String(actionSheetMessage.from) === String(user.id),
        )}
        canForward={
          !actionSheetMessage?.viewOnce &&
          actionSheetMessage?.forwardPolicy?.allowForward !== false &&
          actionSheetMessage?.allowForward !== false
        }
        onReply={(msg) => {
          setEditingMessage(null);
          setReplyTo(msg);
        }}
        onReact={(msg, emoji) => {
          if (!emoji || !msg) return;
          setLastQuickReaction(emoji);
          handleReactMessage(msg.id || msg._id, emoji);
        }}
        onCopy={handleCopyMessage}
        onForward={setForwardMessage}
        onEdit={(msg) => {
          setReplyTo(null);
          setEditingMessage(msg);
          setDraft(msg.text || "");
        }}
        onDelete={(msg) =>
          handleDeleteMessage(msg?.id || msg?._id || msg)
        }
        onStar={(msg) => handleStarMessage(msg?.id || msg?._id || msg)}
        onImportant={handleImportantMessage}
        onPin={(msg) => handlePinMessage(msg?.id || msg?._id || msg)}
        onShowInfo={handleShowMessageInfo}
      />

      {capsuleUnlocksAt && (
  <div className="capsule-picker-row">
    <span>⏳ Unlocks {new Date(capsuleUnlocksAt).toLocaleString()}</span>
    <button
      type="button"
      className="capsule-picker-close"
      title="Cancel time capsule"
      onClick={() => setCapsuleUnlocksAt("")}
    >
      <X size={16} />
    </button>
  </div>
)}

      {!isCompactChrome && (
        <InfoPanel
          open={infoPanelOpen && Boolean(selected)}
          onClose={closeInfoPanel}
          selected={selected}
          users={users}
          onOpenProfile={setProfileUserId}
          onOpenGroupSettings={() => setShowGroupSettings(true)}
          onOpenCommandCenter={() => setShowCommandCenter(true)}
        >
          {selected?.type === "dm" &&
            !selected.isSelfChat &&
            vaultUnlocked &&
            isPeerVaulted(selected.id) &&
            decoyThreadExists && (
              <p
                className="qc-info-note"
                style={{ color: "var(--warning-text)" }}
              >
                This chat has messages that were sent without your vault
                password entered (decoy thread). They&apos;re kept separate
                from this real conversation and never mix with it.
              </p>
            )}
        </InfoPanel>
      )}

      {isCompactChrome && (
        <BottomSheet
          open={infoPanelOpen && Boolean(selected)}
          onClose={closeInfoPanel}
          title="Chat details"
          className="qc-info-sheet"
        >
          <InfoPanel
            embedded
            open={infoPanelOpen && Boolean(selected)}
            onClose={closeInfoPanel}
            selected={selected}
            users={users}
            onOpenProfile={(id) => {
              closeInfoPanel();
              setProfileUserId(id);
            }}
            onOpenGroupSettings={() => {
              closeInfoPanel();
              setShowGroupSettings(true);
            }}
            onOpenCommandCenter={() => {
              closeInfoPanel();
              setShowCommandCenter(true);
            }}
          >
            {selected?.type === "dm" &&
              !selected.isSelfChat &&
              vaultUnlocked &&
              isPeerVaulted(selected.id) &&
              decoyThreadExists && (
                <p
                  className="qc-info-note"
                  style={{ color: "var(--warning-text)" }}
                >
                  This chat has messages that were sent without your vault
                  password entered (decoy thread). They&apos;re kept separate
                  from this real conversation and never mix with it.
                </p>
              )}
          </InfoPanel>
        </BottomSheet>
      )}
    </ChatShell>
  );
}
