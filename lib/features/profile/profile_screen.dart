import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(children: [
            // Avatar
            CircleAvatar(radius: 40, backgroundColor: AppColors.brand100,
              child: Text(
                (user?.fullName.isNotEmpty == true ? user!.fullName[0] : 'U').toUpperCase(),
                style: const TextStyle(color: AppColors.brand600, fontWeight: FontWeight.w800, fontSize: 32),
              )),
            const SizedBox(height: 14),
            Text(user?.fullName ?? '—', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.gray900)),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(color: AppColors.brand50, borderRadius: BorderRadius.circular(20)),
              child: Text(user?.role.replaceAll('_', ' ').toUpperCase() ?? '—',
                  style: const TextStyle(color: AppColors.brand600, fontSize: 12, fontWeight: FontWeight.w700)),
            ),
            if (user?.icdvName != null) ...[
              const SizedBox(height: 6),
              Text(user!.icdvName!, style: const TextStyle(color: AppColors.gray500, fontSize: 14)),
            ],
            const SizedBox(height: 28),

            // Info tiles
            _InfoCard(items: [
              _Item('Username', user?.username ?? '—', Icons.person_outline),
              _Item('Role',     user?.role.replaceAll('_', ' ') ?? '—', Icons.badge_outlined),
              if (user?.icdvName != null)
                _Item('ICDV', user!.icdvName!, Icons.business_outlined),
            ]),
            const SizedBox(height: 16),

            // Logout
            SizedBox(
              width: double.infinity, height: 52,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.logout),
                label: const Text('Sign Out', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.red500,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () async {
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) context.go('/login');
                },
              ),
            ),
            const SizedBox(height: 32),
            const Text('ICDV Operations v1.0.0',
                style: TextStyle(color: AppColors.gray300, fontSize: 11)),
            const Text('Tanzania Police Force · ICDV Management',
                style: TextStyle(color: AppColors.gray300, fontSize: 11)),
          ]),
        ),
      ),
    );
  }
}

class _Item { final String l, v; final IconData i; const _Item(this.l, this.v, this.i); }

class _InfoCard extends StatelessWidget {
  final List<_Item> items;
  const _InfoCard({super.key, required this.items});
  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(color: AppColors.white, borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.gray200)),
    child: Column(children: items.asMap().entries.map((e) {
      final item = e.value;
      final isLast = e.key == items.length - 1;
      return Column(children: [
        ListTile(leading: Icon(item.i, color: AppColors.brand500, size: 20),
            title: Text(item.l, style: const TextStyle(color: AppColors.gray400, fontSize: 12, fontWeight: FontWeight.w500)),
            subtitle: Text(item.v, style: const TextStyle(color: AppColors.gray900, fontSize: 15, fontWeight: FontWeight.w600))),
        if (!isLast) const Divider(height: 1, indent: 56),
      ]);
    }).toList()),
  );
}
