import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/theme_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/widgets.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _loginCtrl    = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;
  String? _selectedChannel;
  final _otpControllers = List.generate(6, (_) => TextEditingController());
  final _otpFocusNodes  = List.generate(6, (_) => FocusNode());

  late AnimationController _animCtrl;
  late Animation<double>   _fade;
  late Animation<Offset>   _slide;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 500));
    _fade  = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _slide = Tween<Offset>(begin: const Offset(0, 0.05), end: Offset.zero)
        .animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _animCtrl.forward();
  }

  @override
  void dispose() {
    _animCtrl.dispose(); _loginCtrl.dispose(); _passwordCtrl.dispose();
    for (final c in _otpControllers) c.dispose();
    for (final f in _otpFocusNodes)  f.dispose();
    super.dispose();
  }

  void _animateIn() { _animCtrl.reset(); _animCtrl.forward(); }
  String get _otpValue => _otpControllers.map((c) => c.text).join();

  void _handleOtpChange(String val, int idx) {
    final digit = val.replaceAll(RegExp(r'\D'), '');
    if (digit.isEmpty) {
      _otpControllers[idx].clear();
      if (idx > 0) _otpFocusNodes[idx - 1].requestFocus();
    } else {
      _otpControllers[idx].text = digit[0];
      if (idx < 5) _otpFocusNodes[idx + 1].requestFocus();
    }
    setState(() {});
  }

  void _clearOtp() { for (final c in _otpControllers) c.clear(); setState(() {}); }

  Future<void> _submitCredentials() async {
    await ref.read(authProvider.notifier)
        .validateCredentials(_loginCtrl.text.trim(), _passwordCtrl.text);
    _animateIn();
  }

  Future<void> _selectChannel(String channel) async {
    setState(() => _selectedChannel = channel);
    await ref.read(authProvider.notifier).sendOtp(channel);
    _animateIn();
  }

  Future<void> _verifyOtp() async {
    if (_otpValue.length < 6) return;
    await ref.read(authProvider.notifier).verifyOtp(_otpValue);
    final auth = ref.read(authProvider);
    if (auth.isAuthenticated && mounted)
      context.go(auth.user!.mustChangePassword ? '/change-password' : '/dashboard');
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final step = auth.step;
    final c    = AppColors(isDarkMode(context));
    final dark = isDarkMode(context);

    return Scaffold(
      backgroundColor: c.bg,
      body: Stack(children: [
        Positioned(top: -80, right: -60, child: _Glow(r: 280,
          color: AppColors.navy.withOpacity(dark ? 0.45 : 0.10))),
        Positioned(bottom: -60, left: -40, child: _Glow(r: 200,
          color: c.accent.withOpacity(dark ? 0.06 : 0.08))),

        SafeArea(child: FadeTransition(opacity: _fade, child: SlideTransition(position: _slide,
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(children: [
              const SizedBox(height: 40),

              // Logo
              Center(child: Container(
                width: 96, height: 96,
                decoration: BoxDecoration(
                  shape: BoxShape.circle, color: c.surface1,
                  border: Border.all(color: c.accent.withOpacity(0.5), width: 2),
                  boxShadow: [
                    BoxShadow(color: c.accent.withOpacity(0.15), blurRadius: 28),
                    BoxShadow(color: AppColors.navy.withOpacity(dark ? 0.5 : 0.15), blurRadius: 14),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: Image.asset('assets/images/logo.png',
                    width: 80, height: 80, fit: BoxFit.contain)),
              )),
              const SizedBox(height: 14),
              Text('TANZANIA POLICE FORCE', style: TextStyle(
                color: c.accent, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 2.5)),
              const SizedBox(height: 2),
              Text('CORPORATION SOLE', style: TextStyle(
                color: c.textMuted, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 2)),
              const SizedBox(height: 32),

              if (auth.error != null) ...[ErrorBanner(auth.error!), const SizedBox(height: 16)],

              // Step 1
              if (step == AuthStep.idle || step == AuthStep.credentials)
                _CredentialsCard(
                  loginCtrl: _loginCtrl, passwordCtrl: _passwordCtrl,
                  obscure: _obscure, loading: auth.isLoading,
                  onToggleObscure: () => setState(() => _obscure = !_obscure),
                  onSubmit: _submitCredentials,
                ),

              // Step 2
              if (step == AuthStep.channel)
                _ChannelCard(
                  channels: auth.channels, loading: auth.isLoading,
                  selectedChannel: _selectedChannel,
                  onSelect: _selectChannel,
                  onBack: () { ref.read(authProvider.notifier).backToCredentials(); _animateIn(); },
                ),

              // Step 3
              if (step == AuthStep.otp)
                _OtpCard(
                  maskedContact: auth.maskedContact,
                  controllers: _otpControllers, focusNodes: _otpFocusNodes,
                  otpValue: _otpValue, loading: auth.isLoading,
                  onChanged: _handleOtpChange,
                  onVerify: _verifyOtp,
                  onResend: () async {
                    _clearOtp();
                    if (_selectedChannel != null)
                      await ref.read(authProvider.notifier).resendOtp(_selectedChannel!);
                  },
                  onBack: () {
                    ref.read(authProvider.notifier).backToChannel();
                    _clearOtp(); _animateIn();
                  },
                ),

              const SizedBox(height: 28),
              Text('WITH SERVICE, WE DON\'T COMPROMISE', style: TextStyle(
                color: c.textMuted, fontSize: 10, letterSpacing: 1.5, fontWeight: FontWeight.w600)),
              const SizedBox(height: 24),
            ]),
          ),
        ))),
      ]),
    );
  }
}

