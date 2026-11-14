import 'package:flutter/material.dart';

@immutable
class MishkatColors extends ThemeExtension<MishkatColors> {
  const MishkatColors({
    required this.brandDeep,
    required this.primaryStrong,
    required this.primarySoft,
    required this.gold,
    required this.surfaceMuted,
    required this.textSecondary,
    required this.border,
    required this.heroLabel,
    required this.heroBorder,
    // Expanded modern design tokens
    required this.primary,
    required this.primaryDark,
    required this.background,
    required this.surface,
    required this.surfaceVariant,
    required this.textPrimary,
    required this.textMuted,
    required this.borderSubtle,
    required this.accentGoldSoft,
    required this.success,
    required this.warning,
    required this.error,
  });

  // Legacy & Primary tokens
  final Color brandDeep;
  final Color primaryStrong;
  final Color primarySoft;
  final Color gold;
  final Color surfaceMuted;
  final Color textSecondary;
  final Color border;
  final Color heroLabel;
  final Color heroBorder;

  // New design tokens
  final Color primary;
  final Color primaryDark;
  final Color background;
  final Color surface;
  final Color surfaceVariant;
  final Color textPrimary;
  final Color textMuted;
  final Color borderSubtle;
  final Color accentGoldSoft;
  final Color success;
  final Color warning;
  final Color error;

  // Convenience semantic getters
  Color get surfaceInteractive => surfaceVariant;
  Color get selectedStateBg => primarySoft;
  Color get dividerColor => borderSubtle;

  /// Clean white + a very light blue-green gray. Large surfaces stay neutral
  /// and cool, without cream or yellow casts.
  static const light = MishkatColors(
    brandDeep: Color(0xFF28584E),
    primaryStrong: Color(0xFF35685D),
    primarySoft: Color(0xFFE7F0EE),
    gold: Color(0xFF58756E),
    surfaceMuted: Color(0xFFEEF3F2),
    textSecondary: Color(0xFF62716E),
    border: Color(0xFFD9E2E0),
    heroLabel: Color(0xFFE0ECE9),
    heroBorder: Color(0xFF5B7A72),
    // Expanded tokens
    primary: Color(0xFF35685D),
    primaryDark: Color(0xFF234C43),
    background: Color(0xFFF5F8F7),
    surface: Color(0xFFFFFFFF),
    surfaceVariant: Color(0xFFEDF3F2),
    textPrimary: Color(0xFF202A28),
    textMuted: Color(0xFF86938F),
    borderSubtle: Color(0xFFE5ECEA),
    accentGoldSoft: Color(0xFFEDF3F2),
    success: Color(0xFF3D7868),
    warning: Color(0xFF8A7041),
    error: Color(0xFFB94A45),
  );

  /// Charcoal green + lifted neutral surfaces. Green is reserved for emphasis
  /// instead of tinting every layer of the dark interface.
  static const dark = MishkatColors(
    brandDeep: Color(0xFF20483B),
    primaryStrong: Color(0xFF73B69D),
    primarySoft: Color(0xFF203A31),
    gold: Color(0xFF9ABAB2),
    surfaceMuted: Color(0xFF1B2924),
    textSecondary: Color(0xFFADB7B1),
    border: Color(0xFF31413B),
    heroLabel: Color(0xFFDDE6E1),
    heroBorder: Color(0xFF4B6B5F),
    // Expanded tokens
    primary: Color(0xFF73B69D),
    primaryDark: Color(0xFFB3D5C8),
    background: Color(0xFF0E1714),
    surface: Color(0xFF16211D),
    surfaceVariant: Color(0xFF1D2B26),
    textPrimary: Color(0xFFF1F1EC),
    textMuted: Color(0xFF7F8C86),
    borderSubtle: Color(0xFF25332E),
    accentGoldSoft: Color(0xFF1F302C),
    success: Color(0xFF79C7A5),
    warning: Color(0xFFE0B566),
    error: Color(0xFFE88982),
  );

  @override
  MishkatColors copyWith({
    Color? brandDeep,
    Color? primaryStrong,
    Color? primarySoft,
    Color? gold,
    Color? surfaceMuted,
    Color? textSecondary,
    Color? border,
    Color? heroLabel,
    Color? heroBorder,
    Color? primary,
    Color? primaryDark,
    Color? background,
    Color? surface,
    Color? surfaceVariant,
    Color? textPrimary,
    Color? textMuted,
    Color? borderSubtle,
    Color? accentGoldSoft,
    Color? success,
    Color? warning,
    Color? error,
  }) => MishkatColors(
    brandDeep: brandDeep ?? this.brandDeep,
    primaryStrong: primaryStrong ?? this.primaryStrong,
    primarySoft: primarySoft ?? this.primarySoft,
    gold: gold ?? this.gold,
    surfaceMuted: surfaceMuted ?? this.surfaceMuted,
    textSecondary: textSecondary ?? this.textSecondary,
    border: border ?? this.border,
    heroLabel: heroLabel ?? this.heroLabel,
    heroBorder: heroBorder ?? this.heroBorder,
    primary: primary ?? this.primary,
    primaryDark: primaryDark ?? this.primaryDark,
    background: background ?? this.background,
    surface: surface ?? this.surface,
    surfaceVariant: surfaceVariant ?? this.surfaceVariant,
    textPrimary: textPrimary ?? this.textPrimary,
    textMuted: textMuted ?? this.textMuted,
    borderSubtle: borderSubtle ?? this.borderSubtle,
    accentGoldSoft: accentGoldSoft ?? this.accentGoldSoft,
    success: success ?? this.success,
    warning: warning ?? this.warning,
    error: error ?? this.error,
  );

  @override
  MishkatColors lerp(covariant MishkatColors? other, double t) {
    if (other == null) return this;
    return MishkatColors(
      brandDeep: Color.lerp(brandDeep, other.brandDeep, t)!,
      primaryStrong: Color.lerp(primaryStrong, other.primaryStrong, t)!,
      primarySoft: Color.lerp(primarySoft, other.primarySoft, t)!,
      gold: Color.lerp(gold, other.gold, t)!,
      surfaceMuted: Color.lerp(surfaceMuted, other.surfaceMuted, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      border: Color.lerp(border, other.border, t)!,
      heroLabel: Color.lerp(heroLabel, other.heroLabel, t)!,
      heroBorder: Color.lerp(heroBorder, other.heroBorder, t)!,
      primary: Color.lerp(primary, other.primary, t)!,
      primaryDark: Color.lerp(primaryDark, other.primaryDark, t)!,
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceVariant: Color.lerp(surfaceVariant, other.surfaceVariant, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      borderSubtle: Color.lerp(borderSubtle, other.borderSubtle, t)!,
      accentGoldSoft: Color.lerp(accentGoldSoft, other.accentGoldSoft, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      error: Color.lerp(error, other.error, t)!,
    );
  }
}

extension MishkatThemeX on BuildContext {
  MishkatColors get mishkat =>
      Theme.of(this).extension<MishkatColors>() ?? MishkatColors.light;
}
