/**
 * Build a shareable invite / register URL that never exposes localhost
 * when the user is on the live QuantumChat site.
 */
export function publicAppOrigin() {
  const configured = String(import.meta.env.VITE_APP_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (configured) return configured;

  if (typeof window !== 'undefined' && window.location?.origin) {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!isLocal) return window.location.origin.replace(/\/$/, '');
  }

  return 'https://chat.quantumlogicslimited.com';
}

export function publicInviteLink(referralCode, apiReferralLink) {
  const code =
    String(referralCode || '').trim() ||
    (() => {
      try {
        return new URL(apiReferralLink).searchParams.get('ref') || '';
      } catch {
        return '';
      }
    })();

  if (!code) return apiReferralLink || `${publicAppOrigin()}/register`;

  const path = `/register?ref=${encodeURIComponent(code)}`;

  // Local dev: keep whatever the API returned (usually localhost).
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const pageIsLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (pageIsLocal && !String(import.meta.env.VITE_APP_URL || '').trim()) {
      try {
        const apiUrl = new URL(apiReferralLink);
        if (apiUrl.hostname === 'localhost' || apiUrl.hostname === '127.0.0.1') {
          return apiReferralLink;
        }
      } catch {
        /* fall through */
      }
      return `${window.location.origin}${path}`;
    }
  }

  return `${publicAppOrigin()}${path}`;
}
