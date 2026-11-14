import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mishkat_app/core/theme/app_theme.dart';
import 'package:mishkat_app/features/onboarding/presentation/pages/onboarding_page.dart';

Widget _app({required Future<void> Function() onComplete}) => MaterialApp(
  locale: const Locale('ar'),
  theme: AppTheme.light(),
  home: Directionality(
    textDirection: TextDirection.rtl,
    child: OnboardingPage(onComplete: onComplete),
  ),
);

void main() {
  testWidgets('introduces Mishkat and completes the four-page journey', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    var completions = 0;

    await tester.pumpWidget(_app(onComplete: () async => completions += 1));

    expect(find.text('مِشكاة'), findsOneWidget);
    expect(find.text('من نور الآية جاء الاسم'), findsOneWidget);
    expect(find.textContaining('اللَّهُ نُورُ السَّمَاوَاتِ'), findsOneWidget);

    for (var step = 0; step < 3; step++) {
      await tester.tap(find.byKey(const ValueKey('onboarding-primary-action')));
      await tester.pumpAndSettle();
    }

    expect(find.text('عبادة بهدوء، كل يوم'), findsOneWidget);
    expect(find.text('ابدأ رحلتك'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('onboarding-primary-action')));
    await tester.pump();
    expect(completions, 1);
  });

  testWidgets('fits a compact phone without layout overflow', (tester) async {
    await tester.binding.setSurfaceSize(const Size(320, 568));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(_app(onComplete: () async {}));
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(
      find.byKey(const ValueKey('onboarding-primary-action')),
      findsOneWidget,
    );
  });
}
