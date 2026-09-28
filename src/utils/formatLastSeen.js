/**
 * Format a clock time like "5:00 pm" (12-hour, lowercase am/pm).
 */
export function formatClock12(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  return d
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase()
    .replace(/\s+(am|pm)$/, '\u00a0$1');
}

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Human last-seen label, e.g.:
 *  - "last seen just now"
 *  - "last seen 5 minutes ago"
 *  - "last seen today at 5:00 pm"
 *  - "last seen yesterday at 5:00 pm"
 *  - "last seen Sep 19 at 5:00 pm"
 */
export function formatLastSeen(iso, { prefix = 'last seen', neverLabel = 'never logged in' } = {}) {
  if (!iso) return neverLabel;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return neverLabel;

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  // Clock skew / future timestamps — treat as just now.
  if (diffMs < 0) {
    const when = 'just now';
    return prefix ? `${prefix} ${when}` : when;
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  let when;
  if (diffSec < 45) {
    when = 'just now';
  } else if (diffMin < 60) {
    when = diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
  } else {
    const time = formatClock12(d);
    if (!time) return neverLabel;

    const dayDiff = Math.round((startOfLocalDay(now) - startOfLocalDay(d)) / 86400000);
    if (dayDiff === 0) when = `today at ${time}`;
    else if (dayDiff === 1) when = `yesterday at ${time}`;
    else if (d.getFullYear() === now.getFullYear()) {
      const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      when = `${date} at ${time}`;
    } else {
      const date = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      when = `${date} at ${time}`;
    }
  }

  return prefix ? `${prefix} ${when}` : when;
}
