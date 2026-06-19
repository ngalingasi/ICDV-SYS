import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { dashboardApi } from '../../api';
import type { DashboardData, Manifest } from '../../types';
import { useAuth } from '../../store/authStore';
import ManifestSelector from '../../components/tpfcs/ManifestSelector';

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  { key: 'manifested', label: 'Manifested',  color: 'text-slate-600 dark:text-slate-400',    bg: 'bg-slate-50 dark:bg-slate-500/10',    dot: 'bg-slate-400',    to: '/vehicles?workflow_status=manifested'  },
  { key: 'discharged', label: 'Discharged',  color: 'text-cyan-600 dark:text-cyan-400',      bg: 'bg-cyan-50 dark:bg-cyan-500/10',      dot: 'bg-cyan-500',     to: '/vehicles?workflow_status=discharged'  },
  { key: 'batched',    label: 'Batched',      color: 'text-violet-600 dark:text-violet-400',  bg: 'bg-violet-50 dark:bg-violet-500/10',  dot: 'bg-violet-500',   to: '/vehicles?workflow_status=batched'     },
  { key: 'in_transit', label: 'In Transit',   color: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-50 dark:bg-orange-500/10',  dot: 'bg-orange-500',   to: '/vehicles?workflow_status=in_transit'  },
  { key: 'received',   label: 'Received',     color: 'text-emerald-600 dark:text-emerald-400',bg: 'bg-emerald-50 dark:bg-emerald-500/10',dot: 'bg-emerald-500',  to: '/vehicles?workflow_status=received'    },
];

// ─── Vehicle Status Breakdown (reusable) ──────────────────────────────────────

