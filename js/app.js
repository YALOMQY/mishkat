/* ═══════════════ التطبيق: التنقّل، الرئيسية، الإعدادات ═══════════════ */
(function () {
  let tickTimer = null, wakeLock = null, currentPushToken = '';
  let locationTimer = null, locationRequest = 0;
  const contentReady = { quran: false, adhkar: false };

  /* ───────── التنقّل ───────── */
  const TITLES = { home: 'مشكاة', quran: 'القرآن الكريم', adhkar: 'الأذكار', qibla: 'القبلة', library: 'المكتبة والختمة', settings: 'الإعدادات', tasbih: 'السبحة' };

  /* إدارة زر الرجوع في الجوال للشاشات الفرعية (القارئ / باب الأذكار) */
  const inSub = () => !!(history.state && history.state.sub);
  window.Nav = {
    enter(sub = 'reader') {
      if (history.state?.sub !== sub) history.pushState({ view: document.body.dataset.view, sub }, '');
    },
    exit(close) { if (inSub()) history.back(); else close(); }
  };

  function go(view, restoring = false) {
    view = TITLES[view] ? view : 'home';
    const previous = document.body.dataset.view;
    if (previous && previous !== view) {
      if (Quran.isOpen) Quran.backToIndex();
      if (Adhkar.isOpen) Adhkar.back();
      if (!restoring && inSub()) history.replaceState({ view: previous }, '', '#' + previous);
    }
    $$('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + view));
    $$('#tabbar button').forEach(b => {
      const current = b.dataset.view === view;
      b.classList.toggle('on', current);
      if (current) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const title = TITLES[view] || 'مشكاة';
    $('#topTitle').innerHTML = view === 'home'
      ? '<span class="brand-lantern" aria-hidden="true"></span><span>مشكاة</span>'
      : `<span>${title}</span>`;
    $('#btnSettingsTop').classList.toggle('is-current', view === 'settings');
    const settingsButton = $('#btnSettingsTop');
    if (!settingsButton.dataset.originalIcon) settingsButton.dataset.originalIcon = settingsButton.innerHTML;
    settingsButton.innerHTML = view === 'settings' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="stroke" d="m10 6 6 6-6 6"/></svg>' : settingsButton.dataset.originalIcon;
    settingsButton.setAttribute('aria-label', view === 'settings' ? 'العودة إلى الرئيسية' : 'فتح الإعدادات');
    settingsButton.title = settingsButton.getAttribute('aria-label');
    document.body.dataset.view = view;
    if (view === 'home') renderJourney();
    document.title = view === 'home'
      ? 'مشكاة — قرآن وأذكار وقبلة ومواقيت'
      : `${TITLES[view] || 'مشكاة'} — مشكاة`;
    const scroller = document.getElementById('app');
    scroller.scrollTo({ top: 0, behavior: 'instant' });
    if (view === 'qibla') Qibla.init(); else Qibla.stop();   // إيقاف المستشعر خارج الشاشة
    if (view !== 'quran') Quran.stop();
    if (view === 'settings' && typeof Notify !== 'undefined') Notify.refreshPushStatus();
    if (!restoring && previous !== view) {
      if (previous) history.pushState({ view }, '', '#' + view);
      else history.replaceState({ view }, '', '#' + view);
    }
  }

  /* ───────── الرئيسية ───────── */
  function opts() {
    const s = Store.s;
    return { method: s.method, methodAuto: !s._methodSet, asr: s.asr, highLats: s.highLats, tune: s.tune };
  }
  function coords() { return Store.s.lat == null ? null : { lat: Store.s.lat, lng: Store.s.lng }; }

  function prayerIcon(key) {
    const paths = {
      fajr: '<path d="M5 16h14M7 12h10M9 8h6"/><path d="M12 3v2M4.2 6.2l1.5 1.2M19.8 6.2l-1.5 1.2"/>',
      sunrise: '<path d="M4 16h16M7 16a5 5 0 0 1 10 0"/><path d="M12 4v3M4.8 8.1l2.1 1.3M19.2 8.1l-2.1 1.3"/>',
      dhuhr: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
      asr: '<circle cx="15.5" cy="8.5" r="3.5"/><path d="M4 18h16M6 15h8M5 7v8"/>',
      maghrib: '<path d="M4 17h16M7 17a5 5 0 0 1 10 0"/><path d="M5 9h14M12 3v3"/>',
      isha: '<path d="M18.5 15.5A7 7 0 0 1 8.5 5a7 7 0 1 0 10 10.5Z"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[key] || paths.dhuhr}</svg>`;
  }

  function bellIcon(enabled) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 9a6 6 0 0 0-12 0c0 6-3 7-3 9h18c0-2-3-3-3-9Z"/>
      <path d="M10 21h4"/>${enabled ? '' : '<path d="M4 4l16 16"/>'}
    </svg>`;
  }

  function renderHome() {
    renderJourney();
    const now = new Date();
    $('#hijriDate').textContent = hijriDate(now, Store.s.hijriOffset);
    $('#gregDate').textContent = gregDate(now);
    $('#locText').textContent = Store.s.city || (coords() ? 'موقعك المحدَّد' : 'لم يتم تحديد الموقع');
    $('#homePlaceCompact').textContent = Store.s.city || (coords() ? 'موقعك المحدّد' : 'الموقع غير محدد');
    $('#setLoc').textContent = coords() ? (Store.s.city || 'موقع محدّد') : 'غير محدد';
    $('#locationMode').textContent = Store.s.locationAuto ? 'تلقائي — يُحدّث عند العودة إلى التطبيق' : coords() ? 'مدينة محفوظة — التحديث التلقائي متوقف' : 'اختر مدينتك أو استخدم موقعك الحالي';

    const c = coords();
    $('#heroCard').classList.toggle('is-empty', !c);
    $('#nightCard').hidden = !c;
    if (!c) {
      $('#nextLabel').textContent = 'ابدأ من موقعك';
      $('#nextName').textContent = 'مواقيت الصلاة بدقة';
      $('#nextCountdown').textContent = 'حدّد موقعك لعرض الأوقات والقبلة';
      $('#nextAt').textContent = '';
      $('#prayerList').innerHTML = `<div class="need-loc"><div class="empty-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s6-5.7 6-11a6 6 0 1 0-12 0c0 5.3 6 11 6 11Z"/><circle cx="12" cy="10" r="2.2"/></svg></div>
        <h3>اسمح بالوصول إلى موقعك</h3><p>نستخدمه على جهازك فقط لحساب المواقيت واتجاه القبلة.</p>
        <button class="btn primary" id="btnLocInline">تحديد موقعي تلقائياً</button>
        <button class="btn ghost" id="btnLocManual">اختيار مدينة يدوياً</button></div>`;
      $('#btnLocInline').addEventListener('click', autoLocate);
      $('#btnLocManual').addEventListener('click', () => go('settings'));
      return;
    }

    $('#nextLabel').textContent = 'الصلاة القادمة';

    const info = PrayerCalc.nextPrayer(now, c, opts());
    const t = info.today;

    $('#prayerList').innerHTML = PrayerCalc.ORDER.map(p => {
      const isNext = info.next.key === p.key;
      const isCur = info.current && info.current.key === p.key;
      const on = p.noAdhan ? null : Store.s.notif && Notify.perm() === 'granted' && Store.s.perPrayer[p.key];
      return `<div class="prayer ${isNext ? 'next' : ''} ${isCur ? 'cur' : ''}">
        <span class="p-icon">${prayerIcon(p.key)}</span>
        <span class="p-name">${p.ar}${isCur ? '<small>الوقت الحالي</small>' : ''}</span>
        <span class="p-time">${fmtTime(t[p.key])}</span>
        ${p.noAdhan ? '<span class="p-bell dim">—</span>'
          : `<button class="p-bell ${on ? 'on' : ''}" data-bell="${p.key}" title="تنبيه ${p.ar}"
              aria-label="${on ? 'إيقاف' : 'تفعيل'} تنبيه ${p.ar}" aria-pressed="${!!on}">${bellIcon(on)}</button>`}
      </div>`;
    }).join('');

    $('#tMidnight').textContent = fmtTime(t.midnight);
    $('#tLastThird').textContent = fmtTime(t.lastThird);
    $('#tImsak').textContent = fmtTime(t.imsak);
    $('#tSunriseB').textContent = fmtTime(t.sunrise);

    if (t.__approx) toastOnce('في موقعك لا يغيب الشفق تماماً في هذا الوقت من السنة — تم تقدير الفجر والعشاء بقاعدة «' + hlName() + '».');
    tick();
  }
  // Read-only shortcuts: reuse the existing reading position and khatma API.
  function renderJourney() {
    const root = $('#homeJourney');
    if (!root) return;
    const lr = Store.s.lastRead;
    const plan = Khatma.getActive();
    root.innerHTML = `<button type="button" class="journey" data-journey="read">
      <span class="journey-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/></svg></span>
      <span><b>${lr ? 'تابع من حيث توقفت' : 'ابدأ رحلتك مع القرآن'}</b><small id="homeReadingMeta"></small></span><span aria-hidden="true">‹</span></button>
      <button type="button" class="journey" data-journey="khatma"><span class="journey-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 3h14v18l-7-4-7 4Z"/><path d="m8 9 3 3 5-5"/></svg></span><span><b>${plan ? 'ورد ختمتك' : 'خطّط لختمتك'}</b><small id="homeKhatmaMeta"></small></span><span aria-hidden="true">‹</span></button>`;
    const chapter = Quran.data?.surahs?.[Number(lr?.s) - 1];
    $('#homeReadingMeta').textContent = lr ? `${chapter?.name || 'القرآن الكريم'} · صفحة ${toAr(lr.page || 1)}` : 'صفحات المصحف، مع التلاوة والعلامات';
    $('#homeKhatmaMeta').textContent = plan ? `${plan.name} · وصلت إلى الصفحة ${toAr(plan.progressPage)}` : 'ورد يناسب وقتك، وتقدّم محفوظ';
  }
  function hlName() {
    return { NightMiddle: 'منتصف الليل', AngleBased: 'حسب الزاوية', OneSeventh: 'سُبع الليل', None: 'بدون تعديل' }[Store.s.highLats];
  }
  const toastOnce = (m) => { if (toastOnce._m === m) return; toastOnce._m = m; toast(m, 5000); };

  function tick() {
    const c = coords(); if (!c) return;
    const now = new Date();
    const info = PrayerCalc.nextPrayer(now, c, opts());
    $('#nextName').textContent = info.next.ar;
    $('#nextCountdown').textContent = fmtDuration(info.next.at - now);
    $('#nextAt').textContent = 'عند ' + fmtTime(info.next.at);

    // حلقة التقدّم بين الصلاتين
    const prev = info.current ? info.current.at : new Date(info.next.at.getTime() - 6 * 3600e3);
    const span = info.next.at - prev, done = Math.min(1, Math.max(0, (now - prev) / span));
    const ring = $('#ringFg'), C = 2 * Math.PI * 54;
    if (ring) { ring.style.strokeDasharray = C; ring.style.strokeDashoffset = C * (1 - done); }

    // إعادة رسم القائمة عند تغيّر اليوم أو انتقال الوقت للصلاة التالية
    const stamp = now.getDate() + ':' + info.next.key;
    if (tick._stamp && tick._stamp !== stamp) { tick._stamp = stamp; renderHome(); return; }
    tick._stamp = stamp;
  }

  /* ───────── الموقع ───────── */
  function locationState(text, busy = false, error = false) {
    const status = $('#locationStatus');
    status.textContent = text; status.hidden = !text;
    status.classList.toggle('is-error', error);
    const button = $('#btnAutoLoc');
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
    button.textContent = busy ? 'جارٍ تحديد موقعك…' : 'استخدام موقعي الحالي';
  }

  function locationFailed(denied, explicit = true) {
    clearTimeout(locationTimer);
    const onboarding = !!window.__onboardingFlow;
    window.__locAsked = false; window.__onboardingFlow = false;
    if (explicit) {
      locationState(denied ? 'إذن الموقع متوقف. اسمح به من إعدادات الجهاز، أو اختر مدينتك أدناه.' : 'تعذّر تحديد موقعك الآن. أعد المحاولة أو اختر مدينة.', false, true);
      go('settings');
    }
    if (onboarding) setTimeout(showNotificationStep, 520);
  }

  function autoLocate(silent = false) {
    silent = silent === true;
    if (window.__locAsked) return;
    const requestID = ++locationRequest;
    if (!silent) {
      window.__locAsked = true;
      locationState('نبحث عن موقعك الحالي…', true);
      locationTimer = setTimeout(() => { locationRequest++; locationFailed(false); }, 20000);
    }
    if (window.__MISHKAT_NATIVE__) { MishkatNative.requestLocation(); return; }
    if (!navigator.geolocation) { locationFailed(false, !silent); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (requestID !== locationRequest) return;
        clearTimeout(locationTimer); window.__locAsked = false;
        Store.set('locationAuto', true);
        applyLocation(pos.coords.latitude, pos.coords.longitude, '', silent);
        locationState('تم تحديث الموقع والمواقيت.');
        if (window.__onboardingFlow) { window.__onboardingFlow = false; setTimeout(showNotificationStep, 420); }
      },
      err => {
        if (requestID === locationRequest) locationFailed(err.code === 1, !silent);
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 });
  }

  function closeWelcomeSheet() {
    const sheet = $('#welcomeSheet');
    if (!sheet) return;
    sheet.classList.remove('show');
    setTimeout(() => sheet.remove(), 260);
  }

  function welcomeSheet({ eyebrow, title, body, primary, secondary, onPrimary, onSecondary }) {
    closeWelcomeSheet();
    const sheet = document.createElement('div');
    sheet.id = 'welcomeSheet';
    sheet.className = 'sheet welcome-sheet';
    sheet.innerHTML = `<div class="sheet-in welcome-in" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle">
      <span class="sheet-handle" aria-hidden="true"></span>
      <span class="eyebrow">${eyebrow}</span>
      <h2 id="welcomeTitle">${title}</h2>
      <p>${body}</p>
      <div class="welcome-privacy"><span class="privacy-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.7 8.1 7 10 4.3-1.9 7-5.4 7-10V6l-7-3Z"/><path d="m9.2 12 1.8 1.8 3.9-4.1"/></svg></span><span>تُحسب المواقيت والقبلة على جهازك، ويُستخدم نظام الجهاز للتعرّف على اسم المنطقة.</span></div>
      <button class="btn primary" data-welcome="primary">${primary}</button>
      <button class="btn ghost" data-welcome="secondary">${secondary}</button>
    </div>`;
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('show'));
    sheet.querySelector('[data-welcome="primary"]').addEventListener('click', () => { closeWelcomeSheet(); onPrimary(); });
    sheet.querySelector('[data-welcome="secondary"]').addEventListener('click', () => { closeWelcomeSheet(); onSecondary(); });
  }

  function showNotificationStep() {
    if (Store.s.notificationPromptSeen || Notify.perm() === 'granted') return;
    welcomeSheet({
      eyebrow: 'الخطوة الثانية',
      title: 'هل تريد تذكيرًا عند الصلاة؟',
      body: 'يصلك إشعار في موعد الصلاة. في تطبيق iPhone يكون صوت الأذان القصير جزءًا من إشعار النظام، وليس مقطعًا مستمرًا.',
      primary: 'السماح بالتنبيهات', secondary: 'ليس الآن',
      onPrimary: async () => {
        Store.set('notificationPromptSeen', true);
        const p = await Notify.request();
        if (p === 'granted') { Store.set('notif', true); $('#swNotif').checked = true; Notify.schedule(); Notify.refreshUI(); }
      },
      onSecondary: () => Store.set('notificationPromptSeen', true)
    });
  }

  function showFirstRun() {
    if (Store.s.onboardingSeen) return;
    if (Store.s.lat != null) {
      Store.set('onboardingSeen', true);
      showNotificationStep();
      return;
    }
    welcomeSheet({
      eyebrow: 'مرحبًا بك في مشكاة',
      title: 'ابدأ بمواقيت مدينتك',
      body: 'نستخدم موقعك لحساب الصلاة والقبلة بدقة، ثم نحدّثه عند عودتك إلى التطبيق.',
      primary: 'استخدام موقعي', secondary: 'سأختار لاحقًا',
      onPrimary: () => { Store.set('onboardingSeen', true); window.__onboardingFlow = true; autoLocate(); },
      onSecondary: () => {
        Store.set('onboardingSeen', true);
        setTimeout(showNotificationStep, 420);
      }
    });
  }

  /**
   * @param {string} [placeName] اسم من نظام التشغيل (CLGeocoder) — أدقّ ما يمكن
   */
  function applyLocation(lat, lng, placeName, silent = false) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    Store.set('lat', +lat.toFixed(4)); Store.set('lng', +lng.toFixed(4));
    const guess = nearestPlace(lat, lng);
    Store.set('city', placeName || (guess ? guess[0] : 'موقعك الحالي'));
    if (guess && !Store.s._methodSet) { Store.set('method', guess[3]); $('#selMethod').value = guess[3]; }
    $('#inLat').value = Store.s.lat; $('#inLng').value = Store.s.lng; $('#inCity').value = Store.s.city;
    Qibla.setLocation(Store.s.lat, Store.s.lng);
    if (document.body.dataset.view === 'qibla') Qibla.init();
    renderHome(); Notify.schedule();
    if (!silent) toast('تم تحديد الموقع: ' + (Store.s.city || 'موقعك'));
  }
  window.__requestLocation = autoLocate;

  // الموقع الأصلي: يُحدَّث تلقائياً مع كل قراءة حديثة، مع إبقاء رسالة النجاح للطلب الصريح فقط.
  window.addEventListener('mishkat-location', e => {
    const explicit = !!window.__locAsked;
    if (!explicit && !Store.s.locationAuto) return;
    clearTimeout(locationTimer);
    window.__locAsked = false;
    Store.set('locationAuto', true);
    applyLocation(e.detail.lat, e.detail.lng, e.detail.name || '', !explicit);
    if (explicit) locationState('تم تحديث الموقع والمواقيت.');
    if (window.__onboardingFlow) {
      window.__onboardingFlow = false;
      setTimeout(showNotificationStep, 420);
    }
  });
  // اسم المكان يصل متأخراً بعد استعلام النظام — نحدّثه دون لمس الإحداثيات.
  // شرط: أن يكون اسماً للموقع المعروض فعلاً، لا لموقع لم يُطبَّق.
  window.addEventListener('mishkat-place', e => {
    const d = e.detail || {}, name = (d.name || '').trim();
    if (!Store.s.locationAuto || !name || name === Store.s.city || Store.s.lat == null) return;
    if (d.lat != null && (Math.abs(d.lat - Store.s.lat) > 0.05 || Math.abs(d.lng - Store.s.lng) > 0.05)) return;
    Store.set('city', name);
    $('#inCity').value = name;
    renderHome();
    const qp = $('#qPlace'); if (qp) qp.textContent = name;
  });
  window.addEventListener('mishkat-location-error', e => {
    locationFailed(e.detail?.reason === 'denied', !!window.__locAsked || !!window.__onboardingFlow);
  });

  /** أقرب مدينة (٣٥ كم)، فإن لم توجد فأقرب محافظة/منطقة (٤٥٠ كم). تقدير محلي لا حدود إدارية. */
  function nearestPlace(lat, lng) {
    const nearest = list => {
      let best = null, bd = 1e9;
      list.forEach(c => {
        // تصحيح تقارب خطوط الطول عند الاقتراب من القطبين
        const dx = (c[2] - lng) * Math.cos(lat * Math.PI / 180), dy = c[1] - lat;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = c; }
      });
      return [best, Math.sqrt(bd) * 111];        // المسافة بالكيلومترات تقريباً
    };
    const [city, dCity] = nearest(CITIES);
    if (dCity <= 35) return city;
    const [region, dRegion] = nearest(REGIONS);
    if (dRegion <= 450) return region;
    return null; // اسم مدينة بعيدة يوحي خطأً بأن الموقع دقيق.
  }

  /* ───────── السبحة ───────── */
  function initTasbih() {
    const btn = $('#counterBtn'), val = $('#counterVal');
    let n = Math.max(0, Number(Store.s.tasbihSession) || 0);
    $('#tasbihTarget').value = String(Store.s.tasbihTarget || 0);
    if (Store.s.tasbihPhrase) $('#tasbihPhrase').value = Store.s.tasbihPhrase;
    const render = () => {
      val.textContent = toAr(n);
      $('#tasbihTotal').textContent = toAr(Store.s.tasbihTotal);
      const target = +$('#tasbihTarget').value;
      btn.classList.toggle('reached', target > 0 && n >= target);
    };
    btn.addEventListener('click', () => {
      n++; Store.set('tasbihTotal', Store.s.tasbihTotal + 1);
      Store.set('tasbihSession', n);
      const target = +$('#tasbihTarget').value;
      vibrate(target > 0 && n === target ? [40, 60, 40, 60, 90] : 15);
      if (target > 0 && n === target) toast('اكتمل العدد ✓');
      render();
    });
    $('#tasbihReset').addEventListener('click', () => { n = 0; Store.set('tasbihSession', 0); render(); toast('بدأ عدّ جديد'); });
    $('#tasbihTarget').addEventListener('change', e => { Store.set('tasbihTarget', +e.target.value); render(); });
    $('#tasbihPhrase').addEventListener('change', e => Store.set('tasbihPhrase', e.target.value));
    $('#tasbihVibe').addEventListener('click', e => {
      Store.set('vibrate', !Store.s.vibrate);
      e.target.textContent = 'اهتزاز: ' + (Store.s.vibrate ? 'تشغيل' : 'إيقاف');
    });
    $('#tasbihVibe').textContent = 'اهتزاز: ' + (Store.s.vibrate ? 'تشغيل' : 'إيقاف');
    render();
  }

  /* ───────── المكتبة والختمة ───────── */
  function initLibraryTools() {
    Library.init({ root: '#libraryRoot', notify: toast }).catch(() => {});
    Khatma.init({
      root: '#khatmaRoot',
      notify: toast,
      resolvePoint: (kind, value, contextSurah) => Quran.resolvePoint(kind, value, contextSurah),
      onContinue: page => { go('quran'); if (contentReady.quran) Quran.openPage(page); },
      onChange: () => Notify.schedule()
    });
    $('#toolsSeg').addEventListener('click', e => {
      const button = e.target.closest('[data-tools-tab]'); if (!button) return;
      const tab = button.dataset.toolsTab;
      $$('#toolsSeg button').forEach(b => {
        const on = b === button;
        b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
      });
      $('#libraryRoot').classList.toggle('hidden', tab !== 'library');
      $('#khatmaRoot').classList.toggle('hidden', tab !== 'khatma');
    });
  }

  /* ───────── المظهر ───────── */
  function applyTheme() {
    const t = Store.s.theme;
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.font = ['large', 'xlarge'].includes(Store.s.uiFont) ? Store.s.uiFont : 'normal';
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = dark ? '#081510' : '#f6f1e8';
  }

  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
      else if (wakeLock) { wakeLock.release(); wakeLock = null; }
    } catch (e) {}
  }

  /* ───────── حالة رسائل Firebase ───────── */
  function renderPushStatus(status) {
    const card = $('#pushServiceCard');
    if (!card) return;

    const title = $('#pushStatusTitle'), text = $('#pushStatusText'), label = $('#pushStatusLabel');
    const enable = $('#btnEnablePush'), refresh = $('#btnRefreshPush'), copy = $('#btnCopyFCM');
    const authorized = ['authorized', 'provisional', 'ephemeral'].includes(status.authorization);
    const ready = status.configured && authorized && status.registered && !!status.token;
    const denied = status.authorization === 'denied';
    const firstCheck = !status.resolved;

    currentPushToken = typeof status.token === 'string' ? status.token : '';
    copy.hidden = !currentPushToken;
    enable.hidden = true;
    refresh.disabled = !!status.checking;
    refresh.textContent = status.checking ? 'جارٍ تحديث الحالة…' : 'تحديث الحالة';
    card.setAttribute('aria-busy', status.checking ? 'true' : 'false');

    if (firstCheck) {
      card.dataset.state = 'loading';
      title.textContent = 'جارٍ التحقق من الخدمة';
      text.textContent = 'نتحقق من جاهزية الرسائل على هذا الجهاز.';
      label.textContent = 'فحص';
      return;
    }

    if (denied) {
      card.dataset.state = 'denied';
      title.textContent = 'إذن الرسائل مرفوض';
      text.textContent = 'لن تصلك رسائل مشكاة حتى تسمح بالإشعارات من إعدادات iPhone، ثم تعود لتحديث الحالة.';
      label.textContent = 'الإذن مرفوض';
      return;
    }

    if (ready) {
      card.dataset.state = 'ready';
      title.textContent = 'رسائل مشكاة جاهزة';
      text.textContent = 'هذا الجهاز مسجّل ويمكنه استقبال رسائل مشكاة. رمز الاختبار يبقى مخفيًا.';
      label.textContent = 'جاهز';
      return;
    }

    card.dataset.state = 'setup';
    label.textContent = 'يحتاج إعداد';
    if (!status.available) {
      title.textContent = 'الخدمة غير متاحة في هذه النسخة';
      text.textContent = window.__MISHKAT_NATIVE__
        ? 'يلزم إكمال ربط Firebase في الجسر الأصلي، ثم تثبيت النسخة المحدّثة.'
        : 'تظهر حالة Firebase الفعلية داخل تطبيق مشكاة على iPhone بعد اكتمال الربط.';
    } else if (status.error) {
      title.textContent = 'تعذّر قراءة حالة الخدمة';
      text.textContent = 'تحقق من الاتصال، ثم اضغط تحديث الحالة للمحاولة مرة أخرى.';
    } else if (!status.configured) {
      title.textContent = 'Firebase يحتاج إلى إعداد';
      text.textContent = 'ملف إعداد Firebase غير مكتمل في هذه النسخة، لذلك لا يمكن تسجيل الجهاز بعد.';
    } else if (!authorized) {
      title.textContent = 'اسمح باستقبال الرسائل';
      text.textContent = 'نطلب إذن النظام مرة واحدة حتى تصلك الأخبار والتنبيهات المهمة من مشكاة.';
      enable.hidden = false;
    } else {
      title.textContent = 'جارٍ تسجيل هذا الجهاز';
      text.textContent = 'إذن الإشعارات مفعّل، وننتظر اكتمال التسجيل مع Firebase.';
    }
  }

  async function copyPushToken() {
    if (!currentPushToken) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentPushToken);
      } else {
        const field = document.createElement('textarea');
        field.value = currentPushToken;
        field.readOnly = true;
        field.setAttribute('aria-hidden', 'true');
        field.style.cssText = 'position:fixed;opacity:0;pointer-events:none;inset:0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('copy failed');
      }
      const button = $('#btnCopyFCM');
      button.textContent = 'تم نسخ رمز الاختبار';
      toast('تم نسخ رمز FCM للاختبار');
      setTimeout(() => { if (button) button.textContent = 'نسخ رمز FCM للاختبار'; }, 1800);
    } catch (e) {
      toast('تعذّر نسخ الرمز — حاول مرة أخرى');
    }
  }

  function initPushService() {
    if (!$('#pushServiceCard')) return;
    Notify.onPushStatus(renderPushStatus);
    $('#btnRefreshPush').addEventListener('click', () => Notify.refreshPushStatus());
    $('#btnCopyFCM').addEventListener('click', copyPushToken);
    $('#btnEnablePush').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'جارٍ طلب الإذن…';
      await Notify.request();
      button.disabled = false;
      button.textContent = 'السماح بالرسائل';
      Notify.refreshPushStatus();
    });
    Notify.refreshPushStatus();
  }

  /* ───────── الإعدادات ───────── */
  function initSettings() {
    const s = Store.s;

    const ms = $('#selMethod');
    ms.innerHTML = Object.entries(PrayerCalc.METHODS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
    ms.value = s.method;
    ms.addEventListener('change', () => { Store.set('method', ms.value); Store.set('_methodSet', true); renderHome(); Notify.schedule(); });

    $('#selAsr').value = s.asr;
    $('#selAsr').addEventListener('change', e => { Store.set('asr', e.target.value); renderHome(); Notify.schedule(); });
    $('#selHigh').value = s.highLats;
    $('#selHigh').addEventListener('change', e => { Store.set('highLats', e.target.value); renderHome(); Notify.schedule(); });
    $('#selHijri').value = String(s.hijriOffset);
    $('#selHijri').addEventListener('change', e => { Store.set('hijriOffset', +e.target.value); renderHome(); });

    $('#tuneGrid').innerHTML = PrayerCalc.ORDER.map(p =>
      `<label>${p.ar}<input type="number" data-tune="${p.key}" value="${s.tune[p.key] || 0}" step="1"></label>`).join('');
    $('#tuneGrid').addEventListener('change', e => {
      const k = e.target.dataset.tune; if (!k) return;
      s.tune[k] = +e.target.value || 0; Store.save(); renderHome(); Notify.schedule();
    });

    $('#inLat').value = s.lat ?? ''; $('#inLng').value = s.lng ?? ''; $('#inCity').value = s.city || '';
    $('#btnAutoLoc').addEventListener('click', autoLocate);
    $('#btnSaveLoc').addEventListener('click', () => {
      const lat = parseFloat($('#inLat').value), lng = parseFloat($('#inLng').value);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        locationState('أدخل خط عرض بين ‎-90 و90، وخط طول بين ‎-180 و180.', false, true);
        $('#inLat').focus(); return;
      }
      locationRequest++; clearTimeout(locationTimer); window.__locAsked = false;
      Store.set('lat', lat); Store.set('lng', lng); Store.set('city', $('#inCity').value.trim());
      Store.set('locationAuto', false);
      locationState('تم حفظ الموقع. سيبقى ثابتًا حتى تختار تحديثه.');
      Qibla.setLocation(lat, lng); renderHome(); Notify.schedule(); toast('تم حفظ الموقع');
    });
    const cs = $('#citySel');
    cs.innerHTML = '<option value="">— اختر مدينة —</option>' + CITIES.map((c, i) => `<option value="${i}">${c[0]}</option>`).join('');
    cs.addEventListener('change', () => {
      if (cs.value === '') return;
      const c = CITIES[+cs.value]; if (!c) return;
      locationRequest++; clearTimeout(locationTimer); window.__locAsked = false;
      Store.set('lat', c[1]); Store.set('lng', c[2]); Store.set('city', c[0]); Store.set('method', c[3]);
      Store.set('_methodSet', false);
      Store.set('locationAuto', false);
      locationState('تم حفظ المدينة وتحديث المواقيت.');
      $('#inLat').value = c[1]; $('#inLng').value = c[2]; $('#inCity').value = c[0]; ms.value = c[3];
      Qibla.setLocation(c[1], c[2]); renderHome(); Notify.schedule(); toast('تم اختيار ' + c[0]);
    });

    $('#btnPerm').addEventListener('click', () => Notify.request());
    $('#swNotif').checked = s.notif;
    $('#swNotif').addEventListener('change', async e => {
      if (e.target.checked && Notify.perm() !== 'granted') { const p = await Notify.request(); if (p !== 'granted') { e.target.checked = false; return; } }
      Store.set('notif', e.target.checked); Notify.schedule(); Notify.refreshUI();
      renderHome();
      if (e.target.checked) Notify.enablePeriodic();
    });
    $('#swAdhan').checked = s.adhanSound;
    $('#swAdhan').addEventListener('change', e => { Store.set('adhanSound', e.target.checked); Notify.schedule(); });
    $('#selAdhan').value = s.adhanFile;
    $('#selAdhan').addEventListener('change', e => { Store.set('adhanFile', e.target.value); Notify.schedule(); });

    if (window.__MISHKAT_NATIVE__) {
      // الصوت مضمّن في التطبيق ويشغّله النظام مع الإشعار — لا حاجة لأزرار التشغيل والتخزين
      $('#webNotifNote').hidden = true;
      $('#btnStopAdhan').remove(); $('#btnCacheAdhan').remove();
      $('#btnPlayAdhan').textContent = 'تجربة الإشعار والصوت';
      $('#btnPlayAdhan').addEventListener('click', () => Notify.test());
      $('#selAdhan').querySelector('option[value=beep]').textContent = 'نغمة النظام الافتراضية';
      $('#adhanNote').textContent =
        'يُرفَق الأذان بالإشعار نفسه (29 ثانية — أقصى ما يسمح به iOS) فيتحكّم به النظام: '
        + 'يظهر على الشاشة مع الصوت، وتُسكته فوراً بزر خفض الصوت أو بمفتاح الصامت. '
        + 'مضمّن داخل التطبيق فلا يحتاج إنترنت.';
    } else {
      $('#btnPlayAdhan').addEventListener('click', () => { Notify.prime(); Notify.playAdhan(); });
      $('#btnStopAdhan').addEventListener('click', () => Notify.stopAdhan());
      $('#btnCacheAdhan').addEventListener('click', () => Notify.cacheAdhan());
      $('#adhanNote').textContent = 'في نسخة المتصفح يُشغَّل الأذان كاملاً مع شريط «إيقاف الصوت» أعلى الشاشة.';
    }
    $('#selPre').value = String(s.preMinutes);
    $('#selPre').addEventListener('change', e => { Store.set('preMinutes', +e.target.value); Notify.schedule(); });
    $('#swAdhkarNotif').checked = s.adhkarNotif;
    $('#swAdhkarNotif').addEventListener('change', e => { Store.set('adhkarNotif', e.target.checked); Notify.schedule(); });

    $('#selTheme').value = s.theme;
    $('#selTheme').addEventListener('change', e => { Store.set('theme', e.target.value); applyTheme(); });
    $('#selUIFont').value = s.uiFont || 'normal';
    $('#selUIFont').addEventListener('change', e => { Store.set('uiFont', e.target.value); applyTheme(); toast('تم تحديث حجم نص الواجهة'); });
    Quran.applyReadingSize(s.quranFont, false);
    Quran.bindReadingSizeControl($('#rngFont'));
    $('#swKeepAwake').checked = s.keepAwake;
    $('#swKeepAwake').addEventListener('change', e => { Store.set('keepAwake', e.target.checked); keepAwake(e.target.checked); });

    $('#btnPrecache').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true; button.setAttribute('aria-busy', 'true');
      try {
        await offlineMessage('precache', progress => { $('#offlineState').textContent = `حفظ صفحات المصحف: ${progress.done} من ${progress.total}`; });
        toast('اكتمل حفظ المصحف والأذكار');
        await updateOfflineState();
      } catch (e) { $('#offlineState').textContent = 'لم يكتمل الحفظ. تحقق من الاتصال والمساحة ثم أعد المحاولة؛ الصفحات المحفوظة باقية.'; }
      finally { button.disabled = false; button.setAttribute('aria-busy', 'false'); }
    });
    $('#btnClear').addEventListener('click', async () => {
      if (!confirm('سيتم مسح إعدادات مشكاة والأدعية والعلامات والملاحظات والختمات والكتب المحفوظة. هل تريد المتابعة؟')) return;
      Store.set('notif', false); Notify.schedule();
      Object.keys(localStorage).filter(k => /^(mishkat[.\-]|noor[.\-])/.test(k)).forEach(k => localStorage.removeItem(k));
      if ('caches' in window) for (const k of await caches.keys()) if (k.startsWith('mishkat-')) await caches.delete(k);
      location.reload();
    });
    initPushService();
    updateOfflineState();
  }

  async function updateOfflineState() {
    const el = $('#offlineState'); if (!el) return;
    if (window.__MISHKAT_NATIVE__) {
      el.textContent = 'المصحف كاملًا والأذكار مرفقة على جهازك.';
      $('#btnPrecache').hidden = true;
      return;
    }
    try {
      const status = await offlineMessage('offline-status');
      el.textContent = status.complete ? 'جاهز — 604 صفحات مع الأذكار محفوظة.' : `${status.pages} من 604 صفحات محفوظة. جهّز البقية قبل انقطاع الاتصال.`;
    } catch (e) { el.textContent = 'الحفظ الكامل غير جاهز. اتصل بالإنترنت وأعد فتح التطبيق ثم اختر تجهيز.'; }
  }

  async function offlineMessage(type, onProgress) {
    if (!navigator.serviceWorker) throw new Error('unsupported');
    const registration = await navigator.serviceWorker.getRegistration();
    const worker = navigator.serviceWorker.controller || registration?.active;
    if (!worker) throw new Error('worker unavailable');
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      let timer;
      const finish = (error, data) => { clearTimeout(timer); channel.port1.close(); error ? reject(error) : resolve(data); };
      const heartbeat = () => { clearTimeout(timer); timer = setTimeout(() => finish(new Error('timeout')), 30000); };
      channel.port1.onmessage = ({data}) => {
        if (data.progress) { heartbeat(); onProgress?.(data); }
        else finish(data.error ? new Error(data.error) : null, data);
      };
      heartbeat(); worker.postMessage({type}, [channel.port2]);
    });
  }

  function updateConnectivity() {
    const banner = $('#connectivityBanner');
    if (!banner) return;
    const offline = !navigator.onLine;
    banner.hidden = !offline;
    document.body.classList.toggle('is-offline', offline);
  }

  function initAccessibility() {
    const returnFocus = new Map();
    const modalBackground = $$('.skip-link,#topbar,#connectivityBanner,#app,#tabbar');
    const focusables = root => Array.from(root.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],summary,[tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.hidden && el.getClientRects().length);
    const setupSheet = sheet => {
      if (sheet.dataset.a11yReady) return;
      sheet.dataset.a11yReady = 'true';
      returnFocus.set(sheet, document.activeElement);
      const panel = sheet.querySelector('.sheet-in');
      if (panel && !sheet.hasAttribute('role') && !panel.hasAttribute('role')) {
        panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
      }
      requestAnimationFrame(() => (focusables(sheet)[0] || panel)?.focus());
      sheet.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          const close = sheet.querySelector('[data-welcome="secondary"],[data-act="close"],[data-ref-act="close"],[data-note-act="close"],.close');
          close ? close.click() : sheet.click();
          return;
        }
        if (event.key !== 'Tab') return;
        const items = focusables(sheet); if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
    };
    new MutationObserver(records => {
      let restoreFocus = null;
      records.forEach(record => {
        record.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.matches('.sheet')) setupSheet(node);
          node.querySelectorAll?.('.sheet').forEach(setupSheet);
        });
        record.removedNodes.forEach(node => {
          if (!(node instanceof Element) || !node.matches('.sheet')) return;
          const previous = returnFocus.get(node);
          if (previous && document.contains(previous)) restoreFocus = previous;
          returnFocus.delete(node);
        });
      });
      const modalOpen = !!document.querySelector('.sheet');
      modalBackground.forEach(element => { element.inert = modalOpen; });
      if (!modalOpen && restoreFocus) restoreFocus.focus({ preventScroll: true });
    }).observe(document.body, { childList: true });

    document.addEventListener('keydown', event => {
      const tab = event.target.closest?.('[role="tab"]');
      if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const tabs = Array.from(tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]'));
      let index = tabs.indexOf(tab);
      if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else {
        const rtlStep = event.key === 'ArrowRight' ? -1 : 1;
        index = (index + rtlStep + tabs.length) % tabs.length;
      }
      event.preventDefault(); tabs[index].focus(); tabs[index].click();
    });
  }

  /* ───────── الإقلاع ───────── */
  async function loadContent(kind) {
    const module = kind === 'quran' ? Quran : Adhkar;
    const index = $('#' + (kind === 'quran' ? 'quranIndex' : 'adhkarIndex'));
    let status = $(`#view-${kind} .content-state`);
    try {
      await module.load();
      module.renderIndex(); module.bind();
      contentReady[kind] = true;
      index.classList.remove('hidden'); status?.remove();
    } catch (error) {
      index.classList.add('hidden');
      if (!status) {
        status = document.createElement('div');
        status.className = 'content-state'; status.setAttribute('role', 'status');
        status.innerHTML = `<h2>تعذّر تحميل ${kind === 'quran' ? 'المصحف' : 'الأذكار'}</h2><p>تحقق من الاتصال ثم أعد المحاولة. يمكنك استخدام بقية أقسام مشكاة.</p><button class="btn primary">إعادة المحاولة</button>`;
        $(`#view-${kind}`).appendChild(status);
        status.querySelector('button').addEventListener('click', async event => {
          event.currentTarget.disabled = true; event.currentTarget.textContent = 'جارٍ التحميل…';
          await loadContent(kind);
        });
      }
      const retry = status.querySelector('button');
      retry.disabled = false; retry.textContent = 'إعادة المحاولة';
      console.warn('تعذّر تحميل ' + kind, error);
    }
  }

  async function boot() {
    applyTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    initAccessibility();
    updateConnectivity();
    window.addEventListener('online', () => { updateConnectivity(); toast('عاد الاتصال بالإنترنت'); });
    window.addEventListener('offline', updateConnectivity);
    navigator.serviceWorker?.addEventListener('controllerchange', updateOfflineState);

    $('#splashNote').textContent = 'جارٍ تحميل المصحف والأذكار…';
    await Promise.allSettled([loadContent('quran'), loadContent('adhkar')]);
    // كل قسم مستقل: عطل في أحدها لا يمنع بقية التطبيق من العمل
    [['المكتبة والختمة', initLibraryTools],
     ['الإعدادات', initSettings],
     ['السبحة', initTasbih]].forEach(([name, fn]) => {
      try { fn(); } catch (e) { console.error('تعذّر تهيئة ' + name, e); }
    });

    $$('#tabbar button').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
    $('#btnSettingsTop').addEventListener('click', () => {
      if (document.body.dataset.view === 'settings') go('home'); else go('settings');
    });
    $('#homeJourney').addEventListener('click', e => {
      const button = e.target.closest('[data-journey]'); if (!button) return;
      if (button.dataset.journey === 'read') {
        go('quran');
        if (contentReady.quran) Quran.open(Store.s.lastRead?.s || 1, Store.s.lastRead?.a || 1);
      } else {
        go('library'); $('#toolsSeg [data-tools-tab="khatma"]').click();
        const plan = Khatma.getActive(); if (plan) Khatma.open(plan.id);
      }
    });
    // All quick actions use the same stroke icons as their destination.
    $$('.quick').forEach(button => {
      const kind = button.dataset.goto;
      const key = button.dataset.period === 'evening' ? 'isha' : kind === 'adhkar:1' ? 'sunrise' : kind === 'adhkar:27' ? 'dhuhr' : null;
      const icon = key ? prayerIcon(key) : $(`#tabbar [data-view="${kind.startsWith('quran') ? 'quran' : 'adhkar'}"] svg`).outerHTML;
      button.querySelector('.quick-symbol').innerHTML = icon;
    });
    $('#locLabel').addEventListener('click', () => go('settings'));
    $('#btnPrayerSettings').addEventListener('click', () => {
      go('settings');
      const section = $('#calculationSettings'); section.open = true;
      section.scrollIntoView({ block: 'start', behavior: 'instant' });
      section.querySelector('summary').focus({ preventScroll: true });
    });
    $('#btnTheme').addEventListener('click', () => {
      const order = ['auto', 'light', 'dark'], i = order.indexOf(Store.s.theme);
      Store.set('theme', order[(i + 1) % 3]); $('#selTheme').value = Store.s.theme; applyTheme();
      toast('المظهر: ' + { auto: 'حسب النظام', light: 'فاتح', dark: 'داكن' }[Store.s.theme]);
    });

    $('#prayerList').addEventListener('click', async e => {
      const b = e.target.closest('[data-bell]'); if (!b) return;
      const k = b.dataset.bell;
      const active = Store.s.notif && Notify.perm() === 'granted' && Store.s.perPrayer[k];
      if (!active && Notify.perm() !== 'granted') {
        b.disabled = true;
        if (await Notify.request() !== 'granted') { renderHome(); return; }
      }
      if (!active) Store.set('notif', true);
      Store.s.perPrayer[k] = !active; Store.save();
      renderHome(); Notify.schedule();
      toast((Store.s.perPrayer[k] ? 'تم تفعيل' : 'تم إيقاف') + ' تنبيه ' + PrayerCalc.ORDER.find(p => p.key === k).ar);
    });
    $('.quick-grid').addEventListener('click', e => {
      const b = e.target.closest('[data-goto]'); if (!b) return;
      const [kind, id] = b.dataset.goto.split(':');
      if (kind === 'quran') { go('quran'); if (contentReady.quran) Quran.open(+id); }
      else if (kind === 'adhkar') { go('adhkar'); if (contentReady.adhkar) Adhkar.open(+id); }
      else go('tasbih');
    });
    $('#btnEnableNotif').addEventListener('click', async () => {
      Notify.prime();
      const p = await Notify.request();
      if (p === 'granted') { Store.set('notif', true); $('#swNotif').checked = true; Notify.schedule(); Notify.enablePeriodic(); }
    });
    $('#btnTestNotif').addEventListener('click', () => { Notify.prime(); Notify.test(); });
    // أزرار القبلة تُنشأ ديناميكياً حسب الحالة داخل Qibla.refreshUI

    // زر الرجوع في الجوال
    window.addEventListener('popstate', event => {
      const view = event.state?.view || (location.hash || '#home').slice(1);
      go(view, true);
      if (!event.state?.sub) {
        if (Quran.isOpen) Quran.backToIndex();
        if (Adhkar.isOpen) Adhkar.back();
      } else if (event.state.sub === 'reader' && Adhkar.isEditing) Adhkar.closeEditor();
    });
    window.addEventListener('mishkat-permission-changed', renderHome);
    document.addEventListener('click', Notify.prime, { once: true });
    document.addEventListener('touchstart', Notify.prime, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        renderHome(); Notify.schedule();
        if (Store.s.keepAwake) keepAwake(true);
        Notify.refreshPushStatus();
        if (Store.s.locationAuto) autoLocate(true);
        if (document.body.dataset.view === 'qibla') Qibla.init();
      } else Qibla.stop();
    });

    renderHome();
    Notify.refreshUI(); Notify.refreshPushStatus(); Notify.schedule(); Notify.syncWidget();
    if (Store.s.locationAuto) autoLocate(true);
    if (Store.s.keepAwake) keepAwake(true);
    tickTimer = setInterval(tick, 1000);

    const hash = (location.hash || '#home').slice(1);
    go(TITLES[hash] ? hash : 'home');

    $('#splash').classList.add('hide');
    setTimeout(() => $('#splash').remove(), 600);

    setTimeout(showFirstRun, 720);
    if (Store.s.lat == null) setTimeout(() => toast('حدّد موقعك لعرض مواقيت الصلاة والقبلة', 4000), 900);
  }

  if ('serviceWorker' in navigator)
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

  document.addEventListener('DOMContentLoaded', boot);
})();
