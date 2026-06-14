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

const _kGradStart = Color(0xFFD4F7E2);
const _kGradEnd   = Color(0xFFB8F0CE);
const _kSymbol    = Color(0xFF4CAF50);
const _kAccent    = Color(0xFF1B5E20);

class BatchStatusScreen extends ConsumerStatefulWidget {
  const BatchStatusScreen({super.key});
  @override
  ConsumerState<BatchStatusScreen> createState() => _BatchStatusScreenState();
}

class _BatchStatusScreenState extends ConsumerState<BatchStatusScreen> {
  List<BatchStatusInfo> _batches       = [];
  BatchStatusInfo?      _selected;
  bool                  _loading       = true;
  String?               _error;
  bool                  _updating      = false;

  // Edit state
  String  _docStatus  = 'not_ready';
  String  _gcStatus   = 'not_sent';
  String  _docRemark  = '';
  String  _gcRemark   = '';
  final   _docRemarkCtrl = TextEditingController();
  final   _gcRemarkCtrl  = TextEditingController();

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _docRemarkCtrl.dispose(); _gcRemarkCtrl.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final batches = await ref.read(workflowApiProvider).getBatches(
        status: 'open',
      );
      if (mounted) setState(() { _batches = batches; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = extractApiError(e); _loading = false; });
    }
  }

  void _selectBatch(BatchStatusInfo b) {
    setState(() {
      _selected   = b;
      _docStatus  = b.documentStatus;
      _gcStatus   = b.gcStatus;
      _docRemark  = b.documentRemark ?? '';
      _gcRemark   = b.gcRemark       ?? '';
      _docRemarkCtrl.text = _docRemark;
      _gcRemarkCtrl.text  = _gcRemark;
    });
  }

  Future<void> _save() async {
    if (_selected == null) return;
    // Enforce doc-before-GC rule on client
    if (_gcStatus == 'sent' && _docStatus != 'ready') {
      setState(() => _error = 'Document status must be Ready before GC can be marked Sent.');
      return;
    }
    setState(() { _updating = true; _error = null; });
    try {
      final updated = await ref.read(workflowApiProvider).updateBatchStatus(
        _selected!.batchId,
        documentStatus: _docStatus,
        documentRemark: _docRemarkCtrl.text.trim().isEmpty ? null : _docRemarkCtrl.text.trim(),
        gcStatus:       _gcStatus,
        gcRemark:       _gcRemarkCtrl.text.trim().isEmpty ? null : _gcRemarkCtrl.text.trim(),
      );
      // Update in list
      final idx = _batches.indexWhere((b) => b.batchId == updated.batchId);
      if (mounted) setState(() {
        _updating = false;
        _selected = updated;
        if (idx >= 0) _batches[idx] = updated;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: const Text('Batch status updated successfully'),
            backgroundColor: AppBrand.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))));
      }
    } catch (e) {
      if (mounted) setState(() { _error = extractApiError(e); _updating = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c    = AppColors(isDarkMode(context));
    final dark = isDarkMode(context);

    return Scaffold(
      backgroundColor: c.bg,
      body: Column(children: [
        OpHeader(
          dark: dark, title: 'Batch Status',
          subtitle: 'Document & GC readiness',
          icon: Icons.assignment_turned_in_rounded,
          gradStart: _kGradStart, gradEnd: _kGradEnd, symbolColor: _kSymbol,
          step: 0, totalSteps: 1, stepLabels: const ['Update'],
          onBack: () => context.pop(),
        ),

        Expanded(child: _loading
          ? const Center(child: CircularProgressIndicator(color: _kAccent))
          : _selected == null
            ? _BatchList(batches: _batches, c: c, dark: dark, onSelect: _selectBatch, error: _error)
            : _BatchEditPanel(
                batch:       _selected!,
                docStatus:   _docStatus,
                gcStatus:    _gcStatus,
                docRemarkCtrl: _docRemarkCtrl,
                gcRemarkCtrl:  _gcRemarkCtrl,
                updating:    _updating,
                error:       _error,
                c:           c,
                dark:        dark,
                onDocStatus: (v) => setState(() => _docStatus = v),
                onGcStatus:  (v) => setState(() => _gcStatus = v),
                onSave:      _save,
                onBack:      () => setState(() { _selected = null; _error = null; }),
              ),
        ),
      ]),
    );
  }
}

// ── Batch list ────────────────────────────────────────────────────────────────
class _BatchList extends StatelessWidget {
  final List<BatchStatusInfo> batches;
  final AppColors c;
  final bool dark;
  final ValueChanged<BatchStatusInfo> onSelect;
  final String? error;
  const _BatchList({required this.batches, required this.c, required this.dark,
      required this.onSelect, this.error});

  @override
  Widget build(BuildContext context) => batches.isEmpty
    ? Center(child: Text(error ?? 'No open batches', style: TextStyle(color: c.textMuted)))
    : ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: batches.length,
        itemBuilder: (_, i) {
          final b = batches[i];
          final opColor = b.operationalStatus == 'ready' ? AppBrand.success : AppBrand.warning;
          return GestureDetector(
            onTap: () => onSelect(b),
            child: Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: c.surface0, borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: c.border)),
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(b.batchNumber, style: TextStyle(
                    color: c.textPrimary, fontWeight: FontWeight.w800,
                    fontFamily: 'monospace', fontSize: 14)),
                  const SizedBox(height: 4),
                  Text('${b.vehicleCount} vehicles · ${b.vesselName ?? "—"}',
                    style: TextStyle(color: c.textSecond, fontSize: 12)),
                  const SizedBox(height: 6),
                  Row(children: [
                    _MiniTag('DOC: ${b.documentStatus == "ready" ? "✓ Ready" : "Not Ready"}',
                      b.documentStatus == 'ready' ? AppBrand.success : AppBrand.warning),
                    const SizedBox(width: 6),
                    _MiniTag('GC: ${b.gcStatus == "sent" ? "✓ Sent" : "Not Sent"}',
                      b.gcStatus == 'sent' ? AppBrand.success : AppBrand.warning),
                  ]),
                ])),
                Container(width: 10, height: 10, margin: const EdgeInsets.only(left: 8),
                  decoration: BoxDecoration(shape: BoxShape.circle, color: opColor)),
              ]),
            ),
          );
        });
}

