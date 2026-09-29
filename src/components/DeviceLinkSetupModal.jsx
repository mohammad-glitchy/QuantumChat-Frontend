import { useEffect } from 'react';

function formatTimeLeft(ms) {
  if (ms <= 0) return 'Expired';
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function DeviceLinkSetupModal({
  open,
  qrDataUrl,
  loading,
  statusText,
  error,
  timeLeft,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="confirm-overlay" role="presentation" onClick={() => !loading && onClose?.()}>
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-link-setup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-dialog-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M8 9h8" />
            <path d="M8 13h5" />
          </svg>
        </div>
        <h2 id="device-link-setup-title" className="confirm-dialog-title confirm-title">
          {loading ? 'Preparing device link' : 'Link a new device'}
        </h2>
        <p className="confirm-dialog-message confirm-message">
          {loading
            ? 'Creating the pairing request. The QR code will appear here as soon as the backend responds.'
            : statusText || 'Wait for the second device to scan this QR code.'}
        </p>
        {error ? (
          <p className="settings-section-copy" style={{ color: 'var(--danger)', marginTop: 8 }}>
            {error}
          </p>
        ) : null}
        {qrDataUrl ? (
          <div className="settings-fieldset" style={{ marginTop: 12, padding: 12, textAlign: 'center' }}>
            <img
              src={qrDataUrl}
              alt="Device pairing QR code"
              style={{ width: 220, height: 220, margin: '0 auto', display: 'block', borderRadius: 12 }}
            />
          </div>
        ) : null}
        <div className="settings-section-copy" style={{ marginTop: 12 }}>
          {timeLeft > 0 ? `Expires in ${formatTimeLeft(timeLeft)}` : 'The pairing link will expire soon.'}
        </div>
        <div className="confirm-dialog-actions confirm-actions">
          <button type="button" className="confirm-btn-cancel confirm-btn cancel" onClick={onClose} disabled={loading}>
            {loading ? 'Working…' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
