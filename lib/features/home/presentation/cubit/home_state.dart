import 'package:equatable/equatable.dart';

import '../../../prayer_times/domain/models/prayer_models.dart';

class HomeState extends Equatable {
  const HomeState({required this.now, this.schedule});
  final DateTime now;
  final PrayerSchedule? schedule;

  Duration get remaining =>
      schedule == null ? Duration.zero : schedule!.next.at.difference(now);

  @override
  List<Object?> get props => [now, schedule];
}
