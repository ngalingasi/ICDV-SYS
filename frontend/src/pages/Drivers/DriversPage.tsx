import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router';
import { driversApi } from '../../api';
import type { Driver } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { toast } from '../../components/tpfcs/Toast';

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [delId, setDelId]     = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const limit = 20;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined as any);

  const load = () => {
    setLoading(true);
    driversApi.list({ page, limit, search: search || undefined })
      .then(r => { setDrivers(r.data.results); setTotal(r.data.totalResults); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(timer.current);
  }, [search]);

  useEffect(() => { load(); }, [page]);

  const handleDelete = async () => {
    if (!delId) return;
    setDeleting(true);
    try {
      await driversApi.delete(delId);
      toast.success('Driver deleted');
      setDelId(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Drivers</h1>
          <p className="text-sm text-gray-500">{total} driver{total !== 1 ? 's' : ''} registered</p>
        </div>
        <Link to="/drivers/new"
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Add Driver
        </Link>
      </div>

      {/* Search */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text" placeholder="Search by name or license…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
            <tr>
              {['Name', 'License Number', 'Phone', 'Email', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded w-24" /></td>
                  ))}
                </tr>
              ))
            ) : drivers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No drivers found</td></tr>
            ) : drivers.map(d => (
              <tr key={d.driver_id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                        {(d as any).photo ? <img src={`http://localhost:3000${(d as any).photo}`} alt="" className="w-full h-full object-cover" /> : <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                      </div>
                      <span className="font-medium text-gray-900">{d.full_name}</span>
                    </div>
                  </td>
                <td className="px-4 py-3 font-mono text-gray-700">{d.license_number}</td>
                <td className="px-4 py-3 text-gray-600">{d.phone ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{d.email ?? '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <Link to={`/drivers/${d.driver_id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                    <Link to={`/drivers/${d.driver_id}/edit`} className="text-gray-600 hover:underline text-xs">Edit</Link>
                    <button onClick={() => setDelId(d.driver_id)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Delete modal */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Driver</h3>
            <p className="text-sm text-gray-600 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDelId(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
