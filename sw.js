/* ═══════════ عامل الخدمة: العمل بدون إنترنت + التنبيهات ═══════════ */
const CACHE = 'mishkat-v12';
const AUDIO_CACHE = 'mishkat-audio-v1';
const SHELL = [
  './', 'index.html', 'styles.css?v=12', 'manifest.webmanifest',
  'js/prayer.js?v=5', 'js/store.js?v=12', 'js/quran-core.js?v=12', 'js/quran.js?v=12', 'js/adhkar.js?v=8', 'js/qibla.js?v=5',
  'js/library.js?v=12', 'js/khatma.js?v=9', 'js/notify.js?v=6', 'js/app.js?v=12',
  'data/quran.json', 'data/adhkar.json', 'data/library-catalog.json', 'data/nawawi40.sample.json',
  'data/mushaf/hafs-kfqc-manifest.json',
  'fonts/amiri-quran.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== AUDIO_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // صوت التلاوة والأذان: من الشبكة أولاً مع حفظ نسخة
  if (/\.mp3$/i.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const cp = res.clone(); caches.open(AUDIO_CACHE).then(c => c.put(req, cp)); }
        return res;
      }).catch(() => new Response('', { status: 504 })))
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // صفحات التنقّل: الشبكة أولاً حتى تصل تحديثات الواجهة فوراً، والكاش عند انقطاع الاتصال.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('index.html'))));
    return;
  }

  // ملفات التطبيق: الكاش أولاً ثم تحديث في الخلفية
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
        return res;
      }).catch(() => hit || caches.match('index.html'));
      return hit || net;
    })
  );
});

/* ── جدول التنبيهات المرسل من الصفحة ── */
let schedule = { city: '', list: [] };

self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'schedule') { schedule = { city: d.city, list: d.list || [] }; checkDue(); }
  if (d.type === 'precache') e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});

/* عرض ما استحق من التنبيهات (يعمل عند إيقاظ عامل الخدمة) */
async function checkDue() {
  const now = Date.now();
  const due = schedule.list.filter(x => x.at <= now && x.at > now - 5 * 60000);
  schedule.list = schedule.list.filter(x => x.at > now);
  for (const ev of due) {
    const title = ev.type === 'adhan' ? `حان الآن وقت صلاة ${ev.ar}`
      : ev.type === 'pre' ? `اقترب وقت ${ev.ar}`
        : ev.type === 'adhkarM' ? 'أذكار الصباح'
          : ev.type === 'khatma' ? (ev.title || 'ورد الختمة') : 'أذكار المساء';
    const body = ev.type === 'adhan' ? `حيّ على الصلاة، حيّ على الفلاح — ${schedule.city || ''}`
      : ev.type === 'pre' ? `بقي ${ev.min} دقيقة على الأذان`
        : ev.type === 'khatma' ? (ev.body || 'حان وقت وردك اليومي') : 'لا تنسَ وردك من الأذكار';
    await self.registration.showNotification(title, {
      body, tag: ev.type + '-' + (ev.key || ''), dir: 'rtl', lang: 'ar', renotify: true,
      icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', vibrate: [200, 100, 200, 100, 400]
    });
  }
}

self.addEventListener('periodicsync', e => { if (e.tag === 'mishkat-prayer-check') e.waitUntil(checkDue()); });
self.addEventListener('sync', e => { if (e.tag === 'mishkat-prayer-check') e.waitUntil(checkDue()); });

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return clients.openWindow('./');
  }));
});
