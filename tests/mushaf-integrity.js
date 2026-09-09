'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/mushaf/hafs-kfqc-manifest.json'), 'utf8'));

assert.equal(manifest.edition, 'hafs-kfqc-madinah-604');
assert.equal(manifest.pageCount, 604);
assert.equal(manifest.pages.length, 604);
assert.equal(manifest.versePages.length, 6236);

for (let page = 1; page <= 604; page += 1) {
  const entry = manifest.pages[page - 1];
  const filename = path.join(root, manifest.pagePath.replace('{page}', String(page).padStart(3, '0')));
  assert.equal(entry.page, page, `ترقيم الفهرس غير متسلسل عند الصفحة ${page}`);
  assert.ok(fs.existsSync(filename), `الصفحة ${page} مفقودة`);
  const data = fs.readFileSync(filename);
  assert.ok(data.length > 0, `الصفحة ${page} فارغة`);
  assert.equal(data.length, entry.bytes, `حجم الصفحة ${page} غير مطابق`);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'), entry.sha256, `بصمة الصفحة ${page} غير مطابقة`);
  const head = data.subarray(0, Math.min(data.length, 2048)).toString('utf8');
  assert.match(head, /<svg\b/, `الصفحة ${page} ليست SVG`);
}

assert.equal(manifest.pages[261].first.s, 15, 'الصفحة 262 لا تبدأ بسورة الحجر كما هو متوقع');
console.log('✓ سلامة 604 صفحة مصحف، بما فيها الصفحة 262');
