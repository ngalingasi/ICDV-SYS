import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import * as XLSX from 'xlsx';
import { vehiclesApi, icdvsApi } from '../../api';
import { useAuth } from '../../store/authStore';
import type { Vehicle } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { toast } from '../../components/tpfcs/Toast';
import { DestinationTypeBadge } from '../../components/tpfcs/WorkflowCard';

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
  const [exporting,  setExporting]      = useState(false);
  // manifest_id from URL — set when navigated from "View all →" on ManifestDetail
  const manifestIdFromUrl               = sp.get('manifest_id') ?? '';
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
      manifest_id: manifestIdFromUrl || undefined,
    }).then(r => { setVehicles(r.data.results); setTotal(r.data.totalResults); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, releaseFilter, opFilter, workflowFilter, icdvFilter, manifestIdFromUrl]);  // eslint-disable-line
  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  }, [search]);  // eslint-disable-line

  // Export ALL vehicles matching the current filters (not just the visible page) to .xlsx.
  // The list endpoint caps at 100 rows/request server-side, so a manifest with
  // hundreds of vehicles needs multiple requests, paged through here before building the file.
  const handleExport = async () => {
    setExporting(true);
    try {
      const filters = {
        release_status: releaseFilter || undefined,
        operational_status: opFilter || undefined,
        workflow_status: workflowFilter || undefined,
        search: search || undefined,
        icdv_id: icdvFilter || undefined,
        manifest_id: manifestIdFromUrl || undefined,
      };

      const exportLimit = 100;
      let exportPage = 1;
      let all: Vehicle[] = [];
      let totalResults = Infinity;

      while (all.length < totalResults) {
        const r = await vehiclesApi.list({ ...filters, page: exportPage, limit: exportLimit });
        all = all.concat(r.data.results);
        totalResults = r.data.totalResults;
        if (!r.data.results.length) break; // safety net against infinite loop
        exportPage += 1;
      }

      if (!all.length) {
        toast.error('No vehicles to export for the current filters');
        return;
      }

      const sheetRows = all.map(v => ({
        'Chassis Number':     v.chassis_number,
        'Brand':              v.brand ?? '',
        'Model':              v.model ?? '',
        'Year':               v.year ?? '',
        'Color':              v.color ?? '',
        'Manifest #':         v.manifest_number ?? '',
        'Vessel':             v.vessel_name ?? '',
        'Customer':           v.customer_name ?? '',
        'Destination':        v.destination ?? '',
        'Destination Type':   v.destination_type === 'local' ? 'Local' : v.destination_type === 'transit' ? 'Transit' : '',
        'Release Status':     v.release_status ?? '',
        'Operational Status': v.operational_status ?? '',
        'Workflow Status':    v.workflow_status ?? '',
      }));

      const ws = XLSX.utils.json_to_sheet(sheetRows);
      ws['!cols'] = [
        { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 10 },
        { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 14 },
        { wch: 14 }, { wch: 16 }, { wch: 14 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Vehicles');

      const namedParts = [
        manifestIdFromUrl && `manifest-${manifestIdFromUrl}`,
        releaseFilter,
        opFilter,
        workflowFilter,
      ].filter(Boolean);
      const filename = `vehicles${namedParts.length ? '_' + namedParts.join('_') : ''}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success(`Exported ${all.length} vehicle${all.length === 1 ? '' : 's'} to Excel`);
    } catch {
      toast.error('Failed to export vehicles');
    } finally {
      setExporting(false);
    }
  };

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
      {/* Manifest filter banner — shown when navigated from ManifestDetail "View all →" */}
      {manifestIdFromUrl && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20">
          <svg className="w-4 h-4 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p className="text-sm text-brand-700 dark:text-brand-400">
            Showing vehicles for <span className="font-semibold">Manifest #{manifestIdFromUrl}</span>
          </p>
          <Link
            to="/vehicles"
            className="ml-auto text-xs text-brand-600 dark:text-brand-400 hover:underline whitespace-nowrap"
          >
            Clear filter →
          </Link>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Vehicles</h1>
          <p className="text-sm text-gray-500">{total} vehicles</p>
        </div>
        <div className="sm:ml-auto flex flex-wrap items-center gap-2">
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
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            title="Export to Excel"
            aria-label="Export to Excel"
            className="inline-flex items-center justify-center border border-gray-200 dark:border-gray-700 rounded-lg w-9 h-9 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {exporting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2-8h2a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2h5.586a1 1 0 01.707.293L18 6.414a1 1 0 01.293.707V8" />
              </svg>
            )}
          </button>
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
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[140px] truncate">
                    {v.destination ?? '—'}
                    <DestinationTypeBadge type={v.destination_type} />
                  </td>
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
