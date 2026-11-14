import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:just_audio/just_audio.dart';
import 'package:mishkat_app/core/services/audio_service.dart';
import 'package:mishkat_app/core/services/local_storage_service.dart';
import 'package:mishkat_app/features/quran/data/models/mushaf_layout_models.dart';
import 'package:mishkat_app/features/quran/data/models/quran_models.dart';
import 'package:mishkat_app/features/quran/data/repositories/quran_repository.dart';
import 'package:mishkat_app/features/quran/presentation/cubit/mushaf_interaction_cubit.dart';
import 'package:mishkat_app/features/quran/presentation/cubit/quran_cubit.dart';
import 'package:mishkat_app/features/quran/presentation/cubit/quran_state.dart';
import 'package:mishkat_app/features/quran/presentation/widgets/mushaf_ayah_overlay.dart';
import 'package:mishkat_app/features/quran/presentation/widgets/quran_mini_player.dart';

class ControllableQuranAudioService implements QuranAudioService {
  final _stateController = StreamController<PlayerState>.broadcast();
  final _positionController = StreamController<Duration>.broadcast();
  final _durationController = StreamController<Duration?>.broadcast();
  final _bufferedController = StreamController<Duration>.broadcast();

  String? lastReciter;
  int? lastGlobalAyah;
  int playAyahCalls = 0;
  bool paused = false;
  bool resumed = false;
  bool stopped = false;
  final List<Duration> seekCalls = [];
  bool simulateErrorOnPlay = false;
  bool emitIdleBeforeReady = false;

  @override
  Stream<PlayerState> get playerState => _stateController.stream;

  @override
  Stream<Duration> get position => _positionController.stream;

  @override
  Stream<Duration> get positionStream => _positionController.stream;

  @override
  Stream<Duration?> get durationStream => _durationController.stream;

  @override
  Stream<Duration> get bufferedPositionStream => _bufferedController.stream;

  @override
  bool get isPlaying => _lastState?.playing ?? false;

  PlayerState? _lastState;
  Duration _currentPosition = Duration.zero;
  Duration? _currentDuration = const Duration(seconds: 15);

  @override
  Duration get currentPosition => _currentPosition;

  @override
  Duration? get duration => _currentDuration;

  void emitState(PlayerState state) {
    _lastState = state;
    _stateController.add(state);
  }

  void emitPosition(Duration pos) {
    _currentPosition = pos;
    _positionController.add(pos);
  }

  void emitDuration(Duration? dur) {
    _currentDuration = dur;
    _durationController.add(dur);
  }

  @override
  Future<void> playAyah({
    required String reciter,
    required int globalAyah,
  }) async {
    playAyahCalls++;
    lastReciter = reciter;
    lastGlobalAyah = globalAyah;
    if (simulateErrorOnPlay) {
      throw Exception('Simulated network error');
    }
    if (emitIdleBeforeReady) {
      emitState(PlayerState(false, ProcessingState.idle));
      await Future<void>.delayed(Duration.zero);
    }
    emitState(PlayerState(true, ProcessingState.ready));
  }

  @override
  Future<void> pause() async {
    paused = true;
    emitState(PlayerState(false, ProcessingState.ready));
  }

  @override
  Future<void> resume() async {
    resumed = true;
    emitState(PlayerState(true, ProcessingState.ready));
  }

  @override
  Future<void> stop() async {
    stopped = true;
    emitState(PlayerState(false, ProcessingState.idle));
  }

  @override
  Future<void> seek(Duration pos) async {
    seekCalls.add(pos);
    emitPosition(pos);
  }

  @override
  Future<void> dispose() async {
    await _stateController.close();
    await _positionController.close();
    await _durationController.close();
    await _bufferedController.close();
  }
}

class FakeLocalStorageService implements LocalStorageService {
  final Map<String, dynamic> _data = {};

  @override
  Future<void> init() async {}

  @override
  Map<String, dynamic> readMap(String key) =>
      Map<String, dynamic>.from((_data[key] as Map?) ?? {});