// ── Step 1 ────────────────────────────────────────────────────────────────────
class _CredentialsCard extends StatelessWidget {
  final TextEditingController loginCtrl, passwordCtrl;
  final bool obscure, loading;
  final VoidCallback onToggleObscure, onSubmit;
  const _CredentialsCard({required this.loginCtrl, required this.passwordCtrl,
      required this.obscure, required this.loading,
      required this.onToggleObscure, required this.onSubmit});

  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Sign In', style: TextStyle(
        color: c.textPrimary, fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: -0.3)),
      const SizedBox(height: 4),
      Text('Enter your credentials to continue',
        style: TextStyle(color: c.textSecond, fontSize: 13)),
      const SizedBox(height: 24),

      _FieldLabel('USERNAME / EMAIL'),
      const SizedBox(height: 8),
      TextField(
        controller: loginCtrl,
        textInputAction: TextInputAction.next,
        style: TextStyle(color: c.textPrimary, fontSize: 15),
        decoration: const InputDecoration(
          hintText: 'Username or email address',  // ← fixed placeholder
          prefixIcon: Icon(Icons.person_outline_rounded, color: Color(0xFF4A5E8A), size: 20),
        ),
      ),
      const SizedBox(height: 16),

      _FieldLabel('PASSWORD'),
      const SizedBox(height: 8),
      TextField(
        controller: passwordCtrl,
        obscureText: obscure,
        textInputAction: TextInputAction.done,
        onSubmitted: (_) => onSubmit(),
        style: TextStyle(color: c.textPrimary, fontSize: 15),
        decoration: InputDecoration(
          hintText: 'Enter your password',
          prefixIcon: const Icon(Icons.lock_outline_rounded, color: Color(0xFF4A5E8A), size: 20),
          suffixIcon: GestureDetector(
            onTap: onToggleObscure,
            child: Icon(obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              color: c.textMuted, size: 20)),
        ),
      ),
      const SizedBox(height: 24),
      ConfirmButton(label: loading ? 'Verifying…' : 'Continue →',
        onPressed: loading ? null : onSubmit, loading: loading,
        icon: Icons.arrow_forward_rounded),
    ]));
  }
}

// ── Step 2 ────────────────────────────────────────────────────────────────────
class _ChannelCard extends StatelessWidget {
  final List<OtpChannel> channels;
  final bool loading;
  final String? selectedChannel;
  final Function(String) onSelect;
  final VoidCallback onBack;
  const _ChannelCard({required this.channels, required this.loading,
      required this.selectedChannel, required this.onSelect, required this.onBack});

  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Choose Verification', style: TextStyle(
        color: c.textPrimary, fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: -0.3)),
      const SizedBox(height: 4),
      Text('Select how to receive your OTP',
        style: TextStyle(color: c.textSecond, fontSize: 13)),
      const SizedBox(height: 24),

      ...channels.map((ch) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: GestureDetector(
          onTap: loading ? null : () => onSelect(ch.type),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: selectedChannel == ch.type ? c.accentDim : c.surface1,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: selectedChannel == ch.type
                    ? c.accent.withOpacity(0.6) : c.border,
                width: selectedChannel == ch.type ? 1.5 : 1),
            ),
            child: Row(children: [
              Container(width: 42, height: 42,
                decoration: BoxDecoration(color: c.accentDim,
                    borderRadius: BorderRadius.circular(10)),
                child: Icon(ch.type == 'email' ? Icons.email_outlined : Icons.sms_outlined,
                  color: c.accent, size: 20)),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(ch.label, style: TextStyle(
                  color: c.textPrimary, fontWeight: FontWeight.w700, fontSize: 14)),
                Text(ch.display, style: TextStyle(color: c.textSecond, fontSize: 12)),
              ])),
              if (loading && selectedChannel == ch.type)
                SizedBox(width: 18, height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: c.accent)),
            ]),
          ),
        ),
      )),
      const SizedBox(height: 8),
      _BackButton(onBack),
    ]));
  }
}

