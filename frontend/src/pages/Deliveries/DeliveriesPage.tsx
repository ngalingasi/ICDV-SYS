import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { deliveriesApi } from '../../api';
import type { Delivery } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { toast } from '../../components/tpfcs/Toast';

const DELIVERY_STATUSES = ['scheduled', 'in_transit', 'delivered', 'failed', 'cancelled'];

export default function DeliveriesPage() {
  const [sp] = useSearchParams();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState(sp.get('status') ?? '');
  const [page, setPage]             = useState(1);
  const [delId, setDelId]           = useState<number | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const limit = 20;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined as any);

  const load = () => {
    setLoading(true);
    deliveriesApi.list({ page, limit, status: statusFilter || undefined, search: search || undefined })
      .then(r => { setDeliveries(r.data.results); setTotal(r.data.totalResults); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(timer.current);
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [page]);

  const handleDelete = async () => {
    if (!delId) return;
    setDeleting(true);
    try {
      await deliveriesApi.delete(delId);
      toast.success('Delivery deleted');
      setDelId(null); load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    } finally { setDeleting(false); }
  };

  const totalPages = Math.ceil(total / limit);
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Deliveries</h1>
          <p className="text-sm text-gray-500">{total} deliver{total !== 1 ? 'ies' : 'y'}</p>
        </div>
        <Link to="/deliveries/new" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + New Delivery
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Statuses</option>
          {DELIVERY_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
            <tr>
              {['Vehicle', 'Driver', 'Status', 'Scheduled', 'Address', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                  ))}
                </tr>
              ))
            ) : deliveries.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No deliveries found</td></tr>
            ) : deliveries.map(dl => (
              <tr key={dl.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {dl.vehicle_id ? (
                    <Link to={`/vehicles/${dl.vehicle_id}`} className="font-mono text-xs text-blue-600 hover:underline">
                      {(dl as any).chassis_number ?? `#${dl.vehicle_id}`}
                    </Link>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {dl.driver_id ? (
                    <Link to={`/drivers/${dl.driver_id}`} className="text-blue-600 hover:underline">
                      {(dl as any).driver_name ?? `Driver #${dl.driver_id}`}
                    </Link>
                  ) : '—'}
                </td>
                <td className="px-4 py-3"><StatusBadge status={dl.status} /></td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(dl.scheduled_date ?? undefined)}</td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{dl.delivery_address ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <Link to={`/deliveries/${dl.id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                    <Link to={`/deliveries/${dl.id}/edit`} className="text-gray-600 hover:underline text-xs">Edit</Link>
                    <button onClick={() => setDelId(dl.id ?? null)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

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

      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Delivery</h3>
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
