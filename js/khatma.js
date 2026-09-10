/* ═══════════ ختمات مشكاة: الخطة، التقدّم والتذكير المحلي ═══════════ */
(function (scope, factory) {
  const api = factory();
  scope.Khatma = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'mishkat.khatma.v1';
  const SCHEMA_VERSION = 1;
  const TOTAL_PAGES = 604;
  const FIXED_DURATIONS = Object.freeze([7, 15, 30, 60, 90]);
  const PRAYERS = Object.freeze(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
  const PRAYER_NAMES = Object.freeze({ fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' });

  let storage = createDefaultStorage();
  let state = loadState();
  let rootElement = null;
  let currentPlanId = null;
  let options = {};
  // Session-only recovery for a progress entry; persisted plans keep their schema.
  let progressUndo = null;
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
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value);
            return;
          }
        } catch (_) {}
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
      throw new TypeError('يجب أن يوفّر مخزن الختمة الدالتين get و set');
    }
    return candidate;
  }

  function emptyState() {
    return { schemaVersion: SCHEMA_VERSION, activeId: null, plans: [] };
  }

  function loadState() {
    try {
      const raw = storage.get(STORAGE_KEY);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.plans)) return emptyState();
      const plans = parsed.plans.map(validateStoredPlan).filter(Boolean);
      const activeId = plans.some(plan => plan.id === parsed.activeId) ? parsed.activeId : (plans[0] && plans[0].id || null);
      return { schemaVersion: SCHEMA_VERSION, activeId, plans };
    } catch (_) {
      return emptyState();
    }
  }

  function validateStoredPlan(plan) {
    try {
      if (!plan || typeof plan !== 'object') return null;
      if (typeof plan.id !== 'string' || !plan.id) return null;
      const duration = normalizeDuration(plan.duration);
      const startPage = clampInteger(plan.startPage || 1, 1, TOTAL_PAGES);
      const progressPage = clampInteger(plan.progressPage == null ? startPage - 1 : plan.progressPage, startPage - 1, TOTAL_PAGES);
      return {
        id: plan.id,
        name: normalizeName(plan.name),
        duration,
        dailyPages: duration === 'continuous' ? clampInteger(plan.dailyPages || 1, 1, TOTAL_PAGES) : calculateDailyTarget(duration, TOTAL_PAGES - startPage + 1),
        startDate: normalizeDateKey(plan.startDate || todayKey()),
        startPage,
        startPoint: normalizeStartPoint(plan.startPoint, startPage),
        progressPage,
        status: progressPage >= TOTAL_PAGES ? 'completed' : (plan.status === 'paused' ? 'paused' : 'active'),
        reminder: normalizeReminder(plan.reminder),
        pausedAt: plan.status === 'paused' && plan.pausedAt ? normalizeDateKey(plan.pausedAt) : null,
        pausedDays: clampInteger(plan.pausedDays || 0, 0, 100000),
        createdAt: validIsoDateTime(plan.createdAt) ? plan.createdAt : new Date().toISOString(),
        updatedAt: validIsoDateTime(plan.updatedAt) ? plan.updatedAt : new Date().toISOString(),
        completedAt: progressPage >= TOTAL_PAGES && validIsoDateTime(plan.completedAt) ? plan.completedAt : null,
        rebalancedAt: validIsoDateTime(plan.rebalancedAt) ? plan.rebalancedAt : null,
        history: normalizeHistory(plan.history)
      };
    } catch (_) {
      return null;
    }
  }

  function persist() {
    storage.set(STORAGE_KEY, JSON.stringify(state));
  }

  function init(initOptions) {
    options = Object.assign({}, options, initOptions || {});
    if (initOptions && initOptions.storage) {
      storage = normalizeStorage(initOptions.storage);
      state = loadState();
    }
    if (initOptions && initOptions.root) rootElement = resolveRoot(initOptions.root);
    if (initOptions && initOptions.activeId && getPlan(initOptions.activeId)) currentPlanId = initOptions.activeId;
    render();
    return api;
  }

  function normalizeDuration(value) {
    if (value === 'continuous' || value === null || value === Infinity) return 'continuous';
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > 3650) throw new RangeError('مدة الختمة يجب أن تكون بين 1 و3650 يومًا، أو مستمرة');
    return number;
  }

  function normalizeStartPoint(value, fallbackPage) {
    const point = value && typeof value === 'object' ? value : {};
    const allowed = ['page', 'surah', 'juz', 'hizb', 'ayah'];
    return {
      kind: allowed.includes(point.kind) ? point.kind : 'page',
      value: clampInteger(point.value || fallbackPage || 1, 1, 6236),
      s: clampInteger(point.s || 1, 1, 114),
      a: clampInteger(point.a || 1, 1, 286),
      page: clampInteger(point.page || fallbackPage || 1, 1, TOTAL_PAGES)
    };
  }

  function normalizeName(value) {
    const name = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (!name) throw new Error('اكتب اسمًا للختمة');
    if (name.length > 80) throw new Error('اسم الختمة أطول من 80 حرفًا');
    return name;
  }

  function normalizeReminder(value) {
    if (!value || value.type === 'none') return { type: 'none' };
    if (value.type === 'prayer') {
      if (!PRAYERS.includes(value.prayer)) throw new Error('الصلاة المحددة للتذكير غير صالحة');
      return {
        type: 'prayer',
        prayer: value.prayer,
        offsetMinutes: clampInteger(value.offsetMinutes || 0, -180, 180)
      };
    }
    if (value.type === 'time') {
      const time = String(value.time || '');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('وقت التذكير يجب أن يكون بصيغة 24 ساعة مثل 20:30');
      return { type: 'time', time };
    }
    throw new Error('نوع التذكير غير معروف');
  }

  function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];
    return history.filter(item => item && validIsoDateTime(item.at) && Number.isInteger(item.page) && item.page >= 0 && item.page <= TOTAL_PAGES)
      .slice(-365)
      .map(item => ({ at: item.at, page: item.page }));
  }

  function calculateDailyTarget(duration, totalPages) {
    const normalized = normalizeDuration(duration);
    const total = clampInteger(totalPages == null ? TOTAL_PAGES : totalPages, 1, 100000);
    return normalized === 'continuous' ? 1 : Math.ceil(total / normalized);
  }

  function create(input) {
    const data = input || {};
    const duration = normalizeDuration(data.duration == null ? 30 : data.duration);
    const startPage = clampInteger(data.startPage || data.startPoint && data.startPoint.page || 1, 1, TOTAL_PAGES);
    const progressPage = clampInteger(data.progressPage == null ? startPage - 1 : data.progressPage, startPage - 1, TOTAL_PAGES);
    const now = new Date();
    const plan = {
      id: data.id ? String(data.id) : createId(),
      name: normalizeName(data.name),
      duration,
      dailyPages: duration === 'continuous' ? clampInteger(data.dailyPages || 1, 1, TOTAL_PAGES) : calculateDailyTarget(duration, TOTAL_PAGES - startPage + 1),
      startDate: normalizeDateKey(data.startDate || todayKey(now)),
      startPage,
      startPoint: normalizeStartPoint(data.startPoint, startPage),
      progressPage,
      status: progressPage >= TOTAL_PAGES ? 'completed' : 'active',
      reminder: normalizeReminder(data.reminder),
      pausedAt: null,
      pausedDays: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      completedAt: progressPage >= TOTAL_PAGES ? now.toISOString() : null,
      rebalancedAt: null,
      history: progressPage > 0 ? [{ at: now.toISOString(), page: progressPage }] : []
    };
    if (state.plans.some(existing => existing.id === plan.id)) throw new Error('معرّف الختمة مستخدم مسبقًا');
    state.plans.unshift(plan);
    state.activeId = plan.id;
    persistAndEmit('create', plan);
    render();
    return clone(plan);
  }

  function update(planId, patch) {
    const plan = requirePlan(planId);
    const changes = patch || {};
    if (Object.prototype.hasOwnProperty.call(changes, 'name')) plan.name = normalizeName(changes.name);
    if (Object.prototype.hasOwnProperty.call(changes, 'startDate')) plan.startDate = normalizeDateKey(changes.startDate);
    if (Object.prototype.hasOwnProperty.call(changes, 'startPage') || Object.prototype.hasOwnProperty.call(changes, 'startPoint')) {
      const nextStart = clampInteger(changes.startPage || changes.startPoint && changes.startPoint.page || plan.startPage, 1, TOTAL_PAGES);
      plan.startPage = nextStart;
      plan.startPoint = normalizeStartPoint(changes.startPoint || plan.startPoint, nextStart);
      plan.progressPage = Math.max(nextStart - 1, plan.progressPage);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'duration')) {
      plan.duration = normalizeDuration(changes.duration);
      plan.dailyPages = plan.duration === 'continuous'
        ? clampInteger(changes.dailyPages || plan.dailyPages || 1, 1, TOTAL_PAGES)
        : calculateDailyTarget(plan.duration, TOTAL_PAGES - plan.startPage + 1);
    } else if (plan.duration === 'continuous' && Object.prototype.hasOwnProperty.call(changes, 'dailyPages')) {
      plan.dailyPages = clampInteger(changes.dailyPages, 1, TOTAL_PAGES);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'reminder')) plan.reminder = normalizeReminder(changes.reminder);
    plan.rebalancedAt = null;
    plan.updatedAt = new Date().toISOString();
    persistAndEmit('update', plan);
    render();
    return clone(plan);
  }

  function setProgress(planId, page, at) {
    const plan = requirePlan(planId);
    const nextPage = clampInteger(page, plan.startPage - 1, TOTAL_PAGES);
    const timestamp = at ? new Date(at) : new Date();
    if (Number.isNaN(timestamp.getTime())) throw new Error('وقت تحديث التقدم غير صالح');
    plan.progressPage = nextPage;
    plan.updatedAt = timestamp.toISOString();
    plan.history.push({ at: timestamp.toISOString(), page: nextPage });
    plan.history = normalizeHistory(plan.history);
    if (nextPage >= TOTAL_PAGES) {
      plan.status = 'completed';
      plan.completedAt = timestamp.toISOString();
      plan.pausedAt = null;
    } else if (plan.status === 'completed') {
      plan.status = 'active';
      plan.completedAt = null;
    }
    persistAndEmit('progress', plan);
    render();
    return metrics(plan, timestamp);
  }

  function advance(planId, pages, at) {
    const plan = requirePlan(planId);
    const amount = pages == null ? 1 : Number(pages);
    if (!Number.isFinite(amount) || !Number.isInteger(amount)) throw new Error('عدد الصفحات المضافة يجب أن يكون عددًا صحيحًا');
    return setProgress(planId, plan.progressPage + amount, at);
  }

  function pause(planId, at) {
    const plan = requirePlan(planId);
    if (plan.status !== 'active') return clone(plan);
    const date = normalizeDateKey(at ? dateKey(new Date(at)) : todayKey());
    plan.status = 'paused';
    plan.pausedAt = date;
    plan.updatedAt = new Date().toISOString();
    persistAndEmit('pause', plan);
    render();
    return clone(plan);
  }

  function resume(planId, at) {
    const plan = requirePlan(planId);
    if (plan.status !== 'paused') return clone(plan);
    const resumeDate = normalizeDateKey(at ? dateKey(new Date(at)) : todayKey());
    plan.pausedDays += Math.max(0, daysBetween(plan.pausedAt, resumeDate));
    plan.pausedAt = null;
    plan.status = plan.progressPage >= TOTAL_PAGES ? 'completed' : 'active';
    plan.updatedAt = new Date().toISOString();
    persistAndEmit('resume', plan);
    render();
    return clone(plan);
  }

  function remove(planId) {
    const index = state.plans.findIndex(plan => plan.id === planId);
    if (index < 0) return false;
    const removed = state.plans.splice(index, 1)[0];
    if (state.activeId === planId) state.activeId = state.plans[0] ? state.plans[0].id : null;
    if (currentPlanId === planId) currentPlanId = null;
    persistAndEmit('delete', removed);
    render();
    return true;
  }

  function setActive(planId) {
    requirePlan(planId);
    state.activeId = planId;
    persistAndEmit('active', requirePlan(planId));
    return getPlan(planId);
  }

  function metrics(planOrId, at) {
    const plan = typeof planOrId === 'string' ? requirePlan(planOrId) : planOrId;
    if (!plan) throw new Error('الختمة غير موجودة');
    const date = at instanceof Date ? at : (at ? new Date(at) : new Date());
    if (Number.isNaN(date.getTime())) throw new Error('تاريخ حساب التقدم غير صالح');
    const totalPages = TOTAL_PAGES - plan.startPage + 1;
    const remainingPages = Math.max(0, TOTAL_PAGES - plan.progressPage);
    const completedPages = Math.min(totalPages, Math.max(0, plan.progressPage - plan.startPage + 1));
    const percentage = Math.round((completedPages / totalPages) * 1000) / 10;
    const rawElapsed = Math.max(0, daysBetween(plan.startDate, dateKey(date)));
    const livePausedDays = plan.status === 'paused' && plan.pausedAt ? Math.max(0, daysBetween(plan.pausedAt, dateKey(date))) : 0;
    const activeElapsedDays = Math.max(0, rawElapsed - plan.pausedDays - livePausedDays);

    if (plan.duration === 'continuous') {
      const dailyTarget = clampInteger(plan.dailyPages || 1, 1, TOTAL_PAGES);
      const daysToFinish = remainingPages ? Math.ceil(remainingPages / dailyTarget) : 0;
      return {
        totalPages,
        completedPages,
        remainingPages,
        percentage,
        duration: 'continuous',
        baseDailyTarget: dailyTarget,
        todayTarget: remainingPages ? Math.min(dailyTarget, remainingPages) : 0,
        activeElapsedDays,
        daysRemaining: null,
        expectedPageToday: Math.min(TOTAL_PAGES, plan.startPage - 1 + (activeElapsedDays + 1) * dailyTarget),
        paceDelta: completedPages - Math.min(totalPages, activeElapsedDays * dailyTarget),
        behindPages: Math.max(0, Math.min(totalPages, activeElapsedDays * dailyTarget) - completedPages),
        needsRebalance: false,
        deadline: remainingPages ? addDays(dateKey(date), Math.max(0, daysToFinish - 1)) : dateKey(date)
      };
    }

    const effectiveDay = Math.min(plan.duration, activeElapsedDays + 1);
    const daysRemaining = Math.max(1, plan.duration - activeElapsedDays);
    const pausedExtension = plan.pausedDays + livePausedDays;
    const deadline = addDays(plan.startDate, plan.duration - 1 + pausedExtension);
    const expectedCompletedBeforeToday = Math.min(totalPages, Math.floor((Math.min(activeElapsedDays, plan.duration) / plan.duration) * totalPages));
    const expectedPageToday = Math.min(TOTAL_PAGES, plan.startPage - 1 + Math.ceil((effectiveDay / plan.duration) * totalPages));
    const todayTarget = remainingPages ? Math.min(remainingPages, Math.ceil(remainingPages / daysRemaining)) : 0;
    const baseDailyTarget = calculateDailyTarget(plan.duration, totalPages);
    return {
      totalPages,
      completedPages,
      remainingPages,
      percentage,
      duration: plan.duration,
      baseDailyTarget,
      todayTarget,
      activeElapsedDays,
      daysRemaining: Math.max(0, plan.duration - activeElapsedDays),
      expectedPageToday,
      paceDelta: completedPages - expectedCompletedBeforeToday,
      behindPages: Math.max(0, expectedCompletedBeforeToday - completedPages),
      needsRebalance: todayTarget > baseDailyTarget && remainingPages > 0,
      deadline
    };
  }

  function resolveReminder(planOrId, context) {
    const plan = typeof planOrId === 'string' ? requirePlan(planOrId) : planOrId;
    if (!plan || plan.status !== 'active' || !plan.reminder || plan.reminder.type === 'none') return null;
    const data = context || {};
    const baseDate = data.date instanceof Date ? new Date(data.date) : (data.date ? new Date(data.date) : new Date());
    if (Number.isNaN(baseDate.getTime())) throw new Error('تاريخ التذكير غير صالح');
    let result;
    if (plan.reminder.type === 'time') {
      const parts = plan.reminder.time.split(':').map(Number);
      result = new Date(baseDate);
      result.setHours(parts[0], parts[1], 0, 0);
    } else {
      const value = data.prayerTimes && data.prayerTimes[plan.reminder.prayer];
      if (value == null) return null;
      result = parsePrayerTime(value, baseDate);
      result = new Date(result.getTime() + plan.reminder.offsetMinutes * 60000);
    }
    return {
      planId: plan.id,
      title: `ورد ختمة: ${plan.name}`,
      body: reminderBody(plan, data.date || baseDate),
      date: result,
      reminder: clone(plan.reminder)
    };
  }

  function parsePrayerTime(value, baseDate) {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) throw new Error('وقت الصلاة غير صالح');
      return new Date(value);
    }
    if (typeof value === 'number') {
      const result = new Date(value);
      if (Number.isNaN(result.getTime())) throw new Error('وقت الصلاة غير صالح');
      return result;
    }
    const match = String(value).match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!match) throw new Error('وقت الصلاة يجب أن يكون Date أو HH:mm');
    const result = new Date(baseDate);
    result.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return result;
  }

  function reminderBody(plan, at) {
    const result = metrics(plan, at);
    if (!result.todayTarget) return 'أتممت الختمة، تقبّل الله منك.';
    return `ورد اليوم ${latinDigits(result.todayTarget)} صفحات، من صفحة ${latinDigits(plan.progressPage + 1)}.`;
  }

  function getPlan(planId) {
    const plan = state.plans.find(item => item.id === planId);
    return plan ? clone(plan) : null;
  }

  function requirePlan(planId) {
    const plan = state.plans.find(item => item.id === planId);
    if (!plan) throw new Error('الختمة غير موجودة');
    return plan;
  }

  function list() {
    return state.plans.map(plan => ({ plan: clone(plan), metrics: metrics(plan) }));
  }

  function getActive() {
    return state.activeId ? getPlan(state.activeId) : null;
  }

  function open(planId, target) {
    requirePlan(planId);
    if (target) rootElement = resolveRoot(target);
    currentPlanId = planId;
    setActive(planId);
    return render();
  }

  function close() {
    currentPlanId = null;
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
    const markup = currentPlanId && state.plans.some(plan => plan.id === currentPlanId)
      ? renderPlan(currentPlanId)
      : renderIndex();
    if (rootElement) {
      rootElement.innerHTML = markup;
      bindRoot(rootElement);
      rootElement.querySelectorAll('[data-khatma-create],[data-khatma-edit]').forEach(syncFormState);
    }
    return markup;
  }

  function renderIndex() {
    const plans = list();
    return `<section class="khatma-module" dir="rtl" aria-label="خطط الختمة">
      <header class="khatma-module__header"><div><small>صفحةً بعد صفحة</small><h2>${plans.length ? 'ختماتي' : 'ابدأ ختمتك الأولى'}</h2></div>${plans.length ? `<span>${latinDigits(plans.length)} ${plans.length === 1 ? 'ختمة' : 'ختمات'}</span>` : ''}</header>
      ${plans.length ? `<p class="khatma-caption">اختر ختمة لمتابعة وردك أو تسجيل ما قرأت.</p><div class="khatma-list">${plans.map(renderPlanRow).join('')}</div>` : ''}
      ${plans.length ? `<details class="disclosure khatma-new"><summary>إضافة ختمة جديدة</summary>${renderCreateForm()}</details>` : renderCreateForm()}
    </section>`;
  }

  function renderPlanRow(item) {
    const plan = item.plan;
    const value = item.metrics;
    const status = plan.status === 'completed' ? 'مكتملة' : plan.status === 'paused' ? 'متوقفة' : 'نشطة';
    const duration = plan.duration === 'continuous' ? 'مستمرة' : `${latinDigits(plan.duration)} يومًا`;
    return `<button type="button" class="khatma-row" data-khatma-action="open" data-plan-id="${escapeAttr(plan.id)}">
      <span class="khatma-row__status">${status}</span>
      <strong>${escapeHtml(plan.name)}</strong>
      <small>${duration} · ${value.completedPages ? `قرأت ${latinDigits(value.completedPages)} صفحة` : 'جاهزة للبدء'}</small>
      <span class="khatma-row__next">${plan.status === 'completed' ? 'تقبّل الله منك' : plan.status === 'paused' ? 'استأنف حين يناسبك' : `متابعة من الصفحة ${latinDigits(plan.progressPage + 1)}`}<span aria-hidden="true">‹</span></span>
      <span class="khatma-progress" role="progressbar" aria-label="تقدم الختمة" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value.percentage}"><i style="width:${value.percentage}%"></i></span>
      <b>${latinDigits(value.percentage)}%</b>
    </button>`;
  }

  function renderCreateForm() {
    return `<form class="khatma-form" data-khatma-create novalidate>
      <div class="khatma-form__intro"><p>اختر مدة تناسب يومك، وسنحسب وردك. يمكنك تعديل خطتك لاحقًا.</p></div>
      <fieldset class="khatma-pace"><legend>خلال كم يومًا؟</legend><div class="khatma-presets">${[30, 60, 90].map(days => `<button type="button" data-khatma-duration="${days}" aria-pressed="${days === 30}"><strong>${days}</strong><span>يومًا</span><small data-pace-pages="${days}">${calculateDailyTarget(days)} صفحة / يوم</small></button>`).join('')}</div></fieldset>
      <details class="khatma-disclosure khatma-duration-options"><summary>مدة أخرى أو ورد مستمر<span data-duration-label>30 يومًا</span></summary>
        <label>المدة<select name="duration">${durationOptions(30)}</select></label>
        <label class="hidden" data-khatma-end>تاريخ النهاية<input name="endDate" type="date" min="${todayKey()}" value="${addDays(todayKey(), 29)}" required></label>
        <label class="hidden" data-khatma-daily>عدد الصفحات يوميًا<input name="dailyPages" type="number" inputmode="numeric" min="1" max="604" value="1" required></label>
      </details>
      <div class="khatma-preview" data-khatma-preview role="status" aria-live="polite"></div>
      <p class="khatma-form-error" data-khatma-error role="alert" tabindex="-1" hidden></p>
      <button type="submit">ابدأ الختمة</button>
      <details class="khatma-disclosure khatma-start-options"><summary>الاسم ونقطة البداية<span data-start-label>أول المصحف</span></summary>
      <label>اسم الختمة<input name="name" maxlength="80" required value="ختمتي" placeholder="مثل: ختمة رمضان"></label>
      <p class="khatma-caption">ابدأ من أول المصحف، أو من موضع وصلت إليه سابقًا.</p><div class="khatma-form-grid">
        <label>نقطة البداية<select name="startKind">${startKindOptions('page')}</select></label>
        <label data-start-value>الرقم<input name="startValue" type="number" inputmode="numeric" min="1" max="604" value="1" required></label>
        <label class="hidden" data-start-surah>السورة<input name="startSurah" type="number" inputmode="numeric" min="1" max="114" value="1"></label>
      </div></details>
      <details class="khatma-disclosure khatma-reminder"><summary>تذكير بالورد<span data-reminder-label>بدون تذكير</span></summary>${renderReminderFields()}</details>
      <p class="khatma-save-note">تُحفظ خطتك وتقدمك على هذا الجهاز.</p>
    </form>`;
  }

  function startKindOptions(selected) {
    const items = [['page', 'صفحة'], ['surah', 'سورة'], ['juz', 'جزء'], ['hizb', 'حزب'], ['ayah', 'آية في سورة']];
    return items.map(item => `<option value="${item[0]}"${selected === item[0] ? ' selected' : ''}>${item[1]}</option>`).join('');
  }

  function durationOptions(selected) {
    const custom = selected !== 'continuous' && !FIXED_DURATIONS.includes(Number(selected));
    return FIXED_DURATIONS.map(days => `<option value="${days}"${selected === days ? ' selected' : ''}>${latinDigits(days)} يومًا</option>`).join('')
      + `<option value="custom"${custom ? ' selected' : ''}>حتى تاريخ أحدده</option><option value="continuous"${selected === 'continuous' ? ' selected' : ''}>مستمرة بلا موعد</option>`;
  }

  function renderReminderFields(reminder) {
    const value = reminder || { type: 'none' };
    return `<fieldset><legend>متى تحب أن تتذكر وردك؟</legend>
      <label>النوع<select name="reminderType">
        <option value="none"${value.type === 'none' ? ' selected' : ''}>بدون تذكير</option>
        <option value="prayer"${value.type === 'prayer' ? ' selected' : ''}>مرتبط بصلاة</option>
        <option value="time"${value.type === 'time' ? ' selected' : ''}>وقت ثابت</option>
      </select></label>
      <label data-reminder-prayer>الصلاة<select name="prayer">${PRAYERS.map(prayer => `<option value="${prayer}"${value.prayer === prayer ? ' selected' : ''}>${PRAYER_NAMES[prayer]}</option>`).join('')}</select></label>
      <label data-reminder-prayer>قبل الصلاة أو بعدها بالدقائق<input name="offsetMinutes" type="number" inputmode="numeric" min="-180" max="180" value="${value.offsetMinutes || 0}"><small>0 عند الصلاة، −5 قبلها، 5 بعدها.</small></label>
      <label data-reminder-time>وقت التذكير<input name="time" type="time" value="${value.time || '20:00'}" required></label>
      <p class="khatma-caption" data-reminder-note>يتطلب وصول التذكير تفعيل إشعارات مشكاة في إعدادات الجهاز.</p>
    </fieldset>`;
  }

  function renderPlan(planId) {
    const plan = requirePlan(planId);
    const value = metrics(plan);
    const targetEnd = value.deadline ? formatDate(value.deadline) : '—';
    const statusLabel = plan.status === 'completed' ? 'مكتملة' : plan.status === 'paused' ? 'متوقفة مؤقتًا' : 'ختمة نشطة';
    const nextPage = Math.min(TOTAL_PAGES, Math.max(plan.startPage, plan.progressPage + 1));
    const arbitraryDuration = plan.duration !== 'continuous' && !FIXED_DURATIONS.includes(plan.duration);
    const lastPage = Math.min(TOTAL_PAGES, nextPage + Math.max(0, value.todayTarget - 1));
    return `<section class="khatma-module khatma-module--detail" dir="rtl" aria-label="${escapeAttr(plan.name)}">
      <header class="khatma-plan-header"><button type="button" data-khatma-action="back" aria-label="العودة إلى ختماتي"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button><div><small>${statusLabel}</small><h2 tabindex="-1">${escapeHtml(plan.name)}</h2></div></header>
      ${progressUndo && progressUndo.after === plan.updatedAt && progressUndo.before.id === plan.id ? `<div class="khatma-feedback" role="status"><span>حُفظ موضعك عند الصفحة ${latinDigits(plan.progressPage)}</span><button type="button" data-khatma-action="undo-progress">تراجع</button></div>` : ''}
      <div class="khatma-wird">
        <span class="khatma-eyebrow">${plan.status === 'completed' ? 'ختمة مباركة' : plan.status === 'paused' ? 'موضعك محفوظ' : 'وردك القادم'}</span>
        <h3>${plan.status === 'completed' ? 'أتممت الختمة' : plan.status === 'paused' ? 'على مهل، عد حين يناسبك' : `${latinDigits(value.todayTarget)} <span>صفحة للقراءة</span>`}</h3>
        <p>${plan.status === 'completed' ? 'تقبّل الله منك وبارك في وردك.' : plan.status === 'paused' ? `سنكمل من الصفحة ${latinDigits(nextPage)} عند استئناف الخطة.` : `من الصفحة <bdi>${nextPage}</bdi> إلى <bdi>${lastPage}</bdi>`}</p>
        ${plan.status === 'paused' ? `<button type="button" class="khatma-primary" data-khatma-action="resume">استئناف الختمة</button>` : plan.status !== 'completed' ? `<button type="button" class="khatma-primary khatma-continue" data-khatma-action="continue" data-page="${nextPage}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z"/></svg>متابعة القراءة<span aria-hidden="true">‹</span></button>` : ''}
        ${plan.status === 'active' ? '<small>الورد المقترح يتحدّث بحسب تقدمك في الخطة.</small>' : ''}
      </div>
      <details class="khatma-disclosure khatma-record"${plan.status === 'completed' ? '' : ' open'}><summary>تسجيل القراءة<span>${value.completedPages ? `آخر صفحة: ${plan.progressPage}` : 'لم تسجّل قراءة بعد'}</span></summary>
      <p class="khatma-caption">سجّل آخر صفحة أتممت قراءتها، من هنا أو من مصحفك الورقي.</p>
      <form data-khatma-progress novalidate><label>آخر صفحة قرأتها<input name="page" type="number" inputmode="numeric" min="${plan.startPage - 1}" max="604" value="${plan.progressPage}" required></label><button type="submit">حفظ موضعي</button><p class="khatma-form-error" data-khatma-error role="alert" tabindex="-1" hidden></p></form>
      <div class="khatma-actions khatma-increments">
        <button type="button" data-khatma-action="advance" data-pages="1" data-plan-id="${escapeAttr(plan.id)}">قرأت صفحة</button>
        <button type="button" data-khatma-action="advance" data-pages="5" data-plan-id="${escapeAttr(plan.id)}">قرأت 5 صفحات</button>
      </div></details>
      <div class="khatma-summary"><div><h3>رحلتك في الختمة</h3><strong>${latinDigits(value.percentage)}%</strong></div><span>قرأت ${latinDigits(value.completedPages)} من ${latinDigits(value.totalPages)} صفحة</span>
        <div class="khatma-progress" role="progressbar" aria-label="تقدم الختمة" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value.percentage}"><i style="width:${value.percentage}%"></i></div>
        <dl class="khatma-metrics"><div><dt>المتبقي</dt><dd>${value.remainingPages} صفحة</dd></div><div><dt>${plan.duration === 'continuous' ? 'المدة' : 'الأيام المتبقية'}</dt><dd>${value.daysRemaining == null ? 'بلا موعد' : latinDigits(value.daysRemaining)}</dd></div><div><dt>النهاية المتوقعة</dt><dd>${targetEnd}</dd></div></dl>
      </div>
      ${value.needsRebalance && plan.status === 'active' && (!plan.rebalancedAt || dateKey(new Date(plan.rebalancedAt)) !== todayKey()) ? `<div class="khatma-state khatma-state--warning"><strong>يمكنك ضبط وتيرة الخطة</strong><span>بقي ${latinDigits(value.behindPages)} صفحة من الأيام السابقة. الورد المقترح ${latinDigits(value.todayTarget)} صفحة لموعدك الحالي، ويمكنك تمديد المدة من تعديل الختمة.</span><button type="button" data-khatma-action="rebalance">اعتماد الورد المقترح</button></div>` : ''}
      <details class="khatma-disclosure khatma-manage"><summary>إعدادات الختمة<span>تعديل، تذكير، إيقاف</span></summary>
      <details class="khatma-disclosure khatma-edit"><summary>تعديل الختمة والتذكير</summary>
        <form class="khatma-form" data-khatma-edit novalidate>
          <label>الاسم<input name="name" maxlength="80" value="${escapeAttr(plan.name)}" required></label>
          <label>تاريخ البداية<input name="startDate" type="date" value="${escapeAttr(plan.startDate)}" required></label>
          <div class="khatma-form-grid">
            <label>نقطة البداية<select name="startKind">${startKindOptions(plan.startPoint.kind)}</select></label>
            <label data-start-value>الرقم<input name="startValue" type="number" inputmode="numeric" min="1" value="${plan.startPoint.value}" required></label>
            <label class="${plan.startPoint.kind === 'ayah' ? '' : 'hidden'}" data-start-surah>السورة<input name="startSurah" type="number" inputmode="numeric" min="1" max="114" value="${plan.startPoint.s}"></label>
            <label>المدة<select name="duration">${durationOptions(plan.duration)}</select></label>
            <label class="${arbitraryDuration ? '' : 'hidden'}" data-khatma-end>تاريخ النهاية<input name="endDate" type="date" min="${plan.startDate}" value="${value.deadline}"></label>
            <label class="${plan.duration === 'continuous' ? '' : 'hidden'}" data-khatma-daily>ورد المستمرة<input name="dailyPages" type="number" min="1" max="604" value="${plan.dailyPages || 1}"></label>
          </div>
          <details class="khatma-reminder"><summary>إعداد التذكير</summary>${renderReminderFields(plan.reminder)}</details>
          <p class="khatma-form-error" data-khatma-error role="alert" tabindex="-1" hidden></p><button type="submit">حفظ التعديلات</button>
        </form>
      </details>
      <div class="khatma-actions">${plan.status === 'active' ? '<button type="button" data-khatma-action="pause">إيقاف مؤقت</button>' : ''}${plan.status === 'paused' ? `<button type="button" data-khatma-action="continue" data-page="${nextPage}">فتح موضع القراءة دون استئناف</button>` : ''}<button type="button" class="khatma-danger" data-khatma-action="delete" data-plan-id="${escapeAttr(plan.id)}">حذف الختمة</button></div></details>
    </section>`;
  }

  function bindRoot(root) {
    if (boundRoots && boundRoots.has(root)) return;
    if (boundRoots) boundRoots.add(root);
    root.addEventListener('submit', event => {
      if (event.target.matches('[data-khatma-create]')) {
        event.preventDefault();
        if (!validateForm(event.target)) return;
        try {
          create(formPlanData(event.target));
          currentPlanId = state.activeId;
          render();
          focusHeading();
          notify('تم إنشاء الختمة وحساب وردك اليومي');
        } catch (error) { showFormError(event.target, error.message); }
      }
      if (event.target.matches('[data-khatma-edit]')) {
        event.preventDefault();
        if (!validateForm(event.target)) return;
        try { update(currentPlanId, formPlanData(event.target)); progressUndo = null; focusHeading(); notify('تم حفظ تعديلات الختمة'); } catch (error) { showFormError(event.target, error.message); }
      }
      if (event.target.matches('[data-khatma-progress]')) {
        event.preventDefault();
        if (!validateForm(event.target)) return;
        try { recordProgress(currentPlanId, Number(new FormData(event.target).get('page'))); root.querySelector('[data-khatma-progress] button').focus({ preventScroll: true }); } catch (error) { showFormError(event.target, error.message); }
      }
    });
    root.addEventListener('input', event => {
      const form = event.target.closest('[data-khatma-create],[data-khatma-edit]');
      if (form) syncFormState(form);
    });
    root.addEventListener('change', event => {
      const form = event.target.closest('[data-khatma-create],[data-khatma-edit]');
      if (form) syncFormState(form);
    });
    root.addEventListener('click', event => {
      const preset = event.target.closest('[data-khatma-duration]');
      if (preset) {
        const form = preset.closest('form');
        form.elements.duration.value = preset.dataset.khatmaDuration;
        syncFormState(form);
        return;
      }
      const button = event.target.closest('[data-khatma-action]');
      if (!button) return;
      const action = button.dataset.khatmaAction;
      const planId = button.dataset.planId || currentPlanId;
      try {
        if (action === 'open') { open(planId); focusHeading(); }
        if (action === 'back') { close(); focusHeading(); }
        if (action === 'advance') {
          recordProgress(planId, Math.min(TOTAL_PAGES, requirePlan(planId).progressPage + Number(button.dataset.pages)));
          root.querySelector(`[data-khatma-action="advance"][data-pages="${button.dataset.pages}"]`).focus({ preventScroll: true });
        }
        if (action === 'undo-progress') {
          if (progressUndo && progressUndo.before.id === planId && requirePlan(planId).updatedAt === progressUndo.after) {
            const restored = Object.assign(clone(progressUndo.before), { updatedAt: new Date().toISOString() });
            state.plans[state.plans.findIndex(plan => plan.id === planId)] = restored;
            progressUndo = null;
            persistAndEmit('progress', restored); render();
            root.querySelector('[data-khatma-progress] button').focus({ preventScroll: true });
            notify('تم التراجع عن تسجيل القراءة الأخير');
          }
        }
        if (action === 'pause') { pause(planId); focusHeading(); notify('توقفت الخطة مؤقتًا، وموضعك محفوظ'); }
        if (action === 'resume') { resume(planId); focusHeading(); notify('تم استئناف الختمة'); }
        if (action === 'continue') {
          const page = Number(button.dataset.page);
          if (typeof options.onContinue === 'function') options.onContinue(page, getPlan(planId));
        }
        if (action === 'rebalance') {
          const plan = requirePlan(planId);
          plan.rebalancedAt = new Date().toISOString();
          plan.updatedAt = plan.rebalancedAt;
          persistAndEmit('rebalance', plan);
          render();
          notify('تم توزيع الصفحات المتبقية على الأيام القادمة');
        }
        if (action === 'delete') {
          const approved = typeof window === 'undefined' || typeof window.confirm !== 'function' || window.confirm('حذف هذه الختمة؟ لا يمكن التراجع.');
          if (approved) { remove(planId); progressUndo = null; focusHeading(); notify('حُذفت الختمة'); }
        }
      } catch (error) { notify(error.message); }
    });
  }

  function focusHeading() {
    if (!rootElement) return;
    const heading = rootElement.querySelector('h2');
    const scroller = rootElement.closest('main');
    if (scroller) scroller.scrollTo({ top: 0, behavior: 'instant' });
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }

  function recordProgress(planId, page) {
    const before = getPlan(planId);
    if (before.progressPage === page) { notify('موضع القراءة محفوظ بالفعل'); return; }
    setProgress(planId, page);
    const after = getPlan(planId);
    progressUndo = { before, after: after.updatedAt };
    render();
    notify(`حُفظ موضعك عند الصفحة ${latinDigits(after.progressPage)}`);
  }

  function showFormError(form, message, field) {
    const error = form.querySelector('[data-khatma-error]');
    if (!error) { notify(message); return; }
    error.id = form.hasAttribute('data-khatma-create') ? 'khatma-create-error' : form.hasAttribute('data-khatma-edit') ? 'khatma-edit-error' : 'khatma-progress-error';
    error.hidden = false; error.textContent = message;
    if (field) {
      field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', error.id);
      for (let node = field.parentElement; node && node !== form; node = node.parentElement) if (node.tagName === 'DETAILS') node.open = true;
      field.focus();
    } else error.focus();
  }

  function validateForm(form) {
    if (form.elements.name) form.elements.name.setCustomValidity(form.elements.name.value.trim() ? '' : 'اكتب اسمًا للختمة');
    const invalid = Array.from(form.elements).find(field => !field.disabled && field.willValidate && !field.checkValidity());
    if (!invalid) return true;
    const message = invalid.name === 'name' ? 'اكتب اسمًا للختمة.'
      : invalid.type === 'number' ? `أدخل عددًا صحيحًا من ${invalid.min || 1} إلى ${invalid.max || 604}.`
      : invalid.type === 'date' ? 'اختر تاريخًا صحيحًا لا يسبق تاريخ البداية.'
      : 'أكمل هذا الحقل قبل حفظ الختمة.';
    showFormError(form, message, invalid); return false;
  }

  function formPlanData(form) {
    const data = new FormData(form);
    const reminderType = data.get('reminderType');
    const reminder = reminderType === 'prayer'
      ? { type: 'prayer', prayer: String(data.get('prayer')), offsetMinutes: Number(data.get('offsetMinutes') || 0) }
      : reminderType === 'time'
        ? { type: 'time', time: String(data.get('time') || '') }
        : { type: 'none' };
    const startDate = data.get('startDate') ? String(data.get('startDate')) : todayKey();
    const durationValue = String(data.get('duration') || '30');
    let duration;
    if (durationValue === 'continuous') duration = 'continuous';
    else if (durationValue === 'custom') {
      const endDate = normalizeDateKey(String(data.get('endDate') || ''));
      duration = daysBetween(startDate, endDate) + 1;
      if (duration < 1) throw new Error('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
    } else duration = Number(durationValue);
    const startKind = String(data.get('startKind') || 'page');
    const startValue = Number(data.get('startValue') || 1);
    const startSurah = Number(data.get('startSurah') || 1);
    const startPoint = typeof options.resolvePoint === 'function'
      ? options.resolvePoint(startKind, startValue, startSurah)
      : normalizeStartPoint({ kind: 'page', value: startValue, page: startValue }, startValue);
    return {
      name: String(data.get('name') || ''),
      startDate,
      startPage: startPoint.page,
      startPoint,
      duration,
      dailyPages: Number(data.get('dailyPages') || 1),
      reminder
    };
  }

  function syncFormState(form) {
    if (form.elements.name) form.elements.name.setCustomValidity(form.elements.name.value.trim() ? '' : 'اكتب اسمًا للختمة');
    form.querySelectorAll('[aria-invalid]').forEach(field => {
      if (field.checkValidity()) { field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby'); }
    });
    const error = form.querySelector('[data-khatma-error]');
    if (error && !form.querySelector('[aria-invalid]')) error.hidden = true;
    const kind = form.elements.startKind && form.elements.startKind.value || 'page';
    const limits = { page: 604, surah: 114, juz: 30, hizb: 60, ayah: 286 };
    const labels = { page: 'رقم الصفحة', surah: 'رقم السورة', juz: 'رقم الجزء', hizb: 'رقم الحزب', ayah: 'رقم الآية' };
    const valueInput = form.elements.startValue;
    if (valueInput) {
      valueInput.max = limits[kind];
      const label = valueInput.closest('label');
      if (label) label.childNodes[0].nodeValue = labels[kind];
    }
    const surahField = form.querySelector('[data-start-surah]');
    if (surahField) { surahField.classList.toggle('hidden', kind !== 'ayah'); surahField.querySelector('input').disabled = kind !== 'ayah'; }
    const duration = form.elements.duration && form.elements.duration.value || '30';
    const end = form.querySelector('[data-khatma-end]');
    const daily = form.querySelector('[data-khatma-daily]');
    if (end) { end.classList.toggle('hidden', duration !== 'custom'); end.querySelector('input').disabled = duration !== 'custom'; }
    if (daily) { daily.classList.toggle('hidden', duration !== 'continuous'); daily.querySelector('input').disabled = duration !== 'continuous'; }
    form.querySelectorAll('[data-khatma-duration]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.khatmaDuration === duration)));
    const durationLabel = form.querySelector('[data-duration-label]');
    if (durationLabel) durationLabel.textContent = duration === 'continuous' ? 'مستمر' : duration === 'custom' ? 'تاريخ محدد' : `${duration} يومًا`;
    const reminder = form.elements.reminderType && form.elements.reminderType.value || 'none';
    form.querySelectorAll('[data-reminder-prayer],[data-reminder-time]').forEach(field => {
      const shown = field.hasAttribute('data-reminder-prayer') ? reminder === 'prayer' : reminder === 'time';
      field.classList.toggle('hidden', !shown); field.querySelector('input,select').disabled = !shown;
    });
    const reminderLabel = form.querySelector('[data-reminder-label]');
    if (reminderLabel) reminderLabel.textContent = reminder === 'prayer' ? `مع ${PRAYER_NAMES[form.elements.prayer.value]}` : reminder === 'time' ? form.elements.time.value : 'بدون تذكير';
    const note = form.querySelector('[data-reminder-note]'); if (note) note.hidden = reminder === 'none';
    const preview = form.querySelector('[data-khatma-preview]');
    if (!preview) return;
    try {
      const point = typeof options.resolvePoint === 'function'
        ? options.resolvePoint(kind, Number(valueInput.value || 1), Number(form.elements.startSurah && form.elements.startSurah.value || 1))
        : { page: Number(valueInput.value || 1) };
      const remaining = TOTAL_PAGES - point.page + 1;
      const startLabel = form.querySelector('[data-start-label]'); if (startLabel) startLabel.textContent = point.page === 1 ? 'أول المصحف' : `الصفحة ${point.page}`;
      form.querySelectorAll('[data-pace-pages]').forEach(label => { label.textContent = `${Math.ceil(remaining / Number(label.dataset.pacePages))} صفحة / يوم`; });
      if (duration === 'continuous') preview.innerHTML = `<span>وردك اليومي</span><b>${latinDigits(form.elements.dailyPages.value || 1)} صفحة</b><small>من الصفحة ${point.page} · بلا موعد نهاية ملزم</small>`;
      else {
        const days = duration === 'custom'
          ? daysBetween(form.elements.startDate && form.elements.startDate.value || todayKey(), form.elements.endDate.value) + 1
          : Number(duration);
        preview.innerHTML = days > 0 ? `<span>وردك اليومي المقترح</span><b>${latinDigits(Math.ceil(remaining / days))} صفحة</b><small>من الصفحة ${point.page} · النهاية ${formatDate(addDays(form.elements.startDate && form.elements.startDate.value || todayKey(), days - 1))}</small>` : 'اختر تاريخ نهاية صحيحًا';
      }
    } catch (_) { preview.textContent = 'أكمل البيانات لحساب الورد'; }
  }

  function emptyMarkup(title, message) {
    return `<div class="khatma-empty" role="status"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p></div>`;
  }

  function persistAndEmit(type, plan) {
    persist();
    if (typeof options.onChange === 'function') options.onChange({ type, plan: clone(plan), state: getState() });
  }

  function notify(message) {
    if (typeof options.notify === 'function') options.notify(message);
    else if (typeof globalThis.toast === 'function') globalThis.toast(message);
  }

  function getState() {
    return { schemaVersion: SCHEMA_VERSION, activeId: state.activeId, plans: state.plans.map(clone), currentPlanId };
  }

  function createId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `khatma-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function clampInteger(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error('القيمة الرقمية غير صالحة');
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function validIsoDateTime(value) {
    return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
  }

  function normalizeDateKey(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new Error('التاريخ يجب أن يكون بصيغة YYYY-MM-DD');
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) throw new Error('التاريخ غير صالح');
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  function dateKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('التاريخ غير صالح');
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function todayKey(date) {
    return dateKey(date || new Date());
  }

  function dateKeyToUtc(value) {
    const normalized = normalizeDateKey(value);
    const parts = normalized.split('-').map(Number);
    return Date.UTC(parts[0], parts[1] - 1, parts[2]);
  }

  function daysBetween(from, to) {
    return Math.round((dateKeyToUtc(to) - dateKeyToUtc(from)) / 86400000);
  }

  function addDays(value, days) {
    const date = new Date(dateKeyToUtc(value) + Number(days) * 86400000);
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  }

  function formatDate(value) {
    const date = new Date(dateKeyToUtc(value));
    try {
      return latinDigits(new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date));
    } catch (_) {
      return value;
    }
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function latinDigits(value) {
    const arabic = '٠١٢٣٤٥٦٧٨٩', eastern = '۰۱۲۳۴۵۶۷۸۹';
    return String(value)
      .replace(/[٠-٩]/g, digit => String(arabic.indexOf(digit)))
      .replace(/[۰-۹]/g, digit => String(eastern.indexOf(digit)));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function resetForTests(customStorage) {
    storage = normalizeStorage(customStorage || createDefaultStorage());
    storage.remove && storage.remove(STORAGE_KEY);
    state = emptyState();
    rootElement = null;
    currentPlanId = null;
    options = {};
  }

  const api = {
    init,
    render,
    open,
    close,
    create,
    update,
    delete: remove,
    remove,
    pause,
    stop: pause,
    resume,
    setProgress,
    advance,
    calculateDailyTarget,
    metrics,
    resolveReminder,
    getPlan,
    getActive,
    setActive,
    list,
    getState,
    constants: { TOTAL_PAGES, FIXED_DURATIONS, PRAYERS, PRAYER_NAMES },
    _resetForTests: resetForTests
  };

  return api;
});
