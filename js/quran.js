/* ═══════════════ المصحف: الفهرس، قارئ المدينة، البحث، التلاوة ═══════════════ */
const Quran = (function () {
  const MUSHAF_MANIFEST_URL = 'data/mushaf/hafs-kfqc-manifest.json';
  const MUSHAF_PAGE_COUNT = 604;
  const ACTION_EVENT = 'mishkat:quran-action';
  const REFERENCE_SOURCES = {
    tafsir: {
      title: 'التفسير الميسر',
      key: 'arabic_moyassar',
      direction: 'rtl',
      browse: (s, a) => `https://quranenc.com/ar/browse/arabic_moyassar/${s}/${a}`
    },
    translation: {
      title: 'ترجمة المعاني الإنجليزية',
      key: 'english_saheeh',
      direction: 'ltr',
      browse: (s, a) => `https://quranenc.com/en/browse/english_saheeh/${s}/${a}`
    }
  };

  let DATA = null, plain = null, loadPromise = null;
  let MUSHAF = null, mushafError = null, currentPage = 1, pageRequest = 0;
  let cur = { surah: null, ayah: 1 };
  let audio = null, playing = false, repeatOne = false, bound = false;
  let audioRequest = 0, audioCandidateIndex = 0, audioCandidates = [], audioLoadTimer = null;
  let pendingPlayback = false, savedPlaybackSecond = 0, currentAudioKey = '';
  let swipeStart = null, pageTurnTimer = null, readingSizeSaveTimer = null;
  let readingSizeFrame = null;
  let installHealth = { state: 'unknown', missing: [] };
  let indexMode = 'surah', indexScroll = 0, indexFocus = null;
  let toolsInvoker = null, returnPoint = null, deletedBookmark = null, suppressAyahClickUntil = 0;
  const pageCache = new Map();
  const referenceCache = new Map();
  const actionHandlers = new Map();

  injectMushafStyles();

  /* تجريد التشكيل وتوحيد الحروف للبحث */
  const strip = t => t
    .replace(/[ً-ْٰـۖ-ࣰۭ-ࣿ۟۠-۪ۨ-ۭ]/g, '')
    .replace(/[آأإاٱ]/g, 'ا')
    .replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/\s+/g, ' ').trim();

  const esc = value => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
  const actionIcon = name => {
    const paths = {
      play: '<path d="m9 6 9 6-9 6Z"/>',
      mark: '<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.8L6 21Z"/>',
      trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
      copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
      share: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/>',
      note: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13 7 4 4"/>',
      book: '<path d="M12 6.5C10.3 5 8 4.3 5 4.3c-.7 0-1.3.6-1.3 1.3v12c0 .7.6 1.3 1.3 1.3 3 0 5.3.7 7 2.2 1.7-1.5 4-2.2 7-2.2.7 0 1.3-.6 1.3-1.3v-12c0-.7-.6-1.3-1.3-1.3-3 0-5.3.7-7 2.2Z"/><path d="M12 6.5v14"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.book}</svg>`;
  };
  const padPage = n => String(n).padStart(3, '0');
  const clampPage = n => Math.max(1, Math.min(MUSHAF_PAGE_COUNT, Number(n) || 1));

  function readingSizeLabel(size, percent, isMushaf) {
    if (isMushaf && percent > 102) return `تكبير ${formatNumber(percent)}% — حرّك الصفحة أفقيًا`;
    if (isMushaf && percent < 98) return `عرض مصغّر ${formatNumber(percent)}%`;
    if (isMushaf) return 'ملائم للصفحة';
    return `نص الآيات بحجم ${formatNumber(size)}`;
  }

  function applyReadingSize(value, preserveCenter = true) {
    const size = QuranCore.readingSize(value);
    const scale = QuranCore.readingScale(size);
    const percent = QuranCore.readingPercent(size);
    const box = $('#ayahBox');
    const viewport = box && box.querySelector('.mushaf-page-viewport');
    const centerRatio = preserveCenter && viewport && viewport.scrollWidth
      ? (viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth
      : 0.5;
    const scroller = $('#app');
    const before = viewport?.getBoundingClientRect();
    const scrollRect = scroller?.getBoundingClientRect();
    const barBottom = $('#quranReader .reader-bar')?.getBoundingClientRect().bottom || 0;
    const tools = $('#readerTools');
    const playerTop = Math.min(...['#player', '#readerDock'].map(selector => {
      const element = $(selector); return element?.getClientRects().length ? element.getBoundingClientRect().top : innerHeight;
    }), tools && !tools.classList.contains('hidden') ? tools.getBoundingClientRect().top : innerHeight);
    const visibleTop = before && Math.max(before.top, scrollRect.top, barBottom);
    const visibleBottom = before && Math.min(before.bottom, scrollRect.bottom, playerTop);
    // Anchor only the visible paper, never the settings panel or a hidden page.
    const readingAnchor = preserveCenter && before?.height && visibleBottom > visibleTop
      ? { y: (visibleTop + visibleBottom) / 2, ratio: ((visibleTop + visibleBottom) / 2 - before.top) / before.height }
      : null;

    if (box) {
      box.style.setProperty('--mushaf-zoom', scale.toFixed(4));
      box.style.setProperty('--mushaf-zoom-width', `${(scale * 100).toFixed(2)}%`);
      box.style.setProperty('--mushaf-zoom-max', `${(620 * scale).toFixed(2)}px`);
      box.dataset.mushafZoomed = String(scale > 1.02);
    }

    const progress = ((size - QuranCore.READING_SIZE.min) / (QuranCore.READING_SIZE.max - QuranCore.READING_SIZE.min)) * 100;
    ['#readerFontRange', '#rngFont'].forEach(selector => {
      const range = $(selector);
      if (!range) return;
      range.value = String(size);
      range.style.setProperty('--range-progress', `${progress}%`);
      range.setAttribute('aria-valuetext', `حجم المصحف ${formatNumber(percent)} بالمئة`);
    });
    ['#readerFontValue', '#settingsFontValue'].forEach(selector => {
      const output = $(selector);
      if (output) output.textContent = `${formatNumber(percent)}%`;
    });
    const hint = $('#readerSizeHint');
    if (hint) hint.textContent = readingSizeLabel(size, percent, true);
    const sample = $('#readerFontSample');
    if (sample) sample.style.fontSize = `${Math.max(1.25, Math.min(2.5, size / 23)).toFixed(2)}rem`;
    $$('[data-reader-size]').forEach(button => {
      const selected = Number(button.dataset.readerSize) === size;
      button.classList.toggle('on', selected);
      button.setAttribute('aria-pressed', String(selected));
    });

    cancelAnimationFrame(readingSizeFrame);
    if (viewport) {
      // أبقِ موضع القراءة في الوسط طوال انتقال العرض، لا في أول إطار فقط.
      // Reduced-motion CSS still settles across layout frames. Re-anchor for
      // three frames without animating, rather than accepting the pre-zoom size.
      const duration = preserveCenter && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 240 : 48;
      const start = performance.now();
      const anchor = now => {
        if (!viewport.isConnected || !viewport.clientWidth) return;
        const nextLeft = Math.max(0, centerRatio * viewport.scrollWidth - viewport.clientWidth / 2);
        viewport.scrollTo({ left: nextLeft, behavior: 'instant' });
        if (readingAnchor) {
          const rect = viewport.getBoundingClientRect();
          scroller.scrollTop += rect.top + rect.height * readingAnchor.ratio - readingAnchor.y;
        }
        if (now - start < duration) readingSizeFrame = requestAnimationFrame(anchor);
      };
      readingSizeFrame = requestAnimationFrame(anchor);
    }
    return { size, scale, percent };
  }

  function setReadingSize(value, options = {}) {
    const size = QuranCore.readingSize(value);
    Store.s.quranFont = size;
    const result = applyReadingSize(size, options.preserveCenter !== false);
    clearTimeout(readingSizeSaveTimer);
    if (options.commit) Store.save();
    else readingSizeSaveTimer = setTimeout(() => Store.save(), 140);
    return result;
  }

  function bindReadingSizeControl(range) {
    if (!range || range.dataset.readingSizeBound === 'true') return;
    range.dataset.readingSizeBound = 'true';
    range.addEventListener('input', event => setReadingSize(event.target.value));
    range.addEventListener('change', event => setReadingSize(event.target.value, { commit: true }));
    range.addEventListener('keydown', event => {
      const current = QuranCore.readingSize(Store.s.quranFont);
      const next = {
        ArrowRight: current + 1, ArrowUp: current + 1,
        ArrowLeft: current - 1, ArrowDown: current - 1,
        PageUp: current + 4, PageDown: current - 4,
        Home: QuranCore.READING_SIZE.min, End: QuranCore.READING_SIZE.max
      }[event.key];
      if (next == null) return;
      event.preventDefault();
      setReadingSize(next, { commit: true });
    });
  }

  async function load() {
    if (DATA) return DATA;
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      DATA = await fetchAppJSON('data/quran.json');
      plain = DATA.surahs.map(s => ({ name: strip(s.name), ayahs: s.ayahs.map(strip) }));
      await loadMushafManifest();
      verifyMushafInstall().catch(error => console.warn('[mushaf:health]', error));
      return DATA;
    })().catch(error => { DATA = null; loadPromise = null; throw error; });
    return loadPromise;
  }

  async function loadMushafManifest(force = false) {
    if (MUSHAF && !force) return MUSHAF;
    try {
      const res = await fetchWithTimeout(MUSHAF_MANIFEST_URL, { cache: force ? 'reload' : 'default' }, 8000);
      if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
      const manifest = await res.json();
      const valid = manifest && manifest.edition === 'hafs-kfqc-madinah-604'
        && manifest.pageCount === MUSHAF_PAGE_COUNT
        && manifest.ayahCount === 6236
        && Array.isArray(manifest.pages) && manifest.pages.length === MUSHAF_PAGE_COUNT
        && Array.isArray(manifest.versePages) && manifest.versePages.length === 6236;
      if (!valid) throw new Error('بيانات فهرس المصحف غير مكتملة');
      MUSHAF = manifest;
      mushafError = null;
      return MUSHAF;
    } catch (error) {
      MUSHAF = null;
      mushafError = error;
      return null;
    }
  }

  const surah = n => DATA.surahs[n - 1];
  const globalNum = (s, a) => surah(s).start + a - 1;
  const pageFor = (s, a) => MUSHAF ? MUSHAF.versePages[globalNum(s, a) - 1] : surah(s).page;

  function resolvePoint(kind, value, contextSurah = cur.surah || 1) {
    return QuranCore.pointFor(kind, value, DATA, MUSHAF, contextSurah);
  }

  /* ───────── الفهرس ───────── */
  function renderIndex() {
    const list = $('#surahList');
    list.innerHTML = DATA.surahs.map(s => `
      <button class="surah-item" data-surah="${s.n}">
        <span class="num"><i>${toAr(s.n)}</i></span>
        <span class="info"><b>${s.name}</b><small>${s.type} · ${toAr(s.ayahs.length)} آية</small></span>
        <span class="pg">ص ${toAr(s.page)}</span>
      </button>`).join('');

    $('#juzList').innerHTML = DATA.juz.map(j => {
      const s = surah(j.s);
      return `<button class="surah-item" data-surah="${j.s}" data-ayah="${j.a}">
        <span class="num"><i>${toAr(j.n)}</i></span>
        <span class="info"><b>الجزء ${toAr(j.n)}</b><small>يبدأ من ${s.name} · آية ${toAr(j.a)}</small></span>
      </button>`;
    }).join('');
    renderMarks();
    renderLastRead();
  }

  function renderMarks() {
    const box = $('#marksList'), bm = Store.s.bookmarks || [];
    if (!bm.length) {
      box.innerHTML = '<div class="quran-empty"><b>اترك علامة للعودة</b><p>من داخل المصحف، اضغط رمز العلامة لحفظ موضعك، أو اختر آية ثم «حفظ علامة».</p></div>';
      renderDeletedBookmark();
      return;
    }
    box.innerHTML = bm.map((b, i) => `
      <div class="quran-bookmark-row">
      <button class="surah-item" data-surah="${b.s}" data-ayah="${b.a}">
        <span class="bookmark-symbol" aria-hidden="true">${actionIcon('mark')}</span>
        <span class="info"><b>${surah(b.s).name} — آية ${toAr(b.a)}</b><small>${esc((b.t || '').slice(0, 60))}…</small></span>
      </button><button type="button" class="icon-btn quran-delete-mark" data-del="${i}" aria-label="حذف علامة ${esc(surah(b.s).name)} الآية ${b.a}">${actionIcon('trash')}</button></div>`).join('');
    renderDeletedBookmark();
  }

  function renderDeletedBookmark() {
    if (deletedBookmark) $('#marksList').insertAdjacentHTML('afterbegin', '<div class="quran-mark-feedback" role="status"><span>أُزيلت العلامة</span><button type="button" data-undo-mark>تراجع</button></div>');
    if (indexMode === 'marks' && !$('#surahSearch').value.trim()) $('#quranIndexSummary').textContent = `${toAr((Store.s.bookmarks || []).length)} علامات محفوظة`;
  }

  function renderLastRead() {
    const lr = Store.s.lastRead, box = $('#lastReadBox');
    if (!lr || !surah(lr.s)) {
      box.innerHTML = `<button type="button" class="last-read" data-surah="1"><span class="bookmark-symbol" aria-hidden="true">${actionIcon('book')}</span><span class="last-read-copy"><small>مصحفك بين يديك</small><b>ابدأ من الفاتحة</b><span>604 صفحات بالرسم الموثق</span></span><span aria-hidden="true">‹</span></button>`; return;
    }
    const page = lr.page || pageFor(lr.s, lr.a || 1);
    box.innerHTML = `<button class="last-read" data-surah="${lr.s}" data-ayah="${lr.a}">
      <span class="bookmark-symbol" aria-hidden="true">${actionIcon('mark')}</span><span class="last-read-copy"><small>تابع من حيث توقفت</small><b>${surah(lr.s).name}</b><span>صفحة ${toAr(page)} · آية ${toAr(lr.a)}</span></span><span aria-hidden="true">‹</span></button>`;
  }

  function showIndexMode() {
    ['surah', 'juz', 'marks'].forEach(mode => $('#' + ({surah:'surahList',juz:'juzList',marks:'marksList'})[mode]).classList.toggle('hidden', mode !== indexMode));
    $('#quranIndexSummary').textContent = indexMode === 'surah' ? '114 سورة' : indexMode === 'juz' ? '30 جزءًا' : `${toAr((Store.s.bookmarks || []).length)} علامات محفوظة`;
  }

  /* ───────── البحث ───────── */
  function search(q) {
    const box = $('#searchResults'), qq = strip(q).toLowerCase();
    const digits = q.trim().replace(/[٠-٩]/g, n => String('٠١٢٣٤٥٦٧٨٩'.indexOf(n))).replace(/[۰-۹]/g, n => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(n)));
    const showIdx = v => {
      ['#surahList', '#juzList', '#marksList', '#lastReadBox', '#quranSeg'].forEach(s => $(s).classList.toggle('hidden', !v));
      box.classList.toggle('hidden', v);
      if (v) showIndexMode();
    };
    $('#btnClearQuranSearch').classList.toggle('hidden', !q);
    $('.quran-search').classList.toggle('has-query', Boolean(q));
    if (!qq) { showIdx(true); box.innerHTML = ''; return; }
    showIdx(false);

    const names = DATA.surahs.filter((s, i) => plain[i].name.includes(qq)
      || String(s.n) === digits || s.en.toLowerCase().includes(qq));
    const hits = [];
    for (let i = 0; i < plain.length && hits.length < 150; i++)
      for (let j = 0; j < plain[i].ayahs.length && hits.length < 150; j++)
        if (plain[i].ayahs[j].includes(qq)) hits.push({ s: i + 1, a: j + 1 });
    $('#quranIndexSummary').textContent = `${toAr(names.length)} سور · ${toAr(hits.length)}${hits.length >= 150 ? '+' : ''} آيات مطابقة`;

    box.innerHTML =
      (names.length ? '<h4 class="res-h">سور مطابقة</h4>' + names.map(s =>
        `<button class="surah-item" data-surah="${s.n}"><span class="num"><i>${toAr(s.n)}</i></span>
         <span class="info"><b>${s.name}</b><small>${s.type} · ${toAr(s.ayahs.length)} آية</small></span></button>`).join('') : '') +
      (hits.length ? `<h4 class="res-h">آيات (${toAr(hits.length)}${hits.length >= 150 ? '+' : ''})</h4>` + hits.map(h =>
        `<button class="res-ayah" data-surah="${h.s}" data-ayah="${h.a}">
          <p class="q">${surah(h.s).ayahs[h.a - 1]}</p>
          <small>${surah(h.s).name} · آية ${toAr(h.a)} · ص ${toAr(pageFor(h.s, h.a))}</small></button>`).join('')
        : (names.length ? '' : `<div class="quran-empty"><b>لم نجد «${esc(q)}»</b><p>جرّب اسم سورة أو كلمات أقصر من الآية، دون الحاجة إلى التشكيل.</p></div>`));
  }

  /* ───────── القارئ ───────── */
  function open(n, ayah) {
    const wasIndex = !$('#quranIndex').classList.contains('hidden');
    if (wasIndex) { indexScroll = $('#app').scrollTop; indexFocus = document.activeElement; returnPoint = null; updateReturnPoint(); }
    if (playing || pendingPlayback) stop();
    cur = { surah: n, ayah: ayah || 1 };
    if (wasIndex && window.Nav) Nav.enter();
    $('#quranIndex').classList.add('hidden');
    $('#quranReader').classList.remove('hidden');
    resetReaderScroll();
    renderAyahs();
    rememberReading();
    renderLastRead();
    $('#btnBackIndex').focus({preventScroll:true});
  }

  function juzOf(s, a) {
    let j = 1;
    for (const x of DATA.juz) if (x.s < s || (x.s === s && x.a <= a)) j = x.n;
    return j;
  }

  function rememberReading() {
    if (!cur.surah) return;
    Store.set('lastRead', { s: cur.surah, a: cur.ayah, page: pageFor(cur.surah, cur.ayah) });
  }

  function renderAyahs() {
    renderMushafPage(pageFor(cur.surah, cur.ayah), cur);
  }

  function renderVerseLayout() {
    pageRequest++;
    const s = surah(cur.surah), box = $('#ayahBox');
    box.className = 'ayah-box cards';
    setMushafToolState(false);
    applyReadingSize(Store.s.quranFont || QuranCore.READING_SIZE.fit, false);
    updateReaderHeader();

    const head = `<div class="surah-head"><div class="frame">
        <span class="hn">سورة ${s.name}</span>
        <span class="hm">${s.type} — آياتها ${toAr(s.ayahs.length)}</span>
      </div>${s.bism ? `<div class="bism">${DATA.bism}</div>` : ''}</div>`;
    const body = s.ayahs.map((t, i) => {
      const n = i + 1, sj = s.sajda.includes(n) ? '<span class="sajda" title="سجدة تلاوة">۩</span>' : '';
      return `<div class="ayah card-ayah" data-a="${n}"><p>${t}${sj}</p><span class="mark">${toAr(n)}</span></div>`;
    }).join('');
    box.innerHTML = head + body + navFooter();
  }

  async function renderMushafPage(page, target = null, force = false) {
    const box = $('#ayahBox'), request = ++pageRequest;
    page = clampPage(page);
    currentPage = page;
    box.style.fontSize = '';
    box.className = 'ayah-box natural-mushaf';
    setMushafToolState(true);

    if (!MUSHAF) await loadMushafManifest(force);
    if (request !== pageRequest) return;
    if (!MUSHAF) { renderMushafUnavailable(page, mushafError); return; }

    const entry = MUSHAF.pages[page - 1];
    const chosen = target && pageFor(target.surah, target.ayah) === page
      ? { s: target.surah, a: target.ayah }
      : { s: entry.first.s, a: entry.first.a };
    cur = { surah: chosen.s, ayah: chosen.a };
    updateReaderHeader(page);
    box.innerHTML = mushafScaffold(page, true);
    applyReadingSize(Store.s.quranFont || QuranCore.READING_SIZE.fit, false);
    resetReaderScroll();

    try {
      const raw = await fetchMushafPage(page, force);
      if (request !== pageRequest) return;
      const svg = parseMushafSVG(raw, page);
      const stage = box.querySelector('.mushaf-page-stage');
      stage.innerHTML = '';
      stage.appendChild(svg);
      prepareAyahPolygons(svg);
      highlight(cur.ayah);
      Store.set('lastMushafPage', page);
      rememberReading();
      renderLastRead();
      [page - 2, page - 1, page + 1, page + 2].forEach(prefetchPage);
    } catch (error) {
      if (request === pageRequest) renderMushafUnavailable(page, error);
    }
  }

  function mushafScaffold(page, loading) {
    return `<div class="mushaf-edition" aria-label="مصحف المدينة النبوية برواية حفص">
      <span>مصحف المدينة النبوية</span><span>حفص عن عاصم</span>
    </div>
    <div class="mushaf-page-viewport" aria-label="صفحة المصحف؛ يمكن تحريكها أفقيًا عند التكبير">
      <div class="mushaf-page-paper">
        <div class="mushaf-page-stage" aria-live="${loading ? 'polite' : 'off'}">
          ${loading ? '<div class="mushaf-loading"><i></i><b>تُفتح صفحة المصحف…</b><small>صفحة ' + toAr(page) + '</small></div>' : ''}
        </div>
      </div>
    </div>
    <p class="mushaf-page-hint">اسحب يمينًا للتالي أو استخدم الأسهم. اضغط آية للتفسير والمزيد.</p>`;
  }

  function renderMushafUnavailable(page, error) {
    const box = $('#ayahBox');
    updateReaderHeader(page);
    box.innerHTML = `<div class="mushaf-unavailable" role="alert">
      <span class="mushaf-unavailable-mark" aria-hidden="true">ص</span>
      <h3>لم تتوفر صفحة المصحف</h3>
      <p>تعذّر فتح الصفحة ${toAr(page)}. حاول إعادة تحميل صفحة المصحف.</p>
      <div><button class="btn primary" data-mushaf-retry="${page}">إعادة المحاولة</button></div>
      <small>${navigator.onLine ? 'تم فحص النسخة المحلية ومصدر الاسترداد الموثوق.' : 'أنت غير متصل؛ سيُعاد الفحص تلقائيًا عند عودة الإنترنت.'}</small>
    </div>`;
    if (error) console.warn('Mushaf page unavailable', page, error);
  }

  function updateReaderHeader(page = null) {
    const s = surah(cur.surah);
    $('#rdSurahName').textContent = 'سورة ' + s.name;
    $('#btnReaderLocation').setAttribute('aria-label', `سورة ${s.name}، صفحة ${page || currentPage}، تغيير موضع القراءة`);
    $('#rdSurahMeta').textContent = page
      ? `صفحة ${toAr(page)} من ${toAr(MUSHAF_PAGE_COUNT)} · الجزء ${toAr(juzOf(cur.surah, cur.ayah))}`
      : `${s.type} · ${toAr(s.ayahs.length)} آية · الجزء ${toAr(juzOf(cur.surah, cur.ayah))}`;
    $('#readerPageNumber').textContent = `${toAr(page || currentPage)} / ${toAr(MUSHAF_PAGE_COUNT)}`;
    $('#btnReaderPage').setAttribute('aria-label', `صفحة ${page || currentPage} من 604، انتقال إلى صفحة`);
    $('#btnPreviousPage').disabled = (page || currentPage) <= 1;
    $('#btnFollowingPage').disabled = (page || currentPage) >= MUSHAF_PAGE_COUNT;
    updateBookmarkButton(); updateReciterLabel();
    if (!playing && !pendingPlayback) $('#playerInfo').textContent = `${s.name} · آية ${toAr(cur.ayah)}`;
  }

  function updateBookmarkButton() {
    if (!cur.surah) return;
    const marked = (Store.s.bookmarks || []).some(b => b.s === cur.surah && b.a === cur.ayah);
    $('#btnReaderBookmark').setAttribute('aria-pressed', String(marked));
    $('#btnReaderBookmark').setAttribute('aria-label', `${marked ? 'إزالة العلامة عند' : 'حفظ علامة عند'} ${surah(cur.surah).name}، الآية ${cur.ayah}`);
  }

  function updateReciterLabel() {
    $('#playerReciter').textContent = (RECITERS.find(r => r[0] === Store.s.reciter) || [, 'اختر القارئ'])[1];
  }

  function setAudioPanel(show) {
    $('#player').classList.toggle('hidden', !show);
    $('#quranReader').classList.toggle('audio-expanded', show);
    $('#btnReaderAudio').setAttribute('aria-expanded', String(show));
  }

  function updateReturnPoint() {
    $('#readerReturn').classList.toggle('hidden', !returnPoint);
    if (returnPoint) $('#readerReturnText').textContent = `موضعك السابق: صفحة ${returnPoint.page}`;
  }

  function selectReaderPanel(panel) {
    const names = {appearance:'readerAppearance',navigation:'readerNavigation',audio:'readerAudioSettings'};
    Object.entries(names).forEach(([name,id]) => $('#'+id).classList.toggle('hidden', name !== panel));
    $$('[data-reader-panel]').forEach(button => {
      const selected = button.dataset.readerPanel === panel;
      button.classList.toggle('on', selected); button.setAttribute('aria-selected', String(selected));
    });
  }

  function openReaderPanel(panel, invoker) {
    toolsInvoker = invoker || $('#btnReaderMenu');
    selectReaderPanel(panel);
    $('#readerThemeSel').value = Store.s.theme;
    $('#readerTools').classList.remove('hidden');
    $('#btnReaderMenu').setAttribute('aria-expanded', 'true');
    $('#readerTools').scrollTop = 0;
    $(`[data-reader-panel="${panel}"]`).focus({preventScroll:true});
  }

  function setMushafToolState() {
    applyReadingSize(Store.s.quranFont || QuranCore.READING_SIZE.fit, false);
  }

  function pageURL(page) {
    return MUSHAF.pagePath.replace('{page}', padPage(page));
  }

  function remotePageURL(page) {
    if (MUSHAF.remotePagePath) return MUSHAF.remotePagePath.replace('{page}', padPage(page));
    const source = MUSHAF.source || {};
    if (!source.repository || !source.commit || !source.path) return '';
    return `https://raw.githubusercontent.com/quranpedia/quran-svg/${source.commit}/${source.path}/svg/${padPage(page)}.svg`;
  }

  async function fetchWithTimeout(url, options = {}, timeout = 12000) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
    try {
      return await fetch(url, Object.assign({}, options, controller ? { signal: controller.signal } : {}));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function fetchMushafPage(page, force = false) {
    if (!force && pageCache.has(page)) return pageCache.get(page);
    let localError = null;
    try {
      const response = await fetchWithTimeout(pageURL(page), { cache: force ? 'reload' : 'default' }, 8000);
      if (!response.ok) throw new Error(`local page HTTP ${response.status}`);
      const raw = await response.text();
      await verifyPageIntegrity(page, raw);
      rememberPageInMemory(page, raw);
      return raw;
    } catch (error) {
      localError = error;
      console.warn('[mushaf:local-page-failed]', { page, error: String(error && error.message || error) });
    }

    const recoveryURL = remotePageURL(page);
    if (!navigator.onLine || !recoveryURL) throw localError;
    const response = await fetchWithTimeout(recoveryURL, { cache: force ? 'reload' : 'force-cache' }, 18000);
    if (!response.ok) throw new Error(`recovery page HTTP ${response.status}`);
    const recovered = await response.text();
    await verifyPageIntegrity(page, recovered);
    rememberPageInMemory(page, recovered);
    console.info('[mushaf:page-recovered]', { page, source: 'quranpedia' });
    return recovered;
  }

  async function verifyPageIntegrity(page, raw) {
    const expected = MUSHAF.pages[page - 1].sha256;
    if (!expected || !window.crypto || !window.crypto.subtle) return true;
    const bytes = new TextEncoder().encode(raw);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== expected) throw new Error(`integrity mismatch on page ${page}`);
    return true;
  }

  function rememberPageInMemory(page, raw) {
    pageCache.delete(page);
    pageCache.set(page, raw);
    while (pageCache.size > 5) pageCache.delete(pageCache.keys().next().value);
  }

  function prefetchPage(page) {
    if (!MUSHAF || page < 1 || page > MUSHAF_PAGE_COUNT || pageCache.has(page)) return;
    fetchMushafPage(page).catch(() => {});
  }

  async function verifyMushafInstall(force = false) {
    if (!MUSHAF) return installHealth;
    if (location.protocol !== 'mishkat:') {
      installHealth = { state: 'web', missing: [] };
      return installHealth;
    }
    const key = `mishkat.mushaf-health.${MUSHAF.edition}.${MUSHAF.source && MUSHAF.source.commit || 'local'}`;
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(key) || 'null');
        if (cached && cached.ok) {
          installHealth = { state: 'ready', missing: [], checkedAt: cached.checkedAt };
          return installHealth;
        }
      } catch (_) {}
    }
    installHealth = { state: 'checking', missing: [] };
    const missing = [];
    for (let start = 1; start <= MUSHAF_PAGE_COUNT; start += 20) {
      const pages = Array.from({ length: Math.min(20, MUSHAF_PAGE_COUNT - start + 1) }, (_, index) => start + index);
      const results = await Promise.all(pages.map(async page => {
        try {
          const response = await fetchWithTimeout(pageURL(page), { method: 'HEAD', cache: 'no-store' }, 5000);
          return response.ok && Number(response.headers.get('Content-Length') || MUSHAF.pages[page - 1].bytes) > 0;
        } catch (_) { return false; }
      }));
      results.forEach((ok, index) => { if (!ok) missing.push(pages[index]); });
    }
    installHealth = { state: missing.length ? 'degraded' : 'ready', missing, checkedAt: new Date().toISOString() };
    try { localStorage.setItem(key, JSON.stringify({ ok: !missing.length, checkedAt: installHealth.checkedAt })); } catch (_) {}
    if (missing.length) console.error('[mushaf:install-incomplete]', { missing });
    else console.info('[mushaf:install-complete]', { pages: MUSHAF_PAGE_COUNT });
    return installHealth;
  }

  function parseMushafSVG(raw, page) {
    const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') {
      throw new Error(`SVG غير صالح للصفحة ${page}`);
    }
    doc.querySelectorAll('script,foreignObject,iframe,object,embed,audio,video,link').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (/^on/i.test(attr.name) || /^(href|xlink:href)$/i.test(attr.name)) el.removeAttribute(attr.name);
      });
    });
    const svg = document.importNode(doc.documentElement, true);
    svg.classList.add('mushaf-svg');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', `صفحة ${toAr(page)} من مصحف المدينة`);
    svg.dataset.page = page;

    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
      .mushaf-svg g{pointer-events:none}
      .mushaf-svg path:not(.ayahPolygon){fill:var(--mushaf-ink,#231f20)}
      .mushaf-svg .ayah_markers path{fill:var(--mushaf-accent,#9f7d17)}
      .mushaf-svg .ayahPolygon{pointer-events:all;cursor:pointer;fill:#c7a33a;fill-opacity:0;stroke:transparent;stroke-width:.8;transition:fill-opacity .16s ease,stroke .16s ease}
      .mushaf-svg .ayahPolygon:focus,.mushaf-svg .ayahPolygon.is-selected{fill-opacity:.24;stroke:#a98418;outline:none}
      @media(prefers-reduced-motion:reduce){.mushaf-svg .ayahPolygon{transition:none}}
    `;
    svg.prepend(style);
    return svg;
  }

  function prepareAyahPolygons(svg) {
    const polygons = Array.from(svg.querySelectorAll('.ayahPolygon[surah][ayah]'));
    if (!polygons.length) throw new Error('لا توجد مناطق آيات في الصفحة');
    polygons.forEach(path => {
      const s = Number(path.getAttribute('surah')), a = Number(path.getAttribute('ayah'));
      path.setAttribute('tabindex', '0');
      path.setAttribute('role', 'button');
      path.setAttribute('aria-label', `سورة ${surah(s).name}، الآية ${toAr(a)}. ${surah(s).ayahs[a - 1]}`);
    });
  }

  function navFooter() {
    const n = cur.surah;
    return `<div class="surah-nav">
      ${n > 1 ? `<button class="btn ghost" data-jump="${n - 1}">← ${surah(n - 1).name}</button>` : '<span></span>'}
      ${n < 114 ? `<button class="btn ghost" data-jump="${n + 1}">${surah(n + 1).name} →</button>` : '<span></span>'}
    </div>`;
  }

  function goPage(delta) {
    const next = clampPage(currentPage + delta);
    if (next === currentPage) return;
    if (playing || pendingPlayback) stop();
    renderMushafPage(next);
    const box = $('#ayahBox');
    clearTimeout(pageTurnTimer);
    requestAnimationFrame(() => {
      box.classList.remove('page-turn-next', 'page-turn-previous');
      void box.offsetWidth;
      box.classList.add(delta > 0 ? 'page-turn-next' : 'page-turn-previous');
      pageTurnTimer = setTimeout(() => box.classList.remove('page-turn-next', 'page-turn-previous'), 260);
    });
  }

  function resetReaderScroll() {
    const app = $('#app');
    if (app) app.scrollTo({ top: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function scrollToAyah(a, smooth = true) {
    cur.ayah = a;
    const page = pageFor(cur.surah, a);
    if (page !== currentPage || !$('#ayahBox .mushaf-svg')) renderMushafPage(page, cur);
    else highlight(a);
  }

  function highlight(a) {
    $$('#ayahBox .ayahPolygon.is-selected').forEach(e => e.classList.remove('is-selected'));
    const el = $(`#ayahBox .ayahPolygon[surah="${cur.surah}"][ayah="${a}"]`);
    if (el) el.classList.add('is-selected');
  }

  function selectMushafAyah(path) {
    const s = Number(path.getAttribute('surah')), a = Number(path.getAttribute('ayah'));
    if (!s || !a || !surah(s)) return;
    if (playing || pendingPlayback) stop();
    cur = { surah: s, ayah: a };
    highlight(a);
    updateReaderHeader(currentPage);
    rememberReading();
    renderLastRead();
    ayahMenu(a);
  }

  /* ───────── إجراءات الآية ───────── */
  function ayahMenu(a) {
    const s = surah(cur.surah), text = s.ayahs[a - 1];
    const full = `${text} ﴿${toAr(a)}﴾\n[سورة ${s.name}]`;
    const marked = (Store.s.bookmarks || []).some(b => b.s === cur.surah && b.a === a);
    const hasNote = Boolean((Store.s.quranNotes || {})[noteKey(cur.surah, a)]);
    removeSheet('ayahSheet');
    const sheet = document.createElement('div');
    sheet.id = 'ayahSheet'; sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', `إجراءات الآية ${toAr(a)} من سورة ${s.name}`);
    sheet.innerHTML = `<div class="sheet-in ayah-actions">
      <p class="sheet-q">${text}</p>
      <small class="sheet-m">${s.name} · آية ${toAr(a)} · الجزء ${toAr(juzOf(cur.surah, a))} · صفحة ${toAr(pageFor(cur.surah, a))}</small>
      <div class="ayah-action-grid">
        <button data-act="play"><span aria-hidden="true">${actionIcon('play')}</span> تشغيل</button>
        <button data-act="mark"><span aria-hidden="true">${actionIcon('mark')}</span> ${marked ? 'إزالة العلامة' : 'حفظ علامة'}</button>
        <button data-act="copy"><span aria-hidden="true">${actionIcon('copy')}</span> نسخ</button>
        <button data-act="share"><span aria-hidden="true">${actionIcon('share')}</span> مشاركة</button>
        <button data-act="note"><span aria-hidden="true">${actionIcon('note')}</span> ${hasNote ? 'تعديل الملاحظة' : 'إضافة ملاحظة'}</button>
        <button data-act="tafsir"><span aria-hidden="true">ت</span> التفسير الميسر</button>
        <button data-act="translation"><span aria-hidden="true">EN</span> ترجمة إنجليزية</button>
      </div>
      <button data-act="close" class="close">إغلاق</button></div>`;
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('show'));
    sheet.addEventListener('click', async event => {
      const button = event.target.closest('[data-act]');
      const act = button && button.dataset.act;
      if (!act && event.target !== sheet) return;
      if (!act || act === 'close') { closeSheet(sheet); return; }
      if (act === 'play') { cur.ayah = a; play(); closeSheet(sheet); }
      if (act === 'mark') { toggleBookmark(cur.surah, a, text); closeSheet(sheet); }
      if (act === 'copy') { await copyText(full); closeSheet(sheet); }
      if (act === 'share') { await shareAyah(full); closeSheet(sheet); }
      if (act === 'note') { closeSheet(sheet); setTimeout(() => showNoteEditor(cur.surah, a), 180); }
      if (act === 'tafsir' || act === 'translation') {
        closeSheet(sheet);
        setTimeout(() => openReference(act, cur.surah, a), 180);
      }
    });
  }

  function toggleBookmark(s, a, text) {
    const bm = (Store.s.bookmarks || []).slice();
    const index = bm.findIndex(b => b.s === s && b.a === a);
    if (index >= 0) {
      bm.splice(index, 1);
      toast('تمت إزالة العلامة');
    } else {
      bm.unshift({ s, a, t: text.slice(0, 80), page: pageFor(s, a) });
      toast('تم حفظ العلامة');
    }
    Store.set('bookmarks', bm.slice(0, 100));
    deletedBookmark = null; renderMarks(); updateBookmarkButton();
  }

  function noteKey(s, a) { return `${s}:${a}`; }

  function showNoteEditor(s, a) {
    const notes = Object.assign({}, Store.s.quranNotes || {});
    const key = noteKey(s, a), existing = notes[key] || '';
    removeSheet('ayahNoteSheet');
    const sheet = document.createElement('div');
    sheet.id = 'ayahNoteSheet'; sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
    sheet.innerHTML = `<div class="sheet-in ayah-note-editor">
      <h3>ملاحظة على ${surah(s).name} · ${toAr(a)}</h3>
      <p class="muted small">تُحفظ الملاحظة على جهازك فقط.</p>
      <label for="ayahNoteText">الملاحظة</label>
      <textarea id="ayahNoteText" maxlength="4000" rows="6" placeholder="اكتب تدبّرك أو ملاحظتك هنا…"></textarea>
      <div class="ayah-note-actions"><button class="btn primary" data-note-act="save">حفظ الملاحظة</button>
      ${existing ? '<button class="btn ghost danger" data-note-act="delete">حذف الملاحظة</button>' : ''}</div>
      <button class="close" data-note-act="close">إلغاء</button></div>`;
    document.body.appendChild(sheet);
    const textarea = sheet.querySelector('textarea');
    textarea.value = existing;
    requestAnimationFrame(() => sheet.classList.add('show'));
    setTimeout(() => textarea.focus(), 300);
    sheet.addEventListener('click', event => {
      const button = event.target.closest('[data-note-act]');
      const act = button && button.dataset.noteAct;
      if (!act && event.target !== sheet) return;
      if (!act || act === 'close') { closeSheet(sheet); return; }
      if (act === 'save') {
        const value = textarea.value.trim();
        if (value) notes[key] = value; else delete notes[key];
        Store.set('quranNotes', notes);
        toast(value ? 'تم حفظ الملاحظة' : 'تم حذف الملاحظة الفارغة');
        closeSheet(sheet);
      }
      if (act === 'delete') {
        delete notes[key]; Store.set('quranNotes', notes);
        toast('تم حذف الملاحظة'); closeSheet(sheet);
      }
    });
  }

  async function openReference(kind, s, a, force = false) {
    if (await runRegisteredAction(kind, s, a)) return;
    const source = REFERENCE_SOURCES[kind];
    if (!source) return;
    removeSheet('ayahReferenceSheet');
    const sheet = document.createElement('div');
    sheet.id = 'ayahReferenceSheet'; sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
    sheet.innerHTML = `<div class="sheet-in ayah-reference" dir="${source.direction}">
      <div class="ayah-reference-head"><div><h3>${source.title}</h3><small>${surah(s).name} · آية ${toAr(a)}</small></div>
      <button class="reference-close" data-ref-act="close" aria-label="إغلاق">×</button></div>
      <div class="ayah-reference-body" aria-live="polite"><div class="reference-loading"><i></i><span>جارٍ جلب المحتوى الموثّق…</span></div></div>
      <div class="ayah-reference-source">المصدر: QuranEnc.com · يعرض النص كما ورد من المصدر</div></div>`;
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('show'));
    sheet.addEventListener('click', event => {
      const button = event.target.closest('[data-ref-act]');
      const act = button && button.dataset.refAct;
      if (!act && event.target !== sheet) return;
      if (!act || act === 'close') closeSheet(sheet);
      if (act === 'retry') openReference(kind, s, a, true);
    });

    const body = sheet.querySelector('.ayah-reference-body');
    try {
      const result = await fetchReference(source, s, a, force);
      if (!document.body.contains(sheet)) return;
      body.innerHTML = '';
      const text = document.createElement('p');
      text.className = 'reference-text'; text.textContent = result.translation;
      body.appendChild(text);
      if (result.footnotes) {
        const footnotes = document.createElement('p');
        footnotes.className = 'reference-footnotes'; footnotes.textContent = result.footnotes;
        body.appendChild(footnotes);
      }
      const link = document.createElement('a');
      link.className = 'reference-link'; link.href = source.browse(s, a);
      link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'فتح صفحة المصدر';
      body.appendChild(link);
    } catch (error) {
      if (!document.body.contains(sheet)) return;
      body.innerHTML = `<div class="reference-error"><b>تعذّر تحميل ${source.title}</b>
        <p>${navigator.onLine ? 'تعذر الاتصال بالمصدر الآن.' : 'يلزم اتصال بالإنترنت لعرض هذا المحتوى.'}</p>
        <button class="btn primary" data-ref-act="retry">إعادة المحاولة</button></div>`;
      console.warn('Quran reference unavailable', kind, s, a, error);
    }
  }

  async function fetchReference(source, s, a, force) {
    const key = `${source.key}:${s}:${a}`;
    if (!force && referenceCache.has(key)) return referenceCache.get(key);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`https://quranenc.com/api/v1/translation/aya/${source.key}/${s}/${a}`, {
        cache: force ? 'reload' : 'default', signal: controller.signal
      });
      if (!res.ok) throw new Error(`reference HTTP ${res.status}`);
      const json = await res.json();
      const payload = json.result === undefined ? json : json.result;
      const item = Array.isArray(payload) ? payload.find(x => Number(x.aya) === a) : payload;
      if (!item || !item.translation) throw new Error('reference payload incomplete');
      const value = { translation: String(item.translation), footnotes: String(item.footnotes || '') };
      referenceCache.set(key, value);
      return value;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function runRegisteredAction(kind, s, a) {
    const payload = { action: kind, surah: s, ayah: a, page: pageFor(s, a), text: surah(s).ayahs[a - 1] };
    const handler = actionHandlers.get(kind);
    if (handler) {
      try { if (await handler(payload) !== false) return true; }
      catch (error) { console.warn('Quran action handler failed', kind, error); }
    }
    const event = new CustomEvent(ACTION_EVENT, { detail: payload, cancelable: true });
    document.dispatchEvent(event);
    return event.defaultPrevented;
  }

  function registerAyahAction(name, handler) {
    if (!REFERENCE_SOURCES[name] || typeof handler !== 'function') throw new TypeError('إجراء آية غير صالح');
    actionHandlers.set(name, handler);
    return () => actionHandlers.delete(name);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement('textarea');
        area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
        document.body.appendChild(area); area.select();
        if (!document.execCommand('copy')) throw new Error('copy failed');
        area.remove();
      }
      toast('تم نسخ الآية');
    } catch (_) { toast('تعذّر نسخ الآية'); }
  }

  async function shareAyah(text) {
    if (!navigator.share) { await copyText(text); return; }
    try { await navigator.share({ title: 'آية من القرآن الكريم', text }); }
    catch (error) { if (error && error.name !== 'AbortError') toast('تعذّرت المشاركة'); }
  }

  function removeSheet(id) { const old = $('#' + id); if (old) old.remove(); }
  function closeSheet(sheet) {
    sheet.classList.remove('show');
    setTimeout(() => sheet.remove(), 250);
  }

  /* ───────── التلاوة ───────── */
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'auto';
    audio.addEventListener('ended', () => {
      clearAudioTimer();
      if (repeatOne) { audio.currentTime = 0; safeAudioPlay(audioRequest); return; }
      if (!Store.s.quranContinuous) {
        pendingPlayback = false;
        setPlaying(false);
        setAudioState('idle', 'انتهت الآية');
        return;
      }
      const s = surah(cur.surah);
      if (cur.ayah < s.ayahs.length) { cur.ayah++; play({ restart: true }); }
      else if (cur.surah < 114) { cur = { surah: cur.surah + 1, ayah: 1 }; play({ restart: true }); }
      else stop();
    });
    audio.addEventListener('loadedmetadata', () => {
      if (savedPlaybackSecond > 0 && Number.isFinite(audio.duration) && savedPlaybackSecond < audio.duration - 1) {
        try { audio.currentTime = savedPlaybackSecond; } catch (_) {}
      }
      savedPlaybackSecond = 0;
    });
    audio.addEventListener('playing', () => {
      clearAudioTimer();
      if (!pendingPlayback) { audio.pause(); return; }
      setPlaying(true);
      setAudioState('playing', 'يعمل الآن');
    });
    audio.addEventListener('waiting', () => {
      if (pendingPlayback) setAudioState('loading', 'جارٍ استكمال التحميل…');
    });
    audio.addEventListener('stalled', () => {
      if (pendingPlayback) setAudioState('loading', 'الاتصال بطيء…');
    });
    audio.addEventListener('error', () => {
      const expected = audioCandidates[audioCandidateIndex];
      if (expected && audio.currentSrc && audio.currentSrc !== expected) return;
      failAudioCandidate(audioRequest, 'تعذّر تحميل هذا المصدر');
    });
    audio.addEventListener('pause', () => {
      setPlaying(false);
      persistPlaybackPosition();
      if (!pendingPlayback && $('#player').dataset.state !== 'error') setAudioState('paused', 'متوقف مؤقتًا');
    });
    audio.addEventListener('timeupdate', () => {
      if (Math.floor(audio.currentTime) % 5 === 0) persistPlaybackPosition();
    });
    return audio;
  }

  function clearAudioTimer() {
    if (audioLoadTimer) clearTimeout(audioLoadTimer);
    audioLoadTimer = null;
  }

  function setAudioState(state, label) {
    const player = $('#player');
    player.dataset.state = state;
    player.setAttribute('aria-busy', String(state === 'loading'));
    $('#playerState').textContent = label || '';
    $('#btnRetryAudio').classList.toggle('hidden', state !== 'error');
  }

  function setPlaying(v) {
    playing = v;
    $('#btnReaderAudio span').textContent = v ? 'تلاوة جارية' : 'تلاوة';
    $('#btnPlay').classList.toggle('is-playing', v);
    $('#btnPlay').setAttribute('aria-label', v ? 'إيقاف التلاوة مؤقتاً' : 'تشغيل التلاوة');
    $('#player').classList.toggle('active', v);
  }

  function persistPlaybackPosition() {
    if (!audio || !currentAudioKey || !Number.isFinite(audio.currentTime)) return;
    Store.set('quranAudioPosition', { key: currentAudioKey, s: cur.surah, a: cur.ayah, second: Math.floor(audio.currentTime) });
  }

  function syncAudioAyah() {
    const page = pageFor(cur.surah, cur.ayah);
    if (page !== currentPage || !$('#ayahBox .mushaf-svg')) renderMushafPage(page, cur);
    else highlight(cur.ayah);
  }

  function loadAudioCandidate(request) {
    const a = ensureAudio();
    if (request !== audioRequest || !pendingPlayback) return;
    const url = audioCandidates[audioCandidateIndex];
    if (!url) {
      pendingPlayback = false;
      setPlaying(false);
      setAudioState('error', navigator.onLine ? 'تعذّرت التلاوة من جميع المصادر' : 'لا يوجد اتصال بالإنترنت');
      return;
    }
    setAudioState('loading', audioCandidateIndex ? 'جارٍ تجربة مصدر بديل…' : 'جارٍ تحميل التلاوة…');
    a.src = url;
    a.load();
    clearAudioTimer();
    audioLoadTimer = setTimeout(() => failAudioCandidate(request, 'انتهت مهلة التحميل'), 12000);
    safeAudioPlay(request);
  }

  function safeAudioPlay(request) {
    const promise = ensureAudio().play();
    if (!promise || typeof promise.catch !== 'function') return;
    promise.catch(error => {
      if (request !== audioRequest || !pendingPlayback || error && error.name === 'AbortError') return;
      if (error && error.name === 'NotAllowedError') {
        pendingPlayback = false;
        clearAudioTimer();
        setAudioState('paused', 'اضغط تشغيل للسماح بالصوت');
        return;
      }
      failAudioCandidate(request, error && error.message || 'تعذّر بدء التشغيل');
    });
  }

  function failAudioCandidate(request, reason) {
    if (request !== audioRequest || !pendingPlayback) return;
    clearAudioTimer();
    audioCandidateIndex += 1;
    console.warn('[quran:audio-source-failed]', { reciter: Store.s.reciter, candidate: audioCandidateIndex, reason });
    if (audioCandidateIndex < audioCandidates.length) {
      loadAudioCandidate(request);
      return;
    }
    pendingPlayback = false;
    setPlaying(false);
    setAudioState('error', navigator.onLine ? 'تعذّر تحميل التلاوة — حاول مجددًا' : 'التلاوة تحتاج اتصالًا بالإنترنت');
  }

  function play(options = {}) {
    if (!cur.surah) return;
    setAudioPanel(true);
    const a = ensureAudio();
    const key = `${Store.s.reciter}:${globalNum(cur.surah, cur.ayah)}`;
    $('#playerInfo').textContent = `${surah(cur.surah).name} · آية ${toAr(cur.ayah)}`;
    syncAudioAyah();
    rememberReading();
    pendingPlayback = true;
    if (!options.restart && currentAudioKey === key && a.src && !a.ended) {
      setAudioState('loading', 'جارٍ استئناف التلاوة…');
      safeAudioPlay(audioRequest);
      return;
    }
    persistPlaybackPosition();
    currentAudioKey = key;
    audioCandidates = QuranCore.audioCandidates(RECITERS, Store.s.reciter, globalNum(cur.surah, cur.ayah));
    audioCandidateIndex = 0;
    audioRequest += 1;
    const saved = Store.s.quranAudioPosition;
    savedPlaybackSecond = !options.restart && saved && saved.key === key ? Number(saved.second) || 0 : 0;
    loadAudioCandidate(audioRequest);
    updateMediaSession();
  }
  function toggle() {
    if (playing || pendingPlayback) {
      pendingPlayback = false;
      audioRequest += 1;
      clearAudioTimer();
      if (audio) audio.pause();
      setAudioState('paused', 'متوقف مؤقتًا');
    } else play();
  }
  function stop() {
    pendingPlayback = false;
    audioRequest += 1;
    clearAudioTimer();
    persistPlaybackPosition();
    if (audio) audio.pause();
    setPlaying(false);
    if ($('#player')) setAudioState('paused', 'محفوظ للمتابعة');
  }
  function step(d) {
    let s = cur.surah, a = cur.ayah + d;
    if (a < 1 && s > 1) { s--; a = surah(s).ayahs.length; }
    else if (a > surah(s).ayahs.length && s < 114) { s++; a = 1; }
    else if (a < 1 || a > surah(s).ayahs.length) return;
    cur = { surah: s, ayah: a };
    play({ restart: true });
  }
  function updateMediaSession() {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `سورة ${surah(cur.surah).name} — آية ${toAr(cur.ayah)}`,
      artist: (RECITERS.find(r => r[0] === Store.s.reciter) || [, ''])[1],
      album: 'المصحف الشريف'
    });
    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', () => audio && audio.pause());
    navigator.mediaSession.setActionHandler('nexttrack', () => step(1));
    navigator.mediaSession.setActionHandler('previoustrack', () => step(-1));
  }

  function backToIndex() {
    document.body.classList.remove('reading-focus');
    $('#readerTools').classList.add('hidden');
    $('#btnReaderMenu').setAttribute('aria-expanded', 'false');
    $('#btnReaderFocus').setAttribute('aria-pressed', 'false');
    $('#btnReaderFocus').setAttribute('aria-label', 'قراءة بملء الشاشة');
    pageRequest++;
    stop();
    $('#quranReader').classList.add('hidden');
    $('#quranIndex').classList.remove('hidden');
    renderMarks(); renderLastRead();
    search($('#surahSearch').value);
    returnPoint = null; updateReturnPoint(); setAudioPanel(false);
    const replacement = indexFocus?.dataset?.surah
      ? $$('#quranIndex [data-surah]').find(el => el.dataset.surah === indexFocus.dataset.surah && (el.dataset.ayah || '1') === (indexFocus.dataset.ayah || '1')) : null;
    const focus = indexFocus?.isConnected && $('#quranIndex').contains(indexFocus) ? indexFocus : replacement || $('#surahSearch');
    focus.focus({preventScroll:true});
    $('#app').scrollTo({top:indexScroll,behavior:'instant'});
  }

  /* ───────── ربط الأحداث ───────── */
  function bind() {
    if (bound) return;
    bound = true;
    const idx = $('#quranIndex');
    idx.addEventListener('click', e => {
      if (e.target.closest('[data-undo-mark]') && deletedBookmark) {
        const bm = Store.s.bookmarks.slice(), saved = deletedBookmark;
        if (!bm.some(b => b.s === saved.value.s && b.a === saved.value.a)) bm.splice(Math.min(saved.index, bm.length), 0, saved.value);
        Store.set('bookmarks', bm); deletedBookmark = null; renderMarks();
        $('#quranSeg [data-mode="marks"]').focus({preventScroll:true}); toast('استُعيدت العلامة'); return;
      }
      const del = e.target.closest('[data-del]');
      if (del) {
        e.stopPropagation();
        const bm = Store.s.bookmarks.slice(), index = +del.dataset.del;
        deletedBookmark = {index, value:bm[index]}; bm.splice(index, 1);
        Store.set('bookmarks', bm); renderMarks(); $('[data-undo-mark]')?.focus({preventScroll:true}); return;
      }
      const b = e.target.closest('[data-surah]');
      if (b) open(+b.dataset.surah, +b.dataset.ayah || 1);
    });
    $('#surahSearch').addEventListener('input', e => search(e.target.value));
    $('#btnClearQuranSearch').addEventListener('click', () => { $('#surahSearch').value = ''; search(''); $('#surahSearch').focus(); });
    $('#indexPageForm').addEventListener('submit', e => {
      e.preventDefault();
      const input = $('#indexPageNumber'), page = Number(input.value);
      if (!input.checkValidity() || !Number.isInteger(page)) { input.reportValidity(); return; }
      const point = resolvePoint('page', page); open(point.s, point.a);
    });
    $('#quranSeg').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $('#surahSearch').value = '';
      $('#searchResults').classList.add('hidden');
      $$('#quranSeg button').forEach(x => {
        const selected = x === b;
        x.classList.toggle('on', selected);
        x.setAttribute('aria-selected', String(selected));
      });
      indexMode = b.dataset.mode;
      search('');
    });

    $('#btnBackIndex').addEventListener('click', () => (window.Nav ? Nav.exit(backToIndex) : backToIndex()));
    $('#btnReaderMenu').addEventListener('click', e => {
      if ($('#readerTools').classList.contains('hidden')) openReaderPanel('appearance', e.currentTarget);
      else closeReadingTools(true);
    });
    const closeReadingTools = (restoreFocus = false) => {
      $('#readerTools').classList.add('hidden');
      $('#btnReaderMenu').setAttribute('aria-expanded', 'false');
      if (restoreFocus) (toolsInvoker?.isConnected ? toolsInvoker : $('#btnReaderMenu')).focus({ preventScroll: true });
    };
    $('#btnCloseReaderTools').addEventListener('click', () => closeReadingTools(true));
    document.addEventListener('pointerdown', e => {
      if (!e.target.closest('#readerTools,#btnReaderMenu,#btnReaderPage,#btnReaderLocation,#btnReciterOptions') && !$('#readerTools').classList.contains('hidden')) closeReadingTools();
    });
    document.addEventListener('focusin', e => {
      // WebKit focuses the tabindex=-1 main container when a tap blurs a tab.
      // Only moving to an actual control means keyboard navigation out of the panel.
      const control = e.target.closest('button,input,select,textarea,a[href],summary,[tabindex]:not([tabindex="-1"])');
      if (!control) return;
      if (!control.closest('#readerTools,#btnReaderMenu,#btnReaderPage,#btnReaderLocation,#btnReciterOptions') && !$('#readerTools').classList.contains('hidden')) closeReadingTools();
    });
    const updateKeyboardInset = () => {
      const v = window.visualViewport;
      const inset = v && v.scale <= 1.01 ? Math.max(0, innerHeight - v.height - v.offsetTop) : 0;
      document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`);
    };
    window.visualViewport?.addEventListener('resize', updateKeyboardInset);
    updateKeyboardInset();
    $('#btnReaderFocus').addEventListener('click', e => {
      const focus = document.body.classList.toggle('reading-focus');
      e.currentTarget.setAttribute('aria-pressed', String(focus));
      e.currentTarget.setAttribute('aria-label', focus ? 'إظهار شريط التنقل' : 'قراءة بملء الشاشة');
    });
    $$('[data-reader-panel]').forEach(button => button.addEventListener('click', () => selectReaderPanel(button.dataset.readerPanel)));
    ['#btnReaderPage','#btnReaderLocation'].forEach(selector => $(selector).addEventListener('click', e => {
      $('#gotoType').value = 'page'; $('#gotoValue').value = currentPage; updateGotoBounds(); openReaderPanel('navigation', e.currentTarget);
    }));
    $('#btnPreviousPage').addEventListener('click', () => goPage(-1));
    $('#btnFollowingPage').addEventListener('click', () => goPage(1));
    $('#btnReaderBookmark').addEventListener('click', () => { if (cur.surah) toggleBookmark(cur.surah, cur.ayah, surah(cur.surah).ayahs[cur.ayah - 1]); });
    $('#btnReaderAudio').addEventListener('click', () => setAudioPanel($('#player').classList.contains('hidden')));
    $('#btnReciterOptions').addEventListener('click', e => openReaderPanel('audio', e.currentTarget));
    $('#btnReaderReturn').addEventListener('click', () => {
      const point = returnPoint; returnPoint = null; updateReturnPoint();
      if (point) open(point.s, point.a);
    });
    $('#btnDismissReaderReturn').addEventListener('click', () => { returnPoint = null; updateReturnPoint(); $('#btnReaderPage').focus({preventScroll:true}); });

    const ayahBox = $('#ayahBox');
    ayahBox.addEventListener('click', e => {
      if (performance.now() < suppressAyahClickUntil) { e.preventDefault(); return; }
      const pageButton = e.target.closest('[data-page-delta]');
      if (pageButton) { goPage(Number(pageButton.dataset.pageDelta)); return; }
      const retry = e.target.closest('[data-mushaf-retry]');
      if (retry) { renderMushafPage(Number(retry.dataset.mushafRetry), cur, true); return; }
      const j = e.target.closest('[data-jump]');
      if (j) { open(+j.dataset.jump); return; }
      const polygon = e.target.closest('.ayahPolygon');
      if (polygon) { selectMushafAyah(polygon); return; }
      const el = e.target.closest('.ayah');
      if (el) ayahMenu(+el.dataset.a);
    });
    ayahBox.addEventListener('keydown', e => {
      const polygon = e.target.closest('.ayahPolygon');
      if (polygon && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectMushafAyah(polygon); }
    });
    ayahBox.addEventListener('touchstart', e => {
      swipeStart = null;
      if (e.touches.length !== 1) return;
      if (window.visualViewport && window.visualViewport.scale > 1.02) return;
      if (QuranCore.readingScale(Store.s.quranFont) > 1.02) return;
      if (e.target.closest('button,input,select,a')) return;
      swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, at: performance.now() };
    }, { passive: true });
    ayahBox.addEventListener('touchmove', e => {
      if (e.touches.length !== 1 || window.visualViewport && window.visualViewport.scale > 1.02 || QuranCore.readingScale(Store.s.quranFont) > 1.02) swipeStart = null;
      if (swipeStart) {
        const dx = e.touches[0].clientX - swipeStart.x, dy = e.touches[0].clientY - swipeStart.y;
        if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) swipeStart = null;
        else if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.25 && e.cancelable) e.preventDefault();
      }
    }, { passive: false });
    ayahBox.addEventListener('touchend', e => {
      if (!swipeStart || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - swipeStart.x;
      const dy = e.changedTouches[0].clientY - swipeStart.y;
      const elapsed = performance.now() - swipeStart.at;
      swipeStart = null;
      if (elapsed <= 700 && Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        // في المصحف العربي: سحب الورقة إلى اليمين يكشف الصفحة التالية.
        suppressAyahClickUntil = performance.now() + 450;
        if (e.cancelable) e.preventDefault();
        goPage(dx > 0 ? 1 : -1);
      }
    }, { passive: false });
    ayahBox.addEventListener('touchcancel', () => { swipeStart = null; }, { passive: true });

    const readerFontRange = $('#readerFontRange');
    $('#readerThemeSel').addEventListener('change', e => { $('#selTheme').value = e.target.value; $('#selTheme').dispatchEvent(new Event('change')); });
    bindReadingSizeControl(readerFontRange);
    $('#fontPlus').addEventListener('click', () => setReadingSize(Number(Store.s.quranFont) + 2, { commit: true }));
    $('#fontMinus').addEventListener('click', () => setReadingSize(Number(Store.s.quranFont) - 2, { commit: true }));
    $('#readerTools').addEventListener('click', e => {
      const preset = e.target.closest('[data-reader-size]');
      if (preset) setReadingSize(preset.dataset.readerSize, { commit: true });
    });
    applyReadingSize(Store.s.quranFont || QuranCore.READING_SIZE.fit, false);
    const gotoType = $('#gotoType'), gotoValue = $('#gotoValue');
    const updateGotoBounds = () => {
      const limits = { page: 604, surah: 114, juz: 30, hizb: 60, ayah: surah(cur.surah || 1).ayahs.length };
      gotoValue.max = limits[gotoType.value];
      gotoValue.placeholder = `1–${limits[gotoType.value]}`;
    };
    gotoType.addEventListener('change', updateGotoBounds);
    updateGotoBounds();
    $('#readerJumpForm').addEventListener('submit', e => {
      e.preventDefault();
      updateGotoBounds();
      const value = Number(gotoValue.value), max = Number(gotoValue.max);
      if (!Number.isInteger(value) || value < 1 || value > max) { toast(`أدخل رقمًا من 1 إلى ${max}`); return; }
      const point = resolvePoint(gotoType.value, value, cur.surah);
      if (point.page !== currentPage && !returnPoint) returnPoint = { s: cur.surah, a: cur.ayah, page: currentPage };
      open(point.s, point.a);
      closeReadingTools(); updateReturnPoint();
    });
    $('#btnPlay').addEventListener('click', toggle);
    $('#btnRetryAudio').addEventListener('click', () => play({ restart: false }));
    $('#btnNextAyah').addEventListener('click', () => step(1));
    $('#btnPrevAyah').addEventListener('click', () => step(-1));
    $('#btnRepeat').addEventListener('click', e => {
      repeatOne = !repeatOne;
      e.currentTarget.classList.toggle('on', repeatOne);
      e.currentTarget.setAttribute('aria-pressed', String(repeatOne));
      e.currentTarget.setAttribute('aria-label', repeatOne ? 'إيقاف تكرار الآية' : 'تفعيل تكرار الآية');
      toast(repeatOne ? 'تكرار الآية مفعّل' : 'تكرار الآية متوقف');
    });

    document.addEventListener('keydown', e => {
      if ($('#quranReader').classList.contains('hidden')) return;
      if (document.querySelector('.sheet')) return;
      if (e.defaultPrevented) return;
      if (e.key === 'Escape' && !$('#readerTools').classList.contains('hidden')) {
        e.preventDefault(); closeReadingTools(true); return;
      }
      if (e.key === 'Escape' && document.body.classList.contains('reading-focus')) {
        $('#btnReaderFocus').click(); $('#btnReaderFocus').focus(); return;
      }
      if (e.target.closest('[role="tablist"]')) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); goPage(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPage(-1); }
    });

    const rs = $('#reciterSel');
    rs.innerHTML = RECITERS.map(r => `<option value="${r[0]}">${r[1]}</option>`).join('');
    rs.value = Store.s.reciter;
    rs.addEventListener('change', () => {
      const shouldResume = playing || pendingPlayback;
      persistPlaybackPosition();
      Store.set('reciter', rs.value);
      updateReciterLabel();
      currentAudioKey = '';
      if (shouldResume) play({ restart: true });
      else setAudioState('idle', 'تم اختيار القارئ');
    });
    const autoScroll = $('#quranAutoScroll');
    autoScroll.checked = Store.s.quranAutoScroll !== false;
    autoScroll.addEventListener('change', () => Store.set('quranAutoScroll', autoScroll.checked));
    const continuous = $('#quranContinuous');
    continuous.checked = Store.s.quranContinuous !== false;
    continuous.addEventListener('change', () => Store.set('quranContinuous', continuous.checked));
  }

  /* أبقينا نقطة الاستدعاء للتوافق، وأصبحت الأنماط كلها في نظام styles.css الموحّد. */
  function injectMushafStyles() {}

  return {
    load, renderIndex, bind, open, stop, renderMarks, registerAyahAction, resolvePoint, verifyMushafInstall, setReadingSize, applyReadingSize, bindReadingSizeControl,
    openPage(page) {
      if (!DATA) return;
      const entry = MUSHAF && MUSHAF.pages[clampPage(page) - 1];
      if (entry) open(entry.first.s, entry.first.a);
    },
    get currentPage() { return currentPage; },
    get data() { return DATA; },
    get manifest() { return MUSHAF; },
    get installHealth() { return Object.assign({}, installHealth, { missing: installHealth.missing.slice() }); },
    get isOpen() { return !$('#quranReader').classList.contains('hidden'); },
    backToIndex
  };
})();
