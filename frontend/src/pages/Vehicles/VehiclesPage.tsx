import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { vehiclesApi, icdvsApi } from '../../api';
import { useAuth } from '../../store/authStore';
import type { Vehicle } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { toast } from '../../components/tpfcs/Toast';

export default function VehiclesPage() {
  const [sp] = useSearchParams();
  const [vehicles, setVehicles]       = useState<Vehicle[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [releaseFilter, setRelease]   = useState(sp.get('release_status') ?? '');
  const [opFilter, setOp]             = useState(sp.get('operational_status') ?? '');
  const [page, setPage]               = useState(1);
  const [icdvFilter, setIcdvFilter]     = useState('');
  const [workflowFilter, setWorkflow]   = useState(sp.get('workflow_status') ?? '');
  const [icdvs,      setIcdvs]          = useState<any[]>([]);
  const limit = 20;

  const { isSuperAdmin, isSystemAdmin } = useAuth();
  const isCrossTenant = isSuperAdmin || isSystemAdmin;

  const load = () => {
    setLoading(true);
    vehiclesApi.list({
      page, limit,
      release_status: releaseFilter || undefined,
      operational_status: opFilter || undefined,
      workflow_status: workflowFilter || undefined,
      search: search || undefined,
      icdv_id: icdvFilter || undefined,
    }).then(r => { setVehicles(r.data.results); setTotal(r.data.totalResults); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, releaseFilter, opFilter, workflowFilter, icdvFilter]);  // eslint-disable-line
  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  }, [search]);  // eslint-disable-line

  useEffect(() => {
    if (isCrossTenant) {
      icdvsApi.list({ limit: 200, status: 'active' })
        .then(r => setIcdvs(r.data.results ?? r.data))
        .catch(() => {});
    }
  }, [isCrossTenant]);  // eslint-disable-line

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Vehicles</h1>
          <p className="text-sm text-gray-500">{total} vehicles</p>
        </div>
        <div className="sm:ml-auto flex flex-wrap gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chassis, brand, customer…"
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 w-60" />
          <select value={releaseFilter} onChange={e => setRelease(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">All Release</option>
            {['unreleased','released','collected','on_hold'].map(s =>
              <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
          <select value={opFilter} onChange={e => setOp(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">All Op. Status</option>
            {['pending','in_operation','ready','delivered','cancelled'].map(s =>
              <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
          <select value={workflowFilter} onChange={e => setWorkflow(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">All Workflow</option>
            {['manifested','discharged','batched','in_transit','received'].map(s =>
              <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
          {isCrossTenant && icdvs.length > 0 && (
            <select value={icdvFilter} onChange={e => setIcdvFilter(e.target.value)}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">All ICDVs</option>
              {icdvs.map((ic: any) => (
                <option key={ic.icdv_id} value={ic.icdv_id}>{ic.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['Chassis #','Brand','Model','Year','Color','Manifest','Vessel','Customer','Destination','Release','Op. Status',''].map(h => (
                  <th key={h} className={`text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap${['Brand','Model','Year','Color'].includes(h) ? ' hidden' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 12 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16" /></td>
                  ))}</tr>
                ))
              ) : vehicles.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-sm text-gray-400">No vehicles found</td></tr>
              ) : vehicles.map(v => (
                <tr key={v.vehicle_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-mono text-xs text-gray-800 dark:text-white">
                    <Link to={`/vehicles/${v.vehicle_id}`} className="hover:text-brand-600">{v.chassis_number}</Link>
                  </td>
                  <td className="hidden px-4 py-3 text-gray-700 dark:text-gray-300">{v.brand ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400">{v.model ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400">{v.year ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400">{v.color ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {v.manifest_number ? <Link to={`/manifests/${v.manifest_id}`} className="hover:text-brand-600">{v.manifest_number}</Link> : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{v.vessel_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[100px] truncate">{v.customer_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[100px] truncate">{v.destination ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={v.release_status} /></td>
                  <td className="px-4 py-3"><StatusBadge status={v.operational_status} /></td>
                  <td className="px-4 py-3">
                    <Link to={`/vehicles/${v.vehicle_id}`} className="text-xs text-brand-600 hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500">Page {page} of {totalPages} · {total} vehicles</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-50">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