  @override
  List<dynamic> readList(String key) {
    final value = _data[key];
    return value is List ? List<dynamic>.from(value) : <dynamic>[];
  }

  @override
  int readInt(String key, [int fallback = 0]) {
    final value = _data[key];
    return value is num ? value.toInt() : fallback;
  }

  @override
  Future<void> writeMap(String key, Map<String, dynamic> value) async {
    _data[key] = Map<String, dynamic>.from(value);
  }

  @override
  Future<void> writeList(String key, List<dynamic> value) async {
    _data[key] = value;
  }

  @override
  Future<void> writeInt(String key, int value) async {
    _data[key] = value;
  }

  @override
  Future<void> remove(String key) async {
    _data.remove(key);
  }

  @override
  Future<void> clear() async => _data.clear();
}

QuranData _createMockQuranData() {
  final chapters = [
    const QuranChapter(
      number: 1,
      name: 'الفاتحة',
      englishName: 'Al-Faatiha',
      revelationType: 'Meccan',
      page: 1,
      ayahs: ['1', '2', '3', '4', '5', '6', '7'],
      globalStart: 1,
    ),
    const QuranChapter(
      number: 2,
      name: 'البقرة',
      englishName: 'Al-Baqara',
      revelationType: 'Medinan',
      page: 2,
      ayahs: ['1', '2', '3', '4', '5'],
      globalStart: 8,
    ),
    const QuranChapter(
      number: 114,
      name: 'الناس',
      englishName: 'An-Naas',
      revelationType: 'Meccan',
      page: 604,
      ayahs: ['1', '2', '3', '4', '5', '6'],
      globalStart: 6231,
    ),
  ];

  final juz = [
    const JuzStart(number: 1, surah: 1, ayah: 1),
    const JuzStart(number: 2, surah: 2, ayah: 142),
  ];

  final pages = [
    const MushafPageInfo(
      page: 1,
      first: QuranPoint(surah: 1, ayah: 1, global: 1),
      last: QuranPoint(surah: 1, ayah: 7, global: 7),
    ),
    const MushafPageInfo(
      page: 2,
      first: QuranPoint(surah: 2, ayah: 1, global: 8),
      last: QuranPoint(surah: 2, ayah: 5, global: 12),
    ),
    const MushafPageInfo(
      page: 604,
      first: QuranPoint(surah: 114, ayah: 1, global: 6231),
      last: QuranPoint(surah: 114, ayah: 6, global: 6236),
    ),
  ];

  return QuranData(chapters: chapters, juz: juz, pages: pages);
}

class FakeQuranRepository implements QuranRepository {
  FakeQuranRepository(this.data);
  final QuranData data;

  @override
  Future<QuranData> load() async => data;

  @override
  List<QuranSearchResult> search(
    QuranData data,
    String query, {
    int limit = 50,
  }) => const [];
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ControllableQuranAudioService audioService;
  late FakeLocalStorageService storage;
  late QuranData quranData;
  late FakeQuranRepository repository;
  late QuranCubit quranCubit;

  setUp(() {
    audioService = ControllableQuranAudioService();
    storage = FakeLocalStorageService();
    quranData = _createMockQuranData();
    repository = FakeQuranRepository(quranData);
    quranCubit = QuranCubit(
      repository: repository,
      storage: storage,
      audio: audioService,
      reciter: 'ar.alafasy',
      fontSize: 32,
    );
  });

  tearDown(() async {
    await quranCubit.close();
    await audioService.dispose();
  });

