import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/workflow_api.dart';
import '../../core/models/models.dart';
import '../../core/providers/theme_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/widgets.dart';

// ── Search screen brand colors (steel blue) ───────────────────────────────────
const _kGradStart = Color(0xFFCFDEF7);
const _kGradEnd   = Color(0xFFADC6F0);
const _kSymbol    = Color(0xFF6AAEF5);

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});
  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _ctrl     = TextEditingController();
  final _focusNode= FocusNode();
  List<Vehicle>          _results  = [];
  Vehicle?               _selected;
  List<OperationHistory> _history  = [];
  bool  _loading   = false;
  bool  _searching = false;
  String? _error;

  Future<void> _search() async {
    final q = _ctrl.text.trim();
    if (q.length < 3) { setState(() => _error = 'Enter at least 3 characters'); return; }
    _focusNode.unfocus();
    setState(() { _loading = true; _error = null; _selected = null; _results = []; _history = []; });
    try {
      final res = await ref.read(workflowApiProvider).search(q);
      setState(() {
        _results = res;
        if (res.length == 1) _selectVehicle(res.first);
      });
    } catch (e) {
      setState(() => _error = 'Search failed: ${e.toString().split(':').last.trim()}');
    } finally { setState(() { _loading = false; }); }
  }

  Future<void> _selectVehicle(Vehicle v) async {
    setState(() { _selected = v; _history = []; _searching = true; });
    try {
      final h = await ref.read(workflowApiProvider).getVehicleHistory(v.vehicleId);
      if (mounted) setState(() => _history = h);
    } catch (_) {}
    if (mounted) setState(() => _searching = false);
  }

  void _clear() {
    _ctrl.clear();
    setState(() { _results = []; _selected = null; _history = []; _error = null; });
  }

  @override
  void dispose() { _ctrl.dispose(); _focusNode.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final dark = isDarkMode(context);
    final c    = AppColors(dark);

    return Scaffold(
      backgroundColor: c.bg,
      body: Column(children: [
        // ── Branded hero header ──────────────────────────────────────────
        _SearchHeader(
          dark: dark, c: c,
          ctrl: _ctrl, focusNode: _focusNode,
          loading: _loading,
          onSearch: _search,
          onClear: _clear,
          onBack: () => Navigator.of(context).maybePop(),
          hasResults: _selected != null || _results.isNotEmpty,
        ),

        // ── Body ─────────────────────────────────────────────────────────
        if (_error != null)
          Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: ErrorBanner(_error!)),

        Expanded(child: _buildBody(c, dark)),
      ]),
    );
  }

  Widget _buildBody(AppColors c, bool dark) {
    // Loading
    if (_loading) return Center(child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        CircularProgressIndicator(color: c.accent, strokeWidth: 2.5),
        const SizedBox(height: 16),
        Text('Searching vehicles…', style: TextStyle(color: c.textMuted, fontSize: 13)),
      ],
    ));

    // Multiple results list
    if (_results.length > 1 && _selected == null) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Text('${_results.length} results found',
            style: TextStyle(color: c.textMuted, fontSize: 12, fontWeight: FontWeight.w600)),
        ),
        Expanded(child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          itemCount: _results.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) => _ResultTile(v: _results[i], c: c, dark: dark,
              onTap: () => _selectVehicle(_results[i])),
        )),
      ]);
    }

    // Vehicle detail + timeline
    if (_selected != null) {
      return SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (_results.length > 1) ...[
            GestureDetector(
              onTap: () => setState(() => _selected = null),
              child: Row(children: [
                Icon(Icons.arrow_back_ios_rounded, color: c.accent, size: 14),
                const SizedBox(width: 4),
                Text('All results', style: TextStyle(
                  color: c.accent, fontSize: 13, fontWeight: FontWeight.w700)),
              ]),
            ),
            const SizedBox(height: 12),
          ],

          // Vehicle detail card
          _VehicleDetailCard(vehicle: _selected!, c: c, dark: dark),
          const SizedBox(height: 24),

          // Timeline header
          Row(children: [
            Container(width: 3, height: 18,
              decoration: BoxDecoration(color: c.accent, borderRadius: BorderRadius.circular(2))),
            const SizedBox(width: 10),
            Text('Operation Timeline', style: TextStyle(
              color: c.textPrimary, fontSize: 16, fontWeight: FontWeight.w800)),
          ]),
          const SizedBox(height: 16),

          if (_searching)
            Center(child: Padding(padding: const EdgeInsets.all(32),
              child: CircularProgressIndicator(color: c.accent, strokeWidth: 2))),

          if (!_searching && _history.isEmpty)
            _EmptyTimeline(c: c),

          if (!_searching && _history.isNotEmpty)
            _Timeline(history: _history, c: c, dark: dark),

          const SizedBox(height: 24),
        ]),
      );
    }

    // Empty state
    return _EmptyState(c: c, dark: dark);
  }
}

