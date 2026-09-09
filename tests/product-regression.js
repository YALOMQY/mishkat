'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');

if (!global.crypto) Object.defineProperty(global, 'crypto', { value: webcrypto });
const root = path.resolve(__dirname, '..');
const QuranCore = require(path.join(root, 'js/quran-core.js'));
const Khatma = require(path.join(root, 'js/khatma.js'));
const Library = require(path.join(root, 'js/library.js'));
const quran = JSON.parse(fs.readFileSync(path.join(root, 'data/quran.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/mushaf/hafs-kfqc-manifest.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/library-catalog.json'), 'utf8'));
const sampleText = fs.readFileSync(path.join(root, 'data/nawawi40.sample.json'), 'utf8');
const indexMarkup = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const quranSource = fs.readFileSync(path.join(root, 'js/quran.js'), 'utf8');

assert.ok(catalog.books.every(book => book.availability !== 'catalog-only'), 'يجب ألا تظهر كتب بلا نصوص في الفهرس');
assert.doesNotMatch(indexMarkup, /رسائل من مشكاة|pushServiceCard/, 'بطاقة تشخيص Firebase يجب ألا تظهر في الإعدادات');
assert.doesNotMatch(indexMarkup, /toggleLayout|وضع العرض/, 'مبدّل عرض المصحف يجب ألا يظهر');
assert.doesNotMatch(quranSource, /data-switch-verses|Store\.set\('quranLayout'/, 'قارئ المصحف لا يتيح الرجوع إلى عرض الآيات');

const reciters = [
  ['ar.alafasy', 'العفاسي', [128, 64]],
  ['ar.abdulbasitmurattal', 'عبد الباسط', [64, 192]],
  ['ar.hanirifai', 'هاني الرفاعي', [64, 192]]
];
assert.match(QuranCore.audioCandidates(reciters, 'ar.alafasy', 1)[0], /audio\/128\/ar\.alafasy\/1\.mp3$/);
assert.match(QuranCore.audioCandidates(reciters, 'ar.abdulbasitmurattal', 1)[0], /audio\/64\/ar\.abdulbasitmurattal\/1\.mp3$/);
assert.equal(QuranCore.readingSize(4), 20);
assert.equal(QuranCore.readingSize(200), 60);
assert.equal(QuranCore.readingPercent(32), 100);
assert.equal(QuranCore.readingPercent(60), 165);
assert.ok(QuranCore.readingScale(44) > QuranCore.readingScale(32));
assert.equal(QuranCore.pointFor('page', 262, quran, manifest).s, 15);
assert.equal(QuranCore.pointFor('juz', 2, quran, manifest).value, 2);
assert.equal(QuranCore.pointFor('hizb', 60, quran, manifest).s, 87);
assert.equal(QuranCore.pointFor('surah', 36, quran, manifest).s, 36);

function memoryStorage() {
  const data = new Map();
  return {
    get: key => data.has(key) ? data.get(key) : null,
    set: (key, value) => data.set(key, value),
    remove: key => data.delete(key)
  };
}

const khatmaStorage = memoryStorage();
Khatma._resetForTests(khatmaStorage);
Khatma.init({ storage: khatmaStorage, resolvePoint: (kind, value, surah) => QuranCore.pointFor(kind, value, quran, manifest, surah) });
const plan = Khatma.create({ name: 'اختبار', duration: 30, startPoint: QuranCore.pointFor('page', 262, quran, manifest), startPage: 262, reminder: { type: 'none' } });
assert.equal(plan.progressPage, 261);
assert.equal(Khatma.metrics(plan).totalPages, 343);
assert.equal(Khatma.metrics(plan).baseDailyTarget, 12);
Khatma.setProgress(plan.id, 270);
assert.equal(Khatma.getPlan(plan.id).progressPage, 270);
Khatma.pause(plan.id);
assert.equal(Khatma.getPlan(plan.id).status, 'paused');
Khatma.resume(plan.id);
assert.equal(Khatma.getPlan(plan.id).status, 'active');

(async () => {
  const libraryStorage = memoryStorage();
  Library._resetForTests();
  await Library.init({
    catalog,
    storage: libraryStorage,
    fetch: async url => {
      assert.equal(url, 'data/nawawi40.sample.json');
      return new Response(sampleText, { status: 200, headers: { 'Content-Length': String(Buffer.byteLength(sampleText)) } });
    }
  });
  assert.doesNotMatch(Library.render(), /المحتوى غير مرفق|المصدر: غير محدد|مدخل فهرسة فقط/);
  const pack = await Library.download('nawawi40');
  assert.equal(pack.entries.length, 3);
  assert.equal(Library.getStatus('nawawi40').state, 'installed');
  assert.equal(Library.search('النيات').entries[0].id, 'nawawi-001');
  Library.toggleFavorite('nawawi40', 'nawawi-001', true);
  assert.equal(Library.favorites().length, 1);
  Library.removeDownload('nawawi40');
  assert.equal(Library.getStatus('nawawi40').state, 'available');
  console.log('✓ التنقل، مصادر الصوت، الختمة، وتنزيل المكتبة');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
