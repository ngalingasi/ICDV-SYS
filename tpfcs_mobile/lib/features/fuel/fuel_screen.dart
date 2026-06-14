import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/workflow_api.dart';
import '../../core/api/workflow_api.dart' show extractApiError;
import '../../core/models/models.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/theme_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';
import '../shared/op_header.dart';

const _kGradStart = Color(0xFFFFEDCC);
const _kGradEnd   = Color(0xFFFFD9A0);
const _kSymbol    = Color(0xFFFF9800);
const _kAccent    = Color(0xFFE65100);

// ── Tabs ──────────────────────────────────────────────────────────────────────
enum _FuelTab { orders, dispense }

class FuelScreen extends ConsumerStatefulWidget {
  const FuelScreen({super.key});
  @override
  ConsumerState<FuelScreen> createState() => _FuelScreenState();
}

class _FuelScreenState extends ConsumerState<FuelScreen> {
  _FuelTab _tab = _FuelTab.orders;

  // Manifest selection
  List<ManifestSummary> _manifests = [];
  ManifestSummary?      _manifest;
  bool _loadingManifests = true;

  @override
  void initState() {
    super.initState();
    _loadManifests();
  }

  Future<void> _loadManifests() async {
    try {
      final list = await ref.read(workflowApiProvider).getManifests();
      if (mounted) setState(() { _manifests = list; _loadingManifests = false; });
    } catch (_) { if (mounted) setState(() => _loadingManifests = false); }
  }

  @override
  Widget build(BuildContext context) {
    final c    = AppColors(isDarkMode(context));
    final dark = isDarkMode(context);
    final user = ref.watch(authProvider).user;
    final canApprove = user?.canApproveFuel ?? false;

    return Scaffold(
      backgroundColor: c.bg,
      body: Column(children: [
        OpHeader(
          dark: dark, title: 'Fuel Management',
          subtitle: 'Orders & Dispensing',
          icon: Icons.local_gas_station_rounded,
          gradStart: _kGradStart, gradEnd: _kGradEnd, symbolColor: _kSymbol,
          step: 0, totalSteps: 1,
          stepLabels: const ['Active'],
          onBack: () => context.pop(),
        ),

        // Manifest selector
        Container(
          color: c.surface0,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: _loadingManifests
            ? LinearProgressIndicator(color: _kAccent, backgroundColor: c.surface1)
            : _ManifestDropdown(
                manifests: _manifests,
                selected: _manifest,
                onChanged: (m) => setState(() => _manifest = m),
              ),
        ),

        // Tab bar
        Container(
          color: c.surface0,
          child: Row(children: [
            _TabBtn('Orders',   _FuelTab.orders,   _tab, canApprove, _kAccent, () => setState(() => _tab = _FuelTab.orders)),
            _TabBtn('Dispense', _FuelTab.dispense, _tab, true,        _kAccent, () => setState(() => _tab = _FuelTab.dispense)),
          ]),
        ),
        const Divider(height: 1),

        Expanded(
          child: _manifest == null
            ? Center(child: Text('Select a manifest above',
                style: TextStyle(color: c.textMuted, fontSize: 14)))
            : _tab == _FuelTab.orders
              ? _FuelOrdersTab(manifest: _manifest!, canApprove: canApprove, c: c, dark: dark)
              : _FuelDispenseTab(manifest: _manifest!, c: c),
        ),
      ]),
    );
  }
}

// ── Manifest dropdown ─────────────────────────────────────────────────────────
class _ManifestDropdown extends StatelessWidget {
  final List<ManifestSummary> manifests;
  final ManifestSummary? selected;
  final ValueChanged<ManifestSummary?> onChanged;
  const _ManifestDropdown({required this.manifests, required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final c = AppColors(isDarkMode(context));
    return DropdownButtonFormField<ManifestSummary>(
      value: selected,
      decoration: InputDecoration(
        labelText: 'Manifest',
        prefixIcon: Icon(Icons.description_outlined, color: c.textMuted, size: 18),
        isDense: true,
      ),
      items: manifests.map((m) => DropdownMenuItem(
        value: m,
        child: Text('${m.manifestNumber} · ${m.vesselName ?? "—"}',
          style: const TextStyle(fontSize: 13)),
      )).toList(),
      onChanged: onChanged,
      hint: Text('Select manifest…', style: TextStyle(color: c.textMuted)),
    );
  }
}

// ── Tab button ────────────────────────────────────────────────────────────────
class _TabBtn extends StatelessWidget {
  final String label;
  final _FuelTab tab, current;
  final bool visible;
  final Color accent;
  final VoidCallback onTap;
  const _TabBtn(this.label, this.tab, this.current, this.visible, this.accent, this.onTap);

