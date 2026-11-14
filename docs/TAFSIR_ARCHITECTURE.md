# 🕌 Mishkat Quran — Tafsir Architecture & Content Specification (Phase Q4)

## 1. Overview & Core Philosophy

Phase Q4 introduces the **Ayah Knowledge & Tafsir Engine** to the Mishkat Quran system. Built on top of the verified Phase Q2 geometry metadata and Phase Q3 interaction layer, it provides authentic, local-first Quran commentary (Tafsir) directly linked to the selected Ayah.

### Architectural Principles:
1. **Local-First & Offline-Ready**: Full commentary for all 6,236 Ayahs is bundled locally in a compact JSON asset (`assets/data/tafsir-muyassar.json`). Zero runtime network requests are required to read Tafsir.
2. **Single Source of Truth for Quran Text**: Quranic text and Surah names are never duplicated inside the Tafsir asset. Tafsir entries index strictly into the existing `globalAyah` identity (`1..6236`) established by `assets/data/quran.json`.
3. **Deterministic Preparation**: Build-time asset preparation is handled via a reproducible, self-contained Python pipeline in `tools/tafsir/prepare_tafsir_muyassar.py`.
4. **State Isolation**: Commentary state is managed via a dedicated `TafsirCubit` using `flutter_bloc`, isolating modal commentary updates from reader page rendering and SVG cache trees.
5. **Authentic Islamic Attribution**: Sourced from official King Fahd Complex publications with full institutional attribution and license compliance.

---

## 2. Content Source & Verification

