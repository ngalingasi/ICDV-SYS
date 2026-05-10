import { useEffect, useState } from 'react';
import PageBreadCrumb from '../../components/common/PageBreadCrumb';
import { budgetApi } from '../../api';
import type { BudgetRevision } from '../../types';
import { useAuth } from '../../store/authStore';

export default function BudgetRevisions() {
  const { user }       = useAuth();
  const [revisions,    setRevisions]   = useState<BudgetRevision[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [notes,        setNotes]       = useState<Record<number, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await budgetApi.listRevisions({ status: statusFilter || undefined });
      setRevisions(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleApprove = async (id: number) => {
    setActionLoading(id);
    try {
      await budgetApi.approveRevision(id, notes[id]);
      load();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    if (!notes[id]?.trim()) { alert('Please enter review notes before rejecting.'); return; }
    setActionLoading(id);
    try {
      await budgetApi.rejectRevision(id, notes[id]);
      load();
    } finally {
      setActionLoading(null);
    }
  };

  const fmt  = (n: number) => `TZS ${Number(n).toLocaleString()}`;
  const can  = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div className="p-4 sm:p-6">
      <PageBreadCrumb pageTitle="Budget Revisions" />

      <div className="mb-5">
        <div className="flex gap-2">
          {['', 'pending', 'approved', 'rejected'].map((s) => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                statusFilter === s
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))
        ) : revisions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No revision requests found</div>
        ) : (
          revisions.map((r) => (
            <div key={r.revision_id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">{r.activity_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Requested by {r.requested_by_name} · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                  r.status === 'pending'  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                  r.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                                            'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                }`}>
                  {r.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Current Budget</p>
                  <p className="font-medium text-gray-700 dark:text-gray-300">{fmt(r.current_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Requested Amount</p>
                  <p className="font-medium text-gray-700 dark:text-gray-300">{fmt(r.requested_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Difference</p>
                  <p className="font-medium text-green-600 dark:text-green-400">+{fmt(r.difference)}</p>
                </div>
              </div>

              <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">Reason: </span>
                {r.reason}
              </div>

              {r.status === 'pending' && can && (
                <div className="mt-4 space-y-3">
                  <textarea
                    rows={2}
                    placeholder="Review notes (required for rejection)..."
                    value={notes[r.revision_id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.revision_id]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:border-brand-400 resize-none"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(r.revision_id)}
                      disabled={actionLoading === r.revision_id}
                      className="px-4 py-2 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                    >
                      {actionLoading === r.revision_id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(r.revision_id)}
                      disabled={actionLoading === r.revision_id}
                      className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {r.reviewed_by_name && (
                <p className="mt-3 text-xs text-gray-500">
                  Reviewed by {r.reviewed_by_name} · {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : ''}
                  {r.review_notes && ` · "${r.review_notes}"`}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
