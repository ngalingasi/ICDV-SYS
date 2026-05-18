import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import '../providers/theme_provider.dart';

// ── Theme toggle button (reusable) ────────────────────────────────────────────
class ThemeToggleButton extends StatelessWidget {
  const ThemeToggleButton({super.key});
  @override
  Widget build(BuildContext context) {
    final c    = AppColors(isDarkMode(context));
    final dark = isDarkMode(context);
    return GestureDetector(
      onTap: () {
        // Import at call site to avoid circular — use a callback instead
        // Handled via ThemeToggleIconButton
      },
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: c.surface1, borderRadius: BorderRadius.circular(10),
          border: Border.all(color: c.border),
        ),
        child: Icon(dark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
          color: c.gold, size: 18),
      ),
    );
  }
}

// ── Status Badge ──────────────────────────────────────────────────────────────
class StatusBadge extends StatelessWidget {
  final String status;
  const StatusBadge(this.status, {super.key});

  @override
  Widget build(BuildContext context) {
    final dark  = isDarkMode(context);
    final label = status.replaceAll('_', ' ').toUpperCase();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: status.statusBg(dark),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: status.statusColor(dark).withOpacity(0.35)),
      ),
      child: Text(label, style: TextStyle(
        color: status.statusColor(dark),
        fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8,
      )),
    );
  }
}

// ── Vehicle Info Card ─────────────────────────────────────────────────────────
class VehicleCard extends StatelessWidget {
  final Vehicle vehicle;
  final Widget? trailing;
  const VehicleCard({super.key, required this.vehicle, this.trailing});

  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return Container(
      decoration: BoxDecoration(
        color: c.surface0,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          decoration: BoxDecoration(
            color: c.surface1,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Row(children: [
            Expanded(child: Text(vehicle.chassisNumber, style: TextStyle(
              fontFamily: 'monospace', fontSize: 17, fontWeight: FontWeight.w900,
              letterSpacing: 1.5, color: c.gold))),
            StatusBadge(vehicle.workflowStatus),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (vehicle.vehicleTitle.isNotEmpty)
              Padding(padding: const EdgeInsets.only(bottom: 12),
                child: Text(vehicle.vehicleTitle, style: TextStyle(
                  color: c.textSecond, fontSize: 13, fontWeight: FontWeight.w600))),
            _InfoGrid(vehicle),
            if (trailing != null) ...[const SizedBox(height: 12), trailing!],
          ]),
        ),
      ]),
    );
  }
}

class _InfoGrid extends StatelessWidget {
  final Vehicle v;
  const _InfoGrid(this.v);
  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    final rows = <_InfoItem>[
      _InfoItem('Vessel',   v.vesselName    ?? '—'),
      _InfoItem('Manifest', v.manifestNumber?? '—'),
      if (v.customerName != null) _InfoItem('Customer', v.customerName!),
      _InfoItem('Location', v.currentLocation.replaceAll('_', ' ')),
      if (v.icdvName != null)
        _InfoItem('ICDV', '${v.icdvName}${v.icdvCode != null ? " (${v.icdvCode})" : ""}'),
      if (v.batchNumber != null) _InfoItem('Batch', v.batchNumber!),
    ];
    return Column(children: rows.map((r) => Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(children: [
        SizedBox(width: 78, child: Text(r.label, style: TextStyle(
          color: c.textMuted, fontSize: 11,
          fontWeight: FontWeight.w600, letterSpacing: 0.5))),
        Expanded(child: Text(r.value, style: TextStyle(
          color: c.textPrimary, fontSize: 13, fontWeight: FontWeight.w600))),
      ]),
    )).toList());
  }
}
class _InfoItem { final String label, value; const _InfoItem(this.label, this.value); }

// ── Driver Card ───────────────────────────────────────────────────────────────
class DriverCard extends StatelessWidget {
  final Driver driver;
  const DriverCard({super.key, required this.driver});
  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: c.surface0, borderRadius: BorderRadius.circular(20),
          border: Border.all(color: c.border)),
      child: Row(children: [
        Container(width: 48, height: 48,
          decoration: BoxDecoration(shape: BoxShape.circle, color: c.goldDim,
            border: Border.all(color: c.gold.withOpacity(0.3))),
          child: Center(child: Text(driver.fullName[0].toUpperCase(),
            style: TextStyle(color: c.gold, fontWeight: FontWeight.w900, fontSize: 20)))),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(driver.fullName, style: TextStyle(
            color: c.textPrimary, fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: 3),
          Text('License: ${driver.licenseNumber}',
            style: TextStyle(color: c.textSecond, fontSize: 12)),
          if (driver.idNumber != null)
            Text('ID: ${driver.idNumber}',
              style: TextStyle(color: c.textSecond, fontSize: 12)),
          if (driver.phone != null)
            Text('📱 ${driver.phone}',
              style: TextStyle(color: c.textMuted, fontSize: 12)),
        ])),
        const SizedBox(width: 8),
        StatusBadge(driver.status),
      ]),
    );
  }
}

