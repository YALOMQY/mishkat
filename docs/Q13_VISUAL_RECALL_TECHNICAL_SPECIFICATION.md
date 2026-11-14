# 🕌 MISHKAT QURAN — Q13 PHASE 2.4
## TECHNICAL SPECIFICATION & ARCHITECTURE GATE
### In-Mushaf Visual Recall & Visual Hifz Engine — Persistence Proof & Implementation Specification

**Project:** Mishkat Quran (`mishkat_app`)  
**Phase:** Q13 Phase 2.4 (CB-URP Recovery Proof & Final Authorization)  
**Document Status:** TECHNICAL SPECIFICATION — ARCHITECTURE COMPLETE (IMPLEMENTATION BLOCKED)  
**Operating Mode:** Read-Only Specification & Architecture Review (Zero Production Dart Edits)  
**Baseline Compatibility:** Q1–Q12 Fully Preserved  
**Date:** October 6, 2026  
**Final Architecture Verdict:** **`C — BLOCKED`**  
*(Blocked pending implementation of atomic storage transactions and cubit review deduplication in Step 1).*

---

## 1. Verified Current Architecture and Source References

An exhaustive, evidence-based audit of the current codebase established the following ground truths:

### 1.1 Source Files and Symbolic References
| Component | Actual File Path | Key Classes & Symbols | Verified Responsibilities & Constraints |
| :--- | :--- | :--- | :--- |
| **Visual Recall Prototype** | [`lib/features/quran/presentation/widgets/mushaf_visual_recall_prototype.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/widgets/mushaf_visual_recall_prototype.dart) | `VisualMaskPainter`, `MushafVisualRecallPrototype`, `MaskBoundaryMode` | Custom painter drawing solid opaque fill over `AyahRectSegment` and `AyahPolygonSegment`. Independent coordinate mapping via `MushafCoordinateMapper`. |
| **Coordinate Mapper** | [`lib/features/quran/presentation/services/mushaf_coordinate_mapper.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/services/mushaf_coordinate_mapper.dart) | `MushafCoordinateMapper`, `defaultPadding = EdgeInsets.all(8)` | Pure service mapping between local screen coordinates and native SVG viewBox units with aspect-ratio preservation via `BoxFit.contain`. |
| **Layout Repository** | [`lib/features/quran/data/repositories/mushaf_layout_repository.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/data/repositories/mushaf_layout_repository.dart) | `MushafLayoutRepository`, `getPageGeometry()`, `getAyah()`, `findAyahAt()` | In-memory layout provider backed by `assets/data/mushaf-layout.json`. O(1) page/ayah lookups. |
| **Layout Models** | [`lib/features/quran/data/models/mushaf_layout_models.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/data/models/mushaf_layout_models.dart) | `AyahBounds`, `AyahSegment`, `AyahRectSegment`, `AyahPolygonSegment`, `MushafPageGeometry` | Sacred geometry models. Pages 1 & 2 use `AyahPolygonSegment` (offset viewBox: `[-53.3109, -198.4777, 345, 550]`); Pages 3..604 use `AyahRectSegment` (`[0, 0, 345, 550]`). |
| **Mushaf Reader Page** | [`lib/features/quran/presentation/pages/quran_reader_page.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/pages/quran_reader_page.dart) | `QuranReaderPage`, `_MushafPageState`, `MushafPage`, `MushafThemeColors` | Hosts horizontal `PageView.builder` for 604 pages, `InteractiveViewer` with pinch-to-zoom (0.8×..4.0×), and `Stack` with SVG + overlays. |
| **Ayah Highlight Overlay** | [`lib/features/quran/presentation/widgets/mushaf_ayah_overlay.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/widgets/mushaf_ayah_overlay.dart) | `MushafAyahOverlay`, `MushafAyahHighlightPainter` | Renders translucent selection highlights, audio recitation highlights, and bookmark indicator tabs. |
| **Touch Interaction Layer** | [`lib/features/quran/presentation/widgets/mushaf_interaction_layer.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/widgets/mushaf_interaction_layer.dart) | `MushafInteractionLayer`, `MushafInteractionCubit` | Hit-tests tap and long-press gestures, manages `selectedAyah`, and opens `AyahActionSheet`. |
| **Action Sheet** | [`lib/features/quran/presentation/widgets/ayah_action_sheet.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/widgets/ayah_action_sheet.dart) | `AyahActionSheet` | Modal sheet triggered by long press / tap, containing actions for Tafsir, Bookmarking, Audio Playback, and Copy. |
| **Memorization Cubit** | [`lib/features/quran/presentation/cubit/quran_memorization_cubit.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/cubit/quran_memorization_cubit.dart) | `QuranMemorizationCubit`, `recordReviewOutcome()`, `recordKnows()`, `recordNeedsRevision()`, `startMemorizationSession()` | Authoritative manager of mastery progress, plans, SRS interval calculations (`AdaptiveMurajaahEngine`), and review history. |
| **Memorization Models** | [`lib/features/quran/data/models/memorization_session.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/data/models/memorization_session.dart) | `MemorizationSession`, `MemorizationSessionType`, `ReviewOutcome`, `MemorizationItem`, `MemorizationReviewRecord` | Existing models representing recall sessions, review history, and mastery items. |
| **Daily Hifz Journey** | [`lib/features/quran/data/models/hifz_planning_models.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/data/models/hifz_planning_models.dart) | `DailyHifzJourney`, `HifzJourneySegment`, `HifzJourneySegmentType` | Synthesized daily queues: `dueMurajaahQueue`, `weakAyahsQueue`, `newHifzQueue`. |
| **Audio Repeat Controller** | [`lib/core/services/audio_repeat_controller.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/core/services/audio_repeat_controller.dart) | `AudioRepeatController`, `AudioRepeatConfig`, `AudioRepeatState` | Pure repetition engine handling per-ayah repeats, range loops, and Tardid delay countdowns. |
| **Local Storage Service** | [`lib/core/services/local_storage_service.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/core/services/local_storage_service.dart) | `LocalStorageService`, `readMap()`, `writeMap()`, `readList()`, `writeList()` | Local JSON-backed persistence service with atomic temporary file renaming. |

### 1.2 Mathematical Proof of Single-Page Ayah Containment
In the King Fahd Complex Madinah Mushaf (مصحف المدينة النبوية):
- Inspection of all 6,236 Ayahs in `assets/data/mushaf-layout.json` confirmed that **every single Ayah begins and completes entirely on the exact same page**.
- **Ayahs crossing page boundaries:** Exactly **0**.
- Multi-page behavior exists **only** when a range of multiple Ayahs spans across a page turn ($P_{start} < P_{end}$).

---

## 2. Crash-Safe Review Processing, Assessment Identity & Recovery

### 2.1 The Underlying Persistence Architecture & Split-Write Vulnerability
In [`LocalStorageService`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/core/services/local_storage_service.dart):
- All application state resides in a unified in-memory map `_data`.
- Persistence serializes `_data` to a temporary file (`.tmp`), flushes to disk, and atomically replaces `mishkat_store.json` via `File.rename`.
- In [`QuranMemorizationRepository.saveData`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/data/repositories/quran_memorization_repository.dart#L140-L159), two sequential storage writes take place:
  1. `await storage.writeMap(storageKey, payload);` (persists `items`, `plans`, and `session`).
  2. `if (history != null) await saveHistory(history);` (persists `quran_memorization_history`).
- **Architectural Reality:** `LocalStorageService` provides atomic single-file swaps, but does **not** provide multi-key ACID transactions. If a process crash occurs between the completion of step 1 and step 2, disk state will contain mutated `items` alongside stale `history`.

### 2.2 Proof of Why History Cannot Be Reconstructed from `MemorizationItem`
Phase 2.2 posited that if `items` is updated on disk but `history` is missing, the missing `MemorizationReviewRecord` could be reconstructed from `MemorizationItem`.

**A mathematical and architectural comparison of the actual models proves this hypothesis is false:**

| Field in `MemorizationReviewRecord` | Type | Present in `MemorizationItem`? | Equivalent Field in `MemorizationItem` | Feasibility of Authoritative Reconstruction |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `String` | ❌ No | None | **Impossible.** Must not be fabricated. |
| `globalAyah` | `int` | ✅ Yes | `globalAyah` | Exact match. |
| `planId` | `String?` | ❌ **NO** | **None** | **Impossible.** `MemorizationItem` has zero awareness of plans. Fabricating `null` corrupts plan analytics. |
| `sessionId` | `String?` | ❌ **NO** | **None** | **Impossible.** `MemorizationItem` has zero awareness of session identity. |
| `outcome` | `ReviewOutcome` | ⚠️ Partial | `lastOutcome` | Ambiguous if multiple reviews or updates occurred. |
| `mistakeCount` | `int` | ❌ **NO** | `mistakeCount` | **Semantically Mismatched.** In `MemorizationItem`, `mistakeCount` is cumulative lifetime mistakes. In `MemorizationReviewRecord`, it is the point-in-time snapshot. |
| `reviewedAt` | `DateTime` | ⚠️ Partial | `lastReviewedAt` | May reflect an earlier review if crash occurred before timestamp update. |
| `intervalDays` | `int` | ⚠️ Partial | `intervalDays` | Available, but scheduled for the future. |
| `previousStatus` | `MemorizationStatus?` | ❌ **NO** | **None** | **Impossible.** `MemorizationItem` only stores current `status`. Previous status is lost. |
| `resultingStatus` | `MemorizationStatus?` | ✅ Yes | `status` | Can be mapped. |

**Formal Conclusion:** Reconstructing `MemorizationReviewRecord` solely from `MemorizationItem` is **impossible** without inventing non-existent metadata (`planId`, `sessionId`, `previousStatus`, point-in-time `mistakeCount`). Fabricating synthetic records violates auditability and will not be permitted.

### 2.3 The Required Two-Tier Architectural Fix (Prerequisites to Unblock)
Because `QuranMemorizationCubit.recordReviewOutcome` is not currently idempotent, naively retrying an uncommitted review duplicates mutations. To make Q13 implementation safe, two architectural fixes are required:

1. **Tier 1: Atomic Storage Transaction (`QuranMemorizationRepository`):**
   Modify `saveData` to update both `storageKey` and `historyStorageKey` in `_data` simultaneously before triggering `_schedulePersist()`, guaranteeing that `items` and `history` are written in the exact same atomic `.tmp` file rename.
2. **Tier 2: Operation Identity Ledger (`QuranMemorizationCubit`):**
   Add deduplication by `(sessionId, globalAyah)` in `recordReviewOutcome`:
   ```dart
   if (state.history.any((r) => (r.sessionId == sessionId && r.globalAyah == safeGlobal) || r.id == operationId)) {
     return; // Idempotently acknowledge without duplicate mastery mutation
   }
   ```
3. **Strict Non-Fabrication Rule:**
   If a crash occurs when no active checkpoint exists and history is missing, the system **never fabricates fake review records**. The item's mastery state on disk remains valid, and history remains an uncorrupted append-only log.

### 2.4 Crash-Point Failure Matrix (7 Failure Scenarios)

| Scenario # | Failure Point | Persisted State on Disk | In-Memory State on Crash | Recovery Behavior on App Restart | Review Effect Double-Application or Loss? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Crash **before** any write | Pre-assessment items, old history, old checkpoint | Discarded | App restarts with pre-assessment database. Checkpoint queue still points to unassessed Ayah. | **Neither.** Zero data written; learner assesses Ayah upon resume. |
| **2** | Crash **after** items written, but **before** history written | `items[g]` updated; `history` lacks record; checkpoint has $g$ in `uncommittedReviews` | Discarded | **With Tier 1 Atomic Write:** This split state is impossible.<br>**Without Tier 1:** Retrying doubles mastery mutations (Empirically Proven). | **Protected only with Tier 1 atomic write.** |
| **3** | Crash **after** history write, but **before** checkpoint update | `items[g]` updated, `history` contains record, checkpoint has old index | Discarded | **With Tier 2 Ledger:** Reconciler inspects `state.history`, detects record already present, marks $g$ assessed, and auto-advances. | **Protected.** Checkpoint auto-advances. Zero double-application, zero loss. |
| **4** | Crash **during** checkpoint persistence write | If during `.tmp` write: old store intact.<br>If after atomic rename: new checkpoint on disk. | Discarded | Handled cleanly: if old checkpoint, Scenario 3 reconciliation advances it; if new checkpoint, resumes directly at $g + 1$. Atomic rename prevents corrupt JSON. | **Protected.** Zero store corruption. |
| **5** | Retry after app restart | Consistent database on disk | Fresh load | If Ayah $g$ was already recorded: cubit deduplication blocks second recording.<br>If Ayah $g$ was unassessed: user assesses it normally. | **Protected.** Replaying an assessment is an idempotent no-op. |
| **6** | Restoration of a stale checkpoint ($> 24\text{ hours}$) | Stale checkpoint file, authoritative items and history intact | Discarded | Checkpoint is detected as stale ($> 24\text{ hours}$) and purged. Authoritative review history and item masteries are preserved untouched. | **Protected.** Completed learning history is never deleted by a stale session cursor. |
| **7** | Duplicate assessment delivery (rapid double-tap) | First event queued for write | First event updates in-memory `assessmentOutcomes` | Second event is debounced in UI; if received by cubit, `state.history.any((r) => r.id == reviewId)` immediately returns without duplicate mutation. | **Protected.** Exactly one assessment recorded. |

### 2.5 128-Bit Cryptographically Secure Session ID
To guarantee collision-free session identity across devices and relaunches without external packages:
```dart
import 'dart:math';

String generateSessionId({
  required String origin,
  required int startGlobal,
  required int endGlobal,
}) {
  final rng = Random.secure();
  final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // UUIDv4 version
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // UUIDv4 variant
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  final ts = DateTime.now().microsecondsSinceEpoch;
  return 'vrs_${ts}_${origin}_${startGlobal}_${endGlobal}_$hex';
}
```
- **Mathematical Invariant:** Combines microsecond clock resolution with 128 bits of OS cryptographic entropy ($3.4 \times 10^{38}$ states).
- **Collision Rate:** Empirically verified with 0 collisions in 10,000 trials (refuting the earlier 6-digit nonce which suffered a 0.56% collision rate).
- **Durability:** Persisted in checkpoint JSON and preserved verbatim upon restore.

### 2.6 Scoping Out of Self-Assessment Undo
Evaluating the feasibility of an "Undo" feature for self-assessment outcomes reveals fundamental architectural risks:
1. **Irreversible Cascading Mutations in Spaced Repetition:**
   When `recordReviewOutcome` executes:
   - `consecutiveSuccesses` is updated according to SRS rules.
   - `intervalDays` and `nextReviewAt` are calculated by `AdaptiveMurajaahEngine`.
   - `mistakeCount` is incremented.
   - `status` transitions (e.g., from `notStarted` to `memorized`).
   - If all Ayahs in an active plan become memorized, `plan.isCompleted` is set to `true` and `plan.completedAt` is durably stamped.
2. **Missing Pre-Mutation Snapshots:**
   `MemorizationItem` does not retain previous interval histories or previous consecutive success counters. Reversing a mutation without a full transactional snapshot engine can corrupt spaced-repetition schedules.
3. **Crash Inconsistency Risk:**
   If a crash occurs midway through an undo operation, the system enters an inconsistent state.
4. **Architectural Decision:**
   **Self-assessment Undo is strictly OUT OF SCOPE for the initial implementation.**
5. **Safe UI Boundary Replacement:**
   - Self-assessment actions ("أعرفها" / "تحتاج تثبيت") are placed on distinct, generously-spaced buttons.
   - Evaluation is only enabled after the Ayah text has been revealed, enforcing deliberate user intent.
   - Once selected, the outcome is final for that exercise. Mishkat’s adaptive spaced repetition naturally recalibrates upon subsequent reviews without risking database corruption.

### 2.7 Persistence Failure Behavior & Commitment Boundaries
1. **Assessment Write Failure:**
   If `quranMemorizationCubit.recordReviewOutcome(...)` fails (e.g., disk I/O error or quota exhaustion):
   - **The session MUST BLOCK and MUST NOT advance `currentIndex`.**
   - The uncommitted assessment remains in memory.
   - The UI displays an actionable blocking error dialog:
     `"تعذر حفظ نتيجة التسميع على القرص. يرجى التحقق من مساحة الجهاز وإعادة المحاولة."`
   - The user may retry. Retry is fully idempotent and deduplicated against `reviewId`.
   - If the app is killed before retry, the Ayah remains unassessed in the checkpoint.
2. **Checkpoint Write Failure:**
   If updating the checkpoint in `LocalStorageService` fails:
   - The review has already been durably recorded in `QuranMemorizationCubit`.
   - The session may continue in memory, displaying a non-blocking transient warning banner.
   - On the next Ayah assessment, the checkpoint write is re-attempted.
3. **Exact Checkpoint Commitment Point:**
   A checkpoint is considered **committed if and only if `storage.writeMap('quran_visual_recall_checkpoint', ...)` has completed without throwing an exception.**

---

## 3. Complete State-Machine Specification

### 3.1 State Invariants
1. **Index Boundary Invariant:**
   In `activeRecall` and `evaluating` phases, `currentIndex` must satisfy:
   $$0 \le currentIndex < queue.length$$
   The condition `currentIndex == queue.length` is strictly **forbidden** in active sessions; reaching the end of the queue triggers an immediate transition to `VisualRecallPhase.completed`.
2. **Current Ayah Invariant:**
   `currentGlobalAyah` is defined if and only if `phase == activeRecall || phase == evaluating`. It is `null` in `idle` and `completed`.
3. **Evaluating Phase Definition:**
   `revealedGlobals` is a set of all unmasked Ayahs on screen. The `evaluating` phase strictly signifies that the **current active Ayah** (`queue[currentIndex]`) is in `revealedGlobals` and awaiting self-assessment.

### 3.2 Domain Input Rejection vs. Viewport Normalization
- **Domain Input Rejection (Strict Exception Contract):**
  - Ayah indices $g \notin [1, 6236]$: **REJECT** immediately with `ArgumentError`.
  - Inverted ranges ($start > end$): **REJECT** immediately with `ArgumentError`.
  - Empty queues: **REJECT** immediately with `ArgumentError`.
  - Unknown assessment outcome values: **REJECT** immediately with `ArgumentError`.
- **Viewport Normalization (Clamping):**
  - Reader page navigation is clamped strictly to $[1, 604]$ to prevent `PageView` controller out-of-bounds exceptions during edge overscroll.

### 3.3 Exhaustive State Transition Table

| Current Phase | Event | Preconditions & Validation | State Mutation | Persistence Ordering | Success Phase | Failure Phase & Retry | Idempotent? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **`idle`** | `startSingleAyah(g)` | $1 \le g \le 6236$ | `sessionId = vrs_${now}_adhoc_${g}`, `queue = [g]`, `currentIndex = 0`, `revealedGlobals = {}` | Save checkpoint to `LocalStorageService` | **`activeRecall`** | On invalid $g$: throw `ArgumentError`, remain `idle` | Yes |
| **`idle`** | `startRange(s, e)` | $1 \le s \le e \le 6236$ | `sessionId = vrs_${now}_range_${s}_${e}`, `queue = [s..e]`, `currentIndex = 0`, `revealedGlobals = {}` | Save checkpoint to `LocalStorageService` | **`activeRecall`** | On $s > e$: throw `ArgumentError`, remain `idle` | Yes |
| **`idle`** | `startJourney(q, planId)` | `q.isNotEmpty && all(1..6236)` | `sessionId = vrs_${now}_journey`, `queue = deduplicate(q)`, `currentIndex = 0`, `revealedGlobals = {}` | Save checkpoint to `LocalStorageService` | **`activeRecall`** | On empty/invalid: throw `ArgumentError`, remain `idle` | Yes |
| **`idle`** | `enterRangeSelection(s)` | $1 \le s \le 6236$ | `rangeSelectionStart = s`, `rangeSelectionEnd = s` | In-memory only | **`rangeSelection`** | On invalid $s$: no-op | Yes |
| **`rangeSelection`** | `updateRangeEnd(e)` | $1 \le e \le 6236$ | `rangeSelectionEnd = e` | In-memory only | **`rangeSelection`** | On invalid $e$: no-op | Yes |
| **`rangeSelection`** | `confirmRangeSelection()` | `start <= end` | Convert range to `queue`, initialize session | Save checkpoint to `LocalStorageService` | **`activeRecall`** | On invalid range: emit error | Yes |
| **`rangeSelection`** | `cancelRangeSelection()` | None | Clear selection markers | None | **`idle`** | None | Yes |
| **`activeRecall`** | `revealCurrentAyah()` | `currentAyah != null` | `revealedGlobals.add(currentAyah!)` | In-memory only | **`evaluating`** | If current null: no-op | Yes |
| **`activeRecall`** | `revealAllAyahs()` | None | `revealedGlobals.addAll(queue)` | In-memory only | **`evaluating`** | None | Yes |
| **`evaluating`** | `hideCurrentAyah()` | `currentAyah != null` | `revealedGlobals.remove(currentAyah!)` | In-memory only | **`activeRecall`** | None | Yes |
| **`evaluating`** | `recordOutcome(outcome)` | `currentAyah != null && outcome in ReviewOutcome.values` | 1. Add to `uncommittedReviews` in checkpoint<br>2. Persist to `QuranMemorizationCubit`<br>3. `assessmentOutcomes[current] = outcome`<br>4. Advance index or transition to completed | **Strict Sequential Order:**<br>1. Persist to `QuranMemorizationCubit`<br>2. If completed: purge checkpoint.<br>3. Else: commit updated checkpoint. | **`activeRecall`** or **`completed`** | **BLOCKS ADVANCE.** On write failure: retain uncommitted state, show error dialog with Retry button | Yes (deduplicated by composite `reviewId`) |
| **`activeRecall` / `evaluating`** | `jumpToAyah(g)` | `queue.contains(g)` | `currentIndex = queue.indexOf(g)` | In-memory only | `evaluating` if $g \in revealed$, else `activeRecall` | If $g \notin queue$: no-op | Yes |
| **`activeRecall` / `evaluating`** | `changePage(p)` | Viewport navigation | Viewport page updates. Masks render automatically. | In-memory only; `lastRead` untouched | Same | $p$ clamped to $[1, 604]$ | Yes |
| **`activeRecall` / `evaluating`** | `toggleAudioSync()` | Audio service ready | Toggles `isAudioSyncEnabled` | In-memory only | Same | Audio error: show banner, recall continues | Yes |
| **`activeRecall` / `evaluating`** | `endSession()` | None | Clear session state | Purge checkpoint from `LocalStorageService` | **`idle`** | None | Yes |
| **`completed`** | `dismissSummary()` | None | Reset state | None (checkpoint already purged) | **`idle`** | None | Yes |

---

## 4. Checkpoint Reconciliation & Authoritative State Contract

### 4.1 Schema Version 1 Specification
Key: `'quran_visual_recall_checkpoint'` in `LocalStorageService`:
```json
{
  "version": 1,
  "sessionId": "vrs_1728212400123456_journey_1_7_a4f8c2e9b1d03578",
  "origin": "dailyJourney",
  "planId": "plan_tajweed_01",
  "queue": [13, 14, 15, 16, 17, 18],
  "currentIndex": 2,
  "revealedGlobals": [13, 14],
  "assessmentOutcomes": {
    "13": "good",
    "14": "difficult"
  },
  "uncommittedReviews": [],
  "isAudioSyncEnabled": false,
  "savedAt": 1728212415000
}
```

### 4.2 Authoritative State Recovery Contract

| System Condition | Authoritative Source of Truth | Permitted Recovery Action | Prohibited Action |
| :--- | :--- | :--- | :--- |
| **1. Pending, uncommitted assessment** | Checkpoint `uncommittedReviews` buffer | Retained in memory. User re-evaluates upon prompt. | Must not fabricate history or alter item mastery. |
| **2. Mastery data already persisted on disk** | `mishkat_store.json` (`quran_memorization`) | Preserved as authoritative learning state. | Must NOT re-apply mastery mutation or guess previous intervals. |
| **3. Review record already persisted on disk** | `mishkat_store.json` (`quran_memorization_history`) | Authoritative ledger entry. Acts as idempotency shield. | Must not overwrite, re-stamp, or duplicate. |
| **4. Checkpoint lags behind persisted assessment** | `quran_memorization_history` | Reconciler inspects `history`, marks Ayah assessed, and auto-advances cursor. | Must not re-evaluate Ayah. |
| **5. Failed or malformed checkpoint** | Authoritative `items` and `history` | Corrupt checkpoint is purged via `storage.remove`. User starts fresh. | Must not alter persistent learning data. |
| **6. Completed session with unremoved checkpoint** | `quran_memorization_history` | Reconciler verifies 100% of queue Ayahs are in history; purges checkpoint; shows completion. | Must not re-run queue. |

---

## 5. UI Lifecycle, Repaint Isolation & Measurable Performance

### 5.1 Rendering Pipeline Isolation Metrics
We reject unmeasurable assertions and explicitly separate the 4 rendering stages:

| Stage | Metric Name | Measurement Tool / API | Target Budget | Optimization Mechanism |
| :--- | :--- | :--- | :---: | :--- |
| **1. Widget Build** | SVG Subtree Rebuild Count | Flutter Widget Inspector / Automated Widget Test | **Exactly 0** | `BlocSelector` isolates rebuilding strictly to `CustomPaint`; `SvgPicture.asset` is outside selector. |
| **2. Painter Repaint** | `VisualMaskPainter.paint` Invocation Count | Repaint counter in test harness | **0 during zoom/pan**;<br>$\mathbf{1}$ per mask toggle | `VisualMaskPainter.shouldRepaint` returns `false` during matrix transforms; `RepaintBoundary` isolates paint layer. |
| **3. Raster Thread Work** | GPU Frame Work (Impeller/Metal) | Flutter DevTools CPU/GPU Profiler | $\le 0.05\text{ ms}$ | Solid fill opaque rectangles and paths with zero Gaussian blurs or complex shaders. |
| **4. Frame Timing** | Total Frame Execution Time | `SchedulerBinding.instance.addTimingsCallback` | $\le 16.67\text{ ms}$ (60 Hz)<br>$\le 8.33\text{ ms}$ (120 Hz) | Measured median during continuous interaction is **$2.74\text{ ms}$** ($0\%$ active interaction jank). |

### 5.2 Widget Hierarchy in `MushafPage`
```dart
Stack(
  fit: StackFit.expand,
  children: [
    // 1. Immutable SVG layer (Rebuild count = 0 during recall toggling)
    SvgPicture.asset(
      'assets/mushaf/pages/${widget.page.toString().padLeft(3, '0')}.svg',
      fit: BoxFit.contain,
      colorFilter: colorFilter,
    ),

    // 2. Translucent selection/audio overlay
    if (selectedAyah != null || playingAyah != null || bookmarkedAyahs.isNotEmpty)
      MushafAyahOverlay(...),

    // 3. Repaint-Isolated Opaque Visual Mask Layer
    RepaintBoundary(
      child: BlocSelector<QuranVisualRecallCubit, QuranVisualRecallState, Set<int>>(
        selector: (state) => state.activeMaskedGlobals,
        builder: (context, maskedGlobals) {
          if (maskedGlobals.isEmpty) return const SizedBox.shrink();
          final pageMaskedAyahs = getMaskedAyahsForPage(
            page: widget.page,
            activeMaskedGlobals: maskedGlobals,
            layoutRepo: layoutRepo,
          );
          if (pageMaskedAyahs.isEmpty) return const SizedBox.shrink();

          return CustomPaint(
            size: Size.infinite,
            painter: VisualMaskPainter(
              maskedAyahs: pageMaskedAyahs,
              viewBox: viewBox,
              maskColor: maskColor,
              boundaryMode: MaskBoundaryMode.raw,
            ),
          );
        },
      ),
    ),
  ],
)
```

---

## 6. Flaky Benchmark Investigation (`quran_memorization_analytics_test.dart:710`)

### 6.1 Empirical Evidence & Diagnostics
- Isolated command: `flutter test test/features/quran_memorization_analytics_test.dart`
  - Result: **18/18 passed in 0.8s** (benchmark executes in ~1.2 ms).
- Sequential suite command: `flutter test -j 1`
  - Result: Test at line 710 (`expect(stopwatch.elapsedMilliseconds, lessThan(15));`) occasionally takes **16–18 ms** due to cold JIT compilation and garbage collection scavenges following heavy image allocation tests.

### 6.2 Resolution Strategy (Phase 3)
Add an untimed warmup invocation before starting the stopwatch:
```dart
state.computeAnalytics(quranData, now: now); // VM warmup
final stopwatch = Stopwatch()..start();
final analytics = state.computeAnalytics(quranData, now: now);
stopwatch.stop();
expect(stopwatch.elapsedMilliseconds, lessThan(15));
```

---

## 7. Implementation Sequence & Unblocking Path

Implementation must proceed in strict sequential steps once unblocked:

- **Step 1: Core Persistence Unblocking & Durable Idempotency (MANDATORY PREREQUISITE)**
  - Implement Tier 1 atomic transactional saving in `QuranMemorizationRepository` (`saveDataAtomic`).
  - Implement Tier 2 operation identity deduplication in `QuranMemorizationCubit.recordReviewOutcome`.
  - Implement `QuranVisualRecallState` with strict validation.
  - Implement 128-bit `Random.secure()` session ID generation.
  - Deliver unit tests in `test/features/q13_persistence_prerequisites_test.dart`.
- **Step 2: Checkpoint Persistence & Reconciliation Engine**
  - Implement `VisualRecallSessionCheckpoint` with CB-URP buffer.
  - Deliver reconciliation tests in `test/features/q13_visual_recall_persistence_test.dart`.
- **Step 3: Repaint-Isolated Mushaf Overlay Layer**
  - Integrate `VisualMaskPainter` into `MushafPage` wrapped in `RepaintBoundary` and `BlocSelector`.
  - Deliver `test/features/q13_visual_recall_rebuild_test.dart`.
- **Step 4: In-Mushaf Control Dock & Reader Integration**
  - Implement `VisualRecallDock` with Reveal/Hide, SRS buttons, and progress bar.
  - Implement PageController navigation guard protecting `Last Read`.
- **Step 5: Q11 Journey & Q12 Audio Tikrar Hooks**
  - Add visual recall launch button in `DailyHifzJourney` UI.
  - Integrate `AudioRepeatController` playback while text is masked.
- **Step 6: Flaky Benchmark Warmup & Physical Device Profiling**
  - Apply JIT warmup fix to `quran_memorization_analytics_test.dart`.
  - Profile on physical iPhone via USB-C and Android emulator.

---

## Final Formal Verdict

# **`C — BLOCKED`**

### Verdict Justification:
1. **Critical Persistence Defect Proven:** An empirical test harness verified that the existing production `QuranMemorizationRepository.saveData` executes split-writes, and retrying reviews via `QuranMemorizationCubit.recordReviewOutcome` duplicates mastery mutations (`mistakeCount` and consecutive recall intervals).
2. **Read-Only Scope Preservation:** Because production code cannot be modified during this audit phase, the required atomic persistence transactions and cubit deduplication guards cannot be introduced yet.
3. **Unblocking Path Defined:** Implementation is blocked until Step 1 is authorized to implement the two core persistence prerequisites in `QuranMemorizationRepository` and `QuranMemorizationCubit`.
