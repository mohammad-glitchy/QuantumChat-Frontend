import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addImportantEntry,
  filterImportantEntries,
  getAutomaticImportantSource,
  isAutomaticImportantMessage,
  isImportantEntry,
  normalizeImportantEntries,
  removeImportantEntry,
} from '../src/utils/importantMessages.js';

test('normalizeImportantEntries deduplicates identical message ids and merges labels', () => {
  const rows = [
    {
      id: 'm-1',
      conversationId: 'u-2',
      title: 'Alice',
      type: 'dm',
      text: 'hello',
      from: 'u-1',
      createdAt: '2025-01-01T00:00:00.000Z',
      starredAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'm-1',
      conversationId: 'u-2',
      title: 'Alice',
      type: 'dm',
      text: 'hello',
      from: 'u-1',
      createdAt: '2025-01-01T00:00:00.000Z',
      important: true,
      importantAt: '2025-01-01T00:00:00.000Z',
    },
  ];

  const normalized = normalizeImportantEntries(rows);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].isStarred, true);
  assert.equal(normalized[0].isImportant, true);
  assert.deepEqual(normalized[0].reasons, ['Starred', 'Important']);
});

test('filterImportantEntries supports all, starred, and important filters with text search', () => {
  const rows = [
    {
      id: 'm-1',
      title: 'Alice',
      text: 'Team standup notes',
      from: 'u-1',
      starredAt: '2025-01-01T00:00:00.000Z',
      isStarred: true,
    },
    {
      id: 'm-2',
      title: 'Design group',
      text: 'Roadmap reminder',
      from: 'u-2',
      important: true,
      isImportant: true,
    },
  ];

  const all = filterImportantEntries(rows, 'all', 'roadmap');
  assert.equal(all.length, 1);
  assert.equal(all[0].id, 'm-2');

  const onlyStarred = filterImportantEntries(rows, 'starred', '');
  assert.equal(onlyStarred.length, 1);
  assert.equal(onlyStarred[0].id, 'm-1');

  const onlyImportant = filterImportantEntries(rows, 'important', '');
  assert.equal(onlyImportant.length, 1);
  assert.equal(onlyImportant[0].id, 'm-2');
});

test('important state can be added and removed independently', () => {
  const starred = [{ id: 'm-1', starredAt: '2025-01-01T00:00:00.000Z' }];
  const marked = addImportantEntry(starred, { id: 'm-1', text: 'both states' });
  assert.equal(isImportantEntry(marked, 'm-1'), true);
  assert.equal(normalizeImportantEntries(marked).length, 1);
  assert.equal(normalizeImportantEntries(marked)[0].isStarred, true);

  const removed = removeImportantEntry(marked, 'm-1');
  assert.equal(isImportantEntry(removed, 'm-1'), false);
  assert.equal(normalizeImportantEntries(removed)[0].isImportant, false);
  assert.equal(normalizeImportantEntries(removed)[0].isStarred, true);
});

test('important-only and starred-only entries remain independent in filters', () => {
  const entries = [
    { id: 'starred', starredAt: '2025-01-01T00:00:00.000Z' },
    { id: 'important', important: true, importantAt: '2025-01-02T00:00:00.000Z' },
    { id: 'both', starredAt: '2025-01-03T00:00:00.000Z', important: true },
  ];
  assert.deepEqual(filterImportantEntries(entries, 'starred').map((entry) => entry.id).sort(), ['both', 'starred']);
  assert.deepEqual(filterImportantEntries(entries, 'important').map((entry) => entry.id).sort(), ['both', 'important']);
  assert.equal(filterImportantEntries(entries, 'all').length, 3);
});

test('marking a new message creates an Important entry', () => {
  const marked = addImportantEntry([], { id: 'm-new', text: 'remember this' });
  assert.equal(isImportantEntry(marked, 'm-new'), true);
});

test('removing an Important-only message removes its entry', () => {
  const marked = addImportantEntry([], { id: 'm-remove' });
  assert.equal(removeImportantEntry(marked, 'm-remove').length, 0);
});

test('starred-only messages appear in the Starred filter', () => {
  const result = filterImportantEntries([{ id: 'm-star', starredAt: '2025-01-01T00:00:00.000Z' }], 'starred');
  assert.deepEqual(result.map((entry) => entry.id), ['m-star']);
});

test('important-only messages appear in the Important filter', () => {
  const result = filterImportantEntries([{ id: 'm-important', important: true }], 'important');
  assert.deepEqual(result.map((entry) => entry.id), ['m-important']);
});

