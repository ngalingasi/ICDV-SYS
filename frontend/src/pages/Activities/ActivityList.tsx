import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { activitiesApi } from '../../api';
import type { Activity, PaginatedResponse, ActivityStatus } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import BudgetBar from '../../components/tpfcs/BudgetBar';

const STATUS_OPTIONS: ActivityStatus[] = ['pending','in_progress','on_hold','completed','cancelled','overdue'];

// ── Sub-activities expand row ─────────────────────────────────────────────────
function SubActivities({ parentId }: { parentId: number }) {
  const [subs,    setSubs]    = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    activitiesApi.getSubActivities(parentId)
      .then(r => setSubs(r.data))
      .finally(() => setLoading(false));
  }, [parentId]);

  if (loading) return (
    <div className="ml-6 mt-2 space-y-2">
      {[1,2].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
    </div>
  );

  if (!subs.length) return (
    <p className="ml-6 mt-2 text-xs text-gray-400 py-2">No sub-activities</p>
  );

  return (
    <div className="ml-6 mt-2 space-y-2">
      {subs.map(s => (
        <div key={s.activity_id}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-gray-300 dark:text-gray-600 text-xs">└</span>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{s.name}</p>
              <StatusBadge status={s.status} />
            </div>
            <Link to={`/activities/${s.activity_id}`}
              className="text-xs text-brand-500 hover:text-brand-600 flex-shrink-0">View →</Link>
          </div>
          <div className="mt-1.5 ml-4">
            <BudgetBar value={s.progress} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Activity card ─────────────────────────────────────────────────────────────
function ActivityCard({ a }: { a: Activity }) {
  const [expanded, setExpanded] = useState(false);
  const isSubActivity = !!a.main_activity_id;
  const fmt = (n: any) => (n != null && n !== '') ? `TZS ${Number(n).toLocaleString()}` : '—';
  const dt  = (s?: string) => s
    ? new Date(s).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
    : '—';

  return (
    <div className={`rounded-xl border bg-white dark:bg-gray-900 transition-shadow hover:shadow-sm ${
      isSubActivity
        ? 'border-gray-200 dark:border-gray-700 ml-6 border-l-4 border-l-purple-300 dark:border-l-purple-600'
        : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {isSubActivity && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  Sub-Activity
                </span>
              )}
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">{a.name}</h3>
              <StatusBadge status={a.status} />
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
              {a.target_name  && <span><svg className="w-3 h-3 inline-block flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg> {a.target_name}</span>}
              {a.region_name  && <span><svg className="w-3 h-3 inline-block flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> {a.region_name}</span>}
              {a.assigned_user_name && <span><svg className="w-3 h-3 inline-block flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> {a.assigned_user_name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Sub-activities toggle */}
            {!isSubActivity && (
              <button
                onClick={() => setExpanded(e => !e)}
                title="View sub-activities"
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                  expanded
                    ? 'bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400'
                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            <Link to={`/activities/${a.activity_id}`}
              className="text-xs text-brand-500 hover:text-brand-600 font-medium">
              View →
            </Link>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-gray-400">Budget</p>
            <p className="font-medium text-gray-700 dark:text-gray-300">{fmt(a.effective_budget)}</p>
          </div>
          <div>
            <p className="text-gray-400">Paid</p>
            {(a as any).total_paid > 0 ? (
              <p className="font-medium text-green-600 dark:text-green-400">{fmt((a as any).total_paid)}</p>
            ) : (
              <p className="font-medium text-gray-400">—</p>
            )}
          </div>
          <div>
            <p className="text-gray-400">Progress</p>
            <p className="font-medium text-gray-700 dark:text-gray-300">{a.progress}%</p>
          </div>
          <div>
            <p className="text-gray-400">End Date</p>
            <p className="font-medium text-gray-700 dark:text-gray-300">{dt(a.end_date)}</p>
          </div>
        </div>
        <div className="mt-2">
          <BudgetBar value={a.progress} status={a.status} />
        </div>
      </div>

      {/* Sub-activities panel */}
      {expanded && !isSubActivity && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 pb-4 pt-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Sub-Activities</p>
          <SubActivities parentId={a.activity_id} />
          <Link
            to={`/activities/new?main_activity_id=${a.activity_id}&target_id=${a.target_id}`}
            className="mt-3 flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-600"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Sub-Activity
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Main list ─────────────────────────────────────────────────────────────────
export default function ActivityList() {
  const [data,    setData]    = useState<PaginatedResponse<Activity> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [status,  setStatus]  = useState('');
  const [showSubs, setShowSubs] = useState(false);
  const [page,    setPage]    = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await activitiesApi.list({ page, limit: 15, status: status || undefined });
      setData(res.data);
    } catch {
      setError('Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  // Filter: show/hide sub-activities in the flat list
  const displayed = data?.results.filter(a =>
    showSubs ? true : !a.main_activity_id
  ) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Activities</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{data?.totalResults ?? 0} total</p>
        </div>
        <Link to="/activities/new"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Activity
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
          <input type="checkbox" checked={showSubs} onChange={e => setShowSubs(e.target.checked)}
            className="rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
          Show sub-activities in list
        </label>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No activities found</div>
        ) : (
          displayed.map(a => <ActivityCard key={a.activity_id} a={a} />)
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {data.page} of {data.totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Previous</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page === data.totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
