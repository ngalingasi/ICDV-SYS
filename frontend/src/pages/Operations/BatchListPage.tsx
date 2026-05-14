import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { workflowApi } from '../../api';
import StatusBadge from '../../components/tpfcs/StatusBadge';

// ── Batch List ────────────────────────────────────────────────────────────────
export function BatchListPage() {
  const [batches,  setBatches]  = useState<any[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [page,     setPage]     = useState(1);
  const limit = 15;

  const load = () => {
    setLoading(true);
    workflowApi.listBatches({ page, limit, status: status || undefined, search: search || undefined })
      .then(r => { setBatches(r.data.results); setTotal(r.data.totalResults); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, status]); // eslint-disable-line
  useEffect(() => { const t = setTimeout(load, 350); return () => clearTimeout(t); }, [search]); // eslint-disable-line

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header + controls — wrap on small screens */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">Batches</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{total} total batches</p>
        </div>
        <div className="sm:ml-auto flex flex-wrap items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search batch number..."
            className="flex-1 min-w-0 sm:w-52 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">All Statuses</option>
            {['open','full','closed','transferred'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <Link to="/operations/batch"
            className="flex-shrink-0 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors whitespace-nowrap">
            + Batch Vehicle
          </Link>
        </div>
      </div>

      {/* Table with horizontal scroll */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {['Batch Number','Vessel','Date','Vehicles','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading
                ? Array.from({length:6}).map((_,i) => (
                    <tr key={i}>{Array.from({length:6}).map((_,j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                : batches.length
                  ? batches.map(b => (
                      <tr key={b.batch_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800 dark:text-white whitespace-nowrap">{b.batch_number}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{b.vessel_name}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{b.batch_date}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="font-semibold text-gray-800 dark:text-white">{b.vehicle_count}</span>
                          <span className="text-gray-400">/{b.max_vehicles}</span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                        <td className="px-4 py-3">
                          <Link to={`/operations/batches/${b.batch_id}`}
                            className="text-brand-500 hover:text-brand-600 text-xs font-medium">View</Link>
                        </td>
                      </tr>
                    ))
                  : <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">No batches found</td></tr>
              }
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            <span>Page {page} of {totalPages} · {total} batches</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                className="px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Prev</button>
              <button onClick={() => setPage(p => p+1)} disabled={page>=totalPages}
                className="px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Batch Detail ──────────────────────────────────────────────────────────────
export function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const [batch,   setBatch]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!batchId) return;
    workflowApi.getBatch(Number(batchId))
      .then(r => setBatch(r.data))
      .catch(() => setError('Batch not found'))
      .finally(() => setLoading(false));
  }, [batchId]);

  if (loading) return (
    <div className="space-y-4 p-1">
      {Array.from({length:4}).map((_,i) => <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
    </div>
  );
  if (error || !batch) return <div className="py-6 text-red-600 dark:text-red-400">{error || 'Batch not found'}</div>;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold font-mono text-gray-800 dark:text-white break-all">
            {batch.batch_number}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {batch.vessel_name} · {batch.batch_date}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={`/operations/batches/${batch.batch_id}/delivery-sheet`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            🖨 Print Delivery Sheet
          </a>
          <StatusBadge status={batch.status} />
        </div>
      </div>

      {/* Stats — always 3 cols but text shrinks */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Vehicles', value: `${batch.vehicle_count} / ${batch.max_vehicles}` },
          { label: 'Status',   value: batch.status },
          { label: 'Date',     value: batch.batch_date },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 sm:p-4 text-center">
            <p className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white break-words">{s.value}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Vehicle list */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Vehicles in this batch ({batch.vehicles?.length || 0})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <tr>
                {['Chassis #','Brand / Model','Customer','Status','Location'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(batch.vehicles || []).map((v: any) => (
                <tr key={v.vehicle_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-800 dark:text-white whitespace-nowrap">{v.chassis_number}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">{[v.brand,v.model].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 max-w-[100px] truncate">{v.customer_name || '—'}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={v.workflow_status} /></td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{v.current_location?.replace(/_/g,' ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
