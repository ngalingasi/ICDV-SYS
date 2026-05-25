import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { vesselsApi } from '../../api';
import type { Vessel } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import Modal from '../../components/tpfcs/Modal';
import { toast } from '../../components/tpfcs/Toast';
import { useAuth } from '../../store/authStore';

export default function VesselsPage() {
  const [vessels, setVessels]           = useState<Vessel[]>([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]                 = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Vessel | null>(null);
  const limit = 15;

  const { user } = useAuth();
  // manageVessels right: supervisor, admin, system_admin, super_admin, backoffice_officer
  const canManageVessels = user && [
    'supervisor', 'admin', 'system_admin', 'super_admin', 'backoffice_officer',
  ].includes(user.role);

  const load = () => {
    setLoading(true);
    vesselsApi.list({ page, limit, status: statusFilter || undefined, search: search || undefined })
      .then(r => { setVessels(r.data.results); setTotal(r.data.totalResults); })
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
      await vesselsApi.delete(deleteTarget.vessel_id);
      toast.success('Vessel deleted');
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
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Vessels</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{total} total vessels</p>
        </div>
        <div className="sm:ml-auto flex flex-wrap gap-2">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search vessels..."
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 w-52"
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">All Statuses</option>
            {['expected','arrived','processing','completed','departed'].map(s =>
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            )}
          </select>
          {canManageVessels && (
            <Link to="/vessels/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors">
              + Add Vessel
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['Vessel Name','IMO Number','Type','Country/Origin','Manifests','Vehicles','Status','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : vessels.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">No vessels found</td>
                </tr>
              ) : vessels.map(v => (
                <tr key={v.vessel_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">
                    <Link to={`/vessels/${v.vessel_id}`} className="hover:text-brand-600">{v.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{v.imo_number ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{(v as any).vessel_type ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{(v as any).country_of_origin ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{v.manifest_count ?? 0}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{v.vehicle_count ?? 0}</td>
                  <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link to={`/vessels/${v.vessel_id}`} className="text-xs text-brand-600 hover:underline">View</Link>
                      <Link to={`/vessels/${v.vessel_id}/edit`} className="text-xs text-gray-500 hover:underline">Edit</Link>
                      <button onClick={() => setDeleteTarget(v)} className="text-xs text-red-500 hover:underline">Delete</button>
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
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800">Next</button>
            </div>
          </div>
        )}
      </div>

      {deleteTarget && (
        <Modal isOpen onClose={() => setDeleteTarget(null)} title="Delete Vessel">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
            <button onClick={handleDelete}
              className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
