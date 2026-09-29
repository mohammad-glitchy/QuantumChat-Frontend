import { cacheNotificationContent } from '../crypto/swAuthMirror.js';
import { playReceiveSound, unlockAudio } from './sounds.js';

/** Returns true if the current time falls inside the configured DND window (handles overnight ranges). */
function isWithinDoNotDisturb(dnd) {
  if (!dnd?.enabled) return false;
  const [startH, startM] = (dnd.startTime || '22:00').split(':').map(Number);
  const [endH, endM] = (dnd.endTime || '07:00').split(':').map(Number);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes === endMinutes) return true; // 24h DND if start === end
  if (startMinutes < endMinutes) {
    // Same-day window, e.g. 09:00 -> 17:00
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // Overnight window, e.g. 22:00 -> 07:00
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

/**
 * Decide whether an incoming message/event should notify the user, given their
 * notification settings. Centralizes DND, per-type toggles, and priority so
 * every call site (socket handlers, push, etc.) applies the same rules.
 *
 * kind: 'dm' | 'group' | 'status' | 'call'
 */
export function shouldNotify(notifSettings, { kind, isMention = false, isAnnouncement = false } = {}) {
  if (!notifSettings) return true; // fail-open before settings load
  if (isWithinDoNotDisturb(notifSettings.doNotDisturb)) return false;
  if (notifSettings.priority === 'silent') return false;

  if (kind === 'group') {
    const mode = notifSettings.groupNotifications;
    if (mode === 'off') return false;
    if (mode === 'mentions_only' && !isMention) return false;
    if (mode === 'important_only' && !isMention && !isAnnouncement) return false;
    return true;
  }

  if (kind === 'dm') {
    const mode = notifSettings.messageNotifications;
    if (mode === 'off') return false;
    return true; // 'all', 'direct_only', 'all_except_reactions' all permit DMs
  }

  if (kind === 'reaction') {
    return notifSettings.messageNotifications !== 'all_except_reactions';
  }

  if (kind === 'status') {
    return notifSettings.statusNotifications !== 'off';
  }

  if (kind === 'call') {
    return true; // per-type (voice/video) enable check + DND/priority already handled above
  }

  return true;
}

/** Plays the notification sound if enabled, scaled by the configured volume. */
export function playNotificationSound(notifSettings) {
  if (notifSettings?.soundEnabled === false) return;
  unlockAudio();
  const scale =
    typeof notifSettings?.soundVolume === 'number' ? notifSettings.soundVolume / 100 : 1;
  playReceiveSound(scale);
}
/** Detects a JSON system payload (call summary, meeting summary, story reaction/reply, etc.) embedded as message text. */
export function parseSystemPayload(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const obj = JSON.parse(trimmed);
    if (obj && (obj.__type || obj.type)) return obj;
  } catch {
    return null;
  }
  return null;
}

