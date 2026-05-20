import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/workflow_api.dart';
import '../../core/models/models.dart';
import '../../core/providers/theme_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';
import '../shared/op_header.dart';
import '../shared/op_confirm_sheet.dart';

const _kGradStart = Color(0xFFCCF0DC);
const _kGradEnd   = Color(0xFFA0E0BC);
const _kSymbol    = Color(0xFF4DC98A);
const _kAccent    = Color(0xFF0A7A40);

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
  bool           _loading = false;
  String?        _error;

  void _reset() => setState(() { _step = _Step.lookup; _data = null; _error = null; _idCardCtrl.clear(); _notesCtrl.clear(); });

  Future<void> _lookup() async {
    final q = _idCardCtrl.text.trim();
    if (q.isEmpty) { setState(() => _error = 'Enter driver ID card number'); return; }
    setState(() { _loading = true; _error = null; });
    try { final d = await ref.read(workflowApiProvider).receiveLookup(q); setState(() { _data = d; _step = _Step.confirm; }); }
    catch (e) { setState(() => _error = _parseError(e)); }
    finally { setState(() => _loading = false); }
  }

  Future<void> _showConfirmSheet() async {
    final notes = _notesCtrl.text.trim();
    final ok = await showOpConfirmSheet(
      context: context,
      title: 'Confirm Receipt',
      subtitle: 'Mark ${_data!.vehicle.chassisNumber} as RECEIVED at ICDV Yard\nand close driver assignment?',
      confirmLabel: 'Receive',
      icon: Icons.warehouse_rounded,
      gradStart: _kGradStart, gradEnd: _kGradEnd,
      symbolColor: _kSymbol, accentColor: _kAccent,
      successTitle: 'Vehicle Received!',
      successMessage: '${_data!.vehicle.chassisNumber} is now at ICDV Yard.\nDriver assignment closed.',
      onConfirm: () => ref.read(workflowApiProvider).receiveConfirm(
        _data!.driver.driverId, _data!.vehicle.vehicleId,
        notes: notes.isEmpty ? null : notes),
    );
    if (ok && mounted) setState(() => _step = _Step.done);
  }

  @override
  void dispose() { _idCardCtrl.dispose(); _notesCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    final dark = isDarkMode(context);
    return Scaffold(
      backgroundColor: c.bg,
      body: Column(children: [
        OpHeader(
          dark: dark, title: 'Yard Receiving',
          subtitle: 'Confirm vehicle arrival',
          icon: Icons.warehouse_rounded,
          gradStart: _kGradStart, gradEnd: _kGradEnd, symbolColor: _kSymbol,
          step: _step.index, totalSteps: 3,
          stepLabels: const ['Scan ID', 'Confirm', 'Done'],
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
    if (_step == _Step.lookup) ...[
      const SectionLabel('Driver ID Card Scan'),
      Text('Scan or enter the driver\'s ID card to fetch their assigned vehicle.',
        style: TextStyle(color: c.textSecond, fontSize: 13)),
      const SizedBox(height: 14),
      IdCardInput(controller: _idCardCtrl, onLookup: _lookup, loading: _loading),
    ],
    if (_data != null) ...[
      const SizedBox(height: 4),
      const SectionLabel('Driver'),
      DriverCard(driver: _data!.driver),
      const SizedBox(height: 14),
      const SectionLabel('Assigned Vehicle'),
      VehicleCard(vehicle: _data!.vehicle),
      if (_data!.transferredAt != null) ...[
        const SizedBox(height: 6),
        Text('Transferred: ${_data!.transferredAt}',
          style: TextStyle(color: c.textMuted, fontSize: 11)),
      ],
      const SizedBox(height: 14),
      const SectionLabel('Notes'),
      NotesField(controller: _notesCtrl),
    ],
    if (_error != null) ...[const SizedBox(height: 14), ErrorBanner(_error!)],
    const SizedBox(height: 24),
    if (_step == _Step.confirm) ...[
      ConfirmButton(label: 'Confirm Receipt at ICDV Yard',
        onPressed: _showConfirmSheet, loading: false,
        color: _kAccent, icon: Icons.warehouse_rounded),
      const SizedBox(height: 10),
      _OutlineBtn('Cancel', _reset),
    ],
  ]);

  Widget _buildDone() => SuccessSheet(
    title: 'Vehicle Received!',
    subtitle: '${_data!.vehicle.chassisNumber} is now at ICDV Yard.\nDriver assignment closed.',
    onNext: _reset, nextLabel: 'Receive Another');

  String _parseError(Object e) {
    final s = e.toString();
    if (s.contains('404')) return 'Driver not found or no active assignment';
    if (s.contains('409')) return 'Vehicle is not IN_TRANSIT';
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
