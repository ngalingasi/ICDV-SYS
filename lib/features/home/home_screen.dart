import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  static const _ops = [
    _OpTile('Discharge',    Icons.anchor,         '/discharge', AppColors.cyan500,   'Vessel → Holding Ground'),
    _OpTile('Batch',        Icons.inventory_2,    '/batch',     AppColors.violet500, 'Assign to batch'),
    _OpTile('TPA Transfer', Icons.local_shipping, '/transfer',  AppColors.orange500, 'TPA Gate → ICDV Yard'),
    _OpTile('Yard Receive', Icons.warehouse,      '/receive',   AppColors.emerald500,'Confirm yard arrival'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    return Scaffold(
      backgroundColor: AppColors.scaffold,
      body: SafeArea(child: Column(children: [
        // ── Header ──────────────────────────────────────────────────────────
        Container(
          color: AppColors.white,
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
          child: Row(children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: AppColors.brand500, borderRadius: BorderRadius.circular(10)),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.asset('assets/images/logo.png', fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(Icons.local_shipping, size: 22, color: AppColors.white)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('ICDV Operations',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.gray900)),
              if (user?.icdvName != null)
                Text(user!.icdvName!, style: const TextStyle(color: AppColors.brand500, fontSize: 12, fontWeight: FontWeight.w600)),
            ])),
            GestureDetector(
              onTap: () => context.push('/profile'),
              child: CircleAvatar(
                radius: 20, backgroundColor: AppColors.brand100,
                child: Text(
                  (user?.fullName.isNotEmpty == true ? user!.fullName[0] : 'U').toUpperCase(),
                  style: const TextStyle(color: AppColors.brand600, fontWeight: FontWeight.w700, fontSize: 16),
                ),
              ),
            ),
          ]),
        ),
        const Divider(height: 1),

        // ── Content ─────────────────────────────────────────────────────────
        Expanded(child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // Greeting
            Text('Hello, ${user?.fullName.split(' ').first ?? 'Operator'} 👋',
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.gray900)),
            const SizedBox(height: 4),
            const Text('Select an operation to begin',
                style: TextStyle(color: AppColors.gray500, fontSize: 14)),
            const SizedBox(height: 24),

            // Operations grid
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 14,
              mainAxisSpacing: 14,
              childAspectRatio: 1.05,
              children: _ops.map((op) => _OpCard(op)).toList(),
            ),
            const SizedBox(height: 24),

            // Quick search
            const Text('QUICK ACTIONS', style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w700,
                color: AppColors.gray400, letterSpacing: 0.8)),
            const SizedBox(height: 12),
            _QuickTile(icon: Icons.search, label: 'Chassis Search', subtitle: 'Track any vehicle',
                onTap: () => context.push('/search')),
            const SizedBox(height: 10),
            _QuickTile(icon: Icons.person_outline, label: 'My Profile', subtitle: 'Account & settings',
                onTap: () => context.push('/profile')),
          ]),
        )),
      ])),
    );
  }
}

class _OpTile {
  final String label, route, subtitle;
  final IconData icon;
  final Color color;
  const _OpTile(this.label, this.icon, this.route, this.color, this.subtitle);
}

class _OpCard extends StatelessWidget {
  final _OpTile op;
  const _OpCard(this.op, {super.key});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: () => context.push(op.route),
    child: Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gray200),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      padding: const EdgeInsets.all(18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(
            color: op.color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(op.icon, color: op.color, size: 24),
        ),
        const Spacer(),
        Text(op.label, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.gray900)),
        const SizedBox(height: 3),
        Text(op.subtitle, style: const TextStyle(color: AppColors.gray400, fontSize: 11)),
      ]),
    ),
  );
}

class _QuickTile extends StatelessWidget {
  final IconData icon;
  final String label, subtitle;
  final VoidCallback onTap;
  const _QuickTile({required this.icon, required this.label, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.gray200),
      ),
      child: Row(children: [
        Container(
          width: 38, height: 38,
          decoration: BoxDecoration(color: AppColors.brand50, borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: AppColors.brand500, size: 20),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.gray900)),
          Text(subtitle, style: const TextStyle(color: AppColors.gray400, fontSize: 12)),
        ])),
        const Icon(Icons.chevron_right, color: AppColors.gray300),
      ]),
    ),
  );
}
