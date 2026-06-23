import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { operationsApi } from '../../api';
import type { Operation } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { toast } from '../../components/tpfcs/Toast';

const OP_TYPES   = ['inspection', 'cleaning', 'repair', 'delivery_prep', 'release'];
const OP_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];

export default function OperationsPage() {
  const [sp] = useSearchParams();
  const [ops, setOps]           = useState<Operation[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [typeFilter, setType]   = useState(sp.get('type') ?? '');
  const [statusFilter, setStatus] = useState(sp.get('status') ?? '');
  const [page, setPage]         = useState(1);
  const [delId, setDelId]       = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const limit = 20;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined as any);

  const load = () => {
    setLoading(true);
    operationsApi.list({ page, limit, operation_type: typeFilter || undefined, status: statusFilter || undefined, search: search || undefined })
      .then(r => { setOps(r.data.results); setTotal(r.data.totalResults); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(timer.current);
  }, [search, typeFilter, statusFilter]);

  useEffect(() => { load(); }, [page]);

  const handleDelete = async () => {
    if (!delId) return;
    setDeleting(true);
    try {
      await operationsApi.delete(delId);
      toast.success('Operation deleted');
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
          <h1 className="text-xl font-bold text-gray-900">Operations</h1>
          <p className="text-sm text-gray-500">{total} operation{total !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/operations/new" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + New Operation
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={typeFilter} onChange={e => setType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Types</option>
          {OP_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Statuses</option>
          {OP_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
            <tr>
              {['Vehicle', 'Type', 'Status', 'Assigned To', 'Notes', 'Date', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                  ))}
                </tr>
              ))
            ) : ops.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No operations found</td></tr>
            ) : ops.map(op => (
              <tr key={op.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {op.vehicle_id ? (
                    <Link to={`/vehicles/${op.vehicle_id}`} className="font-mono text-xs text-blue-600 hover:underline">
                      {(op as any).chassis_number ?? `#${op.vehicle_id}`}
                    </Link>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 capitalize">{op.operation_type?.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3"><StatusBadge status={op.status} /></td>
                <td className="px-4 py-3 text-gray-600">{op.assigned_to ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{op.notes ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(op.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <Link to={`/operations/${op.id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                    <Link to={`/operations/${op.id}/edit`} className="text-gray-600 hover:underline text-xs">Edit</Link>
                    <button onClick={() => setDelId(op.id ?? null)} className="text-red-500 hover:underline text-xs">Delete</button>
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
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Operation</h3>
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
