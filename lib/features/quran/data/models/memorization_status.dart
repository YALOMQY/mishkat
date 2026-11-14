/// Discrete lifecycle states for Quran Ayah memorization and retention.
enum MemorizationStatus {
  /// Ayah is part of a plan but practice/recall has not yet begun.
  notStarted,

  /// Ayah has been practiced at least once and is currently in progress.
  learning,

  /// User explicitly confirmed successful recall ("أعرفها").
  memorized,

  /// User indicated difficulty, made a mistake, or requested revision ("أحتاج مراجعة").
  needsRevision;

  /// Human-readable Arabic label.
  String get label => switch (this) {
    MemorizationStatus.notStarted => 'لم تبدأ',
    MemorizationStatus.learning => 'قيد الحفظ',
    MemorizationStatus.memorized => 'تم الحفظ',
    MemorizationStatus.needsRevision => 'تحتاج مراجعة',
  };

  /// Alias for [label] matching design terminology.
  String get arabicLabel => label;

  /// Parses a serialized name, safely defaulting to [MemorizationStatus.notStarted].
  static MemorizationStatus fromString(String? value) {
    if (value == null) return MemorizationStatus.notStarted;
    return MemorizationStatus.values.firstWhere(
      (s) => s.name == value,
      orElse: () => MemorizationStatus.notStarted,
    );
  }
}
