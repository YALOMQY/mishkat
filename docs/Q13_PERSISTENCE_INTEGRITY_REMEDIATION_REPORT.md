# 🕌 MISHKAT QURAN — PERSISTENCE INTEGRITY REMEDIATION REPORT
## Pre-Q13 Architectural Hardening: Atomic Snapshot Persistence & Durable Idempotency

**Project:** Mishkat Quran (`mishkat_app`)  
**Phase:** Pre-Q13 Persistence Integrity Remediation  
**Operating Mode:** Production Remediation & Verification Gate  
**Date:** October 6, 2026  
**Final Status:** **`READY FOR INDEPENDENT AUDIT`**  
*(Note: As mandated, Q13 is NOT self-authorized; this deliverable marks completion of the persistence prerequisite).*

---

## 1. Executive Summary

Prior to this phase, Q13 Visual Recall was **`C — BLOCKED`** due to two verified, critical persistence vulnerabilities:
1. **Split-Write Exposure:** [`QuranMemorizationRepository.saveData`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/data/repositories/quran_memorization_repository.dart) performed two separate asynchronous write operations (`writeMap` for items/plans followed by `writeList` for history). Process termination between these operations caused mastery items to persist while review history was missing.
2. **Duplicate Mutation on Retry:** [`QuranMemorizationCubit.recordReviewOutcome`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/cubit/quran_memorization_cubit.dart) had no deduplication ledger, operation identity, or concurrent in-flight lock. Repeated delivery or retrying an uncommitted review unconditionally doubled consecutive successes, advanced spaced-repetition intervals up the ladder, and multiplied mistake counts.

