class AppConstants {
  const AppConstants._();

  static const appName = 'مشكاة';
  static const totalQuranPages = 604;
  static const totalAyahs = 6236;
  static const kaabaLatitude = 21.4225;
  static const kaabaLongitude = 39.8262;

  static const reciters = <ReciterInfo>[
    ReciterInfo('ar.alafasy', 'مشاري العفاسي', 128),
    ReciterInfo('ar.abdulbasitmurattal', 'عبد الباسط — مرتل', 64),
    ReciterInfo('ar.abdurrahmaansudais', 'عبد الرحمن السديس', 64),
    ReciterInfo('ar.mahermuaiqly', 'ماهر المعيقلي', 128),
    ReciterInfo('ar.husary', 'محمود الحصري', 128),
    ReciterInfo('ar.minshawi', 'محمد صديق المنشاوي', 128),
    ReciterInfo('ar.saoodshuraym', 'سعود الشريم', 64),
    ReciterInfo('ar.hudhaify', 'علي الحذيفي', 128),
    ReciterInfo('ar.ahmedajamy', 'أحمد العجمي', 128),
    ReciterInfo('ar.muhammadayyoub', 'محمد أيوب', 128),
    ReciterInfo('ar.shaatree', 'أبو بكر الشاطري', 128),
    ReciterInfo('ar.hanirifai', 'هاني الرفاعي', 64),
    ReciterInfo(
      'everyayah.abdullah-juhany',
      'عبدالله عواد الجهني',
      128,
      source: ReciterAudioSource.everyAyah,
      audioPath: 'Abdullaah_3awwaad_Al-Juhaynee_128kbps',
    ),
    ReciterInfo(
      'everyayah.nasser-alqatami',
      'ناصر القطامي',
      128,
      source: ReciterAudioSource.everyAyah,
      audioPath: 'Nasser_Alqatami_128kbps',
    ),
    ReciterInfo(
      'everyayah.yasser-aldosari',
      'ياسر الدوسري',
      128,
      source: ReciterAudioSource.everyAyah,
      audioPath: 'Yasser_Ad-Dussary_128kbps',
    ),
    ReciterInfo(
      'qul.bandar-baleela',
      'بندر بليلة',
      128,
      source: ReciterAudioSource.segmentedSurah,
      audioPath: 'bandar_baleela/complete',
      segmentRecitationId: 160,
    ),
    ReciterInfo('ar.abdullahbasfar', 'عبدالله بصفر', 64),
    ReciterInfo('ar.abdulsamad', 'عبدالباسط عبدالصمد — مجود', 64),
    ReciterInfo('ar.husarymujawwad', 'محمود الحصري — مجود', 128),
    ReciterInfo('ar.ibrahimakhbar', 'إبراهيم الأخضر', 32),
    ReciterInfo('ar.muhammadjibreel', 'محمد جبريل', 128),
    ReciterInfo('ar.aymanswoaid', 'أيمن سويد', 64),
    ReciterInfo('ar.parhizgar', 'شهريار برهيزكار', 48),
    ReciterInfo(
      'everyayah.saad-alghamdi',
      'سعد الغامدي',
      40,
      source: ReciterAudioSource.everyAyah,
      audioPath: 'Ghamadi_40kbps',
    ),
    ReciterInfo(
      'everyayah.fares-abbad',
      'فارس عباد',
      64,
      source: ReciterAudioSource.everyAyah,
      audioPath: 'Fares_Abbad_64kbps',
    ),
    ReciterInfo(
      'everyayah.abdullah-matroud',
      'عبدالله المطرود',
      128,
      source: ReciterAudioSource.everyAyah,
      audioPath: 'Abdullah_Matroud_128kbps',
    ),
    ReciterInfo(
      'everyayah.salah-albudair',
      'صلاح البدير',
      128,
      source: ReciterAudioSource.everyAyah,
      audioPath: 'Salah_Al_Budair_128kbps',
    ),
    ReciterInfo(
      'everyayah.salah-bukhatir',
      'صلاح بو خاطر',
      128,
      source: ReciterAudioSource.everyAyah,
      audioPath: 'Salaah_AbdulRahman_Bukhatir_128kbps',
    ),
  ];

  static ReciterInfo findReciter(String id) {
    for (final reciter in reciters) {
      if (reciter.id == id) return reciter;
    }
    return reciters.first;
  }
}

enum ReciterAudioSource { alQuranCloud, everyAyah, segmentedSurah }

class ReciterInfo {
  const ReciterInfo(
    this.id,
    this.name,
    this.bitrate, {
    this.source = ReciterAudioSource.alQuranCloud,
    this.audioPath,
    this.segmentRecitationId,
  });

  final String id;
  final String name;
  final int bitrate;
  final ReciterAudioSource source;
  final String? audioPath;
  final int? segmentRecitationId;

  String get sourceLabel => switch (source) {
    ReciterAudioSource.alQuranCloud => 'تلاوة آية بآية',
    ReciterAudioSource.everyAyah => 'تلاوة آية بآية',
    ReciterAudioSource.segmentedSurah => 'تلاوة متصلة ومزامنة',
  };
}

class QuranAyahAddress {
  const QuranAyahAddress({
    required this.surah,
    required this.ayah,
    required this.global,
  });

  final int surah;
  final int ayah;
  final int global;
}

class QuranAyahIndex {
  const QuranAyahIndex._();

  static const ayahsPerSurah = <int>[
    7,
    286,
    200,
    176,
    120,
    165,
    206,
    75,
    129,
    109,
    123,
    111,
    43,
    52,
    99,
    128,
    111,
    110,
    98,
    135,
    112,
    78,
    118,
    64,
    77,
    227,
    93,
    88,
    69,
    60,
    34,
    30,
    73,
    54,
    45,
    83,
    182,
    88,
    75,
    85,
    54,
    53,
    89,
    59,
    37,
    35,
    38,
    29,
    18,
    45,
    60,
    49,
    62,
    55,
    78,
    96,
    29,
    22,
    24,
    13,
    14,
    11,
    11,
    18,
    12,
    12,
    30,
    52,
    52,
    44,
    28,
    28,
    20,
    56,
    40,
    31,
    50,
    40,
    46,
    42,
    29,
    19,
    36,
    25,
    22,
    17,
    19,
    26,
    30,
    20,
    15,
    21,
    11,
    8,
    8,
    19,
    5,
    8,
    8,
    11,
    11,
    8,
    3,
    9,
    5,
    4,
    7,
    3,
    6,
    3,
    5,
    4,
    5,
    6,
  ];

  static QuranAyahAddress fromGlobal(int globalAyah) {
    final safeGlobal = globalAyah.clamp(1, AppConstants.totalAyahs);
    var remaining = safeGlobal;

    for (var index = 0; index < ayahsPerSurah.length; index++) {
      final count = ayahsPerSurah[index];
      if (remaining <= count) {
        return QuranAyahAddress(
          surah: index + 1,
          ayah: remaining,
          global: safeGlobal,
        );
      }
      remaining -= count;
    }

    return const QuranAyahAddress(surah: 114, ayah: 6, global: 6236);
  }
}
