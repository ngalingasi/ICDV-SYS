import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { manifestsApi } from '../../api';
import type { Manifest } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import Modal from '../../components/tpfcs/Modal';
import { toast } from '../../components/tpfcs/Toast';

export default function ManifestsPage() {
  const [manifests, setManifests]   = useState<Manifest[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [page, setPage]             = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Manifest | null>(null);
  const limit = 15;

  const load = () => {
    setLoading(true);
    manifestsApi.list({ page, limit, status: statusFilter || undefined, search: search || undefined })
      .then(r => { setManifests(r.data.results); setTotal(r.data.totalResults); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, statusFilter]);
  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  }, [search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await manifestsApi.delete(deleteTarget.manifest_id);
      toast.success('Manifest deleted');
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    }
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Manifests</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{total} total manifests</p>
        </div>
        <div className="sm:ml-auto flex flex-wrap gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search manifests..."
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 w-52" />
          <select value={statusFilter} onChange={e => setStatus(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">All Statuses</option>
            {['pending','active','completed','cancelled'].map(s =>
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <Link to="/manifests/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium">+ Add Manifest</Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['Manifest #','Vessel','Arrival Date','Total Vehicles','Released','Delivered','Status','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" /></td>
                  ))}</tr>
                ))
              ) : manifests.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">No manifests found</td></tr>
              ) : manifests.map(m => (
                <tr key={m.manifest_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">
                    <Link to={`/manifests/${m.manifest_id}`} className="hover:text-brand-600">{m.manifest_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{m.vessel_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(m.arrival_date)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{m.total_vehicles ?? 0}</td>
                  <td className="px-4 py-3 text-green-600 dark:text-green-400">{m.released_vehicles ?? 0}</td>
                  <td className="px-4 py-3 text-teal-600 dark:text-teal-400">{m.delivered_vehicles ?? 0}</td>
                  <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link to={`/manifests/${m.manifest_id}`} className="text-xs text-brand-600 hover:underline">View</Link>
                      <Link to={`/manifests/${m.manifest_id}/edit`} className="text-xs text-gray-500 hover:underline">Edit</Link>
                      <button onClick={() => setDeleteTarget(m)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 disabled:opacity-50">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {deleteTarget && (
        <Modal isOpen onClose={() => setDeleteTarget(null)} title="Delete Manifest">
          <p className="text-sm text-gray-600 dark:text-gray-400">Delete manifest <strong>{deleteTarget.manifest_number}</strong>?</p>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
