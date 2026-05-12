import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { vesselsApi, manifestsApi } from '../../api';
import type { Vessel, Manifest } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

const TRANSITIONS: Record<string, string[]> = {
  expected: ['arrived','departed'], arrived: ['processing','departed'],
  processing: ['completed','arrived'], completed: ['departed'], departed: [],
};

export default function VesselDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vessel, setVessel]       = useState<Vessel | null>(null);
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [updating, setUpdating]   = useState(false);

  const load = () => {
    Promise.all([
      vesselsApi.get(Number(id)),
      manifestsApi.list({ vessel_id: id, limit: 50 }),
    ]).then(([vr, mr]) => {
      setVessel(vr.data);
      setManifests(mr.data.results);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      const r = await vesselsApi.updateStatus(Number(id), status);
      setVessel(r.data);
      toast.success(`Status updated to ${status}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading vessel…</div>;
  if (!vessel) return <div className="p-6 text-sm text-red-500">Vessel not found</div>;

  const transitions = TRANSITIONS[vessel.status] ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">{vessel.name}</h1>
              <StatusBadge status={vessel.status} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {vessel.imo_number ? `IMO: ${vessel.imo_number}` : 'No IMO number'} · {vessel.shipping_line ?? 'No shipping line'}
            </p>
          </div>
        </div>
        <Link to={`/vessels/${id}/edit`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors">
          Edit
        </Link>
      </div>

      {/* Details card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Flag',           value: vessel.flag },
          { label: 'Port of Origin', value: vessel.port_of_origin },
          { label: 'Berth Number',   value: vessel.berth_number },
          { label: 'Arrival Date',   value: fmtDate(vessel.arrival_date) },
          { label: 'Departure Date', value: fmtDate(vessel.departure_date ?? undefined) },
          { label: 'Added By',       value: vessel.created_by_name },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className="text-sm font-medium text-gray-800 dark:text-white mt-0.5">{value ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Status transitions */}
      {transitions.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Update Status</h2>
          <div className="flex flex-wrap gap-2">
            {transitions.map(s => (
              <button key={s} onClick={() => updateStatus(s)} disabled={updating}
                className="px-4 py-2 rounded-lg border border-brand-300 text-brand-700 dark:border-brand-600 dark:text-brand-300 text-sm font-medium hover:bg-brand-50 dark:hover:bg-brand-500/10 disabled:opacity-50 transition-colors capitalize">
                Mark as {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manifests */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Manifests ({manifests.length})</h2>
          <Link to={`/manifests/new?vessel_id=${id}`}
            className="text-xs text-brand-500 hover:text-brand-600 font-medium">+ Add Manifest</Link>
        </div>
        {manifests.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No manifests for this vessel</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['Manifest #','Arrival Date','Total Vehicles','Released','Delivered','Status',''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {manifests.map(m => (
                  <tr key={m.manifest_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{m.manifest_number}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fmtDate(m.arrival_date)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{m.total_vehicles ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{m.released_vehicles ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{m.delivered_vehicles ?? 0}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3">
                      <Link to={`/manifests/${m.manifest_id}`} className="text-xs text-brand-600 hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {vessel.notes && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{vessel.notes}</p>
        </div>
      )}
    </div>
  );
}
