import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/workflow_api.dart';
import '../../core/models/models.dart';
import '../../core/providers/theme_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});
  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _ctrl = TextEditingController();
  List<Vehicle>  _results  = [];
  Vehicle?       _selected;
  List<OperationHistory> _history = [];
  bool           _loading  = false;
  bool           _searching= false;
  String?        _error;

  Future<void> _search() async {
    final q = _ctrl.text.trim();
    if (q.length < 3) { setState(() => _error = 'Enter at least 3 characters'); return; }
    setState(() { _loading = true; _error = null; _selected = null; _results = []; _history = []; });
    try {
      final res = await ref.read(workflowApiProvider).search(q);
      setState(() {
        _results = res;
        if (res.length == 1) _selectVehicle(res.first);
      });
    } catch (e) {
      setState(() => _error = 'Search failed: ${e.toString().split(':').last.trim()}');
    } finally { setState(() { _loading = false; _searching = false; }); }
  }

  Future<void> _selectVehicle(Vehicle v) async {
    setState(() { _selected = v; _history = []; _searching = true; });
    try {
      final h = await ref.read(workflowApiProvider).getVehicleHistory(v.vehicleId);
      if (mounted) setState(() => _history = h);
    } catch (_) {}
    if (mounted) setState(() => _searching = false);
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return Scaffold(
      backgroundColor: c.bg,
      appBar: AppBar(
        backgroundColor: c.bg,
        leading: IconButton(icon: Icon(Icons.arrow_back_rounded, color: c.textSecond),
            onPressed: () => Navigator.of(context).maybePop()),
        title: Text('Chassis Search', style: TextStyle(color: c.textPrimary)),
      ),
      body: SafeArea(child: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: ChassisInput(controller: _ctrl, onSearch: _search, loading: _loading,
              hintText: 'Enter chassis number or last 4 digits…')),
        if (_error != null)
          Padding(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: ErrorBanner(_error!)),
        Expanded(child: _buildBody(c)),
      ])),
    );
  }

  Widget _buildBody(AppColors c) {
    if (_loading) return Center(child: CircularProgressIndicator(
      color: AppBrand.gold, strokeWidth: 2));

    if (_results.length > 1 && _selected == null) {
      return ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: _results.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) {
          final v = _results[i];
          return GestureDetector(
            onTap: () => _selectVehicle(v),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: c.surface0,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: c.border)),
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(v.chassisNumber, style: TextStyle(fontFamily: 'monospace',
                    fontWeight: FontWeight.w900, fontSize: 15, color: c.gold, letterSpacing: 1)),
                  if (v.vehicleTitle.isNotEmpty)
                    Text(v.vehicleTitle, style: TextStyle(color: c.textSecond, fontSize: 12)),
                  if (v.vesselName != null)
                    Text(v.vesselName!, style: TextStyle(color: c.textMuted, fontSize: 11)),
                ])),
                StatusBadge(v.workflowStatus),
              ]),
            ),
          );
        },
      );
    }

    if (_selected != null) {
      return SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (_results.length > 1)
            GestureDetector(
              onTap: () => setState(() => _selected = null),
              child: Row(children: [
                Icon(Icons.arrow_back_rounded, color: c.gold, size: 16),
                const SizedBox(width: 6),
                Text('Back to results', style: TextStyle(
                  color: c.gold, fontSize: 13, fontWeight: FontWeight.w700)),
              ]),
            ),
          const SizedBox(height: 12),
          VehicleCard(vehicle: _selected!),
          const SizedBox(height: 20),
          const SectionLabel('Operation History'),
          if (_searching)
            Center(child: Padding(padding: const EdgeInsets.all(24),
              child: CircularProgressIndicator(color: AppBrand.gold, strokeWidth: 2))),
          if (_history.isEmpty && !_searching)
            Container(margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: c.surface0, borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: c.border)),
              child: Center(child: Text('No operations recorded yet.',
                  style: TextStyle(color: c.textMuted, fontSize: 13)))),
          ..._history.map((h) => _HistoryItem(h, c)),
          const SizedBox(height: 16),
        ]),
      );
    }

    return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Container(width: 72, height: 72,
        decoration: BoxDecoration(color: c.surface1, shape: BoxShape.circle,
            border: Border.all(color: c.border)),
        child: Icon(Icons.search_rounded, size: 32, color: c.textMuted)),
      const SizedBox(height: 16),
      Text('Search for a vehicle', style: TextStyle(
        color: c.textSecond, fontSize: 16, fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      Text('Enter chassis number above', style: TextStyle(color: c.textMuted, fontSize: 13)),
    ]));
  }
}

class _HistoryItem extends StatelessWidget {
  final OperationHistory h; final AppColors c;
  const _HistoryItem(this.h, this.c);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 10),
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: c.surface0, borderRadius: BorderRadius.circular(14),
          border: Border.all(color: c.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(h.operationType.replaceAll('_', ' ').toUpperCase(),
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11,
              color: c.textPrimary, letterSpacing: 0.8))),
          if (h.toStatus != null) StatusBadge(h.toStatus!),
        ]),
        if (h.fromLocation != null || h.toLocation != null) ...[
          const SizedBox(height: 6),
          Text([h.fromLocation, h.toLocation].where((e) => e != null)
              .map((e) => e!.replaceAll('_', ' ')).join(' → '),
            style: TextStyle(color: c.textSecond, fontSize: 12)),
        ],
        const SizedBox(height: 6),
        Text('${h.operatorName ?? 'System'} · ${h.performedAt.split('T').first}',
          style: TextStyle(color: c.textMuted, fontSize: 11)),
      ]),
    ),
  );
}
