const DB_NAME = 'quantumchat-media-outbox';
const DB_VERSION = 1;
const KEY_STORE = 'keys';
const MEDIA_STORE = 'media';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
      if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open media outbox'));
  });
}

async function getKey(db) {
  const existing = await new Promise((resolve, reject) => {
    const request = db.transaction(KEY_STORE, 'readonly').objectStore(KEY_STORE).get('device');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await new Promise((resolve, reject) => {
    const request = db.transaction(KEY_STORE, 'readwrite').objectStore(KEY_STORE).put(key, 'device');
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  return key;
}

function toBase64(bytes) {
  let binary = '';
  const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < value.length; i += 1) binary += String.fromCharCode(value[i]);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function put(db, id, record) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(MEDIA_STORE, 'readwrite').objectStore(MEDIA_STORE).put(record, id);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

function getAll(db) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(MEDIA_STORE, 'readonly').objectStore(MEDIA_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function remove(db, id) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(MEDIA_STORE, 'readwrite').objectStore(MEDIA_STORE).delete(id);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

async function encryptEntry(db, entry) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey(db);
  const plaintext = new TextEncoder().encode(JSON.stringify({
    ...entry,
    sourceBytes: toBase64(entry.sourceBytes),
  }));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { id: entry.id, iv, ciphertext };
}

async function decryptEntry(db, record) {
  try {
    const key = await getKey(db);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, key, record.ciphertext);
    const entry = JSON.parse(new TextDecoder().decode(plaintext));
    return { ...entry, sourceBytes: fromBase64(entry.sourceBytes) };
  } catch {
    return null;
  }
}

export async function saveOfflineMedia(userId, entry) {
  if (!userId || !entry?.id || !entry?.conversationKey || !entry?.sourceBytes) return;
  let db;
  try {
    db = await openDb();
    await put(db, entry.id, await encryptEntry(db, {
      ...entry,
      userId: String(userId),
      conversationKey: String(entry.conversationKey),
      queuedAt: entry.queuedAt || new Date().toISOString(),
    }));
  } catch (error) {
    const outboxError = new Error('Offline media storage is unavailable');
    outboxError.code = 'MEDIA_OUTBOX_UNAVAILABLE';
    outboxError.cause = error;
    throw outboxError;
  } finally {
    db?.close();
  }
}

export async function getOfflineMedia(userId) {
  if (!userId) return [];
  let db;
  try {
    db = await openDb();
    const records = await getAll(db);
    const entries = await Promise.all(records.map((record) => decryptEntry(db, record)));
    return entries.filter((entry) => entry?.userId === String(userId));
  } catch {
    return [];
  } finally {
    db?.close();
  }
}

export async function removeOfflineMedia(userId, id) {
  if (!userId || !id) return;
  let db;
  try {
    db = await openDb();
    const entries = await getOfflineMedia(userId);
    if (entries.some((entry) => entry.id === id)) await remove(db, id);
  } catch {
    // Best-effort cleanup after confirmed delivery.
  } finally {
    db?.close();
  }
}

export async function updateOfflineMedia(userId, id, patch) {
  if (!userId || !id || !patch) return;
  const entries = await getOfflineMedia(userId);
  const current = entries.find((entry) => entry.id === id);
  if (!current) return;
  await saveOfflineMedia(userId, { ...current, ...patch, id });
}
