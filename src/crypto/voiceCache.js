import client from '../api/client.js';
import { unsealBytes } from './keys.js';

export function attachmentIdOf(attachmentOrId) {
  if (!attachmentOrId) return null;
  if (typeof attachmentOrId === 'string') return attachmentOrId;
  return attachmentOrId.id != null
    ? String(attachmentOrId.id)
    : attachmentOrId._id != null
      ? String(attachmentOrId._id)
      : null;
}

/** Normalize API attachment docs so the UI always has `id` + envelope fields. */
export function normalizeAttachment(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return { id: raw };
  }
  const id = attachmentIdOf(raw);
  if (!id) return null;
  return {
    ...raw,
    id,
    filename: raw.filename || 'attachment',
    mimetype: raw.mimetype || 'application/octet-stream',
  };
}

/**
 * Pick the sealed-box envelope this device can open for an attachment.
 * Dual-sealed uploads: recipient copy + sender copy (5-key pools).
 */
export function pickAttachmentEnvelope(attachment, resolveSecretKey) {
  if (!attachment || !resolveSecretKey) return null;

  const senderTarget = attachment.forSenderTargetPublicKey;
  if (senderTarget && attachment.forSenderNonce && attachment.forSenderEphemeralPublicKey) {
    const secretKey = resolveSecretKey(senderTarget);
    if (secretKey) {
      return {
        secretKey,
        envelope: {
          nonce: attachment.forSenderNonce,
          ephemeralPublicKey: attachment.forSenderEphemeralPublicKey,
          targetPublicKey: senderTarget,
        },
      };
    }
  }

  if (attachment.targetPublicKey && attachment.nonce && attachment.ephemeralPublicKey) {
    const secretKey = resolveSecretKey(attachment.targetPublicKey);
    if (secretKey) {
      return {
        secretKey,
        envelope: {
          nonce: attachment.nonce,
          ephemeralPublicKey: attachment.ephemeralPublicKey,
          targetPublicKey: attachment.targetPublicKey,
        },
      };
    }
  }

  return null;
}

export function pickRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

/** Session caches — reopen chat / gallery reuse without re-download + decrypt. */
export const attachmentBlobCache = new Map();
export const attachmentUrlCache = new Map();
const attachmentInflight = new Map();

export function attachmentCacheKey(attachmentId, nonce = '') {
  return `${attachmentId}:${nonce || ''}`;
}

/**
 * Download + unseal a DM attachment once per session.
 * Concurrent callers (bubble + media modal) share the same in-flight promise.
 */
export async function resolveSealedAttachment({
  attachmentId,
  envelope,
  secretKey,
  mime = 'application/octet-stream',
  signal,
}) {
  if (!attachmentId || !envelope || !secretKey) {
    throw new Error('Cannot decrypt attachment');
  }
  const key = attachmentCacheKey(attachmentId, envelope.nonce);
  const cachedBlob = attachmentBlobCache.get(key);
  if (cachedBlob) {
    let url = attachmentUrlCache.get(key);
    if (!url) {
      url = URL.createObjectURL(cachedBlob);
      attachmentUrlCache.set(key, url);
    }
    return { blob: cachedBlob, url, fromCache: true };
  }

  const existing = attachmentInflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const res = await client.get(`/attachments/${attachmentId}/raw`, {
      responseType: 'arraybuffer',
      signal,
      timeout: 90_000,
    });
    const plainBytes = unsealBytes(new Uint8Array(res.data), envelope, secretKey);
    if (!plainBytes) throw new Error('Decrypt failed');
    const blob = new Blob([plainBytes], { type: mime });
    const url = URL.createObjectURL(blob);
    attachmentBlobCache.set(key, blob);
    attachmentUrlCache.set(key, url);
    return { blob, url, fromCache: false };
  })().finally(() => {
    attachmentInflight.delete(key);
  });

  attachmentInflight.set(key, promise);
  return promise;
}

/** Group secretbox attachments (shared key in message payload). */
export async function resolveGroupAttachment({
  attachmentId,
  keyB64,
  nonce,
  mime = 'application/octet-stream',
  signal,
  openFn,
}) {
  if (!attachmentId || !keyB64 || !nonce || !openFn) {
    throw new Error('Cannot decrypt group attachment');
  }
  const key = attachmentCacheKey(attachmentId, `g:${nonce}`);
  const cachedBlob = attachmentBlobCache.get(key);
  if (cachedBlob) {
    let url = attachmentUrlCache.get(key);
    if (!url) {
      url = URL.createObjectURL(cachedBlob);
      attachmentUrlCache.set(key, url);
    }
    return { blob: cachedBlob, url, fromCache: true };
  }

  const existing = attachmentInflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const res = await client.get(`/attachments/${attachmentId}/raw`, {
      responseType: 'arraybuffer',
      signal,
      timeout: 90_000,
    });
    const plain = openFn(new Uint8Array(res.data), nonce, keyB64);
    if (!plain) throw new Error('Decrypt failed');
    const blob = new Blob([plain], { type: mime });
    const url = URL.createObjectURL(blob);
    attachmentBlobCache.set(key, blob);
    attachmentUrlCache.set(key, url);
    return { blob, url, fromCache: false };
  })().finally(() => {
    attachmentInflight.delete(key);
  });

  attachmentInflight.set(key, promise);
  return promise;
}
