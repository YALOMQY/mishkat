# 🕌 MISHKAT QURAN — Q13 PHASE 2.1
## FOCUSED ARCHITECTURE AUDIT REPORT
### Critical Specification Corrections & Architecture Re-Approval Gate

**Project:** Mishkat Quran (`mishkat_app`)  
**Phase:** Q13 Phase 2.1  
**Operating Mode:** STRICT READ-ONLY AUDIT (Zero Production Code Edits)  
**Date:** October 6, 2026  
**Final Architecture Verdict:** **`A — READY FOR IMPLEMENTATION`**

---

### 1. Actual Source Symbols Inspected

During this Phase 2.1 audit, the following concrete source code symbols, files, and classes were inspected:

1. `lib/features/quran/presentation/cubit/quran_memorization_cubit.dart`:
   - `recordReviewOutcome()` (lines 309–412): Inspected review record generation, interval calculation via `AdaptiveMurajaahEngine`, and `_persist()` invocation.
   - `_persist()` (lines 547–552): Inspected repository save delegation.
   - `activeSession` & `MemorizationSession` handling (lines 240–272, 369–378, 440–468).
2. `lib/features/quran/data/models/murajaah_models.dart`:
   - `ReviewOutcome` (lines 6–46): Examined `easy`, `good`, `difficult`, `failed` and mapping to `MemorizationStatus`.
   - `MemorizationReviewRecord` (lines 125–235): Examined JSON serialization, fields (`id`, `globalAyah`, `planId`, `sessionId`, `outcome`, `mistakeCount`, `reviewedAt`, `intervalDays`).
3. `lib/features/quran/data/repositories/quran_memorization_repository.dart`:
   - `saveData()` (lines 140–159): Verified that `writeMap('quran_memorization')` and `saveHistory` (`writeList('quran_memorization_history')`) are called sequentially.
   - `loadData()` & `loadHistory()` (lines 19–128): Examined fallback parsing and history loading.
4. `lib/core/services/local_storage_service.dart`:
   - `LocalStorageService` (lines 1–104): Inspected `_data` in-memory map, atomic `.tmp` file writing and renaming in `_persist()`. Verified lack of multi-key ACID transactions.
5. `lib/features/quran/presentation/cubit/quran_memorization_state.dart`:
   - `computeAnalytics()` (lines 40–51): Inspected analytical aggregation across 6,236 Ayahs, 114 Surahs, and 30 Juz.
6. `lib/features/quran/presentation/services/memorization_analytics_engine.dart`:
   - `MemorizationAnalyticsEngine.compute()` (lines 13–550): Analyzed heavy object instantiation and iteration.
7. `test/features/quran_memorization_analytics_test.dart`:
   - Line 710 (`expect(stopwatch.elapsedMilliseconds, lessThan(15));`): Investigated un-warmed wall-clock flakiness.
8. `lib/features/quran/presentation/pages/quran_reader_page.dart`:
   - `_MushafPageState` (lines 281–450): Inspected `InteractiveViewer`, `Stack`, `SvgPicture.asset`, and `MushafAyahOverlay`.

---

### 2. Audit Findings Supported by Code References

#### 2.1 The Review Idempotency Flaw
- **Current Behavior:** In `quran_memorization_cubit.dart` lines 353–354, review IDs are formatted as `'rev_${current.millisecondsSinceEpoch}_$safeGlobal'`.
- **Finding:** A timestamp-based key cannot guarantee idempotency. If a learner taps an assessment button twice rapidly, or an event is replayed after a debounce window, distinct timestamps are generated. This appends duplicate records to `state.history` and causes duplicate interval calculations.
- **Resolution:** Adopt a deterministic, composite idempotency key: `'rev_${session.sessionId}_${globalAyah}'`.

#### 2.2 Storage Atomicity Reality
- **Current Behavior:** In `quran_memorization_repository.dart` lines 154–157, `storage.writeMap(storageKey, payload)` and `storage.saveHistory(history)` are two separate operations.
- **Finding:** In `local_storage_service.dart`, `writeMap` and `writeList` update the in-memory map `_data` before asynchronously writing to `mishkat_store.json`. While file replacement via `File.rename` is atomic, the multi-key application state must handle crash recovery via explicit save ordering and idempotent key reconciliation on reload.

