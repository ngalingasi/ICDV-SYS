import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { projectsApi, activitiesApi } from '../../api';
import type { Project, Activity } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import BudgetBar from '../../components/tpfcs/BudgetBar';
import { useAuth } from '../../store/authStore';

interface Stats {
  totalProjects: number;
  totalActivities: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export default function TpfcsDashboard() {
  const { user } = useAuth();
  const [projects,    setProjects]    = useState<Project[]>([]);
  const [activities,  setActivities]  = useState<Activity[]>([]);
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      projectsApi.list({ page: 1, limit: 5 }),
      activitiesApi.list({ page: 1, limit: 8 }),
      activitiesApi.list({ page: 1, limit: 1000 }),
    ]).then(([pRes, aRes, allActs]) => {
      setProjects(pRes.data.results);
      setActivities(aRes.data.results);
      const acts = allActs.data.results;
      setStats({
        totalProjects:   pRes.data.totalResults,
        totalActivities: allActs.data.totalResults,
        inProgress:      acts.filter((a) => a.status === 'in_progress').length,
        completed:       acts.filter((a) => a.status === 'completed').length,
        overdue:         acts.filter((a) => a.status === 'overdue').length,
      });
    }).finally(() => setLoading(false));
  }, []);

  const fmt = (n?: number) => n != null ? `TZS ${Number(n).toLocaleString()}` : '—';

  const StatCard = ({ label, value, color, to }: { label: string; value: number; color: string; to: string }) => (
    <Link to={to} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition-shadow">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>
        {loading ? <span className="inline-block w-10 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /> : value}
      </p>
    </Link>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">
          Welcome back, {user?.full_name?.split(' ')[0]}
            <svg className="w-5 h-5 inline-block ml-1 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Here's what's happening in your projects today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total Projects"   value={stats?.totalProjects ?? 0}    color="text-brand-600 dark:text-brand-400"  to="/projects" />
        <StatCard label="Total Activities" value={stats?.totalActivities ?? 0}  color="text-gray-800 dark:text-white"        to="/activities" />
        <StatCard label="In Progress"      value={stats?.inProgress ?? 0}       color="text-blue-600 dark:text-blue-400"     to="/activities?status=in_progress" />
        <StatCard label="Completed"        value={stats?.completed ?? 0}        color="text-green-600 dark:text-green-400"   to="/activities?status=completed" />
        <StatCard label="Overdue"          value={stats?.overdue ?? 0}          color="text-red-600 dark:text-red-400"       to="/activities?status=overdue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Projects</h2>
            <Link to="/projects" className="text-xs text-brand-500 hover:text-brand-600">View all →</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-4 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                </div>
              ))
            ) : projects.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400">No projects yet</div>
            ) : (
              projects.map((p) => (
                <div key={p.project_id} className="px-5 py-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.sector_name ?? 'No sector'} · {fmt(p.estimated_cost)}</p>
                  </div>
                  <Link to={`/projects/${p.project_id}`}
                    className="ml-3 text-xs text-brand-500 hover:text-brand-600 flex-shrink-0">View</Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Activities</h2>
            <Link to="/activities" className="text-xs text-brand-500 hover:text-brand-600">View all →</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-4 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-full" />
                </div>
              ))
            ) : activities.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400">No activities yet</div>
            ) : (
              activities.map((a) => (
                <div key={a.activity_id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate flex-1 mr-2">{a.name}</p>
                    <StatusBadge status={a.status} />
                  </div>
                  <BudgetBar value={a.progress} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
