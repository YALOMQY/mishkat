/* ═══════════ الإعدادات والتخزين المحلي + أدوات مساعدة ═══════════ */
const Store = (function () {
  const KEY = 'mishkat.settings.v1';
  const DEFAULTS = {
    lat: null, lng: null, city: '', locationAuto: false,
    method: 'MWL', _methodSet: false, asr: 'Standard', highLats: 'NightMiddle', hijriOffset: 0,
    tune: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
    notif: false, adhanSound: true, adhanFile: 'a1', preMinutes: 0,
    perPrayer: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
    adhkarNotif: false,
    theme: 'auto', uiFont: 'normal', quranFont: 32, quranLayout: 'mushaf', reciter: 'ar.alafasy',
    quranAutoScroll: true, quranContinuous: true, quranAudioPosition: null,
    keepAwake: false, vibrate: true,
    lastRead: null, bookmarks: [], tasbihTotal: 0, adhkarProgress: {},
    onboardingSeen: false, notificationPromptSeen: false
  };
  let s;
  try {
    // ترحيل إعدادات النسخة السابقة (اسم المفتاح تغيّر مع تغيّر اسم التطبيق)
    const raw = localStorage.getItem(KEY) || localStorage.getItem('noor.settings.v1') || '{}';
    s = Object.assign({}, DEFAULTS, JSON.parse(raw));
  } catch (e) { s = Object.assign({}, DEFAULTS); }
  s.tune = Object.assign({}, DEFAULTS.tune, s.tune);
  s.perPrayer = Object.assign({}, DEFAULTS.perPrayer, s.perPrayer);
  s.quranFont = Math.round(Math.max(20, Math.min(60, Number(s.quranFont) || DEFAULTS.quranFont)));
  // قارئ واحد واضح: صفحة المصحف الطبيعية. يرحّل أي اختيار قديم تلقائيًا.
  s.quranLayout = 'mushaf';

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
  const set = (k, v) => { s[k] = v; save(); };
  return { get s() { return s; }, set, save, DEFAULTS };
})();

/* أدوات عامة */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
/*
 * سياسة الأرقام في الواجهة: أرقام لاتينية 0–9 في كل اللغات.
 * أبقينا الاسم القديم `toAr` كتوافق رجعي للوحدات الحالية، لكنه الآن يطبّق
 * السياسة المركزية نفسها ويحوّل أي أرقام عربية واردة من بيانات قديمة.
 */
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toLatinDigits = value => String(value == null ? '' : value)
  .replace(/[٠-٩]/g, digit => String(ARABIC_INDIC_DIGITS.indexOf(digit)))
  .replace(/[۰-۹]/g, digit => String(EASTERN_ARABIC_DIGITS.indexOf(digit)));
const formatNumber = (value, options = {}) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return toLatinDigits(value);
  return new Intl.NumberFormat('en-US', Object.assign({ useGrouping: false }, options)).format(number);
};
const toAr = toLatinDigits;
const pad2 = n => (n < 10 ? '0' : '') + n;

