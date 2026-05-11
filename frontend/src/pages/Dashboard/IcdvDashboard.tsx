import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { dashboardApi } from '../../api';
import type { DashboardData } from '../../types';
import { useAuth } from '../../store/authStore';

export default function IcdvDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.get().then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  const s = data?.stats;

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

  const VesselIcon   = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v8m0 4l4-4m-4 4l-4-4M3 20h18" /></svg>;
  const ManifestIcon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
  const CarIcon      = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="2" y="10" width="20" height="8" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M5 10V8a4 4 0 018 0v2M7 18v1m10-1v1" /></svg>;
  const CheckIcon    = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  const ClockIcon    = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  const GearIcon     = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
  const TruckIcon    = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>;

  // Status colours for actual DB enum: active/inactive/decommissioned
  const vesselStatusColors: Record<string, string> = {
    active:         'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
    inactive:       'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
    decommissioned: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Welcome */}
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

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label="Total Vessels"      value={s?.total_vessels}       color="text-brand-600 dark:text-brand-400"    to="/vessels"                              icon={<VesselIcon />} />
        <StatCard label="Total Manifests"    value={s?.total_manifests}     color="text-indigo-600 dark:text-indigo-400"  to="/manifests"                            icon={<ManifestIcon />} />
        <StatCard label="Imported Vehicles"  value={s?.total_vehicles}      color="text-gray-800 dark:text-white"         to="/vehicles"                             icon={<CarIcon />} />
        <StatCard label="Released Vehicles"  value={s?.released_vehicles}   color="text-green-600 dark:text-green-400"    to="/vehicles?release_status=released"     icon={<CheckIcon />} />
        <StatCard label="Pending Operations" value={s?.pending_operations}  color="text-yellow-600 dark:text-yellow-400"  to="/operations?status=pending"            icon={<ClockIcon />} />
        <StatCard label="Active Operations"  value={s?.active_operations}   color="text-blue-600 dark:text-blue-400"      to="/operations?status=in_progress"        icon={<GearIcon />} />
        <StatCard label="Delivered Vehicles" value={s?.delivered_vehicles}  color="text-teal-600 dark:text-teal-400"      to="/deliveries?status=delivered"          icon={<TruckIcon />} />
        <StatCard label="Unreleased"         value={s?.unreleased_vehicles} color="text-red-600 dark:text-red-400"        to="/vehicles?release_status=unreleased"   icon={<CarIcon />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Vessels — uses real columns: name, vessel_type, country_of_origin, status, created_at, latest_arrival_date */}
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

        {/* Operations by Type */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Operations by Type</h2>
            <Link to="/operations" className="text-xs text-brand-500 hover:text-brand-600">View all →</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-4 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-1" />
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full w-full mt-2" />
                </div>
              ))
            ) : !data?.operations_by_type?.length ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400">No operations yet</div>
            ) : (
              data.operations_by_type.map((op: any) => {
                const pct = op.count > 0 ? Math.round((op.completed / op.count) * 100) : 0;
                return (
                  <div key={op.operation_type} className="px-5 py-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                        {String(op.operation_type).replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-500">{op.count} total · {op.completed} done</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Add Vessel',     to: '/vessels/new',     color: 'bg-brand-500 hover:bg-brand-600 text-white' },
            { label: 'Add Manifest',   to: '/manifests/new',   color: 'bg-indigo-500 hover:bg-indigo-600 text-white' },
            { label: 'Search Vehicle', to: '/vehicles/search', color: 'bg-green-500 hover:bg-green-600 text-white' },
            { label: 'New Operation',  to: '/operations',      color: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
            { label: 'New Delivery',   to: '/deliveries',      color: 'bg-teal-500 hover:bg-teal-600 text-white' },
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
