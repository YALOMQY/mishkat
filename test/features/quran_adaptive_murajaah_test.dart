import 'dart:async';

import 'package:just_audio/just_audio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mishkat_app/core/services/audio_service.dart';
import 'package:mishkat_app/core/services/local_storage_service.dart';
import 'package:mishkat_app/features/quran/data/models/memorization_item.dart';
import 'package:mishkat_app/features/quran/data/models/memorization_session.dart';
import 'package:mishkat_app/features/quran/data/models/memorization_status.dart';
import 'package:mishkat_app/features/quran/data/models/murajaah_models.dart';
import 'package:mishkat_app/features/quran/data/models/quran_models.dart';
import 'package:mishkat_app/features/quran/data/repositories/quran_memorization_repository.dart';
import 'package:mishkat_app/features/quran/data/repositories/quran_repository.dart';
import 'package:mishkat_app/features/quran/presentation/cubit/quran_cubit.dart';
import 'package:mishkat_app/features/quran/presentation/cubit/quran_memorization_cubit.dart';
import 'package:mishkat_app/features/quran/presentation/pages/memorization_session_page.dart';
import 'package:mishkat_app/features/quran/presentation/pages/quran_memorization_page.dart';
import 'package:mishkat_app/features/quran/presentation/services/adaptive_murajaah_engine.dart';

class InMemoryLocalStorageService extends LocalStorageService {
  final Map<String, dynamic> _store = {};

  @override
  Map<String, dynamic> readMap(String key) {
    final val = _store[key];
    return val is Map ? Map<String, dynamic>.from(val) : <String, dynamic>{};
  }

  @override
  List<dynamic> readList(String key) {
    final val = _store[key];
    return val is List ? List<dynamic>.from(val) : <dynamic>[];
  }

  @override
  int readInt(String key, [int fallback = 0]) {
    final val = _store[key];
    return val is num ? val.toInt() : fallback;
  }

  @override
  Future<void> writeMap(String key, Map<String, dynamic> value) async {
    _store[key] = Map<String, dynamic>.from(value);
  }

  @override
  Future<void> writeList(String key, List<dynamic> value) async {
    _store[key] = List<dynamic>.from(value);
  }

  @override
  Future<void> writeInt(String key, int value) async {
    _store[key] = value;
  }

  @override
  Future<void> remove(String key) async {
    _store.remove(key);
  }

  @override
  Future<void> clear() async {
    _store.clear();
  }
}

class DummyAudioService implements QuranAudioService {
  final _stateController = StreamController<PlayerState>.broadcast();
  final _positionController = StreamController<Duration>.broadcast();

  @override
  Stream<PlayerState> get playerState => _stateController.stream;

  @override
  Stream<Duration> get position => _positionController.stream;

  @override
  Stream<Duration> get positionStream => _positionController.stream;

  @override
  Stream<Duration?> get durationStream => const Stream.empty();

  @override
  Stream<Duration> get bufferedPositionStream => const Stream.empty();

  @override
  bool get isPlaying => false;

  @override
  Duration get currentPosition => Duration.zero;

  @override
  Duration? get duration => null;

  @override
  Future<void> playAyah({
    required String reciter,
    required int globalAyah,
  }) async {}

  @override
  Future<void> pause() async {}

  @override
  Future<void> resume() async {}

  @override
  Future<void> stop() async {}

  @override
  Future<void> seek(Duration position) async {}

  @override
  Future<void> dispose() async {
    await _stateController.close();
    await _positionController.close();
  }
}

class DummyQuranRepository extends QuranRepository {
  DummyQuranRepository(this.data);
  final QuranData data;

  @override
  Future<QuranData> load() async => data;
}

QuranData createDummyQuranData() {
  final fatiha = const QuranChapter(
    number: 1,
    name: 'الفاتحة',
    englishName: 'Al-Faatiha',
    revelationType: 'Meccan',
    page: 1,
    ayahs: [
      'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
      'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
      'الرَّحْمَٰنِ الرَّحِيمِ',
      'مَالِكِ يَوْمِ الدِّينِ',
      'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
      'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
      'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
    ],
    globalStart: 1,
  );

  return QuranData(
    chapters: [fatiha],
    juz: const [JuzStart(number: 1, surah: 1, ayah: 1)],
    pages: const [
      MushafPageInfo(
        page: 1,
        first: QuranPoint(surah: 1, ayah: 1, global: 1),
        last: QuranPoint(surah: 1, ayah: 7, global: 7),
      ),
    ],
  );
}

