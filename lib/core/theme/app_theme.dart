import 'package:flutter/material.dart';

class AppColors {
  // Brand palette — mirrors web CSS vars
  static const brand500  = Color(0xFF465FFF);
  static const brand600  = Color(0xFF3641F5);
  static const brand700  = Color(0xFF2A31D8);
  static const brand50   = Color(0xFFECF3FF);
  static const brand100  = Color(0xFFDDE9FF);

  // Neutrals
  static const gray50    = Color(0xFFF9FAFB);
  static const gray100   = Color(0xFFF3F4F6);
  static const gray200   = Color(0xFFE5E7EB);
  static const gray300   = Color(0xFFD1D5DB);
  static const gray400   = Color(0xFF9CA3AF);
  static const gray500   = Color(0xFF6B7280);
  static const gray600   = Color(0xFF4B5563);
  static const gray700   = Color(0xFF374151);
  static const gray800   = Color(0xFF1F2937);
  static const gray900   = Color(0xFF111827);

  // Status colours
  static const green50   = Color(0xFFF0FDF4);
  static const green500  = Color(0xFF22C55E);
  static const green600  = Color(0xFF16A34A);
  static const orange50  = Color(0xFFFFF7ED);
  static const orange500 = Color(0xFFF97316);
  static const red50     = Color(0xFFFEF2F2);
  static const red500    = Color(0xFFEF4444);
  static const amber50   = Color(0xFFFFFBEB);
  static const amber500  = Color(0xFFF59E0B);
  static const cyan50    = Color(0xFFECFEFF);
  static const cyan500   = Color(0xFF06B6D4);
  static const violet500 = Color(0xFF8B5CF6);
  static const slate400  = Color(0xFF94A3B8);
  static const emerald500= Color(0xFF10B981);

  static const white     = Color(0xFFFFFFFF);
  static const scaffold  = Color(0xFFF5F7FA);
}

// Workflow status → colour mapping
extension WorkflowStatusColor on String {
  Color get statusColor {
    switch (toLowerCase()) {
      case 'manifested':  return AppColors.slate400;
      case 'discharged':  return AppColors.cyan500;
      case 'batched':     return AppColors.violet500;
      case 'in_transit':  return AppColors.orange500;
      case 'received':    return AppColors.emerald500;
      case 'active':      return AppColors.green500;
      case 'inactive':    return AppColors.red500;
      case 'open':        return AppColors.green500;
      case 'full':        return AppColors.orange500;
      case 'closed':      return AppColors.gray400;
      case 'released':    return AppColors.green500;
      case 'collected':   return AppColors.emerald500;
      case 'unreleased':  return AppColors.gray400;
      default:            return AppColors.gray400;
    }
  }

  Color get statusBg {
    switch (toLowerCase()) {
      case 'manifested':  return AppColors.gray100;
      case 'discharged':  return AppColors.cyan50;
      case 'batched':     return const Color(0xFFF5F3FF);
      case 'in_transit':  return AppColors.orange50;
      case 'received':    return AppColors.green50;
      case 'active':      return AppColors.green50;
      case 'inactive':    return AppColors.red50;
      case 'open':        return AppColors.green50;
      case 'full':        return AppColors.orange50;
      case 'released':    return AppColors.green50;
      default:            return AppColors.gray100;
    }
  }
}

class AppTheme {
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.brand500,
      brightness: Brightness.light,
    ),
    scaffoldBackgroundColor: AppColors.scaffold,
    fontFamily: 'Roboto',
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.white,
      foregroundColor: AppColors.gray900,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: TextStyle(
        color: AppColors.gray900,
        fontSize: 18,
        fontWeight: FontWeight.w700,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.gray200),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.gray200),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.brand500, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.red500),
      ),
      hintStyle: const TextStyle(color: AppColors.gray400, fontSize: 14),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.brand500,
        foregroundColor: AppColors.white,
        elevation: 0,
        minimumSize: const Size(double.infinity, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    cardTheme: CardThemeData(
      color: AppColors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.gray200),
      ),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.gray100, space: 1),
  );
}
