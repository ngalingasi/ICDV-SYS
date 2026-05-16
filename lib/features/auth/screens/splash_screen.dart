import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});
  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 1800), _navigate);
  }

  void _navigate() {
    final auth = ref.read(authProvider);
    if (!mounted) return;
    context.go(auth.isAuthenticated ? '/home' : '/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.brand500,
      body: Center(child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 88, height: 88,
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(22),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 24, offset: const Offset(0, 8))],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: Image.asset('assets/images/logo.png', fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Icon(Icons.local_shipping, size: 48, color: AppColors.brand500)),
            ),
          ),
          const SizedBox(height: 24),
          const Text('ICDV Operations',
              style: TextStyle(color: AppColors.white, fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
          const SizedBox(height: 6),
          Text('Vehicle Import & Delivery',
              style: TextStyle(color: AppColors.white.withValues(alpha: 0.75), fontSize: 14)),
          const SizedBox(height: 48),
          SizedBox(width: 32, height: 32,
              child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.white.withValues(alpha: 0.6))),
        ],
      )),
    );
  }
}
