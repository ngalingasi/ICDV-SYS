import { useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { vesselsInsightsApi } from '../../api';
import { useAuth } from '../../store/authStore';

const fmtDate  = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};

const STATUS_BADGE: Record<string, string> = {
  expected:   'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  arrived:    'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  processing: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  completed:  'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  departed:   'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function VesselProductivityPage() {
  const { isSuperAdmin } = useAuth();
  const [months,  setMonths]  = useState(6);
  const [status,  setStatus]  = useState('');
  const [page,    setPage]    = useState(1);
  const [summary, setSummary] = useState<any>(null);
  const [vessels, setVessels] = useState<any[]>([]);
  const [vesselTotal, setVesselTotal] = useState(0);
  const [vesselPages, setVesselPages] = useState(1);
  const [trend,   setTrend]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = () => {
    setLoading(true); setError(null);
    Promise.all([
      vesselsInsightsApi.summary(),
      vesselsInsightsApi.trend({ months }),
    ]).then(([s, t]) => {
      setSummary(s.data);
      setTrend(t.data ?? []);
    }).catch(() => setError('Failed to load Vessel Productivity data.'))
      .finally(() => setLoading(false));
  };

  const loadVessels = () => {
    vesselsInsightsApi.list({ page, limit: 20, status: status || undefined }).then(r => {
      setVessels(r.data.results ?? []);
      setVesselTotal(r.data.totalResults ?? 0);
      setVesselPages(r.data.totalPages ?? 1);
    }).catch(() => {});
  };

  useEffect(() => { load(); }, [months]); // eslint-disable-line
  useEffect(() => { loadVessels(); }, [page, status]); // eslint-disable-line

  if (!isSuperAdmin) return <div className="p-6"><div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 text-sm text-red-700 dark:text-red-400">No access.</div></div>;

  const trendOptions: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
    colors: ['#3B82F6', '#12B76A', '#F79009'],
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } },
    dataLabels: { enabled: false },
    xaxis: { categories: trend.map(t => fmtMonth(t.month)), labels: { style: { fontSize: '11px' } } },
    legend: { position: 'top' },
    grid: { borderColor: '#e5e7eb' },
    tooltip: { y: { formatter: (v: number, { seriesIndex }: any) => seriesIndex === 0 ? `${v} vessels` : seriesIndex === 1 ? `${v} manifests` : `${v} vehicles` } },
  };
  const trendSeries = [
    { name: 'Vessels Arrived', data: trend.map(t => t.vessels) },
    { name: 'Manifests',       data: trend.map(t => t.manifests) },
    { name: 'Vehicles',        data: trend.map(t => t.vehicles) },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Vessel Productivity</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Insights · Vessel throughput, manifests, and vehicle volumes</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({length:6}).map((_,i) => <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}</div>
      ) : summary && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Total Vessels"    value={summary.total_vessels.toLocaleString()} sub={`${summary.active_now} active right now`} />
          <StatCard label="Expected"         value={summary.expected.toLocaleString()} sub="arriving soon" />
          <StatCard label="Active (Arrived / Processing)" value={summary.active_now.toLocaleString()} sub={`${summary.arrived} arrived · ${summary.processing} processing`} />
          <StatCard label="Completed"        value={summary.completed.toLocaleString()} sub="fully processed" />
          <StatCard label="Total Vehicles"   value={summary.total_vehicles.toLocaleString()} sub="across all manifests" />
          <StatCard label="Avg Vehicles / Vessel" value={summary.avg_vehicles_per_vessel?.toLocaleString() ?? '—'} sub="all time" />
        </div>
      )}

      {/* Monthly trend */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Monthly Volume Trend</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Vessels arrived, manifests, and vehicles per month.</p>
          </div>
          <div className="flex items-center gap-2">
            {[3, 6, 12].map(m => (
              <button key={m} onClick={() => setMonths(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${months === m ? 'bg-brand-500 text-white' : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                {m}mo
              </button>
            ))}
          </div>
        </div>
        {trend.length === 0
          ? <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>
          : <Chart options={trendOptions} series={trendSeries} type="bar" height={280} />
        }
      </div>

      {/* Vessel list */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="p-5 pb-0 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">All Vessels</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Vehicle count, completion %, and manifest count per vessel.</p>
          </div>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">
            <option value="">All Statuses</option>
            {['expected','arrived','processing','completed','departed'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                {['Vessel','Arrival Date','Status','Manifests','Vehicles','Received','Completion'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {vessels.length === 0
                ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">No vessels found</td></tr>
                : vessels.map(v => (
                    <tr key={v.vessel_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-gray-800 dark:text-white text-sm">{v.name}</p>
                        {v.shipping_line && <p className="text-xs text-gray-400">{v.shipping_line}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(v.arrival_date)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[v.status] ?? ''}`}>{v.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-center text-gray-700 dark:text-gray-300">{v.manifest_count}</td>
                      <td className="px-4 py-2.5 text-xs text-center text-gray-700 dark:text-gray-300">{v.vehicle_count}</td>
                      <td className="px-4 py-2.5 text-xs text-center text-green-600 dark:text-green-400">{v.received_count}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden min-w-[40px]">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${v.completion_pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-400 w-8 text-right">{v.completion_pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {vesselPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500">{vesselTotal} vessels</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-50">Prev</button>
              <button onClick={() => setPage(p => Math.min(vesselPages, p + 1))} disabled={page === vesselPages} className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
