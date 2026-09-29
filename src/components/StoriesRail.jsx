import { BookmarkPlus, Camera, ChevronRight, Eye, FilePen, Forward, ImagePlus, Mic, Paperclip, Pencil, Repeat2, Send, Share2, Smile, Square, Type, X } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import client from '../api/client.js';
import { connectSocket, getSocket } from '../api/socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import { KEY_SET_SIZE, pickRandom, sealBytes, sealMessage } from '../crypto/keys.js';
import {
  findSecretKeyForPublicKey,
  getCurrentKeySet,
  getKeyringSyncStatus,
  getStoredUser
} from '../crypto/keyStorage.js';
import { compressVideo } from '../crypto/videoCompressor.js';
import { COMPOSER_EMOJIS, searchEmojis } from '../utils/emojis.js';
import { playNotificationSound, shouldNotify, showNotificationPopup } from '../utils/notificationDispatch.js';
import { getOfflineMedia, removeOfflineMedia, saveOfflineMedia } from '../utils/offlineMediaQueue.js';
import {
  cacheKeyForStory,
  resolveStoryMediaBlob,
  storyMediaBlobCache,
  storyMediaCache,
  unlockStoryKey,
  viewerCanSeeStory,
} from '../utils/storyMedia.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import HighlightPickerSheet from './HighlightPickerSheet.jsx';
import StoryCaptionOverlay from './StoryCaptionOverlay.jsx';
import StoryHistoryPanel from './StoryHistoryPanel.jsx';
import { StoryLocalPreview, StoryPublishControls, useStoryPublishOptions } from './StoryPublishControls.jsx';
import TextStoryComposer from './TextStoryComposer.jsx';
import { useToast } from './ToastProvider.jsx';
import UserAvatar from './UserAvatar.jsx';
const MAX_STORY_SECONDS = 60;
const MAX_STORY_UPLOAD_BYTES = 95 * 1024 * 1024; // stay under server 100MB limit
const COMPRESS_IF_LARGER_THAN = 4 * 1024 * 1024; // compress status videos over ~4MB
const FORCE_COMPRESS_IF_LARGER_THAN = 20 * 1024 * 1024; // don't skip re-encode above ~20MB
const TTL_PRESETS = [
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '6 hours', ms: 6 * 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { label: '3 days', ms: 3 * 24 * 60 * 60 * 1000 },
  { label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
];
const DEFAULT_TTL_MS = TTL_PRESETS[2].ms; // 24h
const MIN_TTL_MS = 15 * 60 * 1000;
const MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function bytesToBase64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

function base64ToBytes(b64) {
  // Multipart form fields sometimes turn '+' into spaces; normalize before atob.
  const normalized = String(b64 || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/\s/g, '');
  const bin = atob(normalized);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function aesGcmEncryptBlob(file) {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new Uint8Array(await file.arrayBuffer());

  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  return {
    cipherBytes: new Uint8Array(cipherBuf),
    keyB64: bytesToBase64(rawKey),
    ivB64: bytesToBase64(iv),
  };
}



function probeMediaDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    const el = document.createElement(isVideo ? 'video' : 'audio');
    el.preload = 'metadata';
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      el.removeAttribute('src');
      el.load?.();
      fn(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new Error('Could not read this video — try another clip'));
    }, 12_000);
    el.onloadedmetadata = () => {
      const seconds = el.duration;
      if (!Number.isFinite(seconds) || seconds <= 0) {
        finish(reject, new Error('Could not read this video duration — try another clip'));
        return;
      }
      finish(resolve, Math.round(seconds * 1000));
    };
    el.onerror = () => {
      finish(reject, new Error('Could not read this video — try another clip'));
    };
    el.src = url;
  });
}



function buildStoryEnvelopes(audience, keyB64, ivB64) {
  const secretPayload = JSON.stringify({ keyB64, ivB64 });
  return audience.map((u) => {
    const keys = (u.publicKeys || []).filter(Boolean);
    if (!keys.length) throw new Error(`Missing X5 keys for ${u.username || u.id}`);
    const sealed = sealMessage(secretPayload, pickRandom(keys));
    return { user: String(u.id), ...sealed };
  });
}


/**
 * Open the AES media key from any of this viewer's story envelopes.
 * Returns { ok: true, payload } on success, or { ok: false, reason, targetPublicKey? }
 * so the UI can show a precise message (no envelope vs. no matching secret vs. decrypt failure).
 */





