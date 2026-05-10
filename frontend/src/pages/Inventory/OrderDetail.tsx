import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { purchaseOrdersApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';
import { useAuth } from '../../store/authStore';

const STATUS_STYLES: Record<string, string> = {
  draft:              'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  pending:            'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  approved:           'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  ordered:            'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  partially_received: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  completed:          'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  cancelled:          'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

const fmtDate = (d?: string) => d
  ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const fmtAmt = (n: any, code = 'TZS') =>
  `${code} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OrderDetail() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const canManage  = user?.role === 'admin' || user?.role === 'manager';

  const [order,   setOrder]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    purchaseOrdersApi.get(Number(id))
      .then(r => setOrder(r.data))
      .catch(() => toast.error('Failed', 'Could not load order'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCancel = async () => {
    if (!confirm('Cancel this order?')) return;
    try {
      await purchaseOrdersApi.cancel(Number(id));
      toast.success('Order cancelled');
      setOrder((o: any) => ({ ...o, status: 'cancelled' }));
    } catch (err: any) {
      toast.error('Failed', err?.response?.data?.message);
    }
  };

  if (loading) return (
    <div className="animate-pulse space-y-4 max-w-5xl mx-auto">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
      <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </div>
  );

  if (!order) return <p className="text-gray-400 text-center py-20">Order not found</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/inventory/orders" className="hover:text-brand-500">Orders</Link>
          <span>/</span>
          <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{order.order_number}</span>
        </div>
        <BackButton to="/inventory/orders" />
      </div>

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold font-mono text-gray-800 dark:text-white">{order.order_number}</h1>
              <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_STYLES[order.status]}`}>
                {order.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Created {fmtDate(order.created_at)} by {order.created_by_name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManage && !['cancelled','completed'].includes(order.status) && (
              <>
                <button onClick={() => navigate(`/inventory/orders/${id}/edit`)}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  Edit
                </button>
                <button onClick={handleCancel}
                  className="px-4 py-2 text-sm bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-100">
                  Cancel Order
                </button>
              </>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {[
            { label: 'Supplier',    value: order.supplier_name },
            { label: 'Country',     value: order.supplier_country ?? '—' },
            { label: 'Project',     value: order.project_name ?? '—' },
            { label: 'Order Date',  value: fmtDate(order.order_date) },
            { label: 'Expected Delivery', value: fmtDate(order.expected_delivery_date) },
            { label: 'Currency',    value: order.currency_code },
            { label: 'Exchange Rate', value: order.currency_code !== 'TZS' ? `1 ${order.currency_code} = TZS ${Number(order.exchange_rate).toLocaleString()}` : 'N/A (TZS)' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
              <p className="font-medium text-gray-800 dark:text-white">{item.value}</p>
            </div>
          ))}
        </div>

        {order.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-400 mb-1">Notes</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{order.notes}</p>
          </div>
        )}
      </div>

      {/* Items table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Order Items ({order.items?.length ?? 0})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                {['#','Product','Description','Unit','Qty','Unit Price','Total (Foreign)','Total (TZS)'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {order.items?.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No items</td></tr>
              ) : order.items?.map((item: any, idx: number) => (
                <tr key={item.item_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-white">{item.product_name}</p>
                    {item.sku_barcode && <p className="text-xs font-mono text-gray-400">{item.sku_barcode}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs max-w-[160px] truncate">{item.description ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{item.unit_type ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">{Number(item.quantity).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{fmtAmt(item.unit_price, order.currency_code)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white">{fmtAmt(item.total_price_foreign, order.currency_code)}</td>
                  <td className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">{fmtAmt(item.base_price_tzs, 'TZS')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex justify-end gap-8">
            {order.currency_code !== 'TZS' && (
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-0.5">Subtotal ({order.currency_code})</p>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{fmtAmt(order.total_amount_foreign, order.currency_code)}</p>
              </div>
            )}
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-0.5">Total (TZS)</p>
              <p className="text-xl font-bold text-brand-600 dark:text-brand-400">{fmtAmt(order.total_amount_tzs, 'TZS')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
