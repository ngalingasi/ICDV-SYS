import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/theme_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user    = ref.watch(authProvider).user;
    final initial = user?.fullName.isNotEmpty == true ? user!.fullName[0].toUpperCase() : 'U';
    final c       = AppColors(isDarkMode(context));
    final dark    = isDarkMode(context);
    final mode    = ref.watch(themeProvider);

    return Scaffold(
      backgroundColor: c.bg,
      appBar: AppBar(
        backgroundColor: c.bg,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: c.textSecond),
          onPressed: () => Navigator.of(context).maybePop()),
        title: Text('Profile', style: TextStyle(color: c.textPrimary)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
          const SizedBox(height: 12),

          // Avatar
          Stack(alignment: Alignment.center, children: [
            Container(width: 100, height: 100,
              decoration: BoxDecoration(shape: BoxShape.circle,
                gradient: RadialGradient(colors: [
                  c.accent.withOpacity(c.isDark ? 0.15 : 0.10), Colors.transparent]))),
            Container(width: 84, height: 84,
              decoration: BoxDecoration(shape: BoxShape.circle, color: c.surface1,
                border: Border.all(color: c.accent.withOpacity(0.5), width: 2),
                boxShadow: [BoxShadow(color: c.accent.withOpacity(0.2), blurRadius: 20)]),
              child: Center(child: Text(initial, style: TextStyle(
                color: c.accent, fontWeight: FontWeight.w900, fontSize: 36)))),
          ]),
          const SizedBox(height: 16),

          Text(user?.fullName ?? '—', style: TextStyle(
            fontSize: 22, fontWeight: FontWeight.w900, color: c.textPrimary, letterSpacing: -0.3)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(color: c.accentDim, borderRadius: BorderRadius.circular(8),
                border: Border.all(color: c.accent.withOpacity(0.3))),
            child: Text(user?.role.replaceAll('_', ' ').toUpperCase() ?? '—',
              style: TextStyle(color: c.accent, fontSize: 11,
                fontWeight: FontWeight.w800, letterSpacing: 1.5))),
          if (user?.icdvName != null) ...[
            const SizedBox(height: 8),
            Text(user!.icdvName!, style: TextStyle(color: c.textSecond, fontSize: 14)),
          ],
          const SizedBox(height: 32),

          // Info card
          _InfoCard(items: [
            _Item(Icons.person_outline_rounded, 'Username', user?.username ?? '—'),
            _Item(Icons.badge_outlined, 'Role', user?.role.replaceAll('_', ' ') ?? '—'),
            if (user?.icdvName != null)
              _Item(Icons.business_outlined, 'ICDV', user!.icdvName!),
          ]),
          const SizedBox(height: 16),

          // ── Theme toggle card ──────────────────────────────────────────
          Container(
            decoration: BoxDecoration(color: c.surface0,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: c.border)),
            child: Column(children: [
              _ThemeRow(mode: mode, onChanged: (m) => ref.read(themeProvider.notifier).setMode(m)),
            ]),
          ),
          const SizedBox(height: 16),

          // Logout
          SizedBox(width: double.infinity, height: 54,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.logout_rounded, size: 18),
              label: const Text('Sign Out', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppBrand.dangerDim, foregroundColor: AppBrand.danger,
                side: const BorderSide(color: AppBrand.danger, width: 1),
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              onPressed: () async {
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) context.go('/login');
              },
            )),
          const SizedBox(height: 28),
          Text('TPFCS Operations v1.0.0',
            style: TextStyle(color: c.textMuted, fontSize: 11)),
        ]),
      ),
    );
  }
}

class _ThemeRow extends StatelessWidget {
  final ThemeMode mode;
  final Function(ThemeMode) onChanged;
  const _ThemeRow({required this.mode, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 36, height: 36,
            decoration: BoxDecoration(color: c.accentDim, borderRadius: BorderRadius.circular(10)),
            child: Icon(Icons.palette_outlined, color: c.accent, size: 18)),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Appearance', style: TextStyle(
              color: c.textPrimary, fontWeight: FontWeight.w700, fontSize: 14)),
            Text('Choose your preferred theme', style: TextStyle(color: c.textMuted, fontSize: 12)),
          ])),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          _ThemeChip(label: 'System', icon: Icons.brightness_auto_rounded,
            selected: mode == ThemeMode.system,
            onTap: () => onChanged(ThemeMode.system)),
          const SizedBox(width: 8),
          _ThemeChip(label: 'Light', icon: Icons.light_mode_rounded,
            selected: mode == ThemeMode.light,
            onTap: () => onChanged(ThemeMode.light)),
          const SizedBox(width: 8),
          _ThemeChip(label: 'Dark', icon: Icons.dark_mode_rounded,
            selected: mode == ThemeMode.dark,
            onTap: () => onChanged(ThemeMode.dark)),
        ]),
      ]),
    );
  }
}

class _ThemeChip extends StatelessWidget {
  final String label; final IconData icon; final bool selected; final VoidCallback onTap;
  const _ThemeChip({required this.label, required this.icon, required this.selected, required this.onTap});
  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return Expanded(child: GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? c.accentDim : c.surface1,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? c.accent.withOpacity(0.6) : c.border,
            width: selected ? 1.5 : 1),
        ),
        child: Column(children: [
          Icon(icon, size: 18, color: selected ? c.accent : c.textMuted),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(
            fontSize: 11, fontWeight: FontWeight.w700,
            color: selected ? c.accent : c.textMuted)),
        ]),
      ),
    ));
  }
}

class _Item { final IconData icon; final String label, value;
  const _Item(this.icon, this.label, this.value); }

class _InfoCard extends StatelessWidget {
  final List<_Item> items;
  const _InfoCard({super.key, required this.items});
  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return Container(
      decoration: BoxDecoration(color: c.surface0,
          borderRadius: BorderRadius.circular(20), border: Border.all(color: c.border)),
      child: Column(children: items.asMap().entries.map((e) {
        final item = e.value; final isLast = e.key == items.length - 1;
        return Column(children: [
          Padding(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(children: [
              Container(width: 36, height: 36,
                decoration: BoxDecoration(color: c.accentDim, borderRadius: BorderRadius.circular(10)),
                child: Icon(item.icon, color: c.accent, size: 18)),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(item.label, style: TextStyle(
                  color: c.textMuted, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                const SizedBox(height: 2),
                Text(item.value, style: TextStyle(
                  color: c.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
              ])),
            ])),
          if (!isLast) Divider(height: 1, indent: 66, color: c.border),
        ]);
      }).toList()),
    );
  }
}
