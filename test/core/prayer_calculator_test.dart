import 'package:flutter_test/flutter_test.dart';
import 'package:mishkat_app/features/prayer_times/data/services/prayer_calculator.dart';

void main() {
  const calculator = PrayerCalculator();

  test('تُرحّل أم القرى تلقائياً إلى MWL داخل اليمن فقط', () {
    final hadramout = calculator.calculate(
      date: DateTime(2026, 9, 4),
      latitude: 14.7664,
      longitude: 49.6254,
      methodKey: 'Makkah',
    );
    final makkah = calculator.calculate(
      date: DateTime(2026, 9, 4),
      latitude: 21.3891,
      longitude: 39.8579,
      methodKey: 'Makkah',
    );
    expect(hadramout.methodKey, 'MWL');
    expect(makkah.methodKey, 'Makkah');
  });

  test('تُطبّق التعديلات اليدوية ومذهب العصر', () {
    PrayerTimesForTest calculate({
      String asr = 'Standard',
      Map<String, int> tune = const {},
    }) {
      final result = calculator.calculate(
        date: DateTime(2026, 9, 4),
        latitude: 14.7664,
        longitude: 49.6254,
        methodKey: 'MWL',
        asr: asr,
        tune: tune,
      );
      return PrayerTimesForTest(result['fajr']!, result['asr']!);
    }

    final standard = calculate();
    final tuned = calculate(tune: const {'fajr': 7});
    final hanafi = calculate(asr: 'Hanafi');
    expect(tuned.fajr.difference(standard.fajr), const Duration(minutes: 7));
    expect(hanafi.asr.isAfter(standard.asr), isTrue);
    expect(standard.fajr.second, 0);
  });

  test('زاوية القبلة والمسافة من حضرموت منطقية', () {
    final result = calculator.qibla(14.7664, 49.6254);
    expect(result.bearing, inInclusiveRange(300, 330));
    expect(result.distanceKm, inInclusiveRange(1000, 1500));
  });
}

class PrayerTimesForTest {
  const PrayerTimesForTest(this.fajr, this.asr);
  final DateTime fajr;
  final DateTime asr;
}
