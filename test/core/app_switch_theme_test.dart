import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mishkat_app/core/theme/app_theme.dart';

void main() {
  test(
    'switch handle stays distinct from its track in every theme and state',
    () {
      for (final theme in [AppTheme.light(), AppTheme.dark()]) {
        final switchTheme = theme.switchTheme;

        for (final states in <Set<WidgetState>>[
          <WidgetState>{},
          <WidgetState>{WidgetState.selected},
        ]) {
          final thumb = switchTheme.thumbColor!.resolve(states)!;
          final track = switchTheme.trackColor!.resolve(states)!;

          expect(
            thumb,
            isNot(track),
            reason: 'The switch handle must remain visible against its track.',
          );
        }
      }
    },
  );
}
