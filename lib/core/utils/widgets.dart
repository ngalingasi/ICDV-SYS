import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';

// ── Status Badge ──────────────────────────────────────────────────────────────
class StatusBadge extends StatelessWidget {
  final String status;
  const StatusBadge(this.status, {super.key});

  @override
  Widget build(BuildContext context) {
    final label = status.replaceAll('_', ' ').toUpperCase();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color:        status.statusBg,
        borderRadius: BorderRadius.circular(20),
        border:       Border.all(color: status.statusColor.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color:      status.statusColor,
          fontSize:   11,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

// ── Vehicle Info Card ─────────────────────────────────────────────────────────
class VehicleCard extends StatelessWidget {
  final dynamic vehicle; // Vehicle model
  final Widget? trailing;
  const VehicleCard({super.key, required this.vehicle, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.gray200),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text(
              vehicle.chassisNumber as String,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 18,
                fontWeight: FontWeight.w800,
                letterSpacing: 1,
                color: AppColors.gray900,
              ),
            ),
          ),
          StatusBadge(vehicle.workflowStatus as String),
        ]),
        if ((vehicle.vehicleTitle as String).isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(vehicle.vehicleTitle as String,
              style: const TextStyle(color: AppColors.gray500, fontSize: 13)),
        ],
        const SizedBox(height: 12),
        const Divider(height: 1),
        const SizedBox(height: 12),
        _InfoRow('Vessel',   vehicle.vesselName   ?? '—'),
        _InfoRow('Manifest', vehicle.manifestNumber ?? '—'),
        if ((vehicle.customerName as String?) != null)
          _InfoRow('Customer', vehicle.customerName as String),
        if ((vehicle.icdvName as String?) != null)
          _InfoRow('ICDV', '${vehicle.icdvName}${vehicle.icdvCode != null ? " (${vehicle.icdvCode})" : ""}'),
        _InfoRow('Location', (vehicle.currentLocation as String).replaceAll('_', ' ')),
        if ((vehicle.batchNumber as String?) != null)
          _InfoRow('Batch', vehicle.batchNumber as String),
        if (trailing != null) ...[const SizedBox(height: 8), trailing!],
      ]),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label, value;
  const _InfoRow(this.label, this.value);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 5),
    child: Row(children: [
      SizedBox(
        width: 80,
        child: Text(label, style: const TextStyle(color: AppColors.gray400, fontSize: 12)),
      ),
      Expanded(
        child: Text(value,
            style: const TextStyle(color: AppColors.gray800, fontSize: 13, fontWeight: FontWeight.w500)),
      ),
    ]),
  );
}

// ── Driver Info Card ──────────────────────────────────────────────────────────
class DriverCard extends StatelessWidget {
  final dynamic driver;
  const DriverCard({super.key, required this.driver});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.gray200),
      ),
      padding: const EdgeInsets.all(16),
      child: Row(children: [
        CircleAvatar(
          radius: 26,
          backgroundColor: AppColors.brand100,
          child: const Icon(Icons.person, color: AppColors.brand500, size: 26),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(driver.fullName as String,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.gray900)),
          const SizedBox(height: 3),
          Text('License: ${driver.licenseNumber}',
              style: const TextStyle(color: AppColors.gray500, fontSize: 13)),
          if ((driver.idNumber as String?) != null)
            Text('ID: ${driver.idNumber}',
                style: const TextStyle(color: AppColors.gray500, fontSize: 13)),
          if ((driver.phone as String?) != null)
            Text('📱 ${driver.phone}',
                style: const TextStyle(color: AppColors.gray500, fontSize: 12)),
        ])),
        const SizedBox(width: 8),
        StatusBadge(driver.status as String),
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

  const ChassisInput({
    super.key,
    required this.controller,
    required this.onSearch,
    this.loading = false,
    this.hintText,
  });

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(
        child: TextField(
          controller: controller,
          textCapitalization: TextCapitalization.characters,
          textInputAction: TextInputAction.search,
          inputFormatters: [UpperCaseFormatter()],
          style: const TextStyle(fontFamily: 'monospace', fontSize: 16, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            hintText: hintText ?? 'Enter last 4 chassis digits…',
            prefixIcon: const Icon(Icons.search, color: AppColors.gray400),
            suffixIcon: controller.text.isNotEmpty
                ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: controller.clear)
                : null,
          ),
          onSubmitted: (_) => onSearch(),
        ),
      ),
      const SizedBox(width: 10),
      SizedBox(
        height: 52, width: 72,
        child: ElevatedButton(
          onPressed: loading ? null : onSearch,
          style: ElevatedButton.styleFrom(
            padding: EdgeInsets.zero,
            minimumSize: Size.zero,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: loading
              ? const SizedBox(width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white))
              : const Icon(Icons.search, size: 22),
        ),
      ),
    ]);
  }
}

