import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/theme_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';

// ── Dashboard data model ──────────────────────────────────────────────────────
class DashboardStats {
  final int totalVessels, totalManifests, totalVehicles,
            manifestedCount, dischargedCount, batchedCount,
            inTransitCount, receivedCount,
            openBatches, releasedVehicles, unreleasedVehicles;
  const DashboardStats({
    this.totalVessels = 0, this.totalManifests = 0, this.totalVehicles = 0,
    this.manifestedCount = 0, this.dischargedCount = 0, this.batchedCount = 0,
    this.inTransitCount = 0, this.receivedCount = 0,
    this.openBatches = 0, this.releasedVehicles = 0, this.unreleasedVehicles = 0,
  });
  factory DashboardStats.fromJson(Map<String, dynamic> j) {
    final s = j['stats'] as Map<String, dynamic>? ?? j;
    return DashboardStats(
      totalVessels:      _i(s['total_vessels']),
      totalManifests:    _i(s['total_manifests']),
      totalVehicles:     _i(s['total_vehicles']),
      manifestedCount:   _i(s['manifested_count']),
      dischargedCount:   _i(s['discharged_count']),
      batchedCount:      _i(s['batched_count']),
      inTransitCount:    _i(s['in_transit_count']),
      receivedCount:     _i(s['received_count']),
      openBatches:       _i(s['open_batches']),
      releasedVehicles:  _i(s['released_vehicles']),
      unreleasedVehicles:_i(s['unreleased_vehicles']),
    );
  }
  static int _i(dynamic v) => (v as num?)?.toInt() ?? 0;
}

class RecentVessel {
  final int vesselId;
  final String name, status;
  final String? type, country, arrivalDate;
  final int manifestCount, vehicleCount;
  const RecentVessel({required this.vesselId, required this.name,
      required this.status, this.type, this.country, this.arrivalDate,
      this.manifestCount = 0, this.vehicleCount = 0});
  factory RecentVessel.fromJson(Map<String, dynamic> j) => RecentVessel(
    vesselId:      j['vessel_id'] as int,
    name:          j['name'] as String,
    status:        j['status'] as String? ?? 'unknown',
    type:          j['vessel_type'] as String?,
    country:       j['country_of_origin'] as String?,
    arrivalDate:   j['latest_arrival_date'] as String?,
    manifestCount: (j['manifest_count'] as num?)?.toInt() ?? 0,
    vehicleCount:  (j['vehicle_count'] as num?)?.toInt() ?? 0,
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────
final dashboardProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final dio = ref.read(dioProvider);
  final res = await dio.getJson('/dashboard');
  return res;
});

// ── Workflow steps config ─────────────────────────────────────────────────────
class _WStep {
  final String key, label, route;
  final Color color, bg, dot;
  const _WStep(this.key, this.label, this.route, this.color, this.bg, this.dot);
}

const _wSteps = [
  _WStep('manifested_count', 'Manifested', '/search',
    Color(0xFF6AAEF5), Color(0xFFCFDEF7), Color(0xFF6AAEF5)),
  _WStep('discharged_count', 'Discharged', '/discharge',
    Color(0xFF0D4E9E), Color(0xFFADC6F0), Color(0xFF0D4E9E)),
  _WStep('batched_count',    'Batched',    '/batch',
    AppBrand.violet,  Color(0xFFE2D4F7), AppBrand.violet),
  _WStep('in_transit_count', 'In Transit', '/transfer',
    AppBrand.orange,  Color(0xFFFDE8CC), AppBrand.orange),
  _WStep('received_count',   'Received',   '/receive',
    AppBrand.success, Color(0xFFCCF0DC), AppBrand.success),
];

