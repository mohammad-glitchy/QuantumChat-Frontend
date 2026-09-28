/**
 * QuantumChat API base URL (no trailing slash, no `/api` suffix).
 * Production builds must never silently use localhost — CSP on Vercel blocks it.
 */
const LEGACY_PROD_BACKEND = 'https://quantum-chat-backend.vercel.app';
const PROD_BACKEND = 'https://quantum-chat-backend-six.vercel.app';

function normalizeApiBaseUrl(url) {
  const trimmed = String(url || '')
    .trim()
    .replace(/\/$/, '');
  // Vercel dashboard env can lag behind repo .env.production — remap the old org backend.
  if (trimmed === LEGACY_PROD_BACKEND) return PROD_BACKEND;
  return trimmed;
}

const CONFIGURED = normalizeApiBaseUrl(import.meta.env.VITE_API_URL || '');

const PROD_FALLBACK = PROD_BACKEND;

function isLocalhostUrl(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(url);
}

export function getApiBaseUrl() {
  if (import.meta.env.DEV) {
    return CONFIGURED || 'http://localhost:5000';
  }
  if (CONFIGURED && !isLocalhostUrl(CONFIGURED)) {
    return CONFIGURED;
  }
  if (typeof window !== 'undefined' && /\.vercel\.app$/i.test(window.location.hostname)) {
    return PROD_FALLBACK;
  }
  return PROD_FALLBACK;
}

export function getApiUrl() {
  return `${getApiBaseUrl()}/api`;
}