  group('A. Audio Intelligence & Sequential Playback Engine', () {
    test('Initializes in idle state with correct reciter', () {
      expect(quranCubit.state.audioStatus, QuranAudioStatus.idle);
      expect(quranCubit.state.audioGlobalAyah, isNull);
      expect(quranCubit.reciter, 'ar.alafasy');
    });

    test(
      'Play single Ayah starts playback and sets state to playing',
      () async {
        await quranCubit.load();
        await quranCubit.playAyah(1, continuous: false);

        expect(audioService.lastReciter, 'ar.alafasy');
        expect(audioService.lastGlobalAyah, 1);
        expect(quranCubit.state.audioStatus, QuranAudioStatus.playing);
        expect(quranCubit.state.audioGlobalAyah, 1);
      },
    );

    test(
      'Continuous playback auto-advances from Ayah 1 to Ayah 2 upon completion',
      () async {
        await quranCubit.load();
        await quranCubit.playAyah(1, continuous: true);
        expect(quranCubit.state.audioGlobalAyah, 1);

        // Simulate completion of Ayah 1
        audioService.emitState(PlayerState(false, ProcessingState.completed));
        await Future<void>.delayed(Duration.zero);

        expect(quranCubit.state.audioGlobalAyah, 2);
        expect(audioService.lastGlobalAyah, 2);
      },
    );

    test(
      'Saved repeat preferences do not block normal continuous playback',
      () async {
        await storage.writeMap('audio_repeat_config', {
          'mode': 'singleAyah',
          'startGlobalAyah': 1,
          'endGlobalAyah': 1,
          'ayahRepeatCount': 3,
          'rangeRepeatCount': 1,
          'delaySeconds': 0,
        });
        await quranCubit.load();

        await quranCubit.playAyah(4, continuous: true);
        audioService.emitState(PlayerState(false, ProcessingState.completed));
        await Future<void>.delayed(Duration.zero);

        expect(quranCubit.state.audioGlobalAyah, 5);
        expect(audioService.lastGlobalAyah, 5);
      },
    );

    test('Mushaf exit only stops playback owned by the Mushaf', () async {
      await quranCubit.load();
      await quranCubit.playAyah(3, origin: QuranPlaybackOrigin.audioPlayer);

      await quranCubit.stopAudioIfOwnedBy(QuranPlaybackOrigin.mushaf);
      expect(audioService.stopped, isFalse);
      expect(quranCubit.state.audioGlobalAyah, 3);

      await quranCubit.playAyah(7, origin: QuranPlaybackOrigin.mushaf);
      await quranCubit.stopAudioIfOwnedBy(QuranPlaybackOrigin.mushaf);
      expect(audioService.stopped, isTrue);
      expect(quranCubit.state.audioStatus, QuranAudioStatus.idle);
      expect(quranCubit.state.audioGlobalAyah, isNull);
    });

    test('Transient idle while loading the next Ayah does not stop continuous playback', () async {
      await quranCubit.load();
      await quranCubit.playAyah(1, continuous: true);
      audioService.emitIdleBeforeReady = true;

      audioService.emitState(PlayerState(false, ProcessingState.completed));
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      expect(quranCubit.state.audioGlobalAyah, 2);
      expect(quranCubit.state.audioStatus, QuranAudioStatus.playing);
      expect(audioService.lastGlobalAyah, 2);
    });

    test('Continuous playback crosses Surah and Page boundaries: Ayah 7 (p.1) -> Ayah 8 (p.2)', () async {
      await quranCubit.load();
      await quranCubit.openPage(1);
      await quranCubit.playAyah(7, continuous: true, autoScroll: true);

      expect(quranCubit.state.currentPage, 1);
      expect(quranCubit.state.audioGlobalAyah, 7);

      // Complete Ayah 7
      audioService.emitState(PlayerState(false, ProcessingState.completed));
      await Future<void>.delayed(Duration.zero);

      expect(quranCubit.state.audioGlobalAyah, 8);
      expect(quranCubit.state.currentPage, 2);
    });

    test('AutoScroll = false prevents reader page from flipping during sequential audio', () async {
      await quranCubit.load();
      await quranCubit.openPage(1);
      quranCubit.setAutoScroll(false);

      await quranCubit.playAyah(7, continuous: true, autoScroll: false);
      expect(quranCubit.state.currentPage, 1);

      // Complete Ayah 7
      audioService.emitState(PlayerState(false, ProcessingState.completed));
      await Future<void>.delayed(Duration.zero);

      // Audio advanced to Ayah 8 (which is on page 2), but reader stayed on page 1!
      expect(quranCubit.state.audioGlobalAyah, 8);
      expect(quranCubit.state.currentPage, 1);
    });

    test('Reaching Ayah 6236 (last Quran verse) ends playback cleanly without overflow', () async {
      await quranCubit.load();
      await quranCubit.playAyah(6236, continuous: true);
      expect(quranCubit.state.audioGlobalAyah, 6236);

      // Complete Ayah 6236
      audioService.emitState(PlayerState(false, ProcessingState.completed));
      await Future<void>.delayed(Duration.zero);

      expect(quranCubit.state.audioStatus, QuranAudioStatus.idle);
    });

    test(
      'Disabling continuous mode stops after single Ayah completion',
      () async {
        await quranCubit.load();
        await quranCubit.playAyah(3, continuous: false);
        expect(quranCubit.state.audioGlobalAyah, 3);

        audioService.emitState(PlayerState(false, ProcessingState.completed));
        await Future<void>.delayed(Duration.zero);

        expect(quranCubit.state.audioStatus, QuranAudioStatus.idle);
        expect(audioService.playAyahCalls, 1);
      },
    );

    test(
      'Changing reciter while playing reloads active Ayah with new reciter',
      () async {
        await quranCubit.load();
        await quranCubit.playAyah(5, continuous: true);
        expect(audioService.lastReciter, 'ar.alafasy');

        quranCubit.updateReciter('ar.husary', restartIfPlaying: true);
        expect(quranCubit.reciter, 'ar.husary');
        expect(audioService.lastReciter, 'ar.husary');
        expect(audioService.lastGlobalAyah, 5);
      },
    );

    test('Network error gracefully sets audioStatus to failure with friendly error', () async {
      await quranCubit.load();
      audioService.simulateErrorOnPlay = true;

      await quranCubit.playAyah(1, continuous: true);
      expect(quranCubit.state.audioStatus, QuranAudioStatus.failure);
      expect(quranCubit.state.error, contains('تعذّر تشغيل التلاوة'));
    });
  });

