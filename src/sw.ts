/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Workbox 预缓存注入点
precacheAndRoute(self.__WB_MANIFEST);

// ── 推送通知处理 ──

self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? {
    title: '资金管家',
    body: '你有一条新提醒',
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag || 'default',
      data: payload.data || {},
      requireInteraction: payload.urgent || false,
    }),
  );
});

// ── 通知点击处理 ──

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // 如果已有窗口，聚焦并导航
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url,
            data: event.notification.data,
          });
          return;
        }
      }
      // 没有窗口，打开新的
      return self.clients.openWindow(url);
    }),
  );
});

// ── 订阅变更处理（浏览器轮换订阅时） ──

self.addEventListener('pushsubscriptionchange', (event: any) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((newSub) => {
        // 通知服务器更新订阅
        return fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint: event.oldSubscription?.endpoint,
            subscription: newSub.toJSON(),
          }),
        });
      }),
  );
});
