import 'package:equatable/equatable.dart';

enum QiblaStatus { noLocation, ready, listening, unavailable, failure }

class QiblaState extends Equatable {
  const QiblaState({
    this.status = QiblaStatus.noLocation,
    this.bearing,
    this.distanceKm,
    this.heading,
    this.accuracy,
    this.declination,
    this.error,
  });

  final QiblaStatus status;
  final double? bearing;
  final double? distanceKm;
  final double? heading;
  final double? accuracy;
  final double? declination;
  final String? error;

  double? get delta {
    if (bearing == null || heading == null) return null;
    return ((bearing! - heading! + 540) % 360) - 180;
  }

  bool get aligned =>
      delta != null &&
      delta!.abs() <= 5 &&
      (accuracy == null || (accuracy! >= 0 && accuracy! <= 25));

  String get accuracyLabel {
    if (accuracy == null) return 'جاهزة';
    if (accuracy! < 0) return 'تحتاج معايرة';
    if (accuracy! <= 10) return 'عالية';
    if (accuracy! <= 25) return 'جيدة';
    return 'ضعيفة (حرّك الجهاز)';
  }

  String get turnInstruction {
    if (aligned) return 'أنت الآن باتجاه القبلة مباشرة';
    final d = delta;
    if (d == null) return 'شغّل البوصلة لمعرفة الاتجاه المباشر';
    final deg = d.abs().round();
    if (d > 0) return 'استدر يمينًا بمقدار $deg°';
    return 'استدر يسارًا بمقدار $deg°';
  }

  bool get hasLocation => bearing != null && distanceKm != null;

  QiblaState copyWith({
    QiblaStatus? status,
    double? bearing,
    double? distanceKm,
    Object? heading = _unset,
    Object? accuracy = _unset,
    Object? declination = _unset,
    String? error,
  }) => QiblaState(
    status: status ?? this.status,
    bearing: bearing ?? this.bearing,
    distanceKm: distanceKm ?? this.distanceKm,
    heading: identical(heading, _unset) ? this.heading : heading as double?,
    accuracy: identical(accuracy, _unset) ? this.accuracy : accuracy as double?,
    declination: identical(declination, _unset)
        ? this.declination
        : declination as double?,
    error: error ?? this.error,
  );

  @override
  List<Object?> get props => [
    status,
    bearing,
    distanceKm,
    heading,
    accuracy,
    declination,
    error,
  ];
}

const _unset = Object();
