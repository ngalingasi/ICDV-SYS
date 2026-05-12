import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { dashboardApi } from '../../api';
import type { DashboardData } from '../../types';
import { useAuth } from '../../store/authStore';

const WORKFLOW_STEPS = [
  { key: 'manifested_count', label: 'Manifested',  color: 'text-slate-600 dark:text-slate-400',   bg: 'bg-slate-50 dark:bg-slate-500/10',    to: '/operations/search',    dot: 'bg-slate-400' },
  { key: 'discharged_count', label: 'Discharged',  color: 'text-cyan-600 dark:text-cyan-400',     bg: 'bg-cyan-50 dark:bg-cyan-500/10',      to: '/operations/discharge', dot: 'bg-cyan-500' },
  { key: 'batched_count',    label: 'Batched',      color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10',  to: '/operations/batches',   dot: 'bg-violet-500' },
  { key: 'in_transit_count', label: 'In Transit',   color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10',  to: '/operations/transfer',  dot: 'bg-orange-500' },
  { key: 'received_count',   label: 'Received',     color: 'text-emerald-600 dark:text-emerald-400',bg: 'bg-emerald-50 dark:bg-emerald-500/10',to: '/operations/receive',  dot: 'bg-emerald-500' },
];

export default function IcdvDashboard() {
  const { user } = useAuth();
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.get().then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  const s = data?.stats;

  // ── Stat card ──────────────────────────────────────────────────────────────
  const StatCard = ({
    label, value, color, to, icon,
  }: { label: string; value?: number; color: string; to: string; icon: React.ReactNode }) => (
    <Link to={to}
      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition-shadow flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`text-3xl font-bold mt-1 ${color}`}>
          {loading
            ? <span className="inline-block w-10 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            : (value ?? 0)}
        </p>
      </div>
      <div className={`p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 ${color}`}>{icon}</div>
    </Link>
  );

  // ── Icons ──────────────────────────────────────────────────────────────────
  const VesselIcon   = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v8m0 4l4-4m-4 4l-4-4M3 20h18" /></svg>;
  const ManifestIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
  const CarIcon      = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="2" y="10" width="20" height="8" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M5 10V8a4 4 0 018 0v2M7 18v1m10-1v1" /></svg>;
  const CheckIcon    = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  const BatchIcon    = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
  const TruckIcon    = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>;

  const vesselStatusColors: Record<string, string> = {
    active:         'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
    inactive:       'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
    decommissioned: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  // Workflow funnel bar width
  const totalForPct = s?.total_vehicles || 1;
  const pct = (n?: number) => `${Math.round(((n ?? 0) / totalForPct) * 100)}%`;

  return (
    <div className="p-4 sm:p-6 space-y-6">

      {/* ── Welcome ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">
          Welcome back, {user?.full_name?.split(' ')[0]}
        </h1>
        {user?.icdv_name && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {user.icdv_name} · {user.role?.replace('_', ' ')}
          </p>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          ICDV Vehicle Import &amp; Delivery — Port Operations Overview
        </p>
      </div>

      {/* ── Overview stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label="Total Vessels"     value={s?.total_vessels}      color="text-brand-600 dark:text-brand-400"   to="/vessels"                           icon={<VesselIcon />} />
        <StatCard label="Total Manifests"   value={s?.total_manifests}    color="text-indigo-600 dark:text-indigo-400" to="/manifests"                         icon={<ManifestIcon />} />
        <StatCard label="Total Vehicles"    value={s?.total_vehicles}     color="text-gray-800 dark:text-white"        to="/vehicles"                          icon={<CarIcon />} />
        <StatCard label="Released"          value={s?.released_vehicles}  color="text-green-600 dark:text-green-400"   to="/vehicles?release_status=released"  icon={<CheckIcon />} />
        <StatCard label="Open Batches"      value={s?.open_batches}       color="text-violet-600 dark:text-violet-400" to="/operations/batches"                icon={<BatchIcon />} />
        <StatCard label="In Transit"        value={s?.in_transit_count}   color="text-orange-600 dark:text-orange-400" to="/operations/transfer"               icon={<TruckIcon />} />
        <StatCard label="Received at Yard"  value={s?.received_count}     color="text-emerald-600 dark:text-emerald-400" to="/operations/receive"             icon={<CheckIcon />} />
        <StatCard label="Unreleased"        value={s?.unreleased_vehicles} color="text-red-600 dark:text-red-400"      to="/vehicles?release_status=unreleased" icon={<CarIcon />} />
      </div>

      {/* ── Workflow funnel ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Operations Flow
          </h2>
          <Link to="/operations/search" className="text-xs text-brand-500 hover:text-brand-600">
            Search chassis →
          </Link>
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-5 gap-2 mb-5">
          {WORKFLOW_STEPS.map((step, i) => {
            const val = s?.[step.key as keyof typeof s] as number ?? 0;
            return (
              <Link key={step.key} to={step.to}
                className={`rounded-lg ${step.bg} border border-gray-100 dark:border-gray-800 p-3 text-center hover:shadow-sm transition-shadow`}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className={`text-[10px] font-bold text-gray-400 dark:text-gray-500`}>{i + 1}</span>
                </div>
                <p className={`text-2xl font-bold ${step.color}`}>
                  {loading
                    ? <span className="inline-block w-8 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    : val}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{step.label}</p>
              </Link>
            );
          })}
        </div>

        {/* Flow arrows + progress bars */}
        <div className="space-y-2">
          {WORKFLOW_STEPS.map(step => {
            const val = s?.[step.key as keyof typeof s] as number ?? 0;
            const width = pct(val);
            return (
              <div key={step.key} className="flex items-center gap-3">
                <span className="w-20 text-[11px] text-gray-500 dark:text-gray-400 font-medium shrink-0">{step.label}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className={`h-2 rounded-full ${step.dot}`} style={{ width }} />
                </div>
                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 w-8 text-right">
                  {loading ? '—' : val}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Recent Vessels ────────────────────────────────────────────── */}
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
            ) : (
              data.recent_vessels.map((v: any) => (
                <Link key={v.vessel_id} to={`/vessels/${v.vessel_id}`}
                  className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{v.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {v.vessel_type ?? 'Unknown type'}
                      {v.country_of_origin ? ` · ${v.country_of_origin}` : ''}
                      {v.latest_arrival_date ? ` · ${fmtDate(v.latest_arrival_date)}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {v.manifest_count ?? 0} manifests · {v.vehicle_count ?? 0} vehicles
                    </p>
                  </div>
                  <span className={`text-xs font-medium capitalize ml-3 px-2 py-0.5 rounded-full ${vesselStatusColors[v.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {v.status}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* ── Vehicle Workflow Status Breakdown ────────────────────────── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Vehicle Status Breakdown</h2>
            <Link to="/vehicles" className="text-xs text-brand-500 hover:text-brand-600">View all →</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-4 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-1" />
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full w-full mt-2" />
                </div>
              ))
            ) : !data?.workflow_by_status?.length ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400">No vehicles yet</div>
            ) : (
              data.workflow_by_status.map((row: any) => {
                const step = WORKFLOW_STEPS.find(s => s.key === `${row.workflow_status}_count`);
                const pctVal = totalForPct > 0 ? Math.round((row.count / totalForPct) * 100) : 0;
                return (
                  <div key={row.workflow_status} className="px-5 py-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {step && <span className={`w-2 h-2 rounded-full ${step.dot}`} />}
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                          {String(row.workflow_status).replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">{row.count} vehicles · {pctVal}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className={`h-1.5 rounded-full ${step?.dot ?? 'bg-brand-500'}`}
                        style={{ width: `${pctVal}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Add Vessel',        to: '/vessels/new',          color: 'bg-brand-500 hover:bg-brand-600 text-white' },
            { label: 'Add Manifest',      to: '/manifests/new',        color: 'bg-indigo-500 hover:bg-indigo-600 text-white' },
            { label: 'Discharge Vehicle', to: '/operations/discharge', color: 'bg-cyan-500 hover:bg-cyan-600 text-white' },
            { label: 'Batch Vehicle',     to: '/operations/batch',     color: 'bg-violet-500 hover:bg-violet-600 text-white' },
            { label: 'TPA Transfer',      to: '/operations/transfer',  color: 'bg-orange-500 hover:bg-orange-600 text-white' },
            { label: 'Yard Receive',      to: '/operations/receive',   color: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
            { label: 'Search Chassis',    to: '/operations/search',    color: 'bg-gray-600 hover:bg-gray-700 text-white' },
          ].map(a => (
            <Link key={a.label} to={a.to}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${a.color}`}>
              {a.label}
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
