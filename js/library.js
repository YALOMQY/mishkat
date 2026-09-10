/* ═══════════ مكتبة مشكاة: الفهرس، الحزم المحلية، البحث والمفضلة ═══════════ */
(function (scope, factory) {
  const api = factory();
  scope.Library = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'mishkat.library.v1';
  const CATALOG_URL = 'data/library-catalog.json';
  const SCHEMA_VERSION = 1;

  let catalog = null;
  let rootElement = null;
  let currentBookId = null;
  let currentQuery = '';
  let currentCategory = 'all';
  let currentSort = 'title';
  let loadError = null;
  let loading = false;
  let options = {};
  let storage = createDefaultStorage();
  let saved = loadSavedState();
  const runtimeStatus = Object.create(null);
  const downloadControllers = Object.create(null);
  const boundRoots = typeof WeakSet === 'function' ? new WeakSet() : null;

  function createDefaultStorage() {
    const memory = Object.create(null);
    return {
      get(key) {
        try {
          if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
        } catch (_) {}
        return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
      },
      set(key, value) {
        if (typeof localStorage !== 'undefined') {
          try { localStorage.setItem(key, value); return; }
          catch (_) { throw new Error('مساحة التخزين غير كافية لحفظ الكتاب'); }
        }
        memory[key] = value;
      },
      remove(key) {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(key);
            return;
          }
        } catch (_) {}
        delete memory[key];
      }
    };
  }

  function normalizeStorage(candidate) {
    if (!candidate) return createDefaultStorage();
    if (typeof candidate.get !== 'function' || typeof candidate.set !== 'function') {
      throw new TypeError('يجب أن يوفّر مخزن المكتبة الدالتين get و set');
    }
    return candidate;
  }

  function emptySavedState() {
    return { schemaVersion: SCHEMA_VERSION, installed: {}, favorites: [], history: [] };
  }

  function loadSavedState() {
    try {
      const raw = storage.get(STORAGE_KEY);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) return emptySavedState();
      return {
        schemaVersion: SCHEMA_VERSION,
        installed: parsed.installed && typeof parsed.installed === 'object' ? parsed.installed : {},
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter(v => typeof v === 'string') : [],
        history: Array.isArray(parsed.history) ? parsed.history.filter(item => item && typeof item.bookId === 'string').slice(0, 30) : []
      };
    } catch (_) {
      return emptySavedState();
    }
  }

  function persist() {
    storage.set(STORAGE_KEY, JSON.stringify(saved));
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function isHttpsUrl(value) {
    return typeof value === 'string' && /^https:\/\//i.test(value);
  }

  function validateCatalog(input) {
    assert(input && typeof input === 'object', 'ملف فهرس المكتبة غير صالح');
    assert(input.schemaVersion === SCHEMA_VERSION, 'إصدار فهرس المكتبة غير مدعوم');
    assert(Array.isArray(input.books) && input.books.length > 0, 'فهرس المكتبة لا يحتوي كتبًا');
    const ids = new Set();
    input.books.forEach((book, index) => {
      const at = `الكتاب رقم ${index + 1}`;
      assert(book && typeof book === 'object', `${at} غير صالح`);
      assert(/^[a-z0-9][a-z0-9._-]*$/i.test(book.id || ''), `${at}: المعرّف غير صالح`);
      assert(!ids.has(book.id), `${at}: المعرّف مكرر`);
      assert(typeof book.title === 'string' && book.title.trim(), `${at}: العنوان مفقود`);
      assert(typeof book.author === 'string' && book.author.trim(), `${at}: المؤلف مفقود`);
      assert(book.availability === 'sample', `${at}: لا يُعرض كتاب قبل إرفاق حزمة محتوى موثقة`);
      assert(typeof book.contentPath === 'string' && book.contentPath.trim(), `${at}: مسار الحزمة مفقود`);
      assert(Number.isInteger(book.availableItems) && book.availableItems > 0, `${at}: عدد العناصر المتاحة غير صالح`);
      if (book.contentBytes != null) assert(Number.isInteger(book.contentBytes) && book.contentBytes > 0, `${at}: حجم الحزمة غير صالح`);
      if (book.contentSha256) assert(/^[a-f0-9]{64}$/i.test(book.contentSha256), `${at}: بصمة الحزمة غير صالحة`);
      if (book.sourceUrl) assert(isHttpsUrl(book.sourceUrl), `${at}: رابط المصدر يجب أن يكون HTTPS`);
      ids.add(book.id);
    });
    return input;
  }

  function validateContentPack(input, expectedBookId) {
    assert(input && typeof input === 'object', 'حزمة المحتوى غير صالحة');
    assert(input.schemaVersion === SCHEMA_VERSION, 'إصدار حزمة المحتوى غير مدعوم');
    assert(/^[a-z0-9][a-z0-9._-]*$/i.test(input.bookId || ''), 'معرّف الكتاب في الحزمة غير صالح');
    if (expectedBookId) assert(input.bookId === expectedBookId, 'حزمة المحتوى لا تخص الكتاب المطلوب');
    assert(typeof input.contentVersion === 'string' && input.contentVersion.trim(), 'إصدار المحتوى مفقود');
    assert(input.completeness && ['sample', 'complete'].includes(input.completeness.kind), 'حالة اكتمال الحزمة غير صالحة');
    assert(Number.isInteger(input.completeness.availableItems) && input.completeness.availableItems >= 0, 'عدد محتويات الحزمة غير صالح');
    assert(Number.isInteger(input.completeness.expectedItems) && input.completeness.expectedItems >= input.completeness.availableItems, 'العدد المتوقع للحزمة غير صالح');
    assert(Array.isArray(input.sources) && input.sources.length > 0, 'مصدر الحزمة مفقود');
    input.sources.forEach((source, index) => {
      assert(source && typeof source.name === 'string' && source.name.trim(), `اسم المصدر رقم ${index + 1} مفقود`);
      assert(isHttpsUrl(source.url), `رابط المصدر رقم ${index + 1} يجب أن يكون HTTPS`);
    });
    assert(Array.isArray(input.entries), 'قائمة محتويات الحزمة غير صالحة');
    assert(input.entries.length === input.completeness.availableItems, 'عدد السجلات لا يطابق وصف الحزمة');

    const ids = new Set();
    const numbers = new Set();
    input.entries.forEach((entry, index) => {
      const at = `السجل رقم ${index + 1}`;
      assert(entry && typeof entry === 'object', `${at} غير صالح`);
      assert(typeof entry.id === 'string' && entry.id.trim(), `${at}: المعرّف مفقود`);
      assert(!ids.has(entry.id), `${at}: المعرّف مكرر`);
      assert(Number.isInteger(entry.number) && entry.number > 0, `${at}: رقم الحديث غير صالح`);
      assert(!numbers.has(entry.number), `${at}: رقم الحديث مكرر`);
      assert(typeof entry.title === 'string' && entry.title.trim(), `${at}: العنوان مفقود`);
      assert(typeof entry.chapter === 'string' && entry.chapter.trim(), `${at}: الباب مفقود`);
      assert(typeof entry.text === 'string' && entry.text.trim().length >= 20, `${at}: النص مفقود أو قصير بصورة غير آمنة`);
      assert(typeof entry.reference === 'string' && entry.reference.trim(), `${at}: التخريج مفقود`);
      assert(isHttpsUrl(entry.sourceUrl), `${at}: رابط التحقق يجب أن يكون HTTPS`);
      ids.add(entry.id);
      numbers.add(entry.number);
    });
    return input;
  }

  function normalizeArabic(value) {
    return String(value == null ? '' : value)
      .normalize('NFKD')
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
      .replace(/ـ/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function bookById(bookId) {
    return catalog && catalog.books.find(book => book.id === bookId) || null;
  }

  function installedPack(bookId) {
    const record = saved.installed[bookId];
    if (!record || !record.pack) return null;
    try {
      return validateContentPack(record.pack, bookId);
    } catch (_) {
      return null;
    }
  }

  function contentStatus(bookId) {
    if (runtimeStatus[bookId]) return Object.assign({}, runtimeStatus[bookId]);
    const book = bookById(bookId);
    if (!book) return { state: 'missing', label: 'غير موجود' };
    const pack = installedPack(bookId);
    if (pack) {
      return {
        state: 'installed',
        label: pack.completeness.kind === 'complete' ? 'محمّل كاملًا' : `عيّنة محلية · ${latinDigits(pack.entries.length)} أحاديث`,
        contentVersion: pack.contentVersion,
        completeness: pack.completeness
      };
    }
    if (book.availability === 'sample') return { state: 'available', label: `متاح للتنزيل · عيّنة ${latinDigits(book.availableItems)} · ${formatBytes(book.contentBytes || 0)}` };
    return { state: 'missing', label: 'غير متاح' };
  }

  function listBooks() {
    return catalog ? catalog.books.map(book => Object.assign({}, book, { status: contentStatus(book.id) })) : [];
  }

  async function readJson(url) {
    const loader = options.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!loader) throw new Error('لا تتوفر وسيلة لتحميل البيانات المحلية');
    const response = await loader(url);
    if (!response || response.ok === false) throw new Error(`تعذّر تحميل ${url}`);
    return typeof response.json === 'function' ? response.json() : response;
  }

  async function readDownloadPayload(book, signal, onProgress) {
    const loader = options.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!loader) throw new Error('لا تتوفر وسيلة لتحميل المحتوى');
    const response = await loader(book.contentPath, { signal, cache: 'no-store' });
    if (!response || response.ok === false) throw new Error(`فشل التنزيل (HTTP ${response && response.status || 0})`);
    if (!response.body || typeof response.body.getReader !== 'function') {
      const text = typeof response.text === 'function' ? await response.text() : JSON.stringify(await response.json());
      const bytes = new TextEncoder().encode(text).byteLength;
      onProgress(bytes, Number(response.headers && response.headers.get && response.headers.get('Content-Length')) || book.contentBytes || bytes);
      return { text, bytes };
    }
    const total = Number(response.headers.get('Content-Length')) || book.contentBytes || 0;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '', bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      text += decoder.decode(chunk.value, { stream: true });
      onProgress(bytes, total);
    }
    text += decoder.decode();
    return { text, bytes };
  }

  async function sha256(text) {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function assertStorageAvailable(requiredBytes) {
    if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) return;
    const estimate = await navigator.storage.estimate();
    const free = Number(estimate.quota || 0) - Number(estimate.usage || 0);
    if (free > 0 && free < requiredBytes * 2) throw new Error(`المساحة المتاحة ${formatBytes(free)} لا تكفي لتنزيل الحزمة`);
  }

  async function init(initOptions) {
    options = Object.assign({}, options, initOptions || {});
    if (initOptions && initOptions.storage) {
      storage = normalizeStorage(initOptions.storage);
      saved = loadSavedState();
    }
    if (initOptions && initOptions.root) rootElement = resolveRoot(initOptions.root);
    loading = true;
    loadError = null;
    render();
    try {
      const source = options.catalog || await readJson(options.catalogUrl || CATALOG_URL);
      catalog = validateCatalog(source);
      Object.keys(saved.installed).forEach(bookId => {
        if (!bookById(bookId) || !installedPack(bookId)) delete saved.installed[bookId];
      });
      saved.favorites = saved.favorites.filter(id => typeof id === 'string' && id.includes(':'));
      saved.history = saved.history.filter(item => bookById(item.bookId));
      persist();
      loading = false;
      render();
      emitChange('ready');
      return api;
    } catch (error) {
      loading = false;
      loadError = friendlyError(error, 'تعذّر فتح المكتبة');
      render();
      emitChange('error', { error: loadError });
      throw error;
    }
  }

  async function download(bookId) {
    const book = bookById(bookId);
    if (!book) throw new Error('الكتاب غير موجود في الفهرس');
    if (book.availability !== 'sample' || !book.contentPath) throw new Error('محتوى هذا الكتاب غير متاح للتنزيل بعد');
    if (downloadControllers[bookId]) downloadControllers[bookId].abort();
    runtimeStatus[bookId] = { state: 'queued', label: 'في قائمة التنزيل…', progress: 0 };
    render();
    await Promise.resolve();
    const controller = typeof AbortController === 'function' ? new AbortController() : { signal: undefined, abort() {} };
    downloadControllers[bookId] = controller;
    try {
      if (/^https:/i.test(book.contentPath) && typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('لا يوجد اتصال بالإنترنت');
      await assertStorageAvailable(book.contentBytes || 1024 * 100);
      runtimeStatus[bookId] = { state: 'downloading', label: 'بدء التنزيل…', progress: 0 };
      render();
      const payload = await readDownloadPayload(book, controller.signal, (loaded, total) => {
        const progress = total > 0 ? Math.min(99, Math.round(loaded / total * 100)) : null;
        runtimeStatus[bookId] = {
          state: 'downloading', progress, loaded, total,
          label: progress == null ? `تم تنزيل ${formatBytes(loaded)}` : `جارٍ التنزيل… ${progress}%`
        };
        render();
      });
      assert(payload.bytes > 0 && payload.text.trim(), 'الحزمة التي تم تنزيلها فارغة');
      if (book.contentBytes) assert(payload.bytes === book.contentBytes, 'حجم الحزمة لا يطابق الفهرس الموثوق');
      if (book.contentSha256) {
        const digest = await sha256(payload.text);
        if (digest) assert(digest === book.contentSha256, 'فشل التحقق من سلامة الحزمة');
      }
      let parsed;
      try { parsed = JSON.parse(payload.text); } catch (_) { throw new Error('صيغة الحزمة غير صالحة'); }
      const pack = validateContentPack(parsed, bookId);
      const previous = saved.installed[bookId];
      saved.installed[bookId] = { installedAt: new Date().toISOString(), pack };
      try { persist(); }
      catch (error) {
        if (previous) saved.installed[bookId] = previous; else delete saved.installed[bookId];
        throw error;
      }
      delete runtimeStatus[bookId];
      delete downloadControllers[bookId];
      render();
      emitChange('download', { bookId, status: contentStatus(bookId) });
      notify('تم تنزيل المحتوى المحلي والتحقق منه');
      return pack;
    } catch (error) {
      delete downloadControllers[bookId];
      if (error && error.name === 'AbortError') {
        runtimeStatus[bookId] = { state: 'paused', label: 'التنزيل متوقف — يمكن استئنافه بأمان', progress: runtimeStatus[bookId] && runtimeStatus[bookId].progress || 0 };
        render();
        emitChange('pause-download', { bookId });
        return null;
      }
      runtimeStatus[bookId] = { state: 'error', label: friendlyError(error, 'تعذّر تنزيل المحتوى'), progress: 0 };
      render();
      emitChange('error', { bookId, error: runtimeStatus[bookId].label });
      throw error;
    }
  }

  function pauseDownload(bookId) {
    const controller = downloadControllers[bookId];
    if (!controller) return false;
    controller.abort();
    return true;
  }

  function removeDownload(bookId) {
    if (!saved.installed[bookId]) return false;
    delete saved.installed[bookId];
    delete runtimeStatus[bookId];
    saved.favorites = saved.favorites.filter(id => !id.startsWith(`${bookId}:`));
    persist();
    render();
    emitChange('remove-download', { bookId });
    return true;
  }

  function search(query, searchOptions) {
    const normalized = normalizeArabic(query);
    const selectedBookId = searchOptions && searchOptions.bookId;
    const words = searchTokens(normalized);
    const matches = text => {
      const haystack = normalizeArabic(text);
      if (words.length === 0) return true;
      if (` ${haystack} `.includes(` ${normalized} `)) return true;
      const tokens = searchTokens(haystack);
      return words.every(word => tokens.some(token => token === word || (word.length >= 4 && token.startsWith(word))));
    };
    const books = (catalog ? catalog.books : [])
      .filter(book => !selectedBookId || book.id === selectedBookId)
      .filter(book => matches([book.title, book.author, book.description, book.category].join(' ')));
    const entries = [];
    Object.keys(saved.installed).forEach(bookId => {
      if (selectedBookId && selectedBookId !== bookId) return;
      const pack = installedPack(bookId);
      const book = bookById(bookId);
      if (!pack || !book) return;
      pack.entries.forEach(entry => {
        if (matches([entry.title, entry.chapter, entry.narrator, entry.text, entry.reference].join(' '))) {
          entries.push(Object.assign({}, entry, { bookId, bookTitle: book.title, favorite: isFavorite(bookId, entry.id) }));
        }
      });
    });
    return { query: String(query || ''), normalized, books, entries };
  }

  function searchTokens(normalizedText) {
    return String(normalizedText || '').split(' ').filter(Boolean).map(token => {
      let value = token;
      if (/^[وبفكل]/.test(value) && value.length > 4) value = value.slice(1);
      if (value.startsWith('ال') && value.length > 4) value = value.slice(2);
      return value;
    });
  }

  function favoriteKey(bookId, entryId) {
    return `${bookId}:${entryId}`;
  }

  function isFavorite(bookId, entryId) {
    return saved.favorites.includes(favoriteKey(bookId, entryId));
  }

  function toggleFavorite(bookId, entryId, force) {
    const pack = installedPack(bookId);
    assert(pack && pack.entries.some(entry => entry.id === entryId), 'لا يمكن حفظ عنصر غير موجود');
    const key = favoriteKey(bookId, entryId);
    const has = saved.favorites.includes(key);
    const next = typeof force === 'boolean' ? force : !has;
    saved.favorites = next
      ? Array.from(new Set(saved.favorites.concat(key)))
      : saved.favorites.filter(value => value !== key);
    persist();
    render();
    emitChange('favorite', { bookId, entryId, favorite: next });
    return next;
  }

  function favorites() {
    return saved.favorites.map(key => {
      const separator = key.indexOf(':');
      const bookId = key.slice(0, separator);
      const entryId = key.slice(separator + 1);
      const pack = installedPack(bookId);
      const entry = pack && pack.entries.find(item => item.id === entryId);
      const book = bookById(bookId);
      return entry && book ? Object.assign({}, entry, { bookId, bookTitle: book.title, favorite: true }) : null;
    }).filter(Boolean);
  }

  async function share(bookId, entryId) {
    const pack = installedPack(bookId);
    const book = bookById(bookId);
    const entry = pack && pack.entries.find(item => item.id === entryId);
    assert(book && entry, 'تعذّر العثور على الحديث للمشاركة');
    const text = `${entry.title}\n\n${entry.text}\n\n${entry.reference} — ${book.title}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: entry.title, text });
      return true;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      notify('تم نسخ الحديث للمشاركة');
      return true;
    }
    return false;
  }

  function open(bookId, target) {
    if (!bookById(bookId)) throw new Error('الكتاب غير موجود في الفهرس');
    if (target) rootElement = resolveRoot(target);
    currentBookId = bookId;
    currentQuery = '';
    saved.history = [{ bookId, at: new Date().toISOString() }].concat(saved.history.filter(item => item.bookId !== bookId)).slice(0, 30);
    try { persist(); } catch (_) {}
    return render();
  }

  function close() {
    currentBookId = null;
    currentQuery = '';
    return render();
  }

  function setQuery(query) {
    currentQuery = String(query || '');
    return render();
  }

  function resolveRoot(target) {
    if (!target) return null;
    if (typeof target === 'string') {
      if (typeof document === 'undefined') return null;
      return document.querySelector(target);
    }
    return target;
  }

  function render(target) {
    if (target) rootElement = resolveRoot(target);
    const markup = renderMarkup();
    if (rootElement) {
      rootElement.innerHTML = markup;
      bindRoot(rootElement);
    }
    return markup;
  }

  function renderMarkup() {
    if (loading) return stateMarkup('جارٍ فتح المكتبة…', 'يتم تحميل الفهرس المحلي والتحقق منه.');
    if (loadError) return stateMarkup('تعذّر فتح المكتبة', loadError, '<button type="button" data-library-action="retry">إعادة المحاولة</button>');
    if (!catalog) return stateMarkup('المكتبة غير مهيأة', 'استدعِ Library.init() قبل عرض المحتوى.');
    return currentBookId ? renderBookMarkup(currentBookId) : renderCatalogMarkup();
  }

  function renderCatalogMarkup() {
    const result = search(currentQuery);
    const categories = Array.from(new Set(catalog.books.map(book => book.category).filter(Boolean)));
    let books = result.books.slice();
    let entries = currentQuery.trim() ? result.entries.slice() : [];
    if (currentCategory === 'favorites') {
      entries = favorites().filter(entry => !currentQuery.trim() || search(currentQuery, { bookId: entry.bookId }).entries.some(item => item.id === entry.id));
      books = [];
    } else if (currentCategory === 'history') {
      const order = new Map(saved.history.map((item, index) => [item.bookId, index]));
      books = books.filter(book => order.has(book.id)).sort((a, b) => order.get(a.id) - order.get(b.id));
      entries = [];
    } else if (currentCategory !== 'all') books = books.filter(book => book.category === currentCategory);
    if (currentCategory !== 'history') {
      books.sort((a, b) => currentSort === 'author'
        ? a.author.localeCompare(b.author, 'ar')
        : currentSort === 'installed'
          ? Number(Boolean(installedPack(b.id))) - Number(Boolean(installedPack(a.id)))
          : a.title.localeCompare(b.title, 'ar'));
    }
    const noResults = !books.length && !entries.length;
    return `<section class="library-module" dir="rtl" aria-label="المكتبة الإسلامية">
      <header class="library-module__header">
        <div><h2>رفّ القراءة</h2></div>
        <span>${catalog.books.length === 1 ? 'عنوان واحد · عيّنة مرفقة' : `${latinDigits(catalog.books.length)} عناوين متاحة`}</span>
      </header>
      <label class="library-search"><span>البحث</span><input type="search" value="${escapeAttr(currentQuery)}" data-library-search placeholder="ابحث في العنوان أو الباب أو نص الحديث" autocomplete="off"></label>
      <div class="library-controls">
        <div class="library-filters" role="group" aria-label="تصنيف المكتبة">
          ${[['all', 'الكل'], ...categories.map(value => [value, value]), ['favorites', 'المفضلة'], ['history', 'السجل']].map(item => `<button type="button" data-library-action="category" data-category="${escapeAttr(item[0])}" aria-pressed="${currentCategory === item[0]}">${escapeHtml(item[1])}</button>`).join('')}
        </div>
        <label>الترتيب<select data-library-sort><option value="title"${currentSort === 'title' ? ' selected' : ''}>العنوان</option><option value="author"${currentSort === 'author' ? ' selected' : ''}>المؤلف</option><option value="installed"${currentSort === 'installed' ? ' selected' : ''}>المحمّل أولًا</option></select></label>
      </div>
      ${noResults ? stateMarkup(currentCategory === 'favorites' ? 'لا توجد مفضلة' : currentCategory === 'history' ? 'لا يوجد سجل قراءة' : 'لا توجد نتائج', currentQuery ? `لم نجد نتيجة لعبارة «${escapeHtml(currentQuery)}».` : 'ستظهر العناصر هنا عند توفرها.') : ''}
      ${entries.length ? `<div class="library-results"><h3>${currentCategory === 'favorites' ? 'المفضلة' : 'نتائج داخل المحتوى المحلي'}</h3>${entries.map(renderEntryMarkup).join('')}</div>` : ''}
      ${books.length ? `<div class="library-books">${books.map(renderBookRow).join('')}</div>` : ''}
      ${catalog.notice ? `<details class="disclosure library-sources"><summary>عن المحتوى والمصادر</summary><p class="library-notice">${escapeHtml(catalog.notice)}</p></details>` : ''}
    </section>`;
  }

  function renderBookRow(book) {
    const status = contentStatus(book.id);
    const action = status.state === 'available'
      ? `<button type="button" data-library-action="download" data-book-id="${escapeAttr(book.id)}">تنزيل العيّنة</button>`
      : ['queued', 'downloading'].includes(status.state)
        ? `<button type="button" data-library-action="pause-download" data-book-id="${escapeAttr(book.id)}">إيقاف مؤقت</button>`
        : status.state === 'paused'
          ? `<button type="button" data-library-action="download" data-book-id="${escapeAttr(book.id)}">استئناف</button>`
        : status.state === 'error'
          ? `<button type="button" data-library-action="download" data-book-id="${escapeAttr(book.id)}">إعادة المحاولة</button>`
          : status.state === 'installed'
            ? `<button type="button" data-library-action="open" data-book-id="${escapeAttr(book.id)}">فتح</button>`
            : '<button type="button" disabled>غير متاح بعد</button>';
    return `<article class="library-book" data-content-state="${status.state}">
      <button class="library-book__body" type="button" data-library-action="open" data-book-id="${escapeAttr(book.id)}">
        <small>${escapeHtml(book.category || 'كتب الحديث')}</small>
        <h3>${escapeHtml(book.title)}</h3>
        <p>${escapeHtml(book.author)}</p>
        <span>${escapeHtml(status.label)}</span>${status.progress != null ? `<span class="library-download-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${status.progress}"><i style="width:${status.progress}%"></i></span>` : ''}
      </button>
      <div class="library-book__action">${action}</div>
    </article>`;
  }

  function renderBookMarkup(bookId) {
    const book = bookById(bookId);
    const status = contentStatus(bookId);
    const pack = installedPack(bookId);
    const result = pack ? search(currentQuery, { bookId }) : { entries: [] };
    let content;
    if (status.state === 'installed') {
      content = `<p class="library-completeness">${escapeHtml(pack.completeness.label)}</p>
        <label class="library-search"><span>بحث داخل الكتاب</span><input type="search" value="${escapeAttr(currentQuery)}" data-library-search placeholder="العنوان أو الباب أو النص" autocomplete="off"></label>
        ${result.entries.length ? `<div class="library-entries">${result.entries.map(renderEntryMarkup).join('')}</div>` : stateMarkup('لا توجد نتائج', currentQuery ? `لا يوجد تطابق لعبارة «${escapeHtml(currentQuery)}».` : 'لا تحتوي الحزمة سجلات قابلة للعرض.')}
        <button type="button" data-library-action="remove" data-book-id="${escapeAttr(bookId)}">حذف المحتوى المحلي</button>`;
    } else if (status.state === 'available' || status.state === 'error' || status.state === 'paused') {
      content = stateMarkup(
        status.state === 'error' ? 'تعذّر تنزيل المحتوى' : status.state === 'paused' ? 'التنزيل متوقف' : 'عيّنة موثقة متاحة محليًا',
        status.state === 'error' || status.state === 'paused' ? status.label : `هذه عيّنة من ${latinDigits(book.availableItems)} أحاديث فقط، وليست الكتاب كاملًا.`,
        `<button type="button" data-library-action="download" data-book-id="${escapeAttr(bookId)}">${status.state === 'error' ? 'إعادة المحاولة' : status.state === 'paused' ? 'استئناف التنزيل' : 'تنزيل والتحقق'}</button>`
      );
    } else if (status.state === 'downloading' || status.state === 'queued') {
      content = stateMarkup('جارٍ تنزيل الحزمة…', status.label,
        `<div class="library-download-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${status.progress || 0}"><i style="width:${status.progress || 0}%"></i></div><button type="button" data-library-action="pause-download" data-book-id="${escapeAttr(bookId)}">إيقاف مؤقت</button>`);
    } else {
      content = stateMarkup('تعذّر فتح الكتاب', 'لا تتوفر حزمة محتوى موثقة لهذا الكتاب.');
    }
    return `<section class="library-module library-module--book" dir="rtl" aria-label="${escapeAttr(book.title)}">
      <header class="library-book-header">
        <button type="button" data-library-action="back" aria-label="العودة إلى فهرس المكتبة">رجوع</button>
        <div><small>${escapeHtml(book.category || 'كتب الحديث')}</small><h2>${escapeHtml(book.title)}</h2><p>${escapeHtml(book.author)}</p></div>
      </header>
      ${book.description ? `<p>${escapeHtml(book.description)}</p>` : ''}
      ${book.sourceUrl || book.sourceName ? `<p class="library-source">المصدر: ${book.sourceUrl ? `<a href="${escapeAttr(book.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(book.sourceName || 'رابط التحقق')}</a>` : escapeHtml(book.sourceName)}</p>` : ''}
      ${content}
    </section>`;
  }

  function renderEntryMarkup(entry) {
    return `<article class="library-entry" data-entry-id="${escapeAttr(entry.id)}">
      <header><div><small>${escapeHtml(entry.bookTitle || '')}${entry.chapter ? ` · ${escapeHtml(entry.chapter)}` : ''}</small><h3>${escapeHtml(entry.title)}</h3></div><span>${latinDigits(entry.number)}</span></header>
      <p>${escapeHtml(entry.text)}</p>
      <footer><small>${escapeHtml(entry.reference)}</small><div>
        <button type="button" data-library-action="favorite" data-book-id="${escapeAttr(entry.bookId)}" data-entry-id="${escapeAttr(entry.id)}" aria-pressed="${entry.favorite ? 'true' : 'false'}">${entry.favorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}</button>
        <button type="button" data-library-action="share" data-book-id="${escapeAttr(entry.bookId)}" data-entry-id="${escapeAttr(entry.id)}">مشاركة</button>
      </div></footer>
    </article>`;
  }

  function stateMarkup(title, message, action) {
    return `<div class="library-state" role="status"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message || '')}</p>${action || ''}</div>`;
  }

  function bindRoot(root) {
    if (boundRoots && boundRoots.has(root)) return;
    if (boundRoots) boundRoots.add(root);
    root.addEventListener('input', event => {
      if (!event.target.matches('[data-library-search]')) return;
      currentQuery = event.target.value;
      const position = typeof event.target.selectionStart === 'number' ? event.target.selectionStart : currentQuery.length;
      render();
      const next = root.querySelector('[data-library-search]');
      if (next) {
        next.focus();
        try { next.setSelectionRange(position, position); } catch (_) {}
      }
    });
    root.addEventListener('change', event => {
      if (!event.target.matches('[data-library-sort]')) return;
      currentSort = event.target.value;
      render();
    });
    root.addEventListener('click', async event => {
      const button = event.target.closest('[data-library-action]');
      if (!button) return;
      const action = button.dataset.libraryAction;
      const bookId = button.dataset.bookId;
      const entryId = button.dataset.entryId;
      try {
        if (action === 'open') open(bookId);
        if (action === 'back') close();
        if (action === 'download') await download(bookId);
        if (action === 'pause-download') pauseDownload(bookId);
        if (action === 'category') { currentCategory = button.dataset.category || 'all'; render(); }
        if (action === 'remove') {
          const approved = typeof window === 'undefined' || typeof window.confirm !== 'function' || window.confirm('حذف النسخة المحفوظة من هذا الكتاب؟ يمكنك تنزيلها مرة أخرى.');
          if (approved) { removeDownload(bookId); notify('تم حذف المحتوى المحلي'); }
        }
        if (action === 'favorite') toggleFavorite(bookId, entryId);
        if (action === 'share') await share(bookId, entryId);
        if (action === 'retry') await init(options);
      } catch (error) {
        notify(friendlyError(error, 'تعذّر إكمال العملية'));
      }
    });
  }

  function emitChange(type, detail) {
    if (typeof options.onChange === 'function') options.onChange(Object.assign({ type, state: getState() }, detail || {}));
  }

  function notify(message) {
    if (typeof options.notify === 'function') options.notify(message);
    else if (typeof globalThis.toast === 'function') globalThis.toast(message);
  }

  function friendlyError(error, fallback) {
    return error && typeof error.message === 'string' && error.message.trim() ? error.message : fallback;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function latinDigits(value) {
    const arabic = '٠١٢٣٤٥٦٧٨٩', eastern = '۰۱۲۳۴۵۶۷۸۹';
    return String(value)
      .replace(/[٠-٩]/g, digit => String(arabic.indexOf(digit)))
      .replace(/[۰-۹]/g, digit => String(eastern.indexOf(digit)));
  }

  function formatBytes(value) {
    const bytes = Number(value) || 0;
    if (bytes <= 0) return 'حجم صغير';
    if (bytes < 1024) return `${latinDigits(bytes)} بايت`;
    if (bytes < 1024 * 1024) return `${latinDigits((bytes / 1024).toFixed(bytes < 10240 ? 1 : 0))} ك.ب`;
    return `${latinDigits((bytes / 1024 / 1024).toFixed(1))} م.ب`;
  }

  function getState() {
    return {
      ready: Boolean(catalog),
      loading,
      error: loadError,
      currentBookId,
      query: currentQuery,
      category: currentCategory,
      sort: currentSort,
      books: listBooks(),
      favorites: favorites(),
      history: saved.history.slice()
    };
  }

  function resetForTests() {
    catalog = null;
    rootElement = null;
    currentBookId = null;
    currentQuery = '';
    currentCategory = 'all';
    currentSort = 'title';
    loadError = null;
    loading = false;
    options = {};
    storage = createDefaultStorage();
    saved = loadSavedState();
    Object.keys(runtimeStatus).forEach(key => delete runtimeStatus[key]);
    Object.keys(downloadControllers).forEach(key => { downloadControllers[key].abort(); delete downloadControllers[key]; });
  }

  const api = {
    init,
    render,
    open,
    close,
    download,
    pauseDownload,
    removeDownload,
    search,
    setQuery,
    toggleFavorite,
    isFavorite,
    favorites,
    share,
    getBook: bookById,
    getCatalog: () => catalog,
    getStatus: contentStatus,
    getState,
    normalizeArabic,
    validateCatalog,
    validateContentPack,
    _resetForTests: resetForTests
  };

  return api;
});