// ── Screen ────────────────────────────────────────────────────────────────────
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = isDarkMode(context);
    final c    = AppColors(dark);
    final user = ref.watch(authProvider).user;
    final firstName = user?.fullName.split(' ').first ?? 'Operator';
    final initial   = user?.fullName.isNotEmpty == true ? user!.fullName[0].toUpperCase() : 'U';
    final dash = ref.watch(dashboardProvider);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: c.bg,
        body: RefreshIndicator(
          color: c.accent,
          backgroundColor: c.surface0,
          onRefresh: () => ref.refresh(dashboardProvider.future),
          child: CustomScrollView(slivers: [

            // ── App bar ────────────────────────────────────────────────
            SliverToBoxAdapter(child: _DashHeader(
              dark: dark, c: c,
              firstName: firstName, initial: initial,
              icdvName: user?.icdvName,
              onProfile: () => context.push('/profile'),
              onSearch: () => context.push('/search'),
            )),

            // ── Body ───────────────────────────────────────────────────
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
              sliver: dash.when(
                loading: () => SliverToBoxAdapter(child: _Shimmer(c: c)),
                error:   (e, _) => SliverToBoxAdapter(child: Padding(
                  padding: const EdgeInsets.only(top: 32),
                  child: ErrorBanner(e.toString()))),
                data: (data) {
                  final stats   = DashboardStats.fromJson(data);
                  final vessels = (data['recent_vessels'] as List? ?? [])
                      .map((v) => RecentVessel.fromJson(v as Map<String, dynamic>))
                      .toList();
                  return SliverList(delegate: SliverChildListDelegate([
                    _OverviewGrid(stats: stats, c: c, dark: dark),
                    const SizedBox(height: 20),
                    _WorkflowFunnel(stats: stats, c: c, dark: dark),
                    const SizedBox(height: 20),
                    _OperationsGrid(c: c, dark: dark),
                    const SizedBox(height: 20),
                    _RecentVessels(vessels: vessels, c: c, dark: dark),
                  ]));
                },
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

// ── Dashboard header ──────────────────────────────────────────────────────────
class _DashHeader extends StatelessWidget {
  final bool dark; final AppColors c;
  final String firstName, initial;
  final String? icdvName;
  final VoidCallback onProfile, onSearch;
  const _DashHeader({required this.dark, required this.c, required this.firstName,
      required this.initial, this.icdvName, required this.onProfile, required this.onSearch});

  @override
  Widget build(BuildContext context) {
    final ref = context as Element;
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: dark
              ? [const Color(0xFFCFDEF7).withOpacity(0.22), const Color(0xFFADC6F0).withOpacity(0.10)]
              : [const Color(0xFFCFDEF7), const Color(0xFFE8F1FC)],
          begin: Alignment.topLeft, end: Alignment.bottomRight),
        border: dark ? Border(bottom: BorderSide(color: const Color(0xFF6AAEF5).withOpacity(0.25))) : null,
      ),
      child: SafeArea(bottom: false, child: Stack(children: [
        Positioned(right: -20, top: -10,
          child: Icon(Icons.bar_chart_rounded, size: 140,
            color: const Color(0xFF6AAEF5).withOpacity(dark ? 0.12 : 0.10))),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 16, 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // Top row
            Row(children: [
              // Logo chip
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: dark ? Colors.white.withOpacity(0.12) : Colors.white.withOpacity(0.7),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: dark
                      ? Colors.white.withOpacity(0.2)
                      : AppColors.navy.withOpacity(0.15)),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  ClipOval(child: Image.asset('assets/images/logo.png',
                    width: 20, height: 20, fit: BoxFit.cover)),
                  const SizedBox(width: 7),
                  Text('TPFCS', style: TextStyle(
                    color: dark ? Colors.white : AppColors.navy,
                    fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.5)),
                ]),
              ),
              const Spacer(),
              // Search icon
              GestureDetector(
                onTap: onSearch,
                child: Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: dark ? Colors.white.withOpacity(0.12) : Colors.white.withOpacity(0.6),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: dark
                        ? Colors.white.withOpacity(0.2)
                        : AppColors.navy.withOpacity(0.15)),
                  ),
                  child: Icon(Icons.search_rounded,
                    color: dark ? Colors.white : AppColors.navy, size: 18)),
              ),
              const SizedBox(width: 8),
              // Avatar
              GestureDetector(
                onTap: onProfile,
                child: Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: dark ? Colors.white.withOpacity(0.12) : Colors.white.withOpacity(0.7),
                    border: Border.all(color: dark
                        ? Colors.white.withOpacity(0.3)
                        : AppColors.navy.withOpacity(0.3), width: 1.5),
                  ),
                  child: Center(child: Text(initial, style: TextStyle(
                    color: dark ? Colors.white : AppColors.navy,
                    fontWeight: FontWeight.w900, fontSize: 15)))),
              ),
            ]),
            const SizedBox(height: 18),
            Text('Hello, $firstName', style: TextStyle(
              color: dark ? Colors.white.withOpacity(0.7) : AppColors.navy.withOpacity(0.65),
              fontSize: 13)),
            const SizedBox(height: 2),
            Text('Dashboard', style: TextStyle(
              color: dark ? Colors.white : AppColors.navy,
              fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: -0.5)),
            if (icdvName != null) ...[
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: dark ? Colors.white.withOpacity(0.12) : Colors.white.withOpacity(0.6),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: dark
                      ? Colors.white.withOpacity(0.2)
                      : AppColors.navy.withOpacity(0.2)),
                ),
                child: Text(icdvName!, style: TextStyle(
                  color: dark ? Colors.white : AppColors.navy,
                  fontSize: 11, fontWeight: FontWeight.w700))),
            ],
          ]),
        ),
      ])),
    );
  }
}

