import { useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { insightsApi, icdvsApi } from '../../api';
import { useAuth } from '../../store/authStore';
import { FormDateInput } from '../../components/tpfcs/FormField';

const fmtMoney = (n: any) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate  = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        aria-label="More info"
        className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 text-[9px] font-bold leading-none hover:border-brand-500 hover:text-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
      >
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

function SummaryCard({ label, value, sub, explanation, tone = 'neutral' }: { label: string; value: string; sub?: string; explanation?: string; tone?: 'positive' | 'negative' | 'neutral' }) {
  const toneCls = tone === 'positive' ? 'text-green-600 dark:text-green-400'
                : tone === 'negative' ? 'text-red-600 dark:text-red-400'
                : 'text-gray-800 dark:text-white';
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center">
        {label}
        {explanation && <InfoTooltip text={explanation} />}
      </p>
      <p className={`text-2xl font-bold mt-1 ${toneCls}`}>TZS {value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function ProfitLossPage() {
  const { isSuperAdmin } = useAuth();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [months,   setMonths]   = useState(6);

  const [summary,  setSummary]  = useState<any>(null);
  const [byIcdv,   setByIcdv]   = useState<any[]>([]);
  const [trend,    setTrend]    = useState<any[]>([]);
  const [statusTrend, setStatusTrend] = useState<any[]>([]);
  const [manifests,setManifests]= useState<any[]>([]);
  const [manifestTotal, setManifestTotal] = useState(0);
  const [manifestPage, setManifestPage]   = useState(1);
  const [manifestSearch, setManifestSearch] = useState('');
  const [icdvFilter, setIcdvFilter] = useState('');
  const [icdvList,  setIcdvList]  = useState<any[]>([]);

  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const limit = 15;

  useEffect(() => {
    icdvsApi.list({ limit: 200, is_active: 1 }).then(r => setIcdvList(r.data.results ?? [])).catch(() => {});
  }, []);

  const loadCore = () => {
    setLoading(true); setError(null);
    const dateParams = { date_from: dateFrom || undefined, date_to: dateTo || undefined };
    Promise.all([
      insightsApi.profitSummary(dateParams),
      insightsApi.profitByIcdv(dateParams),
      insightsApi.profitTrend({ months }),
      insightsApi.revenueByStatusTrend({ months }),
    ]).then(([s, i, t, st]) => {
      setSummary(s.data);
      setByIcdv(i.data ?? []);
      setTrend(t.data ?? []);
      setStatusTrend(st.data ?? []);
    }).catch(() => setError('Failed to load Profit & Loss data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCore(); }, [months]); // eslint-disable-line

  const loadManifests = () => {
    insightsApi.profitByManifest({
      page: manifestPage, limit,
      icdv_id: icdvFilter || undefined,
      search: manifestSearch || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }).then(r => { setManifests(r.data.results); setManifestTotal(r.data.totalResults); }).catch(() => {});
  };
  useEffect(() => { loadManifests(); }, [manifestPage, icdvFilter]); // eslint-disable-line

  const applyFilters = () => { loadCore(); setManifestPage(1); loadManifests(); };

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 text-sm text-red-700 dark:text-red-400">
          You don't have access to Insights.
        </div>
      </div>
    );
  }

  const trendOptions: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif', stacked: false },
    colors: ['#12B76A', '#F79009', '#3B82F6'],
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 2, colors: ['transparent'] },
    xaxis: { categories: trend.map(t => fmtMonth(t.month)), labels: { style: { fontSize: '11px' } } },
    yaxis: { labels: { formatter: (v) => fmtMoney(v) } },
    legend: { position: 'top', horizontalAlign: 'left' },
    grid: { borderColor: '#e5e7eb' },
    tooltip: { y: { formatter: (v: number) => `TZS ${fmtMoney(v)}` } },
  };
  const trendSeries = [
    { name: 'Paid Revenue', data: trend.map(t => t.paid_revenue) },
    { name: 'Expenses',     data: trend.map(t => t.total_expenses) },
    { name: 'Paid Profit',  data: trend.map(t => t.paid_profit) },
  ];

  // Smooth, layered area chart — mirrors the Paid/Outstanding/Cancelled
  // breakdown style, stacked so the bands sit on top of one another.
  const statusTrendOptions: ApexOptions = {
    chart: { type: 'area', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif', stacked: true },
    colors: ['#12B76A', '#F79009', '#F04438'],
    fill: { type: 'gradient', gradient: { opacityFrom: 0.45, opacityTo: 0.05 } },
    stroke: { curve: 'smooth', width: 2 },
    dataLabels: { enabled: false },
    xaxis: { categories: statusTrend.map(t => fmtMonth(t.month)), labels: { style: { fontSize: '11px' } } },
    yaxis: { labels: { formatter: (v) => fmtMoney(v) } },
    legend: { position: 'top', horizontalAlign: 'left' },
    grid: { borderColor: '#e5e7eb' },
    tooltip: { y: { formatter: (v: number) => `TZS ${fmtMoney(v)}` } },
  };
  const statusTrendSeries = [
    { name: 'Paid',        data: statusTrend.map(t => t.paid) },
    { name: 'Outstanding', data: statusTrend.map(t => t.outstanding) },
    { name: 'Cancelled',   data: statusTrend.map(t => t.cancelled) },
  ];

  const icdvChartOptions: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
    colors: ['#12B76A', '#F79009'],
    plotOptions: { bar: { horizontal: true, barHeight: '60%', borderRadius: 3 } },
    dataLabels: { enabled: false },
    xaxis: { categories: byIcdv.slice(0, 8).map(i => i.icdv_name), labels: { formatter: (v) => fmtMoney(Number(v)) } },
    legend: { position: 'top', horizontalAlign: 'left' },
    grid: { borderColor: '#e5e7eb' },
    tooltip: { y: { formatter: (v: number) => `TZS ${fmtMoney(v)}` } },
  };
  const icdvChartSeries = [
    { name: 'Paid Revenue', data: byIcdv.slice(0, 8).map(i => i.paid_revenue) },
    { name: 'Expenses',     data: byIcdv.slice(0, 8).map(i => i.total_expenses) },
  ];

  const manifestTotalPages = Math.max(1, Math.ceil(manifestTotal / limit));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Profit &amp; Loss</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Insights · Revenue vs Expenses across all ICDVs</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-40">
          <FormDateInput label="From" id="pl-date-from" value={dateFrom} onChange={setDateFrom} placeholder="Any" />
        </div>
        <div className="w-40">
          <FormDateInput label="To" id="pl-date-to" value={dateTo} onChange={setDateTo} placeholder="Any" />
        </div>
        <button onClick={applyFilters} className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm">Apply</button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500">Trend:</span>
          {[3, 6, 12].map(m => (
            <button key={m} onClick={() => setMonths(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${months === m ? 'bg-brand-500 text-white' : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
              {m}mo
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
        </div>
      ) : summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Billed Revenue" value={fmtMoney(summary.billed_revenue)} sub={`${summary.invoice_count} invoices`}
              explanation="Total of every invoice issued (any status except cancelled) — what you've billed, whether or not it's been paid yet." />
            <SummaryCard label="Paid Revenue" value={fmtMoney(summary.paid_revenue)} sub={`${summary.paid_count} paid`} tone="positive"
              explanation="Total of only the invoices marked 'paid' — money actually collected." />
            <SummaryCard label="Outstanding" value={fmtMoney(summary.outstanding)} sub={`${summary.outstanding_count} unpaid`} tone="negative"
              explanation="Billed Revenue minus Paid Revenue — invoices issued or approved but not yet paid. Money still owed to you." />
            <SummaryCard label="Total Expenses" value={fmtMoney(summary.total_expenses)} sub={`${summary.expense_count} expenses`} tone="negative"
              explanation="Sum of all recorded operational expenses for the selected period." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SummaryCard label="Billed Profit (on paper)" value={fmtMoney(summary.billed_profit)}
              sub={`${summary.billed_margin_pct}% margin`} tone={summary.billed_profit >= 0 ? 'positive' : 'negative'}
              explanation="Billed Revenue minus Expenses — profit based on what's been invoiced, even if not all paid yet. Margin = Profit ÷ Revenue × 100." />
            <SummaryCard label="Paid Profit (realized)" value={fmtMoney(summary.paid_profit)}
              sub={`${summary.paid_margin_pct}% margin`} tone={summary.paid_profit >= 0 ? 'positive' : 'negative'}
              explanation="Paid Revenue minus Expenses — actual cash profit, only money really collected. Margin = Profit ÷ Revenue × 100." />
          </div>
        </>
      )}

      {/* Trend chart */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Profit Trend</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">Month-by-month Paid Revenue, Expenses, and the Paid Profit left over once expenses are subtracted.</p>
        {trend.length === 0
          ? <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>
          : <Chart options={trendOptions} series={trendSeries} type="bar" height={300} />
        }
      </div>

      {/* Monthly Revenue Trend by status (Paid / Outstanding / Cancelled) */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Monthly Revenue Trend</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">How billed revenue breaks down by status each month — what's been collected, what's still owed, and what fell through.</p>
        {statusTrend.length === 0
          ? <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>
          : <Chart options={statusTrendOptions} series={statusTrendSeries} type="area" height={320} />
        }
      </div>

      {/* Profit by ICDV */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Revenue vs Expenses by ICDV</h2>
          {byIcdv.length === 0
            ? <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>
            : <Chart options={icdvChartOptions} series={icdvChartSeries} type="bar" height={Math.max(220, byIcdv.length * 35)} />
          }
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide p-5 pb-0">Profit by ICDV</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 px-5 mt-1">Profit = Paid Revenue − Expenses. Margin = Profit ÷ Paid Revenue, as a %.</p>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {['ICDV', 'Paid Rev.', 'Expenses', 'Profit', 'Margin'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {byIcdv.length === 0
                  ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No data yet</td></tr>
                  : byIcdv.map(i => (
                      <tr key={i.icdv_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-2.5 text-xs text-gray-800 dark:text-white whitespace-nowrap">{i.icdv_name}</td>
                        <td className="px-4 py-2.5 text-xs text-right text-gray-600 dark:text-gray-400">{fmtMoney(i.paid_revenue)}</td>
                        <td className="px-4 py-2.5 text-xs text-right text-gray-600 dark:text-gray-400">{fmtMoney(i.total_expenses)}</td>
                        <td className={`px-4 py-2.5 text-xs text-right font-semibold ${i.paid_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {fmtMoney(i.paid_profit)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right text-gray-500">{i.paid_margin_pct}%</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Profit by manifest */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="p-5 pb-0 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Profit by Manifest</h2>
          <div className="flex gap-2">
            <input value={manifestSearch} onChange={e => setManifestSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (setManifestPage(1), loadManifests())}
              placeholder="Search manifest, ICDV, vessel…"
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 w-56" />
            <select value={icdvFilter} onChange={e => { setIcdvFilter(e.target.value); setManifestPage(1); }}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">
              <option value="">All ICDVs</option>
              {icdvList.map(i => <option key={i.icdv_id} value={i.icdv_id}>{i.name}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 px-5 mt-2">One row per shipment. A manifest with no invoice yet shows pure cost; one with no expense recorded shows pure profit on what's been paid.</p>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['Manifest', 'Date', 'ICDV', 'Vessel', 'Paid Rev.', 'Expenses', 'Profit'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {manifests.length === 0
                ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">No manifests with invoice or expense data found</td></tr>
                : manifests.map(m => (
                    <tr key={m.manifest_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-4 py-2.5 text-xs font-mono text-brand-600 dark:text-brand-400 whitespace-nowrap">{m.manifest_number}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(m.arrival_date)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-800 dark:text-white whitespace-nowrap">{m.icdv_name}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{m.vessel_name}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-gray-600 dark:text-gray-400">{fmtMoney(m.paid_revenue)}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-gray-600 dark:text-gray-400">{fmtMoney(m.total_expenses)}</td>
                      <td className={`px-4 py-2.5 text-xs text-right font-semibold ${m.paid_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmtMoney(m.paid_profit)}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {manifestTotalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500">Page {manifestPage} of {manifestTotalPages} · {manifestTotal} manifests</p>
            <div className="flex gap-2">
              <button onClick={() => setManifestPage(p => Math.max(1, p - 1))} disabled={manifestPage === 1}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-50">Prev</button>
              <button onClick={() => setManifestPage(p => Math.min(manifestTotalPages, p + 1))} disabled={manifestPage === manifestTotalPages}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
