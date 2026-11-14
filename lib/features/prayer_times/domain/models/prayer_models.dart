import 'package:equatable/equatable.dart';

class PrayerMethod extends Equatable {
  const PrayerMethod({
    required this.key,
    required this.name,
    required this.fajrAngle,
    required this.isha,
    this.maghrib,
    this.jafariMidnight = false,
  });

  final String key;
  final String name;
  final double fajrAngle;
  final PrayerParameter isha;
  final PrayerParameter? maghrib;
  final bool jafariMidnight;

  @override
  List<Object?> get props => [
    key,
    name,
    fajrAngle,
    isha,
    maghrib,
    jafariMidnight,
  ];
}

class PrayerParameter extends Equatable {
  const PrayerParameter.angle(this.value) : isMinutes = false;
  const PrayerParameter.minutes(this.value) : isMinutes = true;

  final double value;
  final bool isMinutes;

  @override
  List<Object?> get props => [value, isMinutes];
}

class PrayerTimes extends Equatable {
  const PrayerTimes({
    required this.values,
    required this.methodName,
    required this.methodKey,
    this.approximate = false,
    this.nearestLatitude = false,
  });

  final Map<String, DateTime?> values;
  final String methodName;
  final String methodKey;
  final bool approximate;
  final bool nearestLatitude;

  DateTime? operator [](String key) => values[key];

  @override
  List<Object?> get props => [
    values,
    methodName,
    methodKey,
    approximate,
    nearestLatitude,
  ];
}

class PrayerMoment extends Equatable {
  const PrayerMoment({
    required this.key,
    required this.name,
    required this.at,
    this.noAdhan = false,
  });

  final String key;
  final String name;
  final DateTime at;
  final bool noAdhan;

  @override
  List<Object?> get props => [key, name, at, noAdhan];
}

class PrayerSchedule extends Equatable {
  const PrayerSchedule({
    required this.next,
    required this.current,
    required this.today,
    required this.moments,
  });

  final PrayerMoment next;
  final PrayerMoment? current;
  final PrayerTimes today;
  final List<PrayerMoment> moments;

  @override
  List<Object?> get props => [next, current, today, moments];
}

class QiblaResult extends Equatable {
  const QiblaResult({required this.bearing, required this.distanceKm});
  final double bearing;
  final double distanceKm;

  @override
  List<Object?> get props => [bearing, distanceKm];
}
