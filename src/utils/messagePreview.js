/**
 * Utility to extract a clean, human-readable text preview from any message,
 * structured group payload, story reaction/reply, or call/meeting event.
 * Prevents raw serialized JSON payloads like `{"type":"story_reaction",...}`
 * or `{"__qc":1,"type":"announcement","body":"..."}` from leaking into the UI.
 */

export function getMessagePreviewText(input) {
  if (input == null) return '';
  if (typeof input === 'number') return String(input);

  let raw = '';
  let attachment = null;
  let kind = null;

  if (typeof input === 'string') {
    raw = input.trim();
  } else if (typeof input === 'object') {
    // If an object is already structured with type/body
    const directType = input.type || input.__type;
    if (directType) {
      const resolved = resolvePayloadType(input);
      if (resolved !== null) return resolved;
    }

    raw = (
      typeof input.text === 'string'
        ? input.text
        : typeof input.content === 'string'
          ? input.content
          : typeof input.body === 'string'
            ? input.body
            : ''
    ).trim();

    attachment = input.attachment;
    kind = input.kind;
  }

  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const resolved = resolvePayloadType(parsed);
        if (resolved !== null) return resolved;
      }
    } catch {
      // not valid JSON, proceed to treat as plain string
    }
  }

  if (raw) return raw;

  if (attachment && typeof attachment === 'object') {
    if (attachment.filename) return attachment.filename;
    const mime = String(attachment.mimetype || attachment.mimeType || attachment.type || '').toLowerCase();
    const mediaKind = attachment.mediaType || attachment.kind;
    if (mediaKind === 'image' || mime.startsWith('image/')) return 'Photo';
    if (mediaKind === 'video' || mime.startsWith('video/')) return 'Video';
    if (mediaKind === 'audio' || mime.startsWith('audio/')) return 'Voice note';
    return 'Attachment';
  }

  if (kind === 'ai_note') return 'Encrypted QuantumAI note';

  return '';
}

function resolvePayloadType(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const type = obj.type || obj.__type;

  switch (type) {
    case 'story_reaction':
      return obj.emoji ? `${obj.emoji} Reacted to story` : 'Reacted to story';

    case 'story_reply':
      if (obj.text && typeof obj.text === 'string' && obj.text.trim()) {
        return obj.text.trim();
      }
      if (obj.replyMediaKind) {
        if (obj.replyMediaKind === 'gif') return 'GIF';
        if (obj.replyMediaKind === 'voice') return 'Voice note';
        if (obj.replyMediaKind === 'video') return 'Video';
        if (obj.replyMediaKind === 'image') return 'Photo';
        return 'Attachment';
      }
      if (obj.caption && typeof obj.caption === 'string' && obj.caption.trim()) {
        return `Story: ${obj.caption.trim()}`;
      }
      return 'Replied to story';

    case 'announcement':
      return typeof obj.body === 'string' ? obj.body : (obj.text || 'Announcement');

    case 'poll':
      return typeof obj.question === 'string' && obj.question.trim()
        ? obj.question.trim()
        : 'Poll';

    case 'event':
      return typeof obj.title === 'string' && obj.title.trim()
        ? obj.title.trim()
        : typeof obj.notes === 'string' && obj.notes.trim()
          ? obj.notes.trim()
          : 'Event';

    case 'file':
      return typeof obj.filename === 'string' && obj.filename.trim()
        ? obj.filename.trim()
        : 'File';

    case 'gif':
      return 'GIF';

    case 'call':
      return obj.video ? 'Video call' : 'Voice call';

    case 'meeting':
      return obj.video ? 'Video meeting' : 'Voice meeting';

    case 'text':
      if (typeof obj.body === 'string') return obj.body;
      if (typeof obj.text === 'string') return obj.text;
      return null;

    default:
      if (typeof obj.body === 'string' && obj.body) {
        return getMessagePreviewText(obj.body);
      }
      if (typeof obj.text === 'string' && obj.text) {
        return getMessagePreviewText(obj.text);
      }
      if (typeof obj.message === 'string' && obj.message) {
        return getMessagePreviewText(obj.message);
      }
      return null;
  }
}
