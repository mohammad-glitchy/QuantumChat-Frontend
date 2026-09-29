import { X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { unsealMessage } from '../crypto/keys.js';

// Use theme design tokens so the modal responds gracefully to both light
// and dark themes while meeting WCAG AA minimum contrast standards.
const CARD_BG = 'var(--bg-surface, #fdf8ee)';
const TEXT_PRIMARY = 'var(--text-primary, #1c2b23)';
const MUTED_COLOR = 'var(--text-secondary, #4a5a4f)';
const TRACK_COLOR = 'var(--border-subtle, #ecdfc0)';
const ACCENT = 'var(--accent, #064e3b)';
const CURRENT_BG = 'var(--accent-muted, rgba(6, 78, 59, 0.12))';
const CURRENT_BORDER = 'color-mix(in srgb, var(--accent, #064e3b) 35%, transparent)';
const EARLIER_BG = 'color-mix(in srgb, var(--text-primary, #000) 4%, transparent)';
const CLOSE_BTN_BG = 'color-mix(in srgb, var(--text-primary, #000) 6%, transparent)';

function formatTimestamp(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);

  // Relative time for "today"-scale edits, absolute otherwise.
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24 && d.toDateString() === now.toDateString()) return `${diffHrs}h ago`;

  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EditHistoryModal({ message, currentUserId, resolveSecretKey, onClose }) {
  const closeButtonRef = useRef(null);

  const versions = useMemo(() => {
    if (!message) return [];
    const isMine = String(message.from) === String(currentUserId);
    const history = (message.editHistory || []).map((h) => {
      let text = null;
      let decryptFailed = false;

      if (message.group) {
        if (typeof h.content === 'string') {
          text = h.content;
        } else if (Array.isArray(h.envelopes)) {
          const mine = h.envelopes.find((e) => String(e.user) === String(currentUserId));
          if (mine?.targetPublicKey) {
            const sk = resolveSecretKey(mine.targetPublicKey);
            if (sk) {
              text = unsealMessage(mine, sk);
              if (text == null) decryptFailed = true;
            } else {
              decryptFailed = true;
            }
          } else {
            decryptFailed = true;
          }
        }
      } else {
        const envelope = isMine ? h.forSender : h.forRecipient;
        if (envelope?.targetPublicKey) {
          const sk = resolveSecretKey(envelope.targetPublicKey);
          if (sk) {
            text = unsealMessage(envelope, sk);
            if (text == null) decryptFailed = true;
          } else {
            decryptFailed = true;
          }
        } else {
          decryptFailed = true;
        }
      }
      return { text, editedAt: h.editedAt, decryptFailed };
    });

    // Current (latest) version goes last in storage order, but we want
    // newest-first display, with "Current" pinned at top.
    return [
      { text: message.text, editedAt: message.editedAt, isCurrent: true },
      ...history.slice().reverse(),
    ];
  }, [message, currentUserId, resolveSecretKey]);

  // Close on Escape, and return focus to the close button on open.
  useEffect(() => {
    if (!message) return undefined;

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    closeButtonRef.current?.focus();

    return () => window.removeEventListener('keydown', handleKey);
  }, [message, onClose]);

  if (!message) return null;

  // Only the earlier edits count toward "was this ever edited" —
  // the current version is always present, so it can't drive the empty state.
  const hasEditHistory = versions.length > 1;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-history-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: CARD_BG,
          color: TEXT_PRIMARY,
          border: `1px solid ${TRACK_COLOR}`,
          borderRadius: 16,
          width: '100%',
          maxWidth: 380,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 18px',
            borderBottom: `1px solid ${TRACK_COLOR}`,
            flexShrink: 0,
          }}
        >
          <h2
            id="edit-history-title"
            style={{ margin: 0, fontSize: 17, fontWeight: 700, color: TEXT_PRIMARY }}
          >
            Edit history
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: CLOSE_BTN_BG,
              border: 'none',
              borderRadius: '50%',
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: TEXT_PRIMARY,
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 18px 22px', overflowY: 'auto' }}>
          {!hasEditHistory && (
            <div style={{ fontSize: 13, color: MUTED_COLOR, marginBottom: 8 }}>
              This message hasn&apos;t been edited.
            </div>
          )}
          {versions.map((v, i) => (
            <div
              key={i}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: v.isCurrent ? CURRENT_BG : EARLIER_BG,
                border: v.isCurrent ? `1px solid ${CURRENT_BORDER}` : 'none',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: v.isCurrent ? ACCENT : MUTED_COLOR,
                  marginBottom: 4,
                }}
              >
                {v.isCurrent ? 'Current' : formatTimestamp(v.editedAt) || 'Earlier version'}
              </div>
              <div style={{ fontSize: 14, color: TEXT_PRIMARY, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {v.text != null ? (
                  v.text
                ) : v.decryptFailed ? (
                  <em style={{ color: MUTED_COLOR }}>[Unable to decrypt]</em>
                ) : (
                  <em style={{ color: MUTED_COLOR }}>[No content]</em>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}