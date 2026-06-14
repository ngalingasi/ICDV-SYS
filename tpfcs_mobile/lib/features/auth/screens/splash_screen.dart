import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/api/api_client.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/theme_provider.dart';
import '../../../core/theme/app_theme.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});
  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _fade, _scale, _progress;

  @override
  void initState() {
    super.initState();
    // Shorter animation — 900ms total instead of 2400ms
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _fade = CurvedAnimation(
      parent: _ctrl,
      curve: const Interval(0.0, 0.6, curve: Curves.easeOut),
    );
    _scale = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.0, 0.6, curve: Curves.easeOutBack),
      ),
    );
    _progress = CurvedAnimation(
      parent: _ctrl,
      curve: const Interval(0.2, 1.0, curve: Curves.easeInOut),
    );

    // Check token from secure storage immediately — no network call needed.
    // If a token exists, navigate to dashboard optimistically.
    // The router's redirect + authProvider will validate in the background
    // and redirect to /login if the token is invalid/expired.
    _ctrl.forward().then((_) async {
      if (!mounted) return;
      final token = await getAccessToken();
      if (!mounted) return;
      context.go(token != null ? '/dashboard' : '/login');
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = isDarkMode(context);
    final c = AppColors(dark);
    final bg = c.bg;

    return Scaffold(
      backgroundColor: bg,
      body: Stack(
        children: [
          Positioned(
            top: -100,
            left: -80,
            child: _Glow(
              size: 420,
              color: AppColors.navy.withOpacity(dark ? 0.35 : 0.12),
            ),
          ),
          Positioned(
            bottom: -80,
            right: -60,
            child: _Glow(
              size: 320,
              color: c.accent.withOpacity(dark ? 0.08 : 0.10),
            ),
          ),

          Center(
            child: AnimatedBuilder(
              animation: _ctrl,
              builder:
                  (_, __) => Opacity(
                    opacity: _fade.value,
                    child: Transform.scale(
                      scale: _scale.value,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Logo
                          Container(
                            width: 130,
                            height: 130,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: c.surface1,
                              border: Border.all(
                                color: AppBrand.gold.withOpacity(0.5),
                                width: 2.5,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: c.accent.withOpacity(0.2),
                                  blurRadius: 40,
                                  spreadRadius: 4,
                                ),
                                BoxShadow(
                                  color: AppColors.navy.withOpacity(0.6),
                                  blurRadius: 20,
                                ),
                              ],
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(10),
                              child: Image.asset(
                                'assets/images/logo.png',
                                width: 110,
                                height: 110,
                                fit: BoxFit.contain,
                              ),
                            ),
                          ),
                          const SizedBox(height: 32),

                          Text(
                            'TANZANIA POLICE FORCE',
                            style: TextStyle(
                              color: c.accent,
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 3,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'CORPORATION SOLE',
                            style: TextStyle(
                              color: c.textSecond,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 3,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.navy.withOpacity(
                                dark ? 0.5 : 0.08,
                              ),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(
                                color: AppColors.navyLight.withOpacity(
                                  dark ? 0.6 : 0.2,
                                ),
                              ),
                            ),
                            child: Text(
                              'TPFCS VEHICLE OPERATIONS',
                              style: TextStyle(
                                color: c.textMuted,
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 2.5,
                              ),
                            ),
                          ),
                          const SizedBox(height: 56),

                          // Progress bar
                          SizedBox(
                            width: 200,
                            child: Stack(
                              children: [
                                Container(
                                  height: 2,
                                  decoration: BoxDecoration(
                                    color: c.border,
                                    borderRadius: BorderRadius.circular(2),
                                  ),
                                ),
                                FractionallySizedBox(
                                  widthFactor: _progress.value,
                                  child: Container(
                                    height: 2,
                                    decoration: BoxDecoration(
                                      color: c.accent,
                                      borderRadius: BorderRadius.circular(2),
                                      boxShadow: [
                                        BoxShadow(
                                          color: c.accent.withOpacity(0.7),
                                          blurRadius: 8,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            'Initialising secure session…',
                            style: TextStyle(
                              color: c.textMuted,
                              fontSize: 11,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Glow extends StatelessWidget {
  final double size;
  final Color color;
  const _Glow({required this.size, required this.color});
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      gradient: RadialGradient(colors: [color, Colors.transparent]),
    ),
  );
}
