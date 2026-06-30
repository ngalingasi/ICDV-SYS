import { useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { fleetApi } from '../../api';
import { useAuth } from '../../store/authStore';

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STEP_COLORS: Record<string, string> = {
  manifested: 'bg-gray-400 dark:bg-gray-500',
  discharged: 'bg-blue-400 dark:bg-blue-500',
  batched:    'bg-amber-400 dark:bg-amber-500',
  in_transit: 'bg-purple-400 dark:bg-purple-500',
  received:   'bg-green-400 dark:bg-green-500',
};
const STEP_LABEL: Record<string, string> = {
  manifested: 'Manifested', discharged: 'Discharged',
  batched: 'Batched', in_transit: 'In Transit', received: 'Received',
};
const STEPS = ['manifested','discharged','batched','in_transit','received'] as const;

function ViewToggle({ view, setView }: { view: 'chart' | 'list'; setView: (v: 'chart' | 'list') => void }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      {(['chart','list'] as const).map(v => (
        <button key={v} onClick={() => setView(v)}
          className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === v ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
          {v === 'chart'
            ? <><svg className="mr-1 flex-shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>Chart</>
            : <><svg className="mr-1 flex-shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>List</>
          }
        </button>
      ))}
    </div>
  );
}

export default function FleetPipelinePage() {
  const { isSuperAdmin } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [byIcdv,  setByIcdv]  = useState<any[]>([]);
  const [stale,   setStale]   = useState<any[]>([]);
  const [staleTotal,setStaleTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [icdvView, setIcdvView] = useState<'chart' | 'list'>('chart');

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      fleetApi.summary(),
      fleetApi.byIcdv(),
      fleetApi.stale({ limit: 20 }),
    ]).then(([s, i, st]) => {
      setSummary(s.data);
      setByIcdv(i.data ?? []);
      setStale(st.data.results ?? []);
      setStaleTotal(st.data.totalResults ?? 0);
    }).catch(() => setError('Failed to load Fleet Pipeline data.'))
      .finally(() => setLoading(false));
  }, []);

  if (!isSuperAdmin) return <div className="p-6"><div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 text-sm text-red-700 dark:text-red-400">No access.</div></div>;

  const stackedOptions: ApexOptions = {
    chart: { type: 'bar', stacked: true, toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
    colors: ['#9CA3AF','#60A5FA','#FBBF24','#A78BFA','#34D399'],
    plotOptions: { bar: { horizontal: true, barHeight: '60%' } },
    dataLabels: { enabled: false },
    xaxis: { categories: byIcdv.map(i => i.icdv_name) },
    legend: { position: 'top' },
    grid: { borderColor: '#e5e7eb' },
    tooltip: { y: { formatter: (v: number) => `${v} vehicles` } },
  };
  const stackedSeries = STEPS.map(s => ({
    name: STEP_LABEL[s],
    data: byIcdv.map(i => i[s] ?? 0),
  }));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Fleet Pipeline</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Insights · Where vehicles are in the workflow right now</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {/* Pipeline summary — visual funnel cards */}
      {loading ? (
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">{Array.from({length:5}).map((_,i) => <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}</div>
      ) : summary && (
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
          {STEPS.map(s => {
            const count = summary[s] ?? 0;
            const pct   = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
            return (
              <div key={s} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-center">
                <div className={`w-3 h-3 rounded-full ${STEP_COLORS[s]} mx-auto mb-2`} />
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{STEP_LABEL[s]}</p>
                <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{count.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">{pct}% of total</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Stale alerts */}
      {summary && (summary.stale_discharged > 0 || summary.stale_batched > 0) && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 px-5 py-4 flex flex-wrap gap-4">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 w-full">⚠ Vehicles stuck in a step for more than 3 days</p>
          {summary.stale_discharged > 0 && <p className="text-sm text-amber-700 dark:text-amber-300"><strong>{summary.stale_discharged}</strong> vehicles stale in Discharged (not batched)</p>}
          {summary.stale_batched > 0   && <p className="text-sm text-amber-700 dark:text-amber-300"><strong>{summary.stale_batched}</strong> vehicles stale in Batched (not transferred)</p>}
        </div>
      )}

      {/* By ICDV */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-start justify-between flex-wrap gap-2 mb-1">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Pipeline by ICDV</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Vehicle count at each workflow step per ICDV.</p>
          </div>
          <ViewToggle view={icdvView} setView={setIcdvView} />
        </div>
        {byIcdv.length === 0
          ? <p className="text-sm text-gray-400 py-8 text-center">No data yet</p>
          : icdvView === 'chart'
            ? <div className="mt-4"><Chart options={stackedOptions} series={stackedSeries} type="bar" height={Math.max(200, byIcdv.length * 45)} /></div>
            : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      {['ICDV','Total','Manifested','Discharged','Batched','In Transit','Received'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {byIcdv.map(i => (
                      <tr key={i.icdv_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-white">{i.icdv_name}</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-gray-800 dark:text-white text-center">{i.total}</td>
                        <td className="px-4 py-2.5 text-xs text-center text-gray-500 dark:text-gray-400">{i.manifested}</td>
                        <td className="px-4 py-2.5 text-xs text-center text-blue-600 dark:text-blue-400">{i.discharged}</td>
                        <td className="px-4 py-2.5 text-xs text-center text-amber-600 dark:text-amber-400">{i.batched}</td>
                        <td className="px-4 py-2.5 text-xs text-center text-purple-600 dark:text-purple-400">{i.in_transit}</td>
                        <td className="px-4 py-2.5 text-xs text-center text-green-600 dark:text-green-400">{i.received}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>

      {/* Stale vehicles table */}
      {staleTotal > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="p-5 pb-0">
            <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Stale Vehicles (3+ days without progress)</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{staleTotal} vehicles stuck in Discharged or Batched. Sorted most stale first.</p>
          </div>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  {['Chassis','Brand / Model','ICDV','Manifest','Status','Days Stale'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {stale.map(v => (
                  <tr key={v.vehicle_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-2.5 font-mono text-xs text-brand-600 dark:text-brand-400">{v.chassis_number}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300">{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300">{v.icdv_name}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-500 dark:text-gray-400">{v.manifest_number}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${v.workflow_status === 'batched' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'}`}>
                        {v.workflow_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-bold ${v.days_stale > 7 ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'}`}>{v.days_stale}d</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
