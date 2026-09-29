import { useEffect, useRef } from 'react';
import { Eye, Send, X, Minimize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useFocusTrap from '../../hooks/useFocusTrap.js';
import { preloadFFmpeg } from '../../crypto/videoCompressor.js';

/**
 * WhatsApp-style preview before sending a photo or video — choose normal or view once.
 */
export default function MediaSendPreview({
  open,
  file,
  index = 0,
  total = 1,
  viewOnce = false,
  onToggleViewOnce,
  compress = false,
  onToggleCompress,
  compressing = false,
  compressProgress = 0,
  compressPhase = 'encoding', // 'loading' | 'encoding'
  onSend,
  onSendAll,
  onClose,
  sending = false,
}) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const imagePreviewRef = useRef(null);
  const videoPreviewRef = useRef(null);

  useFocusTrap(containerRef, open);

  useEffect(() => {
    if (!open || !file) return undefined;

    const objectUrl = URL.createObjectURL(file);
    let safePreviewUrl = '';
    try {
      const parsed = new URL(objectUrl);
      if (parsed.protocol === 'blob:') safePreviewUrl = parsed.href;
    } catch {
      // Leave media sources unset for malformed preview URLs.
    }

    const previewElement = file.type.startsWith('video/')
      ? videoPreviewRef.current
      : imagePreviewRef.current;

    if (previewElement) {
      if (safePreviewUrl) previewElement.src = safePreviewUrl;
      else previewElement.removeAttribute('src');
    }

    return () => {
      if (previewElement) previewElement.removeAttribute('src');
      URL.revokeObjectURL(objectUrl);
    };
  }, [open, file]);
  useEffect(() => {
    if (!open || !file) return;
    // Only worth prefetching the wasm core when WebCodecs won't be the fast
    // path anyway — otherwise it's dead weight most of the time now.
    if (
      String(file.type || '').startsWith('video/') &&
      file.size > 15 * 1024 * 1024 &&
      (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined')
    ) {
      preloadFFmpeg();
    }
  }, [open, file]);

  if (!open || !file) return null;

  const mime = String(file.type || '').toLowerCase();
  const isVideo = mime.startsWith('video/');
 
  const showCompressToggle = isVideo && file.size > 15 * 1024 * 1024;
  return (
    <div className="media-send-overlay" role="dialog" aria-modal="true" aria-label={t('composer.attachFile', 'Attach file')}>
      <div className="media-send-panel" ref={containerRef}>
        <header className="media-send-header">
          <button
            type="button"
            className="composer-context-close"
            onClick={onClose}
            aria-label={t('common.cancel', 'Cancel')}
            disabled={sending}
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          {total > 1 ? (
            <span className="media-send-counter">
              <bdi dir="ltr">{index + 1}</bdi>
              {' '}
              <span>{t('common.of', 'of')}</span>
              {' '}
              <bdi dir="ltr">{total}</bdi>
            </span>
          ) : (
            <span className="media-send-title">
              {isVideo ? t('composer.sendVideo', 'Send video') : t('composer.sendPhoto', 'Send photo')}
            </span>
          )}
          <span className="media-send-header-spacer" aria-hidden="true" />
        </header>

        <div className="media-send-preview">
          {isVideo ? (
            <video
              ref={videoPreviewRef}
              className="media-send-media"
              controls
              playsInline
              preload="metadata"
            />
          ) : (
            <img ref={imagePreviewRef} alt="" className="media-send-media" />
          )}
        </div>
        <footer className="media-send-footer">
          {compressing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', padding: '0 4px' }}>
              <span style={{ fontSize: 13, opacity: 0.85 }}>
                {compressPhase === 'loading'
                  ? 'Preparing compressor…'
                  : `Compressing… ${Math.round(compressProgress * 100)}%`}
              </span>
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round(compressProgress * 100)}%`,
                    background: 'currentColor',
                    borderRadius: 999,
                    transition: 'width 150ms linear',
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              {showCompressToggle && (
                <button
                  type="button"
                  className={`media-send-view-once${compress ? ' is-active' : ''}`}
                  onClick={() => onToggleCompress?.()}
                  aria-pressed={compress}
                  aria-label={compress ? 'Compression enabled' : 'Compress before sending'}
                  disabled={sending}
                  title={
                    compress
                      ? 'Compress — tap to send original'
                      : file.size > 60 * 1024 * 1024
                        ? 'Compress before sending (large file — may take a few minutes)'
                        : 'Compress before sending'
                  }
                >
                  <Minimize2 size={20} strokeWidth={2} aria-hidden="true" />
                </button>
              )}

              <button
                type="button"
                className={`media-send-view-once${viewOnce ? ' is-active' : ''}`}
                onClick={() => onToggleViewOnce?.()}
                aria-pressed={viewOnce}
                aria-label={viewOnce ? 'View once enabled' : 'Send as view once'}
                disabled={sending}
                title={viewOnce ? 'View once — tap to send normally' : 'Send as view once'}
              >
                <Eye size={20} strokeWidth={2} aria-hidden="true" />
                <span className="media-send-view-once-label">1</span>
              </button>
              <button
                type="button"
                className="media-send-submit"
                onClick={() => onSend?.()}
                aria-label={viewOnce ? 'Send view once' : 'Send'}
                disabled={sending}
                title={total > 1 ? 'Send this one' : undefined}
              >
                <Send size={20} strokeWidth={2} aria-hidden="true" />
              </button>

              {total > 1 && (
                <button
                  type="button"
                  className="media-send-submit media-send-submit-all"
                  onClick={() => onSendAll?.()}
                  aria-label={`Send all ${total} items`}
                  disabled={sending}
                  title={`Send all ${total}`}
                >
                  Send all ({total})
                </button>
              )}
            </>
          )}
        </footer>

        <p className="media-send-hint">
          {compressing
            ? 'Compressing video — this can take a moment'
            : viewOnce
              ? 'Recipient can open this once — then it disappears'
              : 'End-to-end encrypted before upload'}
        </p>
      </div>
    </div>
  );
}