// ── Chassis Input ─────────────────────────────────────────────────────────────
class ChassisInput extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onSearch;
  final bool loading;
  final String? hintText;
  const ChassisInput({super.key, required this.controller,
      required this.onSearch, this.loading = false, this.hintText});

  @override
  Widget build(BuildContext context) => Row(children: [
    Expanded(child: TextField(
      controller: controller,
      textCapitalization: TextCapitalization.characters,
      textInputAction: TextInputAction.search,
      inputFormatters: [UpperCaseFormatter()],
      style: TextStyle(fontFamily: 'monospace', fontSize: 15,
        fontWeight: FontWeight.w700,
        color: AppColors(isDarkMode(context)).gold, letterSpacing: 1),
      decoration: InputDecoration(
        hintText: hintText ?? 'Enter chassis digits…',
        prefixIcon: Icon(Icons.search_rounded,
          color: AppColors(isDarkMode(context)).textMuted, size: 20),
      ),
      onSubmitted: (_) => onSearch(),
    )),
    const SizedBox(width: 10),
    SizedBox(height: 54, width: 62,
      child: ElevatedButton(
        onPressed: loading ? null : onSearch,
        style: ElevatedButton.styleFrom(
          padding: EdgeInsets.zero, minimumSize: Size.zero,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: loading
            ? const SizedBox(width: 18, height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF060A18)))
            : const Icon(Icons.arrow_forward_rounded, size: 20, color: Color(0xFF060A18)),
      )),
  ]);
}

// ── ID Card Input ─────────────────────────────────────────────────────────────
class IdCardInput extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onLookup;
  final bool loading;
  const IdCardInput({super.key, required this.controller,
      required this.onLookup, this.loading = false});

  @override
  Widget build(BuildContext context) => Row(children: [
    Expanded(child: TextField(
      controller: controller,
      textInputAction: TextInputAction.done,
      style: TextStyle(color: AppColors(isDarkMode(context)).textPrimary, fontSize: 15),
      decoration: const InputDecoration(
        hintText: 'Driver ID card number…',
        prefixIcon: Icon(Icons.badge_outlined, color: Color(0xFF4A5E8A), size: 20),
      ),
      onSubmitted: (_) => onLookup(),
    )),
    const SizedBox(width: 10),
    SizedBox(height: 54, width: 86,
      child: ElevatedButton(
        onPressed: loading ? null : onLookup,
        style: ElevatedButton.styleFrom(
          padding: EdgeInsets.zero, minimumSize: Size.zero,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: loading
            ? const SizedBox(width: 18, height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF060A18)))
            : const Text('Lookup', style: TextStyle(
                fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF060A18))),
      )),
  ]);
}

// ── Notes Field ───────────────────────────────────────────────────────────────
class NotesField extends StatelessWidget {
  final TextEditingController controller;
  const NotesField({super.key, required this.controller});
  @override
  Widget build(BuildContext context) => TextField(
    controller: controller, maxLines: 2,
    style: TextStyle(color: AppColors(isDarkMode(context)).textPrimary, fontSize: 14),
    decoration: const InputDecoration(
      hintText: 'Notes (optional)…',
      prefixIcon: Padding(padding: EdgeInsets.only(bottom: 28),
          child: Icon(Icons.notes_rounded, color: Color(0xFF4A5E8A), size: 20)),
    ),
  );
}

// ── Confirm Button ────────────────────────────────────────────────────────────
class ConfirmButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final Color? color;
  final IconData? icon;
  const ConfirmButton({super.key, required this.label, required this.onPressed,
      this.loading = false, this.color, this.icon});

  @override
  Widget build(BuildContext context) {
    final bg = color ?? AppBrand.gold;
    final fg = const Color(0xFF060A18);
    return SizedBox(width: double.infinity, height: 56,
      child: ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: bg, foregroundColor: fg,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          elevation: 0,
        ),
        child: loading
            ? SizedBox(width: 22, height: 22,
                child: CircularProgressIndicator(strokeWidth: 2, color: fg))
            : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                if (icon != null) ...[Icon(icon, size: 18, color: fg), const SizedBox(width: 8)],
                Text(label, style: TextStyle(
                  fontSize: 15, fontWeight: FontWeight.w800, color: fg, letterSpacing: 0.3)),
              ]),
      ));
  }
}

