// Local-only message extras (do not affect E2E ciphertext on the server).
const STARRED_DATA_SUFFIX = 'starred-data';
function key(userId, suffix) {
  return `qc:${suffix}:${userId}`;
}

function readSet(userId, suffix) {
  try {
    const raw = localStorage.getItem(key(userId, suffix));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}
function readStarredEntries(userId) {
  try {
    const raw = localStorage.getItem(key(userId, STARRED_DATA_SUFFIX));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function writeStarredEntries(userId, entries) {
  localStorage.setItem(key(userId, STARRED_DATA_SUFFIX), JSON.stringify(entries));
}

export function getStarredEntries(userId) {
  return readStarredEntries(userId);
}
export function getStarredIds(userId) {
  return readStarredEntries(userId).map((e) => e.id);
}

export function isStarredMessage(userId, messageId) {
  return readStarredEntries(userId).some((e) => String(e.id) === String(messageId));
}

function writeSet(userId, suffix, set) {
  localStorage.setItem(key(userId, suffix), JSON.stringify([...set]));
}

export function getAutoImportantRemovedIds(userId) {
  return [...readSet(userId, 'auto-important-removed')];
}

export function rememberAutoImportantRemoval(userId, messageId) {
  const set = readSet(userId, 'auto-important-removed');
  set.add(String(messageId));
  writeSet(userId, 'auto-important-removed', set);
  return [...set];
}

export function clearAutoImportantRemoval(userId, messageId) {
  const set = readSet(userId, 'auto-important-removed');
  set.delete(String(messageId));
  writeSet(userId, 'auto-important-removed', set);
  return [...set];
}

export function getDeletedForMeIds(userId) {
  return [...readSet(userId, 'deleted-for-me')];
}

export function deleteMessageForMe(userId, messageId) {
  const set = readSet(userId, 'deleted-for-me');
  set.add(String(messageId));
  writeSet(userId, 'deleted-for-me', set);
  return [...set];
}

export function isDeletedForMe(userId, messageId) {
  return readSet(userId, 'deleted-for-me').has(String(messageId));
}


export function clearAllStarred(userId) {
  writeStarredEntries(userId, []);
  return [];
}

/** Replace the full starred list (used to undo a clear). */
export function restoreStarredEntries(userId, entries) {
  const next = Array.isArray(entries) ? entries : [];
  writeStarredEntries(userId, next);
  return next.map((e) => e.id);
}

export function toggleStarredMessage(userId, message, conversation) {
  const id = String(message?.id || message?._id || message);
  const entries = readStarredEntries(userId);
  const exists = entries.some((e) => String(e.id) === id);
  let next;
  if (exists) {
    next = entries.filter((e) => String(e.id) !== id);
  } else {
    next = [
      {
        id,
        conversationKey: conversation?.key || null,
        type: conversation?.type || 'dm',
        conversationId: conversation?.id || null,
        title: conversation?.title || 'Chat',
        from: message?.from ?? null,
        text: message?.text ?? null,
        hasAttachment: Boolean(message?.attachment),
        attachmentFilename: message?.attachment?.filename || null,
        createdAt: message?.createdAt || null,
        starredAt: new Date().toISOString(),
      },
      ...entries,
    ];
  }
  writeStarredEntries(userId, next);
  return next.map((e) => e.id);
}



/** Pins are scoped per conversation key (dm:userId or group:groupId). */
export function getPinnedIds(userId, conversationKey) {
  return [...readSet(userId, `pinned:${conversationKey}`)];
}

export function togglePinnedMessage(userId, conversationKey, messageId) {
  const set = readSet(userId, `pinned:${conversationKey}`);
  const id = String(messageId);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  writeSet(userId, `pinned:${conversationKey}`, set);
  return [...set];
}

export function isPinnedMessage(userId, conversationKey, messageId) {
  return readSet(userId, `pinned:${conversationKey}`).has(String(messageId));
}
