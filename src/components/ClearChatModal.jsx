import { useEffect, useRef, useState } from 'react';

const OPTIONS = [
  { key: 'photo', label: 'Photos' },
  { key: 'video', label: 'Videos' },
  { key: 'voice', label: 'Voice notes' },
  { key: 'document', label: 'Documents' },
  { key: 'text', label: 'Text messages' },
  { key: 'starred', label: 'Starred messages' },
];

export default function ClearChatModal({
  open,
  busy = false,
  hasStarredInChat = false,
  onCancel,
  onConfirm,
}) {
  const [selected, setSelected] = useState(() => new Set());
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setSelected(new Set());
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();
    function onKeyDown(e) {
      if (e.key === 'Escape' && !busy) onCancel?.();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const allKeys = OPTIONS.map((o) => o.key);
  const allSelected = allKeys.every((k) => selected.has(k));

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allKeys));
  }

  function handleConfirm() {
    if (!selected.size || busy) return;
    onConfirm?.([...selected]);
  }

  return (
    <div className="confirm-overlay" role="presentation" onClick={() => !busy && onCancel?.()}>
      <div
        className="confirm-dialog clear-chat-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-chat-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-icon danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>
        <h2 id="clear-chat-title" className="confirm-dialog-title">
          Clear this chat?
        </h2>
        <p className="confirm-dialog-message">
          Choose what to remove from your view. This can't be undone and only
          affects your account — the other {hasStarredInChat ? 'person still sees everything, including anything you starred here.' : 'side is never affected.'}
        </p>

        <div className="clear-chat-options">
          <label className="clear-chat-option clear-chat-option-all">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={busy} />
            <span>Select all</span>
          </label>
          {OPTIONS.map((opt) => (
            <label key={opt.key} className="clear-chat-option">
              <input
                type="checkbox"
                checked={selected.has(opt.key)}
                onChange={() => toggle(opt.key)}
                disabled={busy}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>

        {selected.has('starred') && (
          <p className="clear-chat-starred-warning">
            This only empties your starred list — it does not delete or hide
            those messages from the conversation itself.
          </p>
        )}

        <div className="confirm-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="confirm-btn cancel"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm-btn danger"
            onClick={handleConfirm}
            disabled={busy || !selected.size}
          >
            {busy ? 'Clearing…' : 'Clear selected'}
          </button>
        </div>
      </div>
    </div>
  );
}