import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/workflow_api.dart';
import '../../core/models/models.dart';
import '../../core/providers/theme_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';
import '../shared/op_header.dart';

// Brand colors for Transfer — amber/orange
const _kGradStart = Color(0xFFFDE8CC);
const _kGradEnd   = Color(0xFFF9D0A0);
const _kSymbol    = Color(0xFFF5A652);
const _kAccent    = Color(0xFFB85C00);

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
  _Step    _step   = _Step.vehicle;
  Vehicle? _vehicle;
  Driver?  _driver;
  bool     _loading = false;
  String?  _error;

  void _reset() => setState(() { _step = _Step.vehicle; _vehicle = null; _driver = null; _error = null; _chassisCtrl.clear(); _idCardCtrl.clear(); _notesCtrl.clear(); });

  Future<void> _searchVehicle() async {
    final q = _chassisCtrl.text.trim();
    if (q.length < 4) { setState(() => _error = 'Enter at least 4 digits'); return; }
    setState(() { _loading = true; _error = null; });
    try { final v = await ref.read(workflowApiProvider).transferLookup(q); setState(() { _vehicle = v; _step = _Step.driver; }); }
    catch (e) { setState(() => _error = _parseError(e)); }
    finally { setState(() => _loading = false); }
  }

  Future<void> _lookupDriver() async {
    final q = _idCardCtrl.text.trim();
    if (q.isEmpty) { setState(() => _error = 'Enter driver ID card number'); return; }
    setState(() { _loading = true; _error = null; });
    try { final d = await ref.read(workflowApiProvider).driverLookup(q); setState(() { _driver = d; _step = _Step.confirm; }); }
    catch (e) { setState(() => _error = _parseError(e)); }
    finally { setState(() => _loading = false); }
  }

  Future<void> _confirm() async {
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(workflowApiProvider).transferConfirm(
        vehicleId: _vehicle!.vehicleId, driverId: _driver!.driverId,
        driverIdCard: _idCardCtrl.text.trim(),
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim());
      setState(() => _step = _Step.done);
    } catch (e) { setState(() => _error = _parseError(e)); }
    finally { setState(() => _loading = false); }
  }

  @override
  void dispose() { _chassisCtrl.dispose(); _idCardCtrl.dispose(); _notesCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final c    = AppColors(isDarkMode(context));
    final dark = isDarkMode(context);
    return Scaffold(
      backgroundColor: c.bg,
      body: Column(children: [
        OpHeader(
          dark: dark, title: 'TPA Transfer',
          subtitle: 'Gate → ICDV Yard',
          icon: Icons.local_shipping_rounded,
          gradStart: _kGradStart, gradEnd: _kGradEnd,
          symbolColor: _kSymbol,
          step: _step.index, totalSteps: 4,
          stepLabels: const ['Vehicle', 'Driver', 'Confirm', 'Done'],
          onBack: () => Navigator.of(context).maybePop(),
        ),
        Expanded(child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: _step == _Step.done ? _buildDone() : _buildForm(c),
        )),
      ]),
    );
  }

  Widget _buildForm(AppColors c) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    if (_step == _Step.vehicle) ...[
      const SectionLabel('Step 1 — Identify Vehicle'),
      ChassisInput(controller: _chassisCtrl, onSearch: _searchVehicle, loading: _loading),
    ],
    if (_vehicle != null) ...[
      const SizedBox(height: 16),
      const SectionLabel('Vehicle'),
      VehicleCard(vehicle: _vehicle!),
      const SizedBox(height: 16),
    ],
    if (_step == _Step.driver) ...[
      const SectionLabel('Step 2 — Scan Driver ID Card'),
      IdCardInput(controller: _idCardCtrl, onLookup: _lookupDriver, loading: _loading),
    ],
    if (_driver != null) ...[
      const SectionLabel('Driver'),
      DriverCard(driver: _driver!),
      const SizedBox(height: 16),
    ],
    if (_step == _Step.confirm) ...[
      const SectionLabel('Transfer Summary'),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _kGradStart.withOpacity(0.5),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _kSymbol.withOpacity(0.4))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Confirming will:', style: TextStyle(
            fontWeight: FontWeight.w700, color: _kAccent, fontSize: 12, letterSpacing: 0.5)),
          const SizedBox(height: 8),
          Text('• Assign ${_vehicle!.chassisNumber} to ${_driver!.fullName}',
            style: TextStyle(color: c.textSecond, fontSize: 13)),
          Text('• Set workflow status to IN_TRANSIT',
            style: TextStyle(color: c.textSecond, fontSize: 13)),
        ]),
      ),
      const SizedBox(height: 14),
      const SectionLabel('Notes'),
      NotesField(controller: _notesCtrl),
    ],
    if (_error != null) ...[const SizedBox(height: 14), ErrorBanner(_error!)],
    const SizedBox(height: 24),
    if (_step == _Step.confirm) ...[
      ConfirmButton(label: 'Confirm Transfer — In Transit',
        onPressed: _confirm, loading: _loading, color: _kAccent,
        icon: Icons.local_shipping_rounded),
      const SizedBox(height: 10),
      _OutlineBtn('Cancel', _reset),
    ],
  ]);

  Widget _buildDone() => SuccessSheet(
    title: 'Transfer Confirmed!',
    subtitle: '${_vehicle!.chassisNumber} is now IN TRANSIT\nDriver: ${_driver!.fullName}',
    onNext: _reset, nextLabel: 'Process Another');

  String _parseError(Object e) {
    final s = e.toString();
    if (s.contains('409')) return 'Vehicle not BATCHED or driver has active assignment';
    if (s.contains('404')) return 'Not found — check chassis or ID card';
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
