# 🕌 MISHKAT QURAN — INDEPENDENT PERSISTENCE AUDIT REPORT
## Strict Evidence-Based Verification of Pre-Q13 Persistence Remediation

**Project:** Mishkat Quran (`mishkat_app`)  
**Phase:** Pre-Q13 Persistence Integrity Remediation — Independent Audit  
**Operating Mode:** Read-Only Source & Execution Audit  
**Date:** October 7, 2026  
**Final Verdict:** **`C — BLOCKED`**  

---

## 1. Executive Summary & Audit Mandate

An independent, read-only technical audit was conducted on the Pre-Q13 Persistence Integrity Remediation. The remediation report claimed:
- Elimination of split-write exposure via a single atomic JSON snapshot.
- Durable idempotency via operation IDs and history ledger deduplication.
- Safe concurrency via in-flight execution locks.
- Complete rollback of state on disk write failure.
- 10 passing failure-injection tests and full suite regression (295/295 tests).

### Audit Verdict: **`C — BLOCKED`**
While the repository now embeds `history` in the primary `quran_memorization` payload map, the audit revealed **three proven production defects**, **one critical disk-loss window**, and **mock-induced test masking**:
1. **Broken UI Operation Identity (Proven Defect):** Real UI review triggers ([`MemorizationSessionPage.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/pages/memorization_session_page.dart#L293-L435), [`recordKnows()`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/cubit/quran_memorization_cubit.dart#L462-L470), and [`recordNeedsRevision()`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/cubit/quran_memorization_cubit.dart#L474-L482)) **do not pass `sessionId` or `operationId`**. Furthermore, [`QuranMemorizationCubit.recordReviewOutcome`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/cubit/quran_memorization_cubit.dart#L310-L324) checks parameter `sessionId`, **failing to fallback to `state.activeSession?.id`**. Consequently, real user assessments receive timestamp-derived IDs (`rev_${millisecondsSinceEpoch}_$ayah`), completely breaking idempotency on retry or rebuild.
2. **Silent Failure in Concurrent Delivery (Proven Defect):** Concurrent duplicate invocations do not `await` the in-flight operation. They return `Future.value()` immediately. If the original invocation fails during disk persistence and rolls back, the duplicate invocation reports false success to the caller while data is permanently lost.
3. **Catastrophic File-Deletion Window in Storage (Proven Vulnerability):** [`LocalStorageService._persist`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/core/services/local_storage_service.dart#L87-L90) executes `await file.delete()` **before** `await temporary.rename(file.path)`. A crash or process kill between delete and rename destroys `mishkat_store.json`. Because `init()` does not look for `.tmp` files, all user data across the application is permanently lost.
4. **Mocked Failure Injection (Masked Defect):** The 10 failure-injection tests in [`quran_persistence_remediation_test.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/test/features/quran_persistence_remediation_test.dart) were run against an in-memory mock (`ControllableLocalStorageService`), never testing real filesystem boundaries, `.tmp` creation, rename mechanics, or the dirty in-memory `_data` state of `LocalStorageService`.

---

## 2. Source-Code Verification & Detailed Findings

### 2.1 Trace of Operation Identity Across Execution Scenarios

Source location: [`QuranMemorizationCubit.recordReviewOutcome`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/cubit/quran_memorization_cubit.dart#L318-L350)

```dart
final safeGlobal = globalAyah.clamp(1, 6236);
final current = now ?? DateTime.now();
final effectiveOperationId = operationId ??
    (sessionId != null
        ? 'rev_${sessionId}_$safeGlobal'
        : 'rev_${current.millisecondsSinceEpoch}_$safeGlobal');
```

| Scenario | Behavior & Trace | Audit Classification |
| :--- | :--- | :--- |
| **1. Explicit `operationId`** | Uses passed `operationId`. Checked against `state.history.any((r) => r.id == effectiveOperationId)`. If matched, early-returns without duplicating mastery mutations. | **VERIFIED** |
| **2. Active session with `sessionId`** | When `sessionId` argument is provided, evaluates `rev_${sessionId}_$safeGlobal`. Dedup check matches either `r.id` or `(r.sessionId == sessionId && r.globalAyah == safeGlobal)`. Advances session index and early-returns. | **VERIFIED (Unit Contract Only)** |
| **3. Real UI session invocations (`sessionId` omitted)** | In [`MemorizationSessionPage.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/pages/memorization_session_page.dart#L293-L435), all 4 rating buttons (easy, good, difficult, failed) invoke `recordReviewOutcome(globalAyah: globalAyah, outcome: ...)` **without passing `sessionId` or `operationId`**. In `recordReviewOutcome`, `sessionId` argument is `null`. The cubit **does not default `sessionId` from `state.activeSession?.id`**. It evaluates `'rev_${current.millisecondsSinceEpoch}_$safeGlobal'`. | **FAILED (Proven Defect)** |
| **4. Bridge methods `recordKnows()` & `recordNeedsRevision()`** | In lines 462–482 of `quran_memorization_cubit.dart`, `recordKnows` and `recordNeedsRevision` call `recordReviewOutcome(globalAyah: currentGlobal, outcome: ...)` without passing `sessionId: session?.id`. Evaluates timestamp ID. | **FAILED (Proven Defect)** |
| **5. Retry after application restart (without explicit ID)** | Because real UI calls do not pass `sessionId` or `operationId`, an unacknowledged review retried upon restart gets a new `DateTime.now().millisecondsSinceEpoch`. `state.history` ledger check finds no match. **Mastery mutation executes a second time** (consecutive successes incremented again, intervals doubled, mistakes duplicated). | **FAILED (Proven Defect)** |
| **6. Retry after history record trimmed (> 2000 reviews)** | [`QuranMemorizationRepository.maxHistoryRecords`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/data/repositories/quran_memorization_repository.dart#L15) is 2000. When history exceeds 2000 records, older records are dropped. Replaying or retrying an operation whose review record was trimmed evaluates `isDuplicate = false`, mutating mastery a second time. | **UNTESTED RISK (Architectural Limitation)** |

---

### 2.2 Concurrency & In-Flight Lock Verification

Source location: [`QuranMemorizationCubit.recordReviewOutcome`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/cubit/quran_memorization_cubit.dart#L325-L350):

```dart
// 1. Guard against concurrent in-flight delivery of the exact same operation
if (_inFlightOperations.contains(effectiveOperationId)) {
  return;
}
_inFlightOperations.add(effectiveOperationId);
```

#### Finding: Concurrent duplicate does NOT wait for original operation
1. When Invocation 1 is running and awaiting `_persist()`:
   - Invocation 2 arrives with the same `effectiveOperationId`.
   - Invocation 2 sees `_inFlightOperations.contains(effectiveOperationId) == true`.
   - Invocation 2 executes `return;` **immediately**, returning an uncompleted/empty `Future<void>` which completes with success to the UI caller.
   - Invocation 2 **does not await** the outcome of Invocation 1.
2. Failure case analysis:
   - Invocation 1 encounters a disk write error during `await _persist()`.
   - Invocation 1 enters `catch (e)`, rolls back in-memory state:
     ```dart
     emit(previousState.copyWith(
       error: 'تعذر حفظ نتيجة التسميع على القرص: $e',
     ));
     rethrow;
     ```
   - **Invocation 2 has already returned success to its caller**.
   - The UI caller of Invocation 2 assumes the review was recorded and committed, when in reality:
     - The write threw an exception.
     - In-memory state was rolled back to `previousState`.
     - The assessment was lost.
3. Classification: **FAILED (Proven Defect)**.

---

### 2.3 Storage Persistence Path & Crash-Safety Audit

Source location: [`LocalStorageService._persist`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/core/services/local_storage_service.dart#L71-L104)

```dart
await file.parent.create(recursive: true);
final raw = jsonEncode(_data);
final temporary = File('${file.path}.${DateTime.now().microsecondsSinceEpoch}.tmp');
await temporary.writeAsString(raw, flush: true);
if (await file.exists()) {
  await file.delete();
}
await temporary.rename(file.path);
```

#### Finding 1: Catastrophic File Deletion Window
- Lines 87–90 delete the destination file before renaming the temporary file.
- On POSIX filesystems (iOS, macOS, Android, Linux), `rename(2)` is an atomic operation that automatically replaces the target file.
- Explicitly deleting `file` prior to rename introduces a crash window:
  $$\text{write .tmp} \longrightarrow \mathbf{delete(file)} \xrightarrow{\quad\text{CRASH}\quad} \text{rename(.tmp, file)}$$
- If the application is terminated after `await file.delete()` but before `await temporary.rename()`:
  - `mishkat_store.json` no longer exists.
  - Only `${file.path}.${timestamp}.tmp` remains on disk.
  - In `LocalStorageService.init()`:
    ```dart
    _file = File('${_directory!.path}/mishkat_store.json');
    if (!await _file!.exists()) return;
    ```
  - `init()` does not detect or recover orphaned `.tmp` files.
  - The app initializes with empty `_data = {}`, resulting in **100% permanent data loss** across all features (Khatma, Memorization, Bookmarks, Settings).
- Classification: **FAILED (Proven Vulnerability)**.

#### Finding 2: Unreverted In-Memory Dirty Data on Write Failure
Source location: [`LocalStorageService.writeMap`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/core/services/local_storage_service.dart#L43-L46)
```dart
Future<void> writeMap(String key, Map<String, dynamic> value) async {
  _data[key] = value;
  await _persist();
}
```
- If `_persist()` throws (disk full, I/O error), `_data[key]` was already mutated in memory.
- `LocalStorageService` does not revert `_data[key]` on error.
- Any subsequent `storage.readMap(key)` in the same process lifetime returns the unpersisted, dirty memory state.
- Classification: **FAILED (Proven Defect)**.

#### Finding 3: Legacy Key Synchronization Asymmetry
- In `saveData()`: writes `storageKey` first, then optionally syncs `historyStorageKey`.
- In `saveHistory()`: writes `historyStorageKey` first, then updates `storageKey`.
- In `loadData()`: if `storageKey['history']` exists, it takes absolute precedence; `historyStorageKey` is never read.
- If `saveHistory()` crashes between writing `historyStorageKey` and `storageKey`, the updated history is permanently ignored by `loadData()`.
- Classification: **UNTESTED RISK**.

---

### 2.4 Audit of the 10 Failure-Injection Tests

Source location: [`test/features/quran_persistence_remediation_test.dart`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/test/features/quran_persistence_remediation_test.dart)

| Test # | Claimed Failure Boundary | Actual Implementation Inspection | Audit Finding |
| :---: | :--- | :--- | :--- |
| **1** | Failure before persistence | Injects exception in mock `writeMap`. Asserts rollback. | **VERIFIED** against mock. |
| **2** | Failure after mastery mutation before commit | Injects exception in mock `writeMap`. | **VERIFIED** against mock. |
| **3** | Failure during temporary file writing | Sets `failDuringTempFileWrite = true`. Throws at top of mock `writeMap`. No `.tmp` file is ever created or failed. | **FAILED (Mock Masking)**: Did not test real filesystem temporary file creation. |
| **4** | Failure during atomic rename | Sets `failDuringAtomicRename = true`. Throws at top of mock `writeMap`. | **FAILED (Mock Masking)**: Did not test real file rename or delete-before-rename failure. |
| **5** | Retry after reconstruction | Reconstructs repo/cubit with mock storage. Retries with explicit `operationId`. | **VERIFIED** for explicit ID. Does NOT test real UI calls lacking IDs. |
| **6** | Duplicate assessment with same `operationId` | Calls twice with explicit `operationId`. | **VERIFIED** for explicit ID only. |
| **7** | Two distinct sessions assessing same Ayah | Calls with explicit `sessionId: 'session_A'` and `'session_B'`. | **VERIFIED** for explicit `sessionId`. |
| **8** | Failure after commit before UI ack | Uses explicit `operationId` and `sessionId`. Retries with rebooted cubit. | **VERIFIED** for explicit ID only. |
| **9** | Repeated restoration of same pending op | Loop replaying explicit `operationId`. | **VERIFIED** for explicit ID only. |
| **10** | Corrupt/expired session checkpoint | Writes corrupt version to mock. Reloads repo. | **VERIFIED**. |

#### Test Implementation Flaw Summary:
The tests passed because they operated entirely against `ControllableLocalStorageService`, which:
1. Did not mutate its internal map when throwing, thus masking the fact that real `LocalStorageService._data` remains dirty on failure.
2. Did not perform actual file operations, masking the delete-before-rename window.
3. Passed explicit `operationId` and `sessionId` in all idempotency tests, completely masking that production UI call sites omit both parameters.

---

## 3. Independent Verification Execution Results

All commands were independently executed in the repository on October 7, 2026.

### 3.1 Failure-Injection Test Suite
```bash
flutter test test/features/quran_persistence_remediation_test.dart
```
- **Exit Code:** `0`
- **Output:**
  ```text
  00:00 +0: loading test/features/quran_persistence_remediation_test.dart
  ...
  00:00 +10: All tests passed!
  ```
- **Analysis:** 10/10 mock-level tests pass, but as proven above, they do not validate real filesystem boundaries or unparameterized UI call sites.

### 3.2 Full Test Suite Regression
```bash
flutter test
```
- **Exit Code:** `0`
- **Total Tests:** **295 passed**, 0 failed, 0 skipped.
- **Execution Time:** ~10.4 seconds.
- **Output:**
  ```text
  00:10 +295: /Users/muhammedbashuaib/Documents/mishkat/mishkat_app/test/screenshot_test.dart: (tearDownAll)
  00:10 +295: All tests passed!
  ```

### 3.3 Static Analysis
```bash
flutter analyze lib/
```
- **Exit Code:** `0`
- **Output:**
  ```text
  Analyzing lib...
  No issues found! (ran in 1.9s)
  ```

---

## 4. Verification Requirements Classification Matrix

| Requirement | Description | Status | Evidence / Notes |
| :---: | :--- | :---: | :--- |
| **Req 1** | Inspect diffs and source code | **VERIFIED** | Inspected `LocalStorageService`, `QuranMemorizationRepository`, `QuranMemorizationCubit`, and tests. |
| **Req 2a** | Operation ID trace: Explicit `operationId` | **VERIFIED** | Explicit ID is tracked and deduplicated against `state.history`. |
| **Req 2b** | Operation ID trace: Active session with `sessionId` | **VERIFIED** | Unit logic generates `'rev_${sessionId}_$safeGlobal'`. |
| **Req 2c** | Operation ID trace: Real UI / unparameterized review | **FAILED** | `MemorizationSessionPage`, `recordKnows`, and `recordNeedsRevision` do NOT pass `sessionId` or `operationId`. Cubit does not fallback to `state.activeSession?.id`. Fallback generates non-idempotent timestamps. |
| **Req 2d** | Operation ID trace: Retry after process reconstruction | **FAILED** | Retries without explicit IDs generate new timestamps, causing duplicate mastery mutations on reboot. |
| **Req 2e** | Operation ID trace: Retry after history trimmed | **FAILED** | After 2000 reviews, older records are deleted from history. Replayed operations are no longer recognized as duplicates. |
| **Req 3** | Concurrency: Wait for in-flight vs early return | **FAILED** | In-flight duplicates return `Future.value()` immediately without awaiting original. If original fails, duplicate reports false success. |
| **Req 4a** | Persistence path: Atomic snapshot persistence | **VERIFIED** | Repository embeds `history` in `storageKey` payload map. |
| **Req 4b** | Persistence path: Crash-safe file rename | **FAILED** | `LocalStorageService` explicitly deletes destination file before renaming `.tmp`, creating a crash-induced data loss window. |
| **Req 4c** | Persistence path: Error propagation & dirty state | **FAILED** | `_data[key]` is not reverted when `_persist()` throws. |
| **Req 5** | Failure-injection tests validation | **FAILED** | Tests inject exceptions in a memory mock; real filesystem `.tmp`, rename, and dirty memory are not tested. |
| **Req 6** | Independent test & analysis execution | **VERIFIED** | 10/10 focused tests pass, 295/295 full suite tests pass, 0 analyze issues. |
| **Req 7** | Working tree preservation | **VERIFIED** | Git working tree remains completely clean and unmodified. |

---

## 5. Required Remediations Before Q13 Authorization

To attain an **A — READY FOR Q13 AUTHORIZATION** status, the following concrete fixes must be implemented and independently audited:

1. **Fix Session ID Fallback in `QuranMemorizationCubit`:**
   In `recordReviewOutcome`:
   ```dart
   final effectiveSessionId = sessionId ?? state.activeSession?.id;
   final effectiveOperationId = operationId ??
       (effectiveSessionId != null
           ? 'rev_${effectiveSessionId}_$safeGlobal'
           : 'rev_${current.millisecondsSinceEpoch}_$safeGlobal');
   ```
   And in `MemorizationSessionPage.dart`, `recordKnows()`, and `recordNeedsRevision()`, pass `sessionId: state.activeSession?.id`.

2. **Fix Concurrency Await Semantics:**
   Replace the simple `Set<String> _inFlightOperations` early return with an asynchronous lock / completer map:
   ```dart
   final inFlight = _inFlightCompleters[effectiveOperationId];
   if (inFlight != null) {
     await inFlight.future;
     return;
   }
   final completer = Completer<void>();
   _inFlightCompleters[effectiveOperationId] = completer;
   try {
     ...
     completer.complete();
   } catch (e) {
     completer.completeError(e);
     rethrow;
   } finally {
     _inFlightCompleters.remove(effectiveOperationId);
   }
   ```

3. **Eliminate the File Deletion Crash Window in `LocalStorageService`:**
   Remove `await file.delete();` prior to `temporary.rename(file.path)`.
   On platforms requiring replacement, use direct overwrite or atomic rename without pre-deleting.
   Add orphan `.tmp` recovery in `LocalStorageService.init()`.

4. **Revert `LocalStorageService._data` on Persistence Failure:**
   If `_persist()` throws, restore `_data[key]` to its previous state.

5. **Convert Failure-Injection Tests to Real Filesystem Fixtures:**
   Use real `Directory.systemTemp` and real filesystem operations with verifiable error injection (e.g. read-only permissions or mock file system) to validate actual file writes and renames.

---

## 6. Final Audit Verdict

# **`C — BLOCKED`**

**Reasoning:**  
Although the structural consolidation into a single atomic JSON snapshot is a substantial improvement over previous multi-key split writes, critical defects exist in production code:
- Real UI reviews lack stable operation identities and remain vulnerable to duplicate mastery mutations on retry.
- Concurrent duplicate calls falsely acknowledge success when in-flight writes fail.
- Disk persistence possesses a delete-before-rename crash window that can result in total data loss.

In strict compliance with audit rules, **Q13 Visual Recall is NOT authorized**. The required remediations above must be completed before re-auditing.
