/**
 * Birthday data calculation and normalization utilities for QuantumChat.
 * Respects strict privacy (only processes visible friend birthday fields)
 * and normalizes annual recurring dates across years, timezones, and leap days.
 */

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Parses an ISO birthday date string (e.g. '1995-09-27T00:00:00.000Z' or '1995-09-27')
 * and extracts UTC month (1-12) and day (1-31).
 */
export function extractBirthMonthAndDay(dobString) {
  if (!dobString || typeof dobString !== 'string') return null;
  const d = new Date(dobString);
  if (Number.isNaN(d.getTime())) return null;

  const match = dobString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { month, day };
    }
  }

  return {
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/**
 * Calculates the next occurrence of a birthday given the current date (today).
 * Correctly rolls over to next year if already passed this year.
 * Handles Feb 29 on non-leap years by mapping to Feb 28.
 */
export function calculateNextBirthday(month, day, fromDate = new Date()) {
  const currentYear = fromDate.getFullYear();
  const todayAtMidnight = new Date(currentYear, fromDate.getMonth(), fromDate.getDate());

  let targetDay = day;
  if (month === 2 && day === 29 && !isLeapYear(currentYear)) {
    targetDay = 28;
  }

  let candidate = new Date(currentYear, month - 1, targetDay);

  if (candidate.getTime() < todayAtMidnight.getTime()) {
    const nextYear = currentYear + 1;
    targetDay = day;
    if (month === 2 && day === 29 && !isLeapYear(nextYear)) {
      targetDay = 28;
    }
    candidate = new Date(nextYear, month - 1, targetDay);
  }

  const diffTime = candidate.getTime() - todayAtMidnight.getTime();
  const daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return {
    nextDate: candidate,
    daysUntil: Math.max(0, daysUntil),
    isToday: daysUntil === 0,
    isTomorrow: daysUntil === 1,
    isThisWeek: daysUntil >= 0 && daysUntil <= 7,
  };
}

/**
 * Formats a relative label for upcoming birthdays:
 * - 'Today'
 * - 'Tomorrow'
 * - 'In X days'
 * - 'Month Day' (e.g. 'Oct 14')
 */
export function formatBirthdayCountdown(daysUntil, targetDate, locale = undefined) {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil <= 7) return 'In ' + daysUntil + ' days';
  return targetDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

/**
 * Formats a display date without exposing the birth year (e.g., 'September 27').
 */
export function formatBirthdayDate(month, day, locale = undefined) {
  const refDate = new Date(2025, month - 1, day);
  return refDate.toLocaleDateString(locale, { month: 'long', day: 'numeric' });
}

/**
 * Normalizes a list of friend objects into structured birthday items.
 * Drops any friend who has no visible birthday (birthday === null or birthdayLocked === true).
 */
export function normalizeFriendBirthdays(friends = [], fromDate = new Date()) {
  const result = [];
  const seenIds = new Set();

  for (const friend of friends) {
    if (!friend || (!friend.id && !friend._id)) continue;
    const friendId = String(friend.id || friend._id);
    if (seenIds.has(friendId)) continue;
    seenIds.add(friendId);

    // Visibility / privacy check: if birthday is hidden/locked or missing
    if (!friend.birthday || friend.birthdayLocked) continue;

    const parsed = extractBirthMonthAndDay(friend.birthday);
    if (!parsed) continue;

    const { month, day } = parsed;
    const { nextDate, daysUntil, isToday, isTomorrow, isThisWeek } = calculateNextBirthday(month, day, fromDate);

    result.push({
      friendId,
      user: friend,
      displayName: friend.displayName || friend.username || 'Friend',
      username: friend.username || '',
      avatarUrl: friend.avatarUrl || null,
      hasAvatar: Boolean(friend.hasAvatar || friend.avatarUrl),
      month,
      day,
      nextOccurrence: nextDate,
      daysUntil,
      isToday,
      isTomorrow,
      isThisWeek,
      dateLabel: formatBirthdayDate(month, day),
    });
  }

  // Sort upcoming in ascending chronological order
  return result.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Groups birthdays occurring in a specific calendar month (1-12) by day of the month.
 * Returns a Map: dayNumber -> Array<birthdayItem>.
 */
export function getBirthdaysByMonthDay(normalizedBirthdays = [], targetMonth) {
  const map = new Map();
  for (const item of normalizedBirthdays) {
    if (item.month === targetMonth) {
      if (!map.has(item.day)) {
        map.set(item.day, []);
      }
      map.get(item.day).push(item);
    }
  }
  return map;
}