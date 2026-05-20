import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/providers/theme_provider.dart';

enum _SheetState { confirming, loading, success, error }

/// Shows a branded confirmation bottom sheet.
/// Returns true if the user confirmed and the operation succeeded.
Future<bool> showOpConfirmSheet({
  required BuildContext context,
  required String title,
  required String subtitle,
  required String confirmLabel,
  required IconData icon,
  required Color gradStart,
  required Color gradEnd,
  required Color symbolColor,
  required Color accentColor,
  required Future<void> Function() onConfirm,
  String successTitle   = 'Done!',
  String successMessage = 'Operation completed successfully.',
  String cancelLabel    = 'Cancel',
}) async {
  bool result = false;
  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withOpacity(0.5),
    builder: (_) => _OpConfirmSheet(
      title: title, subtitle: subtitle,
      confirmLabel: confirmLabel, cancelLabel: cancelLabel,
      icon: icon, gradStart: gradStart, gradEnd: gradEnd,
      symbolColor: symbolColor, accentColor: accentColor,
      onConfirm: onConfirm,
      successTitle: successTitle, successMessage: successMessage,
      onResult: (v) => result = v,
    ),
  );
  return result;
}

class _OpConfirmSheet extends StatefulWidget {
  final String title, subtitle, confirmLabel, cancelLabel, successTitle, successMessage;
  final IconData icon;
  final Color gradStart, gradEnd, symbolColor, accentColor;
  final Future<void> Function() onConfirm;
  final void Function(bool) onResult;

  const _OpConfirmSheet({
    required this.title, required this.subtitle,
    required this.confirmLabel, required this.cancelLabel,
    required this.icon, required this.gradStart, required this.gradEnd,
    required this.symbolColor, required this.accentColor,
    required this.onConfirm, required this.successTitle,
    required this.successMessage, required this.onResult,
  });

  @override
  State<_OpConfirmSheet> createState() => _OpConfirmSheetState();
}

class _OpConfirmSheetState extends State<_OpConfirmSheet>
    with SingleTickerProviderStateMixin {
  _SheetState _state = _SheetState.confirming;
  String? _errorMessage;
  late AnimationController _ctrl;
  late Animation<double>   _scale, _fade;

  @override
  void initState() {
    super.initState();
    _ctrl  = AnimationController(vsync: this, duration: const Duration(milliseconds: 400));
    _scale = Tween<double>(begin: 0.7, end: 1.0).animate(
        CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack));
    _fade  = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _ctrl.forward();
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  Future<void> _handleConfirm() async {
    setState(() => _state = _SheetState.loading);
    _ctrl.reset(); _ctrl.forward();
    try {
      await widget.onConfirm();
      setState(() => _state = _SheetState.success);
      _ctrl.reset(); _ctrl.forward();
      widget.onResult(true);
    } catch (e) {
      final msg = e.toString();
      setState(() {
        _state = _SheetState.error;
        _errorMessage = msg.contains('409') ? 'Vehicle status mismatch — check workflow.'
            : msg.contains('404')           ? 'Vehicle or record not found.'
            : msg.contains('SocketException')? 'No connection to server.'
            : 'Operation failed. Please try again.';
      });
      _ctrl.reset(); _ctrl.forward();
      widget.onResult(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = isDarkMode(context);
    final c    = AppColors(dark);

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        decoration: BoxDecoration(
          color: c.surface0,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: c.border),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(dark ? 0.5 : 0.15),
                blurRadius: 40, offset: const Offset(0, 8)),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 350),
            transitionBuilder: (child, anim) => FadeTransition(
              opacity: anim, child: ScaleTransition(scale: anim, child: child)),
            child: switch (_state) {
              _SheetState.confirming => _ConfirmBody(
                key: const ValueKey('confirm'),
                widget: widget, c: c, dark: dark,
                onConfirm: _handleConfirm,
                onCancel: () => Navigator.of(context).pop(),
              ),
              _SheetState.loading => _LoadingBody(
                key: const ValueKey('loading'),
                widget: widget, c: c, dark: dark,
              ),
              _SheetState.success => _SuccessBody(
                key: const ValueKey('success'),
                widget: widget, c: c, dark: dark,
                onClose: () => Navigator.of(context).pop(),
              ),
              _SheetState.error => _ErrorBody(
                key: const ValueKey('error'),
                widget: widget, c: c, dark: dark,
                message: _errorMessage ?? 'Something went wrong.',
                onClose: () => Navigator.of(context).pop(),
                onRetry: _handleConfirm,
              ),
            },
          ),
        ),
      ),
    );
  }
}

// ── Confirming state ──────────────────────────────────────────────────────────
class _ConfirmBody extends StatelessWidget {
  final _OpConfirmSheet widget;
  final AppColors c; final bool dark;
  final VoidCallback onConfirm, onCancel;

  const _ConfirmBody({super.key, required this.widget, required this.c,
      required this.dark, required this.onConfirm, required this.onCancel});

