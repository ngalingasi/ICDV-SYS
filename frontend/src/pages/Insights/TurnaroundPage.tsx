import { useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { turnaroundApi, icdvsApi } from '../../api';
import { useAuth } from '../../store/authStore';
import { FormDateInput } from '../../components/tpfcs/FormField';

const fmtMin = (m: number | null) => {
  if (m === null || m === undefined) return '—';
  const total = Math.round(m);
  const h   = Math.floor(total / 60);
  const min = total % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
};
const fmtDate = (d: string) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button type="button" onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={() => setOpen(false)}
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

function StatCard({ label, value, sub, tone = 'neutral', tip }: { label: string; value: string; sub?: string; tone?: 'positive' | 'negative' | 'neutral'; tip?: string }) {
  const cls = tone === 'positive' ? 'text-green-600 dark:text-green-400'
            : tone === 'negative' ? 'text-red-600 dark:text-red-400'
            : 'text-gray-800 dark:text-white';
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center">
        {label}{tip && <InfoTooltip text={tip} />}
      </p>
      <p className={`text-2xl font-bold mt-1 leading-tight break-words ${cls}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function TurnaroundPage() {
  const { isSuperAdmin } = useAuth();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [months,   setMonths]   = useState(6);
  const [icdvList, setIcdvList] = useState<any[]>([]);
  const [driverIcdvFilter, setDriverIcdvFilter] = useState('');

  // View toggles — 'chart' | 'list' for sections that offer both
  const [driverView, setDriverView] = useState<'chart' | 'list'>('chart');
  const [icdvView,   setIcdvView]   = useState<'chart' | 'list'>('chart');

  const [summary,  setSummary]  = useState<any>(null);
  const [trend,    setTrend]    = useState<any[]>([]);
  const [byIcdv,   setByIcdv]   = useState<any[]>([]);
  const [byDriver, setByDriver] = useState<any[]>([]);
  const [slowest,  setSlowest]  = useState<any[]>([]);
  const [slowestTotal, setSlowestTotal] = useState(0);
  const [slowestPage, setSlowestPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const limit = 15;

  useEffect(() => {
    icdvsApi.list({ limit: 100 }).then(r => setIcdvList(r.data.results ?? [])).catch(() => {});
  }, []);

  const loadCore = () => {
    setLoading(true); setError(null);
    const p = { date_from: dateFrom || undefined, date_to: dateTo || undefined };
    Promise.all([
      turnaroundApi.summary(p),
      turnaroundApi.trend({ months }),
      turnaroundApi.byIcdv(p),
    ]).then(([s, t, i]) => {
      setSummary(s.data);
      setTrend(t.data ?? []);
      setByIcdv(i.data ?? []);
    }).catch(() => setError('Failed to load Transfer Turnaround data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCore(); }, [months]); // eslint-disable-line

  const loadDrivers = () => {
    turnaroundApi.byDriver({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      icdv_id: driverIcdvFilter || undefined,
    }).then(r => setByDriver(r.data ?? [])).catch(() => {});
  };
  useEffect(() => { loadDrivers(); }, [driverIcdvFilter]); // eslint-disable-line

  const loadSlowest = () => {
    turnaroundApi.slowest({
      page: slowestPage, limit,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }).then(r => { setSlowest(r.data.results ?? []); setSlowestTotal(r.data.totalResults ?? 0); }).catch(() => {});
  };
  useEffect(() => { loadSlowest(); }, [slowestPage]); // eslint-disable-line

  const applyFilters = () => { loadCore(); setSlowestPage(1); loadSlowest(); loadDrivers(); };

  if (!isSuperAdmin) return (
    <div className="p-6">
      <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 text-sm text-red-700 dark:text-red-400">
        You don't have access to Insights.
      </div>
    </div>
  );

  // ── Chart options ─────────────────────────────────────────────────────────

  const trendOptions: ApexOptions = {
    chart: { type: 'area', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
    colors: ['#3B82F6'],
    fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.03 } },
    stroke: { curve: 'smooth', width: 2 },
    dataLabels: { enabled: false },
    xaxis: { categories: trend.map(t => fmtMonth(t.month)), labels: { style: { fontSize: '11px' } } },
    yaxis: { labels: { formatter: (v) => `${v}m` } },
    tooltip: { y: { formatter: (v: number) => `${v} min` } },
    grid: { borderColor: '#e5e7eb' },
  };
  const trendSeries = [{ name: 'Avg Turnaround', data: trend.map(t => t.avg_minutes ?? 0) }];

  const icdvOptions: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
    colors: ['#3B82F6', '#12B76A', '#F04438'],
    plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 3 } },
    dataLabels: { enabled: false },
    xaxis: { categories: byIcdv.map(i => i.icdv_name), labels: { formatter: (v) => `${v}m` } },
    legend: { position: 'top' },
    grid: { borderColor: '#e5e7eb' },
    tooltip: { y: { formatter: (v: number) => `${v} min` } },
  };
  const icdvSeries = [
    { name: 'Avg Turnaround',   data: byIcdv.map(i => i.avg_minutes ?? 0) },
    { name: 'Normal Threshold', data: byIcdv.map(i => i.normal_minutes) },
    { name: 'Max Threshold',    data: byIcdv.map(i => i.max_minutes) },
  ];

  // Driver avg turnaround bar chart
  const driverBarOptions: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
    colors: ['#3B82F6', '#12B76A'],
    plotOptions: { bar: { horizontal: false, columnWidth: '60%', borderRadius: 3 } },
    dataLabels: { enabled: false },
    xaxis: { categories: byDriver.map(d => d.driver_name.split(' ')[0]), labels: { style: { fontSize: '10px' }, rotate: -35 } },
    yaxis: [
      { seriesName: 'Avg Turnaround', labels: { formatter: (v) => `${v}m` } },
      { seriesName: 'On-Time %', opposite: true, min: 0, max: 100, labels: { formatter: (v) => `${v}%` } },
    ],
    legend: { position: 'top' },
    grid: { borderColor: '#e5e7eb' },
    tooltip: { y: { formatter: (v: number, { seriesIndex }: any) => seriesIndex === 0 ? `${v} min avg` : `${v}% on-time` } },
  };
  const driverBarSeries = [
    { name: 'Avg Turnaround', type: 'column', data: byDriver.map(d => d.avg_minutes ?? 0) },
    { name: 'On-Time %',      type: 'line',   data: byDriver.map(d => d.on_time_pct) },
  ];

  const slowestTotalPages = Math.max(1, Math.ceil(slowestTotal / limit));

  const ViewToggle = ({ view, setView }: { view: 'chart' | 'list'; setView: (v: 'chart' | 'list') => void }) => (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      {(['chart', 'list'] as const).map(v => (
        <button key={v} onClick={() => setView(v)}
          className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === v ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          {v === 'chart'
            ? <><svg className="mr-1 flex-shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>Chart</>
            : <><svg className="mr-1 flex-shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>List</>
          }
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Transfer Turnaround</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Insights · TPA gate-out → ICDV yard arrival time analysis</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-40"><FormDateInput label="From" id="tt-from" value={dateFrom} onChange={setDateFrom} placeholder="Any" /></div>
        <div className="w-40"><FormDateInput label="To" id="tt-to" value={dateTo} onChange={setDateTo} placeholder="Any" /></div>
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
            <StatCard label="Avg Turnaround" value={fmtMin(summary.avg_minutes)}
              sub="gate-out → yard arrival"
              tip="Mean time from when the driver leaves the TPA gate to when the vehicle is received at the ICDV yard, across all completed transfers." />
            <StatCard label="On Time" value={`${summary.on_time_pct}%`}
              sub={`${summary.on_time} transfers`} tone="positive"
              tip={`Completed within the normal threshold (default ${summary.normal_threshold} min). Green = no issues.`} />
            <StatCard label="Delayed" value={`${summary.delayed_pct}%`}
              sub={`${summary.delayed} transfers`} tone="neutral"
              tip={`Exceeded the normal threshold but within the max (default ${summary.max_threshold} min). Worth monitoring.`} />
            <StatCard label="Very Late" value={`${summary.very_late_pct}%`}
              sub={`${summary.very_late} transfers`} tone="negative"
              tip={`Exceeded the max threshold (default ${summary.max_threshold} min). These are the transfers that need attention.`} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="Total Transfers" value={summary.total_transfers.toLocaleString()} sub={`${summary.completed} completed, ${summary.in_transit_now} in transit`}
              tip="Total transfers in the selected period. In-transit ones are excluded from timing stats." />
            <StatCard label="Fastest Transfer" value={fmtMin(summary.min_minutes)}
              tip="Shortest single gate-to-yard transfer recorded in the period." tone="positive" />
            <StatCard label="Slowest Transfer" value={fmtMin(summary.max_minutes_val)}
              tip="Longest single gate-to-yard transfer recorded in the period." tone="negative" />
          </div>
        </>
      )}

      {/* Trend chart */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Monthly Turnaround Trend</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">Average gate-to-yard time per month — a flat or falling line means improving efficiency.</p>
        {trend.every(t => !t.avg_minutes)
          ? <p className="text-sm text-gray-400 py-8 text-center">No completed transfers in this period</p>
          : <Chart options={trendOptions} series={trendSeries} type="area" height={280} />
        }
      </div>

      {/* ICDV breakdown — chart + list */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-start justify-between flex-wrap gap-2 mb-1">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Avg Turnaround by ICDV</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Each ICDV's average vs their configured Normal and Max thresholds.</p>
          </div>
          <ViewToggle view={icdvView} setView={setIcdvView} />
        </div>

        {byIcdv.length === 0
          ? <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>
          : icdvView === 'chart'
            ? <div className="mt-4"><Chart options={icdvOptions} series={icdvSeries} type="bar" height={Math.max(200, byIcdv.length * 50)} /></div>
            : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      {['ICDV', 'Transfers', 'Avg', 'On Time %', 'Very Late %', 'Normal', 'Max'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {byIcdv.map(i => (
                      <tr key={i.icdv_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-white whitespace-nowrap">{i.icdv_name}</td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-500">{i.completed}</td>
                        <td className="px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-white">{fmtMin(i.avg_minutes)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-semibold ${i.on_time_pct >= 80 ? 'text-green-600 dark:text-green-400' : i.on_time_pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>{i.on_time_pct}%</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-semibold ${i.very_late_pct === 0 ? 'text-green-600 dark:text-green-400' : i.very_late_pct < 10 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>{i.very_late_pct}%</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">{fmtMin(i.normal_minutes)}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">{fmtMin(i.max_minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>

      {/* Driver Performance — chart + list */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="p-5 pb-0 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Driver Performance</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Avg turnaround and on-time % per driver. Sorted fastest first.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={driverIcdvFilter} onChange={e => setDriverIcdvFilter(e.target.value)}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">
              <option value="">All ICDVs</option>
              {icdvList.map(i => <option key={i.icdv_id} value={i.icdv_id}>{i.name}</option>)}
            </select>
            <ViewToggle view={driverView} setView={setDriverView} />
          </div>
        </div>

        {byDriver.length === 0
          ? <p className="text-sm text-gray-400 py-10 text-center">No completed transfers found</p>
          : driverView === 'chart'
            ? (
              <div className="p-5 pt-4">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Bars = avg turnaround (left axis) · Line = on-time % (right axis)</p>
                <Chart options={driverBarOptions} series={driverBarSeries} type="line" height={Math.max(280, byDriver.length * 28)} />
              </div>
            )
            : (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      {['Driver', 'Trips', 'Avg', 'Fastest', 'Slowest', 'On Time %'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {byDriver.map(d => (
                      <tr key={d.driver_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-2.5">
                          <p className="text-sm font-medium text-gray-800 dark:text-white">{d.driver_name}</p>
                          <p className="text-xs text-gray-400">{d.license_number}</p>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-center">{d.completed}</td>
                        <td className="px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-white">{fmtMin(d.avg_minutes)}</td>
                        <td className="px-4 py-2.5 text-xs text-green-600 dark:text-green-400">{fmtMin(d.fastest_minutes)}</td>
                        <td className="px-4 py-2.5 text-xs text-red-500">{fmtMin(d.slowest_minutes)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-semibold ${d.on_time_pct >= 80 ? 'text-green-600 dark:text-green-400' : d.on_time_pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
                            {d.on_time_pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>

      {/* Slowest / exceeded-threshold transfers table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="p-5 pb-0">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Transfers That Exceeded Max Threshold</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Individual transfers that went over their ICDV's configured maximum time, sorted slowest first.</p>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['Chassis', 'ICDV', 'Driver', 'Departed TPA', 'Arrived Yard', 'Taken', 'Threshold', 'Over By'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {slowest.length === 0
                ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No transfers exceeded the max threshold in this period</td></tr>
                : slowest.map(t => (
                    <tr key={t.transfer_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-4 py-2.5 font-mono text-xs text-brand-600 dark:text-brand-400">{t.chassis_number}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">{t.icdv_name}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">{t.driver_name}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(t.transferred_at)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(t.completed_at)}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-white">{fmtMin(t.minutes_taken)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{fmtMin(t.max_threshold)}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-semibold text-red-600 dark:text-red-400">+{fmtMin(t.minutes_over)}</span>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {slowestTotalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500">Page {slowestPage} of {slowestTotalPages} · {slowestTotal} transfers</p>
            <div className="flex gap-2">
              <button onClick={() => setSlowestPage(p => Math.max(1, p - 1))} disabled={slowestPage === 1}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-50">Prev</button>
              <button onClick={() => setSlowestPage(p => Math.min(slowestTotalPages, p + 1))} disabled={slowestPage === slowestTotalPages}
                className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