// ── Step 3 ────────────────────────────────────────────────────────────────────
class _OtpCard extends StatelessWidget {
  final String maskedContact;
  final List<TextEditingController> controllers;
  final List<FocusNode> focusNodes;
  final String otpValue;
  final bool loading;
  final Function(String, int) onChanged;
  final VoidCallback onVerify, onResend, onBack;
  const _OtpCard({required this.maskedContact, required this.controllers,
      required this.focusNodes, required this.otpValue, required this.loading,
      required this.onChanged, required this.onVerify, required this.onResend, required this.onBack});

  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Enter Code', style: TextStyle(
        color: c.textPrimary, fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: -0.3)),
      const SizedBox(height: 4),
      RichText(text: TextSpan(
        style: TextStyle(color: c.textSecond, fontSize: 13),
        children: [
          const TextSpan(text: 'Code sent to '),
          TextSpan(text: maskedContact, style: TextStyle(
            color: c.textPrimary, fontWeight: FontWeight.w700)),
        ],
      )),
      const SizedBox(height: 24),

      _FieldLabel('6-DIGIT SECURITY CODE'),
      const SizedBox(height: 12),

      Row(children: List.generate(6, (i) => Expanded(
        child: Padding(
          padding: EdgeInsets.only(left: i == 0 ? 0 : 6),
          child: _OtpBox(
            controller: controllers[i], focusNode: focusNodes[i],
            onChanged: (val) => onChanged(val, i),
            onKeyDown: (event) {
              if (event is RawKeyDownEvent &&
                  event.logicalKey == LogicalKeyboardKey.backspace &&
                  controllers[i].text.isEmpty && i > 0) {
                focusNodes[i - 1].requestFocus();
              }
            },
          ),
        ),
      ))),
      const SizedBox(height: 24),

      ConfirmButton(
        label: loading ? 'Verifying…' : 'Verify & Sign In',
        onPressed: (otpValue.length >= 6 && !loading) ? onVerify : null,
        loading: loading, icon: Icons.verified_user_outlined),
      const SizedBox(height: 16),

      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        _BackButton(onBack),
        GestureDetector(
          onTap: loading ? null : onResend,
          child: Text('Resend code', style: TextStyle(
            color: c.accent, fontSize: 13, fontWeight: FontWeight.w700))),
      ]),
    ]));
  }
}

class _OtpBox extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final Function(String) onChanged;
  final Function(RawKeyEvent) onKeyDown;
  const _OtpBox({required this.controller, required this.focusNode,
      required this.onChanged, required this.onKeyDown});

  @override
  Widget build(BuildContext context) {
    final c    = AppColors(isDarkMode(context));
    final full = controller.text.isNotEmpty;
    return RawKeyboardListener(
      focusNode: FocusNode(), onKey: onKeyDown,
      child: TextField(
        controller: controller, focusNode: focusNode,
        textAlign: TextAlign.center,
        keyboardType: TextInputType.number, maxLength: 1,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: TextStyle(color: c.accent, fontSize: 22, fontWeight: FontWeight.w900),
        decoration: InputDecoration(
          counterText: '',
          filled: true,
          fillColor: full ? c.accentDim : c.surface1,
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: full ? c.accent.withOpacity(0.6) : c.border)),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: c.accent, width: 1.5)),
          contentPadding: const EdgeInsets.symmetric(vertical: 14),
        ),
        onChanged: onChanged,
      ),
    );
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────
class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});
  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return Container(
      width: double.infinity, padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: c.surface0, borderRadius: BorderRadius.circular(24),
        border: Border.all(color: c.border),
        boxShadow: [BoxShadow(
          color: AppColors.navy.withOpacity(isDarkMode(context) ? 0.3 : 0.06),
          blurRadius: 24, offset: const Offset(0, 8))],
      ),
      child: child,
    );
  }
}

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);
  @override
  Widget build(BuildContext context) => Text(text, style: TextStyle(
    color: AppColors(isDarkMode(context)).textMuted,
    fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.5));
}

class _BackButton extends StatelessWidget {
  final VoidCallback onTap;
  const _BackButton(this.onTap);
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.arrow_back_rounded, color: AppColors(isDarkMode(context)).textMuted, size: 14),
      const SizedBox(width: 4),
      Text('Back', style: TextStyle(color: AppColors(isDarkMode(context)).textMuted, fontSize: 13)),
    ]));
}

class _Glow extends StatelessWidget {
  final double r; final Color color;
  const _Glow({required this.r, required this.color});
  @override
  Widget build(BuildContext context) => Container(width: r, height: r,
    decoration: BoxDecoration(shape: BoxShape.circle,
      gradient: RadialGradient(colors: [color, Colors.transparent])));
}
