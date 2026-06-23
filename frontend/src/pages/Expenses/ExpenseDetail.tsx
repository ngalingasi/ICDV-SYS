import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { expensesApi } from '../../api';
import { useAuth } from '../../store/authStore';
import BackButton from '../../components/tpfcs/BackButton';

const fmtDate  = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMoney = (n: any) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const [exp,     setExp]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting,setDeleting]= useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    expensesApi.get(Number(id))
      .then(r => setExp(r.data))
      .catch(() => setError('Expense not found'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const handleDelete = async () => {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await expensesApi.delete(Number(id));
      navigate('/expenses');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to delete expense');
      setDeleting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 text-sm text-red-700 dark:text-red-400">
          You don't have access to the Expenses module.
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-6 text-center text-gray-400">Loading…</div>;
  if (!exp)    return <div className="p-6 text-center text-red-500">{error || 'Expense not found'}</div>;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white font-mono">{exp.expense_number}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{exp.icdv_name} · {fmtDate(exp.expense_date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate(`/expenses/${id}/edit`)} disabled={exp.manifest_status === 'closed'}
            title={exp.manifest_status === 'closed' ? 'Manifest is closed — editing is disabled' : undefined}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent">
            Edit
          </button>
          <button onClick={handleDelete} disabled={deleting || exp.manifest_status === 'closed'}
            title={exp.manifest_status === 'closed' ? 'Manifest is closed — deleting is disabled' : undefined}
            className="px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {exp.manifest_status === 'closed' && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          This manifest is closed — this expense is now read-only and can't be edited or deleted.
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {/* Manifest / ICDV summary */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Manifest</h2>
        <p className="font-bold text-gray-800 dark:text-white">{exp.manifest_number}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{exp.icdv_name} ({exp.icdv_code})</p>
        {exp.arrival_date && <p className="text-sm text-gray-500 dark:text-gray-400">Arrival: {fmtDate(exp.arrival_date)}</p>}
        {exp.notes && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{exp.notes}</p>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              {['S/N','Description','Unit Price','Units','Shift','Total'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {(exp.line_items || []).map((l: any, i: number) => (
              <tr key={l.line_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{i + 1}</td>
                <td className="px-4 py-3 text-sm text-gray-800 dark:text-white max-w-xs">{l.description}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-white">{fmtMoney(l.unit_price)}</td>
                <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-white">{Number(l.quantity).toFixed(0)}</td>
                <td className="px-4 py-3 text-xs text-center text-gray-600 dark:text-gray-400">{Number(l.shift_count ?? 1).toFixed(0)}</td>
                <td className="px-4 py-3 text-sm font-semibold text-right text-gray-800 dark:text-white">{fmtMoney(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Total */}
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-end gap-8 font-bold text-base">
            <span className="text-gray-800 dark:text-white">TOTAL</span>
            <span className="w-32 text-right text-gray-800 dark:text-white">{fmtMoney(exp.total_amount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
