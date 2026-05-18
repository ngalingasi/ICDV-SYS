import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/workflow_api.dart';
import '../../core/models/models.dart';
import '../../core/providers/theme_provider.dart';
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
    } catch (e) { setState(() => _error = _parseError(e)); }
    finally { setState(() => _loading = false); }
  }

  Future<void> _confirm() async {
    setState(() { _loading = true; _error = null; });
    try {
      final r = await ref.read(workflowApiProvider).batchConfirm(_vehicle!.vehicleId,
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim());
      setState(() { _result = r; _step = _Step.done; });
    } catch (e) { setState(() => _error = _parseError(e)); }
    finally { setState(() => _loading = false); }
  }

  @override
  void dispose() { _chassisCtrl.dispose(); _notesCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return Scaffold(
      backgroundColor: c.bg,
      appBar: AppBar(
        backgroundColor: c.bg,
        leading: IconButton(icon: Icon(Icons.arrow_back_rounded, color: c.textSecond),
            onPressed: () => Navigator.of(context).maybePop()),
        title: Text('Batch Process', style: TextStyle(color: c.textPrimary)),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: StepIndicator(current: _step.index, total: 3, labels: const ['Search', 'Confirm', 'Done']))),
      ),
      body: SafeArea(child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: _step == _Step.done ? _buildDone(c) : _buildForm(c),
      )),
    );
  }

  Widget _buildForm(AppColors c) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    const InfoBanner('System auto-assigns to the current open batch (max 20 vehicles).'),
    const SizedBox(height: 16),
    if (_step == _Step.search)
      ChassisInput(controller: _chassisCtrl, onSearch: _search, loading: _loading),
    if (_vehicle != null) ...[
      const SizedBox(height: 16),
      VehicleCard(vehicle: _vehicle!),
      const SizedBox(height: 14),
      const SectionLabel('Notes'),
      NotesField(controller: _notesCtrl),
    ],
    if (_error != null) ...[const SizedBox(height: 14), ErrorBanner(_error!)],
    const SizedBox(height: 24),
    if (_step == _Step.confirm) ...[
      ConfirmButton(label: 'Add to Batch', onPressed: _confirm, loading: _loading,
        color: AppBrand.violet, icon: Icons.layers_rounded),
      const SizedBox(height: 10),
      _OutlineBtn('Cancel', _reset),
    ],
  ]);

  Widget _buildDone(AppColors c) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    SuccessSheet(title: 'Added to Batch!',
      subtitle: '${_vehicle!.chassisNumber} assigned successfully',
      onNext: _reset, nextLabel: 'Batch Another Vehicle'),
    if (_result != null) ...[
      const SizedBox(height: 16),
      Container(
        width: double.infinity, padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: c.surface0, borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppBrand.violet.withOpacity(0.3))),
        child: Column(children: [
          Text('BATCH NUMBER', style: TextStyle(
            fontSize: 10, color: c.textMuted, fontWeight: FontWeight.w700, letterSpacing: 2)),
          const SizedBox(height: 8),
          Text(_result!['batch_number']?.toString() ?? '—', style: const TextStyle(
            fontFamily: 'monospace', fontSize: 22, fontWeight: FontWeight.w900,
            color: AppBrand.violet, letterSpacing: 2)),
        ]),
      ),
    ],
  ]);

  String _parseError(Object e) {
    final s = e.toString();
    if (s.contains('409')) return 'Vehicle is not DISCHARGED or already in a batch';
    if (s.contains('404')) return 'Vehicle not found';
    if (s.contains('SocketException')) return 'No connection to server';
    return 'Operation failed. Please try again.';
  }
}

class _OutlineBtn extends StatelessWidget {
  final String label; final VoidCallback onTap;
  const _OutlineBtn(this.label, this.onTap);
  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return SizedBox(width: double.infinity, height: 48,
      child: OutlinedButton(onPressed: onTap,
        style: OutlinedButton.styleFrom(foregroundColor: c.textSecond,
          side: BorderSide(color: c.border),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
        child: Text(label)));
  }
}
