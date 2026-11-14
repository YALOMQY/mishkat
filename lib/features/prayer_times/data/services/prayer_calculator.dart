import 'dart:math' as math;

import '../../domain/models/prayer_models.dart';

class PrayerCalculator {
  const PrayerCalculator();

  static const methods = <String, PrayerMethod>{
    'MWL': PrayerMethod(
      key: 'MWL',
      name: 'رابطة العالم الإسلامي',
      fajrAngle: 18,
      isha: PrayerParameter.angle(17),
    ),
    'Makkah': PrayerMethod(
      key: 'Makkah',
      name: 'أم القرى — مكة المكرمة',
      fajrAngle: 18.5,
      isha: PrayerParameter.minutes(90),
    ),
    'Egypt': PrayerMethod(
      key: 'Egypt',
      name: 'الهيئة المصرية العامة للمساحة',
      fajrAngle: 19.5,
      isha: PrayerParameter.angle(17.5),
    ),
    'Karachi': PrayerMethod(
      key: 'Karachi',
      name: 'جامعة العلوم الإسلامية — كراتشي',
      fajrAngle: 18,
      isha: PrayerParameter.angle(18),
    ),
    'ISNA': PrayerMethod(
      key: 'ISNA',
      name: 'الجمعية الإسلامية بأمريكا الشمالية',
      fajrAngle: 15,
      isha: PrayerParameter.angle(15),
    ),
    'Gulf': PrayerMethod(
      key: 'Gulf',
      name: 'هيئة الخليج',
      fajrAngle: 19.5,
      isha: PrayerParameter.minutes(90),
    ),
    'Kuwait': PrayerMethod(
      key: 'Kuwait',
      name: 'الكويت',
      fajrAngle: 18,
      isha: PrayerParameter.angle(17.5),
    ),
    'Qatar': PrayerMethod(
      key: 'Qatar',
      name: 'قطر',
      fajrAngle: 18,
      isha: PrayerParameter.minutes(90),
    ),
    'Dubai': PrayerMethod(
      key: 'Dubai',
      name: 'الإمارات — دبي',
      fajrAngle: 18.2,
      isha: PrayerParameter.angle(18.2),
    ),
    'Turkey': PrayerMethod(
      key: 'Turkey',
      name: 'ديانت — تركيا',
      fajrAngle: 18,
      isha: PrayerParameter.angle(17),
    ),
    'Singapore': PrayerMethod(
      key: 'Singapore',
      name: 'سنغافورة',
      fajrAngle: 20,
      isha: PrayerParameter.angle(18),
    ),
    'France': PrayerMethod(
      key: 'France',
      name: 'الاتحاد الإسلامي بفرنسا',
      fajrAngle: 12,
      isha: PrayerParameter.angle(12),
    ),
    'Russia': PrayerMethod(
      key: 'Russia',
      name: 'روسيا',
      fajrAngle: 16,
      isha: PrayerParameter.angle(15),
    ),
    'Tehran': PrayerMethod(
      key: 'Tehran',
      name: 'معهد الجيوفيزياء — طهران',
      fajrAngle: 17.7,
      isha: PrayerParameter.angle(14),
      maghrib: PrayerParameter.angle(4.5),
      jafariMidnight: true,
    ),
    'Jafari': PrayerMethod(
      key: 'Jafari',
      name: 'الجعفري (شيعة اثنا عشرية)',
      fajrAngle: 16,
      isha: PrayerParameter.angle(14),
      maghrib: PrayerParameter.angle(4),
    ),
  };

  static const order = <({String key, String name, bool noAdhan})>[
    (key: 'fajr', name: 'الفجر', noAdhan: false),
    (key: 'sunrise', name: 'الشروق', noAdhan: true),
    (key: 'dhuhr', name: 'الظهر', noAdhan: false),
    (key: 'asr', name: 'العصر', noAdhan: false),
    (key: 'maghrib', name: 'المغرب', noAdhan: false),
    (key: 'isha', name: 'العشاء', noAdhan: false),
  ];

