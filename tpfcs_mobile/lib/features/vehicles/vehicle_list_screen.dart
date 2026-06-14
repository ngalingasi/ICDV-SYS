import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/workflow_api.dart';
import '../../core/api/workflow_api.dart' show extractApiError;
import '../../core/models/models.dart';
import '../../core/providers/theme_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';

/// Displays vehicles filtered by [workflowStatus], optionally scoped
/// to [manifestId]. Used from dashboard workflow step cards.
class VehicleListScreen extends ConsumerStatefulWidget {
  final String  workflowStatus;
  final int?    manifestId;
  final String? manifestNumber;

  const VehicleListScreen({
    super.key,
    required this.workflowStatus,
    this.manifestId,
    this.manifestNumber,
  });

  @override
  ConsumerState<VehicleListScreen> createState() => _VehicleListScreenState();
}

class _VehicleListScreenState extends ConsumerState<VehicleListScreen> {
  final List<Vehicle> _vehicles  = [];
  int  _page      = 1;
  int  _total     = 0;
  int  _totalPages = 1;
  bool _loading   = true;
  bool _loadingMore = false;
  String? _error;

  final _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _load();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200 &&
        !_loadingMore && _page < _totalPages) {
      _loadMore();
    }
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; _vehicles.clear(); _page = 1; });
    try {
      final res = await ref.read(workflowApiProvider).getVehicles(
        workflowStatus: widget.workflowStatus,
        manifestId:     widget.manifestId,
        page: 1, limit: 30,
      );
      final results = (res['results'] as List? ?? [])
          .map((e) => Vehicle.fromJson(e as Map<String, dynamic>)).toList();
      setState(() {
        _vehicles.addAll(results);
        _total      = (res['totalResults'] as num?)?.toInt() ?? results.length;
        _totalPages = (res['totalPages']   as num?)?.toInt() ?? 1;
        _loading    = false;
      });
    } catch (e) {
      setState(() { _error = extractApiError(e); _loading = false; });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _page >= _totalPages) return;
    setState(() { _loadingMore = true; _page++; });
    try {
      final res = await ref.read(workflowApiProvider).getVehicles(
        workflowStatus: widget.workflowStatus,
        manifestId:     widget.manifestId,
        page: _page, limit: 30,
      );
      final results = (res['results'] as List? ?? [])
          .map((e) => Vehicle.fromJson(e as Map<String, dynamic>)).toList();
      setState(() { _vehicles.addAll(results); _loadingMore = false; });
    } catch (_) {
      setState(() { _page--; _loadingMore = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c    = AppColors(isDarkMode(context));
    final dark = isDarkMode(context);

    // Header colour matching workflow status
    final headerColor = switch (widget.workflowStatus) {
      'manifested' => const Color(0xFF6AAEF5),
      'discharged' => const Color(0xFF0D4E9E),
      'batched'    => AppBrand.violet,
      'in_transit' => AppBrand.orange,
      'received'   => AppBrand.success,
      _            => c.accent,
    };
    final headerBg = switch (widget.workflowStatus) {
      'manifested' => const Color(0xFFCFDEF7),
      'discharged' => const Color(0xFFADC6F0),
      'batched'    => const Color(0xFFE2D4F7),
      'in_transit' => const Color(0xFFFDE8CC),
      'received'   => const Color(0xFFCCF0DC),
      _            => c.surface1,
    };

    final title = widget.workflowStatus.replaceAll('_', ' ').toUpperCase();

    return Scaffold(
      backgroundColor: c.bg,
      body: Column(children: [

        // ── Branded header ─────────────────────────────────────────────────────
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: dark
                ? [headerColor.withOpacity(0.30), headerColor.withOpacity(0.10)]
                : [headerBg, headerBg.withOpacity(0.6)],
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ),
            border: dark ? Border(
              bottom: BorderSide(color: headerColor.withOpacity(0.3))) : null,
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(4, 4, 16, 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                IconButton(
                  icon: Icon(Icons.arrow_back_rounded,
                    color: dark ? Colors.white.withOpacity(0.85) : AppColors.navy),
                  onPressed: () => context.pop(),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: headerColor.withOpacity(dark ? 0.25 : 0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: headerColor.withOpacity(0.4)),
                        ),
                        child: Text(title, style: TextStyle(
                          color: headerColor, fontSize: 10,
                          fontWeight: FontWeight.w800, letterSpacing: 1.5)),
                      ),
                      if (widget.manifestNumber != null) ...[
                        const SizedBox(width: 8),
                        Expanded(child: Text(
                          widget.manifestNumber!,
                          style: TextStyle(
                            color: dark ? Colors.white.withOpacity(0.5)
                                        : AppColors.navy.withOpacity(0.5),
                            fontSize: 11, fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis,
                        )),
                      ],
                    ]),
                    const SizedBox(height: 8),
                    Text(
                      _loading ? 'Loading…' : '$_total vehicle${_total == 1 ? "" : "s"}',
                      style: TextStyle(
                        color: dark ? Colors.white : AppColors.navy,
                        fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: -0.5),
                    ),
                  ]),
                ),
              ]),
            ),
          ),
        ),

        // ── Vehicle list ───────────────────────────────────────────────────────
        Expanded(child: _loading
          ? Center(child: CircularProgressIndicator(color: headerColor))
          : _error != null
            ? Center(child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  ErrorBanner(_error!),
                  const SizedBox(height: 16),
                  ElevatedButton(onPressed: _load, child: const Text('Retry')),
                ])))
            : _vehicles.isEmpty
              ? Center(child: Text('No $title vehicles',
                  style: TextStyle(color: c.textMuted, fontSize: 14)))
              : RefreshIndicator(
                  onRefresh: _load,
                  color: headerColor,
                  child: ListView.builder(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.all(16),
                    itemCount: _vehicles.length + (_loadingMore ? 1 : 0),
                    itemBuilder: (_, i) {
                      if (i == _vehicles.length) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          child: Center(child: CircularProgressIndicator(
                            color: headerColor, strokeWidth: 2.5)));
                      }
                      final v = _vehicles[i];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _VehicleRow(vehicle: v, accentColor: headerColor, c: c, dark: dark),
                      );
                    },
                  ),
                ),
        ),
      ]),
    );
  }
}

