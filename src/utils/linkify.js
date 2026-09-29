// Splits message text into an ordered list of tokens so the UI can render
// mentions, URLs, emails, and phone numbers as distinct clickable pieces.
// Type is one of: 'text' | 'mention' | 'url' | 'email' | 'phone'

const COMBINED_RE =
  /(?<mention>@[a-zA-Z0-9_.-]{2,32})|(?<url>(?:https?:\/\/|www\.)[^\s<>"')\]]+)|(?<email>[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(?<phone>\+?\d[\d\-\s().]{5,}\d)/g;

function digitsOf(raw) {
  return raw.replace(/\D/g, '');
}

export function linkifyText(text) {
  const input = String(text || '');
  const tokens = [];
  let last = 0;
  let match;

  COMBINED_RE.lastIndex = 0;
  while ((match = COMBINED_RE.exec(input))) {
    const { index } = match;
    if (index > last) tokens.push({ type: 'text', value: input.slice(last, index) });

    if (match.groups.mention) {
      tokens.push({ type: 'mention', value: match.groups.mention });
    } else if (match.groups.url) {
      // Trim common trailing punctuation that isn't part of the URL
      // (e.g. "check https://example.com." at the end of a sentence).
      let url = match.groups.url;
      const trailing = url.match(/[.,!?;:]+$/);
      if (trailing) url = url.slice(0, -trailing[0].length);
      tokens.push({ type: 'url', value: url });
      if (trailing) tokens.push({ type: 'text', value: trailing[0] });
    } else if (match.groups.email) {
      tokens.push({ type: 'email', value: match.groups.email });
    } else if (match.groups.phone) {
      const digits = digitsOf(match.groups.phone);
      if (digits.length >= 7 && digits.length <= 15) {
        tokens.push({ type: 'phone', value: match.groups.phone.trim() });
      } else {
        tokens.push({ type: 'text', value: match.groups.phone });
      }
    }

    last = index + match[0].length;
  }

  if (last < input.length) tokens.push({ type: 'text', value: input.slice(last) });
  return tokens;
}