// ── Overview stat grid ────────────────────────────────────────────────────────
class _OverviewGrid extends StatelessWidget {
  final DashboardStats stats; final AppColors c; final bool dark;
  const _OverviewGrid({required this.stats, required this.c, required this.dark});

  @override
  Widget build(BuildContext context) {
    final items = [
      _StatItem('Total Vessels',   stats.totalVessels,       Icons.directions_boat_rounded, const Color(0xFF0D4E9E), const Color(0xFFCFDEF7)),
      _StatItem('Manifests',       stats.totalManifests,     Icons.description_outlined,    AppBrand.violet,          const Color(0xFFE2D4F7)),
      _StatItem('Total Vehicles',  stats.totalVehicles,      Icons.directions_car_rounded,  AppColors.navy,           const Color(0xFFCFDEF7)),
      _StatItem('Released',        stats.releasedVehicles,   Icons.check_circle_outline,    AppBrand.success,         const Color(0xFFCCF0DC)),
      _StatItem('Open Batches',    stats.openBatches,        Icons.layers_rounded,           AppBrand.violet,          const Color(0xFFE2D4F7)),
      _StatItem('In Transit',      stats.inTransitCount,     Icons.local_shipping_rounded,  AppBrand.orange,          const Color(0xFFFDE8CC)),
      _StatItem('Yard Received',   stats.receivedCount,      Icons.warehouse_rounded,       AppBrand.success,         const Color(0xFFCCF0DC)),
      _StatItem('Unreleased',      stats.unreleasedVehicles, Icons.lock_outline_rounded,    AppBrand.danger,          const Color(0xFFFFE0E8)),
    ];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SizedBox(height: 20),
      _SectionHeader('Overview', c),
      const SizedBox(height: 12),
      GridView.builder(
        shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2, crossAxisSpacing: 12,
          mainAxisSpacing: 12, childAspectRatio: 1.55),
        itemCount: items.length,
        itemBuilder: (_, i) => _StatCard(item: items[i], c: c, dark: dark),
      ),
    ]);
  }
}

class _StatItem {
  final String label; final int value; final IconData icon;
  final Color color, gradColor;
  const _StatItem(this.label, this.value, this.icon, this.color, this.gradColor);
}

class _StatCard extends StatelessWidget {
  final _StatItem item; final AppColors c; final bool dark;
  const _StatCard({required this.item, required this.c, required this.dark});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: c.surface0,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: c.border),
    ),
    child: Row(children: [
      Container(width: 38, height: 38,
        decoration: BoxDecoration(
          color: dark ? item.color.withOpacity(0.2) : item.gradColor,
          borderRadius: BorderRadius.circular(10)),
        child: Icon(item.icon, color: item.color, size: 18)),
      const SizedBox(width: 10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center, children: [
        Text('${item.value}', style: TextStyle(
          color: item.color, fontSize: 20,
          fontWeight: FontWeight.w900)),
        Text(item.label, style: TextStyle(
          color: c.textMuted, fontSize: 10,
          fontWeight: FontWeight.w600, letterSpacing: 0.3),
          maxLines: 1, overflow: TextOverflow.ellipsis),
      ])),
    ]),
  );
}

// ── Workflow funnel ───────────────────────────────────────────────────────────
class _WorkflowFunnel extends StatelessWidget {
  final DashboardStats stats; final AppColors c; final bool dark;
  const _WorkflowFunnel({required this.stats, required this.c, required this.dark});