// ── Error / Info / Warning banners ────────────────────────────────────────────
class ErrorBanner extends StatelessWidget {
  final String message;
  const ErrorBanner(this.message, {super.key});
  @override
  Widget build(BuildContext context) => _Banner(
    message: message, icon: Icons.error_outline_rounded,
    color: AppBrand.danger, bg: AppBrand.dangerDim);
}

class InfoBanner extends StatelessWidget {
  final String message;
  const InfoBanner(this.message, {super.key});
  @override
  Widget build(BuildContext context) => _Banner(
    message: message, icon: Icons.info_outline_rounded,
    color: AppBrand.info, bg: AppBrand.infoDim);
}

class WarningBanner extends StatelessWidget {
  final String message;
  const WarningBanner(this.message, {super.key});
  @override
  Widget build(BuildContext context) => _Banner(
    message: message, icon: Icons.warning_amber_rounded,
    color: AppBrand.warning, bg: AppBrand.warningDim);
}

class _Banner extends StatelessWidget {
  final String message; final IconData icon; final Color color, bg;
  const _Banner({required this.message, required this.icon,
      required this.color, required this.bg});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.4))),
    child: Row(children: [
      Icon(icon, color: color, size: 18), const SizedBox(width: 10),
      Expanded(child: Text(message, style: TextStyle(color: color, fontSize: 13))),
    ]),
  );
}

// ── Success Sheet ─────────────────────────────────────────────────────────────
class SuccessSheet extends StatelessWidget {
  final String title, subtitle, nextLabel;
  final VoidCallback onNext;
  const SuccessSheet({super.key, required this.title, required this.subtitle,
      required this.onNext, this.nextLabel = 'Process Next'});

  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: c.surface0, borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppBrand.success.withOpacity(0.3))),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 64, height: 64,
          decoration: BoxDecoration(color: AppBrand.successDim, shape: BoxShape.circle,
              border: Border.all(color: AppBrand.success.withOpacity(0.4))),
          child: const Icon(Icons.check_rounded, color: AppBrand.success, size: 32)),
        const SizedBox(height: 16),
        Text(title, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900,
          color: c.textPrimary, letterSpacing: -0.3)),
        const SizedBox(height: 6),
        Text(subtitle, textAlign: TextAlign.center,
            style: TextStyle(color: c.textSecond, fontSize: 14)),
        const SizedBox(height: 24),
        ConfirmButton(label: nextLabel, onPressed: onNext, color: AppBrand.success),
      ]),
    );
  }
}

// ── Section Label ─────────────────────────────────────────────────────────────
class SectionLabel extends StatelessWidget {
  final String text;
  const SectionLabel(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Text(text.toUpperCase(), style: TextStyle(
      fontSize: 10, fontWeight: FontWeight.w700,
      color: AppColors(isDarkMode(context)).textMuted, letterSpacing: 2,
    )),
  );
}

// ── Step Indicator ────────────────────────────────────────────────────────────
class StepIndicator extends StatelessWidget {
  final int current, total;
  final List<String> labels;
  const StepIndicator({super.key, required this.current, required this.total, required this.labels});

  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return Row(
      children: List.generate(total, (i) {
        final done   = i < current;
        final active = i == current;
        return Expanded(child: Row(children: [
          if (i > 0) Expanded(child: Container(height: 1,
            color: done ? AppBrand.gold : c.border)),
          Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 26, height: 26,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: done || active ? AppBrand.gold : c.surface1,
                border: Border.all(
                  color: active || done ? AppBrand.gold : c.border,
                  width: active ? 2 : 1),
                boxShadow: active ? [BoxShadow(
                    color: AppBrand.gold.withOpacity(0.4), blurRadius: 10)] : null,
              ),
              child: Center(child: done
                  ? const Icon(Icons.check_rounded, size: 13, color: Color(0xFF060A18))
                  : Text('${i + 1}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800,
                      color: active ? const Color(0xFF060A18) : c.textMuted)))),
            const SizedBox(height: 4),
            if (i < labels.length)
              Text(labels[i], style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: active ? AppBrand.gold : c.textMuted)),
          ]),
        ]));
      }),
    );
  }
}

// ── Uppercase formatter ───────────────────────────────────────────────────────
class UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue old, TextEditingValue nw) =>
      nw.copyWith(text: nw.text.toUpperCase());
}


