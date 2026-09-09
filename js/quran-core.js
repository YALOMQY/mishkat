/* منطق قابل للاختبار للتنقل في المصحف واختيار مصادر التلاوة. */
(function (scope, factory) {
  const api = factory();
  scope.QuranCore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PAGE_COUNT = 604;
  const READING_SIZE = Object.freeze({ min: 20, fit: 32, max: 60 });

  /* بدايات الأحزاب الستين من بيانات Tanzil Quran Metadata. */
  const HIZB_STARTS = Object.freeze([
    [1,1],[2,75],[2,142],[2,203],[2,253],[3,15],[3,93],[3,171],[4,24],[4,88],
    [4,148],[5,27],[5,82],[6,36],[6,111],[7,1],[7,88],[7,171],[8,41],[9,34],
    [9,93],[10,26],[11,6],[11,84],[12,53],[13,19],[15,1],[16,51],[17,1],[17,99],
    [18,75],[20,1],[21,1],[22,1],[23,1],[24,21],[25,21],[26,111],[27,56],[28,51],
    [29,46],[31,22],[33,31],[34,24],[36,28],[37,145],[39,32],[40,41],[41,47],[43,24],
    [46,1],[48,18],[51,31],[55,1],[58,1],[62,1],[67,1],[72,1],[78,1],[87,1]
  ].map((value, index) => Object.freeze({ n: index + 1, s: value[0], a: value[1] })));

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));

  function readingSize(value) {
    return Math.round(clamp(value, READING_SIZE.min, READING_SIZE.max));
  }

  /* الحجم 32 يحافظ على ملاءمة الصفحة؛ ما فوقه يكبّر الصفحة تدريجيًا حتى 165%. */
  function readingScale(value) {
    const size = readingSize(value);
    if (size <= READING_SIZE.fit) {
      return 0.82 + ((size - READING_SIZE.min) / (READING_SIZE.fit - READING_SIZE.min)) * 0.18;
    }
    return 1 + ((size - READING_SIZE.fit) / (READING_SIZE.max - READING_SIZE.fit)) * 0.65;
  }

  function readingPercent(value) {
    return Math.round(readingScale(value) * 100);
  }

  function reciterProfile(reciters, id) {
    const row = (reciters || []).find(item => item[0] === id) || (reciters || [])[0];
    if (!row) return { id: 'ar.alafasy', name: '', bitrates: [128, 64] };
    return { id: row[0], name: row[1], bitrates: Array.isArray(row[2]) && row[2].length ? row[2] : [128, 64] };
  }

  function audioCandidates(reciters, reciterId, globalAyah) {
    const profile = reciterProfile(reciters, reciterId);
    const number = clamp(globalAyah, 1, 6236);
    const hosts = ['https://cdn.islamic.network', 'https://cdn.alislam.ru'];
    const urls = [];
    hosts.forEach(host => profile.bitrates.forEach(bitrate => {
      urls.push(`${host}/quran/audio/${bitrate}/${profile.id}/${number}.mp3`);
    }));
    return Array.from(new Set(urls));
  }

  function pointFor(kind, value, data, manifest, contextSurah) {
    if (!data || !Array.isArray(data.surahs)) throw new Error('بيانات القرآن غير جاهزة');
    const surah = number => data.surahs[clamp(number, 1, 114) - 1];
    const pageFor = (s, a) => {
      const chapter = surah(s);
      const ayah = clamp(a, 1, chapter.ayahs.length);
      const global = chapter.start + ayah - 1;
      return manifest && manifest.versePages ? manifest.versePages[global - 1] : chapter.page;
    };
    const normalized = String(kind || 'page');
    if (normalized === 'surah') {
      const s = clamp(value, 1, 114);
      return { kind: normalized, value: s, s, a: 1, page: pageFor(s, 1) };
    }
    if (normalized === 'juz') {
      const n = clamp(value, 1, 30);
      const item = data.juz[n - 1];
      return { kind: normalized, value: n, s: item.s, a: item.a, page: pageFor(item.s, item.a) };
    }
    if (normalized === 'hizb') {
      const n = clamp(value, 1, 60);
      const item = HIZB_STARTS[n - 1];
      return { kind: normalized, value: n, s: item.s, a: item.a, page: pageFor(item.s, item.a) };
    }
    if (normalized === 'ayah') {
      const s = clamp(contextSurah, 1, 114);
      const a = clamp(value, 1, surah(s).ayahs.length);
      return { kind: normalized, value: a, s, a, page: pageFor(s, a) };
    }
    const page = clamp(value, 1, PAGE_COUNT);
    const first = manifest && manifest.pages && manifest.pages[page - 1] && manifest.pages[page - 1].first;
    return { kind: 'page', value: page, page, s: first ? first.s : 1, a: first ? first.a : 1 };
  }

  return { PAGE_COUNT, READING_SIZE, HIZB_STARTS, clamp, readingSize, readingScale, readingPercent, reciterProfile, audioCandidates, pointFor };
});
