# Mishkat Quran Subsystem — Phase Q6
# Quran Search & Deep Navigation Engine Architecture

**Document Version:** 1.0.0  
**Phase:** Q6  
**Status:** Complete (Q6 GO)  
**Date:** October 2026  

---

## 1. Executive Summary

Phase Q6 transforms Quran search in Mishkat from a simple linear text filter into a high-performance, local-first Quran discovery, reference parsing, and deep navigation engine.

The engine operates 100% offline, guarantees sub-millisecond query evaluation (< 1 ms), preserves the original KFQC Uthmani artwork and text without duplication, and directly bridges search results to:
- **Q2 Mushaf Geometry:** Resolves exact page and SVG geometry bounds.
- **Q3 Ayah Selection:** Activates emerald-green Ayah selection and focus on arrival.
- **Q4 Tafsir Engine:** Launches interactive commentary sheets directly from search results.
- **Q5 Audio Synchronization:** Triggers continuous reciter playback without competing player state.

---

## 2. Canonical Quran Data & Index Architecture

### 2.1 Single Source of Truth
The canonical Quran text resides exclusively in `assets/data/quran.json` (1.3 MB).
- **Surahs:** Exactly 114 chapters.
- **Verses:** Exactly 6,236 Ayahs.
- **No Duplicate Datasets:** Neither `assets/mushaf/pages/` (604 SVGs) nor `mushaf-layout.json` (632 KB) nor `tafsir-muyassar.json` (2.4 MB) duplicates Arabic text.

### 2.2 In-Memory Normalized Index
To achieve sub-millisecond search latencies on mobile devices without generating massive secondary asset files, `QuranSearchRepository` lazily warms up an in-memory index on first load:
```dart
class _SearchableAyah {
  final int globalAyah;
  final int surah;
  final String surahName;
  final int ayah;
  final int page;
  final String originalText;
  final String normalizedText;
  final List<int> indexMap;
}
```
- **One-time Initialization:** ~60 ms for all 6,236 Ayahs.
- **RAM Footprint:** ~500 KB (negligible).
- **Search Complexity:** O(N) linear evaluation over pre-normalized memory strings, executing in **0.48 ms – 0.65 ms**.

---

## 3. Arabic Normalization & Character Mapping

### 3.1 Normalization Dimensions
Quranic search normalization must accommodate modern Arabic typing habits while respecting Uthmani orthography. `QuranSearchNormalizer` applies:
1. **Dagger Alef (`\u0670`) Handling:**
   - In Uthmani script, 2,701 words write long "aa" with dagger alef (e.g. `ٱلْعَٰلَمِينَ`, `ٱلصِّرَٰطَ`, `مَٰلِكِ`, `ٱلسَّمَٰوَٰتِ`, `سُلْطَٰنٍ`, `صَٰدِقِينَ`). Users invariably type these words with standard alef (`ا`).
   - Converted to `ا` during normalization, except for words where modern Arabic spelling also omits the alef (`الرحمن`, `هذا`, `هذه`, `هؤلاء`, `ذلك`, `لكن`).
2. **Diacritics & Pause Signs:**
   - Strips tashkeel (`\u064B-\u065F`).
   - Strips Quranic annotation marks (`\u06D6-\u06ED`).
   - Strips Tatweel/Kashida (`ـ`).
3. **Orthographic Normalization:**
   - Alef variants: `[أ, إ, آ, ٱ]` $\rightarrow$ `ا`.
   - Hamza carriers: `ؤ` $\rightarrow$ `و`, `ئ` $\rightarrow$ `ي`.
   - Alef Maqsura: `ى` $\rightarrow$ `ي`.
   - Ta Marbuta: `ة` $\rightarrow$ `ه`.
   - Eastern Arabic Digits: `[٠-٩]` $\rightarrow$ `[0-9]`.

### 3.2 Synchronized Index Mapping
`QuranSearchNormalizer.normalizeWithMap(original)` constructs a synchronized `indexMap` where:
$$\text{indexMap}[i] = \text{original index in Uthmani string}$$
When a match occurs in the normalized string at range $[N_{\text{start}}, N_{\text{end}})$, the original substring bounds are calculated as:
- $\text{Start} = \text{indexMap}[N_{\text{start}}]$
- $\text{End} = \text{indexMap}[N_{\text{end}} - 1] + 1 + \text{trailing attached diacritics}$

