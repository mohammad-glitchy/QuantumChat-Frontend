const MUTE_PREFIX = 'qc_muted_chats_';
const ARCHIVE_PREFIX = 'qc_archived_chats_';
const PIN_PREFIX = 'qc_pinned_chats_';
const DRAFT_PREFIX = 'qc_draft_';
const DRAFT_DB_NAME = 'quantumchat-drafts';
const DRAFT_DB_VERSION = 1;
const DRAFT_KEY_STORE = 'keys';
const DRAFT_VALUE_STORE = 'values';
const INFO_PANEL_KEY = 'qc_info_panel_open';
const LAST_REACTION_KEY = 'qc_last_quick_reaction';

function draftKey(userId, conversationKey) {
  return `${DRAFT_PREFIX}${userId}_${conversationKey}`;
}

function removeLegacyDraft(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup errors.
  }
}

function openDraftDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DRAFT_DB_NAME, DRAFT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFT_KEY_STORE)) db.createObjectStore(DRAFT_KEY_STORE);
      if (!db.objectStoreNames.contains(DRAFT_VALUE_STORE)) db.createObjectStore(DRAFT_VALUE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open draft storage'));
  });
}

async function getDraftKey(db) {
  const existing = await new Promise((resolve, reject) => {
    const request = db.transaction(DRAFT_KEY_STORE, 'readonly').objectStore(DRAFT_KEY_STORE).get('device');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  await new Promise((resolve, reject) => {
    const request = db.transaction(DRAFT_KEY_STORE, 'readwrite').objectStore(DRAFT_KEY_STORE).put(key, 'device');
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  return key;
}

function readDraftValue(db, key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(DRAFT_VALUE_STORE, 'readonly').objectStore(DRAFT_VALUE_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function writeDraftValue(db, key, value) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(DRAFT_VALUE_STORE, 'readwrite').objectStore(DRAFT_VALUE_STORE).put(value, key);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

function deleteDraftValue(db, key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(DRAFT_VALUE_STORE, 'readwrite').objectStore(DRAFT_VALUE_STORE).delete(key);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

function readList(prefix, userId) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(prefix + userId);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeList(prefix, userId, list) {
  localStorage.setItem(prefix + userId, JSON.stringify(list));
  return list;
}

export function getMutedChatKeys(userId) {
  return readList(MUTE_PREFIX, userId);
}

export function isChatMuted(userId, conversationKey) {
  return getMutedChatKeys(userId).includes(String(conversationKey));
}

export function muteChat(userId, conversationKey) {
  const next = new Set(getMutedChatKeys(userId));
  next.add(String(conversationKey));
  return writeList(MUTE_PREFIX, userId, [...next]);
}

export function unmuteChat(userId, conversationKey) {
  return writeList(
    MUTE_PREFIX,
    userId,
    getMutedChatKeys(userId).filter((k) => k !== String(conversationKey))
  );
}

export function toggleMuteChat(userId, conversationKey) {
  if (isChatMuted(userId, conversationKey)) return unmuteChat(userId, conversationKey);
  return muteChat(userId, conversationKey);
}

export function getArchivedChatKeys(userId) {
  return readList(ARCHIVE_PREFIX, userId);
}

export function isChatArchived(userId, conversationKey) {
  return getArchivedChatKeys(userId).includes(String(conversationKey));
}

export function archiveChat(userId, conversationKey) {
  const next = new Set(getArchivedChatKeys(userId));
  next.add(String(conversationKey));
  return writeList(ARCHIVE_PREFIX, userId, [...next]);
}

export function unarchiveChat(userId, conversationKey) {
  return writeList(
    ARCHIVE_PREFIX,
    userId,
    getArchivedChatKeys(userId).filter((k) => k !== String(conversationKey))
  );
}

export function toggleArchiveChat(userId, conversationKey) {
  if (isChatArchived(userId, conversationKey)) return unarchiveChat(userId, conversationKey);
  return archiveChat(userId, conversationKey);
}

export function getPinnedChatKeys(userId) {
  return readList(PIN_PREFIX, userId);
}

export function isChatPinned(userId, conversationKey) {
  return getPinnedChatKeys(userId).includes(String(conversationKey));
}

export function pinChat(userId, conversationKey) {
  const next = new Set(getPinnedChatKeys(userId));
  next.add(String(conversationKey));
  return writeList(PIN_PREFIX, userId, [...next]);
}

export function unpinChat(userId, conversationKey) {
  return writeList(
    PIN_PREFIX,
    userId,
    getPinnedChatKeys(userId).filter((k) => k !== String(conversationKey))
  );
}

export function togglePinChat(userId, conversationKey) {
  if (isChatPinned(userId, conversationKey)) return unpinChat(userId, conversationKey);
  return pinChat(userId, conversationKey);
}


export async function getChatDraft(userId, conversationKey) {
  if (!userId || !conversationKey) return '';
  let db;
  try {
    const key = draftKey(userId, conversationKey);
    removeLegacyDraft(key);
    db = await openDraftDb();
    const record = await readDraftValue(db, key);
    if (!record?.ciphertext || !record?.iv) return '';
    const encryptionKey = await getDraftKey(db);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: record.iv },
      encryptionKey,
      record.ciphertext,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return '';
  } finally {
    db?.close();
  }
}

export async function saveChatDraft(userId, conversationKey, text) {
  if (!userId || !conversationKey) return;
  let db;
  try {
    const key = draftKey(userId, conversationKey);
    removeLegacyDraft(key);
    db = await openDraftDb();
    if (!String(text || '').length) {
      await deleteDraftValue(db, key);
      return;
    }
    const encryptionKey = await getDraftKey(db);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      encryptionKey,
      new TextEncoder().encode(String(text)),
    );
    await writeDraftValue(db, key, { ciphertext, iv });
  } catch {
    // Ignore storage errors; sending messages must still work.
  } finally {
    db?.close();
  }
}

export function getInfoPanelOpen() {
  try {
    return localStorage.getItem(INFO_PANEL_KEY) === '1';
  } catch {
    return false;
  }
}

export function setInfoPanelOpen(open) {
  try {
    localStorage.setItem(INFO_PANEL_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
  return Boolean(open);
}

export function getLastQuickReaction() {
  try {
    return localStorage.getItem(LAST_REACTION_KEY) || '❤️';
  } catch {
    return '❤️';
  }
}

export function setLastQuickReaction(emoji) {
  try {
    if (emoji) localStorage.setItem(LAST_REACTION_KEY, String(emoji));
  } catch {
    /* ignore */
  }
  return emoji;
}
