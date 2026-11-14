import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mishkat_app/core/services/quran_audio_cache_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('durable offline Quran audio', () {
    late Directory directory;

    setUp(() {
      directory = Directory.systemTemp.createTempSync('mishkat_offline_audio_');
    });

    tearDown(() {
      if (directory.existsSync()) directory.deleteSync(recursive: true);
    });

    test('pinned downloads survive restart and can be removed by range', () async {
      final bytes = List<int>.filled(2048, 0)
        ..[0] = 0xFF
        ..[1] = 0xFB;
      final first = QuranAudioCacheService(baseDirectory: directory);
      await first.init();
      await first.saveFile(
        reciter: 'ar.alafasy',
        globalAyah: 1,
        bytes: bytes,
        pinnedAyahs: const {1},
      );
      await first.saveFile(reciter: 'ar.alafasy', globalAyah: 2, bytes: bytes);

      expect(
        await first.cachedCount(
          reciter: 'ar.alafasy',
          startGlobalAyah: 1,
          endGlobalAyah: 2,
        ),
        1,
      );

      final restarted = QuranAudioCacheService(baseDirectory: directory);
      await restarted.init();
      expect(
        restarted.cachedCountNow(
          reciter: 'ar.alafasy',
          startGlobalAyah: 1,
          endGlobalAyah: 2,
        ),
        1,
      );

      await restarted.removeDownloadRange(
        reciter: 'ar.alafasy',
        startGlobalAyah: 1,
        endGlobalAyah: 2,
      );
      expect(
        await restarted.getCachedFile(reciter: 'ar.alafasy', globalAyah: 1),
        isNull,
      );
      // Removing user downloads must not wipe the opportunistic playback cache.
      expect(
        await restarted.getCachedFile(reciter: 'ar.alafasy', globalAyah: 2),
        isNotNull,
      );
    });
  });
}
