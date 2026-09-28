import { useEffect, useRef } from 'react';

/**
 * Best-effort screenshot protection for the web app.
 *
 * Blacks out only the protected chat surface (not the whole app) on known
 * screenshot shortcuts (PrintScreen, Win+Shift+S, Cmd+Shift+3/4/5).
 *
 * Settings / other app overlays stay capturable while a protected chat is
 * open underneath.
 *
 * Browsers cannot fully block OS screenshots. Mobile uses FLAG_SECURE.
 */
export function useScreenshotProtection(
  enabled,
  {
    onAttempt,
    scope = 'chat',
    /** CSS selector for the region to black out (defaults to the open chat pane). */
    targetSelector = '.chat-main',
  } = {},
) {
  const onAttemptRef = useRef(onAttempt);
  onAttemptRef.current = onAttempt;
  const flashTimerRef = useRef(null);
  const lastNotifyAtRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    root.classList.add('qc-screenshot-protection');
    root.dataset.qcProtectScope = scope;
    root.classList.remove('qc-screenshot-blur');

    function resolveTarget() {
      return document.querySelector(targetSelector);
    }

    function ensureOverlay() {
      const target = resolveTarget();
      if (!target) return null;

      let overlay = target.querySelector(':scope > .qc-screenshot-flash');
      if (!overlay) {
        // Remove any legacy fullscreen flash left on <body>.
        document.getElementById('qc-screenshot-flash')?.remove();
        overlay = document.createElement('div');
        overlay.className = 'qc-screenshot-flash';
        overlay.setAttribute('aria-hidden', 'true');
        target.appendChild(overlay);
      }
      return overlay;
    }

    function setBlackout(active) {
      const overlay = ensureOverlay();
      if (!overlay) return;
      if (active) {
        overlay.style.transition = 'none';
        overlay.classList.add('is-active');
        requestAnimationFrame(() => {
          overlay.style.transition = '';
        });
      } else {
        overlay.classList.remove('is-active');
      }
    }

    /** True when a non-chat app surface is on top — don't block capturing that. */
    function isAppOverlayOpen() {
      return Boolean(
        document.querySelector(
          [
            '.settings-modal',
            '.qc-settings-sheet',
            '.create-group-overlay',
            '.user-profile-modal',
            '.vault-setup-overlay',
            '.vault-unlock-overlay',
            '[data-qc-app-overlay="true"]',
          ].join(', '),
        ),
      );
    }

    function notify(reason) {
      const now = Date.now();
      if (now - lastNotifyAtRef.current < 1600) return;
      lastNotifyAtRef.current = now;
      onAttemptRef.current?.(reason || 'screenshot');
    }

    function flashPrivacyOverlay(reason, holdMs = 1100) {
      if (!resolveTarget()) return;
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      setBlackout(true);
      notify(reason);
      flashTimerRef.current = window.setTimeout(() => {
        setBlackout(false);
      }, holdMs);
    }

    function isPrintScreen(e) {
      const key = e.key || '';
      const code = e.code || '';
      return (
        key === 'PrintScreen' ||
        code === 'PrintScreen' ||
        e.keyCode === 44 ||
        e.which === 44
      );
    }

    function isScreenshotChord(e) {
      if (isPrintScreen(e)) return true;

      // Windows Snipping Tool: Win+Shift+S
      if (e.shiftKey && !e.ctrlKey && !e.altKey) {
        const k = String(e.key || '').toLowerCase();
        const win =
          e.metaKey ||
          e.getModifierState?.('Meta') ||
          e.getModifierState?.('OS') ||
          e.getModifierState?.('Super');
        if (win && (k === 's' || e.code === 'KeyS')) return true;
      }

      // macOS: Cmd+Shift+3/4/5
      if (e.metaKey && e.shiftKey && !e.ctrlKey && !e.altKey) {
        const k = String(e.key || '').toLowerCase();
        if (k === '3' || k === '4' || k === '5') return true;
        if (e.code === 'Digit3' || e.code === 'Digit4' || e.code === 'Digit5') return true;
      }

      return false;
    }

    function onCaptureKey(e) {
      if (!isScreenshotChord(e)) return;
      // Settings / profile / other app UI must remain capturable.
      if (isAppOverlayOpen()) return;
      flashPrivacyOverlay('screenshot', 1200);
    }

    // If a flash somehow stuck while away, clear it as soon as the user returns.
    function clearStuckBlackout() {
      if (document.visibilityState !== 'visible') return;
      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
      setBlackout(false);
    }

    document.addEventListener('keydown', onCaptureKey, true);
    document.addEventListener('keyup', onCaptureKey, true);
    document.addEventListener('visibilitychange', clearStuckBlackout);
    window.addEventListener('focus', clearStuckBlackout);

    return () => {
      document.removeEventListener('keydown', onCaptureKey, true);
      document.removeEventListener('keyup', onCaptureKey, true);
      document.removeEventListener('visibilitychange', clearStuckBlackout);
      window.removeEventListener('focus', clearStuckBlackout);
      root.classList.remove('qc-screenshot-protection', 'qc-screenshot-blur');
      delete root.dataset.qcProtectScope;
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      document.querySelectorAll('.qc-screenshot-flash').forEach((el) => el.remove());
      document.getElementById('qc-screenshot-flash')?.remove();
    };
  }, [enabled, scope, targetSelector]);
}