  int _val(DashboardStats s, String key) => switch (key) {
    'manifested_count' => s.manifestedCount,
    'discharged_count' => s.dischargedCount,
    'batched_count'    => s.batchedCount,
    'in_transit_count' => s.inTransitCount,
    'received_count'   => s.receivedCount,
    _ => 0,
  };

  @override
  Widget build(BuildContext context) {
    final total = stats.totalVehicles > 0 ? stats.totalVehicles : 1;
    return Container(
      decoration: BoxDecoration(color: c.surface0,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: c.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
          child: Row(children: [
            Text('Operations Flow', style: TextStyle(
              color: c.textPrimary, fontSize: 14, fontWeight: FontWeight.w800)),
            const Spacer(),
            GestureDetector(
              onTap: () => context.push('/search'),
              child: Text('Search chassis', style: TextStyle(
                color: c.accent, fontSize: 12, fontWeight: FontWeight.w600))),
          ]),
        ),

        // Step chips
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(children: _wSteps.asMap().entries.map((e) {
            final step = e.value; final i = e.key;
            final val  = _val(stats, step.key);
            final isLast = i == _wSteps.length - 1;
            return Expanded(child: Row(children: [
              Expanded(child: _StepChip(step: step, val: val, dark: dark)),
              if (!isLast) Icon(Icons.chevron_right_rounded,
                color: c.textMuted, size: 14),
            ]));
          }).toList()),
        ),

        const SizedBox(height: 16),
        // Progress bars
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(children: _wSteps.map((step) {
            final val  = _val(stats, step.key);
            final pct  = val / total;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(children: [
                SizedBox(width: 72, child: Text(step.label, style: TextStyle(
                  color: c.textMuted, fontSize: 10,
                  fontWeight: FontWeight.w600))),
                Expanded(child: Stack(children: [
                  Container(height: 8,
                    decoration: BoxDecoration(
                      color: c.surface1, borderRadius: BorderRadius.circular(4))),
                  FractionallySizedBox(widthFactor: pct.clamp(0, 1),
                    child: Container(height: 8,
                      decoration: BoxDecoration(
                        color: step.dot,
                        borderRadius: BorderRadius.circular(4),
                        boxShadow: [BoxShadow(color: step.dot.withOpacity(0.4), blurRadius: 4)]))),
                ])),
                const SizedBox(width: 8),
                SizedBox(width: 28, child: Text('$val', textAlign: TextAlign.right,
                  style: TextStyle(color: c.textSecond, fontSize: 11, fontWeight: FontWeight.w700))),
              ]),
            );
          }).toList()),
        ),
      ]),
    );
  }
}

class _StepChip extends StatelessWidget {
  final _WStep step; final int val; final bool dark;
  const _StepChip({required this.step, required this.val, required this.dark});
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: () => context.push(step.route),
    child: Container(
      margin: const EdgeInsets.symmetric(horizontal: 2),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      decoration: BoxDecoration(
        color: dark ? step.dot.withOpacity(0.15) : step.bg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: step.dot.withOpacity(0.3))),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text('$val', style: TextStyle(
          color: step.color, fontSize: 17,
          fontWeight: FontWeight.w900)),
        const SizedBox(height: 2),
        Text(step.label, style: const TextStyle(
          color: Color(0xFF8A96B8), fontSize: 8,
          fontWeight: FontWeight.w600),
          textAlign: TextAlign.center, maxLines: 1,
          overflow: TextOverflow.ellipsis),
      ]),
    ),
  );
}

// ── Operations quick-access grid ──────────────────────────────────────────────
class _OperationsGrid extends StatelessWidget {
  final AppColors c; final bool dark;
  const _OperationsGrid({required this.c, required this.dark});

  static final _ops = [
    _OpItem('Discharge',    Icons.anchor_rounded,        '/discharge',
        const Color(0xFFCFDEF7), const Color(0xFFADC6F0), const Color(0xFF6AAEF5), const Color(0xFF0D4E9E)),
    _OpItem('Batch',        Icons.layers_rounded,         '/batch',
        const Color(0xFFE2D4F7), const Color(0xFFCBB8F0), const Color(0xFFB28CF5), AppBrand.violet),
    _OpItem('TPA Transfer', Icons.local_shipping_rounded, '/transfer',
        const Color(0xFFFDE8CC), const Color(0xFFF9D0A0), const Color(0xFFF5A652), AppBrand.orange),
    _OpItem('Yard Receive', Icons.warehouse_rounded,      '/receive',
        const Color(0xFFCCF0DC), const Color(0xFFA0E0BC), const Color(0xFF4DC98A), AppBrand.success),
  ];

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start, children: [
    _SectionHeader('Operations', c),
    const SizedBox(height: 12),
    GridView.builder(
      shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2, crossAxisSpacing: 12,
        mainAxisSpacing: 12, childAspectRatio: 1.45),
      itemCount: _ops.length,
      itemBuilder: (_, i) => _OpTile(op: _ops[i], dark: dark),
    ),
  ]);
}

