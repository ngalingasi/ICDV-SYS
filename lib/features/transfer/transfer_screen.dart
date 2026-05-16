import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/workflow_api.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';

enum _Step { vehicle, driver, confirm, done }

class TransferScreen extends ConsumerStatefulWidget {
  const TransferScreen({super.key});
  @override
  ConsumerState<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends ConsumerState<TransferScreen> {
  final _chassisCtrl = TextEditingController();
  final _idCardCtrl  = TextEditingController();
  final _notesCtrl   = TextEditingController();
  _Step    _step    = _Step.vehicle;
  Vehicle? _vehicle;
  Driver?  _driver;
  bool     _loading = false;
  String?  _error;

  void _reset() => setState(() {
    _step = _Step.vehicle; _vehicle = null; _driver = null; _error = null;
    _chassisCtrl.clear(); _idCardCtrl.clear(); _notesCtrl.clear();
  });

  Future<void> _searchVehicle() async {
    final q = _chassisCtrl.text.trim();
    if (q.length < 4) { setState(() => _error = 'Enter at least 4 digits'); return; }
    setState(() { _loading = true; _error = null; });
    try {
      final v = await ref.read(workflowApiProvider).transferLookup(q);
      setState(() { _vehicle = v; _step = _Step.driver; });
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally { setState(() => _loading = false); }
  }

  Future<void> _lookupDriver() async {
    final q = _idCardCtrl.text.trim();
    if (q.isEmpty) { setState(() => _error = 'Enter driver ID card number'); return; }
    setState(() { _loading = true; _error = null; });
    try {
      final d = await ref.read(workflowApiProvider).driverLookup(q);
      setState(() { _driver = d; _step = _Step.confirm; });
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally { setState(() => _loading = false); }
  }

  Future<void> _confirm() async {
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(workflowApiProvider).transferConfirm(
        vehicleId: _vehicle!.vehicleId,
        driverId: _driver!.driverId,
        driverIdCard: _idCardCtrl.text.trim(),
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      );
      setState(() => _step = _Step.done);
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally { setState(() => _loading = false); }
  }

  @override
  void dispose() { _chassisCtrl.dispose(); _idCardCtrl.dispose(); _notesCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('TPA Transfer'),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(50),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
          child: StepIndicator(current: _step.index, total: 4, labels: const ['Vehicle', 'Driver', 'Confirm', 'Done']),
        ),
      ),
    ),
    body: SafeArea(child: SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: _step == _Step.done ? _buildDone() : _buildForm(),
    )),
  );

  Widget _buildForm() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    // Step 1: Vehicle
    if (_step == _Step.vehicle) ...[
      SectionLabel('Step 1 — Identify Vehicle'),
      ChassisInput(controller: _chassisCtrl, onSearch: _searchVehicle, loading: _loading),
    ],
    // Vehicle confirmed (steps 2+)
    if (_vehicle != null) ...[
      SectionLabel('Vehicle'),
      VehicleCard(vehicle: _vehicle!),
      const SizedBox(height: 16),
    ],
    // Step 2: Driver
    if (_step == _Step.driver) ...[
      SectionLabel('Step 2 — Scan Driver ID Card'),
      IdCardInput(controller: _idCardCtrl, onLookup: _lookupDriver, loading: _loading),
    ],
    // Driver confirmed (step 3)
    if (_driver != null) ...[
      SectionLabel('Driver'),
      DriverCard(driver: _driver!),
      const SizedBox(height: 16),
    ],
    // Step 3: Confirm
    if (_step == _Step.confirm) ...[
      SectionLabel('Transfer Summary'),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.orange50, borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.orange500.withValues(alpha: 0.3))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Confirming will:', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.gray800, fontSize: 13)),
          const SizedBox(height: 6),
          Text('• Assign ${_vehicle!.chassisNumber} to ${_driver!.fullName}', style: const TextStyle(color: AppColors.gray600, fontSize: 13)),
          const Text('• Set status to IN_TRANSIT', style: TextStyle(color: AppColors.gray600, fontSize: 13)),
        ]),
      ),
      const SizedBox(height: 14),
      SectionLabel('Notes'),
      NotesField(controller: _notesCtrl),
    ],
    if (_error != null) ...[const SizedBox(height: 16), ErrorBanner(_error!)],
    const SizedBox(height: 24),
    if (_step == _Step.confirm) ...[
      ConfirmButton(label: 'Confirm Transfer — In Transit', onPressed: _confirm,
          loading: _loading, color: AppColors.orange500, icon: Icons.local_shipping),
      const SizedBox(height: 10),
      SizedBox(width: double.infinity, height: 48,
          child: OutlinedButton(onPressed: _reset, child: const Text('Cancel'))),
    ],
  ]);

  Widget _buildDone() => SuccessSheet(
    title: 'Transfer Confirmed!',
    subtitle: '${_vehicle!.chassisNumber} is now IN TRANSIT\nDriver: ${_driver!.fullName}',
    onNext: _reset,
    nextLabel: 'Process Another',
  );

  String _parseError(Object e) {
    final s = e.toString();
    if (s.contains('409')) return 'Vehicle is not BATCHED or driver already has active assignment';
    if (s.contains('404')) return 'Not found — check chassis or ID card';
    if (s.contains('SocketException')) return 'No connection to server';
    return 'Operation failed. Please try again.';
  }
}