// ── Branded search header ─────────────────────────────────────────────────────
class _SearchHeader extends StatelessWidget {
  final bool dark, loading, hasResults;
  final AppColors c;
  final TextEditingController ctrl;
  final FocusNode focusNode;
  final VoidCallback onSearch, onClear, onBack;

  const _SearchHeader({
    required this.dark, required this.c, required this.ctrl,
    required this.focusNode, required this.loading,
    required this.onSearch, required this.onClear,
    required this.onBack, required this.hasResults,
  });

  @override
  Widget build(BuildContext context) {
    final gradient = dark
        ? LinearGradient(colors: [_kGradStart.withOpacity(0.35), _kGradEnd.withOpacity(0.20)],
            begin: Alignment.topLeft, end: Alignment.bottomRight)
        : LinearGradient(colors: [_kGradStart, _kGradEnd],
            begin: Alignment.topLeft, end: Alignment.bottomRight);
    final labelColor = dark ? Colors.white : AppColors.navy;
    final backColor  = dark ? Colors.white.withOpacity(0.8) : AppColors.navy.withOpacity(0.8);

    return Container(
      decoration: BoxDecoration(
        gradient: gradient,
        border: dark ? Border(bottom: BorderSide(color: _kGradStart.withOpacity(0.35))) : null,
      ),
      child: SafeArea(
        bottom: false,
        child: ClipRect(child: Stack(children: [
          // Watermark
          Positioned(right: -20, top: -10,
            child: Icon(Icons.manage_search_rounded, size: 130,
              color: _kSymbol.withOpacity(dark ? 0.20 : 0.15))),

          Padding(
            padding: const EdgeInsets.fromLTRB(8, 4, 16, 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Back button
              IconButton(
                icon: Icon(Icons.arrow_back_rounded, color: backColor),
                onPressed: onBack),

              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    // Left: search icon chip
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        color: dark ? _kSymbol.withOpacity(0.25) : Colors.white.withOpacity(0.5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: dark
                            ? _kSymbol.withOpacity(0.4)
                            : AppColors.navy.withOpacity(0.15)),
                      ),
                      child: Icon(Icons.search_rounded,
                        color: dark ? _kSymbol : AppColors.navy, size: 22),
                    ),
                    const Spacer(),
                    // Right: brand logo chip
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: dark ? Colors.white.withOpacity(0.12) : Colors.white.withOpacity(0.6),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: dark
                            ? Colors.white.withOpacity(0.2)
                            : AppColors.navy.withOpacity(0.15)),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        ClipOval(child: Image.asset('assets/images/logo.png',
                          width: 20, height: 20, fit: BoxFit.cover)),
                        const SizedBox(width: 7),
                        Text('TPFCS', style: TextStyle(
                          color: dark ? Colors.white : AppColors.navy,
                          fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.5)),
                      ]),
                    ),
                  ]),
                  const SizedBox(height: 10),
                  Text('Chassis Search', style: TextStyle(
                    color: labelColor, fontSize: 22,
                    fontWeight: FontWeight.w900, letterSpacing: -0.3)),
                  const SizedBox(height: 2),
                  Text('Track any vehicle in the system', style: TextStyle(
                    color: labelColor.withOpacity(0.6), fontSize: 12)),
                  const SizedBox(height: 14),

