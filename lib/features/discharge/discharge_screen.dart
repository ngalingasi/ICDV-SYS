import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/workflow_api.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';

enum _Step { search, confirm, done }

class DischargeScreen extends ConsumerStatefulWidget {
  const DischargeScreen({super.key});
  @override
  ConsumerState<DischargeScreen> createState() => _DischargeScreenState();
}

class _DischargeScreenState extends ConsumerState<DischargeScreen> {
  final _chassisCtrl = TextEditingController();
  final _notesCtrl   = TextEditingController();
  _Step    _step    = _Step.search;
  Vehicle? _vehicle;
  bool     _loading = false;
  String?  _error;

  void _reset() => setState(() { _step = _Step.search; _vehicle = null; _error = null; _chassisCtrl.clear(); _notesCtrl.clear(); });

  Future<void> _search() async {
    final q = _chassisCtrl.text.trim();
    if (q.length < 4) { setState(() => _error = 'Enter at least 4 digits'); return; }
    setState(() { _loading = true; _error = null; });
    try {
      final v = await ref.read(workflowApiProvider).dischargeLookup(q);
      setState(() { _vehicle = v; _step = _Step.confirm; });
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _confirm() async {
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(workflowApiProvider).dischargeConfirm(_vehicle!.vehicleId, notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim());
      setState(() => _step = _Step.done);
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  void dispose() { _chassisCtrl.dispose(); _notesCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Discharge'),
        centerTitle: false,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(50),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: StepIndicator(current: _step.index, total: 3, labels: const ['Search', 'Confirm', 'Done']),
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: _step == _Step.done ? _buildDone() : _buildForm(),
        ),
      ),
    );
  }

  Widget _buildForm() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    SectionLabel(_step == _Step.search ? 'Search Vehicle' : 'Confirm Vehicle'),
    if (_step == _Step.search) ...[
      ChassisInput(controller: _chassisCtrl, onSearch: _search, loading: _loading),
      const SizedBox(height: 8),
      const Text('Enter last 4+ digits of chassis number', style: TextStyle(color: AppColors.gray400, fontSize: 12)),
    ],
    if (_vehicle != null) ...[
      const SizedBox(height: 16),
      VehicleCard(vehicle: _vehicle!),
      const SizedBox(height: 16),
      // Warning
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: AppColors.amber50, borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.amber500.withValues(alpha: 0.3))),
        child: const Row(children: [
          Icon(Icons.warning_amber_rounded, color: AppColors.amber500, size: 20),
          SizedBox(width: 10),
          Expanded(child: Text('Confirm this is the correct vehicle before discharging.',
              style: TextStyle(color: AppColors.gray700, fontSize: 13))),
        ]),
      ),
      const SizedBox(height: 16),
      SectionLabel('Notes'),
      NotesField(controller: _notesCtrl),
    ],
    if (_error != null) ...[const SizedBox(height: 16), ErrorBanner(_error!)],
    const SizedBox(height: 24),
    if (_step == _Step.confirm) ...[
      ConfirmButton(
        label: 'Confirm Discharge → Holding Ground',
        onPressed: _confirm, loading: _loading,
        color: AppColors.orange500, icon: Icons.anchor,
      ),
      const SizedBox(height: 10),
      SizedBox(width: double.infinity, height: 48,
        child: OutlinedButton(onPressed: _reset, child: const Text('Cancel')),
      ),
    ],
  ]);

  Widget _buildDone() => SuccessSheet(
    title: 'Discharged!',
    subtitle: '${_vehicle!.chassisNumber} moved to Holding Ground',
    onNext: _reset,
    nextLabel: 'Discharge Another',
  );

  String _parseError(Object e) {
    final s = e.toString();
    if (s.contains('404')) return 'Vehicle not found';
    if (s.contains('409')) return 'Vehicle is not in MANIFESTED status';
    if (s.contains('SocketException')) return 'No connection to server';
    return 'Operation failed. Please try again.';
  }
}
