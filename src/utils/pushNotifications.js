import client from '../api/client.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

export function notificationsSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/** True when this browser already has an active Web Push subscription. */
export async function isPushSubscribed() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription?.endpoint);
  } catch {
    return false;
  }
}

/**
 * Request notification permission (optional), register the service worker,
 * subscribe with the server VAPID key, and POST the subscription.
 * Returns { ok, permission, push?, error? }.
 *
 * @param {{ requestPermission?: boolean }} [opts]
 *   When requestPermission is false, do not prompt — only subscribe if already granted.
 *   Use that from background mount effects (browsers block permission prompts without a gesture).
 */
export async function enablePushNotifications(opts = {}) {
  const requestPermission = opts.requestPermission !== false;

  if (typeof window === 'undefined') {
    return { ok: false, permission: 'unsupported', error: 'Not in a browser' };
  }
  if (!('Notification' in window)) {
    return { ok: false, permission: 'unsupported', error: 'Notifications not supported' };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    if (!requestPermission) {
      return {
        ok: false,
        permission: 'default',
        push: false,
        error: 'Notification permission not granted yet',
      };
    }
    try {
      permission = await Notification.requestPermission();
    } catch {
      return {
        ok: false,
        permission: Notification.permission,
        error: 'Could not request notification permission',
      };
    }
  }
  if (permission !== 'granted') {
    return {
      ok: false,
      permission,
      error:
        permission === 'denied'
          ? 'Notifications are blocked. Enable them in your browser site settings.'
          : 'Notification permission was not granted.',
    };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    // Permission granted — in-tab/background OS notifications still work via Notification API.
    return { ok: true, permission, push: false };
  }

  try {
   const registration = await navigator.serviceWorker.register('/sw.js', {
  scope: '/',
  updateViaCache: 'none',
});
    await navigator.serviceWorker.ready;

    const vapidRes = await client.get('/users/me/push/vapid-public-key');
    const publicKey = vapidRes?.data?.data?.publicKey;
    if (!publicKey) {
      return { ok: true, permission, push: false, error: 'Push server key unavailable' };
    }

    let subscription = await registration.pushManager.getSubscription();
    // Re-subscribe if VAPID keys rotated (common on serverless without stable env keys).
    if (subscription) {
      try {
        // Keep existing subscription when possible; server upserts by endpoint.
      } catch {
        await subscription.unsubscribe().catch(() => {});
        subscription = null;
      }
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const json = subscription.toJSON();
    await client.post('/users/me/push/subscribe', {
      endpoint: json.endpoint,
      keys: json.keys,
    });

    return { ok: true, permission, push: true };
  } catch (err) {
    // Permission is still granted — foreground Notification API works even if push subscribe fails.
    return {
      ok: true,
      permission,
      push: false,
      error: err?.response?.data?.error || err.message || 'Push subscribe failed',
    };
  }
}

/** Unsubscribe this browser from push (keeps Notification permission). */
export async function disablePushNotifications() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: true };
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe().catch(() => {});
      await client.delete('/users/me/push/subscribe', { data: { endpoint } }).catch(() => {});
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
