import { Lock, MessageSquare, Search, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Calm empty / locked / offline states for the thread pane.
 */
export default function ChatEmptyState({
  variant = 'welcome',
  title,
  copy,
  actionLabel,
  onAction,
}) {
  const { t } = useTranslation();

  const presets = {
    welcome: {
      title: t('chat.emptyTitle', 'Welcome to QuantumChat'),
      copy: t('chat.emptySubtitle', 'Pick a conversation or start a new group. Your messages stay encrypted on this device.'),
    },
    locked: {
      title: t('nav.lockVault', 'Unlock your encryption keys'),
      copy: t('settings.security.keySetsInfo', 'Import keys.txt for this account to start chatting securely.'),
    },
    offline: {
      title: t('common.offline', 'You are offline'),
      copy: 'Reconnect to send and receive messages. Drafts stay on this device.',
    },
    noResults: {
      title: t('nav.noConversations', 'No conversations found'),
      copy: 'Try another search, or clear filters to see everyone again.',
    },
    thread: {
      title: t('chat.noMessages', 'No messages yet'),
      copy: t('chat.noMessages', 'Say hello — your first encrypted message starts the thread.'),
    },
  };

  const preset = presets[variant] || presets.welcome;
  const ICONS = {
    welcome: MessageSquare,
    locked: Lock,
    offline: WifiOff,
    noResults: Search,
    thread: MessageSquare,
  };
  const IconComponent = ICONS[variant] || MessageSquare;

  return (
    <div className={`qc-empty-state qc-empty-state--${variant}`} role="status">
      <div className="qc-empty-state-card">
        <div className="qc-empty-state-icon-wrap" aria-hidden="true">
          <IconComponent size={24} strokeWidth={1.85} />
        </div>
        <h2>{title || preset.title}</h2>
        <p>{copy || preset.copy}</p>
        {actionLabel && onAction ? (
          <button type="button" className="qc-empty-state-cta" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