  @override
  Widget build(BuildContext context) {
    if (!visible) return const SizedBox.shrink();
    final active = tab == current;
    final c = AppColors(isDarkMode(context));
    return Expanded(child: GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(
            color: active ? accent : Colors.transparent, width: 2.5)),
        ),
        child: Text(label, textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 13, fontWeight: FontWeight.w700,
            color: active ? accent : c.textMuted)),
      ),
    ));
  }
}

// ── Fuel Orders Tab ───────────────────────────────────────────────────────────
class _FuelOrdersTab extends ConsumerStatefulWidget {
  final ManifestSummary manifest;
  final bool canApprove;
  final AppColors c;
  final bool dark;
  const _FuelOrdersTab({required this.manifest, required this.canApprove,
      required this.c, required this.dark});
  @override
  ConsumerState<_FuelOrdersTab> createState() => _FuelOrdersTabState();
}

class _FuelOrdersTabState extends ConsumerState<_FuelOrdersTab> {
  List<FuelOrder> _orders  = [];
  bool            _loading = true;
  String?         _error;
  // Create order form
  bool _showForm = false;
  final _qtyCtrl   = TextEditingController();
  final _notesCtrl = TextEditingController();
  String _fuelType = 'diesel';
  bool   _saving   = false;

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _qtyCtrl.dispose(); _notesCtrl.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final orders = await ref.read(workflowApiProvider).getFuelOrders(widget.manifest.manifestId);
      if (mounted) setState(() { _orders = orders; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = extractApiError(e); _loading = false; });
    }
  }

  Future<void> _createOrder() async {
    final qty = double.tryParse(_qtyCtrl.text.trim());
    if (qty == null || qty <= 0) {
      setState(() => _error = 'Enter a valid quantity'); return;
    }
    setState(() { _saving = true; _error = null; });
    try {
      await ref.read(workflowApiProvider).createFuelOrder(
        widget.manifest.manifestId,
        fuelType: _fuelType, quantityLitres: qty,
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      );
      _qtyCtrl.clear(); _notesCtrl.clear();
      setState(() { _showForm = false; _saving = false; });
      _load();
    } catch (e) {
      setState(() { _error = extractApiError(e); _saving = false; });
    }
  }

  Future<void> _approve(FuelOrder order) async {
    try {
      await ref.read(workflowApiProvider).approveFuelOrder(
        widget.manifest.manifestId, order.orderId);
      _load();
    } catch (e) {
      setState(() => _error = extractApiError(e));
    }
  }

  Future<void> _reject(FuelOrder order) async {
    try {
      await ref.read(workflowApiProvider).rejectFuelOrder(
        widget.manifest.manifestId, order.orderId);
      _load();
    } catch (e) {
      setState(() => _error = extractApiError(e));
    }
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: _load,
    color: _kAccent,
    child: ListView(padding: const EdgeInsets.all(16), children: [
      // Create order button
      if (!_showForm) ...[
        ElevatedButton.icon(
          onPressed: () => setState(() => _showForm = true),
          icon: const Icon(Icons.add_rounded),
          label: const Text('New Fuel Order'),
          style: ElevatedButton.styleFrom(
            backgroundColor: _kAccent, foregroundColor: Colors.white,
            minimumSize: const Size(double.infinity, 48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            elevation: 0,
          ),
        ),
        const SizedBox(height: 16),
      ],
      // Create form
      if (_showForm) ...[
        _OrderForm(
          qtyCtrl: _qtyCtrl, notesCtrl: _notesCtrl,
          fuelType: _fuelType,
          onFuelTypeChanged: (v) => setState(() => _fuelType = v),
          onSubmit: _createOrder, onCancel: () => setState(() => _showForm = false),
          saving: _saving, accentColor: _kAccent, c: widget.c,
        ),
        const SizedBox(height: 16),
      ],
      if (_error != null) ...[ErrorBanner(_error!), const SizedBox(height: 12)],
      if (_loading)
        const Center(child: CircularProgressIndicator(color: _kAccent))
      else if (_orders.isEmpty)
        Center(child: Text('No fuel orders yet', style: TextStyle(color: widget.c.textMuted)))
      else
        ..._orders.map((o) => _FuelOrderCard(
          order: o, canApprove: widget.canApprove,
          c: widget.c, dark: widget.dark,
          onApprove: () => _approve(o),
          onReject: () => _reject(o),
        )),
    ]),
  );
}

