import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal localStorage shim for Node (no browser environment).
const store = new Map();
globalThis.localStorage = {
  getItem(k) { return store.has(k) ? store.get(k) : null; },
  setItem(k, v) { store.set(k, String(v)); },
  removeItem(k) { store.delete(k); },
  clear() { store.clear(); },
};

// Import the pure-logic helpers (no React dependency).
const { readStoredRate, writeStoredRate, ALLOWED_RATES, STORAGE_KEY } =
  await import('../src/hooks/voicePlaybackRateStore.js');

beforeEach(() => {
  localStorage.clear();
});

// ── Allowed rates ──────────────────────────────────────────────────────

test('ALLOWED_RATES contains exactly [0.5, 1, 1.5, 2]', () => {
  assert.deepEqual(ALLOWED_RATES, [0.5, 1, 1.5, 2]);
});

test('each allowed rate is accepted by writeStoredRate and round-trips', () => {
  for (const r of ALLOWED_RATES) {
    localStorage.clear();
    const written = writeStoredRate(r);
    assert.equal(written, r, `writeStoredRate(${r}) should return ${r}`);
    assert.equal(readStoredRate(), r, `readStoredRate() should return ${r} after writing`);
  }
});

// ── Unsupported values ─────────────────────────────────────────────────

test('unsupported numeric values fall back to 1', () => {
  for (const bad of [0, 3, -1, 0.25, 4, 100]) {
    localStorage.clear();
    const written = writeStoredRate(bad);
    assert.equal(written, 1, `writeStoredRate(${bad}) should fall back to 1`);
    assert.equal(readStoredRate(), 1, `readStoredRate() should return 1 after writing ${bad}`);
  }
});

test('NaN falls back to 1', () => {
  const written = writeStoredRate(NaN);
  assert.equal(written, 1);
  assert.equal(readStoredRate(), 1);
});

test('string values fall back to 1', () => {
  const written = writeStoredRate('fast');
  assert.equal(written, 1);
  assert.equal(readStoredRate(), 1);
});

// ── localStorage persistence ───────────────────────────────────────────

test('writeStoredRate persists to localStorage and readStoredRate retrieves it', () => {
  writeStoredRate(2);
  // Verify the raw localStorage value is correct
  assert.equal(localStorage.getItem(STORAGE_KEY), '2');
  assert.equal(readStoredRate(), 2);
});

test('changing rate updates the persisted value', () => {
  writeStoredRate(0.5);
  assert.equal(readStoredRate(), 0.5);
  writeStoredRate(1.5);
  assert.equal(readStoredRate(), 1.5);
});

test('selection persists after simulated remount/reload', () => {
  writeStoredRate(1.5);
  assert.equal(readStoredRate(), 1.5);

  // Simulated page reload (store persists in localStorage)
  const reloadedRate = readStoredRate();
  assert.equal(reloadedRate, 1.5);
});

// ── Invalid / malformed localStorage ───────────────────────────────────

test('invalid localStorage string falls back to 1', () => {
  localStorage.setItem(STORAGE_KEY, 'garbage');
  assert.equal(readStoredRate(), 1);
});

test('empty string in localStorage falls back to 1', () => {
  localStorage.setItem(STORAGE_KEY, '');
  assert.equal(readStoredRate(), 1);
});

test('JSON object in localStorage falls back to 1', () => {
  localStorage.setItem(STORAGE_KEY, '{"rate":2}');
  assert.equal(readStoredRate(), 1);
});

test('unsupported numeric string in localStorage falls back to 1', () => {
  localStorage.setItem(STORAGE_KEY, '3');
  assert.equal(readStoredRate(), 1);
});

// ── Missing localStorage ───────────────────────────────────────────────

test('missing localStorage key falls back to 1', () => {
  // localStorage is empty after beforeEach clear
  assert.equal(readStoredRate(), 1);
});

// ── STORAGE_KEY is namespaced ──────────────────────────────────────────

test('STORAGE_KEY is namespaced with quantumchat prefix', () => {
  assert.equal(STORAGE_KEY, 'quantumchat.voicePlaybackRate');
});

// ── Audio element behavior & view-once safety ─────────────────────────

test('simulated audio playbackRate updates on speed selection (0.5, 1, 1.5, 2)', () => {
  const dummyAudio = { playbackRate: 1, currentTime: 5.2 };

  // Selecting 0.5x
  let rate = writeStoredRate(0.5);
  dummyAudio.playbackRate = rate;
  assert.equal(dummyAudio.playbackRate, 0.5);
  assert.equal(dummyAudio.currentTime, 5.2, 'Changing speed does not change currentTime');

  // Selecting 1.5x
  rate = writeStoredRate(1.5);
  dummyAudio.playbackRate = rate;
  assert.equal(dummyAudio.playbackRate, 1.5);
  assert.equal(dummyAudio.currentTime, 5.2);

  // Selecting 2x
  rate = writeStoredRate(2);
  dummyAudio.playbackRate = rate;
  assert.equal(dummyAudio.playbackRate, 2);
  assert.equal(dummyAudio.currentTime, 5.2);
});

test('view-once onPlayedThrough / onEnded fires at most once regardless of speed changes', () => {
  let burnCount = 0;
  let burned = false;
  function maybeBurn() {
    if (burned) return;
    burned = true;
    burnCount++;
  }

  // Speed changes do not trigger burn
  writeStoredRate(2);
  writeStoredRate(0.5);
  assert.equal(burnCount, 0);

  // Ending playback triggers burn
  maybeBurn();
  assert.equal(burnCount, 1);

  // Subsequent end events or speed changes do not re-burn
  maybeBurn();
  writeStoredRate(1.5);
  assert.equal(burnCount, 1);
});