// ── ID Card Input (driver lookup) ─────────────────────────────────────────────
class IdCardInput extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onLookup;
  final bool loading;

  const IdCardInput({
    super.key,
    required this.controller,
    required this.onLookup,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(
        child: TextField(
          controller: controller,
          textInputAction: TextInputAction.done,
          decoration: const InputDecoration(
            hintText: 'Enter driver ID card number…',
            prefixIcon: Icon(Icons.badge_outlined, color: AppColors.gray400),
          ),
          onSubmitted: (_) => onLookup(),
        ),
      ),
      const SizedBox(width: 10),
      SizedBox(
        height: 52, width: 88,
        child: ElevatedButton(
          onPressed: loading ? null : onLookup,
          style: ElevatedButton.styleFrom(
            padding: EdgeInsets.zero,
            minimumSize: Size.zero,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: loading
              ? const SizedBox(width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white))
              : const Text('Lookup', style: TextStyle(fontSize: 13)),
        ),
      ),
    ]);
  }
}

// ── Notes Field ───────────────────────────────────────────────────────────────
class NotesField extends StatelessWidget {
  final TextEditingController controller;
  const NotesField({super.key, required this.controller});

  @override
  Widget build(BuildContext context) => TextField(
    controller: controller,
    maxLines: 2,
    decoration: const InputDecoration(
      hintText: 'Notes (optional)…',
      prefixIcon: Padding(
        padding: EdgeInsets.only(bottom: 24),
        child: Icon(Icons.notes, color: AppColors.gray400),
      ),
    ),
  );
}

// ── Primary action button ─────────────────────────────────────────────────────
class ConfirmButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final Color? color;
  final IconData? icon;

  const ConfirmButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.color,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: color ?? AppColors.brand500,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: loading
            ? const SizedBox(width: 22, height: 22,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white))
            : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                if (icon != null) ...[Icon(icon, size: 20), const SizedBox(width: 8)],
                Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ]),
      ),
    );
  }
}

// ── Error Banner ──────────────────────────────────────────────────────────────
class ErrorBanner extends StatelessWidget {
  final String message;
  const ErrorBanner(this.message, {super.key});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: BoxDecoration(
      color: AppColors.red50,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.red500.withValues(alpha: 0.3)),
    ),
    child: Row(children: [
      const Icon(Icons.error_outline, color: AppColors.red500, size: 18),
      const SizedBox(width: 10),
      Expanded(child: Text(message,
          style: const TextStyle(color: AppColors.red500, fontSize: 13))),
    ]),
  );
}

// ── Success Sheet (bottom) ────────────────────────────────────────────────────
class SuccessSheet extends StatelessWidget {
  final String   title;
  final String   subtitle;
  final VoidCallback onNext;
  final String   nextLabel;

  const SuccessSheet({
    super.key,
    required this.title,
    required this.subtitle,
    required this.onNext,
    this.nextLabel = 'Process Next',
  });

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(24),
    decoration: const BoxDecoration(
      color: AppColors.white,
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 56, height: 56,
        decoration: BoxDecoration(color: AppColors.green50, shape: BoxShape.circle),
        child: const Icon(Icons.check_circle, color: AppColors.green600, size: 32),
      ),
      const SizedBox(height: 16),
      Text(title, style: const TextStyle(
          fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.gray900)),
      const SizedBox(height: 6),
      Text(subtitle, textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.gray500, fontSize: 14)),
      const SizedBox(height: 24),
      ConfirmButton(label: nextLabel, onPressed: onNext, color: AppColors.green600),
      const SizedBox(height: 8),
    ]),
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
class SectionLabel extends StatelessWidget {
  final String text;
  const SectionLabel(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(text.toUpperCase(), style: const TextStyle(
      fontSize: 11, fontWeight: FontWeight.w700,
      color: AppColors.gray400, letterSpacing: 0.8,
    )),
  );
}

// ── Uppercase formatter for chassis inputs ────────────────────────────────────
class UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue old, TextEditingValue nw) =>
      nw.copyWith(text: nw.text.toUpperCase());
}

// ── Step indicator ────────────────────────────────────────────────────────────
class StepIndicator extends StatelessWidget {
  final int current; // 0-based
  final int total;
  final List<String> labels;

  const StepIndicator({super.key, required this.current, required this.total, required this.labels});

  @override
  Widget build(BuildContext context) {
    return Row(children: List.generate(total, (i) {
      final done   = i < current;
      final active = i == current;
      return Expanded(child: Row(children: [
        if (i > 0) Expanded(
          child: Container(height: 2, color: done ? AppColors.brand500 : AppColors.gray200),
        ),
        Column(children: [
          Container(
            width: 28, height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: done || active ? AppColors.brand500 : AppColors.gray200,
              border: Border.all(color: active ? AppColors.brand500 : Colors.transparent, width: 2),
            ),
            child: Center(child: done
                ? const Icon(Icons.check, size: 14, color: AppColors.white)
                : Text('${i + 1}', style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w700,
                    color: active ? AppColors.white : AppColors.gray500))),
          ),
          const SizedBox(height: 4),
          if (i < labels.length)
            Text(labels[i], style: TextStyle(
              fontSize: 9, fontWeight: FontWeight.w600,
              color: active ? AppColors.brand500 : AppColors.gray400,
            )),
        ]),
      ]));
    }));
  }
}
