import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class ShellState extends Equatable {
  const ShellState({this.index = 0});
  final int index;

  ShellState copyWith({int? index}) => ShellState(index: index ?? this.index);

  @override
  List<Object?> get props => [index];
}

class ShellCubit extends Cubit<ShellState> {
  ShellCubit() : super(const ShellState());

  void select(int index) => emit(state.copyWith(index: index.clamp(0, 4)));
}