  PrayerTimes calculate({
    required DateTime date,
    required double latitude,
    required double longitude,
    String methodKey = 'MWL',
    bool methodAuto = true,
    String asr = 'Standard',
    String highLatitudes = 'NightMiddle',
    String midnight = 'Standard',
    double elevation = 0,
    Map<String, int> tune = const <String, int>{},
    bool isFallback = false,
  }) {
    final resolvedKey =
        methodAuto && methodKey == 'Makkah' && _isInYemen(latitude, longitude)
        ? 'MWL'
        : methodKey;
    final method = methods[resolvedKey] ?? methods['MWL']!;
    final julianDate =
        _julian(date.year, date.month, date.day) - longitude / (15 * 24);
    final engine = _SolarEngine(julianDate, latitude, elevation);
    final maghrib = method.maghrib ?? const PrayerParameter.minutes(0);

    Map<String, double?> values = <String, double?>{
      'imsak': 5,
      'fajr': 5,
      'sunrise': 6,
      'dhuhr': 12,
      'asr': 13,
      'sunset': 18,
      'maghrib': 18,
      'isha': 18,
    };
    for (var iteration = 0; iteration < 3; iteration++) {
      final portion = values.map(
        (key, value) => MapEntry(key, value == null ? null : value / 24),
      );
      values = <String, double?>{
        'imsak': engine.sunAngleTime(
          10,
          portion['imsak'],
          counterClockwise: true,
        ),
        'fajr': engine.sunAngleTime(
          method.fajrAngle,
          portion['fajr'],
          counterClockwise: true,
        ),
        'sunrise': engine.sunAngleTime(
          engine.riseSetAngle,
          portion['sunrise'],
          counterClockwise: true,
        ),
        'dhuhr': engine.midDay(portion['dhuhr']),
        'asr': engine.asrTime(asr == 'Hanafi' ? 2 : 1, portion['asr']),
        'sunset': engine.sunAngleTime(engine.riseSetAngle, portion['sunset']),
        'maghrib': maghrib.isMinutes
            ? values['sunset']
            : engine.sunAngleTime(maghrib.value, portion['maghrib']),
        'isha': method.isha.isMinutes
            ? values['sunset']
            : engine.sunAngleTime(method.isha.value, portion['isha']),
      };
    }

    if (method.isha.isMinutes && values['sunset'] != null) {
      values['isha'] = values['sunset']! + method.isha.value / 60;
    }
    if (maghrib.isMinutes && values['sunset'] != null) {
      values['maghrib'] = values['sunset']! + maghrib.value / 60;
    }
    if (values['fajr'] != null) values['imsak'] = values['fajr']! - 10 / 60;

    var approximate = false;
    if (highLatitudes != 'None' &&
        values['sunset'] != null &&
        values['sunrise'] != null) {
      final night = _timeDiff(values['sunset']!, values['sunrise']!);
      final original = Map<String, double?>.from(values);
      values['imsak'] = _adjustHighLatitude(
        values['imsak'],
        values['sunrise']!,
        10,
        night,
        highLatitudes,
        true,
      );
      values['fajr'] = _adjustHighLatitude(
        values['fajr'],
        values['sunrise']!,
        method.fajrAngle,
        night,
        highLatitudes,
        true,
      );
      values['isha'] = _adjustHighLatitude(
        values['isha'],
        values['sunset']!,
        method.isha.isMinutes ? 18 : method.isha.value,
        night,
        highLatitudes,
        false,
      );
      values['maghrib'] = _adjustHighLatitude(
        values['maghrib'],
        values['sunset']!,
        maghrib.isMinutes ? 4 : maghrib.value,
        night,
        highLatitudes,
        false,
      );
      approximate = const ['imsak', 'fajr', 'isha', 'maghrib'].any((key) {
        final before = original[key];
        final after = values[key];
        return before == null ||
            before.isNaN ||
            (after != null && (before - after).abs() > 1e-9);
      });
    }

    if (values['dhuhr'] != null) values['dhuhr'] = values['dhuhr']!;
    if (values['sunset'] != null) {
      final end = (midnight == 'Jafari' || method.jafariMidnight)
          ? values['fajr']
          : values['sunrise'];
      if (end != null) {
        final span = _timeDiff(values['sunset']!, end);
        values['midnight'] = values['sunset']! + span / 2;
        values['lastThird'] = values['sunset']! + span * 2 / 3;
      }
    }

    final shift = date.timeZoneOffset.inMinutes / 60 - longitude / 15;
    final output = <String, DateTime?>{};
    for (final entry in values.entries) {
      final adjusted = entry.value == null
          ? null
          : entry.value! + shift + (tune[entry.key] ?? 0) / 60;
      output[entry.key] = adjusted == null ? null : _toDate(date, adjusted);
    }

    var nearest = false;
    if (!isFallback && latitude.abs() > 48.5) {
      const critical = ['fajr', 'sunrise', 'sunset', 'maghrib', 'isha'];
      if (critical.any((key) => output[key] == null)) {
        final fallback = calculate(
          date: date,
          latitude: latitude.sign * 48.5,
          longitude: longitude,
          methodKey: methodKey,
          methodAuto: methodAuto,
          asr: asr,
          highLatitudes: highLatitudes,
          midnight: midnight,
          elevation: elevation,
          tune: tune,
          isFallback: true,
        );
        for (final key in critical) {
          output[key] ??= fallback[key];
        }
        approximate = true;
        nearest = true;
      }
    }
    return PrayerTimes(
      values: output,
      methodName: method.name,
      methodKey: method.key,
      approximate: approximate,
      nearestLatitude: nearest,
    );
  }

