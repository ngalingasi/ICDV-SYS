import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { operationsApi } from '../../api';
import type { Operation } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

const TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const STATUS_COLORS: Record<string, string> = {
  in_progress: 'bg-yellow-500 hover:bg-yellow-600',
  completed:   'bg-green-600 hover:bg-green-700',
  cancelled:   'bg-red-600 hover:bg-red-700',
};

export default function OperationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [op, setOp]           = useState<Operation | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    operationsApi.get(Number(id)).then(r => setOp(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      const r = await operationsApi.updateStatus(Number(id), status);
      setOp(r.data);
      toast.success(`Status updated to ${status}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Update failed');
    } finally { setUpdating(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await operationsApi.delete(Number(id));
      toast.success('Operation deleted');
      navigate('/operations');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    } finally { setDeleting(false); setShowDel(false); }
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading operation…</div>;
  if (!op) return <div className="p-6 text-sm text-red-500">Operation not found</div>;

  const nextStatuses = TRANSITIONS[op.status] ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-gray-900 capitalize">{op.operation_type?.replace(/_/g, ' ')} Operation</h1>
            <p className="text-sm text-gray-500">ID #{op.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/operations/${id}/edit`} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">Edit</Link>
          <button onClick={() => setShowDel(true)} className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
        </div>
      </div>

      {/* Status transitions */}
      {nextStatuses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">Update Status</p>
          <div className="flex gap-2 flex-wrap">
            {nextStatuses.map(s => (
              <button key={s} onClick={() => updateStatus(s)} disabled={updating}
                className={`px-4 py-1.5 text-sm font-medium text-white rounded-lg capitalize disabled:opacity-50 ${STATUS_COLORS[s] ?? 'bg-blue-600 hover:bg-blue-700'}`}>
                → {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Operation Details</h2>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 px-5 py-4">
          {([
            ['Vehicle', op.vehicle_id ? <Link to={`/vehicles/${op.vehicle_id}`} className="text-blue-600 hover:underline font-mono text-sm">{(op as any).chassis_number ?? `#${op.vehicle_id}`}</Link> : '—'],
            ['Operation Type', <span className="capitalize">{op.operation_type?.replace(/_/g, ' ')}</span>],
            ['Status', <StatusBadge status={op.status} />],
            ['Assigned To', op.assigned_to ?? '—'],
            ['Created', fmtDate(op.created_at)],
            ['Updated', fmtDate(op.updated_at)],
            ['Notes', op.notes ?? '—'],
          ] as [string, React.ReactNode][]).map(([label, value]) => (
            <div key={label} className="py-3 border-b border-gray-100 flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
              <dd className="text-sm text-gray-800">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {showDel && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Operation</h3>
            <p className="text-sm text-gray-600 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDel(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
