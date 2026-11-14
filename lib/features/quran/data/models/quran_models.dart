import 'package:equatable/equatable.dart';

class QuranChapter extends Equatable {
  const QuranChapter({
    required this.number,
    required this.name,
    required this.englishName,
    required this.revelationType,
    required this.page,
    required this.ayahs,
    required this.globalStart,
  });

  final int number;
  final String name;
  final String englishName;
  final String revelationType;
  final int page;
  final List<String> ayahs;
  final int globalStart;

  factory QuranChapter.fromJson(Map<String, dynamic> json) => QuranChapter(
    number: (json['n'] as num).toInt(),
    name: json['name'] as String,
    englishName: json['en'] as String? ?? '',
    revelationType: json['type'] as String? ?? '',
    page: (json['page'] as num).toInt(),
    ayahs: (json['ayahs'] as List).cast<String>(),
    globalStart: (json['start'] as num).toInt(),
  );

  @override
  List<Object?> get props => [
    number,
    name,
    englishName,
    revelationType,
    page,
    ayahs,
    globalStart,
  ];
}

class JuzStart extends Equatable {
  const JuzStart({
    required this.number,
    required this.surah,
    required this.ayah,
  });
  final int number;
  final int surah;
  final int ayah;

  factory JuzStart.fromJson(Map<String, dynamic> json) => JuzStart(
    number: (json['n'] as num).toInt(),
    surah: (json['s'] as num).toInt(),
    ayah: (json['a'] as num).toInt(),
  );

  @override
  List<Object?> get props => [number, surah, ayah];
}

class QuranPoint extends Equatable {
  const QuranPoint({
    required this.surah,
    required this.ayah,
    required this.global,
  });
  final int surah;
  final int ayah;
  final int global;

  factory QuranPoint.fromJson(Map<String, dynamic> json) => QuranPoint(
    surah: (json['s'] as num).toInt(),
    ayah: (json['a'] as num).toInt(),
    global: (json['g'] as num).toInt(),
  );

  Map<String, dynamic> toJson() => {'s': surah, 'a': ayah, 'g': global};

  @override
  List<Object?> get props => [surah, ayah, global];
}

class MushafPageInfo extends Equatable {
  const MushafPageInfo({
    required this.page,
    required this.first,
    required this.last,
  });
  final int page;
  final QuranPoint first;
  final QuranPoint last;

  factory MushafPageInfo.fromJson(Map<String, dynamic> json) => MushafPageInfo(
    page: (json['page'] as num).toInt(),
    first: QuranPoint.fromJson(Map<String, dynamic>.from(json['first'] as Map)),
    last: QuranPoint.fromJson(Map<String, dynamic>.from(json['last'] as Map)),
  );

  @override
  List<Object?> get props => [page, first, last];
}

class QuranBookmark extends Equatable {
  const QuranBookmark({
    required this.page,
    required this.point,
    required this.createdAt,
    this.label,
  });
  final int page;
  final QuranPoint point;
  final DateTime createdAt;
  final String? label;

  factory QuranBookmark.fromJson(Map<String, dynamic> json) => QuranBookmark(
    page: (json['page'] as num).toInt(),
    point: QuranPoint.fromJson(Map<String, dynamic>.from(json['point'] as Map)),
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    label: json['label'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'page': page,
    'point': point.toJson(),
    'createdAt': createdAt.toIso8601String(),
    if (label != null) 'label': label,
  };

  @override
  List<Object?> get props => [page, point, createdAt, label];
}

class QuranSearchResult extends Equatable {
  const QuranSearchResult({required this.chapter, this.ayah, this.text});
  final QuranChapter chapter;
  final int? ayah;
  final String? text;

  @override
  List<Object?> get props => [chapter, ayah, text];
}

class QuranData {
  const QuranData({
    required this.chapters,
    required this.juz,
    required this.pages,
  });
  final List<QuranChapter> chapters;
  final List<JuzStart> juz;
  final List<MushafPageInfo> pages;

  QuranChapter chapter(int number) => chapters[number.clamp(1, 114) - 1];
  MushafPageInfo page(int number) => pages[number.clamp(1, 604) - 1];

  int globalFor(int surah, int ayah) => chapter(surah).globalStart + ayah - 1;

  QuranPoint pointForGlobal(int global) {
    final value = global.clamp(1, 6236);
    var low = 0;
    var high = chapters.length - 1;
    while (low <= high) {
      final middle = (low + high) ~/ 2;
      final chapter = chapters[middle];
      final end = chapter.globalStart + chapter.ayahs.length - 1;
      if (value < chapter.globalStart) {
        high = middle - 1;
      } else if (value > end) {
        low = middle + 1;
      } else {
        return QuranPoint(
          surah: chapter.number,
          ayah: value - chapter.globalStart + 1,
          global: value,
        );
      }
    }
    return const QuranPoint(surah: 1, ayah: 1, global: 1);
  }

  int pageForGlobal(int global) {
    final value = global.clamp(1, 6236);
    var low = 0;
    var high = pages.length - 1;
    while (low <= high) {
      final middle = (low + high) ~/ 2;
      final item = pages[middle];
      if (value < item.first.global) {
        high = middle - 1;
      } else if (value > item.last.global) {
        low = middle + 1;
      } else {
        return item.page;
      }
    }
    return 1;
  }
}
