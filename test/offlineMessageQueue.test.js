import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getAllOfflineMessages,
  getOfflineMessages,
  removeOfflineMessage,
  saveOfflineMessage,
} from '../src/utils/offlineMessageQueue.js';

function installStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('offline message queue fails closed without browser storage', async () => {
  installStorage();
  const entry = {
    id: 'message-1',
    type: 'dm',
    conversationId: 'peer-1',
    conversationKey: 'dm:peer-1',
    displayText: 'queued text',
    payload: { clientMessageId: 'message-1' },
  };

  await assert.rejects(
    saveOfflineMessage('user-1', entry),
    (error) => error.code === 'OUTBOX_UNAVAILABLE',
  );

  assert.deepEqual(await getOfflineMessages('user-1', 'dm:peer-1'), []);
  assert.deepEqual(await getOfflineMessages('user-1', 'group:group-1'), []);
  assert.deepEqual(await getAllOfflineMessages('user-2'), []);

  await removeOfflineMessage('user-1', 'message-1');
  assert.deepEqual(await getAllOfflineMessages('user-1'), []);
  assert.equal(localStorage.getItem('qc_outbox_user-1'), null);
});