class _OrderForm extends StatelessWidget {
  final TextEditingController qtyCtrl, notesCtrl;
  final String fuelType;
  final ValueChanged<String> onFuelTypeChanged;
  final VoidCallback onSubmit, onCancel;
  final bool saving;
  final Color accentColor;
  final AppColors c;
  const _OrderForm({required this.qtyCtrl, required this.notesCtrl,
      required this.fuelType, required this.onFuelTypeChanged,
      required this.onSubmit, required this.onCancel,
      required this.saving, required this.accentColor, required this.c});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: c.surface0, borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SectionLabel('New Fuel Order'),
      DropdownButtonFormField<String>(
        value: fuelType,
        decoration: const InputDecoration(labelText: 'Fuel Type', isDense: true),
        items: ['diesel', 'petrol', 'lpg'].map((t) => DropdownMenuItem(
          value: t, child: Text(t.toUpperCase()))).toList(),
        onChanged: (v) => v != null ? onFuelTypeChanged(v) : null,
      ),
      const SizedBox(height: 10),
      TextField(
        controller: qtyCtrl,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: const InputDecoration(labelText: 'Quantity (Litres)', isDense: true),
      ),
      const SizedBox(height: 10),
      NotesField(controller: notesCtrl),
      const SizedBox(height: 14),
      Row(children: [
        Expanded(child: OutlinedButton(
          onPressed: onCancel,
          child: const Text('Cancel'))),
        const SizedBox(width: 10),
        Expanded(child: ConfirmButton(
          label: 'Submit Order', loading: saving,
          onPressed: onSubmit, color: accentColor,
          icon: Icons.local_gas_station_rounded)),
      ]),
    ]),
  );
}

class _FuelOrderCard extends StatelessWidget {
  final FuelOrder order;
  final bool canApprove, dark;
  final AppColors c;
  final VoidCallback onApprove, onReject;
  const _FuelOrderCard({required this.order, required this.canApprove,
      required this.c, required this.dark, required this.onApprove, required this.onReject});

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (order.status) {
      'approved' => AppBrand.success,
      'rejected' => AppBrand.danger,
      _          => AppBrand.warning,
    };
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: c.surface0, borderRadius: BorderRadius.circular(14),
          border: Border.all(color: c.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.local_gas_station_rounded, color: _kAccent, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(
            '${order.fuelType.toUpperCase()} — ${order.quantityLitres.toStringAsFixed(0)} L',
            style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w800, fontSize: 14))),
          StatusBadge(order.status),
        ]),
        if (order.notes != null) ...[
          const SizedBox(height: 6),
          Text(order.notes!, style: TextStyle(color: c.textSecond, fontSize: 12)),
        ],
        const SizedBox(height: 6),
        Text(order.createdAt.split('T').first,
          style: TextStyle(color: c.textMuted, fontSize: 11)),
        if (canApprove && order.status == 'pending') ...[
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: OutlinedButton(
              onPressed: onReject,
              style: OutlinedButton.styleFrom(foregroundColor: AppBrand.danger,
                side: BorderSide(color: AppBrand.danger.withOpacity(0.4))),
              child: const Text('Reject', style: TextStyle(fontSize: 12)))),
            const SizedBox(width: 8),
            Expanded(child: ElevatedButton(
              onPressed: onApprove,
              style: ElevatedButton.styleFrom(backgroundColor: AppBrand.success,
                foregroundColor: Colors.white, elevation: 0),
              child: const Text('Approve', style: TextStyle(fontSize: 12)))),
          ]),
        ],
      ]),
    );
  }
}

