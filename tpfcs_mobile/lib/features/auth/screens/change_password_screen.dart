import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/theme_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/widgets.dart';

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});
  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _currentCtrl = TextEditingController();
  final _newCtrl     = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _showCurrent = false, _showNew = false, _showConfirm = false;

  @override
  void dispose() { _currentCtrl.dispose(); _newCtrl.dispose(); _confirmCtrl.dispose(); super.dispose(); }

  List<_Rule> get _rules => [
    _Rule('At least 8 characters',      _newCtrl.text.length >= 8),
    _Rule('Contains uppercase letter',  RegExp(r'[A-Z]').hasMatch(_newCtrl.text)),
    _Rule('Contains lowercase letter',  RegExp(r'[a-z]').hasMatch(_newCtrl.text)),
    _Rule('Contains a number',          RegExp(r'\d').hasMatch(_newCtrl.text)),
    _Rule('Passwords match',            _newCtrl.text == _confirmCtrl.text && _confirmCtrl.text.isNotEmpty),
  ];

  bool get _isValid => _rules.every((r) => r.ok) && _currentCtrl.text.isNotEmpty;

  Future<void> _submit() async {
    if (!_isValid) return;
    final ok = await ref.read(authProvider.notifier).changePassword(_currentCtrl.text, _newCtrl.text);
    if (ok && mounted) context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final c    = AppColors(isDarkMode(context));
    final dark = isDarkMode(context);

    return Scaffold(
      backgroundColor: c.bg,
      body: Stack(children: [
        Positioned(top: -80, right: -60, child: Container(width: 280, height: 280,
          decoration: BoxDecoration(shape: BoxShape.circle,
            gradient: RadialGradient(colors: [
              AppBrand.navy.withOpacity(dark ? 0.4 : 0.08), Colors.transparent])))),

        SafeArea(child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(children: [
            const SizedBox(height: 24),

            // Logo
            Container(width: 88, height: 88,
              decoration: BoxDecoration(shape: BoxShape.circle, color: c.surface1,
                border: Border.all(color: c.accent.withOpacity(0.45), width: 2),
                boxShadow: [BoxShadow(color: c.accent.withOpacity(0.12), blurRadius: 24)]),
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Image.asset('assets/images/logo.png',
                  width: 72, height: 72, fit: BoxFit.contain))),
            const SizedBox(height: 12),
            Text('TANZANIA POLICE FORCE', style: TextStyle(
              color: c.accent, fontSize: 10,
              fontWeight: FontWeight.w800, letterSpacing: 2.5)),
            const SizedBox(height: 2),
            Text('CORPORATION SOLE', style: TextStyle(
              color: c.textMuted, fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 2)),
            const SizedBox(height: 28),

            // Warning banner
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: AppBrand.warningDim,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppBrand.warning.withOpacity(0.4))),
              child: const Row(children: [
                Icon(Icons.lock_clock_outlined, color: AppBrand.warning, size: 20),
                SizedBox(width: 10),
                Expanded(child: Text('You must set a new password before continuing.',
                  style: TextStyle(color: AppBrand.warning, fontSize: 13, fontWeight: FontWeight.w600))),
              ]),
            ),
            const SizedBox(height: 20),

            // Form card
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: c.surface0, borderRadius: BorderRadius.circular(24),
                border: Border.all(color: c.border),
                boxShadow: [BoxShadow(color: AppBrand.navy.withOpacity(dark ? 0.3 : 0.06),
                  blurRadius: 20, offset: const Offset(0, 6))]),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Set New Password', style: TextStyle(
                  color: c.textPrimary, fontSize: 18, fontWeight: FontWeight.w900)),
                const SizedBox(height: 20),

                if (auth.error != null) ...[ErrorBanner(auth.error!), const SizedBox(height: 16)],

                _PassField('CURRENT PASSWORD', _currentCtrl, _showCurrent,
                    () => setState(() => _showCurrent = !_showCurrent),
                    'Enter your current password', c),
                const SizedBox(height: 16),
                _PassField('NEW PASSWORD', _newCtrl, _showNew,
                    () => setState(() => _showNew = !_showNew),
                    'Enter new password', c),
                const SizedBox(height: 16),
                _PassField('CONFIRM NEW PASSWORD', _confirmCtrl, _showConfirm,
                    () => setState(() => _showConfirm = !_showConfirm),
                    'Confirm new password', c),

                // Password rules
                if (_newCtrl.text.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: c.surface1,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: c.border)),
                    child: Column(children: _rules.map((r) => Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(children: [
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          width: 18, height: 18,
                          decoration: BoxDecoration(shape: BoxShape.circle,
                            color: r.ok ? AppBrand.success : c.surface2,
                            border: Border.all(color: r.ok ? AppBrand.success : c.border)),
                          child: r.ok ? const Icon(Icons.check_rounded,
                            size: 11, color: Color(0xFF060A18)) : null),
                        const SizedBox(width: 10),
                        Text(r.label, style: TextStyle(
                          color: r.ok ? AppBrand.success : c.textMuted,
                          fontSize: 12, fontWeight: FontWeight.w500)),
                      ]),
                    )).toList()),
                  ),
                ],
                const SizedBox(height: 24),
                ConfirmButton(
                  label: auth.isLoading ? 'Updating…' : 'Set New Password',
                  onPressed: (_isValid && !auth.isLoading) ? _submit : null,
                  loading: auth.isLoading, icon: Icons.check_circle_outline_rounded),
              ]),
            ),
            const SizedBox(height: 28),
            Text('WITH SERVICE, WE DON\'T COMPROMISE', style: TextStyle(
              color: c.textMuted, fontSize: 10, letterSpacing: 1.5, fontWeight: FontWeight.w600)),
          ]),
        )),
      ]),
    );
  }
}

class _Rule { final String label; final bool ok; const _Rule(this.label, this.ok); }

class _PassField extends StatelessWidget {
  final String label, hint;
  final TextEditingController ctrl;
  final bool show;
  final VoidCallback onToggle;
  final AppColors c;
  const _PassField(this.label, this.ctrl, this.show, this.onToggle, this.hint, this.c);

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(label, style: TextStyle(color: c.textMuted, fontSize: 10,
      fontWeight: FontWeight.w700, letterSpacing: 1.5)),
    const SizedBox(height: 8),
    TextField(
      controller: ctrl, obscureText: !show,
      style: TextStyle(color: c.textPrimary, fontSize: 15),
      onChanged: (_) {},
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: Icon(Icons.lock_outline_rounded, color: c.textMuted, size: 20),
        suffixIcon: GestureDetector(onTap: onToggle,
          child: Icon(show ? Icons.visibility_outlined : Icons.visibility_off_outlined,
            color: c.textMuted, size: 20))),
    ),
  ]);
}
