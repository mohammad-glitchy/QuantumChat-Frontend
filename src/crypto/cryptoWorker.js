// Runs the existing sealBytes/secretboxSeal (unchanged, same file, same
// algorithm) off the main thread. Only large file encryption goes through
// here — text messages stay on the main thread since they're instant anyway.
import { sealBytes, secretboxSeal } from './keys.js';

self.onmessage = (event) => {
  const { id, type, bytes, targetPublicKeyHex } = event.data;
  try {
    const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let result;
    if (type === 'sealBytes') {
      result = sealBytes(input, targetPublicKeyHex);
    } else if (type === 'secretboxSeal') {
      result = secretboxSeal(input);
    } else {
      throw new Error(`Unknown worker task: ${type}`);
    }
    // Transfer the freshly-created ciphertext buffer back — it's not
    // referenced anywhere else, so this avoids a second full copy of a
    // potentially large video's ciphertext.
    const transfer = result?.cipherBytes ? [result.cipherBytes.buffer] : [];
    self.postMessage({ id, ok: true, result }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: err?.message || String(err) });
  }
};