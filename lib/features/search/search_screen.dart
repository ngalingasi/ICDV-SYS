import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/workflow_api.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});
  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _ctrl     = TextEditingController();
  List<Vehicle>   _results = [];
  Vehicle?        _selected;
  List<OperationHistory> _history = [];
  bool            _loading = false;
  bool            _searching= false;
  String?         _error;

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
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Chassis Search')),
    body: SafeArea(child: Column(children: [
      // Search bar always visible at top
      Padding(
        padding: const EdgeInsets.all(16),
        child: ChassisInput(controller: _ctrl, onSearch: _search, loading: _loading,
            hintText: 'Enter chassis number or last 4 digits…'),
      ),
      if (_error != null)
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16),
            child: ErrorBanner(_error!)),

      // Results
      Expanded(child: _buildBody()),
    ])),
  );

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());

    // Multiple results list
    if (_results.length > 1 && _selected == null) {
      return ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _results.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) {
          final v = _results[i];
          return GestureDetector(
            onTap: () => _selectVehicle(v),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: AppColors.white, borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.gray200)),
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(v.chassisNumber, style: const TextStyle(fontFamily: 'monospace',
                      fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.gray900)),
                  if (v.vehicleTitle.isNotEmpty)
                    Text(v.vehicleTitle, style: const TextStyle(color: AppColors.gray500, fontSize: 12)),
                  if (v.vesselName != null)
                    Text(v.vesselName!, style: const TextStyle(color: AppColors.gray400, fontSize: 11)),
                ])),
                StatusBadge(v.workflowStatus),
              ]),
            ),
          );
        },
      );
    }

    // Single vehicle detail
    if (_selected != null) {
      return SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (_results.length > 1)
            TextButton.icon(icon: const Icon(Icons.arrow_back, size: 16),
                label: const Text('Back to results'),
                onPressed: () => setState(() => _selected = null)),
          VehicleCard(vehicle: _selected!),
          const SizedBox(height: 20),
          const SectionLabel('Operation History'),
          if (_searching)
            const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator())),
          if (_history.isEmpty && !_searching)
            const Text('No operations recorded yet.',
                style: TextStyle(color: AppColors.gray400, fontSize: 13)),
          ..._history.map((h) => _HistoryItem(h)),
          const SizedBox(height: 16),
        ]),
      );
    }

    if (_results.isEmpty && !_loading) {
      return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(Icons.search, size: 64, color: AppColors.gray200),
        const SizedBox(height: 12),
        const Text('Search for a vehicle', style: TextStyle(color: AppColors.gray400, fontSize: 15)),
        const SizedBox(height: 4),
        const Text('Enter chassis number above', style: TextStyle(color: AppColors.gray300, fontSize: 13)),
      ]));
    }
    return const SizedBox.shrink();
  }
}

class _HistoryItem extends StatelessWidget {
  final OperationHistory h;
  const _HistoryItem(this.h);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.white, borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.gray200)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(h.operationType.replaceAll('_', ' ').toUpperCase(),
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.gray800))),
            if (h.toStatus != null) StatusBadge(h.toStatus!),
          ]),
          if (h.fromLocation != null || h.toLocation != null) ...[
            const SizedBox(height: 4),
            Text(
              [h.fromLocation, h.toLocation].where((e) => e != null).map((e) => e!.replaceAll('_', ' ')).join(' → '),
              style: const TextStyle(color: AppColors.gray500, fontSize: 12),
            ),
          ],
          const SizedBox(height: 6),
          Text('${h.operatorName ?? 'System'} · ${h.performedAt.split('T').first}',
              style: const TextStyle(color: AppColors.gray400, fontSize: 11)),
        ]),
      ),
    );
  }
}
