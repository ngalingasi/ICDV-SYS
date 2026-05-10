import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { vehiclesApi, operationsApi } from '../../api';
import type { Vehicle, Operation } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle]       = useState<Vehicle | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading]       = useState(true);
  const [deleting, setDeleting]     = useState(false);
  const [showDel, setShowDel]       = useState(false);

  const load = () => {
    Promise.all([
      vehiclesApi.get(Number(id)),
      vehiclesApi.getOperations(Number(id)),
    ]).then(([vr, or]) => {
      setVehicle(vr.data);
      setOperations(or.data.results ?? or.data ?? []);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await vehiclesApi.delete(Number(id));
      toast.success('Vehicle deleted');
      navigate('/vehicles');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    } finally {
      setDeleting(false);
      setShowDel(false);
    }
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading vehicle…</div>;
  if (!vehicle) return <div className="p-6 text-sm text-red-500">Vehicle not found</div>;

  const fields: [string, React.ReactNode][] = [
    ['Chassis Number', <span className="font-mono font-semibold">{vehicle.chassis_number}</span>],
    ['Engine Number', vehicle.engine_number ?? '—'],
    ['Brand', vehicle.brand ?? '—'],
    ['Model', vehicle.model ?? '—'],
    ['Year', vehicle.year ?? '—'],
    ['Color', vehicle.color ?? '—'],
    ['Customer Name', vehicle.customer_name ?? '—'],
    ['Destination', vehicle.destination ?? '—'],
    ['Release Status', <StatusBadge status={vehicle.release_status} />],
    ['Operational Status', <StatusBadge status={vehicle.operational_status} />],
    ['Manifest ID', vehicle.manifest_id ? <Link to={`/manifests/${vehicle.manifest_id}`} className="text-blue-600 hover:underline">#{vehicle.manifest_id}</Link> : '—'],
    ['Added', fmtDate(vehicle.created_at)],
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{vehicle.chassis_number}</h1>
            <p className="text-sm text-gray-500">{vehicle.brand} {vehicle.model} {vehicle.year}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/vehicles/${id}/edit`}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Edit
          </Link>
          <button onClick={() => setShowDel(true)}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
            Delete
          </button>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Vehicle Details</h2>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 divide-y divide-gray-100 sm:divide-y-0 px-5 py-4">
          {fields.map(([label, value]) => (
            <div key={label} className="py-3 sm:border-b sm:border-gray-100 flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
              <dd className="text-sm text-gray-800">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Operations history */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Operations History</h2>
          <Link to={`/operations/new?vehicle_id=${id}`}
            className="text-xs font-medium text-blue-600 hover:underline">+ New Operation</Link>
        </div>
        {operations.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No operations recorded for this vehicle.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                {['Type', 'Status', 'Assigned To', 'Notes', 'Date', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {operations.map((op) => (
                <tr key={op.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 capitalize">{op.operation_type?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3"><StatusBadge status={op.status} /></td>
                  <td className="px-4 py-3">{op.assigned_to ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{op.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(op.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/operations/${op.id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete modal */}
      {showDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Vehicle</h3>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to delete <strong>{vehicle.chassis_number}</strong>? This cannot be undone.
            </p>
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