  PrayerSchedule schedule({
    required DateTime now,
    required double latitude,
    required double longitude,
    String methodKey = 'MWL',
    bool methodAuto = true,
    String asr = 'Standard',
    String highLatitudes = 'NightMiddle',
    Map<String, int> tune = const <String, int>{},
  }) {
    PrayerTimes get(DateTime date) => calculate(
      date: date,
      latitude: latitude,
      longitude: longitude,
      methodKey: methodKey,
      methodAuto: methodAuto,
      asr: asr,
      highLatitudes: highLatitudes,
      tune: tune,
    );
    final today = get(now);
    final moments = <PrayerMoment>[
      for (final item in order)
        if (today[item.key] case final DateTime at)
          PrayerMoment(
            key: item.key,
            name: item.name,
            at: at,
            noAdhan: item.noAdhan,
          ),
    ];
    PrayerMoment? next;
    for (final moment in moments) {
      if (moment.at.isAfter(now)) {
        next = moment;
        break;
      }
    }
    if (next == null) {
      final tomorrow = get(now.add(const Duration(days: 1)));
      next = PrayerMoment(key: 'fajr', name: 'الفجر', at: tomorrow['fajr']!);
    }
    final passed = moments
        .where((item) => !item.noAdhan && !item.at.isAfter(now))
        .toList();
    PrayerMoment? current = passed.isEmpty ? null : passed.last;
    if (current == null) {
      final yesterday = get(now.subtract(const Duration(days: 1)));
      if (yesterday['isha'] case final DateTime isha) {
        current = PrayerMoment(key: 'isha', name: 'العشاء', at: isha);
      }
    }
    return PrayerSchedule(
      next: next,
      current: current,
      today: today,
      moments: moments,
    );
  }

  QiblaResult qibla(double latitude, double longitude) {
    const kaabaLat = 21.4225;
    const kaabaLng = 39.8262;
    final delta = _rad(kaabaLng - longitude);
    final p1 = _rad(latitude);
    final p2 = _rad(kaabaLat);
    final bearing =
        math.atan2(
          math.sin(delta),
          math.cos(p1) * math.tan(p2) - math.sin(p1) * math.cos(delta),
        ) /
        _degrees;
    final a =
        math.pow(math.sin((p2 - p1) / 2), 2) +
        math.cos(p1) * math.cos(p2) * math.pow(math.sin(delta / 2), 2);
    final distance = 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return QiblaResult(bearing: _fixAngle(bearing), distanceKm: distance);
  }

  static const _degrees = math.pi / 180;
  static double _rad(double value) => value * _degrees;
  static double _sin(double degrees) => math.sin(_rad(degrees));
  static double _cos(double degrees) => math.cos(_rad(degrees));
  static double _tan(double degrees) => math.tan(_rad(degrees));
  static double _asin(double value) => math.asin(value) / _degrees;
  static double _acos(double value) => math.acos(value) / _degrees;
  static double _atan2(double y, double x) => math.atan2(y, x) / _degrees;
  static double _acot(double value) => math.atan2(1, value) / _degrees;
  static double _wrap(double value, double range) {
    final wrapped = value - range * (value / range).floor();
    return wrapped < 0 ? wrapped + range : wrapped;
  }

  static double _fixAngle(double value) => _wrap(value, 360);
  static double _fixHour(double value) => _wrap(value, 24);
  static double _timeDiff(double from, double to) => _fixHour(to - from);

  static double _julian(int year, int month, int day) {
    var y = year;
    var m = month;
    if (m <= 2) {
      y -= 1;
      m += 12;
    }
    final a = y ~/ 100;
    final b = 2 - a + a ~/ 4;
    return (365.25 * (y + 4716)).floorToDouble() +
        (30.6001 * (m + 1)).floorToDouble() +
        day +
        b -
        1524.5;
  }

  static double _nightPortion(String rule, double angle, double night) {
    if (rule == 'AngleBased') return angle / 60 * night;
    if (rule == 'OneSeventh') return night / 7;
    return night / 2;
  }

  static double _adjustHighLatitude(
    double? time,
    double base,
    double angle,
    double night,
    String rule,
    bool counterClockwise,
  ) {
    final portion = _nightPortion(rule, angle, night);
    final invalid = time == null || time.isNaN;
    final difference = invalid
        ? double.infinity
        : counterClockwise
        ? _timeDiff(time, base)
        : _timeDiff(base, time);
    if (invalid || difference > portion) {
      return base + (counterClockwise ? -portion : portion);
    }
    return time;
  }