#### 2.3 Multiple Revealed Ayahs vs. Evaluating Phase
- **Finding:** In multi-ayah visual recall, a learner may reveal Ayah 1 for reading context while attempting to recall Ayah 2.
- **Resolution:** `revealedGlobals` is a set of all unmasked Ayahs. The `evaluating` phase strictly applies to the **active Ayah under evaluation** (`queue[currentIndex]`). If the active Ayah is in `revealedGlobals`, the action dock displays the assessment buttons; otherwise, it displays "كشف الآية", even if previous Ayahs remain unmasked.

---

### 3. Corrected State-Transition Table

| Current Phase | Event | Guard | New Phase | Side Effects & Persistence | Failure / Reject |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`idle`** | `startSingleAyah(g)` | $1 \le g \le 6236$ | **`activeRecall`** | `queue = [g]`, `currentIndex = 0`. Checkpoint saved. | Out of bounds: emit error, remain `idle`. |
| **`idle`** | `startRange(s, e)` | $1 \le s \le e \le 6236$ | **`activeRecall`** | `queue = [s..e]`, `currentIndex = 0`. Checkpoint saved. | Inverted/invalid: emit error, remain `idle`. |
| **`idle`** | `startJourney(q, planId)` | `q.isNotEmpty && all(1..6236)` | **`activeRecall`** | `queue = deduplicate(q)`, `currentIndex = 0`. Checkpoint saved. | Empty/corrupt: emit error, remain `idle`. |
| **`activeRecall`** | `revealCurrentAyah()` | `currentAyah != null` | **`evaluating`** | `revealedGlobals.add(current)`. Dock shows SRS buttons. | Null: no-op. |
| **`activeRecall`** | `revealAllAyahs()` | None | **`evaluating`** | `revealedGlobals.addAll(queue)`. Current Ayah enters `evaluating`. | None. |
| **`evaluating`** | `hideCurrentAyah()` | `currentAyah != null` | **`activeRecall`** | `revealedGlobals.remove(current)`. Dock shows "كشف الآية". | None. |
| **`evaluating`** | `recordOutcome(outcome)`| `outcome in ReviewOutcome.values` | Next index | 1. Idempotently records via `rev_${sessionId}_${current}`.<br>2. `assessmentOutcomes[current] = outcome`.<br>3. If last: transitions to `completed`, checkpoint deleted.<br>4. Else: `currentIndex++`, transitions to `activeRecall`. | Duplicate tap: debounced/ignored. |
| **`activeRecall` / `evaluating`** | `jumpToAyah(g)` | `queue.contains(g)` | `evaluating` if revealed, else `activeRecall` | `currentIndex = queue.indexOf(g)`. Focus updates. | Not in queue: ignored. |
| **`activeRecall` / `evaluating`** | `changePage(p)` | $1 \le p \le 604$ | Same | Viewport updates. Masks render on new page. `lastRead` untouched. | Clamped. |
| **`activeRecall` / `evaluating`** | `endSession()` | None | **`idle`** | Checkpoint purged. Completed outcomes in repository remain safe. | None. |
| **`completed`** | `dismissSummary()` | None | **`idle`** | Resets state to idle. | None. |

---

### 4. Durable Idempotency and Recovery Contract

1. **Deterministic Review ID:** Every review record generated during session `sessionId` for `globalAyah` uses `id = 'rev_${sessionId}_${globalAyah}'`.
2. **Authoritative Log:** `state.history` in `QuranMemorizationCubit` is the sole authoritative record of completed learning events.
3. **Idempotency Guard:** `recordReviewOutcome()` verifies `!state.history.any((r) => r.id == reviewId)` before mutating mastery state or calculating intervals.
4. **Checkpoint Reconciliation:** On restoring a session checkpoint, any Ayah whose deterministic review ID is already present in `state.history` is marked as already assessed in `assessmentOutcomes`.
5. **No Data Loss Invariant:** Stale or corrupt checkpoints are purged without altering or rolling back persisted review history.

---

### 5. Input Validation Rules

1. **Single Ayah Sessions:** $1 \le globalAyah \le 6236$. Violations throw `ArgumentError` (no silent clamping).
2. **Range Selection:** $1 \le start \le end \le 6236$. Rejects inverted ranges ($start > end$).
3. **Journey Queues:** Rejects empty queues; rejects entries outside $[1, 6236]$; deduplicates entries preserving original segment presentation order.
4. **Checkpoint Indices:** Rejects $currentIndex < 0$ or $currentIndex > queue.length$.
5. **Assessment Outcomes:** Validates strictly against `ReviewOutcome.values` (`easy`, `good`, `difficult`, `failed`).
6. **Freshness Window:** Rejects checkpoints older than 24 hours ($86,400,000\text{ ms}$).

