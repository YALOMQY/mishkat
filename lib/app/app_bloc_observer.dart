import 'package:flutter_bloc/flutter_bloc.dart';

class AppBlocObserver extends BlocObserver {
  const AppBlocObserver();

  @override
  void onError(BlocBase<dynamic> bloc, Object error, StackTrace stackTrace) {
    assert(() {
      // ignore: avoid_print
      print('${bloc.runtimeType}: $error');
      return true;
    }());
    super.onError(bloc, error, stackTrace);
  }
}
