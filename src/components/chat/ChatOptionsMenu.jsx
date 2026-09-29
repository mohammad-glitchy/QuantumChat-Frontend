import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Ban,
  Eraser,
  Image as ImageIcon,
  Info,
  LayoutDashboard,
  Lock,
  MessageSquare,
  MoreVertical,
  Search,
  Settings2,
  Star,
  Unlock,
  VolumeX,
} from 'lucide-react';

const MENU_WIDTH = 220;
const MENU_EST_HEIGHT = 320;

function computePosition(triggerEl) {
  const rect = triggerEl.getBoundingClientRect();
  const gap = 8;
  const pad = 12;
  const spaceBelow = window.innerHeight - rect.bottom - pad;
  const openUp = spaceBelow < MENU_EST_HEIGHT;
  let top = openUp ? rect.top - MENU_EST_HEIGHT - gap : rect.bottom + gap;
  top = Math.max(pad, Math.min(top, window.innerHeight - MENU_EST_HEIGHT - pad));

  const isRtl = document.documentElement.dir === 'rtl';
  let left = 'auto';
  let right = 'auto';

  if (isRtl) {
    left = Math.max(pad, Math.min(rect.left, window.innerWidth - MENU_WIDTH - pad));
  } else {
    right = window.innerWidth - rect.right;
    right = Math.max(pad, Math.min(right, window.innerWidth - MENU_WIDTH - pad));
  }

  return { top, left, right, openUp };
}

export default function ChatOptionsMenu({
  isGroup,
  isBlocked,
  isMuted,
  isVaulted,
  onToggleBlock,
  onToggleMute,
  onToggleVault,
  onClearChat,
  onSearch,
  onWallpaper,
  onStarred,
  onMedia,
  onOpenAi,
  onOpenInfo,
  onOpenGroupSettings,
  onOpenCommandCenter,
  compactExtras = false,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (!e.target.closest('.chat-options-menu-trigger') && !e.target.closest('.chat-options-dropdown')) {
        setOpen(false);
      }
    }
    function onEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onDocClick);
    window.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onDocClick);
      window.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  function run(fn) {
    setOpen(false);
    fn?.();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="icon-btn chat-options-menu-trigger"
        aria-label={t('chat.chatOptions', 'Chat options')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open) setPos(computePosition(triggerRef.current));
          setOpen((v) => !v);
        }}
      >
        <MoreVertical size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && pos &&
        createPortal(
          <div
            className={`chat-options-dropdown${pos.openUp ? ' open-up' : ''}`}
            role="menu"
            aria-label={t('chat.chatOptions', 'Chat options')}
            style={{ position: 'fixed', top: pos.top, right: pos.right, left: pos.left, bottom: 'auto' }}
          >
            {compactExtras && onOpenAi ? (
              <button type="button" role="menuitem" onClick={() => run(onOpenAi)}>
                <MessageSquare size={15} /> QuantumAI
              </button>
            ) : null}
            {compactExtras && onOpenInfo ? (
              <button type="button" role="menuitem" onClick={() => run(onOpenInfo)}>
                <Info size={15} /> {t('chat.chatDetails', 'Chat details')}
              </button>
            ) : null}
            {compactExtras && isGroup && onOpenCommandCenter ? (
              <button type="button" role="menuitem" onClick={() => run(onOpenCommandCenter)}>
                <LayoutDashboard size={15} /> Command Center
              </button>
            ) : null}
            {compactExtras && isGroup && onOpenGroupSettings ? (
              <button type="button" role="menuitem" onClick={() => run(onOpenGroupSettings)}>
                <Settings2 size={15} /> {t('chat.groupSettings', 'Group settings')}
              </button>
            ) : null}
            {!compactExtras && isGroup && onOpenCommandCenter ? (
              <button type="button" role="menuitem" onClick={() => run(onOpenCommandCenter)}>
                <LayoutDashboard size={15} /> Command Center
              </button>
            ) : null}
            <button type="button" role="menuitem" onClick={() => run(onSearch)}>
              <Search size={15} /> {t('chat.searchInChat', 'Search in chat')}
            </button>
            <button type="button" role="menuitem" onClick={() => run(onMedia)}>
              <ImageIcon size={15} /> {t('chat.chatMedia', 'Chat media')}
            </button>
            <button type="button" role="menuitem" onClick={() => run(onStarred)}>
              <Star size={15} /> {t('chat.starredMessages', 'Important messages')}
            </button>
            {onWallpaper && (
              <button type="button" role="menuitem" onClick={() => run(onWallpaper)}>
                🎨 {t('chat.wallpaper', 'Wallpaper')}
              </button>
            )}
            {onToggleMute && (
              <button type="button" role="menuitem" onClick={() => run(onToggleMute)}>
                <VolumeX size={15} /> {isMuted ? t('chat.unmute', 'Unmute') : t('chat.mute', 'Mute')}
              </button>
            )}
            {!isGroup && onToggleVault && (
              <button type="button" role="menuitem" onClick={() => run(onToggleVault)}>
                {isVaulted ? <Unlock size={15} /> : <Lock size={15} />}{' '}
                {isVaulted ? t('chat.removeFromVault', 'Remove from vault') : t('chat.addToVault', 'Add to vault')}
              </button>
            )}
            {onClearChat && (
              <button type="button" role="menuitem" className="danger" onClick={() => run(onClearChat)}>
                <Eraser size={15} /> {t('chat.clearChat', 'Clear chat')}
              </button>
            )}
            {!isGroup && onToggleBlock && (
              <button type="button" role="menuitem" className="danger" onClick={() => run(onToggleBlock)}>
                <Ban size={15} /> {isBlocked ? t('chat.unblock', 'Unblock') : t('chat.block', 'Block')}
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
