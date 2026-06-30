import { useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { useNavigate } from 'react-router';
import { paymentApi } from '../../api';
import { useAuth } from '../../store/authStore';
import { FormDateInput } from '../../components/tpfcs/FormField';

const fmtMoney = (n: any) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate  = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button type="button" onClick={() => setOpen(o => !o)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={() => setOpen(false)}
        className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-400 text-[9px] font-bold hover:border-brand-500 hover:text-brand-500 focus:outline-none">
        i
      </button>
      {open && (
        <span className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-[11px] leading-relaxed px-3 py-2 shadow-lg pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
        </span>
      )}
    </span>
  );
}

function StatCard({ label, value, sub, tone = 'neutral', tip }: { label: string; value: string; sub?: string; tone?: 'positive' | 'negative' | 'neutral' | 'warning'; tip?: string }) {
  const cls = tone === 'positive' ? 'text-green-600 dark:text-green-400'
            : tone === 'negative' ? 'text-red-600 dark:text-red-400'
            : tone === 'warning'  ? 'text-amber-600 dark:text-amber-400'
            : 'text-gray-800 dark:text-white';
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center">{label}{tip && <InfoTooltip text={tip} />}</p>
      <p className={`text-2xl font-bold mt-1 break-words leading-tight ${cls}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function PaymentPage() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  const [summary, setSummary]   = useState<any>(null);
  const [byIcdv,  setByIcdv]    = useState<any[]>([]);
  const [overdue, setOverdue]   = useState<any[]>([]);
  const [overdueTotal, setOverdueTotal] = useState(0);
  const [overduePages, setOverduePages] = useState(1);
  const [overduePage,  setOverduePage]  = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);

  const loadCore = () => {
    setLoading(true); setError(null);
    const p = { date_from: dateFrom || undefined, date_to: dateTo || undefined };
    Promise.all([
      paymentApi.summary(p),
      paymentApi.byIcdv(p),
    ]).then(([s, i]) => {
      setSummary(s.data);
      setByIcdv(i.data ?? []);
    }).catch(() => setError('Failed to load Payment data.'))
      .finally(() => setLoading(false));
  };

  const loadOverdue = () => {
    paymentApi.overdue({ page: overduePage, limit: 15 }).then(r => {
      setOverdue(r.data.results ?? []);
      setOverdueTotal(r.data.totalResults ?? 0);
      setOverduePages(r.data.totalPages ?? 1);
    }).catch(() => {});
  };

  useEffect(() => { loadCore(); }, []); // eslint-disable-line
  useEffect(() => { loadOverdue(); }, [overduePage]); // eslint-disable-line

  const applyFilters = () => { loadCore(); };

  // ICDV collection rate chart
  const icdvOptions: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
    colors: ['#12B76A', '#F79009'],
    plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3 } },
    dataLabels: { enabled: false },
    xaxis: { categories: byIcdv.map(i => i.icdv_name), labels: { formatter: v => `TZS ${fmtMoney(v)}` } },
    legend: { position: 'top' },
    grid: { borderColor: '#e5e7eb' },
    tooltip: { y: { formatter: (v: number) => `TZS ${fmtMoney(v)}` } },
  };
  const icdvSeries = [
    { name: 'Collected', data: byIcdv.map(i => i.total_collected) },
    { name: 'Outstanding', data: byIcdv.map(i => i.total_outstanding) },
  ];

  if (!isSuperAdmin) return <div className="p-6"><div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 text-sm text-red-700 dark:text-red-400">No access.</div></div>;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Payment &amp; Receivables</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Insights · Invoice collection rates, outstanding amounts, overdue tracking</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-40"><FormDateInput label="From" id="pay-from" value={dateFrom} onChange={setDateFrom} placeholder="Any" /></div>
        <div className="w-40"><FormDateInput label="To" id="pay-to" value={dateTo} onChange={setDateTo} placeholder="Any" /></div>
        <button onClick={applyFilters} className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm">Apply</button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({length:8}).map((_,i) => <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}</div>
      ) : summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Billed" value={`TZS ${fmtMoney(summary.total_billed)}`} sub={`${summary.active_invoices} invoices`}
              tip="Total value of all non-cancelled invoices in the selected period." />
            <StatCard label="Collected" value={`TZS ${fmtMoney(summary.total_collected)}`} sub={`${summary.paid_count} paid`} tone="positive"
              tip="Total amount received — only invoices with status 'paid'." />
            <StatCard label="Outstanding" value={`TZS ${fmtMoney(summary.total_outstanding)}`} sub={`${summary.outstanding_count} unpaid`} tone="warning"
              tip="Invoiced or approved but not yet paid. Money still owed." />
            <StatCard label="Overdue" value={`TZS ${fmtMoney(summary.total_overdue)}`} sub={`${summary.overdue_count} past due date`} tone="negative"
              tip="Unpaid invoices whose due date has already passed." />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="Collection Rate" value={`${summary.collection_rate_pct}%`} tone={summary.collection_rate_pct >= 70 ? 'positive' : 'warning'}
              tip="Percentage of billed amount that has been collected. Higher = better." />
            <StatCard label="Avg Days to Approval" value={summary.avg_days_to_approval !== null ? `${summary.avg_days_to_approval} days` : '—'}
              tip="Average days from invoice issue date to ICDV admin approval." />
            <StatCard label="Avg Days to Payment" value={summary.avg_days_to_payment !== null ? `${summary.avg_days_to_payment} days` : '—'}
              tip="Average days from invoice issue date to marked as paid. Lower = faster payers." />
          </div>
        </>
      )}

      {/* ICDV collected vs outstanding */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Collected vs Outstanding by ICDV</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">How much each ICDV has paid vs still owes.</p>
        {byIcdv.length === 0
          ? <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>
          : <Chart options={icdvOptions} series={icdvSeries} type="bar" height={Math.max(200, byIcdv.length * 45)} />
        }
      </div>

      {/* Per-ICDV table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="p-5 pb-0">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Payment Behaviour by ICDV</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Collection rate and avg payment days per ICDV. Sorted by most outstanding first.</p>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                {['ICDV','Billed','Collected','Outstanding','Overdue','Rate','Avg Days'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {byIcdv.length === 0
                ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No data</td></tr>
                : byIcdv.map(i => (
                    <tr key={i.icdv_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-800 dark:text-white whitespace-nowrap">{i.icdv_name}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtMoney(i.total_billed)}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-green-600 dark:text-green-400 whitespace-nowrap">{fmtMoney(i.total_collected)}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-amber-600 dark:text-amber-400 whitespace-nowrap">{fmtMoney(i.total_outstanding)}</td>
                      <td className="px-4 py-2.5 text-xs text-center">
                        {i.overdue_count > 0 ? <span className="text-red-500 font-semibold">{i.overdue_count}</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-center">
                        <span className={i.collection_rate_pct >= 70 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>{i.collection_rate_pct}%</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-center text-gray-700 dark:text-gray-300">{i.avg_days_to_payment !== null ? (i.avg_days_to_payment < 1 ? '< 1 day' : `${Math.round(i.avg_days_to_payment)} days`) : '—'}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Overdue invoices */}
      {overdueTotal > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="p-5 pb-0 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Overdue Invoices</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{overdueTotal} invoices past their due date, sorted longest overdue first.</p>
            </div>
          </div>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  {['Invoice #','ICDV','Issued','Due Date','Days Overdue','Amount','Status',''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {overdue.map(inv => (
                  <tr key={inv.invoice_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-2.5 font-mono text-xs text-brand-600 dark:text-brand-400">{inv.invoice_number}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-800 dark:text-white">{inv.icdv_name}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(inv.issued_date)}</td>
                    <td className="px-4 py-2.5 text-xs text-red-500 whitespace-nowrap">{fmtDate(inv.due_date)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs font-bold ${inv.days_overdue > 60 ? 'text-red-600 dark:text-red-400' : inv.days_overdue > 30 ? 'text-amber-600 dark:text-amber-400' : 'text-orange-500'}`}>
                        {inv.days_overdue}d
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-right text-gray-800 dark:text-white whitespace-nowrap">{fmtMoney(inv.total_amount)}</td>
                    <td className="px-4 py-2.5 text-xs capitalize text-gray-500 dark:text-gray-400">{inv.status}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => navigate(`/invoices/${inv.invoice_id}`)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {overduePages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500">{overdueTotal} overdue</p>
              <div className="flex gap-2">
                <button onClick={() => setOverduePage(p => Math.max(1, p - 1))} disabled={overduePage === 1} className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-50">Prev</button>
                <button onClick={() => setOverduePage(p => Math.min(overduePages, p + 1))} disabled={overduePage === overduePages} className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
