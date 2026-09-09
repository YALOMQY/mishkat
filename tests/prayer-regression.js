#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

process.env.TZ = 'Asia/Aden';

const prayerPath = path.join(__dirname, '..', 'js', 'prayer.js');
const source = `${fs.readFileSync(prayerPath, 'utf8')}\nthis.PrayerCalcForTest = PrayerCalc;`;
const context = vm.createContext({ Date, Math });
vm.runInContext(source, context, { filename: prayerPath });
const PrayerCalc = context.PrayerCalcForTest;

const date = new Date(2026, 8, 4, 12, 0, 0);
const hadramout = { lat: 14.7664, lng: 49.6254 };
const keys = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const expected = ['04:17', '05:30', '11:41', '14:57', '17:51', '18:59'];

function hhmm(value) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function calculate(coords, overrides = {}) {
  return PrayerCalc.getTimes(date, coords, {
    method: 'Makkah',
    asr: 'Standard',
    highLats: 'NightMiddle',
    tune: {},
    ...overrides
  });
}

const reference = calculate(hadramout);
assert.equal(reference.__methodKey, 'MWL', 'يجب ترحيل اختيار أم القرى القديم في اليمن إلى MWL');
assert.deepEqual(keys.map(key => hhmm(reference[key])), expected, 'مواقيت حضرموت المرجعية');
for (const key of keys) {
  assert.equal(reference[key].getSeconds(), 0, `${key}: يجب التقريب إلى دقيقة كاملة`);
  assert.equal(reference[key].getMilliseconds(), 0, `${key}: يجب حذف أجزاء الدقيقة بعد التقريب`);
}

const saudiLocations = [
  ['مكة', 21.3891, 39.8579],
  ['جازان', 16.89, 42.55],
  ['نجران', 17.49, 44.13],
  ['شرورة', 17.4667, 47.1]
];
for (const [name, lat, lng] of saudiLocations) {
  const saudi = calculate({ lat, lng });
  assert.equal(saudi.__methodKey, 'Makkah', `يجب أن تبقى ${name} على طريقة أم القرى`);
}

const explicitAlternative = calculate(hadramout, { method: 'Egypt' });
assert.equal(explicitAlternative.__methodKey, 'Egypt', 'يجب عدم تغيير طريقة يدوية غير أم القرى');

const explicitMakkah = calculate(hadramout, { method: 'Makkah', methodAuto: false });
assert.equal(explicitMakkah.__methodKey, 'Makkah', 'يجب احترام اختيار أم القرى اليدوي داخل اليمن');

const tuned = calculate(hadramout, { tune: { fajr: 7, isha: -5 } });
assert.equal(hhmm(tuned.fajr), '04:24', 'يجب تطبيق تعديل الفجر قبل التقريب');
assert.equal(hhmm(tuned.isha), '18:54', 'يجب تطبيق تعديل العشاء قبل التقريب');

const hanafi = calculate(hadramout, { asr: 'Hanafi' });
assert.ok(hanafi.asr > reference.asr, 'يجب الحفاظ على إعداد مذهب العصر الحنفي');

console.log('✓ Hadramout MWL reference:', keys.map(key => `${key}=${hhmm(reference[key])}`).join(' '));
console.log('✓ Saudi Arabia remains Makkah');
console.log('✓ Minute rounding, madhhab, and manual offsets preserved');