// ── Fuel Dispense Tab ─────────────────────────────────────────────────────────
class _FuelDispenseTab extends ConsumerStatefulWidget {
  final ManifestSummary manifest;
  final AppColors c;
  const _FuelDispenseTab({required this.manifest, required this.c});
  @override
  ConsumerState<_FuelDispenseTab> createState() => _FuelDispenseTabState();
}

class _FuelDispenseTabState extends ConsumerState<_FuelDispenseTab> {
  final _chassisCtrl = TextEditingController();
  final _qtyCtrl     = TextEditingController();
  final _notesCtrl   = TextEditingController();
  Vehicle? _vehicle;
  bool     _loading = false;
  bool     _saving  = false;
  bool     _done    = false;
  String?  _error;

  @override
  void dispose() { _chassisCtrl.dispose(); _qtyCtrl.dispose(); _notesCtrl.dispose(); super.dispose(); }

  void _reset() => setState(() { _vehicle = null; _done = false; _error = null;
      _chassisCtrl.clear(); _qtyCtrl.clear(); _notesCtrl.clear(); });

  Future<void> _lookup() async {
    final q = _chassisCtrl.text.trim();
    if (q.length < 4) { setState(() => _error = 'Enter at least 4 chassis digits'); return; }
    setState(() { _loading = true; _error = null; });
    try {
      final v = await ref.read(workflowApiProvider).fuelVehicleLookup(q);
      setState(() { _vehicle = v; _loading = false; });
    } catch (e) {
      setState(() { _error = extractApiError(e); _loading = false; });
    }
  }

  Future<void> _dispense() async {
    final qty = double.tryParse(_qtyCtrl.text.trim());
    if (qty == null || qty <= 0) { setState(() => _error = 'Enter a valid quantity'); return; }
    if (_vehicle == null) return;
    setState(() { _saving = true; _error = null; });
    try {
      await ref.read(workflowApiProvider).dispenseFuel(
        vehicleId: _vehicle!.vehicleId,
        quantityLitres: qty,
        manifestId: widget.manifest.manifestId,
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      );
      setState(() { _done = true; _saving = false; });
    } catch (e) {
      setState(() { _error = extractApiError(e); _saving = false; });
    }
  }

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: const EdgeInsets.all(16),
    child: _done
      ? SuccessSheet(
          title: 'Fuel Dispensed!',
          subtitle: '${_vehicle!.chassisNumber} fuelled successfully.',
          onNext: _reset, nextLabel: 'Dispense Another',
        )
      : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const InfoBanner('Scan chassis to verify vehicle before dispensing fuel.'),
          const SizedBox(height: 16),
          ChassisInput(controller: _chassisCtrl, onSearch: _lookup, loading: _loading),
          if (_vehicle != null) ...[
            const SizedBox(height: 16),
            VehicleCard(vehicle: _vehicle!),
            const SizedBox(height: 14),
            const SectionLabel('Quantity (Litres)'),
            TextField(
              controller: _qtyCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                hintText: 'e.g. 50',
                prefixIcon: Icon(Icons.water_drop_outlined, size: 20),
              ),
            ),
            const SizedBox(height: 12),
            const SectionLabel('Notes'),
            NotesField(controller: _notesCtrl),
          ],
          if (_error != null) ...[const SizedBox(height: 14), ErrorBanner(_error!)],
          if (_vehicle != null) ...[
            const SizedBox(height: 20),
            ConfirmButton(
              label: 'Dispense Fuel', loading: _saving,
              onPressed: _dispense, color: _kAccent,
              icon: Icons.local_gas_station_rounded,
            ),
          ],
        ]),
  );
}
