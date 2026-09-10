/* ═══════════════ القبلة — بوصلة موجِّهة ═══════════════ */
const Qibla = (function () {
  const ALIGN_ENTER = 3, ALIGN_EXIT = 7, CLOSE = 20;
  const ACCURACY_GOOD = 10, ACCURACY_WEAK = 25;
  let bearing = null, distance = null, heading = null, smooth = null;
  let listening = false, accuracy = null, accuracyLevel = 'unknown';
  let aligned = false, noSensorFlag = false, sampleTimestamp = null, northType = null;
  let sensorTimer = null, session = 0;

  const degWord = v => `${toAr(v)} درجة`;                       // للنص الكبير: لا لبس مع الرقم ٥
  const degHTML = v => `<span class="q-deg">${toAr(v)}<i>°</i></span>`;   // للبطاقات: علامة مرفوعة مصغّرة
  const dirName = d => ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'][Math.round(d / 45) % 8];
  const normalize = d => ((d % 360) + 360) % 360;
  const shortestDelta = (target, current) => ((target - current + 540) % 360) - 180;

  function setAccuracyBadge(level, text) {
    const el = $('#qAccuracy');
    if (!el) return;
    el.className = `q-accuracy ${level || ''}`.trim();
    el.textContent = text;
  }

  function classifyAccuracy(acc) {
    if (acc == null || !Number.isFinite(acc)) return 'unknown';
    if (acc <= ACCURACY_GOOD) return 'good';
    if (acc <= ACCURACY_WEAK) return 'medium';
    return 'weak';
  }

  /**
   * مرشّح متكيّف: يهدّئ الاهتزازات الصغيرة، ويستجيب أسرع عند تدوير الجهاز فعلياً.
   * زيادة tau تعني تنعيماً أكبر، خصوصاً عندما تكون دقة المستشعر متوسطة أو ضعيفة.
   */
  function adaptiveAlpha(change, acc, elapsedSeconds) {
    let tau = change >= 45 ? 0.055 : change >= 15 ? 0.11 : change >= 5 ? 0.20 : 0.36;
    if (Number.isFinite(acc)) {
      if (acc > ACCURACY_WEAK) tau *= 1.8;
      else if (acc > ACCURACY_GOOD) tau *= 1.35;
    }
    const dt = Math.min(0.5, Math.max(1 / 60, elapsedSeconds || 1 / 30));
    return Math.min(0.85, Math.max(0.08, 1 - Math.exp(-dt / tau)));
  }

  function drawTicks() {
    const box = $('#ticks');
    if (box.childElementCount) return;
    let html = '';
    for (let d = 0; d < 360; d += 15)
      html += `<i class="${d % 90 === 0 ? 'big' : (d % 45 === 0 ? 'mid' : '')}" style="transform:rotate(${d}deg)"></i>`;
    box.innerHTML = html;
  }

  /* ───────── الموقع ───────── */
  function setLocation(lat, lng) {
    const q = PrayerCalc.qibla(lat, lng);
    bearing = q.bearing; distance = q.distance;
    $('#qDir').innerHTML = `${degHTML(q.bearing.toFixed(1))} ${dirName(q.bearing)}`;
    $('#qDist').textContent = `${toAr(Math.round(q.distance).toLocaleString('en-US'))} كم`;
    $('#qPlace').textContent = Store.s.city || 'موقعك المحدَّد';
    render(); refreshUI();
  }

  /* ───────── البوصلة ───────── */
  window.__mishkatHeading = function (h, acc, meta) {
    if (!listening) return;
    // يقبل النداء القديم (heading, accuracy)، وكذلك كائن البيانات الجديد.
    if (h && typeof h === 'object') {
      meta = h;
      h = meta.heading;
      acc = meta.accuracy;
    }
    if (h == null || typeof h !== 'number' || !Number.isFinite(h)) return;

    let timestamp = null;
    if (meta && typeof meta === 'object' && meta.timestamp != null && Number.isFinite(Number(meta.timestamp))) {
      timestamp = Number(meta.timestamp);
    }
    // لا نسمح لعينة متأخرة بأن تعيد المؤشر إلى الخلف بعد وصول عينة أحدث.
    if (timestamp != null && sampleTimestamp != null && timestamp <= sampleTimestamp) return;

    const numericAccuracy = acc == null ? null : Number(acc);
    // CoreLocation يرسل قيمة سالبة عندما لا يستطيع تحديد الدقة؛ نتجاهل القراءة كلها.
    if (Number.isFinite(numericAccuracy) && numericAccuracy < 0) return;

    const oldLevel = accuracyLevel, oldNorth = northType;
    accuracy = Number.isFinite(numericAccuracy) ? numericAccuracy : null;
    accuracyLevel = classifyAccuracy(accuracy);
    if (meta && typeof meta === 'object') {
      if (typeof meta.north === 'string') northType = meta.north;
    }

    apply(h, timestamp);
    if (oldLevel !== accuracyLevel || oldNorth !== northType) refreshUI();
  };

  function apply(h, timestamp) {
    h = Number(h);
    if (!Number.isFinite(h)) return;
    h = normalize(h);

    const now = timestamp != null && Number.isFinite(Number(timestamp)) ? Number(timestamp) : Date.now();
    if (smooth == null) {
      smooth = h;
    } else {
      const d = shortestDelta(h, normalize(smooth));
      const elapsed = sampleTimestamp == null ? 1 / 30 : Math.max(0, (now - sampleTimestamp) / 1000);
      smooth += d * adaptiveAlpha(Math.abs(d), accuracy, elapsed);
    }
    sampleTimestamp = now;

    const first = heading == null;
    heading = normalize(smooth);
    $('#qHeading').innerHTML = `${degHTML(Math.round(heading))} ${dirName(heading)}`;
    render();
    clearTimeout(sensorTimer);
    sensorTimer = setTimeout(noSensor, 8000);
    if (first) { noSensorFlag = false; refreshUI(); }
  }

  function onOrient(e) {
    let h = null;
    let acc = null;
    if (typeof e.webkitCompassHeading === 'number') { h = e.webkitCompassHeading; acc = e.webkitCompassAccuracy; }
    else if (e.absolute === true && typeof e.alpha === 'number') h = 360 - e.alpha;
    if (h == null) return; // alpha النسبي ليس اتجاهًا جغرافيًا.
    const rotation = Number(screen.orientation?.angle ?? window.orientation ?? 0);
    h = normalize(h + rotation);
    window.__mishkatHeading(h, acc, {
      heading: h,
      accuracy: acc,
      timestamp: Date.now(),
      north: e.absolute === true ? 'true' : 'magnetic'
    });
  }

  /* ───────── الرسم والتوجيه ───────── */
  function render() {
    if (bearing == null) return;
    const dial = $('#dial'), needle = $('#needle'), zone = $('#zone'), comp = $('#compass');

    // smooth زاوية مستمرة وغير مطبّعة؛ لذلك 359° ← 0° تتحرك درجة واحدة لا دورة كاملة.
    const dialRot = heading == null ? 0 : -smooth;
    const needleRot = heading == null ? bearing : bearing - smooth;
    dial.style.transform = `rotate(${dialRot}deg)`;
    needle.style.transform = `rotate(${needleRot}deg)`;
    zone.style.transform = `rotate(${needleRot}deg)`;
    dial.style.setProperty('--anti', `${-dialRot}deg`);
    needle.style.setProperty('--anti', `${-needleRot}deg`);

    if (heading == null) {
      comp.classList.remove('aligned', 'close');
      $('#qGuide').classList.remove('ok', 'near');
      $('#qDelta').textContent = '';
      $('#qHeading').textContent = '—';
      return;
    }

    // فرق موجَّه: موجب = استدر يميناً، سالب = استدر يساراً
    const delta = shortestDelta(bearing, heading);
    const abs = Math.abs(delta);

    // Hysteresis: ندخل ضمن التطابق عند 3°، ولا نخرج بسبب الاهتزاز إلا بعد 7°.
    const canAlign = accuracyLevel === 'good' && northType === 'true';
    if (!canAlign) {
      aligned = false;
    } else if (aligned) {
      if (abs > ALIGN_EXIT) aligned = false;
    } else if (abs <= ALIGN_ENTER) {
      aligned = true;
      vibrate([40, 60, 40]);
    }

    comp.classList.toggle('aligned', aligned);
    comp.classList.toggle('close', !aligned && abs <= CLOSE);

    const main = $('#qGuideMain'), sub = $('#qGuideSub'), g = $('#qGuide');
    if (aligned) {
      main.textContent = 'أنت تواجه القبلة';
      sub.textContent = 'تقبّل الله صلاتك';
      $('#qDelta').textContent = '✓';
    } else if (!canAlign && abs <= ALIGN_EXIT) {
      main.textContent = 'أنت قريب من اتجاه القبلة';
      sub.textContent = 'قراءة تقريبية — تحقق من دقة البوصلة';
      $('#qDelta').textContent = toAr(Math.round(abs));
    } else {
      main.textContent = `استدر ${delta > 0 ? 'يميناً ↻' : 'يساراً ↺'}`;
      sub.textContent = `${toAr(Math.round(abs))} درجة`;
      $('#qDelta').textContent = toAr(Math.round(abs));
    }
    g.classList.toggle('ok', aligned);
    g.classList.toggle('near', !aligned && abs <= CLOSE);
  }

  /* ───────── الحالة والأزرار ───────── */
  function refreshUI() {
    const st = $('#qStatus'), acts = $('#qActions');
    if (!st) return;

    if (bearing == null) {
      setAccuracyBadge('', 'الموقع مطلوب');
      st.className = 'q-status warn';
      st.textContent = 'حدّد موقعك أولاً لحساب اتجاه القبلة.';
      acts.innerHTML = '<button class="btn primary" id="btnQiblaLoc">تحديد موقعي</button>';
      $('#qGuideMain').textContent = 'الموقع غير محدَّد';
      $('#qGuideSub').textContent = 'القبلة تُحسب من موقعك';
      bindActions(); return;
    }

    if (heading == null) {
      if (noSensorFlag) {
        setAccuracyBadge('poor', 'القراءة غير متاحة');
        // غياب القراءة لا يثبت غياب المستشعر؛ نعرض اتجاهًا ثابتًا مع إعادة المحاولة.
        st.className = 'q-status warn';
        st.textContent = 'لم تصل قراءة حديثة من البوصلة. الاتجاه أدناه ثابت من الشمال الحقيقي؛ أعد المحاولة أو استعن ببوصلة أخرى.';
        $('#qGuideMain').textContent = `اتجه نحو ${degWord(bearing.toFixed(0))}`;
        $('#qGuideSub').textContent = `من الشمال الحقيقي — جهة ${dirName(bearing)}`;
        acts.innerHTML = '<button class="btn primary" id="btnQiblaPerm">إعادة تشغيل البوصلة</button><button class="btn ghost" id="btnQiblaLoc">تحديث موقعي</button>';
      } else if (listening) {
        setAccuracyBadge('', 'جارٍ قياس الدقة');
        st.className = 'q-status';
        st.textContent = 'في انتظار مستشعر البوصلة…';
        $('#qGuideMain').textContent = 'جارٍ تشغيل البوصلة…';
        $('#qGuideSub').textContent = 'وجّه أعلى الجهاز نحو الأمام';
        acts.innerHTML = '<button class="btn ghost" id="btnQiblaLoc">تحديث موقعي</button>';
      } else {
        setAccuracyBadge('', 'البوصلة متوقفة');
        st.className = 'q-status warn';
        st.textContent = 'البوصلة غير مفعّلة. يمكنك استخدام الزاوية الرقمية أدناه مع أي بوصلة أخرى — فهي محسوبة من الشمال الحقيقي.';
        $('#qGuideMain').textContent = 'البوصلة غير مفعّلة';
        $('#qGuideSub').textContent = 'اضغط «تفعيل البوصلة»';
        acts.innerHTML = '<button class="btn primary" id="btnQiblaPerm">تفعيل البوصلة</button>'
          + '<button class="btn ghost" id="btnQiblaLoc">تحديث موقعي</button>';
      }
      bindActions(); return;
    }

    // البوصلة تعمل: نصنّف الدقة، ولا نعرض التطابق عند ضعفها.
    st.dataset.accuracy = accuracyLevel;
    const northLabel = northType === 'true' ? 'الشمال الحقيقي'
      : northType === 'magnetic' ? 'الشمال المغناطيسي' : 'اتجاه الجهاز';
    if (accuracyLevel === 'weak') {
      setAccuracyBadge('poor', 'الدقة ضعيفة');
      st.className = 'q-status warn';
      st.textContent = 'دقة البوصلة ضعيفة — حرّك الجهاز على شكل رقم 8 عدة مرات، وأبعده عن المعادن والشواحن.';
    } else if (accuracyLevel === 'medium') {
      setAccuracyBadge('medium', 'الدقة متوسطة');
      st.className = 'q-status';
      st.textContent = `دقة البوصلة متوسطة — ${northLabel}. أبعد الجهاز عن المعادن لتحسينها.`;
    } else if (accuracyLevel === 'good') {
      setAccuracyBadge('good', 'الدقة جيدة');
      st.className = 'q-status ok';
      st.textContent = `دقة البوصلة جيدة — ${northLabel}. ضع الجهاز مسطّحاً وأدر جسمك نحو المؤشر.`;
    } else {
      setAccuracyBadge('medium', 'الدقة غير معروفة');
      st.className = 'q-status warn';
      st.textContent = `قراءة تقريبية — ${northLabel}. هذا الجهاز لا يقدّم تقديرًا للدقة؛ تحقق باستخدام بوصلة موثوقة.`;
    }
    acts.innerHTML = '<button class="btn ghost" id="btnQiblaLoc">تحديث موقعي</button>';
    bindActions();
  }

  function bindActions() {
    const p = $('#btnQiblaPerm'), l = $('#btnQiblaLoc');
    if (p) p.addEventListener('click', enable);
    if (l) l.addEventListener('click', () => window.__requestLocation && window.__requestLocation());
  }

  /* تشغيل البوصلة — تلقائي في التطبيق الأصلي، وبضغطة في متصفح آيفون */
  async function enable() {
    drawTicks();
    if (listening) return;
    const attempt = ++session;
    noSensorFlag = false;

    if (window.__MISHKAT_NATIVE__) {
      listening = true; refreshUI();
      MishkatNative.startHeading();
      sensorTimer = setTimeout(noSensor, 8000);
      return;
    }
    const needsPrompt = typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission === 'function';
    if (needsPrompt) {
      try {
        if (await DeviceOrientationEvent.requestPermission() !== 'granted') {
          $('#qStatus').className = 'q-status warn';
          $('#qStatus').textContent = 'لم يُسمح باستخدام البوصلة. فعّلها من إعدادات المتصفح ثم أعد المحاولة.';
          return;
        }
      } catch (e) {
        $('#qStatus').className = 'q-status warn';
        $('#qStatus').textContent = 'البوصلة تحتاج اتصالاً آمناً (HTTPS) أو غير مدعومة في هذا المتصفح.';
        return;
      }
    }
    if (attempt !== session) return;
    listening = true;
    window.addEventListener('deviceorientationabsolute', onOrient, true);
    window.addEventListener('deviceorientation', onOrient, true);
    refreshUI();
    sensorTimer = setTimeout(noSensor, 8000);
  }

  function noSensor() {
    stop(); noSensorFlag = true;
    render(); refreshUI();
  }

  /* يُستدعى عند فتح تبويب القبلة */
  function init() {
    drawTicks();
    if (Store.s.lat != null) setLocation(Store.s.lat, Store.s.lng); else refreshUI();
    // البوصلة الأصلية لا تحتاج إذناً — نشغّلها تلقائياً في كل مرة تُفتح الشاشة
    if (window.__MISHKAT_NATIVE__ && Store.s.lat != null && !listening) enable();
  }
  /** إيقاف المستشعر عند مغادرة الشاشة — مع تصفير الحالة ليعود التشغيل عند العودة */
  function stop() {
    session++;
    clearTimeout(sensorTimer);
    window.removeEventListener('deviceorientationabsolute', onOrient, true);
    window.removeEventListener('deviceorientation', onOrient, true);
    if (window.__MISHKAT_NATIVE__ && listening) MishkatNative.stopHeading();
    listening = false;
    heading = null;
    smooth = null;
    sampleTimestamp = null;
    accuracy = null;
    accuracyLevel = 'unknown';
    northType = null;
    aligned = false;
    noSensorFlag = false;
  }

  return { init, stop, enable, setLocation, get bearing() { return bearing; } };
})();
