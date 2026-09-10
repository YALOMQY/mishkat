/* ═══════════ عامل الخدمة: العمل بدون إنترنت + التنبيهات ═══════════ */
const CACHE = 'mishkat-v17';
const AUDIO_CACHE = 'mishkat-audio-v1';
const MUSHAF_CACHE = 'mishkat-mushaf-v1';
const SHELL = [
  './', 'index.html', 'styles.css?v=17', 'manifest.webmanifest',
  'js/prayer.js?v=5', 'js/store.js?v=13', 'js/quran-core.js?v=12', 'js/quran.js?v=17', 'js/adhkar.js?v=14', 'js/qibla.js?v=13',
  'js/library.js?v=14', 'js/khatma.js?v=15', 'js/notify.js?v=13', 'js/app.js?v=14',
  'data/quran.json', 'data/adhkar.json', 'data/library-catalog.json', 'data/nawawi40.sample.json',
  'data/mushaf/hafs-kfqc-manifest.json',
  'fonts/amiri-quran.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => /^mishkat-v\d+$/.test(k) && k !== CACHE).map(k => caches.delete(k))))
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

  if (/\/assets\/mushaf\/hafs-kfqc\/pages\/\d+\.svg$/.test(url.pathname)) {
    e.respondWith(caches.open(MUSHAF_CACHE).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const response = await fetch(req);
        if (response.ok) await cache.put(req, response.clone());
        return response;
      } catch (_) { return new Response('', {status:504}); }
    }));
    return;
  }

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
      }).catch(() => hit || new Response('', { status: 504 }));
      return hit || net;
    })
  );
});

/* ── جدول التنبيهات المرسل من الصفحة ── */
let schedule = { city: '', list: [] };

self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'schedule') { schedule = { city: d.city, list: d.list || [] }; checkDue(); }
  if (d.type === 'precache' || d.type === 'offline-status') e.waitUntil((async () => {
    const reply = data => e.ports[0]?.postMessage(data);
    try {
      const shell = await caches.open(CACHE);
      const pages = await caches.open(MUSHAF_CACHE);
      if (d.type === 'precache') {
        await shell.addAll(SHELL);
        let done = 0;
        // دفعات صغيرة تبقي الواجهة مستجيبة وتتيح استئناف الصفحات الناقصة فقط.
        for (let start = 1; start <= 604; start += 4) {
          await Promise.all(Array.from({length: Math.min(4, 605 - start)}, async (_, i) => {
            const url = `assets/mushaf/hafs-kfqc/pages/${String(start + i).padStart(3, '0')}.svg`;
            if (!await pages.match(url)) await pages.add(new Request(url, {signal: AbortSignal.timeout(20000)}));
            reply({progress:true, done:++done, total:604});
          }));
        }
      }
      const keys = await pages.keys();
      const count = keys.filter(r => /\/pages\/\d+\.svg$/.test(new URL(r.url).pathname)).length;
      const hasShell = (await Promise.all(SHELL.map(url => shell.match(url)))).every(Boolean);
      reply({complete:count === 604 && hasShell, pages:count});
    } catch (error) { reply({error:error.message || 'offline unavailable'}); }
  })());
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