                  // Search input
                  Row(children: [
                    Expanded(
                      child: Container(
                        height: 48,
                        decoration: BoxDecoration(
                          color: dark ? Colors.white.withOpacity(0.12) : Colors.white.withOpacity(0.75),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: dark
                              ? Colors.white.withOpacity(0.2)
                              : AppColors.navy.withOpacity(0.15)),
                        ),
                        child: TextField(
                          controller: ctrl,
                          focusNode: focusNode,
                          textCapitalization: TextCapitalization.characters,
                          textInputAction: TextInputAction.search,
                          inputFormatters: [UpperCaseFormatter()],
                          style: TextStyle(
                            fontFamily: 'monospace', fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: dark ? Colors.white : AppColors.navy,
                            letterSpacing: 1),
                          decoration: InputDecoration(
                            hintText: 'Enter chassis or last 4 digits…',
                            hintStyle: TextStyle(
                              color: dark ? Colors.white.withOpacity(0.4) : AppColors.navy.withOpacity(0.4),
                              fontSize: 13, fontWeight: FontWeight.w400,
                              letterSpacing: 0, fontFamily: null),
                            prefixIcon: Icon(Icons.search_rounded,
                              color: dark ? Colors.white.withOpacity(0.5) : AppColors.navy.withOpacity(0.5),
                              size: 18),
                            suffixIcon: ctrl.text.isNotEmpty
                                ? GestureDetector(onTap: onClear,
                                    child: Icon(Icons.close_rounded,
                                      color: dark ? Colors.white.withOpacity(0.5) : AppColors.navy.withOpacity(0.5),
                                      size: 18))
                                : null,
                            filled: false,
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          onSubmitted: (_) => onSearch(),
                          onChanged: (_) {},
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(
                      width: 56, height: 48,
                      child: ElevatedButton(
                        onPressed: loading ? null : onSearch,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: dark ? _kSymbol : AppColors.navy,
                          foregroundColor: Colors.white,
                          padding: EdgeInsets.zero,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          elevation: 0,
                        ),
                        child: loading
                            ? const SizedBox(width: 18, height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.arrow_forward_rounded, size: 20, color: Colors.white),
                      ),
                    ),
                  ]),
                ]),
              ),
            ]),
          ),
        ])),
      ),
    );
  }
}

// ── Result tile (multiple results) ────────────────────────────────────────────
class _ResultTile extends StatelessWidget {
  final Vehicle v; final AppColors c; final bool dark; final VoidCallback onTap;
  const _ResultTile({required this.v, required this.c, required this.dark, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface0, borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.border)),
      child: Row(children: [
        Container(width: 44, height: 44,
          decoration: BoxDecoration(
            color: c.accentDim, borderRadius: BorderRadius.circular(12)),
          child: Icon(Icons.directions_car_rounded, color: c.accent, size: 22)),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(v.chassisNumber, style: TextStyle(
            fontFamily: 'monospace', fontWeight: FontWeight.w900,
            fontSize: 15, color: c.accent, letterSpacing: 1)),
          if (v.vehicleTitle.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(v.vehicleTitle, style: TextStyle(color: c.textSecond, fontSize: 12)),
          ],
          if (v.vesselName != null)
            Text(v.vesselName!, style: TextStyle(color: c.textMuted, fontSize: 11)),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          StatusBadge(v.workflowStatus),
          const SizedBox(height: 6),
          Icon(Icons.chevron_right_rounded, color: c.textMuted, size: 18),
        ]),
      ]),
    ),
  );
}

