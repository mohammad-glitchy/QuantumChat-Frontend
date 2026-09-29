import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCheck, Lock, LogOut, MoreVertical, Settings, Star, Unlock } from 'lucide-react';
import { Clock, Cake } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function SidebarMenu({
  onSettings,
  onLogout,
  onMarkAllRead,
  onOpenStarred,
  vaultEnabled,
  vaultUnlocked,
  onOpenVault,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function onDocClick(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="sidebar-menu" ref={rootRef}>
      <motion.button
        type="button"
        className={`sidebar-menu-trigger ${open ? 'open' : ''}`}
        aria-label="Open menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
      >
        <MoreVertical size={18} strokeWidth={2.2} aria-hidden="true" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="sidebar-menu-dropdown"
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              className="sidebar-menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onMarkAllRead?.();
              }}
            >
              <span className="sidebar-menu-item-left">
                <CheckCheck size={16} aria-hidden="true" />
                <span>{t('nav.markAllRead', 'Mark all as read')}</span>
              </span>
            </button>

            <div className="sidebar-menu-divider" />

            <button
              type="button"
              className="sidebar-menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenStarred?.();
              }}
            >
              <span className="sidebar-menu-item-left">
                <Star size={16} aria-hidden="true" />
                <span>{t('nav.starredMessages', 'Important messages')}</span>
              </span>
            </button>

           <div className="sidebar-menu-divider" />

            <button
              type="button"
              className="sidebar-menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenVault?.();
              }}
            >
              <span className="sidebar-menu-item-left">
                {vaultEnabled && vaultUnlocked ? (
                  <Unlock size={16} aria-hidden="true" />
                ) : (
                  <Lock size={16} aria-hidden="true" />
                )}
                <span>
                  {!vaultEnabled
                    ? t('nav.setUpVault', 'Set up vault')
                    : vaultUnlocked
                      ? t('nav.lockVault', 'Lock vault')
                      : t('nav.unlockVault', 'Unlock vault')}
                </span>
              </span>
            </button>

            <div className="sidebar-menu-divider" />
            <button
              type="button"
              className="sidebar-menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSettings?.();
              }}
            >
              <span className="sidebar-menu-item-left">
                <Settings size={16} aria-hidden="true" />
                <span>{t('nav.settings', 'Settings')}</span>
              </span>
            </button>

            <button
              type="button"
              className="sidebar-menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate('/chat/activity');
              }}
            >
              <span className="sidebar-menu-item-left">
                <Clock size={16} aria-hidden="true" />
                <span>{t('nav.activity', 'Activity')}</span>
              </span>
            </button>

              <button
                type="button"
                className="sidebar-menu-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  navigate('/chat/birthdays');
                }}
              >
                <span className="sidebar-menu-item-left">
                  <Cake size={16} aria-hidden="true" />
                  <span>{t('nav.birthdays', 'Birthday Calendar')}</span>
                </span>
              </button>

            <div className="sidebar-menu-divider" />

            <button
              type="button"
              className="sidebar-menu-item danger"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout?.();
              }}
            >
              <span className="sidebar-menu-item-left">
                <LogOut size={16} aria-hidden="true" />
                <span>{t('nav.logout', 'Log out')}</span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
