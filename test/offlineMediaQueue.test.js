import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getOfflineMedia, removeOfflineMedia, saveOfflineMedia } from '../src/utils/offlineMediaQueue.js';

test('offline media queue fails closed without IndexedDB', async () => {
  await assert.rejects(
    saveOfflineMedia('user-1', {
      id: 'upload-1',
      type: 'dm',
      conversationKey: 'dm:peer-1',
      sourceBytes: new Uint8Array([1, 2, 3]),
    }),
    (error) => error.code === 'MEDIA_OUTBOX_UNAVAILABLE',
  );
  assert.deepEqual(await getOfflineMedia('user-1'), []);
  await removeOfflineMedia('user-1', 'upload-1');
});
