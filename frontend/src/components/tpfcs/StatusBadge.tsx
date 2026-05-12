const palettes: Record<string, string> = {
  // ── vessel ────────────────────────────────────────────────────────────────
  expected:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300',
  arrived:     'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  processing:  'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  departed:    'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400',
  // ── manifest / generic ────────────────────────────────────────────────────
  pending:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300',
  active:      'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  // ── vehicle release ───────────────────────────────────────────────────────
  unreleased:  'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  released:    'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  collected:   'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  on_hold:     'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  // ── operational ───────────────────────────────────────────────────────────
  in_operation: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  ready:        'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  // ── delivery ──────────────────────────────────────────────────────────────
  scheduled:   'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  delivered:   'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  failed:      'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  // ── universal ─────────────────────────────────────────────────────────────
  completed:   'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  cancelled:   'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400',
  // ── driver ────────────────────────────────────────────────────────────────
  inactive:    'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400',
  suspended:   'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  // ── workflow statuses (5-step flow) ───────────────────────────────────────
  manifested:  'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
  discharged:  'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  batched:     'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  in_transit:  'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  received:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  // ── vehicle locations ─────────────────────────────────────────────────────
  vessel:           'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  holding_ground:   'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  tpa_gate:         'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  tpa_gate_to_yard: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  icdv_yard:        'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  // ── batch statuses ────────────────────────────────────────────────────────
  open:        'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  closed:      'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400',
  transferred: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
};

export default function StatusBadge({ status, size }: { status: string | null | undefined; size?: string }) {
  const cls = (status ? palettes[status] : undefined) ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      {(status ?? '—').replace(/_/g, ' ')}
    </span>
  );
}
