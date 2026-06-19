/**
 * BillingPage.tsx
 *
 * ICDV-side billing view. Shows invoices directed at the logged-in user's ICDV.
 * Default filter: pending/approved invoices (unpaid).
 * Accessible by: admin, cashier (and super_admin for all-ICDV view).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { invoicesApi } from '../../api';

const fmtDate  = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMoney = (n: any) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  approved:  'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  paid:      'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  cancelled: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
};

export default function BillingPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [status,   setStatus]   = useState('approved'); // default: unpaid/approved
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const limit = 20;

  const load = () => {
    setLoading(true);
    invoicesApi.list({
      page, limit,
      status:    status    || undefined,
      date_from: dateFrom  || undefined,
      date_to:   dateTo    || undefined,
    })
      .then(r => { setInvoices(r.data.results); setTotal(r.data.totalResults); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [page, status]); // eslint-disable-line
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Billing</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Invoices from operator — {total} records</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">
          <option value="approved">Pending / Unpaid</option>
          <option value="paid">Paid</option>
          <option value="">All Statuses</option>
        </select>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
        </div>
        <button onClick={() => { setPage(1); load(); }} className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm">Apply</button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['Invoice #','Date','Amount (TZS)','WHT','Total','Status',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading
                ? Array.from({length:5}).map((_,i) => (
                    <tr key={i}>{Array.from({length:7}).map((_,j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" /></td>
                    ))}</tr>
                  ))
                : invoices.length === 0
                  ? <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No invoices found</td></tr>
                  : invoices.map(inv => (
                      <tr key={inv.invoice_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">{inv.invoice_number}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(inv.issued_date)}</td>
                        <td className="px-4 py-3 text-xs text-right text-gray-700 dark:text-gray-300">{fmtMoney(inv.subtotal)}</td>
                        <td className="px-4 py-3 text-xs text-right text-red-500">({fmtMoney(inv.withholding_tax_amount)})</td>
                        <td className="px-4 py-3 text-xs text-right font-bold text-gray-800 dark:text-white">{fmtMoney(inv.total_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[inv.status] ?? ''}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => navigate(`/billing/${inv.invoice_id}`)}
                            className="text-xs text-brand-600 dark:text-brand-400 hover:underline">View</button>
                        </td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500">Page {page} of {totalPages} · {total} invoices</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-50">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
