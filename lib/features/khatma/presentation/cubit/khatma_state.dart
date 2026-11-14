import 'package:equatable/equatable.dart';

import '../../data/models/khatma_plan.dart';

class KhatmaState extends Equatable {
  const KhatmaState({this.plans = const [], this.activeId});
  final List<KhatmaPlan> plans;
  final String? activeId;

  KhatmaPlan? get active =>
      plans.where((item) => item.id == activeId).firstOrNull;

  KhatmaState copyWith({List<KhatmaPlan>? plans, Object? activeId = _unset}) =>
      KhatmaState(
        plans: plans ?? this.plans,
        activeId: identical(activeId, _unset)
            ? this.activeId
            : activeId as String?,
      );

  @override
  List<Object?> get props => [plans, activeId];
}

const _unset = Object();
