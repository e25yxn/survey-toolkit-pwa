const CACHE_NAME = 'survey-toolkit-os-v2.1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

// 1. ติดตั้ง Service Worker และเก็บไฟล์หลักลง Cache ในเครื่อง
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// 2. ลบ Cache เวอร์ชันเก่าอัตโนมัติเมื่อมีการอัปเดตเวอร์ชัน
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

// 3. จัดการการดึงข้อมูล (Offline-First สำหรับตัวแอปและฟอนต์)
self.addEventListener('fetch', event => {
  const req = event.request;

  // ข้ามคำสั่ง POST (Login / Save Log ไปยัง Google Apps Script)
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ไม่แคชข้อมูลที่วิ่งไปยังเซิร์ฟเวอร์ Google Apps Script
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return;
  }

  // เปิดหน้าเว็บหลัก (รองรับทั้งลิงก์ปกติ และลิงก์ที่มี ?api=... ต่อท้าย)
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

  // แคชไฟล์ภายในแอป และฟอนต์จาก Google Fonts ไว้ใช้ตอนออฟไลน์
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
