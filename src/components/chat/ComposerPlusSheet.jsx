import { BarChart2, Calendar, Camera, Clock, Forward, Hourglass, Image as ImageIcon, Megaphone, Paperclip, Smile } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BottomSheet from '../ui/BottomSheet.jsx';

/**
 * Nested composer actions — attach / camera / group tools / disappear / forwarding.
 */
export default function ComposerPlusSheet({
  open,
  onClose,
  onAttach,
  onCamera,
  onPoll,
  onEvent,
  onAnnounce,
    onGif,
  showGroupTools = false,
  canAnnounce = false,
  disappearSeconds = 0,
  onCycleDisappear,
  onTimeCapsule,        // ← new prop
  capsuleActive = false, // ← new prop
  allowForward = true,
  onToggleForward,
  forwardUntilSeconds = 0,
  onCycleForwardUntil,
}) {
  const { t } = useTranslation();

  return (
    <BottomSheet open={open} onClose={onClose} title={t('composer.moreActions', 'More actions')}>
      <div className="qc-composer-plus-grid" role="menu">
        <button type="button" role="menuitem" className="qc-composer-plus-item" onClick={() => { onAttach?.(); onClose(); }}>
          <Paperclip size={20} />
          <span>{t('composer.attachFile', 'Attach file')}</span>
        </button>
        <button type="button" role="menuitem" className="qc-composer-plus-item" onClick={() => { onCamera?.(); onClose(); }}>
          <Camera size={20} />
          <span>{t('composer.camera', 'Camera')}</span>
        </button>
         <button type="button" role="menuitem" className="qc-composer-plus-item" onClick={() => { onGif?.(); onClose(); }}>
          <ImageIcon size={20} />
          <span>{t('composer.gif', 'GIF')}</span>
        </button>
        {showGroupTools ? (
          <>
            <button type="button" role="menuitem" className="qc-composer-plus-item" onClick={() => { onPoll?.(); onClose(); }}>
              <BarChart2 size={20} />
              <span>{t('composer.poll', 'Poll')}</span>
            </button>
            <button type="button" role="menuitem" className="qc-composer-plus-item" onClick={() => { onEvent?.(); onClose(); }}>
              <Calendar size={20} />
              <span>{t('composer.event', 'Event')}</span>
            </button>
            {canAnnounce ? (
              <button type="button" role="menuitem" className="qc-composer-plus-item" onClick={() => { onAnnounce?.(); onClose(); }}>
                <Megaphone size={20} />
                <span>{t('composer.announce', 'Announce')}</span>
              </button>
            ) : null}
          </>
        ) : null}
        <button type="button" role="menuitem" className="qc-composer-plus-item" onClick={() => onCycleDisappear?.()}>
          <Clock size={20} />
          <span>
            {t('composer.disappear', 'Disappear')}
            {disappearSeconds > 0 ? ` · ${disappearSeconds}s` : ` · ${t('composer.off', 'off')}`}
          </span>
        </button>
        <button type="button" role="menuitem" className="qc-composer-plus-item" onClick={() => { onTimeCapsule?.(); onClose(); }}>
          <Hourglass size={20} />
          <span>
            {t('composer.timeCapsule', 'Time capsule')}
            {capsuleActive ? ` · set` : ''}
          </span>
        </button>
        <button type="button" role="menuitem" className="qc-composer-plus-item" onClick={() => onToggleForward?.()}>
          <Forward size={20} />
          <span>{t('composer.forwarding', 'Forwarding')} {allowForward ? t('composer.on', 'on') : t('composer.off', 'off')}</span>
        </button>
        {allowForward ? (
          <button type="button" role="menuitem" className="qc-composer-plus-item" onClick={() => onCycleForwardUntil?.()}>
            <Smile size={20} />
            <span>
              {t('composer.forwardUntil', 'Forward until')}
              {forwardUntilSeconds > 0 ? ` · ${forwardUntilSeconds}s` : ` · ${t('composer.forever', 'forever')}`}
            </span>
          </button>
        ) : null}
      </div>
    </BottomSheet>
  );
}