test('a message with both states appears once in All', () => {
  const result = filterImportantEntries([
    { id: 'm-both', starredAt: '2025-01-01T00:00:00.000Z' },
    { id: 'm-both', important: true },
  ], 'all');
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].reasons, ['Starred', 'Important']);
});

test('a message with both states appears in both relevant filters', () => {
  const entries = [{ id: 'm-both', starredAt: '2025-01-01T00:00:00.000Z', important: true }];
  assert.equal(filterImportantEntries(entries, 'starred').length, 1);
  assert.equal(filterImportantEntries(entries, 'important').length, 1);
});

test('removing Important preserves Starred', () => {
  const both = addImportantEntry([{ id: 'm-both', starredAt: '2025-01-01T00:00:00.000Z' }], { id: 'm-both' });
  const after = removeImportantEntry(both, 'm-both');
  assert.equal(normalizeImportantEntries(after)[0].isStarred, true);
  assert.equal(normalizeImportantEntries(after)[0].isImportant, false);
});

test('unstarred state does not remove an independent Important entry', () => {
  const important = [{ id: 'm-important', important: true, importantAt: '2025-01-01T00:00:00.000Z' }];
  assert.equal(filterImportantEntries(important, 'important').length, 1);
  assert.equal(normalizeImportantEntries(important)[0].isImportant, true);
});

test('search matches text and sender or conversation metadata', () => {
  const entries = [{ id: 'm-search', important: true, text: 'FYP meeting', senderName: 'Mustafa', title: 'Design group' }];
  assert.equal(filterImportantEntries(entries, 'important', 'fyp').length, 1);
  assert.equal(filterImportantEntries(entries, 'important', 'mustafa').length, 1);
  assert.equal(filterImportantEntries(entries, 'important', 'missing').length, 0);
});

test('duplicate message IDs are never returned twice', () => {
  const entries = [
    { id: 'duplicate', important: true },
    { id: 'duplicate', important: true, text: 'latest copy' },
  ];
  assert.equal(normalizeImportantEntries(entries).length, 1);
  assert.equal(filterImportantEntries(entries, 'important').length, 1);
});

test('messages with document attachments are marked important automatically', () => {
  const result = isAutomaticImportantMessage({
    text: 'Here is the final proposal.',
    attachment: { filename: 'FYP-Proposal.pdf', mimetype: 'application/pdf' },
  });
  assert.equal(result, true);
  assert.equal(getAutomaticImportantSource({
    text: 'Here is the final proposal.',
    attachment: { filename: 'FYP-Proposal.pdf', mimetype: 'application/pdf' },
  }), 'document');
});

test('messages with URLs are marked important automatically', () => {
  const result = isAutomaticImportantMessage({
    text: 'Check this repo: https://github.com/example/repo',
  });
  assert.equal(result, true);
  assert.equal(getAutomaticImportantSource({
    text: 'Check this repo: https://github.com/example/repo',
  }), 'link');
});

test('messages with both document and URL are auto important once', () => {
  const result = isAutomaticImportantMessage({
    text: 'Here is the repo: https://github.com/example/repo',
    attachment: { filename: 'Report.pdf', mimetype: 'application/pdf' },
  });
  assert.equal(result, true);
  assert.equal(getAutomaticImportantSource({
    text: 'Here is the repo: https://github.com/example/repo',
    attachment: { filename: 'Report.pdf', mimetype: 'application/pdf' },
  }), 'document');
});

test('plain text and media-only messages do not auto-save as important', () => {
  assert.equal(isAutomaticImportantMessage({ text: 'Normal update' }), false);
  assert.equal(isAutomaticImportantMessage({ text: 'Nice photo', attachment: { filename: 'photo.jpg', mimetype: 'image/jpeg' } }), false);
  assert.equal(isAutomaticImportantMessage({ text: 'Video', attachment: { filename: 'clip.mp4', mimetype: 'video/mp4' } }), false);
  assert.equal(isAutomaticImportantMessage({ text: 'Voice memo', attachment: { filename: 'note.m4a', mimetype: 'audio/m4a' } }), false);
});

test('manual and automatic importance stay deduplicated and independent', () => {
  const both = normalizeImportantEntries([
    { id: 'm-both', isStarred: true, reason: 'starred' },
    { id: 'm-both', isImportant: true, importantSource: 'document' },
  ]);
  assert.equal(both.length, 1);
  assert.equal(both[0].isStarred, true);
  assert.equal(both[0].isImportant, true);
  assert.equal(filterImportantEntries(both, 'all').length, 1);
});
