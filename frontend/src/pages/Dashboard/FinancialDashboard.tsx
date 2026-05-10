import { useEffect, useState } from 'react';
import { financialApi, projectsApi } from '../../api';

const fmt  = (n: any) => `TZS ${Number(n || 0).toLocaleString()}`;
const fmtK = (n: any) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `TZS ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `TZS ${(v / 1_000).toFixed(0)}K`;
  return `TZS ${v.toLocaleString()}`;
};
const pct = (a: any, b: any) => (b > 0 ? Math.round((Number(a) / Number(b)) * 100) : 0);

const MONTH_LABELS: Record<string, string> = {};
for (let i = 0; i < 12; i++) {
  const d = new Date(); d.setMonth(d.getMonth() - i);
  MONTH_LABELS[d.toISOString().slice(0, 7)] =
    d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export default function FinancialDashboard() {
  const [data,      setData]      = useState<any>(null);
  const [projects,  setProjects]  = useState<{ project_id: number; name: string }[]>([]);
  const [projectId, setProjectId] = useState<number | ''>('');
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    projectsApi.list({ limit: 100 })
      .then(r => setProjects(r.data.results))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    financialApi.summary(projectId || undefined)
      .then((r: any) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 ${className}`}>
      {children}
    </div>
  );
  const STitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{children}</h2>
  );

  if (loading || !data) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
      {[1,2,3].map(i => <div key={i} className="h-44 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
    </div>
  );

  const { totals, buckets, pay_status, cash_flow, revisions, top_spend } = data;
  const usedPct   = pct(totals.total_paid, totals.total_budget);
  const bucketMap: Record<string, any> = {};
  (buckets as any[]).forEach(b => { bucketMap[b.bucket] = b; });

  // Build 12-month cash flow grid
  const months = Object.keys(MONTH_LABELS).reverse();
  const cfMap: Record<string, number> = {};
  (cash_flow as any[]).forEach(m => { cfMap[m.month] = Number(m.amount); });
  const maxCF = Math.max(...months.map(m => cfMap[m] || 0), 1);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Financial Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{totals.activity_count} activities tracked</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">Project:</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value ? Number(e.target.value) : '')}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400 min-w-[200px]">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Row 1: Top Summary ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Budget',    value: fmtK(totals.total_budget), sub: `${totals.activity_count} activities`,  color: 'text-gray-800 dark:text-white',        bg: 'bg-gray-50 dark:bg-gray-800/50', icon: '📊' },
          { label: 'Total Spent',     value: fmtK(totals.total_paid),   sub: `${usedPct}% of budget`,                color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-500/10',  icon: '💸' },
          { label: 'Remaining',       value: fmtK(totals.remaining),    sub: `${100 - usedPct}% available`,          color: totals.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400', bg: totals.remaining < 0 ? 'bg-red-50 dark:bg-red-500/10' : 'bg-green-50 dark:bg-green-500/10', icon: '🏦' },
          { label: 'Utilisation',     value: `${usedPct}%`,             sub: usedPct >= 90 ? 'Critical' : usedPct >= 70 ? 'High' : 'Normal', color: usedPct >= 90 ? 'text-red-600 dark:text-red-400' : usedPct >= 70 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400', bg: 'bg-gray-50 dark:bg-gray-800/50', icon: '📈' },
        ].map(m => (
          <Card key={m.label} className={m.bg}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{m.label}</p>
            <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>
          </Card>
        ))}
      </div>

      {/* ── Row 2: Budget vs Actual + Revision Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Budget vs Actual */}
        <Card className="lg:col-span-2">
          <STitle>Budget vs Actual Spend</STitle>
          <div className="space-y-4">
            {[
              { label: 'Budget',   value: totals.total_budget, color: '#378ADD', pctVal: 100 },
              { label: 'Spent',    value: totals.total_paid,   color: '#1D9E75', pctVal: usedPct },
              { label: 'Pending', value: pay_status.pending,  color: '#BA7517', pctVal: pct(pay_status.pending, totals.total_budget) },
            ].map(row => (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{row.label}</span>
                  <span className="text-xs font-semibold text-gray-800 dark:text-white">{fmt(row.value)}</span>
                </div>
                <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(row.pctVal, 100)}%`, background: row.color }} />
                </div>
              </div>
            ))}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500">Variance (Under/Over budget)</span>
              <span className={`text-sm font-semibold ${Number(totals.remaining) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {Number(totals.remaining) >= 0 ? '▼ Under ' : '▲ Over '}{fmt(Math.abs(totals.remaining))}
              </span>
            </div>
          </div>
        </Card>

        {/* Budget Revisions */}
        <Card>
          <STitle>Budget Revisions</STitle>
          <div className="space-y-3">
            {[
              { label: 'Total Revisions', value: revisions.total_revisions, color: 'text-gray-800 dark:text-white' },
              { label: 'Approved',        value: revisions.approved_revisions, color: 'text-green-600 dark:text-green-400' },
              { label: 'Pending Review',  value: revisions.pending_revisions,  color: 'text-orange-600 dark:text-orange-400' },
              { label: 'Rejected',        value: revisions.rejected_revisions, color: 'text-red-500 dark:text-red-400' },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{r.label}</span>
                <span className={`text-sm font-bold ${r.color}`}>{r.value}</span>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-400 mb-0.5">Net approved revision</p>
              <p className={`text-sm font-semibold ${Number(revisions.approved_revision_total) >= 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                {Number(revisions.approved_revision_total) >= 0 ? '+' : ''}{fmt(revisions.approved_revision_total)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Row 3: Spending Breakdown + Payment Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Activity financial status */}
        <Card>
          <STitle>Activity Financial Status</STitle>
          <div className="space-y-3">
            {[
              { key: 'over_budget',   label: 'Over Budget',    color: '#E24B4A', bg: 'bg-red-50 dark:bg-red-500/10' },
              { key: 'fully_spent',   label: 'Fully Spent',    color: '#1D9E75', bg: 'bg-green-50 dark:bg-green-500/10' },
              { key: 'within_budget', label: 'Within Budget',  color: '#378ADD', bg: 'bg-blue-50 dark:bg-blue-500/10' },
              { key: 'no_spend',      label: 'No Spend Yet',   color: '#888780', bg: 'bg-gray-50 dark:bg-gray-800/50' },
            ].map(b => {
              const d = bucketMap[b.key] || { count: 0, budget: 0, paid: 0 };
              const totalActs = totals.activity_count || 1;
              return (
                <div key={b.key} className={`flex items-center justify-between p-3 rounded-lg ${b.bg}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: b.color }} />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{b.label}</p>
                      <p className="text-xs text-gray-400">{fmt(d.paid)} spent</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-800 dark:text-white">{d.count}</p>
                    <p className="text-xs text-gray-400">{pct(d.count, totalActs)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Payment Status */}
        <Card>
          <STitle>Payment Status</STitle>
          <div className="space-y-4">
            {[
              { label: 'Approved (Paid)', amount: pay_status.approved, count: pay_status.approved_count, color: '#1D9E75', barColor: 'bg-green-500' },
              { label: 'Pending',         amount: pay_status.pending,  count: pay_status.pending_count,  color: '#BA7517', barColor: 'bg-orange-500' },
              { label: 'Rejected',        amount: pay_status.rejected, count: pay_status.rejected_count, color: '#E24B4A', barColor: 'bg-red-500' },
            ].map(ps => {
              const total = Number(pay_status.approved) + Number(pay_status.pending) + Number(pay_status.rejected) || 1;
              return (
                <div key={ps.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: ps.color }} />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{ps.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">{fmt(ps.amount)}</span>
                      <span className="text-xs text-gray-400 ml-2">({ps.count})</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${ps.barColor}`}
                      style={{ width: `${pct(ps.amount, total)}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-400">Total payments processed</span>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                {Number(pay_status.approved_count) + Number(pay_status.pending_count) + Number(pay_status.rejected_count)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Row 4: Cash Flow ── */}
      <Card>
        <STitle>Cash Flow — Monthly Spend (last 12 months)</STitle>
        {months.every(m => !cfMap[m]) ? (
          <p className="text-sm text-gray-400 text-center py-8">No approved payments recorded yet</p>
        ) : (
          <div className="flex items-end gap-1.5 h-36">
            {months.map((m, i) => {
              const val  = cfMap[m] || 0;
              const barH = Math.max(Math.round((val / maxCF) * 100), val > 0 ? 3 : 1);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5" title={`${MONTH_LABELS[m]}: ${fmt(val)}`}>
                  <span className="text-[9px] text-gray-400 leading-none">{val > 0 ? fmtK(val).replace('TZS ','') : ''}</span>
                  <div className="w-full rounded-t transition-all"
                    style={{ height: `${barH}%`, minHeight: val > 0 ? '4px' : '2px',
                      background: val > 0 ? '#378ADD' : '#e5e7eb' }} />
                  <span className="text-[9px] text-gray-400 truncate w-full text-center">{MONTH_LABELS[m]}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Row 5: Top Activities by Spend ── */}
      <Card>
        <STitle>Top Activities by Spend</STitle>
        {(top_spend as any[]).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No payments recorded</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400">
                  <th className="text-left py-2 pr-4 font-medium">Activity</th>
                  <th className="text-right py-2 pr-4 font-medium">Budget</th>
                  <th className="text-right py-2 pr-4 font-medium">Spent</th>
                  <th className="text-right py-2 pr-4 font-medium">Remaining</th>
                  <th className="text-right py-2 font-medium">Utilisation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {(top_spend as any[]).map(a => {
                  const u = pct(a.total_paid, a.effective_budget);
                  const isOver = Number(a.total_paid) > Number(a.effective_budget);
                  return (
                    <tr key={a.activity_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-gray-800 dark:text-white truncate max-w-[220px]">{a.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          a.budget_status === 'over_budget' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                          : a.budget_status === 'no_spend'  ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                        }`}>{a.budget_status.replace('_',' ')}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-right text-xs text-gray-600 dark:text-gray-400">{fmt(a.effective_budget)}</td>
                      <td className="py-2.5 pr-4 text-right text-xs font-medium text-gray-800 dark:text-white">{fmt(a.total_paid)}</td>
                      <td className={`py-2.5 pr-4 text-right text-xs font-medium ${isOver ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {isOver ? '-' : ''}{fmt(Math.abs(a.remaining))}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${Math.min(u, 100)}%`,
                              background: isOver ? '#E24B4A' : u >= 80 ? '#BA7517' : '#1D9E75',
                            }} />
                          </div>
                          <span className={`text-xs w-8 text-right ${isOver ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                            {u}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
