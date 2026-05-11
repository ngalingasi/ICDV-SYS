// ─────────────────────────────────────────────────────────────────────────────
// NEW FILE: frontend/src/pages/SuperAdmin/IcdvList.tsx
// Super admin: list all ICDVs (tenants) and their stats.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import PageBreadCrumb from '../../components/common/PageBreadCrumb';
import { icdvsApi } from '../../api';
import type { Icdv, PaginatedResponse } from '../../types';

export default function IcdvList() {
  const [data,    setData]    = useState<PaginatedResponse<Icdv> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await icdvsApi.list({ page, limit: 15, search: search || undefined });
      setData(res.data);
    } catch { setError('Failed to load ICDVs'); }
    finally   { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 sm:p-6">
      <PageBreadCrumb pageTitle="ICDV Management" />

      {/* Super Admin notice banner */}
      <div className="mb-5 p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-400 text-sm flex items-center gap-2">
        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
        </svg>
        Super Admin — Platform-wide ICDV management. All tenants visible.
      </div>

      <div className="mb-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <input type="text" placeholder="Search ICDV name, code, city…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400" />
        <Link to="/super-admin/icdvs/create"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New ICDV
        </Link>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {['Name','Code','City','Users','Vessels','Vehicles','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? Array.from({length:6}).map((_,i) => (
                <tr key={i}>{Array.from({length:8}).map((_,j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </td>
                ))}</tr>
              )) : data?.results?.length ? (
                data.results.map(icdv => (
                  <tr key={icdv.icdv_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">
                      <Link to={`/super-admin/icdvs/${icdv.icdv_id}`} className="hover:text-brand-500">{icdv.name}</Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{icdv.code}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{icdv.city || '—'}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">{icdv.user_count ?? 0}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">{icdv.vessel_count ?? 0}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">{icdv.vehicle_count ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        icdv.is_active ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                                       : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}>{icdv.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/super-admin/icdvs/${icdv.icdv_id}`} className="text-brand-500 hover:text-brand-600 text-xs font-medium">Manage</Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">No ICDVs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {data && data.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Page {data.page} of {data.totalPages} · {data.totalResults} ICDVs</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800">Previous</button>
              <button onClick={() => setPage(p => p+1)} disabled={page >= data.totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