class _OpItem {
  final String label, route;
  final IconData icon;
  final Color gradStart, gradEnd, symbol, accent;
  const _OpItem(this.label, this.icon, this.route,
      this.gradStart, this.gradEnd, this.symbol, this.accent);
}

class _OpTile extends StatelessWidget {
  final _OpItem op; final bool dark;
  const _OpTile({required this.op, required this.dark});
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: () => context.push(op.route),
    child: Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: dark
              ? [op.gradStart.withOpacity(0.35), op.gradEnd.withOpacity(0.20)]
              : [op.gradStart, op.gradEnd],
          begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(20),
        border: dark ? Border.all(color: op.symbol.withOpacity(0.35), width: 1.5) : null,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(children: [
          Positioned(right: -12, bottom: -12,
            child: Icon(op.icon, size: 70,
              color: op.symbol.withOpacity(dark ? 0.25 : 0.18))),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(width: 34, height: 34,
                decoration: BoxDecoration(
                  color: dark ? op.symbol.withOpacity(0.25) : Colors.white.withOpacity(0.55),
                  borderRadius: BorderRadius.circular(9),
                  border: Border.all(color: dark
                      ? op.symbol.withOpacity(0.4)
                      : AppColors.navy.withOpacity(0.12)),
                ),
                child: Icon(op.icon, color: dark ? op.symbol : op.accent, size: 17)),
              const Spacer(),
              Text(op.label, style: TextStyle(
                color: dark ? Colors.white : AppColors.navy,
                fontSize: 13, fontWeight: FontWeight.w800, height: 1.2)),
              const SizedBox(height: 3),
              Row(children: [
                Text('Start', style: TextStyle(
                  color: dark ? op.symbol : op.accent,
                  fontSize: 10, fontWeight: FontWeight.w700)),
                const SizedBox(width: 2),
                Icon(Icons.arrow_forward_rounded,
                  color: dark ? op.symbol : op.accent, size: 10),
              ]),
            ]),
          ),
        ]),
      ),
    ),
  );
}

// ── Recent vessels ────────────────────────────────────────────────────────────
class _RecentVessels extends StatelessWidget {
  final List<RecentVessel> vessels; final AppColors c; final bool dark;
  const _RecentVessels({required this.vessels, required this.c, required this.dark});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start, children: [
    _SectionHeader('Recent Vessels', c),
    const SizedBox(height: 12),
    Container(
      decoration: BoxDecoration(color: c.surface0,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: c.border)),
      child: vessels.isEmpty
          ? Padding(
              padding: const EdgeInsets.all(32),
              child: Center(child: Text('No vessels yet',
                style: TextStyle(color: c.textMuted, fontSize: 13))))
          : Column(children: vessels.asMap().entries.map((e) {
              final v = e.value;
              final isLast = e.key == vessels.length - 1;
              return Column(children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(children: [
                    Container(width: 42, height: 42,
                      decoration: BoxDecoration(
                        color: dark ? const Color(0xFF0D4E9E).withOpacity(0.2) : const Color(0xFFCFDEF7),
                        borderRadius: BorderRadius.circular(12)),
                      child: Icon(Icons.directions_boat_rounded,
                        color: dark ? const Color(0xFF6AAEF5) : const Color(0xFF0D4E9E), size: 22)),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(v.name, style: TextStyle(
                        color: c.textPrimary, fontWeight: FontWeight.w700, fontSize: 14)),
                      const SizedBox(height: 2),
                      Text([
                        if (v.type != null) v.type!,
                        if (v.country != null) v.country!,
                        '${v.manifestCount} manifests',
                        '${v.vehicleCount} vehicles',
                      ].join(' · '), style: TextStyle(color: c.textMuted, fontSize: 11)),
                    ])),
                    _VesselStatusBadge(v.status),
                  ]),
                ),
                if (!isLast) Divider(height: 1, indent: 70, color: c.border),
              ]);
            }).toList()),
    ),
  ]);
}

