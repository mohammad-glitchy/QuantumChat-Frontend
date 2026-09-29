import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLeapYear,
  extractBirthMonthAndDay,
  calculateNextBirthday,
  formatBirthdayCountdown,
  formatBirthdayDate,
  normalizeFriendBirthdays,
  getBirthdaysByMonthDay,
} from '../src/utils/birthdayUtils.js';

test('isLeapYear correctly identifies leap years', () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2028), true);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(2025), false);
  assert.equal(isLeapYear(2026), false);
  assert.equal(isLeapYear(1900), false);
});

test('extractBirthMonthAndDay parses ISO strings and YYYY-MM-DD correctly', () => {
  assert.deepEqual(extractBirthMonthAndDay('1998-05-14T00:00:00.000Z'), { month: 5, day: 14 });
  assert.deepEqual(extractBirthMonthAndDay('2002-12-31'), { month: 12, day: 31 });
  assert.deepEqual(extractBirthMonthAndDay('2000-02-29T12:00:00.000Z'), { month: 2, day: 29 });
  assert.equal(extractBirthMonthAndDay(null), null);
  assert.equal(extractBirthMonthAndDay('invalid-date'), null);
});

test('calculateNextBirthday handles birthday occurring today', () => {
  const referenceToday = new Date(2026, 8, 27); // Sept 27, 2026
  const res = calculateNextBirthday(9, 27, referenceToday);
  assert.equal(res.daysUntil, 0);
  assert.equal(res.isToday, true);
  assert.equal(res.isThisWeek, true);
  assert.equal(res.nextDate.getFullYear(), 2026);
  assert.equal(res.nextDate.getMonth(), 8);
  assert.equal(res.nextDate.getDate(), 27);
});

test('calculateNextBirthday handles birthday later this year', () => {
  const referenceToday = new Date(2026, 8, 27); // Sept 27, 2026
  const res = calculateNextBirthday(10, 5, referenceToday); // Oct 5, 2026 (8 days away)
  assert.equal(res.daysUntil, 8);
  assert.equal(res.isToday, false);
  assert.equal(res.isThisWeek, false);
  assert.equal(res.nextDate.getFullYear(), 2026);
});

test('calculateNextBirthday handles birthday rollover to next year if already passed', () => {
  const referenceToday = new Date(2026, 8, 27); // Sept 27, 2026
  // Birthday was Jan 15 (already passed this year)
  const res = calculateNextBirthday(1, 15, referenceToday);
  assert.equal(res.nextDate.getFullYear(), 2027);
  assert.equal(res.nextDate.getMonth(), 0);
  assert.equal(res.nextDate.getDate(), 15);
  assert.ok(res.daysUntil > 100);
});

test('calculateNextBirthday handles Feb 29 leap day in non-leap year', () => {
  const referenceToday = new Date(2025, 0, 1); // Jan 1, 2025 (non-leap year)
  const res = calculateNextBirthday(2, 29, referenceToday);
  assert.equal(res.nextDate.getFullYear(), 2025);
  assert.equal(res.nextDate.getMonth(), 1); // Feb
  assert.equal(res.nextDate.getDate(), 28); // Mapped to Feb 28
});

test('calculateNextBirthday handles Feb 29 leap day in leap year', () => {
  const referenceToday = new Date(2028, 0, 1); // Jan 1, 2028 (leap year)
  const res = calculateNextBirthday(2, 29, referenceToday);
  assert.equal(res.nextDate.getFullYear(), 2028);
  assert.equal(res.nextDate.getMonth(), 1); // Feb
  assert.equal(res.nextDate.getDate(), 29); // Preserved on Feb 29
});

test('formatBirthdayCountdown formats today, tomorrow, and relative days', () => {
  const date = new Date(2026, 9, 15);
  assert.equal(formatBirthdayCountdown(0, date), 'Today');
  assert.equal(formatBirthdayCountdown(1, date), 'Tomorrow');
  assert.equal(formatBirthdayCountdown(4, date), 'In 4 days');
  assert.ok(formatBirthdayCountdown(18, date).includes('Oct'));
});

test('normalizeFriendBirthdays filters out hidden/locked birthdays (strict privacy)', () => {
  const friends = [
    { id: '1', displayName: 'Alice', birthday: '1998-09-27T00:00:00.000Z', birthdayLocked: false },
    { id: '2', displayName: 'Bob', birthday: null, birthdayLocked: true }, // hidden
    { id: '3', displayName: 'Charlie', birthday: '1995-10-02T00:00:00.000Z', birthdayLocked: true }, // locked
    { id: '4', displayName: 'Dana', birthday: '2001-12-10T00:00:00.000Z' }, // visible
    { id: '1', displayName: 'Alice Duplicate', birthday: '1998-09-27T00:00:00.000Z' }, // duplicate id
  ];

  const referenceToday = new Date(2026, 8, 27);
  const normalized = normalizeFriendBirthdays(friends, referenceToday);

  // Bob and Charlie should be excluded due to privacy rules
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].friendId, '1');
  assert.equal(normalized[0].displayName, 'Alice');
  assert.equal(normalized[0].isToday, true);

  assert.equal(normalized[1].friendId, '4');
  assert.equal(normalized[1].displayName, 'Dana');
});

test('getBirthdaysByMonthDay groups birthdays occurring on the same date', () => {
  const items = [
    { friendId: 'u1', month: 9, day: 15, displayName: 'Friend A' },
    { friendId: 'u2', month: 9, day: 15, displayName: 'Friend B' },
    { friendId: 'u3', month: 9, day: 22, displayName: 'Friend C' },
    { friendId: 'u4', month: 10, day: 15, displayName: 'Friend D' },
  ];

  const septMap = getBirthdaysByMonthDay(items, 9);
  assert.equal(septMap.has(15), true);
  assert.equal(septMap.get(15).length, 2);
  assert.equal(septMap.has(22), true);
  assert.equal(septMap.get(22).length, 1);
  assert.equal(septMap.has(1), false);
});