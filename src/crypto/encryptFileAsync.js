// Thin request/response wrapper around cryptoWorker.js. Deliberately does
// NOT transfer the input bytes' buffer — a DM file needs the same
// plaintext sealed twice (once per recipient key), and transferring would
// detach the buffer after the first call.
let worker;
let nextId = 1;
const pending = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./cryptoWorker.js', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event) => {
      const { id, ok, result, error } = event.data;
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      if (ok) entry.resolve(result);
      else entry.reject(new Error(error));
    };
    worker.onerror = (event) => {
      // A script-level worker error otherwise leaves any in-flight caller
      // waiting forever — fail them all so the UI can show an error.
      for (const entry of pending.values()) {
        entry.reject(new Error(event.message || 'Encryption worker failed'));
      }
      pending.clear();
    };
  }
  return worker;
}

function runInWorker(type, bytes, targetPublicKeyHex) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, type, bytes, targetPublicKeyHex });
  });
}

export function sealBytesAsync(bytes, targetPublicKeyHex) {
  return runInWorker('sealBytes', bytes, targetPublicKeyHex);
}

export function secretboxSealAsync(bytes) {
  return runInWorker('secretboxSeal', bytes);
}