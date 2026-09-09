/* ═══════════════════════════════════════════════════════════
   حساب مواقيت الصلاة فلكياً على الجهاز — بدون إنترنت
   الخوارزمية مبنية على معادلات موقع الشمس (PrayTimes)
   ═══════════════════════════════════════════════════════════ */
const PrayerCalc = (function () {
  const D2R = Math.PI / 180;
  const sin = d => Math.sin(d * D2R), cos = d => Math.cos(d * D2R), tan = d => Math.tan(d * D2R);
  const asin = x => Math.asin(x) / D2R, acos = x => Math.acos(x) / D2R;
  const atan2 = (y, x) => Math.atan2(y, x) / D2R, acot = x => Math.atan2(1, x) / D2R;
  const wrap = (a, b) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a; };
  const fixAngle = a => wrap(a, 360), fixHour = a => wrap(a, 24);

  /* طرق الحساب المعتمدة عالمياً */
  const METHODS = {
    MWL:       { name: 'رابطة العالم الإسلامي',        fajr: 18,   isha: 17 },
    Makkah:    { name: 'أم القرى — مكة المكرمة',        fajr: 18.5, isha: '90 min' },
    Egypt:     { name: 'الهيئة المصرية العامة للمساحة', fajr: 19.5, isha: 17.5 },
    Karachi:   { name: 'جامعة العلوم الإسلامية — كراتشي', fajr: 18, isha: 18 },
    ISNA:      { name: 'الجمعية الإسلامية بأمريكا الشمالية', fajr: 15, isha: 15 },
    Gulf:      { name: 'هيئة الخليج',                   fajr: 19.5, isha: '90 min' },
    Kuwait:    { name: 'الكويت',                        fajr: 18,   isha: 17.5 },
    Qatar:     { name: 'قطر',                           fajr: 18,   isha: '90 min' },
    Dubai:     { name: 'الإمارات — دبي',                fajr: 18.2, isha: 18.2 },
    Turkey:    { name: 'ديانت — تركيا',                 fajr: 18,   isha: 17 },
    Singapore: { name: 'سنغافورة',                      fajr: 20,   isha: 18 },
    France:    { name: 'الاتحاد الإسلامي بفرنسا',       fajr: 12,   isha: 12 },
    Russia:    { name: 'روسيا',                         fajr: 16,   isha: 15 },
    Tehran:    { name: 'معهد الجيوفيزياء — طهران',      fajr: 17.7, isha: 14,  maghrib: 4.5, midnight: 'Jafari' },
    Jafari:    { name: 'الجعفري (شيعة اثنا عشرية)',      fajr: 16,   isha: 14,  maghrib: 4 }
  };

  const DEFAULTS = {
    method: 'MWL', asr: 'Standard', highLats: 'NightMiddle',
    imsak: '10 min', dhuhr: '0 min', maghrib: '0 min', midnight: 'Standard',
    elevation: 0,
    tune: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }
  };

  /*
   * الإصدارات السابقة خزّنت أم القرى تلقائياً لكل مناطق اليمن. نصحّح هذا
   * داخل المحرك حتى تستفيد منه الشاشة والتنبيهات فوراً، من دون لمس اختيار
   * السعودية أو الطرق الأخرى التي اختارها المستخدم.
   */
  // Natural Earth 1:110m (public domain)، بترتيب [خط العرض، خط الطول].
  const YEMEN_MAINLAND = [
    [19.000003, 52.000010], [17.349742, 52.782184], [16.651051, 53.108573],
    [16.382411, 52.385206], [15.938433, 52.191729], [15.597420, 52.168165],
    [15.175250, 51.172515], [14.708767, 49.574576], [14.003202, 48.679231],
    [13.948090, 48.238947], [14.007233, 47.938914], [13.592220, 47.354454],
    [13.399699, 46.717076], [13.347764, 45.877593], [13.290946, 45.625050],
    [13.026905, 45.406459], [12.953938, 45.144356], [12.699587, 44.989533],
    [12.721653, 44.494576], [12.585950, 44.175113], [12.636800, 43.482959],
    [13.220950, 43.222871], [13.767584, 43.251448], [14.062630, 43.087944],
    [14.802249, 42.892245], [15.213335, 42.604873], [15.261963, 42.805015],
    [15.718886, 42.702438], [15.911742, 42.823671], [16.347891, 42.779332],
    [16.666890, 43.218375], [17.088440, 43.115798], [17.579987, 43.380794],
    [17.319977, 43.791519], [17.410359, 44.062613], [17.433329, 45.216651],
    [17.333335, 45.399999], [17.233315, 46.366659], [17.283338, 46.749994],
    [16.949999, 47.000005], [17.116682, 47.466695], [18.166669, 48.183344],
    [18.616668, 49.116672]
  ];

  function pointInPolygon(lat, lng, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const yi = polygon[i][0], xi = polygon[i][1];
      const yj = polygon[j][0], xj = polygon[j][1];
      if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  function isInYemen(lat, lng) {
    const mainland = pointInPolygon(lat, lng, YEMEN_MAINLAND);
    const socotra = lat >= 11.7 && lat <= 12.9 && lng >= 52.9 && lng <= 54.7;
    return mainland || socotra;
  }

  function resolvedMethod(requested, coords, methodAuto) {
    return methodAuto !== false && requested === 'Makkah' && isInYemen(coords.lat, coords.lng) ? 'MWL' : requested;
  }

  /* التاريخ اليولياني */
  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  /* ميل الشمس ومعادلة الزمن */
  function sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = fixAngle(357.529 + 0.98560028 * D);
    const q = fixAngle(280.459 + 0.98564736 * D);
    const L = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
    const e = 23.439 - 0.00000036 * D;
    const RA = fixHour(atan2(cos(e) * sin(L), cos(L)) / 15);
    return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - RA };
  }

  function makeEngine(jDate, lat, elv) {
    const midDay = t => fixHour(12 - sunPosition(jDate + t).eqt);
    /* زمن بلوغ الشمس زاوية معيّنة تحت/فوق الأفق */
    const sunAngleTime = (angle, t, ccw) => {
      const decl = sunPosition(jDate + t).decl;
      const noon = midDay(t);
      const x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
      if (x > 1 || x < -1) return NaN;               // الشمس لا تبلغ هذه الزاوية اليوم
      const v = acos(x) / 15;
      return noon + (ccw ? -v : v);
    };
    const asrTime = (factor, t) => {
      const decl = sunPosition(jDate + t).decl;
      const angle = -acot(factor + tan(Math.abs(lat - decl)));
      return sunAngleTime(angle, t);
    };
    const riseSetAngle = 0.833 + 0.0347 * Math.sign(elv) * Math.sqrt(Math.abs(elv));
    return { midDay, sunAngleTime, asrTime, riseSetAngle };
  }

  const evalMin = v => (typeof v === 'string' ? parseFloat(v) : v);
  const isMin = v => typeof v === 'string' && v.indexOf('min') > -1;
  const timeDiff = (a, b) => fixHour(b - a);

  /* تعديل خطوط العرض العالية حيث لا يغيب الشفق */
  function nightPortion(rule, angle, night) {
    if (rule === 'AngleBased') return (angle / 60) * night;
    if (rule === 'OneSeventh') return night / 7;
    return night / 2;                                   // NightMiddle
  }
  function adjustHL(time, base, angle, night, rule, ccw) {
    const portion = nightPortion(rule, angle, night);
    const diff = ccw ? timeDiff(time, base) : timeDiff(base, time);
    if (isNaN(time) || diff > portion) return base + (ccw ? -portion : portion);
    return time;
  }

  /**
   * حساب مواقيت يوم واحد.
   * @returns {Object} مفاتيح الأوقات بقيم Date، مع flags.approx عند تعذّر الحساب الفلكي
   */
  function getTimes(date, coords, opts, _isFallback) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    o.tune = Object.assign({}, DEFAULTS.tune, (opts && opts.tune) || {});
    const methodKey = resolvedMethod(o.method, coords, o.methodAuto);
    const m = METHODS[methodKey] || METHODS.MWL;
    const lat = coords.lat, lng = coords.lng, elv = o.elevation || 0;
    const tzOffsetH = -date.getTimezoneOffset() / 60;   // إزاحة المنطقة الزمنية للجهاز

    const jDate = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
    const E = makeEngine(jDate, lat, elv);

    const maghribCfg = m.maghrib != null ? m.maghrib : o.maghrib;
    const ishaCfg = m.isha, fajrAngle = m.fajr;

    // تقديرات أولية بالساعات، ثم تكرار للتقارب (تُحوَّل لكسر اليوم في كل دورة)
    let t = { imsak: 5, fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, maghrib: 18, isha: 18 };
    for (let i = 0; i < 3; i++) {
      const p = {};
      for (const k in t) p[k] = t[k] / 24;
      t = {
        imsak:   E.sunAngleTime(evalMin(o.imsak), p.imsak, true),
        fajr:    E.sunAngleTime(fajrAngle, p.fajr, true),
        sunrise: E.sunAngleTime(E.riseSetAngle, p.sunrise, true),
        dhuhr:   E.midDay(p.dhuhr),
        asr:     E.asrTime(o.asr === 'Hanafi' ? 2 : 1, p.asr),
        sunset:  E.sunAngleTime(E.riseSetAngle, p.sunset),
        maghrib: isMin(maghribCfg) ? t.sunset : E.sunAngleTime(evalMin(maghribCfg), p.maghrib),
        isha:    isMin(ishaCfg) ? t.sunset : E.sunAngleTime(evalMin(ishaCfg), p.isha)
      };
    }

    // الأوقات المعرّفة بالدقائق بعد الغروب
    if (isMin(ishaCfg))    t.isha = t.sunset + evalMin(ishaCfg) / 60;
    if (isMin(maghribCfg)) t.maghrib = t.sunset + evalMin(maghribCfg) / 60;
    if (isMin(o.imsak))    t.imsak = t.fajr - evalMin(o.imsak) / 60;

    // تصحيح خطوط العرض العالية
    let approx = false;
    if (o.highLats !== 'None') {
      const night = timeDiff(t.sunset, t.sunrise);
      const before = [t.fajr, t.isha, t.maghrib, t.imsak];
      t.imsak   = adjustHL(t.imsak,   t.sunrise, evalMin(o.imsak) || 10, night, o.highLats, true);
      t.fajr    = adjustHL(t.fajr,    t.sunrise, fajrAngle,               night, o.highLats, true);
      t.isha    = adjustHL(t.isha,    t.sunset,  isMin(ishaCfg) ? 18 : evalMin(ishaCfg), night, o.highLats);
      t.maghrib = adjustHL(t.maghrib, t.sunset,  isMin(maghribCfg) ? 4 : evalMin(maghribCfg) || 4, night, o.highLats);
      approx = before.some((v, i) => isNaN(v) || Math.abs(v - [t.fajr, t.isha, t.maghrib, t.imsak][i]) > 1e-9);
    }

    t.dhuhr += evalMin(o.dhuhr) / 60;

    // منتصف الليل والثلث الأخير
    const nightSpan = o.midnight === 'Jafari' || m.midnight === 'Jafari'
      ? timeDiff(t.sunset, t.fajr) : timeDiff(t.sunset, t.sunrise);
    t.midnight = t.sunset + nightSpan / 2;
    t.lastThird = t.sunset + (nightSpan * 2) / 3;

    // التحويل للتوقيت المحلي + التعديل اليدوي
    const shift = tzOffsetH - lng / 15;
    const out = {};
    for (const k in t) {
      const tuned = (o.tune[k] || 0) / 60;
      out[k] = toDate(date, t[k] + shift + tuned);
    }
    out.__approx = approx;
    out.__method = m.name;
    out.__methodKey = METHODS[methodKey] ? methodKey : 'MWL';

    /* المناطق القطبية: إن لم تشرق الشمس أو لم تغرب، نأخذ توقيت «أقرب البلاد
       المعتدلة» (خط عرض ٤٨٫٥) للأوقات المتعذّرة فقط — وهو المعمول به فقهياً. */
    if (!_isFallback && Math.abs(lat) > 48.5) {
      const missing = ['fajr', 'sunrise', 'sunset', 'maghrib', 'isha'].filter(k => !out[k]);
      if (missing.length) {
        const alt = getTimes(date, { lat: Math.sign(lat) * 48.5, lng }, opts, true);
        for (const k in alt) if (k[0] !== '_' && !out[k]) out[k] = alt[k];
        out.__approx = true;
        out.__nearest = true;
      }
    }
    return out;
  }

  function toDate(baseDate, hours) {
    if (isNaN(hours)) return null;
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    // تُطبّق التعديلات اليدوية أولاً، ثم يُقرّب الناتج النهائي لأقرب دقيقة.
    // سماحية نصف ثانية تمنع اختلاف JS وSwift عند حد :29.8 الناتج من دقة النموذج الفلكي.
    const roundedMinutes = Math.round(hours * 60 + 0.5 / 60);
    d.setTime(d.getTime() + roundedMinutes * 60 * 1000);
    return d;
  }

  /* الصلوات الخمس المعروضة بالترتيب */
  const ORDER = [
    { key: 'fajr',    ar: 'الفجر',   icon: 'fajr' },
    { key: 'sunrise', ar: 'الشروق',  icon: 'sunrise', noAdhan: true },
    { key: 'dhuhr',   ar: 'الظهر',   icon: 'dhuhr' },
    { key: 'asr',     ar: 'العصر',   icon: 'asr' },
    { key: 'maghrib', ar: 'المغرب',  icon: 'maghrib' },
    { key: 'isha',    ar: 'العشاء',  icon: 'isha' }
  ];

  /** الصلاة القادمة والحالية، مع بحث في اليوم التالي عند اللزوم */
  function nextPrayer(now, coords, opts) {
    const today = getTimes(now, coords, opts);
    const list = [];
    ORDER.forEach(p => { if (today[p.key]) list.push({ ...p, at: today[p.key] }); });
    let next = list.find(p => p.at > now);
    if (!next) {
      const tomorrow = new Date(now.getTime() + 864e5);
      const tt = getTimes(tomorrow, coords, opts);
      next = { ...ORDER[0], at: tt.fajr };
    }
    const passed = list.filter(p => p.at <= now && !p.noAdhan);
    let current = passed.length ? passed[passed.length - 1] : null;
    if (!current) {                                   // بعد منتصف الليل: الوقت الحالي عشاء الأمس
      const y = new Date(now.getTime() - 864e5);
      const yt = getTimes(y, coords, opts);
      if (yt.isha) current = { ...ORDER[5], at: yt.isha };
    }
    return { next, current, today, list };
  }

  /** زاوية القبلة من الشمال الحقيقي + المسافة للكعبة */
  function qibla(lat, lng) {
    const KL = 21.4225, KG = 39.8262;
    const dL = (KG - lng) * D2R, p1 = lat * D2R, p2 = KL * D2R;
    const brng = Math.atan2(Math.sin(dL), Math.cos(p1) * Math.tan(p2) - Math.sin(p1) * Math.cos(dL)) / D2R;
    const R = 6371;
    const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dL / 2) ** 2;
    return { bearing: fixAngle(brng), distance: R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) };
  }

  return { METHODS, ORDER, getTimes, nextPrayer, qibla };
})();
