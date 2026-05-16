import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/workflow_api.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';

enum _Step { lookup, confirm, done }

class ReceiveScreen extends ConsumerStatefulWidget {
  const ReceiveScreen({super.key});
  @override
  ConsumerState<ReceiveScreen> createState() => _ReceiveScreenState();
}

class _ReceiveScreenState extends ConsumerState<ReceiveScreen> {
  final _idCardCtrl = TextEditingController();
  final _notesCtrl  = TextEditingController();
  _Step          _step   = _Step.lookup;
  ReceiveLookup? _data;
  bool           _loading= false;
  String?        _error;

  void _reset() => setState(() { _step = _Step.lookup; _data = null; _error = null; _idCardCtrl.clear(); _notesCtrl.clear(); });

  Future<void> _lookup() async {
    final q = _idCardCtrl.text.trim();
    if (q.isEmpty) { setState(() => _error = 'Enter driver ID card number'); return; }
    setState(() { _loading = true; _error = null; });
    try {
      final d = await ref.read(workflowApiProvider).receiveLookup(q);
      setState(() { _data = d; _step = _Step.confirm; });
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally { setState(() => _loading = false); }
  }

  Future<void> _confirm() async {
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(workflowApiProvider).receiveConfirm(
        _data!.driver.driverId, _data!.vehicle.vehicleId,
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      );
      setState(() => _step = _Step.done);
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally { setState(() => _loading = false); }
  }

  @override
  void dispose() { _idCardCtrl.dispose(); _notesCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Yard Receiving'),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(50),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
          child: StepIndicator(current: _step.index, total: 3, labels: const ['Scan ID', 'Confirm', 'Done']),
        ),
      ),
    ),
    body: SafeArea(child: SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: _step == _Step.done ? _buildDone() : _buildForm(),
    )),
  );

  Widget _buildForm() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    if (_step == _Step.lookup) ...[
      SectionLabel('Driver ID Card Scan'),
      const Text('Scan or enter the driver\'s ID card number to fetch their assigned vehicle.',
          style: TextStyle(color: AppColors.gray500, fontSize: 13)),
      const SizedBox(height: 14),
      IdCardInput(controller: _idCardCtrl, onLookup: _lookup, loading: _loading),
    ],
    if (_data != null) ...[
      SectionLabel('Driver'),
      DriverCard(driver: _data!.driver),
      const SizedBox(height: 16),
      SectionLabel('Assigned Vehicle'),
      VehicleCard(vehicle: _data!.vehicle),
      if (_data!.transferredAt != null) ...[
        const SizedBox(height: 8),
        Text('Transferred: ${_data!.transferredAt}',
            style: const TextStyle(color: AppColors.gray400, fontSize: 11)),
      ],
      const SizedBox(height: 16),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.green50, borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.green500.withValues(alpha: 0.3))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Ready to Receive', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.green600, fontSize: 13)),
          const SizedBox(height: 4),
          Text('Confirming will mark ${_data!.vehicle.chassisNumber} as RECEIVED at ICDV Yard.',
              style: const TextStyle(color: AppColors.gray600, fontSize: 13)),
        ]),
      ),
      const SizedBox(height: 14),
      SectionLabel('Notes'),
      NotesField(controller: _notesCtrl),
    ],
    if (_error != null) ...[const SizedBox(height: 16), ErrorBanner(_error!)],
    const SizedBox(height: 24),
    if (_step == _Step.confirm) ...[
      ConfirmButton(label: 'Confirm Receipt at ICDV Yard', onPressed: _confirm,
          loading: _loading, color: AppColors.green600, icon: Icons.warehouse),
      const SizedBox(height: 10),
      SizedBox(width: double.infinity, height: 48,
          child: OutlinedButton(onPressed: _reset, child: const Text('Cancel'))),
    ],
  ]);

  Widget _buildDone() => SuccessSheet(
    title: 'Vehicle Received!',
    subtitle: '${_data!.vehicle.chassisNumber} is now at ICDV Yard.\nDriver assignment closed.',
    onNext: _reset,
    nextLabel: 'Receive Another',
  );

  String _parseError(Object e) {
    final s = e.toString();
    if (s.contains('404')) return 'Driver not found or no active assignment';
    if (s.contains('409')) return 'Vehicle is not IN_TRANSIT';
    if (s.contains('SocketException')) return 'No connection to server';
    return 'Operation failed. Please try again.';
  }
}