void main() {
  const engine = AdaptiveMurajaahEngine();
  final baseTime = DateTime(2026, 10, 5, 10, 0);

  group('Q9 — Domain Models & Review Outcomes', () {
    test('ReviewOutcome parsing, labels, and resultingStatus mapping', () {
      expect(ReviewOutcome.fromString('easy'), ReviewOutcome.easy);
      expect(ReviewOutcome.fromString('good'), ReviewOutcome.good);
      expect(ReviewOutcome.fromString('difficult'), ReviewOutcome.difficult);
      expect(ReviewOutcome.fromString('failed'), ReviewOutcome.failed);
      expect(ReviewOutcome.fromString(null), ReviewOutcome.good);
      expect(ReviewOutcome.fromString('invalid'), ReviewOutcome.good);

      expect(ReviewOutcome.easy.label, 'سهل');
      expect(ReviewOutcome.good.label, 'جيد');
      expect(ReviewOutcome.difficult.label, 'صعب');
      expect(ReviewOutcome.failed.label, 'لم أتذكر');

      expect(ReviewOutcome.easy.resultingStatus, MemorizationStatus.memorized);
      expect(ReviewOutcome.good.resultingStatus, MemorizationStatus.memorized);
      expect(
        ReviewOutcome.difficult.resultingStatus,
        MemorizationStatus.needsRevision,
      );
      expect(
        ReviewOutcome.failed.resultingStatus,
        MemorizationStatus.needsRevision,
      );
    });

    test(
      'MemorizationReviewRecord JSON round-trip and validation clamping',
      () {
        final record = MemorizationReviewRecord(
          id: 'rev_1',
          globalAyah: 255,
          planId: 'plan_1',
          sessionId: 'sess_1',
          outcome: ReviewOutcome.easy,
          mistakeCount: 2,
          reviewedAt: baseTime,
          intervalDays: 7,
          previousStatus: MemorizationStatus.learning,
          resultingStatus: MemorizationStatus.memorized,
        );

        final json = record.toJson();
        final restored = MemorizationReviewRecord.fromJson(json);

        expect(restored.id, 'rev_1');
        expect(restored.globalAyah, 255);
        expect(restored.planId, 'plan_1');
        expect(restored.sessionId, 'sess_1');
        expect(restored.outcome, ReviewOutcome.easy);
        expect(restored.mistakeCount, 2);
        expect(restored.reviewedAt, baseTime);
        expect(restored.intervalDays, 7);
        expect(restored.previousStatus, MemorizationStatus.learning);
        expect(restored.resultingStatus, MemorizationStatus.memorized);

        // Clamping test
        final clamped = MemorizationReviewRecord.fromJson(const {
          'globalAyah': 99999,
          'mistakeCount': -10,
          'intervalDays': -5,
        });
        expect(clamped.globalAyah, 6236);
        expect(clamped.mistakeCount, 0);
        expect(clamped.intervalDays, 0);
      },
    );

    test('MemorizationItem Q9 fields serialization round-trip', () {
      final item = MemorizationItem(
        globalAyah: 1,
        status: MemorizationStatus.memorized,
        mistakeCount: 1,
        updatedAt: baseTime,
        lastReviewedAt: baseTime,
        nextReviewAt: baseTime.add(const Duration(days: 3)),
        intervalDays: 3,
        consecutiveSuccesses: 2,
        lastOutcome: ReviewOutcome.good,
      );

      final json = item.toJson();
      final restored = MemorizationItem.fromJson(json);

      expect(restored.nextReviewAt, baseTime.add(const Duration(days: 3)));
      expect(restored.intervalDays, 3);
      expect(restored.consecutiveSuccesses, 2);
      expect(restored.lastOutcome, ReviewOutcome.good);
    });
  });

  group('Q9 — Adaptive Murajaah Engine & Interval Progression', () {
    test(
      'First review intervals: easy=7d, good=3d, difficult=1d, failed=0d',
      () {
        final freshItem = MemorizationItem(
          globalAyah: 10,
          status: MemorizationStatus.learning,
          updatedAt: baseTime,
        );

        final easyRes = engine.calculateNextInterval(
          item: freshItem,
          outcome: ReviewOutcome.easy,
          now: baseTime,
        );
        expect(easyRes.intervalDays, 7);
        expect(easyRes.nextReviewAt, baseTime.add(const Duration(days: 7)));
        expect(easyRes.consecutiveSuccesses, 1);

        final goodRes = engine.calculateNextInterval(
          item: freshItem,
          outcome: ReviewOutcome.good,
          now: baseTime,
        );
        expect(goodRes.intervalDays, 3);
        expect(goodRes.nextReviewAt, baseTime.add(const Duration(days: 3)));
        expect(goodRes.consecutiveSuccesses, 1);

        final diffRes = engine.calculateNextInterval(
          item: freshItem,
          outcome: ReviewOutcome.difficult,
          now: baseTime,
        );
        expect(diffRes.intervalDays, 1);
        expect(diffRes.nextReviewAt, baseTime.add(const Duration(days: 1)));
        expect(diffRes.consecutiveSuccesses, 0);

        final failRes = engine.calculateNextInterval(
          item: freshItem,
          outcome: ReviewOutcome.failed,
          now: baseTime,
        );
        expect(failRes.intervalDays, 0);
        expect(failRes.nextReviewAt, baseTime);
        expect(failRes.consecutiveSuccesses, 0);
      },
    );

    test('Repeated consecutive Good expands interval across ladder (3 -> 7 -> 14 -> 30 -> 60)', () {
      var item = MemorizationItem(
        globalAyah: 5,
        status: MemorizationStatus.learning,
        updatedAt: baseTime,
      );

      final expectedIntervals = [3, 7, 14, 30, 60, 60];
      for (final expected in expectedIntervals) {
        final res = engine.calculateNextInterval(
          item: item,
          outcome: ReviewOutcome.good,
          now: baseTime,
        );
        expect(res.intervalDays, expected);
        item = item.copyWith(
          consecutiveSuccesses: res.consecutiveSuccesses,
          intervalDays: res.intervalDays,
          nextReviewAt: res.nextReviewAt,
        );
      }
    });

    test('Repeated consecutive Easy expands interval across easy ladder (7 -> 14 -> 30 -> 60 -> 90)', () {
      var item = MemorizationItem(
        globalAyah: 12,
        status: MemorizationStatus.learning,
        updatedAt: baseTime,
      );

      final res1 = engine.calculateNextInterval(
        item: item,
        outcome: ReviewOutcome.easy,
        now: baseTime,
      );
      expect(res1.intervalDays, 7);

      final res2 = engine.calculateNextInterval(
        item: item.copyWith(consecutiveSuccesses: res1.consecutiveSuccesses),
        outcome: ReviewOutcome.easy,
        now: baseTime,
      );
      expect(res2.intervalDays, 14);
    });

    test('Failure collapses interval immediately to 0 and resets consecutive successes', () {
      final strongItem = MemorizationItem(
        globalAyah: 100,
        status: MemorizationStatus.memorized,
        consecutiveSuccesses: 5,
        intervalDays: 60,
        updatedAt: baseTime,
      );

      final res = engine.calculateNextInterval(
        item: strongItem,
        outcome: ReviewOutcome.failed,
        now: baseTime,
      );
      expect(res.intervalDays, 0);
      expect(res.consecutiveSuccesses, 0);
      expect(res.nextReviewAt, baseTime);
    });

    test('Difficult outcome sets interval to 1 day and resets consecutive successes', () {
      final strongItem = MemorizationItem(
        globalAyah: 100,
        status: MemorizationStatus.memorized,
        consecutiveSuccesses: 3,
        intervalDays: 14,
        updatedAt: baseTime,
      );

      final res = engine.calculateNextInterval(
        item: strongItem,
        outcome: ReviewOutcome.difficult,
        now: baseTime,
      );
      expect(res.intervalDays, 1);
      expect(res.consecutiveSuccesses, 0);
      expect(res.nextReviewAt, baseTime.add(const Duration(days: 1)));
    });
  });

  group('Q9 — Adaptive Schedule State & Priority Calculation', () {
    test(
      'Calculates schedule state: due today, overdue, weak, urgent, notDue',
      () {
        // notStarted -> notDue
        final notStarted = MemorizationItem(
          globalAyah: 1,
          status: MemorizationStatus.notStarted,
          updatedAt: baseTime,
        );
        expect(
          engine.calculateScheduleState(notStarted, now: baseTime),
          AdaptiveScheduleState.notDue,
        );

        // Due today
        final dueToday = MemorizationItem(
          globalAyah: 2,
          status: MemorizationStatus.memorized,
          nextReviewAt: baseTime,
          updatedAt: baseTime,
        );
        expect(
          engine.calculateScheduleState(dueToday, now: baseTime),
          AdaptiveScheduleState.due,
        );

        // Overdue (3 days late)
        final overdue = MemorizationItem(
          globalAyah: 3,
          status: MemorizationStatus.memorized,
          nextReviewAt: baseTime.subtract(const Duration(days: 3)),
          updatedAt: baseTime,
        );
        expect(
          engine.calculateScheduleState(overdue, now: baseTime),
          AdaptiveScheduleState.overdue,
        );

        // Urgent (critical mistakes >= 3 and needsRevision)
        final urgent = MemorizationItem(
          globalAyah: 4,
          status: MemorizationStatus.needsRevision,
          mistakeCount: 4,
          updatedAt: baseTime,
        );
        expect(
          engine.calculateScheduleState(urgent, now: baseTime),
          AdaptiveScheduleState.urgent,
        );

        // Weak (needsRevision with 1 mistake)
        final weak = MemorizationItem(
          globalAyah: 5,
          status: MemorizationStatus.needsRevision,
          mistakeCount: 1,
          updatedAt: baseTime,
        );
        expect(
          engine.calculateScheduleState(weak, now: baseTime),
          AdaptiveScheduleState.weak,
        );

        // Future review -> notDue
        final future = MemorizationItem(
          globalAyah: 6,
          status: MemorizationStatus.memorized,
          nextReviewAt: baseTime.add(const Duration(days: 5)),
          updatedAt: baseTime,
        );
        expect(
          engine.calculateScheduleState(future, now: baseTime),
          AdaptiveScheduleState.notDue,
        );
      },
    );

    test(
      'Priority score ranks urgent and overdue higher than well-retained Ayahs',
      () {
        final urgentItem = MemorizationItem(
          globalAyah: 20,
          status: MemorizationStatus.needsRevision,
          mistakeCount: 5,
          nextReviewAt: baseTime.subtract(const Duration(days: 4)),
          lastOutcome: ReviewOutcome.failed,
          updatedAt: baseTime,
        );

        final stableItem = MemorizationItem(
          globalAyah: 10,
          status: MemorizationStatus.memorized,
          consecutiveSuccesses: 4,
          mistakeCount: 0,
          nextReviewAt: baseTime.add(const Duration(days: 10)),
          lastOutcome: ReviewOutcome.easy,
          updatedAt: baseTime,
        );

        final urgentScore = engine.calculatePriority(urgentItem, now: baseTime);
        final stableScore = engine.calculatePriority(stableItem, now: baseTime);

        expect(urgentScore.totalScore > stableScore.totalScore, true);
        expect(urgentScore.scheduleState, AdaptiveScheduleState.urgent);
        expect(stableScore.scheduleState, AdaptiveScheduleState.notDue);
      },
    );

    test('Deterministic queue generation with categories and tie-breaking', () {
      final items = [
        MemorizationItem(
          globalAyah: 50,
          status: MemorizationStatus.needsRevision,
          mistakeCount: 3,
          updatedAt: baseTime,
        ),
        MemorizationItem(
          globalAyah: 20,
          status: MemorizationStatus.needsRevision,
          mistakeCount: 3,
          updatedAt: baseTime,
        ),
        MemorizationItem(
          globalAyah: 100,
          status: MemorizationStatus.memorized,
          nextReviewAt: baseTime.subtract(const Duration(days: 2)),
          updatedAt: baseTime,
        ),
      ];

      final queue = engine.generateQueue(
        items: items,
        category: AdaptiveMurajaahCategory.all,
        limit: 10,
        now: baseTime,
      );

      // Ayah 20 and 50 have identical mistake counts & status, so tie-breaker globalAyah asc puts 20 before 50
      expect(queue.contains(20), true);
      expect(queue.contains(50), true);
      expect(queue.indexOf(20) < queue.indexOf(50), true);
    });

    test('Category filtering respects category boundaries', () {
      final items = [
        MemorizationItem(
          globalAyah: 1,
          status: MemorizationStatus.memorized,
          nextReviewAt: baseTime, // due today
          updatedAt: baseTime,
        ),
        MemorizationItem(
          globalAyah: 2,
          status: MemorizationStatus.memorized,
          nextReviewAt: baseTime.subtract(const Duration(days: 5)), // overdue
          updatedAt: baseTime,
        ),
        MemorizationItem(
          globalAyah: 3,
          status: MemorizationStatus.needsRevision,
          mistakeCount: 2, // weak
          updatedAt: baseTime,
        ),
        MemorizationItem(
          globalAyah: 4,
          status: MemorizationStatus.memorized,
          lastOutcome: ReviewOutcome.difficult, // recently difficult
          nextReviewAt: baseTime.add(const Duration(days: 1)),
          updatedAt: baseTime,
        ),
      ];

      final dueQueue = engine.generateQueue(
        items: items,
        category: AdaptiveMurajaahCategory.dueToday,
        now: baseTime,
      );
      expect(dueQueue.contains(1), true);

      final overdueQueue = engine.generateQueue(
        items: items,
        category: AdaptiveMurajaahCategory.overdue,
        now: baseTime,
      );
      expect(overdueQueue.contains(2), true);
      expect(overdueQueue.contains(1), false);

      final weakQueue = engine.generateQueue(
        items: items,
        category: AdaptiveMurajaahCategory.weak,
        now: baseTime,
      );
      expect(weakQueue.contains(3), true);

      final diffQueue = engine.generateQueue(
        items: items,
        category: AdaptiveMurajaahCategory.recentlyDifficult,
        now: baseTime,
      );
      expect(diffQueue.contains(4), true);
    });
  });

  group('Q9 — Repository Persistence & Review History', () {
    late InMemoryLocalStorageService storage;
    late QuranMemorizationRepository repository;

    setUp(() {
      storage = InMemoryLocalStorageService();
      repository = QuranMemorizationRepository(storage: storage);
    });

    test('Persists and restores review history records accurately', () async {
      final history = [
        MemorizationReviewRecord(
          id: 'rev_1',
          globalAyah: 1,
          outcome: ReviewOutcome.easy,
          mistakeCount: 0,
          reviewedAt: baseTime,
          intervalDays: 7,
        ),
        MemorizationReviewRecord(
          id: 'rev_2',
          globalAyah: 2,
          outcome: ReviewOutcome.failed,
          mistakeCount: 1,
          reviewedAt: baseTime,
          intervalDays: 0,
        ),
      ];

      await repository.saveData(
        plans: const [],
        items: const {},
        history: history,
      );

      final data = await repository.loadData();
      expect(data.history.length, 2);
      expect(data.history[0].globalAyah, 1);
      expect(data.history[0].outcome, ReviewOutcome.easy);
      expect(data.history[1].globalAyah, 2);
      expect(data.history[1].outcome, ReviewOutcome.failed);
    });

    test('Caps history at maxHistoryRecords (2,000) to ensure local-first performance', () async {
      final hugeHistory = List.generate(
        2500,
        (i) => MemorizationReviewRecord(
          id: 'rev_$i',
          globalAyah: (i % 6236) + 1,
          outcome: ReviewOutcome.good,
          mistakeCount: 0,
          reviewedAt: baseTime,
        ),
      );

      await repository.saveHistory(hugeHistory);
      final restored = await repository.loadHistory();
      expect(restored.length, QuranMemorizationRepository.maxHistoryRecords);
      expect(restored.first.id, 'rev_500'); // Trimmed from beginning
      expect(restored.last.id, 'rev_2499');
    });

    test(
      'Corrupted history records are safely skipped without throwing',
      () async {
        storage._store[QuranMemorizationRepository.historyStorageKey] = [
          {'invalid': 'garbage'},
          'corrupt string',
          null,
          {
            'id': 'valid_rev',
            'g': 10,
            'o': 'good',
            'm': 0,
            'r': baseTime.toIso8601String(),
            'iv': 3,
          },
        ];

        final history = await repository.loadHistory();
        expect(history.length, 1);
        expect(history.first.globalAyah, 10);
      },
    );
  });

  group('Q9 — QuranMemorizationCubit Adaptive Actions', () {
    late InMemoryLocalStorageService storage;
    late QuranMemorizationRepository repository;
    late QuranMemorizationCubit cubit;

    setUp(() async {
      storage = InMemoryLocalStorageService();
      repository = QuranMemorizationRepository(storage: storage);
      cubit = QuranMemorizationCubit(repository: repository);
      await cubit.load();
    });

    tearDown(() async {
      await cubit.close();
    });

    test('recordReviewOutcome updates item, adds review record, and advances session', () async {
      final plan = await cubit.createPlan(
        title: 'خطة تجريبية',
        startGlobalAyah: 1,
        endGlobalAyah: 3,
        dailyTarget: 3,
      );

      cubit.startPlanSession(plan);
      expect(cubit.state.activeSession?.currentGlobalAyah, 1);

      // Record easy outcome for Ayah 1
      await cubit.recordReviewOutcome(
        globalAyah: 1,
        outcome: ReviewOutcome.easy,
        now: baseTime,
      );

      final item1 = cubit.state.getItem(1);
      expect(item1.status, MemorizationStatus.memorized);
      expect(item1.lastOutcome, ReviewOutcome.easy);
      expect(item1.consecutiveSuccesses, 1);
      expect(item1.intervalDays, 7);
      expect(cubit.state.history.length, 1);
      expect(cubit.state.history.first.outcome, ReviewOutcome.easy);

      // Session advanced to Ayah 2
      expect(cubit.state.activeSession?.currentIndex, 1);
      expect(cubit.state.activeSession?.currentGlobalAyah, 2);

      // Record failed outcome for Ayah 2
      await cubit.recordReviewOutcome(
        globalAyah: 2,
        outcome: ReviewOutcome.failed,
        now: baseTime,
      );

      final item2 = cubit.state.getItem(2);
      expect(item2.status, MemorizationStatus.needsRevision);
      expect(item2.mistakeCount, 1);
      expect(item2.consecutiveSuccesses, 0);
      expect(item2.intervalDays, 0);
      expect(cubit.state.history.length, 2);

      // Session advanced to Ayah 3
      expect(cubit.state.activeSession?.currentIndex, 2);
      expect(cubit.state.activeSession?.currentGlobalAyah, 3);
    });

    test(
      'startAdaptiveRevisionSession generates queue according to category',
      () async {
        // Set up items with varying states
        await cubit.recordReviewOutcome(
          globalAyah: 10,
          outcome: ReviewOutcome.failed,
          now: baseTime,
        );
        await cubit.recordReviewOutcome(
          globalAyah: 20,
          outcome: ReviewOutcome.difficult,
          now: baseTime,
        );

        cubit.startAdaptiveRevisionSession(
          category: AdaptiveMurajaahCategory.weak,
          limit: 10,
        );

        final session = cubit.state.activeSession;
        expect(session, isNotNull);
        expect(session?.sessionType, MemorizationSessionType.revision);
        expect(session?.queue.contains(10), true);
        expect(session?.queue.contains(20), true);
      },
    );

    test('Adaptive getters count reviews today, this week, and this month correctly', () async {
      final now = DateTime(2026, 10, 5, 12, 0);
      await cubit.recordReviewOutcome(
        globalAyah: 1,
        outcome: ReviewOutcome.good,
        now: now,
      );
      await cubit.recordReviewOutcome(
        globalAyah: 2,
        outcome: ReviewOutcome.easy,
        now: now.subtract(const Duration(days: 2)),
      );
      await cubit.recordReviewOutcome(
        globalAyah: 3,
        outcome: ReviewOutcome.good,
        now: now.subtract(const Duration(days: 15)),
      );

      expect(cubit.state.reviewsCountToday(now: now), 1);
      expect(cubit.state.reviewsCountThisWeek(now: now), 2);
      expect(cubit.state.reviewsCountThisMonth(now: now), 3);
    });
  });

  group('Q9 — Widget Smoke Tests for Adaptive UI', () {
    late InMemoryLocalStorageService storage;
    late QuranMemorizationRepository repository;
    late QuranMemorizationCubit cubit;
    late QuranCubit quranCubit;
    late QuranData dummyData;

    setUp(() async {
      storage = InMemoryLocalStorageService();
      repository = QuranMemorizationRepository(storage: storage);
      cubit = QuranMemorizationCubit(repository: repository);
      await cubit.load();

      dummyData = createDummyQuranData();

      quranCubit = QuranCubit(
        storage: storage,
        repository: DummyQuranRepository(dummyData),
        audio: DummyAudioService(),
        reciter: 'ar.alafasy',
        fontSize: 22.0,
      );
      await quranCubit.load();
    });

    tearDown(() async {
      await cubit.close();
      await quranCubit.close();
    });

    testWidgets('MemorizationSessionPage renders 4-tier assessment buttons', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(1000, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final plan = await cubit.createPlan(
        title: 'خطة الورد',
        startGlobalAyah: 1,
        endGlobalAyah: 2,
        dailyTarget: 2,
      );
      cubit.startPlanSession(plan);

      await tester.pumpWidget(
        MaterialApp(
          home: MultiBlocProvider(
            providers: [
              BlocProvider<QuranMemorizationCubit>.value(value: cubit),
              BlocProvider<QuranCubit>.value(value: quranCubit),
            ],
            child: MemorizationSessionPage(quranData: dummyData),
          ),
        ),
      );

      // Verify the 4 assessment buttons are present
      expect(find.text('سهل'), findsOneWidget);
      expect(find.text('أعرفها ومحفوظة'), findsOneWidget);
      expect(find.text('أحتاج مراجعة'), findsOneWidget);
      expect(find.text('لم أتذكر'), findsOneWidget);

      // Tap 'سهل' and confirm record
      await tester.tap(find.text('سهل'));
      await tester.pumpAndSettle();

      expect(cubit.state.history.length, 1);
      expect(cubit.state.history.first.outcome, ReviewOutcome.easy);
    });

    testWidgets(
      'QuranMemorizationPage explains and opens adaptive review types',
      (tester) async {
        tester.view.physicalSize = const Size(1000, 2000);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
        });

        await tester.pumpWidget(
          MaterialApp(
            home: MultiBlocProvider(
              providers: [
                BlocProvider<QuranMemorizationCubit>.value(value: cubit),
                BlocProvider<QuranCubit>.value(value: quranCubit),
              ],
              child: const QuranMemorizationPage(),
            ),
          ),
        );

        expect(find.text('المراجعة الذكية والتثبيت'), findsOneWidget);
        expect(find.text('اختيار نوع المراجعة'), findsOneWidget);
        await tester.tap(find.text('اختيار نوع المراجعة'));
        await tester.pumpAndSettle();

        expect(find.text('مستحقة اليوم'), findsWidgets);
        expect(find.text('متأخرة'), findsWidgets);
        expect(find.text('تحتاج تثبيت'), findsWidgets);
        expect(find.text('شاملة'), findsOneWidget);
        expect(find.text('صعبة مؤخراً'), findsOneWidget);
      },
    );
  });
}
