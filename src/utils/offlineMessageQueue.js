const DB_NAME = 'quantumchat-outbox';
const DB_VERSION = 1;
const KEY_STORE = 'keys';
const MESSAGE_STORE = 'messages';

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
       if (!db.objectStoreNames.contains(MESSAGE_STORE)) db.createObjectStore(MESSAGE_STORE);
     };
     request.onsuccess = () => resolve(request.result);
     request.onerror = () => reject(request.error || new Error('Could not open outbox'));
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

function getAll(db) {
   return new Promise((resolve, reject) => {
     const request = db.transaction(MESSAGE_STORE, 'readonly').objectStore(MESSAGE_STORE).getAll();
     request.onsuccess = () => resolve(request.result || []);
     request.onerror = () => reject(request.error);
   });
}

function put(db, id, value) {
   return new Promise((resolve, reject) => {
     const request = db.transaction(MESSAGE_STORE, 'readwrite').objectStore(MESSAGE_STORE).put(value, id);
     request.onsuccess = resolve;
     request.onerror = () => reject(request.error);
   });
}

function remove(db, id) {
   return new Promise((resolve, reject) => {
     const request = db.transaction(MESSAGE_STORE, 'readwrite').objectStore(MESSAGE_STORE).delete(id);
     request.onsuccess = resolve;
     request.onerror = () => reject(request.error);
   });
}

async function encryptEntry(db, entry) {
   const iv = crypto.getRandomValues(new Uint8Array(12));
   const key = await getKey(db);
   const ciphertext = await crypto.subtle.encrypt(
     { name: 'AES-GCM', iv },
     key,
     new TextEncoder().encode(JSON.stringify(entry)),
   );
   return { id: entry.id, iv, ciphertext };
}

async function decryptEntry(db, record) {
   try {
     const key = await getKey(db);
     const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, key, record.ciphertext);
     return JSON.parse(new TextDecoder().decode(plaintext));
   } catch {
     return null;
   }
}

export async function getOfflineMessages(userId, conversationKey) {
   if (!userId) return [];
   let db;
   try {
     db = await openDb();
     const entries = (await Promise.all((await getAll(db)).map((record) => decryptEntry(db, record))))
       .filter((entry) => entry?.userId === String(userId));
     return entries.filter((entry) => !conversationKey || entry.conversationKey === String(conversationKey));
   } catch {
     return [];
   } finally {
     db?.close();
   }
}

export async function getAllOfflineMessages(userId) {
   return getOfflineMessages(userId);
}

export async function saveOfflineMessage(userId, entry) {
   if (!userId || !entry?.id || !entry?.conversationKey || !entry?.payload) return;
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
    const outboxError = new Error('Offline message storage is unavailable');
    outboxError.code = 'OUTBOX_UNAVAILABLE';
    outboxError.cause = error;
    throw outboxError;
   } finally {
     db?.close();
   }
}

export async function removeOfflineMessage(userId, id) {
   if (!userId || !id) return;
   let db;
   try {
     db = await openDb();
     const entries = await getOfflineMessages(userId);
     if (entries.some((entry) => entry.id === id)) await remove(db, id);
   } catch {
     // Best-effort cleanup.
   } finally {
     db?.close();
   }
}