/** Turns a parsed system payload into a short, human-readable notification line. Returns null for unknown types. */
export function describeSystemPayload(obj) {
  if (!obj) return null;
  const kind = obj.__type || obj.type;
  const durationStr = (seconds) => {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  switch (kind) {
    case 'call':
      if (!obj.answered) return `Missed ${obj.video ? 'video' : 'voice'} call`;
      return `${obj.video ? 'Video' : 'Voice'} call ended · ${durationStr(obj.durationSeconds)}`;
    case 'meeting':
      return `${obj.video ? 'Video' : 'Voice'} meeting ended · ${durationStr(obj.durationSeconds)} · ${obj.participantCount || 0} joined`;
    case 'story_reaction':
      return `Reacted ${obj.emoji || '❤️'} to your story`;
    case 'story_reply':
      return `Replied to your story: "${(obj.text || '').slice(0, 80)}"`;
    case 'announcement':
      return obj.body ? `📢 ${obj.body}` : 'Announcement';
    case 'poll':
      return obj.question ? `📊 Poll: ${obj.question}` : 'Poll';
    case 'event':
      return obj.title ? `📅 Event: ${obj.title}` : 'Event';
    default:
      return null;
  }
}
/** Builds the { title, body } text for a popup, respecting the messagePreview setting. */
export function buildNotificationText(
  { senderName, messageText, isGroup, groupName },
  notifSettings,
) {
  const preview = notifSettings?.messagePreview || 'full';
  const context = isGroup ? groupName : senderName;
  const systemLine = describeSystemPayload(parseSystemPayload(messageText));

  if (preview === 'hidden') {
    return { title: 'QuantumChat', body: 'New message' };
  }
  if (preview === 'sender_only') {
    return { title: context || 'QuantumChat', body: systemLine ? systemLine : 'New message' };
  }
  const body = systemLine || (messageText?.trim() ? messageText : '[Attachment]');
  return { title: context || 'QuantumChat', body };
}

/**
 * Shows a real browser Notification popup, if permission is already granted.
 * Prefer OS sound whenever the user has sound enabled — forcing silent while
 * the tab is "visible" made alerts easy to miss during side-by-side testing.
 */
export function showNotificationPopup(
 { title, body, requireInteraction, icon, tag, silent: silentOverride, actions, data },
  notifSettings,
  onClick,
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (notifSettings?.webNotifications?.enabled === false) return;

  const soundOnWeb = notifSettings?.webNotifications?.soundOnWeb !== false;
  const allowOsSound = soundOnWeb && notifSettings?.soundEnabled !== false;
  const silent =
    typeof silentOverride === 'boolean' ? silentOverride : !allowOsSound;
  const resolvedTag = tag || 'quantumchat-alert';

   if (Array.isArray(actions) && actions.length && 'serviceWorker' in navigator) {
       (async () => {
         try {
           const registration = await navigator.serviceWorker.ready;
           if (!registration) return;
   
           console.log('[notif] client showing rich notification, tag =', JSON.stringify(resolvedTag), { title, body });
           cacheNotificationContent(resolvedTag, { title, body });
   
           const existing = await registration.getNotifications({ tag: resolvedTag });
           console.log('[notif] existing same-tag notifications found before showing:', existing.length);
           existing.forEach((n) => n.close());
           await registration.showNotification(title, {
             body,
             icon: icon || '/logo.png',
             badge: '/logo.png',
             silent,
             requireInteraction: requireInteraction ?? notifSettings?.priority === 'high',
             tag: resolvedTag,
             renotify: true,
             actions: actions.slice(0, 2),
             data: data || {},
           });
         } catch (err) {
           console.error('[notif] failed to show rich notification', err);
         }
       })();
       return;
     }
   
     try {
       const n = new Notification(title, {
         body,
         icon: icon || '/logo.png',
         badge: '/logo.png',
         silent,
         requireInteraction: requireInteraction ?? notifSettings?.priority === 'high',
         tag: resolvedTag,
         renotify: true,
       });
       if (onClick) {
         n.onclick = () => {
           window.focus();
           onClick();
           n.close();
         };
       }
     } catch {
       // ignore unsupported/blocked notifications
     }
   }
   /** Builds { title, body } for multiple buffered messages in one conversation, WhatsApp-style. */
   export function buildGroupedNotificationText(entries, { isGroup, groupName, notifSettings }) {
     const preview = notifSettings?.messagePreview || 'full';
     const title = isGroup ? groupName || 'QuantumChat' : entries[0]?.senderName || 'QuantumChat';
   
     const lineFor = (e) => describeSystemPayload(parseSystemPayload(e.text)) || e.text?.trim() || '[Attachment]';
   
     if (preview === 'hidden') {
       return { title, body: entries.length > 1 ? `${entries.length} new messages` : 'New message' };
     }
   
     if (entries.length === 1) {
       const e = entries[0];
       const text = preview === 'sender_only' ? (describeSystemPayload(parseSystemPayload(e.text)) || 'New message') : lineFor(e);
       return { title, body: isGroup && e.senderName ? `${e.senderName}: ${text}` : text };
     }
   
     if (preview === 'sender_only') {
       return { title, body: `${entries.length} new messages` };
     }
     const lines = entries.slice(-2).map((e) => {
       const text = lineFor(e);
       return isGroup && e.senderName ? `${e.senderName}: ${text}` : text;
     });
     const extra = entries.length - lines.length;
     const body = extra > 0 ? `${lines.join('\n')}\n+${extra} more` : lines.join('\n');
     return { title, body };
   }