function formatElapsed(dateStr) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatRemaining(expiresAtStr) {
  if (!expiresAtStr) return '';
  const diffMs = new Date(expiresAtStr).getTime() - Date.now();
  if (diffMs <= 0) return 'Expired';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h left` : `${days}d left`;
}

const StoriesRail = forwardRef(function StoriesRail({ currentUser, users = [], onError, notifSettings }, ref) {
  const { keyringInSync, keyringNeedsResync, refreshUserFromServer, verifyKeySync } = useAuth();
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [viewer, setViewer] = useState(null);
  const [storyMentions, setStoryMentions] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState(''); // '', 'compress', 'encrypt', 'upload'
  const [composerError, setComposerError] = useState('');
 const [pendingQueue, setPendingQueue] = useState([]); // File[]
  const [pendingIndex, setPendingIndex] = useState(0);
 const [pendingPreviewUrl, setPendingPreviewUrl] = useState(null);
 const [batchProgress, setBatchProgress] = useState(null); // { done, total } while posting
  const [unavailable, setUnavailable] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [textComposerOpen, setTextComposerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
 const [historyTab, setHistoryTab] = useState('drafts');
  const [draftCount, setDraftCount] = useState(0);
  const [fabHost, setFabHost] = useState(null);

  const mediaInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const storyFriends = useMemo(() => {
      const friendSet = new Set((currentUser?.friends || []).map(String));
      return (users || [])
        .filter((u) => u?.id && friendSet.has(String(u.id)))
        .map((u) => ({ id: String(u.id), username: u.username, hasAvatar: u.hasAvatar }));
    }, [users, currentUser?.friends]);
  const grouped = useMemo(() => {
    const map = new Map();
    for (const story of stories) {
      if (!viewerCanSeeStory(story, currentUser?.id)) continue;
      const uid = String(story.user?.id || story.user);
      if (!map.has(uid)) {
        map.set(uid, { user: story.user, items: [] });
      }
      map.get(uid).items.push(story);
    }
    const list = [...map.values()];
    // Server returns stories newest-first; playback should go oldest → newest.
    for (const group of list) {
      group.items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    list.sort((a, b) => {
      const aOwn = String(a.user?.id) === String(currentUser?.id);
      const bOwn = String(b.user?.id) === String(currentUser?.id);
      if (aOwn && !bOwn) return -1;
      if (!aOwn && bOwn) return 1;
      return 0;
    });
    return list;
  }, [stories, currentUser?.id]);

  async function loadStories({ quiet = false } = {}) {
    if (!quiet) setStoriesLoading(true);
    try {
      const { data } = await client.get('/stories');
      setStories(data.data || []);
    } catch {
      if (!quiet) setStories([]);
    } finally {
      if (!quiet) setStoriesLoading(false);
    }
  }

  async function loadDraftsCount() {
    try {
      const { data } = await client.get('/stories/mine/drafts');
      setDraftCount((data.data || []).length);
    } catch {
      setDraftCount(0);
    }
  }

  useEffect(() => {
    loadStories().catch(() => { });
    loadDraftsCount().catch(() => { });

    // Handle shared story links: e.g. /chat?story=:storyId
    try {
      const params = new URLSearchParams(window.location.search);
      const sharedStoryId = params.get('story');
      if (sharedStoryId) {
        client.get(`/stories/${sharedStoryId}`).then(({ data }) => {
          const s = data.data;
          if (s) {
            setUnavailable(false);
            setViewer({ group: { user: s.user, items: [s] }, index: 0 });
          }
        }).catch(() => {
          setUnavailable(true);
        });
      }
    } catch {
      // ignore URLSearchParams errors
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let attached = null;

    function onNew(payload) {
      if (!payload?.id) return;
      if (!viewerCanSeeStory(payload, currentUser?.id)) return;
      const isOwn = String(payload.user?.id) === String(currentUser?.id);
      setStories((prev) => {
        if (prev.some((s) => String(s.id) === String(payload.id))) return prev;
        return [payload, ...prev];
      });

      if (!isOwn) {
        const mode = notifSettings?.statusNotifications;
        const isSelected = (notifSettings?.statusNotificationsSelectedFriends || [])
          .map(String)
          .includes(String(payload.user?.id));
        const allowed = mode !== 'off' && (mode !== 'selected' || isSelected);
        if (allowed && shouldNotify(notifSettings, { kind: 'status' })) {
          playNotificationSound(notifSettings);
          showNotificationPopup(
            { title: payload.user?.username || 'Someone', body: 'Posted a new story' },
            notifSettings,
            () => {},
          );
        }
      }
    }

    function onDeleted({ id } = {}) {
      if (!id) return;
      setStories((prev) => prev.filter((s) => String(s.id) !== String(id)));
    }

    function detach() {
      if (!attached) return;
      attached.off('story:new', onNew);
      attached.off('story:deleted', onDeleted);
      attached.off('connect', onSocketConnect);
      attached = null;
    }

    function attach(socket) {
      if (!socket || cancelled || attached === socket) return;
      detach();
      attached = socket;
      socket.on('story:new', onNew);
      socket.on('story:deleted', onDeleted);
      socket.on('connect', onSocketConnect);
    }

    function onSocketConnect() {
      // Catch stories posted while we were disconnected.
      if (!cancelled) loadStories({ quiet: true }).catch(() => {});
    }

    // Chat may connect the socket slightly after StoriesRail mounts — keep trying.
    attach(getSocket() || connectSocket());
    const waitTimer = setInterval(() => {
      if (cancelled) return;
      attach(getSocket() || connectSocket());
    }, 1500);

    // Fallback when Socket.IO is unavailable (e.g. serverless API with no signal URL).
    const pollTimer = setInterval(() => {
      if (cancelled || document.hidden) return;
      const live = getSocket()?.connected;
      if (!live) loadStories({ quiet: true }).catch(() => {});
    }, 12000);

    function onVisible() {
      if (document.visibilityState === 'visible') {
        loadStories({ quiet: true }).catch(() => {});
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      cancelled = true;
      clearInterval(waitTimer);
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      detach();
    };
  }, [currentUser?.id, notifSettings]);

  useEffect(() => {
    setFabHost(document.querySelector('.qc-conversation-pane'));
  }, []);

  const ownGroup = useMemo(
    () => grouped.find((g) => String(g.user?.id) === String(currentUser?.id)) || null,
    [grouped, currentUser?.id]
  );

  useEffect(() => {
    if (!createSheetOpen) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setCreateSheetOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [createSheetOpen]);

  function handleFileSelected(e) {
     const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setCreateSheetOpen(false);
    setTextComposerOpen(false);
    setComposerError('');
 setPendingQueue(files);
   setPendingIndex(0);
    setPendingPreviewUrl(URL.createObjectURL(files[0]));
  }

  function openCreateSheet() {
    if (uploading) return;
    setCreateSheetOpen(true);
  }

  function openOwnStoriesOrCreate() {
    if (uploading) return;
    if (ownGroup?.items?.length) {
      setUnavailable(false);
      setViewer({ group: ownGroup, index: 0 });
      return;
    }
    openCreateSheet();
  }


  function reportStoryError(message) {
    const text = String(message || 'Failed to upload story');
    setComposerError(text);
    onError?.(text);
  }

  async function uploadStory(file, ttlMs, allowReplies = true, options = {}) {
    try {
      setUploading(true);
      setUploadPhase('');
      setComposerError('');

      // Make sure our local keyring is actually in sync with the server before
      // sealing anything to it — this is the fix for stories being undecryptable.
      if (keyringNeedsResync || !keyringInSync) {
        await verifyKeySync().catch(() => refreshUserFromServer().catch(() => null));
      }
      const ownerUser = getStoredUser() || currentUser;
      const sync = getKeyringSyncStatus(ownerUser.id, ownerUser.publicKeys || []);
      if (sync.status !== 'synced') {
        reportStoryError(
          'Encryption keys are out of sync with the server. Use Settings → Regenerate & resync keys before posting stories.'
        );
        return false;
      }

      let fileToUpload = file;
      let durationMs = 0;
      const looksLikeAv =
        file.type.startsWith('video/') ||
        file.type.startsWith('audio/') ||
        /\.(mp4|mov|webm|m4v|mkv|mp3|m4a|wav|ogg)$/i.test(file.name || '');
      if (looksLikeAv) {
        try {
          durationMs = await probeMediaDuration(file);
        } catch (err) {
          reportStoryError(err?.message || 'Could not read this media file');
          return false;
        }
        if (durationMs > MAX_STORY_SECONDS * 1000) {
          reportStoryError(
            `This video is too long (${Math.ceil(durationMs / 1000)}s). Stories must be ${MAX_STORY_SECONDS} seconds or shorter.`
          );
          return false;
        }
      }

      // Large phone videos exceed the upload limit — compress before sealing.
      const isVideo =
        file.type.startsWith('video/') ||
        /\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name || '');
      if (isVideo && file.size > COMPRESS_IF_LARGER_THAN) {
        setUploadPhase('compress');
        try {
          fileToUpload = await compressVideo(
            file,
            undefined,
            undefined,
            { force: file.size > FORCE_COMPRESS_IF_LARGER_THAN }
          );
        } catch (err) {
          if (file.size > MAX_STORY_UPLOAD_BYTES) {
            reportStoryError(
              err?.message ||
                'Could not compress this video. Try a shorter clip under 60 seconds.'
            );
            return false;
          }
          // Compression failed but original still fits — continue with original.
          fileToUpload = file;
        }
      }

      if (fileToUpload.size > MAX_STORY_UPLOAD_BYTES) {
        reportStoryError(
          'This video is still too large after compression. Try a shorter clip (under 60 seconds).'
        );
        return false;
      }

      const status = options.status || 'published';
      const clientStoryId = options.clientStoryId || crypto.randomUUID();
      if (!options.skipOutbox) {
        await saveOfflineMedia(currentUser.id, {
          id: clientStoryId,
          type: 'story',
          conversationKey: `story:${currentUser.id}`,
          filename: fileToUpload.name || 'story.enc',
          mimetype: fileToUpload.type || 'application/octet-stream',
          sourceBytes: new Uint8Array(await fileToUpload.arrayBuffer()),
          storyOptions: { ttlMs, allowReplies, options: { ...options, clientStoryId, skipOutbox: true } },
        });
      }
      const form = new FormData();
      form.append('clientStoryId', clientStoryId);
      const canSeal = typeof crypto !== 'undefined' && crypto.subtle;

      if (canSeal) {
        setUploadPhase('encrypt');
        const sealed = await aesGcmEncryptBlob(fileToUpload);

        const ownerKeySet = getCurrentKeySet(ownerUser.id, KEY_SET_SIZE);
        const ownerPublicKeys = ownerKeySet.map((k) => k.publicKey).filter(Boolean);
        if (ownerPublicKeys.length !== KEY_SET_SIZE) {
          throw new Error('Your local keyring is incomplete — import keys.txt or regenerate keys');
        }
        for (const pk of ownerPublicKeys) {
          if (!findSecretKeyForPublicKey(ownerUser.id, pk)) {
            throw new Error('Local keyring is incomplete — re-import your keys.txt');
          }
        }

        const storyPrivacy = currentUser?.privacy?.story || 'everyone';
        const friendSet = new Set((currentUser?.friends || []).map(String));
        const selectedSet = new Set((currentUser?.privacy?.storyViewers || []).map(String));

        const audienceMap = new Map();
        audienceMap.set(String(ownerUser.id), {
          id: String(ownerUser.id),
          username: ownerUser.username,
          publicKeys: ownerPublicKeys,
        });
        for (const u of users) {
          if (!u?.id || !u.publicKeys?.length) continue;
          if (String(u.id) === String(ownerUser.id)) continue;
          if (storyPrivacy === 'nobody') continue;
          if (storyPrivacy === 'friends' && !friendSet.has(String(u.id))) continue;
          if (storyPrivacy === 'selected' && !selectedSet.has(String(u.id))) continue;
          audienceMap.set(String(u.id), {
            id: String(u.id),
            username: u.username,
            publicKeys: u.publicKeys,
          });
        }
        const audience = [...audienceMap.values()];
        if (!audience[0].publicKeys?.length) {
          throw new Error('Your account is missing X5 public keys');
        }

        const serverKeys = new Set((ownerUser.publicKeys || []).map((k) => k.toLowerCase()));
        const localKeys = new Set(ownerPublicKeys.map((k) => k.toLowerCase()));
        const keysMatchServer = ownerPublicKeys.every((k) => serverKeys.has(k.toLowerCase()));
        if (!keysMatchServer || serverKeys.size !== localKeys.size) {
          throw new Error(
            'Local encryption keys do not match the server — regenerate & resync keys before posting stories'
          );
        }

        const envelopes = buildStoryEnvelopes(audience, sealed.keyB64, sealed.ivB64);

        form.append(
          'file',
          new Blob([sealed.cipherBytes], { type: 'application/octet-stream' }),
          'story.enc'
        );
        form.append('sealed', 'true');
        const mime =
          fileToUpload.type ||
          (isVideo ? 'video/mp4' : file.type.startsWith('audio/') ? 'audio/webm' : 'application/octet-stream');
        form.append('mimetype', mime);
        if (mime.startsWith('image/')) form.append('mediaType', 'image');
        else if (mime.startsWith('video/') || isVideo) form.append('mediaType', 'video');
        else if (mime.startsWith('audio/')) form.append('mediaType', 'audio');
        form.append('contentIv', sealed.ivB64);
        form.append('envelopes', JSON.stringify(envelopes));
      } else {
        form.append('file', fileToUpload);
      }
      form.append('durationMs', String(durationMs));
      form.append('ttlMs', String(ttlMs));
      form.append('allowReplies', String(allowReplies));
      form.append('viewOnce', String(Boolean(options.viewOnce)));
      form.append('caption', options.caption || '');
      form.append('captionMode', options.captionMode || 'fixed');
      if (Array.isArray(options.mentions) && options.mentions.length) {
        form.append('mentions', JSON.stringify(options.mentions));
      }
      if (options.captionMode === 'free' && options.captionStyle) {
        form.append('captionStyle', JSON.stringify(options.captionStyle));
      }
      form.append('status', status);
      if (status === 'scheduled' && options.publishAt) {
        form.append('publishAt', options.publishAt);
      }

      setUploadPhase('upload');
      await client.post('/stories', form, { timeout: 5 * 60 * 1000 });
      await removeOfflineMedia(currentUser.id, clientStoryId);
      if (status === 'published') await loadStories();
      await loadDraftsCount();
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to upload story';
      reportStoryError(msg);
      return false;
    } finally {
      setUploading(false);
      setUploadPhase('');
    }
  }
  const offlineRetryRef = useRef({ inFlight: false, failCounts: new Map() });

  useEffect(() => {
    async function retryStories() {
      if (!navigator.onLine || !currentUser?.id) return;
      // Never let two retry passes overlap — that's what turns one stuck
      // item into a growing pile of concurrent duplicate requests.
      if (offlineRetryRef.current.inFlight) return;
      offlineRetryRef.current.inFlight = true;
      try {
        const pending = (await getOfflineMedia(currentUser.id)).filter((entry) => entry.type === 'story');
        for (const entry of pending) {
          const fails = offlineRetryRef.current.failCounts.get(entry.id) || 0;
          if (fails >= 3) continue; // stop hammering a permanently broken item
          const file = new File([entry.sourceBytes], entry.filename || 'story.enc', { type: entry.mimetype || 'application/octet-stream' });
          const ok = await uploadStory(file, entry.storyOptions?.ttlMs, entry.storyOptions?.allowReplies, entry.storyOptions?.options || {});
          if (!ok) {
            offlineRetryRef.current.failCounts.set(entry.id, fails + 1);
          } else {
            offlineRetryRef.current.failCounts.delete(entry.id);
          }
        }
      } finally {
        offlineRetryRef.current.inFlight = false;
      }
    }
    const retry = () => retryStories().catch(() => {});
    window.addEventListener('online', retry);
    retry();
    return () => window.removeEventListener('online', retry);
  }, [currentUser?.id]);

  function closeComposer() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingQueue([]);
    setPendingIndex(0);
     setPendingPreviewUrl(null);
     setTextComposerOpen(false);
     setComposerError('');
    setBatchProgress(null);

  }

  async function confirmPostStory(ttlMs, allowReplies, options = {}) {
     if (!pendingQueue.length || uploading) return;
    const total = pendingQueue.length;
    setBatchProgress({ done: 0, total });

    for (let i = 0; i < total; i += 1) {
     const file = pendingQueue[i];
      setPendingIndex(i);
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl(URL.createObjectURL(file));

      // Scheduled batches: stagger publishAt by a few seconds each so they
      // don't all collide on the same instant and reorder unpredictably.
      const itemOptions =
        options.status === 'scheduled' && options.publishAt
          ? { ...options, publishAt: new Date(new Date(options.publishAt).getTime() + i * 5000).toISOString() }
          : options;

      // eslint-disable-next-line no-await-in-loop
      const ok = await uploadStory(file, ttlMs, allowReplies, itemOptions);
      if (!ok) {
        // uploadStory already reported the error via reportStoryError.
        setBatchProgress(null);
        return;
      }
      setBatchProgress({ done: i + 1, total });
    }

    closeComposer();
   }
  async function confirmPostTextStory(file, ttlMs, allowReplies, options = {}) {
    if (!file || uploading) return;
    const ok = await uploadStory(file, ttlMs, allowReplies, options);
    if (ok) closeComposer();
  }

   async function openDraftPreview(draft) {
    setHistoryOpen(false);
    try {
      setUnavailable(false);
      setViewer({
        group: {
          user: draft.user || {
            id: currentUser?.id,
            username: currentUser?.username,
            hasAvatar: currentUser?.hasAvatar,
          },
          items: [draft],
        },
        index: 0,
      });
    } catch {
      onError?.('Could not open draft preview');
    }
  }
  function openActiveStoryPreview(items, index) {
    setUnavailable(false);
    setViewer({ group: { user: currentUser, items }, index });
  }
  useImperativeHandle(ref, () => ({
    async openStoryById(storyId) {
      try {
        const { data } = await client.get(`/stories/${storyId}`);
        const story = data.data;
        setUnavailable(false);
        setViewer({ group: { user: story.user, items: [story] }, index: 0 });
      } catch {
        setUnavailable(true);
      }
    },
  }));

  return (
    <div className="stories-rail">

      <div className="story-add-wrap">
        <button
          type="button"
          className={`story-ring add${uploading ? ' uploading' : ''}${ownGroup?.items?.length ? ' has-own' : ''}`}
          onClick={openOwnStoriesOrCreate}
          disabled={uploading}
          aria-label={ownGroup?.items?.length ? 'View your status' : 'Add status'}
        >
          <UserAvatar
            userId={currentUser?.id}
            name={currentUser?.username}
            hasAvatar={currentUser?.hasAvatar}
            size="story"
          />
          <span className="story-ring-label">
            {uploading
              ? uploadPhase === 'compress'
                ? 'Compressing…'
                : uploadPhase === 'encrypt'
                  ? 'Encrypting…'
                  : 'Uploading…'
              : 'My status'}
          </span>
        </button>
        <button
          type="button"
          className="story-add-badge"
          disabled={uploading}
          aria-label="Add status"
          onClick={openCreateSheet}
        >
          {uploading ? '…' : '+'}
        </button>
      </div>

      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={handleFileSelected}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        multiple
        hidden
        onChange={handleFileSelected}
      />

      {storiesLoading &&
        [1, 2, 3].map((i) => (
          <div key={i} className="story-ring story-ring-skeleton" aria-hidden="true">
            <div className="skeleton skeleton-avatar story-skeleton-avatar" />
            <span className="skeleton skeleton-line story-skeleton-label" />
          </div>
        ))}

      {!storiesLoading &&
        grouped
          .filter((g) => String(g.user?.id) !== String(currentUser?.id))
          .map((g) => {
            const hasSealed = g.items.some((s) => s.sealed);
            return (
              <button
                key={String(g.user?.id)}
                type="button"
                className={`story-ring${hasSealed ? ' sealed' : ''}`}
                onClick={() => {
                  setUnavailable(false);
                  setViewer({ group: g, index: 0 });
                }}
              >
                <UserAvatar
                  userId={g.user?.id}
                  name={g.user?.username}
                  hasAvatar={g.user?.hasAvatar}
                  size="story"
                />
                {hasSealed ? <span className="story-ring-sealed-dot" title="Sealed story" aria-label="Sealed" /> : null}
                <span className="story-ring-label">{g.user?.username}</span>
              </button>
            );
          })}

      {viewer && (
        <StoryViewer
          group={viewer.group}
          startIndex={viewer.index}
          currentUserId={currentUser?.id}
          users={users}
          onError={onError}
          onClose={() => setViewer(null)}
          onReshareStory={(file) => {
            setViewer(null);
            if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
            setPendingQueue([file]);
            setPendingIndex(0);
            setPendingPreviewUrl(URL.createObjectURL(file));
          }}
          onDeleted={async () => {
            setViewer(null);
            await loadStories();
          }}
        />
      )}
      {unavailable && (
        <div className="story-viewer-overlay" onClick={() => setUnavailable(false)}>
          <div className="story-unavailable-card" onClick={(e) => e.stopPropagation()}>
            <p className="story-unavailable-title">Story unavailable</p>
            <p>This story expired or was deleted.</p>
            <button type="button" onClick={() => setUnavailable(false)}>
              OK
            </button>
          </div>
        </div>
      )}
     {pendingQueue.length > 0 && (
        <StoryComposer
         file={pendingQueue[pendingIndex]}
          previewUrl={pendingPreviewUrl}
          friends={storyFriends}
          onCancel={closeComposer}
          onConfirm={confirmPostStory}
          uploading={uploading}
          uploadPhase={uploadPhase}
                    batchProgress={batchProgress}
         queueLength={pendingQueue.length}
          error={composerError}
          onError={reportStoryError}
        />
      )}
            {textComposerOpen && !pendingQueue.length && (
        <TextStoryComposer
        friends={storyFriends}
          onCancel={() => setTextComposerOpen(false)}
          onConfirm={confirmPostTextStory}
          uploading={uploading}
          onError={onError}
        />
      )}

       <StoryHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        currentUserId={currentUser?.id}
        initialTab={historyTab}
        onError={onError}
        onChanged={() => {
          loadStories();
          loadDraftsCount();
        }}
        onPreviewDraft={openDraftPreview}
        onPreviewStory={openActiveStoryPreview}
      />

      {createSheetOpen &&
        createPortal(
          <div
            className="status-create-overlay"
            onClick={() => setCreateSheetOpen(false)}
            role="presentation"
          >
            <div
              className="status-create-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Add status"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="status-create-handle" aria-hidden />

              <div className="status-create-header">
                <div className="status-create-heading-wrap">
                  <h2 className="status-create-title">Add status</h2>
                  <p className="status-create-subtitle">Share a photo, video, voice note, or text</p>
                </div>
                <button
                  type="button"
                  className="status-create-close"
                  onClick={() => setCreateSheetOpen(false)}
                  aria-label="Close"
                >
                  <X size={18} aria-hidden />
                </button>
              </div>

              <div className="status-create-options">
                <button
                  type="button"
                  className="status-create-option media-opt"
                  onClick={() => {
                    setCreateSheetOpen(false);
                    mediaInputRef.current?.click();
                  }}
                >
                  <span className="status-create-icon media">
                    <ImagePlus size={22} aria-hidden />
                  </span>
                  <span className="status-create-copy">
                    <strong>Photo &amp; video</strong>
                    <small>Upload from your gallery</small>
                  </span>
                  <span className="status-create-arrow">
                    <ChevronRight size={16} aria-hidden />
                  </span>
                </button>
                <button
                  type="button"
                  className="status-create-option audio-opt"
                  onClick={() => {
                    setCreateSheetOpen(false);
                    audioInputRef.current?.click();
                  }}
                >
                  <span className="status-create-icon audio">
                    <Mic size={22} aria-hidden />
                  </span>
                  <span className="status-create-copy">
                    <strong>Voice note</strong>
                    <small>Share an audio status</small>
                  </span>
                  <span className="status-create-arrow">
                    <ChevronRight size={16} aria-hidden />
                  </span>
                </button>
                <button
                  type="button"
                  className="status-create-option text-opt"
                  onClick={() => {
                    setCreateSheetOpen(false);
                    setTextComposerOpen(true);
                  }}
                >
                  <span className="status-create-icon text">
                    <Type size={22} aria-hidden />
                  </span>
                  <span className="status-create-copy">
                    <strong>Text status</strong>
                    <small>Type with colors and fonts</small>
                  </span>
                  <span className="status-create-arrow">
                    <ChevronRight size={16} aria-hidden />
                  </span>
                </button>
                <button
                  type="button"
                  className="status-create-option drafts-opt"
                  onClick={() => {
                    setCreateSheetOpen(false);
                    setHistoryTab('active');
                    setHistoryOpen(true);
                  }}
                >
                  <span className="status-create-icon drafts">
                    <FilePen size={22} aria-hidden />
                  </span>
                  <span className="status-create-copy">
                    <span className="status-create-title-row">
                      <strong>Story history</strong>
                      {draftCount > 0 && (
                        <span className="status-badge-count">{draftCount} waiting</span>
                      )}
                    </span>
                    <small>
                      {draftCount > 0
                        ? 'Preview, edit, or publish scheduled'
                        : 'Active, archived, and drafts'}
                    </small>
                  </span>
                  <span className="status-create-arrow">
                    <ChevronRight size={16} aria-hidden />
                  </span>
                </button>
              </div>
              <button
                type="button"
                className="status-create-cancel"
                onClick={() => setCreateSheetOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}

      {!uploading &&
        !pendingQueue.length &&
        !textComposerOpen &&
        !createSheetOpen &&
        !viewer &&
        fabHost &&
        createPortal(
          <div className="status-fabs" aria-label="Create status">
            <button
              type="button"
              className="status-fab text"
              title="Text status"
              aria-label="Text status"
              onClick={() => setTextComposerOpen(true)}
            >
              <Pencil size={20} aria-hidden />
            </button>
            <button
              type="button"
              className="status-fab camera"
              title="Add status"
              aria-label="Add photo, video, or other status"
              onClick={openCreateSheet}
            >
              <Camera size={24} aria-hidden />
            </button>
          </div>,
          fabHost
        )}
    </div>
  );
});

export default StoriesRail;

/** Full-screen "Viewed by N" sheet, opened from the eye icon in StoryViewer. */
function StoryViewersSheet({ viewerCount, viewers, viewersHidden, viewersHiddenReason, onClose }) {
  return (
    <div className="story-viewers-sheet-overlay" onClick={onClose}>
      <div className="story-viewers-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="story-viewers-sheet-header">
          <span>Viewed by {viewerCount}</span>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="story-viewers-sheet-list">
          {viewersHidden ? (
            <p className="empty-hint">
              {viewersHiddenReason || 'Viewer identities are hidden while "View stories anonymously" is on'}
            </p>
          ) : viewers.length === 0 ? (
            <p className="empty-hint">No views yet</p>
          ) : (
            viewers.map((v) => (
              <div key={v.id} className="story-viewers-sheet-row">
                <UserAvatar userId={v.id} name={v.username} hasAvatar={v.hasAvatar} size="sm" />
                <span className="story-viewers-sheet-name">{v.username}</span>
                <span className="story-viewers-sheet-time">
                  {new Date(v.viewedAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StoryViewer({ group, startIndex, currentUserId, users = [], onClose, onDeleted, onError, onReshareStory }) {
  const { showToast } = useToast();
  const [resharing, setResharing] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [viewers, setViewers] = useState([]);
  const [viewersHidden, setViewersHidden] = useState(false);
  const [viewersHiddenReason, setViewersHiddenReason] = useState('');
  const [viewersOpen, setViewersOpen] = useState(false);
  const [index, setIndex] = useState(startIndex || 0);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [blockedReason, setBlockedReason] = useState('');
  const [loadPhase, setLoadPhase] = useState(''); // '', 'download', 'decrypt'
  const [downloadPct, setDownloadPct] = useState(null);
  const [slowLoad, setSlowLoad] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replySentFlash, setReplySentFlash] = useState('');
  const replySentTimerRef = useRef(null);
  const replyInputRef = useRef(null);
  const [reacting, setReacting] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState('');
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [reactionQuery, setReactionQuery] = useState('');
  const [burst, setBurst] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const replyFileInputRef = useRef(null);
  const [replyRecording, setReplyRecording] = useState(false);
  const [replyRecordSeconds, setReplyRecordSeconds] = useState(0);
  const replyMediaRecorderRef = useRef(null);
  const replyMediaStreamRef = useRef(null);
  const replyRecordChunksRef = useRef([]);
  const replyRecordTimerRef = useRef(null);
  const replyRecordStartedAtRef = useRef(0);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [saveHighlightOpen, setSaveHighlightOpen] = useState(false);
  const [mediaBlob, setMediaBlob] = useState(null);

  const story = group.items[index];
  const isOwn = String(group.user?.id) === String(currentUserId);

  useEffect(() => {
    return () => {
      if (replySentTimerRef.current) clearTimeout(replySentTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    let objectUrl;
    let usedCache = false;
    let settled = false;

    setMediaUrl(null);
    setMediaBlob(null);
    setBlockedReason('');
    setLoadPhase('');
    setDownloadPct(null);
    setSlowLoad(false);
    setSaveHighlightOpen(false);

    const slowTimer = setTimeout(() => setSlowLoad(true), 5000);
    // Hard fail-safe: never leave the viewer on an infinite spinner.
    const failSafeTimer = setTimeout(() => {
      if (settled || abortController.signal.aborted) return;
      settled = true;
      setLoadPhase('');
      setBlockedReason('Story media is taking too long — close and open again');
    }, 50_000);

    // The view-once "consumed" flag is written by this /view ping. It must fire
    // AFTER the media has actually loaded — never before or concurrently — or a
    // view-once story can consume itself before its very first viewer sees it.
    function pingViewed() {
      if (isOwn) return;
      client.post(`/stories/${story.id}/view`).catch(() => {
        // Non-critical — a failed view-ping shouldn't block story viewing.
      });
    }

    (async () => {
      const cacheKey = cacheKeyForStory(story);
      const cachedUrl = storyMediaCache.get(cacheKey);
      const cachedBlob = storyMediaBlobCache.get(cacheKey);
      if (cachedUrl && cachedBlob) {
        usedCache = true;
        settled = true;
        setMediaUrl(cachedUrl);
        setMediaBlob(cachedBlob);
        pingViewed();
        return;
      }

      let unlocked;
      if (story.sealed) {
        unlocked = unlockStoryKey(story, currentUserId);
        const ivB64 = unlocked?.payload?.ivB64 || story.contentIv;
        if (!unlocked?.ok || !unlocked?.payload?.keyB64 || !ivB64) {
          settled = true;
          const reason =
            unlocked?.reason === 'no-secret'
              ? 'Sealed story — your local keys do not match (re-import keys.txt)'
              : 'Sealed story — no envelope for your keys';
          setBlockedReason(reason);
          return;
        }
      }

      setLoadPhase('download');
      const blob = await resolveStoryMediaBlob(story, currentUserId, {
        signal: abortController.signal,
        precomputedUnlock: unlocked,
        onDownloadProgress: (evt) => {
          if (!evt.total) return;
          setDownloadPct(Math.min(99, Math.round((evt.loaded / evt.total) * 100)));
        },
      });

      if (abortController.signal.aborted) return;

      setLoadPhase('decrypt');
      setDownloadPct(100);
      // Decrypt already finished inside resolve — brief paint so UI can show phase.
      await new Promise((r) => requestAnimationFrame(() => r()));
      if (abortController.signal.aborted) return;

      objectUrl = storyMediaCache.get(cacheKey) || URL.createObjectURL(blob);
      if (!storyMediaCache.has(cacheKey)) storyMediaCache.set(cacheKey, objectUrl);
      settled = true;
      setMediaUrl(objectUrl);
      setMediaBlob(blob);
      setLoadPhase('');
      pingViewed();
    })().catch((err) => {
      // Only ignore abort if *this* viewer instance was cleaned up.
      if (abortController.signal.aborted) return;
      if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;

      settled = true;
      setMediaUrl(null);
      setMediaBlob(null);
      setLoadPhase('');

      if (story.sealed) {
        const status = err?.response?.status;
        if (status === 403) {
          setBlockedReason('Sealed story — no envelope for your keys');
        } else if (status === 404) {
          setBlockedReason(
            isOwn
              ? 'This story’s file is missing from storage — delete it and post again'
              : 'Story media is missing on the server (ask them to re-post)',
          );
        } else if (status === 502) {
          setBlockedReason('Could not reach story storage — try again in a moment');
        } else if (err.code === 'ECONNABORTED' || /timeout/i.test(String(err.message || ''))) {
          setBlockedReason('Status download timed out — try again');
        } else if (err.message?.includes('No decryption key')) {
          setBlockedReason('Sealed story — no envelope for your keys');
        } else if (/OperationError|decrypt/i.test(String(err.message || err.name || ''))) {
          setBlockedReason('Could not decrypt this sealed story');
        } else {
          setBlockedReason('Could not decrypt this sealed story');
        }
      } else {
        setBlockedReason(
          err?.response?.status === 404
            ? isOwn
              ? 'This story’s file is missing from storage — delete it and post again'
              : 'Story media is missing on the server'
            : err.code === 'ECONNABORTED' || /timeout/i.test(String(err.message || ''))
              ? 'Status download timed out — try again'
              : 'Failed to load story media'
        );
      }
    });
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(failSafeTimer);
      abortController.abort();
      if (objectUrl && !usedCache) {
        const key = cacheKeyForStory(story);
        if (storyMediaCache.get(key) !== objectUrl) URL.revokeObjectURL(objectUrl);
      }
    };
  }, [story.id, story.sealed, story.contentIv, story.mimetype, currentUserId]);

  // Prefetch next 1–2 stories so advancing feels instant — but only AFTER the
  // current story's own media has actually started loading, so it never
  // competes with the story the person is looking at right now.
  useEffect(() => {
    if (!mediaUrl && !blockedReason) return undefined; // current story still loading — wait

    const controllers = [];
    const toPrefetch = [group.items[index + 1], group.items[index + 2]].filter(Boolean);
    let cancelled = false;

    (async () => {
      for (const nextStory of toPrefetch) {
        if (cancelled) return;
        if (!viewerCanSeeStory(nextStory, currentUserId)) continue;
        const nextCacheKey = cacheKeyForStory(nextStory);
        if (storyMediaBlobCache.has(nextCacheKey)) continue;
        const abortController = new AbortController();
        controllers.push(abortController);
        try {
          await resolveStoryMediaBlob(nextStory, currentUserId, {
            signal: abortController.signal,
          });
        } catch {
          // Best-effort prefetch
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const c of controllers) c.abort();
    };
  }, [index, group.items, currentUserId, mediaUrl, blockedReason]);
  useEffect(() => {
    if (!isOwn) return;
    const socket = getSocket();

    if (!socket) {
      // No persistent Socket.IO connection available — e.g. production on
      // Vercel, whose serverless API can't hold a live socket unless
      // VITE_SIGNAL_URL points at a dedicated always-on signaling server.
      // Fall back to periodic REST polling so the viewer list still stays
      // reasonably fresh while this story is open, instead of just going
      // silent for the rest of the session.
      const interval = setInterval(() => {
        client
          .get(`/stories/${story.id}/viewers`)
          .then((res) => {
            setViewerCount(res.data?.data?.viewerCount || 0);
            setViewers(res.data?.data?.viewers || []);
            setViewersHidden(Boolean(res.data?.data?.viewersHidden));
            setViewersHiddenReason(res.data?.data?.viewersHiddenReason || '');
          })
          .catch(() => {});
      }, 8000);
      return () => clearInterval(interval);
    }

    function onViewed(payload) {
      if (String(payload.storyId) !== String(story.id)) return;
      setViewerCount(payload.viewerCount);
      if (payload.anonymous || !payload.viewer) return; // count only, identity withheld
      setViewers((prev) => [
        { ...payload.viewer, viewedAt: payload.viewedAt },
        ...prev.filter((v) => v.id !== payload.viewer.id),
      ]);
    }
    socket.on('story:viewed', onViewed);
    return () => socket.off('story:viewed', onViewed);
  }, [story.id, isOwn]);

  useEffect(() => {
    if (!isOwn) return;
    let cancelled = false;
    client
      .get(`/stories/${story.id}/viewers`)
      .then((res) => {
        if (cancelled) return;
        setViewerCount(res.data?.data?.viewerCount || 0);
        setViewers(res.data?.data?.viewers || []);
        setViewersHidden(Boolean(res.data?.data?.viewersHidden));
        setViewersHiddenReason(res.data?.data?.viewersHiddenReason || '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [story.id, isOwn]);

   // Keeps the "Posted … / Expires in …" label ticking for everyone.
  const [, forceMetaTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceMetaTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (confirmDelete) return;
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (typing) return; // let the input handle its own arrow keys

      if (e.key === 'ArrowRight') setIndex((i) => Math.min(group.items.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [group.items.length, onClose, confirmDelete]);

  async function handleDelete() {
    setConfirmDelete(true);
  }

  async function confirmDeleteStory() {
    if (deleting) return;
    try {
      setDeleting(true);
      await client.delete(`/stories/${story.id}`);
      setConfirmDelete(false);
      onDeleted?.();
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Failed to delete story');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  function notifyReplySent(message = 'Reply sent') {
    if (replySentTimerRef.current) clearTimeout(replySentTimerRef.current);
    setReplySentFlash(message);
    showToast(message, 'success', 2500);
    replySentTimerRef.current = setTimeout(() => {
      setReplySentFlash('');
      replySentTimerRef.current = null;
    }, 2500);
  }

  async function handleSendReply() {
    const text = replyText.trim();
    if (!text || sendingReply) return;
    try {
      setSendingReply(true);

      const owner = users.find((u) => String(u.id) === String(group.user?.id));
      const ownerKeys = (owner?.publicKeys || []).filter(Boolean);
      if (!ownerKeys.length) {
        throw new Error("Can't reply — missing this user's encryption keys");
      }

      const selfKeySet = getCurrentKeySet(currentUserId);
      const selfKeys = selfKeySet.map((k) => k.publicKey).filter(Boolean);
      if (!selfKeys.length) {
        throw new Error('Import your encryption keys before replying');
      }

      const payload = JSON.stringify({
        type: 'story_reply',
        storyId: story.id,
        mediaType: story.mediaType,
        caption: story.caption || null,
        text,
      });

      const forRecipient = sealMessage(payload, pickRandom(ownerKeys));
      const forSender = sealMessage(payload, pickRandom(selfKeys));

      await client.post('/messages', {
        to: String(group.user?.id),
        forRecipient,
        forSender,
        replyToStory: story.id,
      });

      setReplyText('');
      if (replyInputRef.current) replyInputRef.current.style.height = 'auto';
      notifyReplySent('Reply sent');
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  }

  function autoGrow(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }


  function handleReplyKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  }

  async function sendStoryReplyMedia(file, { plainBytes, mediaKind = 'file', gifUrl } = {}) {
    if (sendingReply) return;
    try {
      setSendingReply(true);

      const owner = users.find((u) => String(u.id) === String(group.user?.id));
      const ownerKeys = (owner?.publicKeys || []).filter(Boolean);
      if (!ownerKeys.length) {
        throw new Error("Can't reply — missing this user's encryption keys");
      }
      const selfKeySet = getCurrentKeySet(currentUserId);
      const selfKeys = selfKeySet.map((k) => k.publicKey).filter(Boolean);
      if (!selfKeys.length) {
        throw new Error('Import your encryption keys before replying');
      }

      const recipientPublicKey = pickRandom(ownerKeys);
      const myPublicKey = pickRandom(selfKeys);

      let attachmentId;

      if (file) {
        const fileBytes = plainBytes || new Uint8Array(await file.arrayBuffer());
        const forRecipientFile = sealBytes(fileBytes, recipientPublicKey);
        const forSenderFile = sealBytes(fileBytes, myPublicKey);
        const mimeType = file.type || 'application/octet-stream';
        const recipientBlob = new Blob([forRecipientFile.cipherBytes], { type: mimeType });
        const senderBlob = new Blob([forSenderFile.cipherBytes], { type: mimeType });

        const initRes = await client.post('/attachments/init', {
          recipientId: String(group.user?.id),
          filename: file.name,
          mimetype: mimeType,
          size: recipientBlob.size,
          nonce: forRecipientFile.nonce,
          ephemeralPublicKey: forRecipientFile.ephemeralPublicKey,
          targetPublicKey: forRecipientFile.targetPublicKey,
          forSenderNonce: forSenderFile.nonce,
          forSenderEphemeralPublicKey: forSenderFile.ephemeralPublicKey,
          forSenderTargetPublicKey: forSenderFile.targetPublicKey,
        });
        const { pendingUploadId, sender } = initRes.data.data;

        async function putCiphertext(blob, filename, slot) {
          const formData = new FormData();
          formData.append('file', blob, filename);
          await client.put(`/attachments/pending/${pendingUploadId}/bytes?slot=${slot}`, formData);
          return undefined;
        }

        const recipientDirectUploadId = await putCiphertext(recipientBlob, file.name, 'recipient');
        const senderDirectUploadId = sender
          ? await putCiphertext(senderBlob, file.name, 'sender')
          : undefined;

        const finalizeRes = await client.post('/attachments/finalize', {
          pendingUploadId,
          recipientDirectUploadId,
          senderDirectUploadId,
        });
        attachmentId = finalizeRes.data.data.id;
      }

      const payload = JSON.stringify({
        type: 'story_reply',
        storyId: story.id,
        mediaType: story.mediaType,
        caption: story.caption || null,
        text: '',
        replyMediaKind: mediaKind,
       
      });

      const forRecipient = sealMessage(payload, recipientPublicKey);
      const forSender = sealMessage(payload, myPublicKey);

      const body = {
        to: String(group.user?.id),
        forRecipient,
        forSender,
        replyToStory: story.id,
      };
      if (attachmentId) body.attachmentId = attachmentId;

      await client.post('/messages', body);
      setGifPickerOpen(false);
      setGifQuery('');
      setGifResults([]);
      const label =
        mediaKind === 'voice'
          ? 'Voice reply sent'
          : mediaKind === 'gif'
            ? 'GIF reply sent'
            : mediaKind === 'image'
              ? 'Photo reply sent'
              : mediaKind === 'video'
                ? 'Video reply sent'
                : 'Reply sent';
      notifyReplySent(label);
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  }

  function handleReplyFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const kind = file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('audio/')
        ? 'audio'
        : 'image';
    sendStoryReplyMedia(file, { mediaKind: kind });
  }

  function clearReplyRecordingResources() {
    if (replyRecordTimerRef.current) {
      clearInterval(replyRecordTimerRef.current);
      replyRecordTimerRef.current = null;
    }
    if (replyMediaStreamRef.current) {
      replyMediaStreamRef.current.getTracks().forEach((t) => t.stop());
      replyMediaStreamRef.current = null;
    }
    replyMediaRecorderRef.current = null;
    replyRecordChunksRef.current = [];
    setReplyRecordSeconds(0);
    setReplyRecording(false);
  }

  async function startReplyVoiceRecording() {
    if (replyRecording || sendingReply) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError?.('Voice notes are not supported in this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      replyMediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      replyMediaRecorderRef.current = recorder;
      replyRecordChunksRef.current = [];
      replyRecordStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) replyRecordChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        clearReplyRecordingResources();
        onError?.('Voice recording failed');
      };
      recorder.onstop = async () => {
        const chunks = replyRecordChunksRef.current.slice();
        const type = (recorder.mimeType || 'audio/webm').split(';')[0];
        clearReplyRecordingResources();
        if (!chunks.length) return;
        const blob = new Blob(chunks, { type: type || 'audio/webm' });
        if (blob.size < 256) return;
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `story-reply-voice-${Date.now()}.${ext}`, {
          type: type || 'audio/webm',
        });
        const plainBytes = new Uint8Array(await blob.arrayBuffer());
        sendStoryReplyMedia(file, { plainBytes, mediaKind: 'voice' });
      };

      recorder.start(200);
      setReplyRecording(true);
      setReplyRecordSeconds(0);
      replyRecordTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - replyRecordStartedAtRef.current) / 1000);
        setReplyRecordSeconds(elapsed);
        if (elapsed >= 60) stopReplyVoiceRecording();
      }, 200);
    } catch {
      clearReplyRecordingResources();
      onError?.('Microphone permission is required for voice notes');
    }
  }

  function stopReplyVoiceRecording() {
    const recorder = replyMediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      clearReplyRecordingResources();
      return;
    }
    recorder.stop();
  }

  useEffect(() => {
    return () => {
      if (replyRecordTimerRef.current) clearInterval(replyRecordTimerRef.current);
      if (replyMediaStreamRef.current) {
        replyMediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  async function searchGifs(q) {
    setGifLoading(true);
    try {
      const { data } = await client.get('/gifs/search', { params: { q } });
      setGifResults(data.data || []);
    } catch {
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  }

  useEffect(() => {
    if (!gifPickerOpen) return undefined;
    const q = gifQuery.trim() || 'reaction';
    const timer = setTimeout(() => searchGifs(q), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gifPickerOpen, gifQuery]);

  async function handleReact(emoji) {
    if (reacting) return;
    try {
      setReacting(true);
      setReactionPickerOpen(false);

      const owner = users.find((u) => String(u.id) === String(group.user?.id));
      const ownerKeys = (owner?.publicKeys || []).filter(Boolean);
      if (!ownerKeys.length) {
        throw new Error("Can't react — missing this user's encryption keys");
      }

      const selfKeySet = getCurrentKeySet(currentUserId);
      const selfKeys = selfKeySet.map((k) => k.publicKey).filter(Boolean);
      if (!selfKeys.length) {
        throw new Error('Import your encryption keys before reacting');
      }

      const payload = JSON.stringify({
        type: 'story_reaction',
        storyId: story.id,
        mediaType: story.mediaType,
        emoji,
      });

      const forRecipient = sealMessage(payload, pickRandom(ownerKeys));
      const forSender = sealMessage(payload, pickRandom(selfKeys));

      await client.post('/messages', {
        to: String(group.user?.id),
        forRecipient,
        forSender,
        replyToStory: story.id,
      });

      setBurst(emoji);
      setTimeout(() => setBurst(null), 700);
    } catch (err) {
      onError?.(err.response?.data?.error || err.message || 'Failed to react');
    } finally {
      setReacting(false);
    }
  }

  const emojiResults = useMemo(
    () => (emojiQuery.trim() ? searchEmojis(emojiQuery, 60) : COMPOSER_EMOJIS.slice(0, 60)),
    [emojiQuery]
  );
  const reactionResults = useMemo(
    () => (reactionQuery.trim() ? searchEmojis(reactionQuery, 60) : COMPOSER_EMOJIS.slice(0, 60)),
    [reactionQuery]
  );
  function insertEmoji(emoji) {
    setReplyText((t) => t + emoji);
  }

  // Single tap left/right navigates; a second tap within the window is
  // treated as a double-tap "like" instead, so the pending nav is cancelled.
  const mediaClickTimerRef = useRef(null);

  function handleMediaClick(e) {
    if (mediaClickTimerRef.current) {
      clearTimeout(mediaClickTimerRef.current);
      mediaClickTimerRef.current = null;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const tappedRight = e.clientX - rect.left > rect.width / 2;

    mediaClickTimerRef.current = setTimeout(() => {
      mediaClickTimerRef.current = null;
      if (tappedRight) {
        if (index < group.items.length - 1) {
          setIndex((i) => i + 1);
        } else {
          onClose(); // tapped right on the last story — go outside
        }
      } else if (index > 0) {
        setIndex((i) => i - 1);
      }
      // tapping left on the first story is a no-op
    }, 250);
  }

  function handleMediaDoubleClick() {
    if (mediaClickTimerRef.current) {
      clearTimeout(mediaClickTimerRef.current);
      mediaClickTimerRef.current = null;
    }
    if (!isOwn) handleReact('❤️');
  }

  useEffect(() => {
    return () => {
      if (mediaClickTimerRef.current) clearTimeout(mediaClickTimerRef.current);
    };
  }, []);

  async function handleReshareStory() {
    if (resharing) return;
    if (!mediaBlob && !mediaUrl) {
      showToast('Status media is still loading...', 'info');
      return;
    }
    try {
      setResharing(true);
      let file;
      const ext =
        story.mediaType === 'video'
          ? 'mp4'
          : story.mediaType === 'audio'
            ? 'webm'
            : 'jpg';
      const defaultMime =
        story.mediaType === 'video'
          ? 'video/mp4'
          : story.mediaType === 'audio'
            ? 'audio/webm'
            : 'image/jpeg';

      if (mediaBlob) {
        file = new File([mediaBlob], `reshare-${story.id}.${ext}`, {
          type: mediaBlob.type || defaultMime,
        });
      } else {
        const resp = await fetch(mediaUrl);
        const b = await resp.blob();
        file = new File([b], `reshare-${story.id}.${ext}`, {
          type: b.type || defaultMime,
        });
      }

      onClose();
      onReshareStory?.(file);
    } catch (err) {
      showToast(err?.message || 'Failed to prepare story for reshare', 'error');
    } finally {
      setResharing(false);
    }
  }

  async function handleShareStory() {
    try {
      const shareUrl = `${window.location.origin}/chat?story=${story.id}`;
      const shareTitle = `${group.user?.username || 'User'}'s story on QuantumChat`;
      const shareText = story.caption ? `Check out this story: "${story.caption}"` : `Check out this story on QuantumChat!`;

      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl,
          });
          showToast('Story shared!', 'success');
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return; // User dismissed native share sheet
        }
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Story link copied to clipboard!', 'success');
      } else {
        showToast(shareUrl, 'info', 4000);
      }
    } catch {
      showToast('Could not copy story link', 'error');
    }
  }

  return createPortal(
    <div className="story-viewer-overlay" onClick={onClose}>
      <div className="story-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="story-viewer-top">
           <div className="story-viewer-user">
            <UserAvatar
              userId={group.user?.id}
              name={group.user?.username}
              hasAvatar={group.user?.hasAvatar}
              size="sm"
            />
            <div className="story-viewer-user-text">
              <span>{group.user?.username}</span>
              <span className="story-viewer-user-meta">
                {formatElapsed(story.createdAt)}
                {isOwn ? ` · ${formatRemaining(story.expiresAt)}` : ''}
              </span>
            </div>
            {story.sealed ? <span className="story-sealed-badge">Sealed X5</span> : null}
          </div>
          <div className="story-viewer-top-actions">
            {!isOwn && (
              <>
                <button
                  type="button"
                  className="story-viewer-share-btn"
                  onClick={handleReshareStory}
                  disabled={resharing}
                  aria-label="Reshare to your status"
                  title="Reshare to your status"
                >
                  <Repeat2 size={17} strokeWidth={2.2} aria-hidden />
                </button>
                <button
                  type="button"
                  className="story-viewer-share-btn"
                  onClick={handleShareStory}
                  aria-label="Share story link"
                  title="Share story link"
                >
                  <Share2 size={17} strokeWidth={2.2} aria-hidden />
                </button>
              </>
            )}
            <button type="button" onClick={onClose} aria-label="Close" title="Close">
              <X size={18} strokeWidth={2.4} aria-hidden />
            </button>
          </div>
        </div>
        <div className="story-viewer-progress">
          {group.items.map((s, i) => (
            <span key={s.id} className={i === index ? 'on' : ''} />
          ))}
        </div>
               <div
          className="story-viewer-media"
          onClick={handleMediaClick}
          onDoubleClick={handleMediaDoubleClick}
        >
          {blockedReason && (
            <div className="story-decrypt-error" role="alert">
              <p className="story-decrypt-error-title">Can’t open this story</p>
              <p>{blockedReason}</p>
            </div>
          )}
          {!blockedReason && !mediaUrl && (
            <div className="story-media-loading" aria-live="polite">
              <div className="skeleton skeleton-line story-media-loading-bar" />
              <p className="empty-hint">
                {loadPhase === 'decrypt'
                  ? 'Decrypting…'
                  : downloadPct != null && downloadPct > 0
                    ? `Downloading… ${downloadPct}%`
                    : slowLoad
                      ? 'Still loading — this one is taking longer than usual'
                      : 'Loading status…'}
              </p>
            </div>
          )}
          {mediaUrl && (story.mediaType === 'image' || story.mediaType === 'text') && <img src={mediaUrl} alt="" />}
          {mediaUrl && story.mediaType === 'video' && <video src={mediaUrl} autoPlay controls />}
          {mediaUrl && story.mediaType === 'audio' && <audio src={mediaUrl} autoPlay controls />}
          {burst && <span className="story-reaction-burst">{burst}</span>}
        </div>
        {story.caption && story.captionMode === 'free' && story.captionStyle && (
          <StoryCaptionOverlay caption={story.caption} style={story.captionStyle} editable={false} />
        )}
        {story.caption && story.captionMode !== 'free' && (
          <p className="story-caption">{story.caption}</p>
        )}
        {Array.isArray(story.mentions) && story.mentions.length > 0 && (
          <p className="story-mentions-line">
            with{' '}
            {story.mentions.map((m, i) => (
              <span key={m.user.id} className="mention-chip">
                {m.visibility === 'hidden' ? '🔒 ' : ''}
                @{m.user.username}
                {i < story.mentions.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        )}
        <div className="story-viewer-actions">
            {isOwn && (
              <div className="story-viewer-actions-left">
                <button
                  type="button"
                  className="story-viewers-btn"
                  onClick={() => setViewersOpen(true)}
                >
                  <Eye size={16} strokeWidth={2} />
                  <span>{viewerCount}</span>
                </button>
                <button
                  type="button"
                  className="story-highlight-btn"
                  disabled={!mediaUrl}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setSaveHighlightOpen(true);
                  }}
                >
                  <BookmarkPlus size={16} strokeWidth={2} />
                  <span>Highlight</span>
                </button>
                <button type="button" className="story-delete-btn" onClick={handleDelete}>
                  Delete
                </button>
              </div>
            )}
          </div>

       {isOwn && viewersOpen && (
          <StoryViewersSheet
            viewerCount={viewerCount}
            viewers={viewers}
            viewersHidden={viewersHidden}
            viewersHiddenReason={viewersHiddenReason}
            onClose={() => setViewersOpen(false)}
          />
        )}
        {isOwn && saveHighlightOpen && (
          <HighlightPickerSheet
            open={saveHighlightOpen}
            onClose={() => setSaveHighlightOpen(false)}
            onError={onError}
            mediaUrl={mediaUrl}
            mediaBlob={mediaBlob}
            story={story}
          />
        )}
       {!isOwn && story.allowReplies !== false && (
          <form
            className="story-reply-bar"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendReply();
            }}
          >
            {replySentFlash ? (
              <p className="story-reply-sent" role="status" aria-live="polite">
                {replySentFlash}
              </p>
            ) : null}
            <input
              ref={replyFileInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              hidden
              onChange={handleReplyFileChange}
            />
            <div className="story-reply-row-main">
              <button
                type="button"
                className="story-icon-btn"
                aria-label="Attach media"
                disabled={sendingReply || replyRecording}
                onClick={() => replyFileInputRef.current?.click()}
              >
                <Paperclip size={18} strokeWidth={2} />
              </button>

              <div className="story-reply-input-wrap">
                <textarea
                  ref={replyInputRef}
                  rows={1}
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value);
                    autoGrow(e.target);
                  }}
                  onKeyDown={handleReplyKeyDown}
                  placeholder={
                    replyRecording
                      ? `Recording ${String(Math.floor(replyRecordSeconds / 60)).padStart(2, '0')}:${String(replyRecordSeconds % 60).padStart(2, '0')}…`
                      : `Reply to ${group.user?.username}…`
                  }
                  disabled={sendingReply || replyRecording}
                />
                <button
                  type="button"
                  className={`story-emoji-btn ${emojiPickerOpen ? 'open' : ''}`}
                  aria-label={emojiPickerOpen ? 'Close emoji picker' : 'Add emoji to message'}
                  onClick={() => {
                    setEmojiPickerOpen((v) => !v);
                    setReactionPickerOpen(false);
                    setGifPickerOpen(false);
                  }}
                >
                  {emojiPickerOpen ? <X size={17} strokeWidth={2.2} /> : <Smile size={17} strokeWidth={2} />}
                </button>
              </div>

              {replyText.trim() ? (
                <button
                  type="submit"
                  disabled={sendingReply}
                  aria-label="Send reply"
                  className="story-reply-send ready"
                >
                  {sendingReply ? <span className="story-reply-spinner" /> : <Send size={16} strokeWidth={2.2} />}
                </button>
              ) : (
                <button
                  type="button"
                  className={`story-icon-btn ${replyRecording ? 'recording' : ''}`}
                  aria-label={replyRecording ? 'Stop recording' : 'Record a voice reply'}
                  disabled={sendingReply}
                  onClick={replyRecording ? stopReplyVoiceRecording : startReplyVoiceRecording}
                >
                  {replyRecording ? <Square size={17} strokeWidth={2.2} /> : <Mic size={18} strokeWidth={2} />}
                </button>
              )}

              <button
                type="button"
                className={`story-icon-btn ${reactionPickerOpen ? 'open' : ''}`}
                aria-label={reactionPickerOpen ? 'Close reactions' : 'Send a reaction'}
                disabled={reacting || replyRecording}
                onClick={() => {
                  setReactionPickerOpen((v) => !v);
                  setEmojiPickerOpen(false);
                  setGifPickerOpen(false);
                }}
              >
                {reactionPickerOpen ? <X size={17} strokeWidth={2.2} /> : '❤️'}
              </button>

              <button
                type="button"
                className={`story-icon-btn story-gif-btn ${gifPickerOpen ? 'open' : ''}`}
                aria-label={gifPickerOpen ? 'Close GIF picker' : 'Send a GIF'}
                disabled={sendingReply || replyRecording}
                onClick={() => {
                  setGifPickerOpen((v) => !v);
                  setEmojiPickerOpen(false);
                  setReactionPickerOpen(false);
                }}
              >
                {gifPickerOpen ? <X size={17} strokeWidth={2.2} /> : 'GIF'}
              </button>

              <button
                type="button"
                className="story-icon-btn"
                aria-label="Reshare to your status"
                title="Reshare to your status"
                onClick={handleReshareStory}
                disabled={resharing || sendingReply || replyRecording}
              >
                <Repeat2 size={17} strokeWidth={2.2} />
              </button>

              <button
                type="button"
                className="story-icon-btn"
                aria-label="Share story"
                title="Share story"
                onClick={handleShareStory}
                disabled={sendingReply || replyRecording}
              >
                <Share2 size={17} strokeWidth={2.2} />
              </button>
            </div>

            {emojiPickerOpen && (
              <div className="story-emoji-picker anchored-left">
                <div className="story-reaction-picker-header">
                  <input
                    type="text"
                    value={emojiQuery}
                    onChange={(e) => setEmojiQuery(e.target.value)}
                    placeholder="Search emoji"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="story-reaction-picker-close"
                    aria-label="Close"
                    onClick={() => setEmojiPickerOpen(false)}
                  >
                    <X size={15} strokeWidth={2.2} />
                  </button>
                </div>
                <div className="story-reaction-picker-grid">
                  {emojiResults.map((emoji) => (
                    <button key={emoji} type="button" onClick={() => insertEmoji(emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {reactionPickerOpen && (
              <div className="story-reaction-picker anchored-right">
                <div className="story-reaction-picker-header">
                  <input
                    type="text"
                    value={reactionQuery}
                    onChange={(e) => setReactionQuery(e.target.value)}
                    placeholder="Search emoji"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="story-reaction-picker-close"
                    aria-label="Close"
                    onClick={() => setReactionPickerOpen(false)}
                  >
                    <X size={15} strokeWidth={2.2} />
                  </button>
                </div>
                <div className="story-reaction-picker-grid">
                  {reactionResults.map((emoji) => (
                    <button key={emoji} type="button" onClick={() => handleReact(emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {gifPickerOpen && (
              <div className="story-reaction-picker anchored-right" style={{ width: 'min(320px, calc(100vw - 32px))' }}>
                <div className="story-reaction-picker-header">
                  <input
                    type="text"
                    value={gifQuery}
                    onChange={(e) => setGifQuery(e.target.value)}
                    placeholder="Search GIFs"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="story-reaction-picker-close"
                    aria-label="Close"
                    onClick={() => setGifPickerOpen(false)}
                  >
                    <X size={15} strokeWidth={2.2} />
                  </button>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 6,
                    maxHeight: 220,
                    overflow: 'auto',
                  }}
                >
                  {gifLoading && <p className="empty-hint" style={{ gridColumn: '1 / -1' }}>Searching…</p>}
                  {!gifLoading && gifResults.length === 0 && (
                    <p className="empty-hint" style={{ gridColumn: '1 / -1' }}>No GIFs found</p>
                  )}
                  {gifResults.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      style={{ padding: 0, border: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
                      disabled={sendingReply}
                      onClick={async () => {
                      try {
                        const resp = await fetch(gif.url);
                        if (!resp.ok) throw new Error('Could not download GIF');
                        const blob = await resp.blob();
                        const file = new File([blob], `gif-${Date.now()}.gif`, {
                          type: blob.type || 'image/gif',
                        });
                        await sendStoryReplyMedia(file, { mediaKind: 'gif' });
                      } catch (err) {
                        onError?.(err.message || 'Failed to send GIF — try again');
                      }
                    }}
                    >
                      <img
                        src={gif.previewUrl}
                        alt=""
                        style={{ width: '100%', height: 70, objectFit: 'cover', display: 'block' }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this story?"
        message="This story will be removed for everyone who can see it. This can’t be undone."
        confirmLabel="Delete story"
        cancelLabel="Keep story"
        danger
        busy={deleting}
        onCancel={() => {
          if (!deleting) setConfirmDelete(false);
        }}
        onConfirm={confirmDeleteStory}
      />
    </div>,
    document.body,
  );
}

function StoryComposer({
  file,
  previewUrl,
  friends = [],
  onCancel,
  onConfirm,
  uploading,
  uploadPhase,
  batchProgress,
  queueLength = 1,
  error,
  onError,
}) {
  const opts = useStoryPublishOptions(DEFAULT_TTL_MS);
  const [showPreview, setShowPreview] = useState(false);
  const [localError, setLocalError] = useState('');
  const imagePreviewRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const audioPreviewRef = useRef(null);

  const busyPostLabel =
    uploadPhase === 'compress'
      ? 'Compressing video…'
      : uploadPhase === 'upload'
        ? 'Uploading…'
        : 'Encrypting & posting…';

  const displayError = error || localError;

  useEffect(() => {
    setLocalError('');
  }, [file]);

  useEffect(() => {
    let safePreviewUrl = '';
    try {
      const parsed = new URL(previewUrl);
      if (parsed.protocol === 'blob:') safePreviewUrl = parsed.href;
    } catch {
      // Leave media sources unset for malformed preview URLs.
    }

    const previewElements = [
      imagePreviewRef.current,
      videoPreviewRef.current,
      audioPreviewRef.current,
    ].filter(Boolean);

    for (const element of previewElements) {
      if (safePreviewUrl) element.src = safePreviewUrl;
      else element.removeAttribute('src');
    }

    return () => {
      for (const element of previewElements) element.removeAttribute('src');
    };
  }, [previewUrl]);

  function reportError(message) {
    const text = String(message || 'Could not post story');
    setLocalError(text);
    onError?.(text);
  }

  async function submit(status) {
    if (uploading) return;
    setLocalError('');
    try {
      const options = opts.buildOptions(status);
      await onConfirm?.(opts.computeTtlMs(), opts.allowReplies, options);
    } catch (err) {
      reportError(err?.message || 'Could not save story');
    }
  }

  const isVideoFile =
    file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name || '');

  return createPortal(
    <div className="story-composer-overlay" onClick={uploading ? undefined : onCancel}>
      <div className="story-composer" onClick={(e) => e.stopPropagation()}>
        <div className="story-composer-top">
           <span>
            {queueLength > 1
              ? batchProgress
                ? `Posting ${batchProgress.done + 1} of ${batchProgress.total}…`
                : `New story (${queueLength} selected)`
              : 'New story'}
          </span>
          <button type="button" onClick={onCancel} aria-label="Cancel" disabled={uploading}>
            ×
          </button>
        </div>

        <div className="story-composer-preview" style={{ position: 'relative' }}>
          {file.type.startsWith('image/') && <img ref={imagePreviewRef} alt="" />}
          {isVideoFile && <video ref={videoPreviewRef} controls playsInline />}
          {file.type.startsWith('audio/') && <audio ref={audioPreviewRef} controls />}
          {opts.captionMode === 'free' && (
            <StoryCaptionOverlay
              caption={opts.caption}
              onCaptionChange={opts.setCaption}
              style={opts.captionStyle}
              onStyleChange={opts.setCaptionStyle}
            />
          )}
        </div>

        {displayError ? <p className="story-composer-error" role="alert">{displayError}</p> : null}

        <StoryPublishControls
          opts={opts}
          friends={friends}
          busy={uploading}
          canSubmit={!uploading}
          busyLabel={busyPostLabel}
          onPreview={() => setShowPreview(true)}
          onDraft={() => submit('draft')}
          onSchedule={() => submit('scheduled')}
          onPost={() => submit('published')}
        />

        <div className="story-composer-actions" style={{ paddingTop: 0 }}>
          <button type="button" className="story-composer-cancel" onClick={onCancel} disabled={uploading}>
            Cancel
          </button>
        </div>
      </div>
      {showPreview && (
        <StoryLocalPreview file={file} previewUrl={previewUrl} onClose={() => setShowPreview(false)} />
      )}
    </div>,
    document.body
  );
}