  group('B. Decoupled Selection & Audio Synchronization (Q3 vs Q5)', () {
    test('Selected Ayah and Playing Ayah can reside on different verses simultaneously', () {
      final interactionCubit = MushafInteractionCubit();

      const selected = AyahBounds(
        surah: 2,
        ayah: 255,
        page: 42,
        globalAyah: 262,
        bounds: Rect.fromLTWH(10, 20, 200, 30),
        segments: [AyahRectSegment(Rect.fromLTWH(10, 20, 200, 30))],
      );

      interactionCubit.selectAyah(selected);
      interactionCubit.setPlayingAyah(263); // Ayah 256 playing!

      expect(interactionCubit.state.selectedAyah?.globalAyah, 262);
      expect(interactionCubit.state.playingAyah, 263);
      expect(
        interactionCubit.state.selectedAyah!.globalAyah !=
            interactionCubit.state.playingAyah,
        isTrue,
      );

      interactionCubit.close();
    });

    testWidgets(
      'MushafAyahOverlay renders distinct highlights for selection vs playback',
      (tester) async {
        const selected = AyahBounds(
          surah: 1,
          ayah: 1,
          page: 1,
          globalAyah: 1,
          bounds: Rect.fromLTWH(10, 10, 100, 20),
          segments: [AyahRectSegment(Rect.fromLTWH(10, 10, 100, 20))],
        );

        const playing = AyahBounds(
          surah: 1,
          ayah: 2,
          page: 1,
          globalAyah: 2,
          bounds: Rect.fromLTWH(10, 40, 100, 20),
          segments: [AyahRectSegment(Rect.fromLTWH(10, 40, 100, 20))],
        );

        await tester.pumpWidget(
          const MaterialApp(
            home: Scaffold(
              body: MushafAyahOverlay(
                selectedAyah: selected,
                playingAyah: playing,
                viewBox: Rect.fromLTWH(0, 0, 345, 550),
              ),
            ),
          ),
        );

        final overlayCustomPaint = find.descendant(
          of: find.byType(MushafAyahOverlay),
          matching: find.byType(CustomPaint),
        );
        expect(overlayCustomPaint, findsOneWidget);
        final customPaint = tester.widget<CustomPaint>(overlayCustomPaint);
        final painter = customPaint.painter as MushafAyahHighlightPainter;

        expect(painter.selectedAyah, selected);
        expect(painter.playingAyah, playing);
        expect(
          painter.selectedAyah!.globalAyah != painter.playingAyah!.globalAyah,
          isTrue,
        );
      },
    );

    testWidgets(
      'MushafAyahOverlay renders unified highlight when selected == playing',
      (tester) async {
        const active = AyahBounds(
          surah: 1,
          ayah: 1,
          page: 1,
          globalAyah: 1,
          bounds: Rect.fromLTWH(10, 10, 100, 20),
          segments: [AyahRectSegment(Rect.fromLTWH(10, 10, 100, 20))],
        );

        await tester.pumpWidget(
          const MaterialApp(
            home: Scaffold(
              body: MushafAyahOverlay(
                selectedAyah: active,
                playingAyah: active,
                viewBox: Rect.fromLTWH(0, 0, 345, 550),
              ),
            ),
          ),
        );

        final overlayCustomPaint = find.descendant(
          of: find.byType(MushafAyahOverlay),
          matching: find.byType(CustomPaint),
        );
        expect(overlayCustomPaint, findsOneWidget);
        final customPaint = tester.widget<CustomPaint>(overlayCustomPaint);
        final painter = customPaint.painter as MushafAyahHighlightPainter;

        expect(
          painter.selectedAyah!.globalAyah == painter.playingAyah!.globalAyah,
          isTrue,
        );
      },
    );
  });

