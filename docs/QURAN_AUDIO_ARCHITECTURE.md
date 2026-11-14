# 🕌 MISHKAT QURAN — PHASE Q5
## Audio Intelligence & Ayah Synchronization Engine Architecture

---

### 1. Overview & Objectives

Phase Q5 introduces the **Audio Intelligence & Ayah Synchronization Engine** to the Mishkat application, transforming basic single-verse playback into a synchronized, continuous Quran listening and reading experience.

The implementation preserves the foundational tenets established in Phases Q1 through Q4:
- **Zero Asset Modifications**: 604 Madinah Mushaf SVG vector pages remain untouched.
- **Metadata Independence**: `assets/data/mushaf-layout.json` (Q2) and `assets/data/tafsir-muyassar.json` (Q4) remain untouched.
- **Strict Decoupling**: User selection (`selectedAyah`) and audio playback (`playingAyah`) operate independently without state collision.
- **High-Performance Canvas**: High-frequency audio position ticks (e.g. 100ms) are strictly isolated to the Mini Player scrubber, preventing heavy re-renders of the interactive SVG Mushaf.
- **Sequential Playback Across Boundaries**: Seamless progression across Ayahs, Surahs, Pages, and Juz, with full respect for user preferences (auto-scroll toggle, continuous playback toggle).

---

### 2. Core Architecture & Separation of Concerns

```
                     ┌─────────────────────────────┐
                     │         QuranCubit          │
                     │  (Playback Authority & Bus) │
                     └──────────────┬──────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
           ▼                        ▼                        ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│  QuranAudioService   │ │MushafInteractionCubit│ │   QuranMiniPlayer    │
│  (just_audio wrapper,│ │ (Ayah Highlight Sync)│ │  (Isolated Scrubber &│
│  stream streams & IDs│ └──────────┬───────────┘ │   Transport Controls)│
└──────────────────────┘            │             └──────────────────────┘
                                    ▼
                         ┌──────────────────────┐
                         │  MushafAyahOverlay   │
                         │(Dual & Unified Paints│
                         └──────────────────────┘
```

#### Dual State Contract: `selectedAyah` vs. `playingAyah`
- **`selectedAyah` (Q3 Interaction Focus)**:
  - Triggered by user touch/long-press.
  - Controls the Ayah Action Sheet and Tafsir Knowledge Sheet.
  - Highlight Style: Soft Islamic emerald green tint (`0x38107C41` light, `0x524CAF50` dark).
- **`playingAyah` (Q5 Audio Playback Focus)**:
  - Driven in real time by `QuranCubit.state.audioGlobalAyah`.
  - Highlight Style: Warm golden amber tint (`0x3DF59E0B` light, `0x52D97706` dark) with a crisp subtle boundary stroke.
- **Unified State (`selectedAyah.globalAyah == playingAyah`)**:
  - Automatically merges into an enriched golden-emerald blend (`0x450D9488` light, `0x60059669` dark) with dual amber-tinted boundary stroke, visually conveying that the selected verse is the one actively reciting.

---

### 3. Sequential Playback & Boundary Transitions

Playback progression obeys the following state machine:

1. **Ayah Completion**:
   When `QuranAudioService` emits `ProcessingState.completed`:
   - If `continuous == true` and `audioGlobalAyah < 6236`:
     Advances to `audioGlobalAyah + 1`.
   - If `continuous == false` or `audioGlobalAyah == 6236`:
     Stops playback cleanly (`audioStatus = idle`, `audioGlobalAyah = null`).

2. **Surah & Page Boundaries**:
   - When transitioning from Ayah 7 (Al-Fatihah, Page 1) to Ayah 8 (Al-Baqarah, Page 2):
     - `pageForGlobal(8)` resolves to Page 2.
     - If `autoScroll == true`: Reader `PageView` smoothly animates to Page 2, and `currentPage` is updated.
     - If `autoScroll == false`: Reader viewport stays on Page 1 while audio continues playing in the background.

3. **Concurrency & Monotonic Request Tokens**:
   - Fast repeated taps on "Next" or quick Ayah switching could cause stale asynchronous `setUrl()` / `play()` operations to finish out of order.
   - Both `QuranAudioService` and `QuranCubit` employ monotonic request IDs (`_activeRequestId`, `_playbackRequestId`).
   - Any completed load whose request ID is superseded is discarded immediately before emitting state or playing audio.

---

### 4. Quran Mini Player

Located at [`lib/features/quran/presentation/widgets/quran_mini_player.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/widgets/quran_mini_player.dart):
- **Dynamic Visibility**: Automatically collapses to `SizedBox.shrink()` when audio is idle; expands smoothly into an elegant floating card when active.
- **Attribution**: Shows active reciter name (e.g. "مشاري العفاسي") and Surah / Ayah position.
- **Controls**: Previous Ayah, Play/Pause toggle with loading indicator, Next Ayah, Stop button.
- **Isolated Progress Scrubber**:
  - `_MiniPlayerProgressBar` subscribes directly to `QuranAudioService.positionStream` and `QuranAudioService.durationStream`.
  - Position updates (100–200ms) only re-render the progress slider and timestamp labels.
  - Zero re-renders of `QuranReaderPage` or `_MushafPage`.
- **Responsive Layout**: Designed to render elegantly across all screen sizes (tested at 320px, 390px, 768px, and 1024px) in both Light and Dark themes.

---

### 5. Verification & Test Suite Summary

- **Total Feature & Core Tests**: **118 / 118 PASSING**
  - `test/features/quran_audio_sync_test.dart`: 28/28 tests passing.
  - `test/features/tafsir_test.dart`: 29/29 tests passing.
  - `test/features/mushaf_interaction_test.dart`: 27/27 tests passing.
  - `test/features/mushaf_layout_test.dart`: 18/18 tests passing.
  - `test/features/quran_reader_foundation_test.dart`: 11/11 tests passing.
  - `test/core/audio_url_builder_test.dart`: 5/5 tests passing.
- **Static Analysis**: `flutter analyze lib/ test/features/ test/core/` -> **0 issues found**.
- **Vector Artwork Integrity**: All 604 SVG files in `assets/mushaf/pages/` are intact and bit-for-bit identical to source.
