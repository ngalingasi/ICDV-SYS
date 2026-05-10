import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { purchaseOrdersApi, suppliersApi, projectsApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import { useAuth } from '../../store/authStore';

const STATUS_STYLES: Record<string, string> = {
  draft:               'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  pending:             'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  approved:            'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  ordered:             'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  partially_received:  'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  completed:           'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  cancelled:           'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

const fmtCurrency = (amount: any, code = 'TZS') => {
  const n = Number(amount || 0);
  return `${code} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function OrdersPage() {
  const { user }     = useAuth();
  const navigate     = useNavigate();
  const canManage    = user?.role === 'admin' || user?.role === 'manager';

  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [statusF,  setStatusF]  = useState('');
  const [page,     setPage]     = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await purchaseOrdersApi.list({ page, limit: 15, search: search || undefined, status: statusF || undefined });
      setData(res.data);
    } finally { setLoading(false); }
  }, [page, search, statusF]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id: number) => {
    if (!confirm('Cancel this order?')) return;
    try {
      await purchaseOrdersApi.cancel(id);
      toast.success('Order cancelled');
      load();
    } catch (err: any) { toast.error('Failed', err?.response?.data?.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{data?.totalResults ?? 0} orders</p>
        </div>
        {canManage && (
          <Link to="/inventory/orders/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Order
          </Link>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input type="text" placeholder="Search order number, supplier..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400" />
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none">
          <option value="">All Statuses</option>
          {['draft','pending','approved','ordered','partially_received','completed','cancelled'].map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {['Order #','Supplier','Project','Date','Currency','Total (Foreign)','Total (TZS)','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? Array.from({length:5}).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({length:9}).map((__, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" /></td>)}
                </tr>
              )) : data?.results.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No orders found</td></tr>
              ) : data?.results.map((o: any) => (
                <tr key={o.purchase_order_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">{o.order_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-white">{o.supplier_name}</p>
                    {o.supplier_country && <p className="text-xs text-gray-400">{o.supplier_country}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{o.project_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                    {new Date(o.order_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{o.currency_code}</span>
                    {o.currency_code !== 'TZS' && (
                      <p className="text-xs text-gray-400 mt-0.5">@ {Number(o.exchange_rate).toLocaleString()}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white text-xs">
                    {fmtCurrency(o.total_amount_foreign, o.currency_code)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300 text-xs">
                    {fmtCurrency(o.total_amount_tzs, 'TZS')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_STYLES[o.status]}`}>
                      {o.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => navigate(`/inventory/orders/${o.purchase_order_id}`)}
                        className="px-2.5 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-md">View</button>
                      {canManage && !['cancelled','completed'].includes(o.status) && (
                        <>
                          <button onClick={() => navigate(`/inventory/orders/${o.purchase_order_id}/edit`)}
                            className="px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">Edit</button>
                          <button onClick={() => handleCancel(o.purchase_order_id)}
                            className="px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md">Cancel</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">Page {data.page} of {data.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p-1)} disabled={page===1} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => p+1)} disabled={page===data.totalPages} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