// ── Vehicle row card ──────────────────────────────────────────────────────────
class _VehicleRow extends StatelessWidget {
  final Vehicle   vehicle;
  final Color     accentColor;
  final AppColors c;
  final bool      dark;
  const _VehicleRow({required this.vehicle, required this.accentColor,
      required this.c, required this.dark});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: c.surface0,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: c.border),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(child: Text(
          vehicle.chassisNumber,
          style: TextStyle(
            fontFamily: 'monospace', fontSize: 15,
            fontWeight: FontWeight.w900, letterSpacing: 1.2,
            color: accentColor),
        )),
        StatusBadge(vehicle.workflowStatus),
      ]),
      if (vehicle.vehicleTitle.isNotEmpty) ...[
        const SizedBox(height: 4),
        Text(vehicle.vehicleTitle,
          style: TextStyle(color: c.textSecond, fontSize: 12, fontWeight: FontWeight.w600)),
      ],
      const SizedBox(height: 8),
      _detail(c, Icons.directions_boat_rounded, vehicle.vesselName ?? '—'),
      if (vehicle.manifestNumber != null)
        _detail(c, Icons.description_outlined, vehicle.manifestNumber!),
      if (vehicle.batchNumber != null)
        _detail(c, Icons.layers_rounded, vehicle.batchNumber!),
      if (vehicle.customerName != null)
        _detail(c, Icons.person_outline_rounded, vehicle.customerName!),
      _detail(c, Icons.location_on_outlined,
        vehicle.currentLocation.replaceAll('_', ' ')),
    ]),
  );

  Widget _detail(AppColors c, IconData icon, String text) => Padding(
    padding: const EdgeInsets.only(top: 3),
    child: Row(children: [
      Icon(icon, size: 12, color: c.textMuted),
      const SizedBox(width: 5),
      Expanded(child: Text(text,
        style: TextStyle(color: c.textSecond, fontSize: 11),
        overflow: TextOverflow.ellipsis)),
    ]),
  );
}
