import 'package:flutter_test/flutter_test.dart';
import 'package:mishkat_app/core/constants/app_constants.dart';
import 'package:mishkat_app/core/services/audio_service.dart';

void main() {
  group('QuranAudioUrlBuilder Tests', () {
    test('Unpadded Ayah numbers for verses 1, 999, 1000, 6236', () {
      final url1 = QuranAudioUrlBuilder.buildUrl(
        reciter: 'ar.alafasy',
        globalAyah: 1,
      );
      expect(
        url1,
        'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3',
      );
      expect(url1.endsWith('/1.mp3'), isTrue);

      final url999 = QuranAudioUrlBuilder.buildUrl(
        reciter: 'ar.alafasy',
        globalAyah: 999,
      );
      expect(
        url999,
        'https://cdn.islamic.network/quran/audio/128/ar.alafasy/999.mp3',
      );
      expect(url999.endsWith('/999.mp3'), isTrue);

      final url1000 = QuranAudioUrlBuilder.buildUrl(
        reciter: 'ar.alafasy',
        globalAyah: 1000,
      );
      expect(
        url1000,
        'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1000.mp3',
      );
      expect(url1000.endsWith('/1000.mp3'), isTrue);

      final url6236 = QuranAudioUrlBuilder.buildUrl(
        reciter: 'ar.alafasy',
        globalAyah: 6236,
      );
      expect(
        url6236,
        'https://cdn.islamic.network/quran/audio/128/ar.alafasy/6236.mp3',
      );
      expect(url6236.endsWith('/6236.mp3'), isTrue);
    });

    test('Dynamic reciter bitrate: 128 kbps vs 64 kbps', () {
      // 128 kbps reciters
      final alafasy = QuranAudioUrlBuilder.buildUrl(
        reciter: 'ar.alafasy',
        globalAyah: 1,
      );
      expect(alafasy, contains('/128/ar.alafasy/'));

      final husary = QuranAudioUrlBuilder.buildUrl(
        reciter: 'ar.husary',
        globalAyah: 1,
      );
      expect(husary, contains('/128/ar.husary/'));

      // 64 kbps reciters
      final abdulbasit = QuranAudioUrlBuilder.buildUrl(
        reciter: 'ar.abdulbasitmurattal',
        globalAyah: 1,
      );
      expect(abdulbasit, contains('/64/ar.abdulbasitmurattal/'));

      final sudais = QuranAudioUrlBuilder.buildUrl(
        reciter: 'ar.abdurrahmaansudais',
        globalAyah: 1,
      );
      expect(sudais, contains('/64/ar.abdurrahmaansudais/'));

      final shuraym = QuranAudioUrlBuilder.buildUrl(
        reciter: 'ar.saoodshuraym',
        globalAyah: 1,
      );
      expect(shuraym, contains('/64/ar.saoodshuraym/'));

      final rifai = QuranAudioUrlBuilder.buildUrl(
        reciter: 'ar.hanirifai',
        globalAyah: 1,
      );
      expect(rifai, contains('/64/ar.hanirifai/'));
    });

    test('Boundary value handling and clamping', () {
      final zeroAyah = QuranAudioUrlBuilder.buildUrl(
        reciter: 'ar.alafasy',
        globalAyah: 0,
      );
      expect(zeroAyah.endsWith('/1.mp3'), isTrue);

      final negativeAyah = QuranAudioUrlBuilder.buildUrl(
        reciter: 'ar.alafasy',
        globalAyah: -42,
      );
      expect(negativeAyah.endsWith('/1.mp3'), isTrue);

      final overflowAyah = QuranAudioUrlBuilder.buildUrl(
        reciter: 'ar.alafasy',
        globalAyah: 99999,
      );
      expect(overflowAyah.endsWith('/6236.mp3'), isTrue);
    });

    test('Fallback for unknown reciter ID', () {
      final unknown = QuranAudioUrlBuilder.buildUrl(
        reciter: 'unknown.reciter',
        globalAyah: 10,
      );
      // Falls back to AppConstants.reciters.first ('ar.alafasy', 128 kbps)
      expect(unknown, contains('/128/ar.alafasy/10.mp3'));
    });

    test('EveryAyah reciters use padded Surah and Ayah filenames', () {
      final juhany = QuranAudioUrlBuilder.buildUrl(
        reciter: 'everyayah.abdullah-juhany',
        globalAyah: 262,
      );
      expect(
        juhany,
        'https://everyayah.com/data/'
        'Abdullaah_3awwaad_Al-Juhaynee_128kbps/002255.mp3',
      );

      final dosari = QuranAudioUrlBuilder.buildUrl(
        reciter: 'everyayah.yasser-aldosari',
        globalAyah: 6236,
      );
      expect(dosari, endsWith('/114006.mp3'));
    });

    test('Segmented Surah reciter resolves the containing Surah audio', () {
      final bandar = QuranAudioUrlBuilder.buildUrl(
        reciter: 'qul.bandar-baleela',
        globalAyah: 262,
      );
      expect(
        bandar,
        'https://download.quranicaudio.com/quran/'
        'bandar_baleela/complete/002.mp3',
      );
    });

    test('QuranAyahIndex maps global boundaries accurately', () {
      expect(QuranAyahIndex.fromGlobal(1).surah, 1);
      expect(QuranAyahIndex.fromGlobal(7).ayah, 7);
      expect(QuranAyahIndex.fromGlobal(8).surah, 2);
      expect(QuranAyahIndex.fromGlobal(262).ayah, 255);
      expect(QuranAyahIndex.fromGlobal(6236).surah, 114);
      expect(QuranAyahIndex.ayahsPerSurah.reduce((a, b) => a + b), 6236);
    });

    test('AppConstants.findReciter lookup accuracy', () {
      expect(AppConstants.findReciter('ar.alafasy').bitrate, 128);
      expect(AppConstants.findReciter('ar.abdulbasitmurattal').bitrate, 64);
      expect(AppConstants.findReciter('ar.saoodshuraym').bitrate, 64);
      expect(AppConstants.findReciter('ar.parhizgar').bitrate, 48);
      expect(AppConstants.findReciter('invalid').id, 'ar.alafasy');
    });

    test('Expanded catalog includes popular verified reciters', () {
      final names = AppConstants.reciters
          .map((reciter) => reciter.name)
          .toSet();
      expect(AppConstants.reciters.length, 28);
      expect(
        names,
        containsAll(<String>[
          'بندر بليلة',
          'عبدالله عواد الجهني',
          'ناصر القطامي',
          'ياسر الدوسري',
          'سعد الغامدي',
          'فارس عباد',
          'صلاح البدير',
          'صلاح بو خاطر',
        ]),
      );
    });
  });
}