  group('C. Quran Mini Player Widget UI & Controls', () {
    testWidgets('Mini Player collapses to shrink when audio is idle', (
      tester,
    ) async {
      await quranCubit.load();

      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider.value(
            value: quranCubit,
            child: const Scaffold(body: QuranMiniPlayer()),
          ),
        ),
      );

      expect(find.byType(QuranMiniPlayer), findsOneWidget);
      expect(find.text('القارئ'), findsNothing);
      expect(find.byIcon(Icons.skip_next_rounded), findsNothing);
    });

    testWidgets(
      'Mini Player displays reciter name, Ayah context, and buttons when playing',
      (tester) async {
        await quranCubit.load();
        await quranCubit.playAyah(1, continuous: true);

        await tester.pumpWidget(
          MaterialApp(
            home: BlocProvider.value(
              value: quranCubit,
              child: const Scaffold(body: QuranMiniPlayer()),
            ),
          ),
        );

        await tester.pump();

        expect(find.text('مشاري العفاسي'), findsOneWidget);
        expect(find.text('سورة الفاتحة · الآية 1'), findsOneWidget);
        expect(find.byIcon(Icons.pause_rounded), findsOneWidget);
        expect(find.byIcon(Icons.skip_next_rounded), findsOneWidget);
        expect(find.byIcon(Icons.skip_previous_rounded), findsOneWidget);
        expect(find.byIcon(Icons.close_rounded), findsOneWidget);
      },
    );