---

### 6. UI Lifecycle & Performance Verification Plan

To verify performance empirically without relying on assumptions:
1. **SVG Subtree Rebuild Isolation:**
   - Wrap `CustomPaint(painter: VisualMaskPainter(...))` inside `RepaintBoundary` and `BlocSelector<QuranVisualRecallCubit, QuranVisualRecallState, Set<int>>`.
   - Automated test `test/features/q13_visual_recall_rebuild_test.dart` will verify that `SvgPicture.asset` rebuild count = **0** during mask toggling.
2. **Repaint Invariants:**
   - `VisualMaskPainter.shouldRepaint` returns `false` during matrix zooming and panning, allowing the compositor to transform the existing layer without invoking `paint()`.
3. **Frame Budget Compliance:**
   - Hardware paint execution time: $\le 0.05\text{ ms}$ (median).
   - Frame deadline: $\le 16.67\text{ ms}$ (60 Hz budget) and $\le 8.33\text{ ms}$ (120 Hz ProMotion).

---

### 7. Regression Test Matrix

| Test Suite | Purpose | Target Tests |
| :--- | :--- | :---: |
| `test/features/q13_visual_recall_cubit_test.dart` | Strict validation, single/range start, queue advancement, and completion | 8 |
| `test/features/q13_visual_recall_idempotency_test.dart` | Deterministic review IDs, rapid tap rejection, replay idempotency | 4 |
| `test/features/q13_visual_recall_isolation_test.dart` | Last Read isolation during recall navigation across page boundaries | 3 |
| `test/features/q13_visual_recall_dock_test.dart` | VisualRecallDock rendering, button toggles, progress bar accuracy | 5 |
| `test/features/q13_visual_recall_rebuild_test.dart` | Zero SVG rebuild count and $\le 0.05\text{ ms}$ paint benchmark | 4 |
| `test/features/q13_visual_recall_persistence_test.dart` | Checkpoint save, restore reconciliation, 24-hour expiry | 4 |
| `test/features/q13_visual_recall_integration_test.dart` | Q11 Journey launch and Q12 Audio Tikrar repeat synchronization | 4 |

---

### 8. Flaky Benchmark Investigation (`quran_memorization_analytics_test.dart:710`)

- **Evidence:** `expect(stopwatch.elapsedMilliseconds, lessThan(15));` flaked during sequential full-suite execution (16–18 ms) but passed in 1–2 ms in isolation.
- **Root Cause:** A combination of un-warmed JIT compilation and Garbage Collection pauses during heap allocation of 114 Surah and 30 Juz analytics objects after 120 screenshot tests.
- **Recommended Future Change (Phase 3):**
  Add an un-timed warmup pass immediately prior to the timed invocation:
  ```dart
  state.computeAnalytics(quranData, now: now); // Warmup
  final stopwatch = Stopwatch()..start();
  final analytics = state.computeAnalytics(quranData, now: now);
  stopwatch.stop();
  expect(stopwatch.elapsedMilliseconds, lessThan(15));
  ```

---

### 9. Explicit Unresolved Questions

All critical architectural and correctness questions have been resolved. The remaining open design details are non-blocking UX refinements:
1. *Audio repeat speed selector:* Should the recall dock provide a quick playback speed toggle (0.75×, 1.0×, 1.25×), or rely on `QuranMiniPlayer`?
2. *Haptic feedback:* Should subtle haptic feedback accompany the "كشف الآية" reveal action?
These questions do not block implementation and will be handled during Step 4 UI polish.

---

### 10. List of Changed Documentation Files

1. [`docs/Q13_VISUAL_RECALL_TECHNICAL_SPECIFICATION.md`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/docs/Q13_VISUAL_RECALL_TECHNICAL_SPECIFICATION.md): Updated with critical corrections for durable review idempotency, state-machine completeness, strict input validation, and UI lifecycle.
2. [`docs/Q13_PHASE_2_1_ARCHITECTURE_AUDIT_REPORT.md`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/docs/Q13_PHASE_2_1_ARCHITECTURE_AUDIT_REPORT.md): Created focused architecture audit report.

---

### 11. Final Architecture Verdict

# **`A — READY FOR IMPLEMENTATION`**

**Rationale:**
Every critical correctness, idempotency, state-machine, input validation, and UI lifecycle concern has been explicitly resolved, validated against actual repository code, and documented without ambiguities. Zero production Dart files, SVG assets, or Quran layout metadata were modified. Implementation may begin as soon as authorized.
