import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { vehiclesApi, workflowApi } from '../../api';
import type { Vehicle } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { WorkflowProgress } from '../../components/tpfcs/WorkflowCard';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

const LOCATION_LABELS: Record<string, string> = {
  vessel:           'On Vessel',
  holding_ground:   'Holding Ground',
  tpa_gate:         'TPA Gate',
  tpa_gate_to_yard: 'TPA Gate to ICDV Yard',
  icdv_yard:        'ICDV Yard',
};

export default function VehicleDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const [vehicle,    setVehicle]    = useState<Vehicle | null>(null);
  const [history,    setHistory]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [deleting,   setDeleting]   = useState(false);
  const [showDel,    setShowDel]    = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      vehiclesApi.get(Number(id)),
      workflowApi.getHistory(Number(id)),  // workflow audit log
    ]).then(([vr, hr]) => {
      setVehicle(vr.data);
      setHistory(hr.data ?? []);
    }).catch(() => {
      // If workflow history fails (vehicle never went through workflow), just load vehicle
      vehiclesApi.get(Number(id)).then(vr => setVehicle(vr.data));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await vehiclesApi.delete(Number(id));
      toast.success('Vehicle deleted');
      navigate('/vehicles');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    } finally { setDeleting(false); setShowDel(false); }
  };

  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading vehicle...</div>;
  if (!vehicle) return <div className="p-6 text-sm text-red-500">Vehicle not found</div>;

  const v = vehicle as any;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white font-mono">{vehicle.chassis_number}</h1>
            <p className="text-sm text-gray-500">
              {[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ')}
              {v.vessel_name && ` · ${v.vessel_name}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/operations/search?chassis=${vehicle.chassis_number}`}
            className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
            Track
          </Link>
          <Link to={`/vehicles/${id}/edit`}
            className="px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            Edit
          </Link>
          <button onClick={() => setShowDel(true)}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
            Delete
          </button>
        </div>
      </div>

      {/* Workflow progress bar */}
      {v.workflow_status && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Workflow Status
          </h2>
          <WorkflowProgress status={v.workflow_status} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <StatusCard label="Workflow"    value={<StatusBadge status={v.workflow_status} />} />
            <StatusCard label="Location"   value={<span className="text-sm font-medium text-gray-700 dark:text-gray-300">{LOCATION_LABELS[v.current_location] ?? v.current_location ?? '—'}</span>} />
            <StatusCard label="Release"    value={<StatusBadge status={vehicle.release_status} />} />
            <StatusCard label="Operations" value={<StatusBadge status={vehicle.operational_status} />} />
          </div>
        </div>
      )}

      {/* Vehicle details */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
          Vehicle Details
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {[
            ['Chassis Number',   <span className="font-mono font-semibold">{vehicle.chassis_number}</span>],
            ['Engine Number',    vehicle.engine_number ?? '—'],
            ['Brand',            vehicle.brand ?? '—'],
            ['Model',            vehicle.model ?? '—'],
            ['Year',             vehicle.year ?? '—'],
            ['Color',            vehicle.color ?? '—'],
            ['Customer Name',    vehicle.customer_name ?? '—'],
            ['Destination',      vehicle.destination ?? '—'],
            ['Bill of Lading',   (v.bill_of_lading_no ?? '—')],
            ['Manifest',         vehicle.manifest_id
              ? <Link to={`/manifests/${vehicle.manifest_id}`} className="text-brand-600 hover:underline">
                  {v.manifest_number ?? `#${vehicle.manifest_id}`}
                </Link>
              : '—'],
            ['Vessel',           v.vessel_name ?? '—'],
            ['Added',            fmtDate(vehicle.created_at)],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex flex-col gap-0.5">
              <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">{label}</dt>
              <dd className="text-sm text-gray-800 dark:text-gray-200">{value as any}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Workflow history timeline */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Operation History</h2>
        </div>
        {history.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            No workflow operations recorded yet.
          </p>
        ) : (
          <div className="p-5">
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
              <div className="space-y-5">
                {history.map((h: any) => (
                  <div key={h.op_id ?? h.id} className="flex gap-4 relative">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center z-10 flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800 dark:text-white capitalize">
                          {(h.operation_type ?? h.type ?? '').replace(/_/g, ' ')}
                        </span>
                        {(h.to_status ?? h.status) && (
                          <StatusBadge status={h.to_status ?? h.status} />
                        )}
                      </div>
                      {(h.from_location || h.to_location) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {h.from_location && (LOCATION_LABELS[h.from_location] ?? h.from_location)}
                          {h.from_location && h.to_location && ' → '}
                          {h.to_location && (LOCATION_LABELS[h.to_location] ?? h.to_location)}
                        </p>
                      )}
                      {h.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">{h.notes}</p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {h.operator_name ?? h.assigned_user_name ?? 'System'} &middot; {fmtDate(h.performed_at ?? h.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Delete Vehicle</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              Are you sure you want to delete <strong>{vehicle.chassis_number}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDel(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 px-3 py-2.5">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      {value}
    </div>
  );
}
