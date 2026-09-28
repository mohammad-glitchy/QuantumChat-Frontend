import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMessagePreviewText } from '../src/utils/messagePreview.js';

test('getMessagePreviewText handles plain text messages', () => {
  assert.equal(getMessagePreviewText('Hello world'), 'Hello world');
  assert.equal(getMessagePreviewText('  Leading and trailing space  '), 'Leading and trailing space');
  assert.equal(getMessagePreviewText(''), '');
  assert.equal(getMessagePreviewText(null), '');
  assert.equal(getMessagePreviewText(undefined), '');
});

test('getMessagePreviewText extracts announcement body instead of raw JSON', () => {
  const announcementPayload = JSON.stringify({
    __qc: 1,
    type: 'announcement',
    body: 'me nai gai',
  });
  assert.equal(getMessagePreviewText(announcementPayload), 'me nai gai');

  const announcementObj = {
    text: announcementPayload,
  };
  assert.equal(getMessagePreviewText(announcementObj), 'me nai gai');
});

test('getMessagePreviewText extracts story reaction instead of raw JSON', () => {
  const reactionPayload = JSON.stringify({
    type: 'story_reaction',
    storyId: '6aa18992',
    mediaType: 'image',
    emoji: '🔥',
  });
  assert.equal(getMessagePreviewText(reactionPayload), '🔥 Reacted to story');

  const reactionNoEmoji = JSON.stringify({
    type: 'story_reaction',
    storyId: '6aa18992',
  });
  assert.equal(getMessagePreviewText(reactionNoEmoji), 'Reacted to story');
});

test('getMessagePreviewText extracts story reply text and media kinds', () => {
  const textReply = JSON.stringify({
    type: 'story_reply',
    storyId: '6aa18992',
    text: 'Amazing photo!',
  });
  assert.equal(getMessagePreviewText(textReply), 'Amazing photo!');

  const mediaReply = JSON.stringify({
    type: 'story_reply',
    storyId: '6aa18992',
    replyMediaKind: 'voice',
  });
  assert.equal(getMessagePreviewText(mediaReply), 'Voice note');

  const captionReply = JSON.stringify({
    type: 'story_reply',
    storyId: '6aa18992',
    caption: 'Sunset vibes',
  });
  assert.equal(getMessagePreviewText(captionReply), 'Story: Sunset vibes');
});

test('getMessagePreviewText extracts poll question and event title', () => {
  const pollPayload = JSON.stringify({
    __qc: 1,
    type: 'poll',
    question: 'Where should we eat lunch?',
    options: ['Pizza', 'Sushi'],
  });
  assert.equal(getMessagePreviewText(pollPayload), 'Where should we eat lunch?');

  const eventPayload = JSON.stringify({
    __qc: 1,
    type: 'event',
    title: 'Design Review',
    when: '2026-09-10T10:00:00Z',
  });
  assert.equal(getMessagePreviewText(eventPayload), 'Design Review');
});

test('getMessagePreviewText extracts file and gif names', () => {
  const filePayload = JSON.stringify({
    __qc: 1,
    type: 'file',
    filename: 'quarterly_report.pdf',
  });
  assert.equal(getMessagePreviewText(filePayload), 'quarterly_report.pdf');

  const gifPayload = JSON.stringify({
    type: 'gif',
    gifUrl: 'https://media.giphy.com/media/example.gif',
  });
  assert.equal(getMessagePreviewText(gifPayload), 'GIF');
});

test('getMessagePreviewText extracts calls and meetings', () => {
  const callPayload = JSON.stringify({
    __type: 'call',
    video: false,
    answered: true,
  });
  assert.equal(getMessagePreviewText(callPayload), 'Voice call');

  const meetingPayload = JSON.stringify({
    __type: 'meeting',
    video: true,
  });
  assert.equal(getMessagePreviewText(meetingPayload), 'Video meeting');
});

test('getMessagePreviewText handles attachment fallback on message objects', () => {
  const photoMsg = {
    attachment: {
      filename: 'photo.jpg',
      mimetype: 'image/jpeg',
    },
  };
  assert.equal(getMessagePreviewText(photoMsg), 'photo.jpg');

  const unnamedPhotoMsg = {
    attachment: {
      mimetype: 'image/jpeg',
    },
  };
  assert.equal(getMessagePreviewText(unnamedPhotoMsg), 'Photo');

  const videoMsg = {
    attachment: {
      mimetype: 'video/mp4',
    },
  };
  assert.equal(getMessagePreviewText(videoMsg), 'Video');
});
