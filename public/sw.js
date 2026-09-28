/* QuantumChat service worker — push notifications + notification click */

const DB_NAME = 'quantumchat-sw';
const STORE_AUTH = 'auth';
const STORE_CONTENT = 'content';
const DB_VERSION = 2;
const CONTENT_CACHE_TTL_MS = 20_000; // only trust a cached rich-content entry if it's this fresh

function idbGet(store, key) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_AUTH)) {
          req.result.createObjectStore(STORE_AUTH);
        }
        if (!req.result.objectStoreNames.contains(STORE_CONTENT)) {
          req.result.createObjectStore(STORE_CONTENT);
        }
      };
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction(store, 'readonly');
          const getReq = tx.objectStore(store).get(key);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event));
});

async function handlePush(event) {
  let data = { title: 'QuantumChat', body: 'New notification' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        data = { ...data, ...parsed };
      }
    }
  } catch {
    try {
      const text = event.data?.text?.();
      if (text) data.body = text;
    } catch {
      // keep defaults
    }
  }

  console.log('[sw] push received', { title: data.title, body: data.body, tag: JSON.stringify(data.tag) });
  // generic "New message" — regardless of whether this push arrived before
   let title = data.title || 'QuantumChat';
  let body = data.body || 'New notification';
  if (data.tag) {
    const cached = await idbGet(STORE_CONTENT, data.tag);
    const age = cached ? Date.now() - cached.cachedAt : null;
    console.log('[sw] content-cache lookup for tag', JSON.stringify(data.tag), '→', cached ? `HIT (age ${age}ms)` : 'MISS');
    if (cached && age < CONTENT_CACHE_TTL_MS) {
      title = cached.title || title;
      body = cached.body || body;
      console.log('[sw] using cached content instead of push payload:', { title, body });
    }
  } else {
    console.log('[sw] push had no tag at all — cache lookup skipped entirely');
  }

  const options = {
    body,
    icon: data.icon || '/logo.png',
    badge: data.badge || '/logo.png',
    data: data.data || { url: data.url || '/' },
    tag: data.tag || 'quantumchat',
    renotify: true,
    requireInteraction: data.requireInteraction === true,
    silent: data.silent === true,
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 2) : [],
  };

   console.log('[sw] showing notification', { title, tag: options.tag });
  await self.registration.showNotification(title, options);
}

/**
 * Delivers a notification action to the app via postMessage — never via
 * WindowClient.navigate() (a full top-level browser navigation, same as
 * typing a new URL, which reloads a client-side-routed SPA from scratch).
 */
async function deliverNotificationAction(targetUrl, actionMessage, { focus = true } = {}) {
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  console.log('[sw] deliverNotificationAction', { action: actionMessage.action, focus, clientsFound: allClients.length });

  for (const client of allClients) {
    const clientUrl = client.url || '';
    if (clientUrl.startsWith(self.location.origin)) {
      console.log('[sw] posting message to existing client', clientUrl);
      if (focus && 'focus' in client) {
        await client.focus();
      }
      client.postMessage(actionMessage);
      return;
    }
  }

  console.log('[sw] no matching existing client — falling back to openWindow', targetUrl);
  if (self.clients.openWindow) {
    await self.clients.openWindow(targetUrl);
  }
}

/**
 * Marks a conversation read entirely in the background — no app tab needs
 * to open for this one, since it's a plain authenticated REST call with no
 * crypto involved (unlike Reply/Accept/Decline, which need the local
 * keyring that only exists in the main app's localStorage).
 */
async function markReadInBackground(notifData) {
  const fromUserId = notifData?.fromUserId;
  if (!fromUserId) {
    console.error('[sw] mark_read: no fromUserId in notification data — nothing to mark');
    return;
  }
  const [token, apiBase] = await Promise.all([idbGet(STORE_AUTH, 'token'), idbGet(STORE_AUTH, 'apiBase')]);
  if (!token || !apiBase) {
    console.error('[sw] mark_read: no session mirrored in IndexedDB (log out and back in to fix)', {
      hasToken: Boolean(token),
      apiBase,
    });
    return;
  }
  try {
    const res = await fetch(`${apiBase}/messages/${fromUserId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error('[sw] mark_read: server rejected the request', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('[sw] mark_read: fetch failed', err);
  }
}

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const notifData = event.notification?.data || {};
  event.notification.close();

  console.log('[sw] notificationclick', { action, notifData });

  if (action === 'mark_read') {
    event.waitUntil(markReadInBackground(notifData));
    return;
  }

  const rawUrl = notifData.url || '/chat';
  const targetUrl = new URL(rawUrl, self.location.origin);

  if (action === 'reply') {
    const typed = typeof event.reply === 'string' ? event.reply.trim() : '';
    console.log('[sw] reply action, event.reply =', JSON.stringify(event.reply), 'fromUserId =', notifData.fromUserId);
    targetUrl.searchParams.set('reply', typed ? encodeURIComponent(typed) : '1');
    const actionMessage = {
      type: 'quantumchat-notification-action',
      action: 'reply',
      url: rawUrl,
      text: typed,
      peerId: notifData.fromUserId,
    };
    event.waitUntil(deliverNotificationAction(targetUrl.href, actionMessage, { focus: !typed }));
    return;
  }

  let actionMessage = { type: 'quantumchat-notification-action', action: 'open', url: rawUrl };
  if (action === 'accept_call') {
    targetUrl.searchParams.set('acceptCall', notifData.callId || '1');
    actionMessage = { type: 'quantumchat-notification-action', action: 'accept_call', url: rawUrl, callId: notifData.callId };
  } else if (action === 'decline_call') {
    targetUrl.searchParams.set('declineCall', notifData.callId || '1');
    actionMessage = { type: 'quantumchat-notification-action', action: 'decline_call', url: rawUrl, callId: notifData.callId };
  }

  event.waitUntil(deliverNotificationAction(targetUrl.href, actionMessage, { focus: true }));
});