This ensures that character highlights rendered in `QuranSearchResultTile` accurately wrap authentic Uthmani letters including their attached diacritics and signs.

---

## 4. Direct Reference Parsing

`QuranReferenceParser.parse(query, data)` identifies structured addresses prior to text search, rendering an instant navigation card (`QuranSearchReferenceCard`):

| Input Pattern | Example | Target Type | Result |
|---|---|---|---|
| `S:A`, `S/A`, `S A`, `S-A` | `2:255`, `2 255`, `٢:٢٥٥` | `QuranReferenceType.ayah` | Al-Baqarah 255 (Page 42, Global 262) |
| Surah Name + Number | `البقرة 255`, `الكهف 10` | `QuranReferenceType.ayah` | Directly navigates to verse |
| Page Jump | `ص 255`, `صفحة 604` | `QuranReferenceType.page` | Directly navigates to page |
| Global Ayah | `#255`, `g6236` | `QuranReferenceType.globalAyah` | Directly navigates to global index |
| Pure Number | `255` | `QuranReferenceType.page` | Resolves to Mushaf Page 255 |
| Exact Surah Name | `البقرة`, `يس`, `الفاتحة` | `QuranReferenceType.surah` | Resolves to Surah starting page |

---

## 5. State Management & Debouncing

### 5.1 Cubit Architecture
`QuranSearchCubit` manages search lifecycle using `flutter_bloc`:
- **Initial State:** Displays recent search history and popular Quranic suggestions.
- **Debounced Search:** Keystrokes are debounced by 250 ms. Fast typing cancels previous timers to prevent unnecessary search evaluations.
- **Filter Switching:** Supports instantaneous switching between `All`, `Ayahs`, and `Surahs`.
- **History Management:** Bounded, privacy-respecting local storage (`LocalStorageService`) retaining up to 10 recent searches.

---

## 6. Deep Navigation & Subsystem Cross-Integration

### 6.1 Search $\rightarrow$ Mushaf Integration
Tapping a search result executes deep navigation:
1. Persists query to recent search history.
2. Updates `QuranCubit.openPage(page, point: point)`.
3. Pushes `QuranReaderPage(initialGlobalAyah: globalAyah)`.
4. `QuranReaderPage` initializes `MushafInteractionCubit.selectAyahByGlobal(globalAyah)`.
5. The reader opens on the correct page with the target Ayah highlighted in emerald green.

### 6.2 Search $\rightarrow$ Tafsir Integration
Tapping "تفسير" from any search result card:
1. Resolves `AyahBounds` on-demand via `MushafLayoutRepository.getAyah(globalAyah)`.
2. Directly opens `TafsirKnowledgeSheet.show(context, ayah: bounds, quranData: data)`.
3. Zero page transition or reader interaction is required to study verse commentary.

### 6.3 Search $\rightarrow$ Audio Playback Integration
Tapping "استماع" from any search result card:
1. Calls canonical `QuranCubit.playAyah(globalAyah, continuous: true, autoScroll: true)`.
2. Delegates to existing `AudioService` (Q1/Q5 foundation).
3. Mini Player displays the verse with synchronized scrubber and reciter bitrate controls.
4. Auto-advance and page tracking operate seamlessly.

---

## 7. Verification & Performance Metrics

- **Analyzer Warnings:** 0 issues found across `lib/` and `test/features/`.
- **Regression Suite:** 142/142 tests passing.
- **Targeted Search Tests:** 24/24 tests passing (`test/features/quran_search_test.dart`).
- **6,236 Ayah Validation:** 100% of verses map to valid page boundaries, geometric layout bounds, and Tafsir Al-Muyassar commentary entries.
- **114 Surah Validation:** 100% of chapters resolve by name and number to their canonical pages.
- **Asset Integrity:** 604/604 SVG files in `assets/mushaf/pages/` remain unmodified.
