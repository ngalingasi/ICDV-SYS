import 'package:flutter/material.dart';

// ── Brand colors (fixed, same in both modes) ──────────────────────────────────
class AppBrand {
  static const navy      = Color(0xFF0D1B6E);   // TPF deep navy — primary in light mode
  static const navyLight = Color(0xFF1A2490);
  static const navyDim   = Color(0x220D1B6E);   // navy tint for light mode backgrounds
  static const gold      = Color(0xFFFFBF00);   // gold — primary in dark mode
  static const goldDim   = Color(0x33FFBF00);
  static const crimson   = Color(0xFF9B0000);

  // Status (universal)
  static const success    = Color(0xFF00C853);
  static const successDim = Color(0x2200C853);
  static const warning    = Color(0xFFFFBF00);
  static const warningDim = Color(0x33FFBF00);
  static const danger     = Color(0xFFFF3D71);
  static const dangerDim  = Color(0x22FF3D71);
  static const info       = Color(0xFF0288D1);
  static const infoDim    = Color(0x220288D1);
  static const violet     = Color(0xFF7C3AED);
  static const violetDim  = Color(0x227C3AED);
  static const orange     = Color(0xFFE64A19);
  static const orangeDim  = Color(0x22E64A19);
}

// ── Theme-aware color accessor ─────────────────────────────────────────────────
// Dark mode  → gold as the accent
// Light mode → navy as the accent
class AppColors {
  final bool isDark;
  const AppColors(this.isDark);

  // ── Accent (the key switch) ────────────────────────────────────────────────
  Color get accent       => isDark ? AppBrand.gold   : AppBrand.navy;
  Color get accentDim    => isDark ? const Color(0x33FFBF00) : const Color(0x220D1B6E);
  Color get accentText   => isDark
      ? const Color(0xFF060A18)   // dark text on gold button
      : const Color(0xFFFFFFFF);  // white text on navy button

  // Convenience aliases used across screens
  Color get gold    => accent;
  Color get goldDim => accentDim;
  // Keep raw gold/navy accessible when needed
  Color get rawGold => AppBrand.gold;
  Color get rawNavy => AppBrand.navy;

  // ── Surfaces ───────────────────────────────────────────────────────────────
  Color get bg          => isDark ? const Color(0xFF060A18) : const Color(0xFFF5F7FF);
  Color get surface0    => isDark ? const Color(0xFF0C1228) : const Color(0xFFFFFFFF);
  Color get surface1    => isDark ? const Color(0xFF121A36) : const Color(0xFFF0F2FA);
  Color get surface2    => isDark ? const Color(0xFF1A2444) : const Color(0xFFE4E8F5);
  Color get border      => isDark ? const Color(0xFF1E2D55) : const Color(0xFFDDE2F0);
  Color get borderBright=> isDark ? const Color(0xFF2A3F70) : const Color(0xFFB8C2DC);

  // ── Text ───────────────────────────────────────────────────────────────────
  Color get textPrimary => isDark ? const Color(0xFFF0F4FF) : const Color(0xFF0D1240);
  Color get textSecond  => isDark ? const Color(0xFF8899CC) : const Color(0xFF4A5680);
  Color get textMuted   => isDark ? const Color(0xFF4A5E8A) : const Color(0xFF8A96B8);

  // ── Glow tint used behind logo / splash ────────────────────────────────────
  Color get glowPrimary => isDark
      ? AppBrand.navy.withOpacity(0.4)
      : AppBrand.navy.withOpacity(0.08);

  // ── Status passthrough ────────────────────────────────────────────────────
  Color get success    => AppBrand.success;
  Color get successDim => AppBrand.successDim;
  Color get warning    => AppBrand.warning;
  Color get warningDim => AppBrand.warningDim;
  Color get danger     => AppBrand.danger;
  Color get dangerDim  => AppBrand.dangerDim;
  Color get info       => AppBrand.info;
  Color get infoDim    => AppBrand.infoDim;
  Color get violet     => AppBrand.violet;
  Color get violetDim  => AppBrand.violetDim;
  Color get orange     => AppBrand.orange;
  Color get orangeDim  => AppBrand.orangeDim;

  static const white     = Color(0xFFFFFFFF);
  static const navy      = AppBrand.navy;
  static const navyLight = AppBrand.navyLight;
  static const navyDim   = AppBrand.navyDim;
}

// ── Status color helpers ──────────────────────────────────────────────────────
extension WorkflowStatusColor on String {
  Color statusColor(bool isDark) {
    final c = AppColors(isDark);
    switch (toLowerCase()) {
      case 'manifested':  return c.textMuted;
      case 'discharged':  return c.info;
      case 'batched':     return c.violet;
      case 'in_transit':  return c.orange;
      case 'received':    return c.success;
      case 'active':      return c.success;
      case 'inactive':    return c.danger;
      case 'open':        return c.success;
      case 'full':        return c.orange;
      case 'closed':      return c.textMuted;
      case 'released':    return c.success;
      case 'collected':   return c.success;
      case 'unreleased':  return c.textMuted;
      default:            return c.textMuted;
    }
  }

  Color statusBg(bool isDark) {
    final c = AppColors(isDark);
    switch (toLowerCase()) {
      case 'discharged':  return c.infoDim;
      case 'batched':     return c.violetDim;
      case 'in_transit':  return c.orangeDim;
      case 'received':    return c.successDim;
      case 'active':      return c.successDim;
      case 'inactive':    return c.dangerDim;
      case 'open':        return c.successDim;
      case 'full':        return c.orangeDim;
      case 'released':    return c.successDim;
      default:            return c.surface1;
    }
  }
}

// ── ThemeData builders ────────────────────────────────────────────────────────
class AppTheme {
  static ThemeData build(bool isDark) {
    final c = AppColors(isDark);
    return ThemeData(
      useMaterial3: true,
      brightness: isDark ? Brightness.dark : Brightness.light,
      colorScheme: isDark
          ? ColorScheme.dark(
              primary: AppBrand.gold,
              surface: c.surface0,
              onSurface: c.textPrimary,
            )
          : ColorScheme.light(
              primary: AppBrand.navy,
              surface: c.surface0,
              onSurface: c.textPrimary,
            ),
      scaffoldBackgroundColor: c.bg,
      appBarTheme: AppBarTheme(
        backgroundColor: c.bg,
        foregroundColor: c.textPrimary,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          color: c.textPrimary, fontSize: 17,
          fontWeight: FontWeight.w700, letterSpacing: 0.3),
        iconTheme: IconThemeData(color: c.textSecond),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surface1,
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: c.border)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: c.border)),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: c.accent, width: 1.5)),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppBrand.danger)),
        hintStyle: TextStyle(color: c.textMuted, fontSize: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: c.accent,
          foregroundColor: c.accentText,
          elevation: 0,
          minimumSize: const Size(double.infinity, 54),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: 0.5),
        ),
      ),
      cardTheme: CardThemeData(color: c.surface0, elevation: 0, margin: EdgeInsets.zero),
      dividerTheme: DividerThemeData(color: c.border, thickness: 1),
    );
  }

  static ThemeData get dark  => build(true);
  static ThemeData get light => build(false);
}