// ── Vehicle detail card ───────────────────────────────────────────────────────
class _VehicleDetailCard extends StatelessWidget {
  final Vehicle vehicle; final AppColors c; final bool dark;
  const _VehicleDetailCard({required this.vehicle, required this.c, required this.dark});

  @override
  Widget build(BuildContext context) {
    final gradient = dark
        ? LinearGradient(colors: [_kGradStart.withOpacity(0.30), _kGradEnd.withOpacity(0.15)],
            begin: Alignment.topLeft, end: Alignment.bottomRight)
        : LinearGradient(colors: [_kGradStart, _kGradEnd],
            begin: Alignment.topLeft, end: Alignment.bottomRight);

    return Container(
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _kSymbol.withOpacity(dark ? 0.4 : 0.3)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(children: [
          Positioned(right: -16, top: -16,
            child: Icon(Icons.directions_car_rounded, size: 100,
              color: _kSymbol.withOpacity(dark ? 0.18 : 0.13))),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Chassis + status row
              Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('CHASSIS', style: TextStyle(
                    fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 2,
                    color: dark ? Colors.white.withOpacity(0.5) : AppColors.navy.withOpacity(0.5))),
                  const SizedBox(height: 2),
                  Text(vehicle.chassisNumber, style: TextStyle(
                    fontFamily: 'monospace', fontSize: 20, fontWeight: FontWeight.w900,
                    letterSpacing: 1.5,
                    color: dark ? Colors.white : AppColors.navy)),
                ])),
                StatusBadge(vehicle.workflowStatus),
              ]),

              if (vehicle.vehicleTitle.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(vehicle.vehicleTitle, style: TextStyle(
                  color: dark ? Colors.white.withOpacity(0.7) : AppColors.navy.withOpacity(0.7),
                  fontSize: 13, fontWeight: FontWeight.w600)),
              ],

              const SizedBox(height: 14),
              Divider(color: dark ? Colors.white.withOpacity(0.15) : AppColors.navy.withOpacity(0.15)),
              const SizedBox(height: 12),

              // Info grid
              Wrap(runSpacing: 12, spacing: 0, children: [
                if (vehicle.vesselName != null)
                  _InfoRow('Vessel', vehicle.vesselName!, dark),
                if (vehicle.manifestNumber != null)
                  _InfoRow('Manifest', vehicle.manifestNumber!, dark),
                if (vehicle.customerName != null)
                  _InfoRow('Customer', vehicle.customerName!, dark),
                _InfoRow('Location', vehicle.currentLocation.replaceAll('_', ' '), dark),
                if (vehicle.icdvName != null)
                  _InfoRow('ICDV', vehicle.icdvName!, dark),
                if (vehicle.batchNumber != null)
                  _InfoRow('Batch', vehicle.batchNumber!, dark),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label, value; final bool dark;
  const _InfoRow(this.label, this.value, this.dark);
  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: Row(children: [
      SizedBox(width: 76, child: Text(label, style: TextStyle(
        fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5,
        color: dark ? Colors.white.withOpacity(0.45) : AppColors.navy.withOpacity(0.5)))),
      Expanded(child: Text(value, style: TextStyle(
        fontSize: 13, fontWeight: FontWeight.w700,
        color: dark ? Colors.white.withOpacity(0.9) : AppColors.navy))),
    ]),
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────
class _Timeline extends StatelessWidget {
  final List<OperationHistory> history;
  final AppColors c; final bool dark;
  const _Timeline({required this.history, required this.c, required this.dark});

  @override
  Widget build(BuildContext context) => Column(
    children: List.generate(history.length, (i) {
      final h       = history[i];
      final isLast  = i == history.length - 1;
      final isFirst = i == 0;
      return _TimelineItem(
        h: h, c: c, dark: dark,
        isFirst: isFirst, isLast: isLast,
      );
    }),
  );
}

class _TimelineItem extends StatelessWidget {
  final OperationHistory h;
  final AppColors c; final bool dark;
  final bool isFirst, isLast;
  const _TimelineItem({required this.h, required this.c, required this.dark,
      required this.isFirst, required this.isLast});

  String _formatDateTime(String raw) {
    try {
      final dt = DateTime.parse(raw).toLocal();
      final date = '${dt.year}-${dt.month.toString().padLeft(2,'0')}-${dt.day.toString().padLeft(2,'0')}';
      final hour = dt.hour.toString().padLeft(2, '0');
      final min  = dt.minute.toString().padLeft(2, '0');
      return '$date  $hour:$min';
    } catch (_) {
      return raw.replaceFirst('T', '  ').substring(0, raw.length > 16 ? 16 : raw.length);
    }
  }

  Color get _dotColor {
    switch (h.operationType.toLowerCase()) {
      case 'manifest':   return AppBrand.info;
      case 'discharge':  return const Color(0xFF6AAEF5);
      case 'batch':      return AppBrand.violet;
      case 'transfer':   return AppBrand.orange;
      case 'receive':    return AppBrand.success;
      default:           return c.textMuted;
    }
  }

  IconData get _opIcon {
    switch (h.operationType.toLowerCase()) {
      case 'manifest':   return Icons.description_outlined;
      case 'discharge':  return Icons.anchor_rounded;
      case 'batch':      return Icons.layers_rounded;
      case 'transfer':   return Icons.local_shipping_rounded;
      case 'receive':    return Icons.warehouse_rounded;
      default:           return Icons.circle_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final dot = _dotColor;
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // ── Timeline spine ─────────────────────────────────────────────
        SizedBox(width: 48, child: Column(children: [
          // Line above dot
          if (!isFirst)
            Expanded(flex: 1, child: Center(child: Container(
              width: 2, color: c.border))),
          // Dot
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: dot.withOpacity(dark ? 0.2 : 0.12),
              border: Border.all(color: dot, width: 2),
            ),
            child: Icon(_opIcon, size: 16, color: dot),
          ),
          // Line below dot
          if (!isLast)
            Expanded(flex: 3, child: Center(child: Container(
              width: 2, color: c.border))),
        ])),

        const SizedBox(width: 12),

        // ── Content card ───────────────────────────────────────────────
        Expanded(child: Padding(
          padding: EdgeInsets.only(bottom: isLast ? 0 : 14, top: isFirst ? 0 : 0),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: c.surface0,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: c.border),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Op type + status badge
              Row(children: [
                Expanded(child: Text(
                  h.operationType.replaceAll('_', ' ').toUpperCase(),
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11,
                    color: dot, letterSpacing: 1))),
                if (h.toStatus != null) StatusBadge(h.toStatus!),
              ]),

              // Location flow
              if (h.fromLocation != null || h.toLocation != null) ...[
                const SizedBox(height: 8),
                Row(children: [
                  if (h.fromLocation != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: c.surface1, borderRadius: BorderRadius.circular(6)),
                      child: Text(h.fromLocation!.replaceAll('_', ' '),
                        style: TextStyle(color: c.textSecond, fontSize: 11, fontWeight: FontWeight.w600))),
                  ],
                  if (h.fromLocation != null && h.toLocation != null) ...[
                    Padding(padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: Icon(Icons.arrow_forward_rounded, size: 14, color: c.textMuted)),
                  ],
                  if (h.toLocation != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: dot.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: dot.withOpacity(0.3))),
                      child: Text(h.toLocation!.replaceAll('_', ' '),
                        style: TextStyle(color: dot, fontSize: 11, fontWeight: FontWeight.w700))),
                ]),
              ],

              // Notes
              if (h.notes != null && h.notes!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(h.notes!, style: TextStyle(color: c.textMuted, fontSize: 12,
                  fontStyle: FontStyle.italic)),
              ],

              const SizedBox(height: 8),
              // Operator + date
              Row(children: [
                Icon(Icons.person_outline_rounded, size: 12, color: c.textMuted),
                const SizedBox(width: 4),
                Expanded(child: Text(h.operatorName ?? 'System',
                  style: TextStyle(color: c.textMuted, fontSize: 11))),
                Icon(Icons.access_time_rounded, size: 12, color: c.textMuted),
                const SizedBox(width: 4),
                Text(_formatDateTime(h.performedAt),
                  style: TextStyle(color: c.textMuted, fontSize: 11)),
              ]),
            ]),
          ),
        )),
      ]),
    );
  }
}