  static DateTime _toDate(DateTime base, double hours) {
    final minutes = (hours * 60 + 0.5 / 60).round();
    return DateTime(
      base.year,
      base.month,
      base.day,
    ).add(Duration(minutes: minutes));
  }

  static bool _isInYemen(double latitude, double longitude) {
    const polygon = <(double, double)>[
      (19.000003, 52.000010),
      (17.349742, 52.782184),
      (16.651051, 53.108573),
      (16.382411, 52.385206),
      (15.938433, 52.191729),
      (15.597420, 52.168165),
      (15.175250, 51.172515),
      (14.708767, 49.574576),
      (14.003202, 48.679231),
      (13.948090, 48.238947),
      (14.007233, 47.938914),
      (13.592220, 47.354454),
      (13.399699, 46.717076),
      (13.347764, 45.877593),
      (13.290946, 45.625050),
      (13.026905, 45.406459),
      (12.953938, 45.144356),
      (12.699587, 44.989533),
      (12.721653, 44.494576),
      (12.585950, 44.175113),
      (12.636800, 43.482959),
      (13.220950, 43.222871),
      (13.767584, 43.251448),
      (14.062630, 43.087944),
      (14.802249, 42.892245),
      (15.213335, 42.604873),
      (15.261963, 42.805015),
      (15.718886, 42.702438),
      (15.911742, 42.823671),
      (16.347891, 42.779332),
      (16.666890, 43.218375),
      (17.088440, 43.115798),
      (17.579987, 43.380794),
      (17.319977, 43.791519),
      (17.410359, 44.062613),
      (17.433329, 45.216651),
      (17.333335, 45.399999),
      (17.233315, 46.366659),
      (17.283338, 46.749994),
      (16.949999, 47.000005),
      (17.116682, 47.466695),
      (18.166669, 48.183344),
      (18.616668, 49.116672),
    ];
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      final yi = polygon[i].$1;
      final xi = polygon[i].$2;
      final yj = polygon[j].$1;
      final xj = polygon[j].$2;
      if ((yi > latitude) != (yj > latitude) &&
          longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    final socotra =
        latitude >= 11.7 &&
        latitude <= 12.9 &&
        longitude >= 52.9 &&
        longitude <= 54.7;
    return inside || socotra;
  }
}

class _SolarEngine {
  _SolarEngine(this.julianDate, this.latitude, double elevation)
    : riseSetAngle =
          0.833 + 0.0347 * elevation.sign * math.sqrt(elevation.abs());

  final double julianDate;
  final double latitude;
  final double riseSetAngle;

  ({double declination, double equation}) _sunPosition(double jd) {
    final d = jd - 2451545.0;
    final g = PrayerCalculator._fixAngle(357.529 + 0.98560028 * d);
    final q = PrayerCalculator._fixAngle(280.459 + 0.98564736 * d);
    final l = PrayerCalculator._fixAngle(
      q +
          1.915 * PrayerCalculator._sin(g) +
          0.020 * PrayerCalculator._sin(2 * g),
    );
    final e = 23.439 - 0.00000036 * d;
    final rightAscension = PrayerCalculator._fixHour(
      PrayerCalculator._atan2(
            PrayerCalculator._cos(e) * PrayerCalculator._sin(l),
            PrayerCalculator._cos(l),
          ) /
          15,
    );
    return (
      declination: PrayerCalculator._asin(
        PrayerCalculator._sin(e) * PrayerCalculator._sin(l),
      ),
      equation: q / 15 - rightAscension,
    );
  }

  double midDay(double? portion) => PrayerCalculator._fixHour(
    12 - _sunPosition(julianDate + (portion ?? 0)).equation,
  );

  double? sunAngleTime(
    double angle,
    double? portion, {
    bool counterClockwise = false,
  }) {
    final declination = _sunPosition(julianDate + (portion ?? 0)).declination;
    final noon = midDay(portion);
    final x =
        (-PrayerCalculator._sin(angle) -
            PrayerCalculator._sin(declination) *
                PrayerCalculator._sin(latitude)) /
        (PrayerCalculator._cos(declination) * PrayerCalculator._cos(latitude));
    if (x > 1 || x < -1) return null;
    final value = PrayerCalculator._acos(x) / 15;
    return noon + (counterClockwise ? -value : value);
  }

  double? asrTime(int factor, double? portion) {
    final declination = _sunPosition(julianDate + (portion ?? 0)).declination;
    final angle = -PrayerCalculator._acot(
      factor + PrayerCalculator._tan((latitude - declination).abs()),
    );
    return sunAngleTime(angle, portion);
  }
}