  @override
  Widget build(BuildContext context) {
    final gradient = dark
        ? LinearGradient(colors: [
            widget.gradStart.withOpacity(0.30), widget.gradEnd.withOpacity(0.15)],
            begin: Alignment.topLeft, end: Alignment.bottomRight)
        : LinearGradient(colors: [widget.gradStart, widget.gradEnd],
            begin: Alignment.topLeft, end: Alignment.bottomRight);

    return Column(mainAxisSize: MainAxisSize.min, children: [
      // Gradient header strip with watermark
      Container(
        height: 120,
        decoration: BoxDecoration(gradient: gradient),
        child: ClipRect(child: Stack(children: [
          Positioned(right: -20, bottom: -20,
            child: Icon(widget.icon, size: 120,
              color: widget.symbolColor.withOpacity(dark ? 0.22 : 0.18))),
          Center(child: Container(
            width: 56, height: 56,
            decoration: BoxDecoration(
              color: dark ? widget.symbolColor.withOpacity(0.25) : Colors.white.withOpacity(0.6),
              shape: BoxShape.circle,
              border: Border.all(color: dark
                  ? widget.symbolColor.withOpacity(0.5)
                  : AppColors.navy.withOpacity(0.2), width: 2),
            ),
            child: Icon(widget.icon,
              color: dark ? widget.symbolColor : AppColors.navy, size: 28),
          )),
        ])),
      ),

      // Content
      Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(widget.title, style: TextStyle(
            color: c.textPrimary, fontSize: 18,
            fontWeight: FontWeight.w900, letterSpacing: -0.3)),
          const SizedBox(height: 8),
          Text(widget.subtitle, textAlign: TextAlign.center,
            style: TextStyle(color: c.textSecond, fontSize: 13, height: 1.4)),
          const SizedBox(height: 24),
          Row(children: [
            // Cancel
            Expanded(child: SizedBox(height: 50,
              child: OutlinedButton(
                onPressed: onCancel,
                style: OutlinedButton.styleFrom(
                  foregroundColor: c.textSecond,
                  side: BorderSide(color: c.border),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: Text(widget.cancelLabel,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
            )),
            const SizedBox(width: 12),
            // Confirm
            Expanded(child: SizedBox(height: 50,
              child: ElevatedButton(
                onPressed: onConfirm,
                style: ElevatedButton.styleFrom(
                  backgroundColor: widget.accentColor,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: Text(widget.confirmLabel,
                  style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
              ),
            )),
          ]),
        ]),
      ),
    ]);
  }
}

// ── Loading state ─────────────────────────────────────────────────────────────
class _LoadingBody extends StatelessWidget {
  final _OpConfirmSheet widget;
  final AppColors c; final bool dark;
  const _LoadingBody({super.key, required this.widget, required this.c, required this.dark});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      SizedBox(width: 72, height: 72,
        child: Stack(alignment: Alignment.center, children: [
          CircularProgressIndicator(
            color: widget.accentColor, strokeWidth: 3,
            backgroundColor: widget.accentColor.withOpacity(0.15)),
          Icon(widget.icon, color: widget.accentColor, size: 28),
        ])),
      const SizedBox(height: 20),
      Text('Processing…', style: TextStyle(
        color: c.textPrimary, fontSize: 16, fontWeight: FontWeight.w800)),
      const SizedBox(height: 6),
      Text('Please wait while we complete the operation.',
        textAlign: TextAlign.center,
        style: TextStyle(color: c.textMuted, fontSize: 13)),
    ]),
  );
}

// ── Success state ─────────────────────────────────────────────────────────────
class _SuccessBody extends StatelessWidget {
  final _OpConfirmSheet widget;
  final AppColors c; final bool dark;
  final VoidCallback onClose;
  const _SuccessBody({super.key, required this.widget, required this.c,
      required this.dark, required this.onClose});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(24, 32, 24, 28),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      // Animated success icon
      Container(width: 72, height: 72,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: const Color(0xFF00C853).withOpacity(0.15),
          border: Border.all(color: const Color(0xFF00C853), width: 2.5),
        ),
        child: const Icon(Icons.check_rounded, color: Color(0xFF00C853), size: 36)),
      const SizedBox(height: 18),
      Text(widget.successTitle, style: TextStyle(
        color: c.textPrimary, fontSize: 20, fontWeight: FontWeight.w900)),
      const SizedBox(height: 8),
      Text(widget.successMessage, textAlign: TextAlign.center,
        style: TextStyle(color: c.textSecond, fontSize: 13, height: 1.4)),
      const SizedBox(height: 28),
      SizedBox(width: double.infinity, height: 50,
        child: ElevatedButton(
          onPressed: onClose,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF00C853),
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: const Text('Close', style: TextStyle(
            fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white)),
        )),
    ]),
  );
}

// ── Error state ───────────────────────────────────────────────────────────────
class _ErrorBody extends StatelessWidget {
  final _OpConfirmSheet widget;
  final AppColors c; final bool dark;
  final String message;
  final VoidCallback onClose, onRetry;
  const _ErrorBody({super.key, required this.widget, required this.c,
      required this.dark, required this.message,
      required this.onClose, required this.onRetry});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(24, 32, 24, 28),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      // Warning icon
      Container(width: 72, height: 72,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppBrand.warning.withOpacity(0.15),
          border: Border.all(color: AppBrand.warning, width: 2.5),
        ),
        child: const Icon(Icons.warning_amber_rounded,
          color: AppBrand.warning, size: 36)),
      const SizedBox(height: 18),
      Text('There is a problem', style: TextStyle(
        color: c.textPrimary, fontSize: 20, fontWeight: FontWeight.w900)),
      const SizedBox(height: 8),
      Text(message, textAlign: TextAlign.center,
        style: TextStyle(color: c.textSecond, fontSize: 13, height: 1.4)),
      const SizedBox(height: 28),
      Row(children: [
        Expanded(child: SizedBox(height: 50,
          child: OutlinedButton(
            onPressed: onClose,
            style: OutlinedButton.styleFrom(
              foregroundColor: c.textSecond,
              side: BorderSide(color: c.border),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: const Text('Close', style: TextStyle(fontWeight: FontWeight.w700)),
          ))),
        const SizedBox(width: 12),
        Expanded(child: SizedBox(height: 50,
          child: ElevatedButton(
            onPressed: onRetry,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppBrand.warning,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: const Text('Try again', style: TextStyle(
              fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white)),
          ))),
      ]),
    ]),
  );
}
