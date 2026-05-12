import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { deliveriesApi } from '../../api';
import type { Delivery } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

const TRANSITIONS: Record<string, string[]> = {
  scheduled:  ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'failed'],
  delivered:  [],
  failed:     ['scheduled'],
  cancelled:  [],
};

const STATUS_COLORS: Record<string, string> = {
  in_transit: 'bg-yellow-500 hover:bg-yellow-600',
  delivered:  'bg-green-600 hover:bg-green-700',
  failed:     'bg-red-600 hover:bg-red-700',
  cancelled:  'bg-gray-500 hover:bg-gray-600',
  scheduled:  'bg-blue-600 hover:bg-blue-700',
};

export default function DeliveryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showDel, setShowDel]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    deliveriesApi.get(Number(id)).then(r => setDelivery(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      const r = await deliveriesApi.updateStatus(Number(id), status);
      setDelivery(r.data);
      toast.success(`Status updated to ${status}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Update failed');
    } finally { setUpdating(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deliveriesApi.delete(Number(id));
      toast.success('Delivery deleted');
      navigate('/deliveries');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    } finally { setDeleting(false); setShowDel(false); }
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading delivery…</div>;
  if (!delivery) return <div className="p-6 text-sm text-red-500">Delivery not found</div>;

  const nextStatuses = TRANSITIONS[delivery.status] ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Delivery #{delivery.id}</h1>
            <p className="text-sm text-gray-500">
              {(delivery as any).chassis_number ? `Vehicle: ${(delivery as any).chassis_number}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/deliveries/${id}/edit`} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">Edit</Link>
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
          <h2 className="text-sm font-semibold text-gray-700">Delivery Details</h2>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 px-5 py-4">
          {([
            ['Vehicle', delivery.vehicle_id ? (
              <Link to={`/vehicles/${delivery.vehicle_id}`} className="text-blue-600 hover:underline font-mono text-sm">
                {(delivery as any).chassis_number ?? `#${delivery.vehicle_id}`}
              </Link>
            ) : '—'],
            ['Driver', delivery.driver_id ? (
              <Link to={`/drivers/${delivery.driver_id}`} className="text-blue-600 hover:underline">
                {(delivery as any).driver_name ?? `Driver #${delivery.driver_id}`}
              </Link>
            ) : '—'],
            ['Status', <StatusBadge status={delivery.status} />],
            ['Scheduled Date', fmtDate(delivery.scheduled_date ?? undefined)],
            ['Delivered Date', fmtDate((delivery as any).delivered_date)],
            ['Delivery Address', delivery.delivery_address ?? '—'],
            ['Created', fmtDate(delivery.created_at)],
            ['Notes', delivery.notes ?? '—'],
          ] as [string, React.ReactNode][]).map(([label, value]) => (
            <div key={label} className="py-3 border-b border-gray-100 flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
              <dd className="text-sm text-gray-800">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {showDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Delivery</h3>
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
