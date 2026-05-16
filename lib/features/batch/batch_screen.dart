import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/workflow_api.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';

enum _Step { search, confirm, done }

class BatchScreen extends ConsumerStatefulWidget {
  const BatchScreen({super.key});
  @override
  ConsumerState<BatchScreen> createState() => _BatchScreenState();
}

class _BatchScreenState extends ConsumerState<BatchScreen> {
  final _chassisCtrl = TextEditingController();
  final _notesCtrl   = TextEditingController();
  _Step    _step    = _Step.search;
  Vehicle? _vehicle;
  Map<String, dynamic>? _result;
  bool     _loading = false;
  String?  _error;

  void _reset() => setState(() { _step = _Step.search; _vehicle = null; _result = null; _error = null; _chassisCtrl.clear(); _notesCtrl.clear(); });

  Future<void> _search() async {
    final q = _chassisCtrl.text.trim();
    if (q.length < 4) { setState(() => _error = 'Enter at least 4 digits'); return; }
    setState(() { _loading = true; _error = null; });
    try {
      final v = await ref.read(workflowApiProvider).batchLookup(q);
      setState(() { _vehicle = v; _step = _Step.confirm; });
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally { setState(() => _loading = false); }
  }

  Future<void> _confirm() async {
    setState(() { _loading = true; _error = null; });
    try {
      final r = await ref.read(workflowApiProvider).batchConfirm(_vehicle!.vehicleId, notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim());
      setState(() { _result = r; _step = _Step.done; });
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally { setState(() => _loading = false); }
  }

  @override
  void dispose() { _chassisCtrl.dispose(); _notesCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Batch Process'),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(50),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
          child: StepIndicator(current: _step.index, total: 3, labels: const ['Search', 'Confirm', 'Done']),
        ),
      ),
    ),
    body: SafeArea(child: SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: _step == _Step.done ? _buildDone() : _buildForm(),
    )),
  );

  Widget _buildForm() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    // Info notice
    Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(color: AppColors.brand50, borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.brand100)),
      child: const Text('System auto-assigns to the current open batch (max 20 vehicles per batch).',
          style: TextStyle(color: AppColors.brand700, fontSize: 12)),
    ),
    const SizedBox(height: 16),
    SectionLabel(_step == _Step.search ? 'Search Vehicle' : 'Confirm Batching'),
    if (_step == _Step.search)
      ChassisInput(controller: _chassisCtrl, onSearch: _search, loading: _loading),
    if (_vehicle != null) ...[
      const SizedBox(height: 16),
      VehicleCard(vehicle: _vehicle!),
      const SizedBox(height: 16),
      SectionLabel('Notes'),
      NotesField(controller: _notesCtrl),
    ],
    if (_error != null) ...[const SizedBox(height: 16), ErrorBanner(_error!)],
    const SizedBox(height: 24),
    if (_step == _Step.confirm) ...[
      ConfirmButton(label: 'Add to Batch', onPressed: _confirm, loading: _loading,
          icon: Icons.inventory_2),
      const SizedBox(height: 10),
      SizedBox(width: double.infinity, height: 48,
          child: OutlinedButton(onPressed: _reset, child: const Text('Cancel'))),
    ],
  ]);

  Widget _buildDone() => Column(children: [
    SuccessSheet(
      title: 'Added to Batch!',
      subtitle: '${_vehicle!.chassisNumber} assigned successfully',
      onNext: _reset,
      nextLabel: 'Batch Another Vehicle',
    ),
    if (_result != null) ...[
      const SizedBox(height: 16),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: AppColors.white, borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.gray200)),
        child: Column(children: [
          const Text('BATCH NUMBER', style: TextStyle(fontSize: 11, color: AppColors.gray400, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 6),
          Text(_result!['batch_number']?.toString() ?? '—',
              style: const TextStyle(fontFamily: 'monospace', fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.brand500)),
        ]),
      ),
    ],
  ]);

  String _parseError(Object e) {
    final s = e.toString();
    if (s.contains('409')) return 'Vehicle is not in DISCHARGED status or already in a batch';
    if (s.contains('404')) return 'Vehicle not found';
    if (s.contains('SocketException')) return 'No connection to server';
    return 'Operation failed. Please try again.';
  }
}
