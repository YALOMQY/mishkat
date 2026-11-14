import 'package:equatable/equatable.dart';

/// Domain entity defining a Quran memorization commitment with bounded [startGlobalAyah] and [endGlobalAyah].
class MemorizationPlan extends Equatable {
  const MemorizationPlan({
    required this.id,
    required this.title,
    this.surah,
    required this.startGlobalAyah,
    required this.endGlobalAyah,
    required this.dailyTarget,
    this.isActive = true,
    required this.createdAt,
    this.completedAt,
    this.reminderHour,
    this.reminderMinute,
  }) : assert(
         startGlobalAyah >= 1 && startGlobalAyah <= 6236,
         'startGlobalAyah must be between 1 and 6236, got $startGlobalAyah',
       ),
       assert(
         endGlobalAyah >= 1 && endGlobalAyah <= 6236,
         'endGlobalAyah must be between 1 and 6236, got $endGlobalAyah',
       ),
       assert(
         startGlobalAyah <= endGlobalAyah,
         'startGlobalAyah ($startGlobalAyah) cannot exceed endGlobalAyah ($endGlobalAyah)',
       ),
       assert(dailyTarget > 0, 'dailyTarget must be greater than 0');

  final String id;
  final String title;
  final int? surah;
  final int startGlobalAyah;
  final int endGlobalAyah;
  final int dailyTarget;
  final bool isActive;
  final DateTime createdAt;
  final DateTime? completedAt;
  final int? reminderHour;
  final int? reminderMinute;

  /// Total number of Ayahs within this plan's span.
  int get totalAyahs => endGlobalAyah - startGlobalAyah + 1;

  /// Estimated days needed to complete the plan given [dailyTarget].
  int get estimatedDays => (totalAyahs / dailyTarget).ceil();

  /// Whether all Ayahs in the plan have been confirmed memorized.
  bool get isCompleted => completedAt != null;

  MemorizationPlan copyWith({
    String? title,
    int? surah,
    int? startGlobalAyah,
    int? endGlobalAyah,
    int? dailyTarget,
    bool? isActive,
    DateTime? completedAt,
    bool clearCompletedAt = false,
    int? reminderHour,
    int? reminderMinute,
    bool clearReminder = false,
  }) => MemorizationPlan(
    id: id,
    title: title ?? this.title,
    surah: surah ?? this.surah,
    startGlobalAyah: startGlobalAyah ?? this.startGlobalAyah,
    endGlobalAyah: endGlobalAyah ?? this.endGlobalAyah,
    dailyTarget: dailyTarget ?? this.dailyTarget,
    isActive: isActive ?? this.isActive,
    createdAt: createdAt,
    completedAt: clearCompletedAt ? null : (completedAt ?? this.completedAt),
    reminderHour: clearReminder ? null : (reminderHour ?? this.reminderHour),
    reminderMinute: clearReminder
        ? null
        : (reminderMinute ?? this.reminderMinute),
  );

  factory MemorizationPlan.fromJson(Map<String, dynamic> json) {
    final id = json['id'] as String?;
    if (id == null || id.trim().isEmpty) {
      throw const FormatException(
        'MemorizationPlan json requires non-empty id',
      );
    }
    final title = json['title'] as String? ?? 'خطة حفظ';
    final surah = (json['surah'] as num?)?.toInt();

    final rawStart = (json['startGlobalAyah'] ?? json['start']) as num?;
    final rawEnd = (json['endGlobalAyah'] ?? json['end']) as num?;

    var start = (rawStart?.toInt() ?? 1).clamp(1, 6236);
    var end = (rawEnd?.toInt() ?? start).clamp(1, 6236);
    if (start > end) {
      final temp = start;
      start = end;
      end = temp;
    }

    final rawTarget = (json['dailyTarget'] ?? json['target']) as num?;
    final dailyTarget = (rawTarget?.toInt() ?? 5).clamp(1, 100);

    final isActive = json['isActive'] as bool? ?? true;
    final createdAt =
        (json['createdAt'] is String
            ? DateTime.tryParse(json['createdAt'] as String)
            : null) ??
        DateTime.now();
    final completedAt = json['completedAt'] is String
        ? DateTime.tryParse(json['completedAt'] as String)
        : null;
    final rawHour = (json['reminderHour'] as num?)?.toInt();
    final rawMinute = (json['reminderMinute'] as num?)?.toInt();

    return MemorizationPlan(
      id: id,
      title: title,
      surah: surah,
      startGlobalAyah: start,
      endGlobalAyah: end,
      dailyTarget: dailyTarget,
      isActive: isActive,
      createdAt: createdAt,
      completedAt: completedAt,
      reminderHour: rawHour != null && rawHour >= 0 && rawHour <= 23
          ? rawHour
          : null,
      reminderMinute: rawMinute != null && rawMinute >= 0 && rawMinute <= 59
          ? rawMinute
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    if (surah != null) 'surah': surah,
    'startGlobalAyah': startGlobalAyah,
    'endGlobalAyah': endGlobalAyah,
    'dailyTarget': dailyTarget,
    'isActive': isActive,
    'createdAt': createdAt.toIso8601String(),
    if (completedAt != null) 'completedAt': completedAt!.toIso8601String(),
    if (reminderHour != null) 'reminderHour': reminderHour,
    if (reminderMinute != null) 'reminderMinute': reminderMinute,
  };

  @override
  List<Object?> get props => [
    id,
    title,
    surah,
    startGlobalAyah,
    endGlobalAyah,
    dailyTarget,
    isActive,
    createdAt,
    completedAt,
    reminderHour,
    reminderMinute,
  ];
}
