import {
  Copy,
  Forward,
  Info,
  Pencil,
  Pin,
  Reply,
  Smile,
  Star,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BottomSheet from '../ui/BottomSheet.jsx';
import { QUICK_REACTIONS } from '../../utils/emojis.js';

/**
 * Long-press message action sheet (mobile) + quick reactions.
 */
export default function MessageActionSheet({
  open,
  onClose,
  message,
  isMine,
  onReply,
  onReact,
  onCopy,
  onForward,
  onEdit,
  onDelete,
  onStar,
  onImportant,
  onPin,
  onShowInfo,
  starred = false,
  important = false,
  pinned = false,
  canEdit = false,
  canForward = true,
}) {
  const { t } = useTranslation();
  if (!message) return null;

  const run = (fn) => {
    fn?.(message);
    onClose?.();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('chat.message', 'Message')}>
      <div className="qc-msg-actions-reactions" role="group" aria-label={t('chat.quickReactions', 'Quick reactions')}>
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="qc-msg-reaction-chip"
            onClick={() => run(() => onReact?.(message, emoji))}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          className="qc-msg-reaction-chip more"
          onClick={() => run(() => onReact?.(message, null))}
          aria-label={t('chat.moreReactions', 'More reactions')}
        >
          <Smile size={18} />
        </button>
      </div>
      <div className="qc-msg-actions-list" role="menu">
        <button type="button" role="menuitem" onClick={() => run(onReply)}>
          <Reply size={18} /> {t('chat.reply', 'Reply')}
        </button>
        {isMine && onShowInfo ? (
          <button type="button" role="menuitem" onClick={() => run(onShowInfo)}>
            <Info size={18} /> {t('messageInfo.title', 'Message info')}
          </button>
        ) : null}
        <button type="button" role="menuitem" onClick={() => run(onCopy)}>
          <Copy size={18} /> {t('chat.copy', 'Copy')}
        </button>
        {canForward ? (
          <button type="button" role="menuitem" onClick={() => run(onForward)}>
            <Forward size={18} /> {t('chat.forward', 'Forward')}
          </button>
        ) : null}
        {canEdit ? (
          <button type="button" role="menuitem" onClick={() => run(onEdit)}>
            <Pencil size={18} /> {t('chat.edit', 'Edit')}
          </button>
        ) : null}
        <button type="button" role="menuitem" onClick={() => run(onStar)}>
          <Star
            size={18}
            fill={starred ? '#FFC107' : 'none'}
            stroke={starred ? '#FFC107' : 'currentColor'}
          />{' '}
          {starred ? t('chat.unstar', 'Unstar') : t('chat.star', 'Star')}
        </button>
        {onImportant ? (
          <button type="button" role="menuitem" onClick={() => run(onImportant)}>
            <Pin size={18} /> {important ? 'Remove from important' : 'Save as important'}
          </button>
        ) : null}
        <button type="button" role="menuitem" onClick={() => run(onPin)}>
          <Pin size={18} /> {pinned ? t('chat.unpin', 'Unpin') : t('chat.pin', 'Pin')}
        </button>
        <button type="button" role="menuitem" className="danger" onClick={() => run(onDelete)}>
          <Trash2 size={18} /> {isMine ? t('chat.deleteForEveryone', 'Delete for everyone') : t('chat.deleteForMe', 'Delete for me')}
        </button>
      </div>
    </BottomSheet>
  );
}
