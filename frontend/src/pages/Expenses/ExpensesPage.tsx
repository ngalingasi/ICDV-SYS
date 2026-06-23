import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { expensesApi } from '../../api';
import { useAuth } from '../../store/authStore';
import { FormDateInput } from '../../components/tpfcs/FormField';

const fmtDate  = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMoney = (n: any)    => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 });

export default function ExpensesPage() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [expenses,   setExpenses]   = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading,  setLoading]    = useState(true);
  const [page,     setPage]       = useState(1);
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo,   setDateTo]     = useState('');
  const [search,   setSearch]     = useState('');
  const limit = 20;

  const load = () => {
    setLoading(true);
    expensesApi.list({ page, limit, date_from: dateFrom || undefined, date_to: dateTo || undefined, search: search || undefined })
      .then(r => { setExpenses(r.data.results); setTotal(r.data.totalResults); setGrandTotal(r.data.grand_total ?? 0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]); // eslint-disable-line
  const applyFilters = () => { setPage(1); load(); };
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 text-sm text-red-700 dark:text-red-400">
          You don't have access to the Expenses module.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Expenses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{total} expenses</p>
        </div>
        <Link to="/expenses/new" className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors">
          + Create Expense
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expense #, manifest, or ICDV…"
          className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 w-60" />
        <div className="w-40">
          <FormDateInput label="From" id="expenses-date-from" value={dateFrom} onChange={setDateFrom} placeholder="Any" />
        </div>
        <div className="w-40">
          <FormDateInput label="To" id="expenses-date-to" value={dateTo} onChange={setDateTo} placeholder="Any" />
        </div>
        <button onClick={applyFilters} className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm">Apply</button>
      </div>

      {/* Grand total bar — top */}
      <div className={`rounded-xl border border-brand-200 dark:border-brand-500/30 bg-brand-50 dark:bg-brand-500/5 px-5 py-3 flex items-center gap-6 flex-wrap text-sm ${loading ? 'opacity-60' : ''}`}>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{total} expenses</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Grand Total:</span>
          <span className="text-base font-bold text-brand-600 dark:text-brand-400">TZS {Number(grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['Expense #', 'Date', 'Manifest', 'ICDV', 'Lines', 'Total', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading
                ? Array.from({length:6}).map((_,i) => (
                    <tr key={i}>{Array.from({length:6}).map((_,j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" /></td>
                    ))}</tr>
                  ))
                : expenses.length === 0
                  ? <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No expenses found</td></tr>
                  : expenses.map(exp => (
                      <tr key={exp.expense_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">{exp.expense_number}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(exp.expense_date)}</td>
                        <td className="px-4 py-3 text-xs text-gray-800 dark:text-white whitespace-nowrap">{exp.manifest_number}</td>
                        <td className="px-4 py-3 text-xs text-gray-800 dark:text-white">{exp.icdv_name}</td>
                        <td className="px-4 py-3 text-xs text-center text-gray-500">{exp.line_count}</td>
                        <td className="px-4 py-3 text-xs font-bold text-gray-800 dark:text-white text-right whitespace-nowrap">{fmtMoney(exp.total_amount)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => navigate(`/expenses/${exp.expense_id}`)}
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
            <p className="text-xs text-gray-500">Page {page} of {totalPages} · {total} expenses</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-50">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Grand total bar — bottom */}
      <div className={`rounded-xl border border-brand-200 dark:border-brand-500/30 bg-brand-50 dark:bg-brand-500/5 px-5 py-3 flex items-center gap-6 flex-wrap text-sm ${loading ? 'opacity-60' : ''}`}>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{total} expenses</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Grand Total:</span>
          <span className="text-base font-bold text-brand-600 dark:text-brand-400">TZS {Number(grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
}
