import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/workflow_api.dart';
import '../../core/api/workflow_api.dart' show extractApiError;

import '../../core/models/models.dart';
import '../../core/providers/theme_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';
import '../shared/op_header.dart';
import '../shared/op_confirm_sheet.dart';

const _kGradStart = Color(0xFFCFDEF7);
const _kGradEnd = Color(0xFFADC6F0);
const _kSymbol = Color(0xFF6AAEF5);
const _kAccent = Color(0xFF0D4E9E);

enum _Step { search, confirm, done }

class DischargeScreen extends ConsumerStatefulWidget {
  const DischargeScreen({super.key});
  @override
  ConsumerState<DischargeScreen> createState() => _DischargeScreenState();
}

class _DischargeScreenState extends ConsumerState<DischargeScreen> {
  final _chassisCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  _Step _step = _Step.search;
  Vehicle? _vehicle;
  bool _loading = false;
  String? _error;

  void _reset() => setState(() {
    _step = _Step.search;
    _vehicle = null;
    _error = null;
    _chassisCtrl.clear();
    _notesCtrl.clear();
  });

  Future<void> _search() async {
    final q = _chassisCtrl.text.trim();
    if (q.length < 4) {
      setState(() => _error = 'Enter at least 4 digits');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final v = await ref.read(workflowApiProvider).dischargeLookup(q);
      setState(() {
        _vehicle = v;
        _step = _Step.confirm;
      });
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _showConfirmSheet() async {
    final notes = _notesCtrl.text.trim();
    final ok = await showOpConfirmSheet(
      context: context,
      title: 'Confirm Discharge',
      subtitle:
          'Move ${_vehicle!.chassisNumber} from Vessel to Holding Ground?',
      confirmLabel: 'Discharge',
      icon: Icons.anchor_rounded,
      gradStart: _kGradStart,
      gradEnd: _kGradEnd,
      symbolColor: _kSymbol,
      accentColor: _kAccent,
      successTitle: 'Discharged!',
      successMessage: '${_vehicle!.chassisNumber} moved to Holding Ground.',
      onConfirm:
          () => ref
              .read(workflowApiProvider)
              .dischargeConfirm(
                _vehicle!.vehicleId,
                notes: notes.isEmpty ? null : notes,
              ),
    );
    if (ok && mounted) setState(() => _step = _Step.done);
  }

  @override
  void dispose() {
    _chassisCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    final dark = isDarkMode(context);
    return Scaffold(
      backgroundColor: c.bg,
      body: Column(
        children: [
          OpHeader(
            dark: dark,
            title: 'Discharge',
            subtitle: 'Vessel → Holding Ground',
            icon: Icons.anchor_rounded,
            gradStart: _kGradStart,
            gradEnd: _kGradEnd,
            symbolColor: _kSymbol,
            step: _step.index,
            totalSteps: 3,
            stepLabels: const ['Search', 'Confirm', 'Done'],
            onBack: () => context.pop(),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: _step == _Step.done ? _buildDone() : _buildForm(c),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildForm(AppColors c) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (_step == _Step.search) ...[
        ChassisInput(
          controller: _chassisCtrl,
          onSearch: _search,
          loading: _loading,
        ),
        const SizedBox(height: 8),
        Text(
          'Enter last 4+ digits of chassis number',
          style: TextStyle(color: c.textMuted, fontSize: 12),
        ),
      ],
      if (_vehicle != null) ...[
        const SizedBox(height: 16),
        VehicleCard(vehicle: _vehicle!),
        const SizedBox(height: 14),
        const WarningBanner(
          'Confirm this is the correct vehicle before discharging.',
        ),
        const SizedBox(height: 14),
        const SectionLabel('Notes'),
        NotesField(controller: _notesCtrl),
      ],
      if (_error != null) ...[const SizedBox(height: 14), ErrorBanner(_error!)],
      const SizedBox(height: 24),
      if (_step == _Step.confirm) ...[
        ConfirmButton(
          label: 'Confirm Discharge',
          onPressed: _showConfirmSheet,
          loading: false,
          color: _kAccent,
          icon: Icons.anchor_rounded,
        ),
        const SizedBox(height: 10),
        _OutlineBtn('Cancel', _reset),
      ],
    ],
  );

  Widget _buildDone() => SuccessSheet(
    title: 'Discharged!',
    subtitle: '${_vehicle!.chassisNumber}\nmoved to Holding Ground',
    onNext: _reset,
    nextLabel: 'Discharge Another',
  );

  String _parseError(Object e) => extractApiError(e);
}

class _OutlineBtn extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _OutlineBtn(this.label, this.onTap);
  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          foregroundColor: c.textSecond,
          side: BorderSide(color: c.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        child: Text(label),
      ),
    );
  }
}