class _MiniTag extends StatelessWidget {
  final String text; final Color color;
  const _MiniTag(this.text, this.color);
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withOpacity(0.35))),
    child: Text(text, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700)));
}

// ── Edit panel ────────────────────────────────────────────────────────────────
class _BatchEditPanel extends StatelessWidget {
  final BatchStatusInfo batch;
  final String docStatus, gcStatus;
  final TextEditingController docRemarkCtrl, gcRemarkCtrl;
  final bool updating, dark;
  final String? error;
  final AppColors c;
  final ValueChanged<String> onDocStatus, onGcStatus;
  final VoidCallback onSave, onBack;

  const _BatchEditPanel({
    required this.batch, required this.docStatus, required this.gcStatus,
    required this.docRemarkCtrl, required this.gcRemarkCtrl,
    required this.updating, required this.dark, this.error,
    required this.c, required this.onDocStatus, required this.onGcStatus,
    required this.onSave, required this.onBack,
  });

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: const EdgeInsets.all(16),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Back chip
      GestureDetector(
        onTap: onBack,
        child: Row(children: [
          Icon(Icons.arrow_back_rounded, size: 16, color: c.textMuted),
          const SizedBox(width: 4),
          Text('All Batches', style: TextStyle(color: c.textMuted, fontSize: 13)),
        ]),
      ),
      const SizedBox(height: 12),

      // Batch info
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: c.surface0, borderRadius: BorderRadius.circular(14),
            border: Border.all(color: c.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(batch.batchNumber, style: TextStyle(
            color: c.textPrimary, fontWeight: FontWeight.w900,
            fontFamily: 'monospace', fontSize: 17)),
          const SizedBox(height: 4),
          Text('${batch.vehicleCount} vehicles · ${batch.vesselName ?? "—"}',
            style: TextStyle(color: c.textSecond, fontSize: 13)),
          const SizedBox(height: 8),
          Row(children: [
            const Text('Operational: ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            StatusBadge(batch.operationalStatus),
          ]),
        ]),
      ),

      const SizedBox(height: 20),

      // Document Status
      const SectionLabel('Document Status'),
      _ToggleRow(
        value:    docStatus,
        options:  const {'not_ready': 'Not Ready', 'ready': 'Ready'},
        colors:   const {'not_ready': AppBrand.warning, 'ready': AppBrand.success},
        onChanged: onDocStatus,
        c: c,
      ),
      const SizedBox(height: 10),
      TextField(controller: docRemarkCtrl,
        decoration: const InputDecoration(hintText: 'Document remark (optional)…', isDense: true)),

      const SizedBox(height: 20),

      // GC Status
      const SectionLabel('GC Status'),
      _ToggleRow(
        value:    gcStatus,
        options:  const {'not_sent': 'Not Sent', 'sent': 'Sent'},
        colors:   const {'not_sent': AppBrand.warning, 'sent': AppBrand.success},
        onChanged: onGcStatus,
        c: c,
      ),
      const SizedBox(height: 10),
      TextField(controller: gcRemarkCtrl,
        decoration: const InputDecoration(hintText: 'GC remark (optional)…', isDense: true)),

      if (error != null) ...[const SizedBox(height: 14), ErrorBanner(error!)],

      const SizedBox(height: 24),
      ConfirmButton(
        label: 'Save Status',
        loading: updating,
        onPressed: onSave,
        color: _kAccent,
        icon: Icons.save_rounded,
      ),
    ]),
  );
}

class _ToggleRow extends StatelessWidget {
  final String value;
  final Map<String, String> options;
  final Map<String, Color> colors;
  final ValueChanged<String> onChanged;
  final AppColors c;
  const _ToggleRow({required this.value, required this.options, required this.colors,
      required this.onChanged, required this.c});

  @override
  Widget build(BuildContext context) => Row(
    children: options.entries.map((e) {
      final active = value == e.key;
      final color  = colors[e.key] ?? c.accent;
      return Expanded(child: GestureDetector(
        onTap: () => onChanged(e.key),
        child: Container(
          margin: const EdgeInsets.only(right: 8),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: active ? color.withOpacity(0.15) : c.surface1,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: active ? color : c.border, width: active ? 2 : 1),
          ),
          child: Text(e.value, textAlign: TextAlign.center,
            style: TextStyle(
              color: active ? color : c.textMuted,
              fontWeight: FontWeight.w800, fontSize: 13)),
        ),
      ));
    }).toList(),
  );
}
