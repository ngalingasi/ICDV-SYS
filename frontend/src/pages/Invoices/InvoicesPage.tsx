import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { invoicesApi } from '../../api';
import { useAuth } from '../../store/authStore';
import { FormDateInput } from '../../components/tpfcs/FormField';

const STATUS_STYLES: Record<string, string> = {
  invoiced:  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  approved:  'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  paid:      'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  cancelled: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
};

const fmtDate  = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMoney = (n: any)    => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 });

export default function InvoicesPage() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices]     = useState<any[]>([]);
  const [total,    setTotal]        = useState(0);
  const [loading,  setLoading]      = useState(true);
  const [page,     setPage]         = useState(1);
  const [status,   setStatus]       = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo,   setDateTo]       = useState('');
  const [search,   setSearch]       = useState('');
  const limit = 20;

  const load = () => {
    setLoading(true);
    invoicesApi.list({ page, limit, status: status || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined, search: search || undefined })
      .then(r => { setInvoices(r.data.results); setTotal(r.data.totalResults); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, status]); // eslint-disable-line
  const applyFilters = () => { setPage(1); load(); };
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Invoices</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{total} invoices</p>
        </div>
        {isSuperAdmin && (
          <Link to="/invoices/new" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors">
            + Create Invoice
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice # or ICDV…"
          className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 w-52" />
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">
          <option value="">All Statuses</option>
          <option value="invoiced">Invoiced</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="w-40">
          <FormDateInput label="From" id="invoices-date-from" value={dateFrom} onChange={setDateFrom} placeholder="Any" />
        </div>
        <div className="w-40">
          <FormDateInput label="To" id="invoices-date-to" value={dateTo} onChange={setDateTo} placeholder="Any" />
        </div>
        <button onClick={applyFilters} className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm">Apply</button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['Invoice #', 'Date', 'ICDV', 'Lines', 'Subtotal', 'WHT', 'Total', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading
                ? Array.from({length:6}).map((_,i) => (
                    <tr key={i}>{Array.from({length:9}).map((_,j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" /></td>
                    ))}</tr>
                  ))
                : invoices.length === 0
                  ? <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-400">No invoices found</td></tr>
                  : invoices.map(inv => (
                      <tr key={inv.invoice_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">{inv.invoice_number}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(inv.issued_date)}</td>
                        <td className="px-4 py-3 text-xs text-gray-800 dark:text-white">{inv.icdv_name}</td>
                        <td className="px-4 py-3 text-xs text-center text-gray-500">{inv.line_count}</td>
                        <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">{fmtMoney(inv.subtotal)}</td>
                        <td className="px-4 py-3 text-xs text-red-600 dark:text-red-400 text-right whitespace-nowrap">({fmtMoney(inv.withholding_tax_amount)})</td>
                        <td className="px-4 py-3 text-xs font-bold text-gray-800 dark:text-white text-right whitespace-nowrap">{fmtMoney(inv.total_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[inv.status] ?? ''}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => navigate(`/invoices/${inv.invoice_id}`)}
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