- **Work**: **التفسير الميسر** (*Al-Tafsir Al-Muyassar*)
- **Author / Compiler**: نخبة من أساتذة التفسير بإشراف مجمع الملك فهد لطباعة المصحف الشريف بالمدينة المنورة.
- **Publisher**: مجمع الملك فهد لطباعة المصحف الشريف (King Fahd Glorious Quran Printing Complex, Madinah).
- **Source Platform**: [QuranEnc.com](https://quranenc.com) (Source key: `arabic_moyassar`).
- **Version**: `1.0.0`
- **Coverage**: **6,236 / 6,236 Ayahs (100% complete Quran coverage)**.
- **Language**: Arabic (`ar`), Right-to-Left (`rtl`).
- **License & Terms of Use**:
  Published under QuranEnc open redistribution terms:
  1. No modification, addition, or deletion of the content.
  2. Clearly referring to the publisher and source (`مجمع الملك فهد لطباعة المصحف الشريف بالمدينة المنورة عبر موسوعة القرآن الكريم (QuranEnc.com)`).
  3. Mentioning version number when republishing (`1.0.0`).
  4. Preserving metadata and transcript information.
  5. Prohibiting inappropriate advertising alongside translations of the Holy Quran.

---

## 3. Data Schema & Asset Specifications

Asset Location: `assets/data/tafsir-muyassar.json`
- **Raw File Size**: 2,563,388 bytes (~2.44 MB)
- **Compressed APK Footprint**: ~820 KB
- **SHA-256 Digest**: `5265ebc542567fcd0a77bceef4212f6254c12f7440f723304d32855476b938c8`
- **Number of Entries**: 6,236
- **Average Entry Length**: 220.9 characters

### JSON Structure:
```json
{
  "schemaVersion": 1,
  "source": {
    "id": "arabic_moyassar",
    "name": "التفسير الميسر",
    "language": "ar",
    "author": "نخبة من العلماء بإشراف مجمع الملك فهد لطباعة المصحف الشريف",
    "publisher": "مجمع الملك فهد لطباعة المصحف الشريف",
    "description": "تفسير ميسر أعدته نخبة من العلماء وصدر عن مجمع الملك فهد لطباعة المصحف الشريف بالمدينة المنورة وفق منهج أهل السنة والجماعة.",
    "attribution": "مأخوذ وموثق من مجمع الملك فهد لطباعة المصحف الشريف بالمدينة المنورة عبر موسوعة القرآن الكريم (QuranEnc.com)",
    "license": "شروط النشر الحر المعتمدة لموسوعة القرآن الكريم (QuranEnc)",
    "version": "1.0.0",
    "sourceUrl": "https://quranenc.com/ar/browse/arabic_moyassar",
    "totalAyahs": 6236
  },
  "entries": {
    "1": "أبتدئ قراءة القرآن باسم الله مستعينا به...",
    "2": "الثناء على الله بصفاته التي كلُّها أوصاف كمال...",
    "262": "الله الذي لا يستحق الألوهية والعبودية إلا هو، الحيُّ الذي له جميع معاني الحياة الكاملة...",
    "6236": "من شياطين الجن والإنس."
  }
}
```

---

## 4. Build-Time Preparation Pipeline (`tools/tafsir/`)

The script `tools/tafsir/prepare_tafsir_muyassar.py`:
1. Validates presence of `assets/data/quran.json`.
2. Downloads official SQLite database from QuranEnc if not already cached in `tools/tafsir/raw/`.
3. Verifies exactly 6,236 rows in SQLite table `translations`.
4. Asserts 0 null or whitespace-only commentaries.
5. Cross-checks every single Surah ($1..114$) and Ayah ($1..N$) against `quran.json` (`globalStart + a_idx`).
6. Ensures 0 duplicate global keys.
7. Emits deterministic JSON with sorted keys and canonical SHA-256 validation.

To re-run the preparation pipeline:
```bash
python3 tools/tafsir/prepare_tafsir_muyassar.py
```

---

## 5. Domain Models & Repository

### Models (`lib/features/quran/data/models/tafsir_models.dart`)
- **`TafsirSource`**: Immutable entity storing source metadata (id, name, author, publisher, license, attribution, version, sourceUrl).
- **`TafsirEntry`**: Commentary instance for a specific verse (`sourceId`, `globalAyah`, `text`).
- **`TafsirPackage`**: Parsed commentary asset providing $O(1)$ lookups via `entries[globalAyah]`.

### Repository (`lib/features/quran/data/repositories/tafsir_repository.dart`)
- **`load({String sourceId})`**: Asynchronously loads and parses `tafsir-muyassar.json` into memory once.
- **`getTafsir(int globalAyah, [String? sourceId])`**: Instantaneous $O(1)$ in-memory retrieval by canonical global Ayah index.
- **`getSources()`**: Exposes registered commentary sources.
- **`getAvailableTafsirs(int globalAyah)`**: Aggregates entries across all loaded sources for multi-source comparison.

---

## 6. State Management (`lib/features/quran/presentation/cubit/`)

- **`TafsirCubit`**: Manages commentary fetching, source switching, and error handling.
- **`TafsirState`**:
  - `status`: `TafsirStatus.initial`, `loading`, `loaded`, `unavailable`, `error`.
  - `selectedSource`: Active `TafsirSource`.
  - `availableSources`: List of installed sources.
  - `entry`: Current `TafsirEntry?`.
  - `globalAyah`: Currently inspected global verse index.
  - `errorMessage`: Localized error message on failure.

---

## 7. UI & Knowledge Surface (`TafsirKnowledgeSheet`)

Location: `lib/features/quran/presentation/widgets/tafsir_knowledge_sheet.dart`

```
  ┌────────────────────────────────────────────────────────┐
  │                        ───                             │  ← Drag Handle
  │  [📖]  تفسير سورة البقرة                          [✕]  │  ← Context Header
  │        الآية 255 · الجزء 3 · صفحة 42                   │
  ├────────────────────────────────────────────────────────┤
  │  ┌──────────────────────────────────────────────────┐  │
  │  │  ﴿ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ... ﴾ │  │  ← Authentic Quran Verse
  │  └──────────────────────────────────────────────────┘  │
  │                                                        │
  │  التفسير الميسر                       [المصدر ▾]       │  ← Source Header & Selector
  │  نخبة من العلماء بإشراف مجمع الملك فهد                │
  │                                                        │
  │  الله الذي لا يستحق الألوهية والعبودية إلا هو، الحيُّ   │  ← Selectable Commentary Body
  │  الذي له جميع معاني الحياة الكاملة كما يليق بجلاله،    │
  │  القائم على كل شيء، لا تأخذه سِنَة أي: نعاس...        │
  │                                                        │
  │  ┌──────────────────────────────────────────────────┐  │
  │  │ [✓] المصدر: مجمع الملك فهد لطباعة المصحف الشريف    │  │  ← Institutional Attribution
  │  │     بالمدينة المنورة عبر موسوعة القرآن الكريم     │  │
  │  └──────────────────────────────────────────────────┘  │
  └────────────────────────────────────────────────────────┘
```

### Responsive Design:
- **Mobile ($320\text{px} - 430\text{px}$)**: Full-width sheet with safe padding and non-overflowing typography.
- **Tablet / Desktop ($768\text{px} - 1024\text{px}$)**: Centered container constrained to `maxWidth: 680` for comfortable reading line-lengths.
- **Vertical Scrolling**: Contained inside `SingleChildScrollView` within `MediaQuery` height bounds ($0.88 \times H$).
- **Theming**: Full Light and Dark mode contrast compliance with authentic ivory/deep-green palette.

---

## 8. Integration Flow

1. User long-presses an Ayah in `QuranReaderPage`.
2. `AyahActionSheet` opens.
3. User taps `التفسير`.
4. `AyahActionSheet` pops with `'tafsir'`.
5. `QuranReaderPage` receives `'tafsir'` and presents `TafsirKnowledgeSheet.show(...)`.
6. `MushafInteractionCubit` preserves the visual Ayah highlight throughout reading.
7. Upon closing the knowledge sheet, the selection and highlight reset cleanly.

---

## 9. Future Multi-Source Commentary Roadmap

The architecture supports multiple Tafsir sources without code changes:
- Register additional source files in `TafsirRepository._sourceAssets` (e.g. `tafsir-saadi.json`, `tafsir-ibnkathir.json`).
- Source dropdown in `TafsirKnowledgeSheet` allows users to switch between interpretations.
- Individual assets load lazily on demand, keeping base memory consumption minimal.
