import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/theme_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  // Not const — Color values can't be const in all Flutter versions
  static final _ops = [
    _Op('Discharge',    Icons.anchor_rounded,        '/discharge',
        const Color(0xFFCFDEF7), const Color(0xFFADC6F0), const Color(0xFF6AAEF5)),
    _Op('Batch',        Icons.layers_rounded,         '/batch',
        const Color(0xFFE2D4F7), const Color(0xFFCBB8F0), const Color(0xFFB28CF5)),
    _Op('TPA Transfer', Icons.local_shipping_rounded, '/transfer',
        const Color(0xFFFDE8CC), const Color(0xFFF9D0A0), const Color(0xFFF5A652)),
    _Op('Yard Receive', Icons.warehouse_rounded,      '/receive',
        const Color(0xFFCCF0DC), const Color(0xFFA0E0BC), const Color(0xFF4DC98A)),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user      = ref.watch(authProvider).user;
    final firstName = user?.fullName.split(' ').first ?? 'Operator';
    final initial   = user?.fullName.isNotEmpty == true ? user!.fullName[0].toUpperCase() : 'U';
    final c         = AppColors(isDarkMode(context));
    final dark      = isDarkMode(context);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: c.bg,
        body: CustomScrollView(slivers: [
          SliverToBoxAdapter(child: Stack(children: [
            Positioned(top: -40, right: -40, child: Container(width: 280, height: 280,
              decoration: BoxDecoration(shape: BoxShape.circle,
                gradient: RadialGradient(colors: [
                  AppColors.navy.withOpacity(dark ? 0.4 : 0.07), Colors.transparent])))),

            SafeArea(child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  // Logo chip
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: c.surface1,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: c.border)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      ClipOval(child: Image.asset('assets/images/logo.png',
                        width: 22, height: 22, fit: BoxFit.cover)),
                      const SizedBox(width: 8),
                      Text('TPFCS', style: TextStyle(
                        color: c.accent, fontSize: 11,
                        fontWeight: FontWeight.w800, letterSpacing: 1.5)),
                    ]),
                  ),
                  const Spacer(),

                  // Theme toggle
                  GestureDetector(
                    onTap: () => ref.read(themeProvider.notifier).toggle(context),
                    child: Container(
                      width: 38, height: 38,
                      decoration: BoxDecoration(color: c.surface1,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: c.border)),
                      child: Icon(dark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                        color: c.accent, size: 18)),
                  ),
                  const SizedBox(width: 10),

                  // Avatar
                  GestureDetector(
                    onTap: () => context.push('/profile'),
                    child: Container(width: 38, height: 38,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: c.surface1,
                          border: Border.all(color: c.accent.withOpacity(0.5), width: 1.5)),
                      child: Center(child: Text(initial, style: TextStyle(
                        color: c.accent, fontWeight: FontWeight.w900, fontSize: 16)))),
                  ),
                ]),
                const SizedBox(height: 28),

                Text('Hello, $firstName', style: TextStyle(color: c.textSecond, fontSize: 14)),
                const SizedBox(height: 4),
                Text(
                  'Operations Dashboard',
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 30,
                    fontWeight: FontWeight.w900,
                    height: 1.1,
                    letterSpacing: -0.8,
                  ),
                ),
                if (user?.icdvName != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: c.accentDim,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: c.accent.withOpacity(0.3))),
                    child: Text(user!.icdvName!, style: TextStyle(
                      color: c.accent, fontSize: 11, fontWeight: FontWeight.w700))),
                ],
                const SizedBox(height: 28),
              ]),
            )),
          ])),

          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverGrid(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) => _OpCard(op: _ops[i]), childCount: _ops.length),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2, crossAxisSpacing: 12,
                mainAxisSpacing: 12, childAspectRatio: 0.92),
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 8),
            sliver: SliverToBoxAdapter(child: Row(children: [
              Text('QUICK ACTIONS', style: TextStyle(
                color: c.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 2)),
              const Spacer(),
              Container(width: 40, height: 1, color: c.border),
            ])),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
            sliver: SliverList(delegate: SliverChildListDelegate([
              const SizedBox(height: 12),
              _QuickRow(icon: Icons.search_rounded, label: 'Chassis Search',
                  sub: 'Track any vehicle status', onTap: () => context.push('/search')),
              const SizedBox(height: 10),
              _QuickRow(icon: Icons.person_outline_rounded, label: 'My Profile',
                  sub: 'Account & settings', onTap: () => context.push('/profile')),
            ])),
          ),
        ]),
      ),
    );
  }
}

class _Op {
  final String label, route;
  final IconData icon;
  final Color gradStart, gradEnd, symbolColor;
  const _Op(this.label, this.icon, this.route,
      this.gradStart, this.gradEnd, this.symbolColor);
}

class _OpCard extends ConsumerWidget {
  final _Op op;
  const _OpCard({super.key, required this.op});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = isDarkMode(context);
    final c    = AppColors(dark);

    // Light mode: soft pastel gradient
    // Dark mode: stronger tinted gradient — visible but not garish
    final cardBg = dark
        ? LinearGradient(colors: [
            op.gradStart.withOpacity(0.35),
            op.gradEnd.withOpacity(0.20),
          ], begin: Alignment.topLeft, end: Alignment.bottomRight)
        : LinearGradient(colors: [op.gradStart, op.gradEnd],
            begin: Alignment.topLeft, end: Alignment.bottomRight);

    final symbolOpacity  = dark ? 0.25 : 0.22;
    final borderColor    = dark ? op.gradStart.withOpacity(0.4) : Colors.transparent;

    final labelColor = dark ? Colors.white : AppColors.navy;

    return GestureDetector(
      onTap: () => context.push(op.route),
      child: Container(
        decoration: BoxDecoration(
          gradient: cardBg,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: borderColor, width: 1.5),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Stack(children: [
            // ── Large watermark icon (bottom-right) ──────────────────────
            Positioned(
              right: -18, bottom: -18,
              child: Icon(op.icon, size: 110,
                color: dark
                    ? op.symbolColor.withOpacity(0.30)
                    : op.symbolColor.withOpacity(0.22)),
            ),
            // ── Content ──────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(op.label,
                    style: TextStyle(
                      color: labelColor,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    )),
                  const Spacer(),
                  // Small outlined symbol (bottom-left)
                  Icon(op.icon, size: 28,
                    color: op.symbolColor.withOpacity(dark ? 0.9 : 0.65)),
                ],
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

class _QuickRow extends StatelessWidget {
  final IconData icon; final String label, sub; final VoidCallback onTap;
  const _QuickRow({required this.icon, required this.label, required this.sub, required this.onTap});
  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(color: c.surface0,
          borderRadius: BorderRadius.circular(16), border: Border.all(color: c.border)),
        child: Row(children: [
          Container(width: 38, height: 38,
            decoration: BoxDecoration(color: c.accentDim, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: c.accent, size: 18)),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: TextStyle(
              color: c.textPrimary, fontWeight: FontWeight.w700, fontSize: 14)),
            Text(sub, style: TextStyle(color: c.textMuted, fontSize: 12)),
          ])),
          Icon(Icons.chevron_right_rounded, color: c.textMuted, size: 20),
        ]),
      ),
    );
  }
}
