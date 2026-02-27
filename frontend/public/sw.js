/* eslint-env serviceworker */
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { skipWaiting, clientsClaim } from 'workbox-core';

skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ── Web Push: mostrar notificación cuando la app está en background ───────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = { title: 'SportMaps', body: '', url: '/', icon: '/sportmaps-logo.png' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text() || 'Nueva notificación';
  }
  const options = {
    body: payload.body || payload.message || 'Nueva notificación',
    icon: payload.icon || '/sportmaps-logo.png',
    badge: '/favicon.png',
    data: { url: payload.url || payload.link || '/' },
    tag: payload.tag || 'sportmaps-notification',
    renotify: true,
  };
  event.waitUntil(
    self.registration.showNotification(payload.title || 'SportMaps', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return (client as WindowClient).focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
