import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/widgets.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _loginCtrl    = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _loginCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final ok = await ref.read(authProvider.notifier)
        .login(_loginCtrl.text.trim(), _passwordCtrl.text);
    if (ok && mounted) context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    final auth    = ref.watch(authProvider);
    final loading = auth.isLoading;

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(children: [
            const SizedBox(height: 56),

            // Logo
            Container(
              width: 80, height: 80,
              decoration: BoxDecoration(
                color: AppColors.brand500,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [BoxShadow(color: AppColors.brand500.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 8))],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Image.asset('assets/images/logo.png', fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(Icons.local_shipping, size: 40, color: AppColors.white)),
              ),
            ),
            const SizedBox(height: 20),
            const Text('ICDV Operations',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.gray900)),
            const SizedBox(height: 4),
            const Text('Sign in to continue',
                style: TextStyle(color: AppColors.gray500, fontSize: 14)),
            const SizedBox(height: 40),

            // Form card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.gray200),
              ),
              child: Column(children: [
                // Error
                if (auth.error != null) ...[
                  ErrorBanner(auth.error!),
                  const SizedBox(height: 16),
                ],

                // Username
                TextField(
                  controller: _loginCtrl,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    hintText: 'Username or Email',
                    prefixIcon: Icon(Icons.person_outline, color: AppColors.gray400),
                  ),
                ),
                const SizedBox(height: 14),

                // Password
                TextField(
                  controller: _passwordCtrl,
                  obscureText: _obscure,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _submit(),
                  decoration: InputDecoration(
                    hintText: 'Password',
                    prefixIcon: const Icon(Icons.lock_outline, color: AppColors.gray400),
                    suffixIcon: IconButton(
                      icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility, color: AppColors.gray400, size: 20),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Sign in button
                ConfirmButton(
                  label: 'Sign In',
                  onPressed: _submit,
                  loading: loading,
                  icon: Icons.login,
                ),
              ]),
            ),

            const SizedBox(height: 24),
            const Text('Tanzania Police Force · ICDV Management',
                style: TextStyle(color: AppColors.gray400, fontSize: 11), textAlign: TextAlign.center),
            const SizedBox(height: 24),
          ]),
        ),
      ),
    );
  }
}
