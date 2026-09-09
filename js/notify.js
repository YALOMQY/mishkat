/* ═══════════════ تنبيهات الصلاة والأذان ═══════════════ */
const Notify = (function () {
  const ADHAN_BASE = 'https://cdn.aladhan.com/audio/adhans/';
  let timers = [], adhanEl = null, actx = null, primed = false;
  let pushStatusTimer = null, pushStatusRequest = 0;
  let pushStatus = {
    available: false, resolved: false, checking: false, configured: false,
    authorization: 'unknown', registered: false, token: '', error: ''
  };
  const pushStatusListeners = new Set();

  const supported = () => 'Notification' in window;
  const perm = () => {
    if (window.__MISHKAT_NATIVE__) return Store.s.notif ? 'granted' : 'default';
    return supported() ? Notification.permission : 'unsupported';
  };

  const isNative = () => !!window.__MISHKAT_NATIVE__;

  function normalizePushAuthorization(value) {
    if (typeof value === 'number') return ['notDetermined', 'denied', 'authorized', 'provisional', 'ephemeral'][value] || 'unknown';
    if (typeof value === 'boolean') return value ? 'authorized' : 'denied';
    const key = String(value ?? '').trim().toLowerCase().replace(/[\s_-]/g, '');
    return ({
      notdetermined: 'notDetermined', denied: 'denied', restricted: 'denied',
      authorized: 'authorized', granted: 'authorized', provisional: 'provisional',
      ephemeral: 'ephemeral'
    })[key] || 'unknown';
  }

  function emitPushStatus() {
    const snapshot = { ...pushStatus };
    pushStatusListeners.forEach(listener => {
      try { listener(snapshot); } catch (e) {}
    });
  }

  function setPushStatus(next) {
    pushStatus = { ...pushStatus, ...next };
    emitPushStatus();
  }

  function acceptPushStatus(raw) {
    clearTimeout(pushStatusTimer);
    let detail = raw;
    if (typeof detail === 'string') {
      try { detail = JSON.parse(detail); } catch (e) { detail = {}; }
    }
    detail = detail && typeof detail === 'object' ? detail : {};
    setPushStatus({
      available: true,
      resolved: true,
      checking: false,
      configured: detail.configured === true || detail.configured === 1,
      authorization: normalizePushAuthorization(detail.authorization),
      registered: detail.registered === true || detail.registered === 1,
      token: typeof detail.token === 'string' ? detail.token.trim() : '',
      error: ''
    });
  }

  window.addEventListener('mishkat-push-status', event => acceptPushStatus(event.detail));

  function onPushStatus(listener) {
    if (typeof listener !== 'function') return () => {};
    pushStatusListeners.add(listener);
    listener({ ...pushStatus });
    return () => pushStatusListeners.delete(listener);
  }

  function refreshPushStatus() {
    const bridge = window.MishkatNative;
    if (!isNative() || !bridge || typeof bridge.getPushStatus !== 'function') {
      setPushStatus({
        available: false, resolved: true, checking: false, configured: false,
        authorization: 'unknown', registered: false, token: '', error: 'bridge-unavailable'
      });
      return;
    }

    const requestID = ++pushStatusRequest;
    setPushStatus({ available: true, checking: true, error: '' });
    clearTimeout(pushStatusTimer);
    pushStatusTimer = setTimeout(() => {
      if (requestID !== pushStatusRequest || !pushStatus.checking) return;
      setPushStatus({ resolved: true, checking: false, error: 'timeout' });
    }, 6000);

    try {
      const result = bridge.getPushStatus();
      if (result && typeof result.then === 'function') {
        result.then(value => { if (requestID === pushStatusRequest && value != null) acceptPushStatus(value); })
          .catch(() => { if (requestID === pushStatusRequest) setPushStatus({ resolved: true, checking: false, error: 'unavailable' }); });
      } else if (result && typeof result === 'object') {
        acceptPushStatus(result);
      }
    } catch (e) {
      clearTimeout(pushStatusTimer);
      setPushStatus({ resolved: true, checking: false, error: 'unavailable' });
    }
  }

  async function request() {
    if (isNative()) {                                   // التطبيق الأصلي: إذن تنبيهات النظام
      MishkatNative.requestNotifications();
      const ok = await new Promise(res => {
        const h = e => { window.removeEventListener('mishkat-perm', h); res(!!e.detail); };
        window.addEventListener('mishkat-perm', h);
        setTimeout(() => { window.removeEventListener('mishkat-perm', h); res(false); }, 30000);
      });
      Store.set('notif', ok);
      toast(ok ? 'تم تفعيل التنبيهات' : 'لم يُمنح إذن التنبيهات');
      refreshUI(); schedule();
      setTimeout(refreshPushStatus, 250);
      return ok ? 'granted' : 'denied';
    }
    if (!supported()) { toast('المتصفح لا يدعم التنبيهات'); return 'unsupported'; }
    const p = await Notification.requestPermission();
    if (p === 'granted') { Store.set('notif', true); toast('تم تفعيل التنبيهات'); }
    else toast('لم يُمنح إذن التنبيهات');
    refreshUI(); schedule();
    return p;
  }

  /* تهيئة الصوت عند أول لمسة من المستخدم (شرط المتصفحات) */
  function prime() {
    if (primed) return;
    primed = true;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) {}
    try {
      adhanEl = new Audio();
      adhanEl.preload = 'none';
      adhanEl.muted = true;
      adhanEl.play().then(() => { adhanEl.pause(); adhanEl.muted = false; }).catch(() => { adhanEl.muted = false; });
    } catch (e) {}
  }

  function beep(times = 3) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      for (let i = 0; i < times; i++) {
        const t0 = actx.currentTime + i * 0.55;
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(i % 2 ? 660 : 880, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
        o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + 0.5);
      }
    } catch (e) {}
  }

  function playAdhan() {
    if (isNative()) return;                       // في التطبيق الأصلي الصوت جزء من الإشعار
    const f = Store.s.adhanFile;
    if (f === 'beep' || !navigator.onLine) { beep(); return; }
    try {
      if (!adhanEl) adhanEl = new Audio();
      adhanEl.src = ADHAN_BASE + f + '.mp3';
      adhanEl.currentTime = 0;
      adhanEl.onended = hideStopBar;
      adhanEl.play().then(showStopBar).catch(() => beep());
    } catch (e) { beep(); }
  }
  function stopAdhan() { if (adhanEl) { adhanEl.pause(); adhanEl.currentTime = 0; } hideStopBar(); }

  /* شريط إيقاف ظاهر ما دام الأذان يعمل — حتى لا يبقى الصوت بلا تحكّم */
  function showStopBar() {
    let bar = document.getElementById('adhanBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'adhanBar';
      bar.innerHTML = `<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5l4.5 4Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></svg>الأذان يُرفع الآن</span><button>إيقاف الصوت</button>`;
      bar.querySelector('button').addEventListener('click', stopAdhan);
      document.body.appendChild(bar);
    }
    requestAnimationFrame(() => bar.classList.add('show'));
  }
  function hideStopBar() {
    const bar = document.getElementById('adhanBar');
    if (bar) bar.classList.remove('show');
  }

  async function cacheAdhan() {
    if (!('caches' in window)) { toast('التخزين غير مدعوم'); return; }
    const f = Store.s.adhanFile;
    if (f === 'beep') { toast('النغمة القصيرة تعمل بدون إنترنت أصلاً'); return; }
    toast('جارٍ حفظ الأذان…');
    try {
      // خوادم الصوت لا ترسل ترويسات CORS، فنحفظ الاستجابة بوضع no-cors
      const c = await caches.open('mishkat-audio-v1');
      const req = new Request(ADHAN_BASE + f + '.mp3', { mode: 'no-cors' });
      await c.put(req, await fetch(req));
      toast('تم حفظ الأذان للاستخدام بدون إنترنت');
    } catch (e) { toast('تعذّر الحفظ — تحقق من الاتصال'); }
  }

  function show(title, body, tag) {
    const opts = {
      body, tag, dir: 'rtl', lang: 'ar', renotify: true,
      icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
      vibrate: [200, 100, 200, 100, 400]
    };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(() => { try { new Notification(title, opts); } catch (e) {} });
    } else { try { new Notification(title, opts); } catch (e) {} }
  }

  /* بناء قائمة الأحداث القادمة (يومان في الويب، أسبوع في التطبيق الأصلي) */
  function upcoming(days) {
    const s = Store.s;
    if (s.lat == null) return [];
    const opts = { method: s.method, methodAuto: !s._methodSet, asr: s.asr, highLats: s.highLats, tune: s.tune };
    const now = new Date(), events = [];
    const span = days || (isNative() ? 7 : 2);
    for (let d = 0; d < span; d++) {
      const day = new Date(now.getTime() + d * 864e5);
      const t = PrayerCalc.getTimes(day, { lat: s.lat, lng: s.lng }, opts);
      PrayerCalc.ORDER.forEach(p => {
        if (p.noAdhan || !t[p.key] || !s.perPrayer[p.key]) return;
        if (t[p.key] > now) events.push({ at: t[p.key], type: 'adhan', key: p.key, ar: p.ar });
        if (s.preMinutes > 0) {
          const pre = new Date(t[p.key].getTime() - s.preMinutes * 60000);
          if (pre > now) events.push({ at: pre, type: 'pre', key: p.key, ar: p.ar, min: s.preMinutes });
        }
      });
      if (s.adhkarNotif) {
        if (t.sunrise) { const a = new Date(t.sunrise.getTime() + 30 * 60000); if (a > now) events.push({ at: a, type: 'adhkarM' }); }
        if (t.asr)     { const a = new Date(t.asr.getTime() + 30 * 60000);     if (a > now) events.push({ at: a, type: 'adhkarE' }); }
      }
      if (typeof Khatma !== 'undefined') {
        Khatma.getState().plans.filter(plan => plan.status === 'active').forEach(plan => {
          const reminder = Khatma.resolveReminder(plan, { date: day, prayerTimes: t });
          if (reminder && reminder.date > now) events.push({
            at: reminder.date, type: 'khatma', key: plan.id,
            title: reminder.title, body: reminder.body
          });
        });
      }
    }
    return events.sort((a, b) => a.at - b.at);
  }

  function fire(ev) {
    // في التطبيق الأصلي يتولّى النظام كل شيء — لا نكرّر الإشعار ولا الصوت
    if (isNative()) return;
    if (ev.type === 'adhan') {
      show(`حان الآن وقت صلاة ${ev.ar}`, `${fmtTime(ev.at)} — ${Store.s.city || 'موقعك'}\nحيّ على الصلاة، حيّ على الفلاح`, 'prayer-' + ev.key);
      if (Store.s.adhanSound) playAdhan();
      vibrate([300, 150, 300]);
    } else if (ev.type === 'pre') {
      show(`اقترب وقت ${ev.ar}`, `بقي ${toAr(ev.min)} دقيقة على الأذان (${fmtTime(new Date(ev.at.getTime() + ev.min * 60000))})`, 'pre-' + ev.key);
    } else if (ev.type === 'adhkarM') {
      show('أذكار الصباح', 'لا تنسَ وردك من أذكار الصباح', 'adhkar-m');
    } else if (ev.type === 'adhkarE') {
      show('أذكار المساء', 'لا تنسَ وردك من أذكار المساء', 'adhkar-e');
    } else if (ev.type === 'khatma') {
      show(ev.title || 'ورد الختمة', ev.body || 'حان وقت وردك اليومي', 'khatma-' + (ev.key || 'daily'));
    }
    setTimeout(schedule, 2000);
  }

  /* جدولة المؤقتات أثناء فتح التطبيق + إرسال الجدول لعامل الخدمة */
  /** مزامنة إعدادات المواقيت مع الودجت (التطبيق الأصلي فقط) */
  function syncWidget() {
    if (!isNative() || !window.MishkatNative) return;
    const s = Store.s;
    if (MishkatNative.syncDuas) {
      MishkatNative.syncDuas((s.customDuas || []).map(d => ({ title: d.title || '', text: d.text })));
    }
    if (MishkatNative.syncWidget && s.lat != null) {
      MishkatNative.syncWidget({ lat: s.lat, lng: s.lng, method: s.method, methodAuto: !s._methodSet, asr: s.asr,
                                 highLats: s.highLats, city: s.city || '', tune: s.tune });
    }
  }

  function schedule() {
    syncWidget();
    timers.forEach(clearTimeout); timers = [];
    if (!Store.s.notif || perm() !== 'granted') { pushToSW([]); return; }
    const evs = upcoming();
    const MAX = 2147483647;
    evs.slice(0, 12).forEach(ev => {
      const delay = ev.at - new Date();
      if (delay > 0 && delay < MAX) timers.push(setTimeout(() => fire(ev), delay));
    });
    pushToSW(evs.slice(0, isNative() ? 60 : 20)
      .map(e => ({ at: e.at.getTime(), type: e.type, ar: e.ar || '', key: e.key || '', min: e.min || 0,
                   title: e.title || '', body: e.body || '' })));
    refreshUI();
  }

  function pushToSW(list) {
    try {
      localStorage.setItem('mishkat.schedule', JSON.stringify({ city: Store.s.city, list }));
      // التطبيق الأصلي: تنبيهات نظام موثوقة تعمل والتطبيق مغلق
      // التطبيق الأصلي: النظام يتولّى الإشعار وصوته معاً
      if (isNative()) {
        MishkatNative.schedule(list, Store.s.city || '', Store.s.adhanSound ? Store.s.adhanFile : 'none');
        return;
      }
      if (navigator.serviceWorker && navigator.serviceWorker.controller)
        navigator.serviceWorker.controller.postMessage({ type: 'schedule', city: Store.s.city, list });
    } catch (e) {}
  }

  async function enablePeriodic() {
    try {
      const reg = await navigator.serviceWorker.ready;
      if ('periodicSync' in reg) {
        const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (st.state === 'granted') await reg.periodicSync.register('mishkat-prayer-check', { minInterval: 15 * 60 * 1000 });
      }
    } catch (e) {}
  }

  function refreshUI() {
    const p = perm();
    const state = $('#permState'); if (state) state.textContent =
      p === 'granted' ? 'ممنوح ✓' : p === 'denied' ? 'مرفوض — فعّله من إعدادات المتصفح' : p === 'unsupported' ? 'غير مدعوم' : 'لم يُطلب بعد';
    const ns = $('#notifState');
    if (ns) {
      if (p !== 'granted') ns.textContent = 'التنبيهات غير مفعّلة — اضغط للتفعيل.';
      else if (!Store.s.notif) ns.textContent = 'الإذن ممنوح لكن التنبيه متوقف من الإعدادات.';
      else {
        const n = upcoming().find(e => e.type === 'adhan');
        ns.textContent = n ? `التنبيه القادم: ${n.ar} — ${fmtTime(n.at)}` : 'مفعّلة ✓ (حدّد موقعك أولاً)';
      }
    }
    const card = $('#notifCard'); if (card) card.classList.toggle('ok', p === 'granted' && Store.s.notif);
    const sw = $('#swNotif'); if (sw) sw.checked = Store.s.notif && p === 'granted';
  }

  function test() {
    if (perm() !== 'granted') { request(); return; }
    if (isNative()) {
      MishkatNative.testNotification(Store.s.adhanSound ? Store.s.adhanFile : 'none');
      toast('سيصلك تنبيه تجريبي بعد ثوانٍ');
      return;
    }
    show('تجربة التنبيه', 'هكذا سيصلك تنبيه الصلاة — إن شاء الله ✓', 'test');
    if (Store.s.adhanSound) playAdhan();
    vibrate([200, 100, 200]);
  }

  return {
    request, schedule, syncWidget, refreshUI, test, playAdhan, stopAdhan, cacheAdhan,
    prime, enablePeriodic, perm, upcoming, refreshPushStatus, onPushStatus,
    getPushStatus: () => ({ ...pushStatus })
  };
})();
