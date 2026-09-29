import client from '../api/client.js';
import { unsealMessage } from '../crypto/keys.js';
import { findSecretKeyForPublicKey, getKeyring } from '../crypto/keyStorage.js';

function base64ToBytes(b64) {
  const normalized = String(b64 || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/\s/g, '');
  const bin = atob(normalized);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export async function aesGcmDecryptBytes(cipherBytes, keyB64, ivB64) {
  const key = await crypto.subtle.importKey('raw', base64ToBytes(keyB64), { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivB64) },
    key,
    cipherBytes,
  );
  return new Uint8Array(plain);
}

function envelopeUserId(envelope) {
  return String(envelope?.user?.id || envelope?.user || '');
}

function tryParseKeyPayload(text) {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed?.keyB64 && parsed?.ivB64) return parsed;
  } catch {
    // ignore
  }
  return null;
}

/**
 * Open the AES media key from any of this viewer's story envelopes.
 * Returns { ok: true, payload } on success, or { ok: false, reason, targetPublicKey? }.
 */
export function unlockStoryKey(story, currentUserId) {
  const uid = String(currentUserId?.id || currentUserId || '');
  if (!uid) return { ok: false, reason: 'no-envelope' };

  const envelopes = (story.envelopes || []).filter((e) => envelopeUserId(e) === uid);
  if (!envelopes.length) return { ok: false, reason: 'no-envelope' };

  const ring = getKeyring(uid);

  for (const envelope of envelopes) {
    const hinted = envelope.targetPublicKey
      ? findSecretKeyForPublicKey(uid, envelope.targetPublicKey)
      : null;

    if (hinted) {
      try {
        const payload = tryParseKeyPayload(unsealMessage(envelope, hinted));
        if (payload) return { ok: true, payload };
      } catch {
        // try next key
      }
    }

    for (const entry of ring) {
      if (hinted && entry.secretKey === hinted) continue;
      try {
        const payload = tryParseKeyPayload(unsealMessage(envelope, entry.secretKey));
        if (payload) return { ok: true, payload };
      } catch {
        // try next key
      }
    }
  }

  return { ok: false, reason: 'no-secret', targetPublicKey: envelopes[0]?.targetPublicKey };
}

export function viewerCanSeeStory(story, currentUserId) {
  if (!story?.sealed) return true;
  const uid = String(currentUserId?.id || currentUserId || '');
  return (story.envelopes || []).some((e) => envelopeUserId(e) === uid);
}

/** Session cache of decrypted story object URLs — reopening a status is instant. */
export const storyMediaCache = new Map();
/** Parallel blob cache so highlights can upload without re-fetching. */
export const storyMediaBlobCache = new Map();

/**
 * In-flight downloads keyed by cache key.
 * Shared across viewer + prefetch, but NOT tied to any single AbortSignal —
 * aborting one viewer must not strand other waiters (or a Strict-Mode remount)
 * on a forever "Still loading…" state.
 */
const storyInflight = new Map();

export function cacheKeyForStory(story) {
  return `${story.id}:${story.sealed ? '1' : '0'}:${story.contentIv || ''}`;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}

/**
 * Fetch + (if needed) decrypt a story's media and return a Blob.
 * Concurrent callers share one network round-trip per story.
 * Caller abort only cancels *that* waiter's result — the download continues
 * so a remount / prefetch can still finish and populate the cache.
 */
export async function resolveStoryMediaBlob(story, currentUserId, options = {}) {
  const { signal, onDownloadProgress, precomputedUnlock } = options;
  const cacheKey = cacheKeyForStory(story);
  const cachedBlob = storyMediaBlobCache.get(cacheKey);
  if (cachedBlob) {
    throwIfAborted(signal);
    return cachedBlob;
  }

  throwIfAborted(signal);

  let entry = storyInflight.get(cacheKey);
  if (!entry) {
    const promise = (async () => {
      if (story.sealed) {
        const unlocked = precomputedUnlock || unlockStoryKey(story, currentUserId);
        const ivB64 = unlocked?.payload?.ivB64 || story.contentIv;
        if (!unlocked?.ok || !unlocked?.payload?.keyB64 || !ivB64) {
          throw new Error('No decryption key available for this story');
        }
        const res = await client.get(`/stories/${story.id}/media`, {
          responseType: 'arraybuffer',
          timeout: 45_000,
          onDownloadProgress,
        });
        const cipherBytes = new Uint8Array(res.data);
        const plain = await aesGcmDecryptBytes(
          cipherBytes,
          unlocked.payload.keyB64,
          ivB64,
        );
        const blob = new Blob([plain], {
          type: story.mimetype || 'application/octet-stream',
        });
        if (!storyMediaCache.has(cacheKey)) {
          storyMediaCache.set(cacheKey, URL.createObjectURL(blob));
        }
        storyMediaBlobCache.set(cacheKey, blob);
        return blob;
      }

      const res = await client.get(`/stories/${story.id}/media`, {
        responseType: 'blob',
        timeout: 45_000,
        onDownloadProgress,
      });
      const blob = res.data;
      if (!storyMediaCache.has(cacheKey)) {
        storyMediaCache.set(cacheKey, URL.createObjectURL(blob));
      }
      storyMediaBlobCache.set(cacheKey, blob);
      return blob;
    })().finally(() => {
      storyInflight.delete(cacheKey);
    });

    entry = { promise };
    storyInflight.set(cacheKey, entry);
  }

  // If this waiter aborts, reject locally without cancelling the shared fetch.
  let blob;
  if (!signal) {
    blob = await entry.promise;
  } else {
    blob = await Promise.race([
      entry.promise,
      new Promise((_, reject) => {
        if (signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      }),
    ]);
  }

  throwIfAborted(signal);
  return blob;
}