function fmtTime(d) {
  if (!d) return '—';
  let h = d.getHours(), mn = d.getMinutes();
  const per = h < 12 ? 'ص' : 'م';
  h = h % 12 || 12;
  return `${toAr(h)}:${toAr(pad2(mn))} ${per}`;
}
function fmtDuration(ms) {
  if (ms < 0) ms = 0;
  const t = Math.floor(ms / 1000);
  return `${toAr(pad2(Math.floor(t / 3600)))}:${toAr(pad2(Math.floor(t / 60) % 60))}:${toAr(pad2(t % 60))}`;
}
function hijriDate(date, offset) {
  const d = new Date(date.getTime() + (offset || 0) * 864e5);
  try {
    return toLatinDigits(new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d));
  } catch (e) {
    return toLatinDigits(new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'full' }).format(d));
  }
}
function gregDate(date) {
  return toLatinDigits(new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(date));
}
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}
function vibrate(p) { if (Store.s.vibrate && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }

/* مدن جاهزة للاختيار السريع */
const CITIES = [
  ['مكة المكرمة', 21.3891, 39.8579, 'Makkah'], ['المدينة المنورة', 24.4686, 39.6142, 'Makkah'],
  ['الرياض', 24.7136, 46.6753, 'Makkah'], ['جدة', 21.4858, 39.1925, 'Makkah'],
  ['الدمام', 26.4207, 50.0888, 'Makkah'], ['أبها', 18.2164, 42.5053, 'Makkah'],
  ['القدس', 31.7683, 35.2137, 'Egypt'], ['غزة', 31.5017, 34.4668, 'Egypt'],
  ['عمّان', 31.9539, 35.9106, 'Egypt'], ['القاهرة', 30.0444, 31.2357, 'Egypt'],
  ['الإسكندرية', 31.2001, 29.9187, 'Egypt'], ['الخرطوم', 15.5007, 32.5599, 'Egypt'],
  ['دبي', 25.2048, 55.2708, 'Dubai'], ['أبوظبي', 24.4539, 54.3773, 'Dubai'],
  ['الدوحة', 25.2854, 51.5310, 'Qatar'], ['الكويت', 29.3759, 47.9774, 'Kuwait'],
  ['المنامة', 26.2285, 50.5860, 'Gulf'], ['مسقط', 23.5880, 58.3829, 'Gulf'],
  ['صنعاء', 15.3694, 44.1910, 'MWL'], ['عدن', 12.7855, 45.0187, 'MWL'],
  ['الشحر، حضرموت', 14.7664, 49.6254, 'MWL'],
  ['بغداد', 33.3152, 44.3661, 'Karachi'], ['بيروت', 33.8938, 35.5018, 'Egypt'],
  ['دمشق', 33.5138, 36.2765, 'Egypt'], ['تونس', 36.8065, 10.1815, 'MWL'],
  ['الجزائر', 36.7538, 3.0588, 'MWL'], ['الرباط', 34.0209, -6.8416, 'MWL'],
  ['الدار البيضاء', 33.5731, -7.5898, 'MWL'], ['طرابلس', 32.8872, 13.1913, 'MWL'],
  ['نواكشوط', 18.0735, -15.9582, 'MWL'], ['مقديشو', 2.0469, 45.3182, 'MWL'],
  ['إسطنبول', 41.0082, 28.9784, 'Turkey'], ['كوالالمبور', 3.1390, 101.6869, 'Singapore'],
  ['جاكرتا', -6.2088, 106.8456, 'Singapore'], ['كراتشي', 24.8607, 67.0011, 'Karachi'],
  ['لندن', 51.5074, -0.1278, 'MWL'], ['باريس', 48.8566, 2.3522, 'France'],
  ['برلين', 52.5200, 13.4050, 'MWL'], ['نيويورك', 40.7128, -74.0060, 'ISNA'],
  ['تورونتو', 43.6532, -79.3832, 'ISNA'], ['سيدني', -33.8688, 151.2093, 'MWL']
];

/* محافظات ومناطق — تُستخدم حين لا توجد مدينة قريبة (مثل الشحر ← حضرموت).
   [الاسم، خط العرض، خط الطول، طريقة الحساب] */
const REGIONS = [
  // اليمن
  ['حضرموت', 14.54, 49.12, 'MWL'], ['المهرة', 16.21, 52.18, 'MWL'],
  ['شبوة', 14.54, 46.83, 'MWL'], ['أبين', 13.13, 45.38, 'MWL'],
  ['لحج', 13.06, 44.88, 'MWL'], ['الضالع', 13.70, 44.73, 'MWL'],
  ['تعز', 13.58, 44.02, 'MWL'], ['إب', 13.97, 44.18, 'MWL'],
  ['ذمار', 14.55, 44.40, 'MWL'], ['البيضاء', 13.98, 45.57, 'MWL'],
  ['مأرب', 15.46, 45.33, 'MWL'], ['الجوف', 16.16, 44.78, 'MWL'],
  ['صعدة', 16.94, 43.76, 'MWL'], ['حجة', 15.69, 43.60, 'MWL'],
  ['عمران', 15.66, 43.94, 'MWL'], ['المحويت', 15.47, 43.55, 'MWL'],
  ['الحديدة', 14.80, 42.95, 'MWL'], ['ريمة', 14.63, 43.62, 'MWL'],
  ['سقطرى', 12.51, 53.92, 'MWL'],
  // السعودية
  ['القصيم', 26.33, 43.97, 'Makkah'], ['تبوك', 28.38, 36.57, 'Makkah'],
  ['حائل', 27.52, 41.69, 'Makkah'], ['جازان', 16.89, 42.55, 'Makkah'],
  ['نجران', 17.49, 44.13, 'Makkah'], ['الباحة', 20.01, 41.47, 'Makkah'],
  ['الجوف — سكاكا', 29.97, 40.20, 'Makkah'], ['الحدود الشمالية', 30.98, 41.02, 'Makkah'],
  ['حفر الباطن', 28.43, 45.97, 'Makkah'], ['الطائف', 21.28, 40.42, 'Makkah'],
  ['ينبع', 24.09, 38.06, 'Makkah'], ['الأحساء', 25.38, 49.59, 'Makkah'],
  // عُمان والإمارات والخليج
  ['ظفار — صلالة', 17.02, 54.09, 'Gulf'], ['صحار', 24.34, 56.71, 'Gulf'],
  ['نزوى', 22.93, 57.53, 'Gulf'], ['صور', 22.57, 59.53, 'Gulf'],
  ['الشارقة', 25.35, 55.39, 'Dubai'], ['العين', 24.21, 55.75, 'Dubai'],
  ['رأس الخيمة', 25.79, 55.94, 'Dubai'], ['الفجيرة', 25.13, 56.33, 'Dubai'],
  // مصر والسودان وبلاد الشام والعراق
  ['أسوان', 24.09, 32.90, 'Egypt'], ['الأقصر', 25.69, 32.64, 'Egypt'],
  ['أسيوط', 27.18, 31.18, 'Egypt'], ['المنيا', 28.11, 30.75, 'Egypt'],
  ['طنطا', 30.79, 31.00, 'Egypt'], ['بورسعيد', 31.26, 32.28, 'Egypt'],
  ['مرسى مطروح', 31.35, 27.24, 'Egypt'], ['بورتسودان', 19.62, 37.22, 'Egypt'],
  ['نيالا', 12.05, 24.88, 'Egypt'], ['حلب', 36.20, 37.13, 'Egypt'],
  ['حمص', 34.73, 36.71, 'Egypt'], ['اللاذقية', 35.52, 35.79, 'Egypt'],
  ['إربد', 32.55, 35.85, 'Egypt'], ['العقبة', 29.53, 35.01, 'Egypt'],
  ['طرابلس — لبنان', 34.44, 35.84, 'Egypt'], ['البصرة', 30.51, 47.78, 'Karachi'],
  ['الموصل', 36.34, 43.13, 'Karachi'], ['أربيل', 36.19, 44.01, 'Karachi'],
  ['النجف', 32.00, 44.33, 'Karachi'], ['كربلاء', 32.62, 44.02, 'Karachi'],
  // المغرب العربي
  ['مراكش', 31.63, -7.99, 'MWL'], ['فاس', 34.03, -5.00, 'MWL'],
  ['أغادير', 30.43, -9.60, 'MWL'], ['طنجة', 35.76, -5.83, 'MWL'],
  ['وهران', 35.70, -0.63, 'MWL'], ['قسنطينة', 36.36, 6.61, 'MWL'],
  ['بنغازي', 32.12, 20.07, 'MWL'], ['سبها', 27.04, 14.43, 'MWL'],
  ['صفاقس', 34.74, 10.76, 'MWL']
];

/* القرّاء المتاحون للتلاوة (عبر الإنترنت) */
const RECITERS = [
  ['ar.alafasy', 'مشاري العفاسي', [128, 64]],
  ['ar.abdulbasitmurattal', 'عبد الباسط — مرتل', [64, 192]],
  ['ar.abdurrahmaansudais', 'عبد الرحمن السديس', [64, 192]],
  ['ar.mahermuaiqly', 'ماهر المعيقلي', [128, 64]],
  ['ar.husary', 'محمود الحصري', [128, 64]],
  ['ar.minshawi', 'محمد صديق المنشاوي', [128]],
  ['ar.saoodshuraym', 'سعود الشريم', [64]],
  ['ar.hudhaify', 'علي الحذيفي', [128, 64]],
  ['ar.ahmedajamy', 'أحمد العجمي', [128, 64]],
  ['ar.muhammadayyoub', 'محمد أيوب', [128]],
  ['ar.shaatree', 'أبو بكر الشاطري', [128, 64]],
  ['ar.hanirifai', 'هاني الرفاعي', [64, 192]]
];