class _VesselStatusBadge extends StatelessWidget {
  final String status;
  const _VesselStatusBadge(this.status);
  @override
  Widget build(BuildContext context) {
    final Color color = switch (status.toLowerCase()) {
      'active'         => AppBrand.success,
      'inactive'       => AppBrand.warning,
      'decommissioned' => const Color(0xFF8A96B8),
      _ => const Color(0xFF8A96B8),
    };
    final Color bg = switch (status.toLowerCase()) {
      'active'         => AppBrand.successDim,
      'inactive'       => AppBrand.warningDim,
      _ => const Color(0xFFE4E8F5),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6),
          border: Border.all(color: color.withOpacity(0.35))),
      child: Text(status.toUpperCase(), style: TextStyle(
        color: color, fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.8)));
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  final String title; final AppColors c;
  const _SectionHeader(this.title, this.c);
  @override
  Widget build(BuildContext context) => Row(children: [
    Container(width: 3, height: 16,
      decoration: BoxDecoration(color: c.accent, borderRadius: BorderRadius.circular(2))),
    const SizedBox(width: 8),
    Text(title, style: TextStyle(
      color: c.textPrimary, fontSize: 15, fontWeight: FontWeight.w800)),
  ]);
}

class _Shimmer extends StatelessWidget {
  final AppColors c;
  const _Shimmer({required this.c});
  @override
  Widget build(BuildContext context) => Column(children: [
    const SizedBox(height: 20),
    ...List.generate(6, (i) => Container(
      margin: const EdgeInsets.only(bottom: 12), height: 60,
      decoration: BoxDecoration(color: c.surface1, borderRadius: BorderRadius.circular(12)))),
  ]);
}

// ── Shell with bottom nav ─────────────────────────────────────────────────────
// Wraps dashboard to provide bottom navigation between Dashboard / Operations / Profile
class AppShell extends ConsumerStatefulWidget {
  final Widget child;
  const AppShell({super.key, required this.child});
  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  int _index = 0;

  void _onTap(int i) {
    setState(() => _index = i);
    switch (i) {
      case 0: context.go('/dashboard'); break;
      case 1: context.go('/home');      break;
      case 2: context.go('/search');    break;
      case 3: context.go('/profile');   break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c    = AppColors(isDarkMode(context));
    final dark = isDarkMode(context);

    final path = GoRouterState.of(context).matchedLocation;
    final idx = path.startsWith('/home')    ? 1
              : path.startsWith('/search')  ? 2
              : path.startsWith('/profile') ? 3
              : 0;

    return Scaffold(
      body: widget.child,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: c.surface0,
          border: Border(top: BorderSide(color: c.border)),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(dark ? 0.4 : 0.08),
              blurRadius: 20, offset: const Offset(0, -4)),
          ],
        ),
        child: SafeArea(top: false, child: SizedBox(
          height: 62,
          child: Row(children: [
            _NavItem(icon: Icons.dashboard_rounded,      label: 'Dashboard',  index: 0, current: idx, c: c, onTap: _onTap),
            _NavItem(icon: Icons.swap_horiz_rounded,     label: 'Operations', index: 1, current: idx, c: c, onTap: _onTap),
            _NavItem(icon: Icons.manage_search_rounded,  label: 'Search',     index: 2, current: idx, c: c, onTap: _onTap),
            _NavItem(icon: Icons.account_circle_outlined,label: 'Profile',    index: 3, current: idx, c: c, onTap: _onTap),
          ]),
        )),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon; final String label;
  final int index, current; final AppColors c;
  final Function(int) onTap;
  const _NavItem({required this.icon, required this.label, required this.index,
      required this.current, required this.c, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final active = index == current;
    return Expanded(child: GestureDetector(
      onTap: () => onTap(index),
      behavior: HitTestBehavior.opaque,
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          decoration: BoxDecoration(
            color: active ? c.accentDim : Colors.transparent,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Icon(icon, size: 22,
            color: active ? c.accent : c.textMuted),
        ),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(
          color: active ? c.accent : c.textMuted,
          fontSize: 10, fontWeight: active ? FontWeight.w700 : FontWeight.w500)),
      ]),
    ));
  }
}