// ── Empty timeline ────────────────────────────────────────────────────────────
class _EmptyTimeline extends StatelessWidget {
  final AppColors c;
  const _EmptyTimeline({required this.c});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(24),
    decoration: BoxDecoration(color: c.surface0, borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border)),
    child: Column(children: [
      Icon(Icons.history_toggle_off_rounded, size: 36, color: c.textMuted),
      const SizedBox(height: 10),
      Text('No operations recorded yet', style: TextStyle(
        color: c.textSecond, fontSize: 14, fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      Text('Operations will appear here once the vehicle is processed.',
        textAlign: TextAlign.center,
        style: TextStyle(color: c.textMuted, fontSize: 12)),
    ]),
  );
}

// ── Empty search state ────────────────────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  final AppColors c; final bool dark;
  const _EmptyState({required this.c, required this.dark});
  @override
  Widget build(BuildContext context) => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Container(
        width: 80, height: 80,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: dark
                ? [_kGradStart.withOpacity(0.3), _kGradEnd.withOpacity(0.15)]
                : [_kGradStart, _kGradEnd],
            begin: Alignment.topLeft, end: Alignment.bottomRight),
          shape: BoxShape.circle,
          border: Border.all(color: _kSymbol.withOpacity(0.4), width: 2),
        ),
        child: Icon(Icons.search_rounded, size: 36,
          color: dark ? _kSymbol : AppColors.navy),
      ),
      const SizedBox(height: 20),
      Text('Search for a Vehicle', style: TextStyle(
        color: c.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      Text('Enter a chassis number or the last\n4+ digits to track any vehicle.',
        textAlign: TextAlign.center,
        style: TextStyle(color: c.textMuted, fontSize: 13, height: 1.5)),
      const SizedBox(height: 28),
      // Workflow steps hint
      _WorkflowHint(c: c),
    ]),
  ));
}