    testWidgets('Tapping pause in Mini Player pauses audio', (tester) async {
      await quranCubit.load();
      await quranCubit.playAyah(1, continuous: true);

      await tester.pumpWidget(
        MaterialApp(
          home: BlocProvider.value(
            value: quranCubit,
            child: const Scaffold(body: QuranMiniPlayer()),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.byIcon(Icons.pause_rounded));
      await tester.pump();

      expect(audioService.paused, isTrue);
    });

    testWidgets(
      'Tapping stop in Mini Player stops playback and collapses widget',
      (tester) async {
        await quranCubit.load();
        await quranCubit.playAyah(1, continuous: true);

        await tester.pumpWidget(
          MaterialApp(
            home: BlocProvider.value(
              value: quranCubit,
              child: const Scaffold(body: QuranMiniPlayer()),
            ),
          ),
        );
        await tester.pump();

        await tester.runAsync(() async {
          await tester.tap(find.byIcon(Icons.close_rounded));
        });
        await tester.pump();

        expect(audioService.stopped, isTrue);
        expect(quranCubit.state.audioStatus, QuranAudioStatus.idle);
        expect(find.text('مشاري العفاسي'), findsNothing);
      },
    );

    testWidgets(
      'Scrubbing progress bar triggers seek without full cubit rebuilds',
      (tester) async {
        await quranCubit.load();
        await quranCubit.playAyah(1, continuous: true);
        audioService.emitDuration(const Duration(seconds: 30));
        audioService.emitPosition(const Duration(seconds: 10));

        await tester.pumpWidget(
          MaterialApp(
            home: BlocProvider.value(
              value: quranCubit,
              child: const Scaffold(body: QuranMiniPlayer()),
            ),
          ),
        );
        await tester.pump();

        expect(find.byType(Slider), findsOneWidget);
        final slider = find.byType(Slider);
        await tester.tap(slider);
        await tester.pump();

        expect(audioService.seekCalls.isNotEmpty, isTrue);
      },
    );
  });

  group('D. Responsive Layout & Light/Dark Theme Verification', () {
    for (final width in [320.0, 390.0, 768.0, 1024.0]) {
      for (final isDark in [false, true]) {
        testWidgets(
          'Responsive Mini Player at ${width}px (${isDark ? 'Dark' : 'Light'}) renders without overflow',
          (tester) async {
            tester.view.physicalSize = Size(width, 800);
            tester.view.devicePixelRatio = 1.0;
            addTearDown(() => tester.view.resetPhysicalSize());

            await quranCubit.load();
            await quranCubit.playAyah(1, continuous: true);

            await tester.pumpWidget(
              MaterialApp(
                theme: isDark ? ThemeData.dark() : ThemeData.light(),
                home: BlocProvider.value(
                  value: quranCubit,
                  child: const Scaffold(
                    body: Align(
                      alignment: Alignment.bottomCenter,
                      child: QuranMiniPlayer(),
                    ),
                  ),
                ),
              ),
            );
            await tester.pump();

            expect(find.byType(QuranMiniPlayer), findsOneWidget);
            expect(tester.takeException(), isNull);
          },
        );
      }
    }
  });

  group('E. Concurrency, Race Condition & Rapid Skip Safety', () {
    test(
      'Rapid consecutive calls to playAyah only play the latest requested Ayah',
      () async {
        await quranCubit.load();
        final f1 = quranCubit.playAyah(10, continuous: true);
        final f2 = quranCubit.playAyah(20, continuous: true);
        final f3 = quranCubit.playAyah(30, continuous: true);
        await Future.wait([f1, f2, f3]);

        expect(quranCubit.state.audioGlobalAyah, 30);
        expect(audioService.lastGlobalAyah, 30);
      },
    );

    test('Seeking audio forwards duration to service seek API', () async {
      await quranCubit.load();
      await quranCubit.seekAudio(const Duration(seconds: 45));

      expect(audioService.seekCalls, contains(const Duration(seconds: 45)));
    });

    test('Toggling audio when paused resumes playback', () async {
      await quranCubit.load();
      await quranCubit.playAyah(1, continuous: true);
      await quranCubit.toggleAudio(continuous: true); // pauses
      expect(audioService.paused, isTrue);

      await quranCubit.toggleAudio(continuous: true); // resumes
      expect(audioService.resumed, isTrue);
    });
  });
}