function VehicleStatusBreakdown({ workflow, total, loading, manifestId }: {
  workflow:   Record<string, number>;
  total:      number;
  loading:    boolean;
  manifestId?: number | null;
}) {
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  // Build vehicle list URL for a given workflow status, scoped to manifest if selected
  const vehicleUrl = (wfStatus: string) => {
    const base = `/vehicles?workflow_status=${wfStatus}`;
    return manifestId ? `${base}&manifest_id=${manifestId}` : base;
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Vehicle Status Breakdown</h2>

      <div className="grid grid-cols-5 gap-2 mb-4">
        {WORKFLOW_STEPS.map((step, i) => {
          const val = workflow[step.key] ?? 0;
          return (
            <Link
              key={step.key}
              to={vehicleUrl(step.key)}
              className={`rounded-lg ${step.bg} border border-gray-100 dark:border-gray-800 p-2.5 text-center
                hover:ring-2 hover:ring-brand-400 hover:ring-offset-1 transition-all cursor-pointer`}
              title={`View ${val} ${step.label} vehicles${manifestId ? ' for this manifest' : ''}`}
            >
              <p className="text-[10px] text-gray-400 font-medium">{i + 1}</p>
              {loading
                ? <div className="mx-auto w-8 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse my-1" />
                : <p className={`text-xl font-bold ${step.color}`}>{val}</p>}
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{step.label}</p>
            </Link>
          );
        })}
      </div>

      <div className="space-y-2">
        {WORKFLOW_STEPS.map(step => {
          const val = workflow[step.key] ?? 0;
          const p   = pct(val);
          return (
            <div key={step.key} className="flex items-center gap-3">
              <Link
                to={vehicleUrl(step.key)}
                className="w-20 text-[11px] text-gray-500 dark:text-gray-400 shrink-0 hover:text-brand-600 dark:hover:text-brand-400 hover:underline"
              >
                {step.label}
              </Link>
              <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                <div className={`h-2 rounded-full ${step.dot} transition-all`} style={{ width: `${p}%` }} />
              </div>
              <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 w-12 text-right">
                {loading ? '—' : `${val} (${p}%)`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Manifest-scoped dashboard panel ─────────────────────────────────────────

function ManifestDashboardPanel({ manifest, icdvScoped }: { manifest: Manifest; icdvScoped: boolean }) {
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dashboardApi.manifest(manifest.manifest_id)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [manifest.manifest_id]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const workflow = data?.workflow ?? {};
  const total    = data?.total_vehicles ?? 0;
  const fuelStock: any[] = data?.fuel_stock ?? [];
  const batches: any[]   = data?.batches ?? [];

  // release_breakdown rows: [{ release_status: 'released'|'collected'|'unreleased', count }]
  const releaseRows: any[] = data?.release_breakdown ?? [];
  const releasedCount   = releaseRows
    .filter(r => r.release_status === 'released' || r.release_status === 'collected')
    .reduce((sum, r) => sum + Number(r.count), 0);
  const unreleasedCount = releaseRows
    .filter(r => r.release_status === 'unreleased')
    .reduce((sum, r) => sum + Number(r.count), 0);
  const openBatchesCount = batches.filter(b => b.status === 'open').length;

  return (
    <div className="space-y-5">

      {/* Manifest header */}
      <div className="rounded-xl border border-brand-200 dark:border-brand-500/30 bg-brand-50 dark:bg-brand-500/5 p-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500 mb-0.5">Selected Manifest</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{manifest.manifest_number}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {(manifest as any).vessel_name ?? '—'} · Arrived {fmtDate(manifest.arrival_date)}
          </p>
        </div>
        <Link to={`/manifests/${manifest.manifest_id}`}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-500/10 transition-colors">
          View manifest →
        </Link>
      </div>

      {/* Summary cards — same 8-card layout as the global dashboard, scoped to this manifest */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Vehicles',   value: total,             color: 'text-gray-800 dark:text-white',           to: `/vehicles?manifest_id=${manifest.manifest_id}` },
          { label: 'Released',         value: releasedCount,     color: 'text-green-600 dark:text-green-400',      to: `/vehicles?manifest_id=${manifest.manifest_id}&release_status=released` },
          { label: 'Open Batches',     value: openBatchesCount,  color: 'text-violet-600 dark:text-violet-400',    to: `/operations/batches?manifest_id=${manifest.manifest_id}` },
          { label: 'Unreleased',       value: unreleasedCount,   color: 'text-red-600 dark:text-red-400',          to: `/vehicles?manifest_id=${manifest.manifest_id}&release_status=unreleased` },
          { label: 'In Transit',       value: workflow.in_transit ?? 0,  color: 'text-orange-600 dark:text-orange-400',  to: `/vehicles?manifest_id=${manifest.manifest_id}&workflow_status=in_transit` },
          { label: 'Received at Yard', value: workflow.received  ?? 0,   color: 'text-emerald-600 dark:text-emerald-400', to: `/vehicles?manifest_id=${manifest.manifest_id}&workflow_status=received` },
          { label: 'Total Batches',    value: batches.length,    color: 'text-indigo-600 dark:text-indigo-400',    to: `/operations/batches?manifest_id=${manifest.manifest_id}` },
          { label: 'Discharged',       value: workflow.discharged ?? 0,  color: 'text-blue-600 dark:text-blue-400',       to: `/vehicles?manifest_id=${manifest.manifest_id}&workflow_status=discharged` },
        ].map(({ label, value, color, to }) => (
          <Link key={label} to={to}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-center hover:ring-2 hover:ring-brand-400 hover:ring-offset-1 transition-all cursor-pointer">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            {loading
              ? <div className="mx-auto mt-1 w-12 h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              : <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>}
          </Link>
        ))}
      </div>

      {/* Vehicle Status Breakdown */}
      <VehicleStatusBreakdown workflow={workflow} total={total} loading={loading} manifestId={manifest.manifest_id} />

      {/* Fuel + Batches row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Fuel Stock */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Fuel Stock</h2>
            <Link to={`/manifests/${manifest.manifest_id}`} className="text-xs text-brand-500 hover:text-brand-600">View →</Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2].map(i=><div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"/>)}</div>
          ) : fuelStock.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No fuel orders yet</p>
          ) : fuelStock.map((s: any) => (
            <div key={s.fuel_type} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold capitalize text-gray-700 dark:text-gray-300">{s.fuel_type}</span>
                <span className={`text-xs font-bold ${parseFloat(s.current_stock) > 10 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {parseFloat(s.current_stock).toFixed(1)}L in stock
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center text-xs text-gray-500">
                <div><p className="font-medium text-gray-800 dark:text-white">{parseFloat(s.total_ordered).toFixed(1)}L</p><p>Ordered</p></div>
                <div><p className="font-medium text-gray-800 dark:text-white">{parseFloat(s.total_dispensed).toFixed(1)}L</p><p>Dispensed</p></div>
                <div><p className="font-medium text-gray-800 dark:text-white">{parseFloat(s.current_stock).toFixed(1)}L</p><p>Remaining</p></div>
              </div>
            </div>
          ))}
        </div>

        {/* Batches */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Batches ({batches.length})</h2>
            <Link to="/operations/batches" className="text-xs text-brand-500 hover:text-brand-600">View all →</Link>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i=><div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"/>)}</div>
          ) : batches.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No batches yet</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-64 overflow-y-auto">
              {batches.map((b: any) => (
                <div key={b.batch_id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{b.batch_number}</p>
                    <p className="text-xs text-gray-400">{b.vehicle_count} vehicles</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize
                    ${b.status === 'open'      ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400' :
                      b.status === 'closed'    ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' :
                                                 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'}`}>
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Global overview dashboard (no manifest selected) ─────────────────────────

function GlobalDashboard() {
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    dashboardApi.get()
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load dashboard data. Please refresh the page.'))
      .finally(() => setLoading(false));
  }, []);

  const s = data?.stats;
  const totalForPct = s?.total_vehicles || 1;

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/5 p-5 text-center">
        <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); dashboardApi.get().then(r => setData(r.data)).catch(() => setError('Failed to load dashboard data. Please refresh the page.')).finally(() => setLoading(false)); }}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }
  const workflow: Record<string, number> = {
    manifested: s?.manifested_count ?? 0,
    discharged: s?.discharged_count ?? 0,
    batched:    s?.batched_count    ?? 0,
    in_transit: s?.in_transit_count ?? 0,
    received:   s?.received_count   ?? 0,
  };
  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const vesselStatusColors: Record<string, string> = {
    active:         'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
    inactive:       'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
    decommissioned: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };

  const StatCard = ({ label, value, color, to, icon }: { label: string; value?: number; color: string; to: string; icon: React.ReactNode }) => (
    <Link to={to} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition-shadow flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`text-3xl font-bold mt-1 ${color}`}>
          {loading ? <span className="inline-block w-10 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /> : (value ?? 0)}
        </p>
      </div>
      <div className={`p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 ${color}`}>{icon}</div>
    </Link>
  );

  const I = {
    vessel:   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v8m0 4l4-4m-4 4l-4-4M3 20h18" /></svg>,
    manifest: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    car:      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="2" y="10" width="20" height="8" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M5 10V8a4 4 0 018 0v2M7 18v1m10-1v1" /></svg>,
    check:    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    batch:    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    truck:    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
  };

  return (
    <div className="space-y-5">
      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label="Total Vessels"     value={s?.total_vessels}       color="text-brand-600 dark:text-brand-400"    to="/vessels"                             icon={I.vessel} />
        <StatCard label="Total Manifests"   value={s?.total_manifests}     color="text-indigo-600 dark:text-indigo-400"  to="/manifests"                           icon={I.manifest} />
        <StatCard label="Total Vehicles"    value={s?.total_vehicles}      color="text-gray-800 dark:text-white"         to="/vehicles"                            icon={I.car} />
        <StatCard label="Released"          value={s?.released_vehicles}   color="text-green-600 dark:text-green-400"    to="/vehicles?release_status=released"    icon={I.check} />
        <StatCard label="Open Batches"      value={s?.open_batches}        color="text-violet-600 dark:text-violet-400"  to="/operations/batches"                  icon={I.batch} />
        <StatCard label="In Transit"        value={s?.in_transit_count}    color="text-orange-600 dark:text-orange-400"  to="/operations/transfer"                 icon={I.truck} />
        <StatCard label="Received at Yard"  value={s?.received_count}      color="text-emerald-600 dark:text-emerald-400" to="/operations/receive"                icon={I.check} />
        <StatCard label="Unreleased"        value={s?.unreleased_vehicles} color="text-red-600 dark:text-red-400"        to="/vehicles?release_status=unreleased"  icon={I.car} />
      </div>

      {/* Vehicle Status Breakdown */}
      <VehicleStatusBreakdown workflow={workflow} total={totalForPct} loading={loading} />

      {/* Recent Vessels + Operations Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Recent Vessels */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Vessels</h2>
            <Link to="/vessels" className="text-xs text-brand-500 hover:text-brand-600">View all →</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-4 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                </div>
              ))
            ) : !data?.recent_vessels?.length ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400">No vessels yet</div>
            ) : data.recent_vessels.map((v: any) => (
              <Link key={v.vessel_id} to={`/vessels/${v.vessel_id}`}
                className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{v.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {v.vessel_type ?? 'Unknown type'}
                    {v.country_of_origin ? ` · ${v.country_of_origin}` : ''}
                    {v.latest_arrival_date ? ` · ${fmtDate(v.latest_arrival_date)}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{v.manifest_count ?? 0} manifests · {v.vehicle_count ?? 0} vehicles</p>
                </div>
                <span className={`text-xs font-medium capitalize ml-3 px-2 py-0.5 rounded-full ${vesselStatusColors[v.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {v.status}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-2.5">
            {[
              { label: 'Add Vessel',        to: '/vessels/new',          color: 'bg-brand-500 hover:bg-brand-600 text-white' },
              { label: 'Add Manifest',      to: '/manifests/new',        color: 'bg-indigo-500 hover:bg-indigo-600 text-white' },
              { label: 'Discharge Vehicle', to: '/operations/discharge', color: 'bg-cyan-500 hover:bg-cyan-600 text-white' },
              { label: 'Batch Vehicle',     to: '/operations/batch',     color: 'bg-violet-500 hover:bg-violet-600 text-white' },
              { label: 'TPA Transfer',      to: '/operations/transfer',  color: 'bg-orange-500 hover:bg-orange-600 text-white' },
              { label: 'Yard Receive',      to: '/operations/receive',   color: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
              { label: 'Fuel Dispense',     to: '/operations/fuel',      color: 'bg-amber-500 hover:bg-amber-600 text-white' },
              { label: 'Search Chassis',    to: '/operations/search',    color: 'bg-gray-600 hover:bg-gray-700 text-white' },
            ].map(a => (
              <Link key={a.label} to={a.to}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${a.color}`}>
                {a.label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function IcdvDashboard() {
  const { user, isSuperAdmin, isSystemAdmin } = useAuth();
  const isCrossTenant = isSuperAdmin || isSystemAdmin;
  const [selectedManifest, setSelectedManifest] = useState<Manifest | null>(null);

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header + manifest selector */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            Welcome back, {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {user?.icdv_name && `${user.icdv_name} · `}ICDV Vehicle Import &amp; Delivery Operations
          </p>
        </div>

        {/* Manifest selector — shown to all users */}
        <div className="flex items-center gap-2 flex-wrap mt-1 sm:mt-0">
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap flex-shrink-0">Filter by manifest:</span>
          <div className="w-64 sm:w-80">
            <ManifestSelector
              value={selectedManifest}
              onChange={setSelectedManifest}
              icdvId={isCrossTenant ? null : (user?.icdv_id ?? null)}
              statusFilter="active"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {selectedManifest
        ? <ManifestDashboardPanel manifest={selectedManifest} icdvScoped={!isCrossTenant} />
        : <GlobalDashboard />
      }
    </div>
  );
}