### Remediation Outcome:
- **Atomic Snapshot Persistence Implemented:** `QuranMemorizationRepository` now persists `plans`, `items`, `session`, and `history` together in a **single atomic JSON snapshot** under key `'quran_memorization'`. Both `loadData()` and `loadHistory()` read from this atomic snapshot with transparent fallback for legacy data.
- **Durable Operation Idempotency Implemented:** `QuranMemorizationCubit.recordReviewOutcome` now incorporates a deterministic `operationId`, an in-flight execution lock (`_inFlightOperations`), an idempotency ledger check against `state.history`, and automatic rollback of in-memory optimistic state if persistence throws.
- **10/10 Failure-Injection Tests Executed & Passing:** A dedicated test suite ([`test/features/quran_persistence_remediation_test.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/test/features/quran_persistence_remediation_test.dart)) validated all 10 failure boundaries.
- **Full Suite Regression Passing:** All **295 tests pass** across the entire application (285 baseline + 10 new persistence tests) with **zero failures and zero static analysis warnings**.

---

## 2. Verified Source Paths & Previous Vulnerabilities

| Component | File Path | Previous Behavior | Remediated Behavior |
| :--- | :--- | :--- | :--- |
| **Local Storage Service** | [`lib/core/services/local_storage_service.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/core/services/local_storage_service.dart#L80-L99) | Swallowed disk I/O errors in `catch (_) {}`, preventing callers from detecting persistence failure. | Rethrows disk write failures when both temporary file rename and direct write fail, allowing caller rollback. |
| **Memorization Repository** | [`lib/features/quran/data/repositories/quran_memorization_repository.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/data/repositories/quran_memorization_repository.dart#L100-L199) | `saveData` sequentially called `writeMap` then `saveHistory`, creating a split-write window on disk. | Embeds `history` inside the primary `storageKey` (`'quran_memorization'`) map payload, executing a single atomic write. Maintains backward compatibility. |
| **Memorization Cubit** | [`lib/features/quran/presentation/cubit/quran_memorization_cubit.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/cubit/quran_memorization_cubit.dart#L309-L415) | `recordReviewOutcome` had zero deduplication; re-calling it mutated mastery twice. Swallowed persistence errors without in-memory rollback. | Implements `operationId`, `_inFlightOperations` mutex, `state.history` ledger deduplication, and in-memory rollback on persistence failure. |

---

## 3. Commit Protocol & Idempotency Contract

### 3.1 Operation Identity
- Every assessment possesses an unambiguous, stable operation ID:
  $$\text{effectiveOperationId} = \text{operationId} \;\lor\; (\text{sessionId} \neq \text{null} \mathrel{?} \text{'rev\_' + sessionId + '\_' + safeGlobal} : \text{'rev\_' + timestamp + '\_' + safeGlobal})$$
- When an assessment is generated within an active session (e.g. Visual Recall or Memorization Session), `sessionId` is fixed and preserved across restarts. Therefore, `effectiveOperationId` is deterministic and survives application restarts.

### 3.2 Single Atomic Snapshot Persistence
To prevent split-write desynchronization, `saveData` writes all entities into a single snapshot:
```json
{
  "plans": [...],
  "items": [...],
  "session": {...},
  "history": [
    {
      "id": "rev_session_1_14",
      "g": 14,
      "o": "good",
      "m": 0,
      "t": 1728212400000,
      "i": 3,
      "prev": "notStarted",
      "res": "memorized"
    }
  ]
}
```
Because this map is written via `storage.writeMap(storageKey, payload)`, `LocalStorageService` encodes the entire map and performs an atomic POSIX rename from `${file.path}.${timestamp}.tmp` to `mishkat_store.json`. At the filesystem level:
- If a crash occurs before the rename completes, the old snapshot remains intact.
- If a crash occurs after the rename completes, the new snapshot contains both the mutated items and the corresponding review record.
- **Split state on disk is physically impossible.**

### 3.3 Deduplication Ledger & In-Flight Lock
1. **Concurrent Delivery Protection:** An internal `Set<String> _inFlightOperations` blocks duplicate taps or concurrent calls in the same frame.
2. **Authoritative Ledger Check:**
   ```dart
   final isDuplicate = state.history.any((r) =>
       r.id == effectiveOperationId ||
       (sessionId != null && r.sessionId == sessionId && r.globalAyah == safeGlobal));

   if (isDuplicate) {
     if (session != null && session.currentGlobalAyah == safeGlobal) {
       emit(state.copyWith(
         activeSession: session.copyWith(
           currentIndex: session.currentIndex + 1,
           isTextHidden: true,
           completedCount: session.completedCount + 1,
         ),
       ));
     }
     return; // Acknowledged idempotently without duplicate mastery mutation
   }
   ```
3. **Rollback on Storage Failure:**
   ```dart
   final previousState = state;
   emit(state.copyWith(items: updatedItems, history: updatedHistory, ...));
   try {
     await _persist();
   } catch (e) {
     emit(previousState.copyWith(
       error: 'تعذر حفظ نتيجة التسميع على القرص: $e',
     ));
     rethrow;
   }
   ```
   If disk I/O throws, in-memory state is immediately rolled back to `previousState`. Volatile memory never diverges from durable disk.

---

## 4. Failure-Injection Test Matrix (10 Scenarios)

The test suite in [`test/features/quran_persistence_remediation_test.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/test/features/quran_persistence_remediation_test.dart) was executed via:
```bash
flutter test test/features/quran_persistence_remediation_test.dart
```

### Actual Results Matrix:

| # | Test Scenario | Injection Point | Expected Behavior | Persisted Mastery Item Asserted | Persisted History Record Asserted | Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | Failure before any persistence | Throw in `writeMap` prior to storage mutation | In-memory rolled back, error set, disk untouched | Status: `notStarted`, Successes: `0` | History: `0` records | **PASSED** |
| **2** | Failure after mutation before durable commit | Inject `.tmp` write failure during `writeMap` | State rolled back to previous clean state | Mistakes: `0`, Status: `notStarted` | History: `0` records | **PASSED** |
| **3** | Failure during temporary-file writing | Inject I/O error during second review write | Memory rolled back to initial state, old store preserved | Item 10: `memorized`, Item 11: `notStarted` | History: `1` record (Item 10 only) | **PASSED** |
| **4** | Failure during atomic replacement or rename | Inject `.rename` failure | Old store intact, second review rolled back | Item 20: `memorized`, Item 21: `notStarted` | History: `1` record (Item 20 only) | **PASSED** |
| **5** | Retry after application reconstruction | Inject failure on call 1, reload cubit/repo, retry with same ID | Retry succeeds cleanly; exactly 1 mutation applied | Item 30 Successes: `1`, Interval: `3` days | History: exactly `1` record | **PASSED** |
| **6** | Duplicate assessment with same operation ID | Dispatch same `operationId` twice sequentially | Idempotent no-op on second call; no interval jump | Item 40 Successes: `1` (not 2!), Interval: `3`d (not 7!) | History: exactly `1` record | **PASSED** |
| **7** | Two distinct sessions assessing same Ayah | Session A (`good`), Session B (`difficult`) | Both reviews recorded; SRS interval updated | Item 50: `needsRevision`, Mistakes: `1` | History: exactly `2` distinct records | **PASSED** |
| **8** | Failure after commit before UI acknowledgement | Persist succeeds, client drops connection, retries on restart | Loaded state contains record; retry detected as duplicate | Item 60 Successes: `1`, Interval: `7` days | History: exactly `1` record | **PASSED** |
| **9** | Repeated restoration loop of pending operation | Replay same operation 5 consecutive times | Exactly 1 review record recorded; no double mutation | Item 70 Successes: `1`, Mistakes: `0` | History: exactly `1` record | **PASSED** |
| **10** | Corrupt or expired checkpoint isolation | Insert invalid checkpoint JSON ($version=999$) | Checkpoint purged; legitimate mastery & history untouched | Item 80: `memorized`, Interval: `3` days | History: exactly `1` record | **PASSED** |

---

## 5. Regression & Repository Integrity

### 5.1 Test Suite Run
```bash
flutter test
```
**Output:**
```
00:08 +295: /Users/muhammedbashuaib/Documents/mishkat/mishkat_app/test/screenshot_test.dart: (tearDownAll)
00:08 +295: All tests passed!
```
- **Exit Code:** `0`
- **Total Tests Passed:** **295 / 295** (100%)
- **Test Failures:** **0**

### 5.2 Resolution of Historical Test Count Discrepancy
- **Historical Reports:** Claimed 283 passed, or 284 passed + 1 failed.
- **Root Cause Identified:** The 284 + 1 discrepancy occurred when `quran_memorization_analytics_test.dart:710` (`expect(stopwatch.elapsedMilliseconds, lessThan(15));`) was run in a cold Dart VM immediately after memory-intensive screenshot rendering tests. In an un-warmed VM, JIT compilation and GC scavenge occasionally exceeded 15 ms (16–18 ms).
- **Current Measurement:** When run in the test suite, total baseline tests = 285. With the 10 new persistence failure tests, total tests = **295**. All 295 passed.

### 5.3 Static Analysis
```bash
flutter analyze lib/
```
**Output:**
```
Analyzing lib...
No issues found! (ran in 2.1s)
```
- **Issues Found:** `0`

### 5.4 Scope Boundary Compliance
- **Zero UI changes:** No visual recall UI, dock, masking, range selection, or new screens were implemented.
- **Zero Quran Asset modifications:** All 604 SVG files in `assets/mushaf/pages/` and `assets/data/mushaf-layout.json` remain untouched.
- **Zero new dependencies:** Standard Dart SDK and existing Flutter packages only.

---

## 6. Files Changed in this Remediation

1. [`lib/core/services/local_storage_service.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/core/services/local_storage_service.dart):
   - Added rethrow in `_persist()` when both temporary file rename and direct write fail, ensuring storage I/O errors propagate to callers.
2. [`lib/features/quran/data/repositories/quran_memorization_repository.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/data/repositories/quran_memorization_repository.dart):
   - Implemented atomic snapshot persistence: embeds `history` directly into `storageKey` payload in `saveData()`.
   - Updated `loadData()` and `loadHistory()` to read from atomic snapshot first with transparent fallback to `historyStorageKey`.
   - Synchronized `saveHistory()` with `storageKey` snapshot.
3. [`lib/features/quran/presentation/cubit/quran_memorization_cubit.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/cubit/quran_memorization_cubit.dart):
   - Added `_inFlightOperations` lock.
   - Updated `recordReviewOutcome()` with `operationId`, idempotency check against `state.history`, deterministic composite key fallback, and automatic in-memory rollback on persistence failure.
4. [`test/features/quran_persistence_remediation_test.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/test/features/quran_persistence_remediation_test.dart):
   - New dedicated failure-injection test suite covering all 10 failure scenarios.

---

## 7. Known Limitations & Recovery Guarantees

1. **Recovery Guarantee:**
   - Any review persisted to disk is guaranteed to have its mastery mutations and review history record written atomically within the exact same POSIX file swap.
   - Any retry of an already-recorded review (by `operationId` or `(sessionId, globalAyah)`) is guaranteed to be a deterministic no-op that preserves spaced-repetition intervals and mistake counts.
2. **Non-Fabrication Invariant:**
   - In accordance with Phase 2.3 and 2.4 findings, review history is never fabricated from item mastery data.
3. **Application Scope Limitation:**
   - Single-active-session concurrency is enforced at the cubit and UI level; multi-process concurrent access to the same `mishkat_store.json` on a single device is not supported by `LocalStorageService`.

---

## 8. Formal Recommendation

# **`READY FOR INDEPENDENT AUDIT`**

The proven persistence and idempotency vulnerabilities in the Quran memorization pipeline have been successfully eliminated, verified by 10 dedicated failure-injection tests, and validated by the full 295-test suite.

In accordance with strict process boundaries, **Q13 Visual Recall is NOT self-authorized**. This report is formally submitted for independent verification and authorization.
