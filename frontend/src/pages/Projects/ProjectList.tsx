import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import PageBreadCrumb from '../../components/common/PageBreadCrumb';
import { projectsApi } from '../../api';
import type { Project, PaginatedResponse } from '../../types';

export default function ProjectList() {
  const [data,    setData]    = useState<PaginatedResponse<Project> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await projectsApi.list({ page, limit: 10, search: search || undefined });
      setData(res.data);
    } catch {
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n?: number) =>
    n != null ? `TZS ${n.toLocaleString()}` : '—';

  return (
    <div className="p-4 sm:p-6">
      <PageBreadCrumb pageTitle="Projects" />

      <div className="mb-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full sm:w-72 rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400"
        />
        <Link
          to="/projects/new"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </Link>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm dark:bg-red-500/10 dark:text-red-400">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {['Project Name', 'Sector', 'Manager', 'Est. Cost', 'Period', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800 animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                    No projects found
                  </td>
                </tr>
              ) : (
                data?.results.map((p) => (
                  <tr key={p.project_id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-800 dark:text-white">{p.name}</div>
                      {p.project_reference && (
                        <div className="text-xs text-gray-400 mt-0.5">{p.project_reference}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-400">{p.sector_name ?? '—'}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-400">{p.project_manager_name ?? '—'}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmt(p.estimated_cost)}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {p.start_date ? new Date(p.start_date).getFullYear() : '—'}
                      {p.end_date ? ` – ${new Date(p.end_date).getFullYear()}` : ''}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        to={`/projects/${p.project_id}`}
                        className="text-brand-500 hover:text-brand-600 font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {data.page} of {data.totalPages} — {data.totalResults} projects
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === data.totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
