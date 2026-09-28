import { linkifyText } from './linkify.js';

function isMediaMime(mime = '') {
  const value = String(mime || '').toLowerCase();
  return value.startsWith('image/') || value.startsWith('video/') || value.startsWith('audio/');
}

function attachNameFrom(attachment = null) {
  if (!attachment || typeof attachment !== 'object') return '';
  return String(attachment.filename || attachment.fileName || attachment.name || '').trim().toLowerCase();
}

export function hasDocumentAttachment(attachment) {
  if (!attachment) return false;
  if (Array.isArray(attachment)) {
    return attachment.some((item) => hasDocumentAttachment(item));
  }

  const raw = typeof attachment === 'object' ? attachment : { filename: String(attachment) };
  const filename = attachNameFrom(raw);
  const mime = String(raw.mimetype || raw.mimeType || raw.type || '').toLowerCase();
  const ext = filename.includes('.') ? filename.split('.').pop() : '';

  if (!filename && !mime) return false;
  if (isMediaMime(mime) || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'avif', 'mp4', 'mov', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'].includes(ext)) {
    return false;
  }

  if (
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.includes('zip') ||
    mime.includes('text/') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    mime.includes('csv') ||
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'md', 'json', 'xml', 'zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
  ) {
    return true;
  }

  return Boolean(filename || mime) && !isMediaMime(mime);
}

export function containsLinkText(value) {
  const text = String(value || '');
  if (!text.trim()) return false;
  return linkifyText(text).some((token) => token.type === 'url' && Boolean(token.value));
}

export function getAutomaticImportantSource(message = {}) {
  const attachment = message?.attachment || (Array.isArray(message?.attachments) ? message.attachments[0] : null);
  if (hasDocumentAttachment(attachment)) return 'document';
  if (containsLinkText(message?.text || message?.content)) return 'link';
  return null;
}

export function isAutomaticImportantMessage(message = {}) {
  return Boolean(getAutomaticImportantSource(message));
}

export function normalizeImportantEntries(entries = []) {
  const byId = new Map();

  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry) continue;
    const id = entry.id ?? entry._id;
    if (id == null) continue;

    const key = String(id);
    const current = byId.get(key) || {
      ...entry,
      id: key,
      isStarred: false,
      isImportant: false,
      reasons: [],
      importantSource: null,
    };

    const next = {
      ...current,
      ...entry,
      id: key,
      isStarred: Boolean(current.isStarred || entry.isStarred || entry.starredAt || entry.starred),
      isImportant: Boolean(current.isImportant || entry.isImportant || entry.important || entry.importantAt),
      importantSource: entry.importantSource || current.importantSource || null,
    };

    next.reasons = [];
    if (next.isStarred) next.reasons.push('Starred');
    if (next.isImportant) next.reasons.push('Important');
    byId.set(key, next);
  }

  return [...byId.values()].sort((a, b) => {
    const at = new Date(a.createdAt || a.starredAt || a.importantAt || 0).getTime();
    const bt = new Date(b.createdAt || b.starredAt || b.importantAt || 0).getTime();
    return bt - at;
  });
}

export function filterImportantEntries(entries = [], filter = 'all', query = '') {
  const normal = normalizeImportantEntries(entries);
  const normalizedQuery = String(query || '').trim().toLowerCase();

  const filtered = normal.filter((entry) => {
    if (filter === 'starred' && !entry.isStarred) return false;
    if (filter === 'important' && !entry.isImportant) return false;
    if (!normalizedQuery) return true;

    const haystacks = [
      entry.text,
      entry.title,
      entry.conversationTitle,
      entry.conversationName,
      entry.senderName,
      entry.from,
    ].filter(Boolean).map((value) => String(value).toLowerCase());

    return haystacks.some((value) => value.includes(normalizedQuery));
  });

  return filtered;
}

export function isImportantEntry(entries = [], messageId) {
  return (Array.isArray(entries) ? entries : [])
    .some((entry) =>
      String(entry?.id ?? entry?._id) === String(messageId) &&
      Boolean(entry?.isImportant || entry?.important || entry?.importantAt),
    );
}

export function addImportantEntry(entries = [], entry) {
  if (!entry || (entry.id == null && entry._id == null)) return entries;
  const id = String(entry.id ?? entry._id);
  const existing = Array.isArray(entries)
    ? entries.find((item) => String(item?.id ?? item?._id) === id)
    : null;
  return [
    { ...existing, ...entry, id, important: true, isImportant: true, importantAt: entry.importantAt || existing?.importantAt || new Date().toISOString(), importantSource: entry.importantSource || existing?.importantSource || null },
    ...(Array.isArray(entries) ? entries.filter((item) => String(item?.id ?? item?._id) !== id) : []),
  ];
}

export function removeImportantEntry(entries = [], messageId) {
  return (Array.isArray(entries) ? entries : [])
    .flatMap((entry) => {
      if (String(entry?.id ?? entry?._id) !== String(messageId)) return [entry];
      if (entry.starredAt || entry.isStarred || entry.starred) {
        const next = { ...entry };
        delete next.important;
        delete next.isImportant;
        delete next.importantAt;
        delete next.importantSource;
        return [next];
      }
      return [];
    });
}