class _WorkflowHint extends StatelessWidget {
  final AppColors c;
  const _WorkflowHint({required this.c});

  static const _steps = [
    ('Manifested', Icons.description_outlined,    Color(0xFF6AAEF5)),
    ('Discharged', Icons.anchor_rounded,          Color(0xFF6AAEF5)),
    ('Batched',    Icons.layers_rounded,           AppBrand.violet),
    ('In Transit', Icons.local_shipping_rounded,  AppBrand.orange),
    ('Received',   Icons.warehouse_rounded,        AppBrand.success),
  ];

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: c.surface0, borderRadius: BorderRadius.circular(16),
      border: Border.all(color: c.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('VEHICLE WORKFLOW', style: TextStyle(
        color: c.textMuted, fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 2)),
      const SizedBox(height: 12),
      Row(children: List.generate(_steps.length * 2 - 1, (i) {
        if (i.isOdd) return Expanded(child: Container(height: 1.5, color: c.border));
        final step = _steps[i ~/ 2];
        return Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 32, height: 32,
            decoration: BoxDecoration(shape: BoxShape.circle,
              color: step.$3.withOpacity(0.15),
              border: Border.all(color: step.$3.withOpacity(0.5))),
            child: Icon(step.$2, size: 15, color: step.$3)),
          const SizedBox(height: 4),
          Text(step.$1, style: TextStyle(color: c.textMuted, fontSize: 8,
            fontWeight: FontWeight.w600)),
        ]);
      })),
    ]),
  );
}
