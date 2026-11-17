const CACHE_NAME = 'survey-toolkit-pwa-v2.2.2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

// 1. ติดตั้ง Service Worker และแคชไฟล์หลักลงเครื่อง
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// 2. ล้างแคชเวอร์ชันเก่าอัตโนมัติเมื่ออัปเดตเวอร์ชันใหม่
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(oldKey => caches.delete(oldKey))
      ))
      .then(() => self.clients.claim())
  );
});

// 3. จัดการโหลดไฟล์แบบ Offline-First
self.addEventListener('fetch', event => {
  const req = event.request;

  // ข้ามคำสั่ง POST (Login / Sync Log / Save BM ไปยัง Google Apps Script)
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ไม่แคชข้อมูลที่วิ่งไปยัง Google Apps Script
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return;
  }

  // เปิดหน้าแอปหลัก (รองรับทั้งลิงก์ปกติ และลิงก์พ่วง ?api=...)
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html', { ignoreSearch: true }).then(cachedPage => {
        return cachedPage || fetch(req).then(netRes => {
          const copy = netRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return netRes;
        });
      })
    );
    return;
  }

  // แคชไฟล์ภายในแอป และฟอนต์ Google Fonts ไว้ใช้งานตอนออฟไลน์
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (isSameOrigin || isGoogleFont) {
    event.respondWith(
      caches.match(req, { ignoreSearch: isSameOrigin }).then(cachedRes => {
        if (cachedRes) return cachedRes;

        return fetch(req).then(netRes => {
          if (netRes && (netRes.status === 200 || netRes.type === 'opaque')) {
            const copy = netRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return netRes;
        });
      })
    );
  }
});
