import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { driversApi, deliveriesApi } from '../../api';
import type { Driver } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

export default function DriverDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver]       = useState<Driver | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showDel, setShowDel]     = useState(false);
  const [deleting, setDeleting]   = useState(false);

  useEffect(() => {
    Promise.all([
      driversApi.get(Number(id)),
      deliveriesApi.list({ driver_id: id, limit: 50 }),
    ]).then(([dr, dlr]) => {
      setDriver(dr.data);
      setDeliveries(dlr.data.results ?? []);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await driversApi.delete(Number(id));
      toast.success('Driver deleted');
      navigate('/drivers');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    } finally { setDeleting(false); setShowDel(false); }
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading driver…</div>;
  if (!driver) return <div className="p-6 text-sm text-red-500">Driver not found</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{driver.name}</h1>
            <p className="text-sm text-gray-500">License: {driver.license_number}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/drivers/${id}/edit`} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">Edit</Link>
          <button onClick={() => setShowDel(true)} className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Driver Details</h2>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 px-5 py-4">
          {([
            ['Name', driver.name],
            ['License Number', <span className="font-mono">{driver.license_number}</span>],
            ['Phone', driver.phone ?? '—'],
            ['Email', driver.email ?? '—'],
            ['Address', driver.address ?? '—'],
            ['Status', <StatusBadge status={driver.status} />],
            ['Registered', fmtDate(driver.created_at)],
            ['Notes', driver.notes ?? '—'],
          ] as [string, React.ReactNode][]).map(([label, value]) => (
            <div key={label} className="py-3 border-b border-gray-100 flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
              <dd className="text-sm text-gray-800">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Deliveries */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Delivery History</h2>
        </div>
        {deliveries.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No deliveries assigned to this driver.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                {['Vehicle', 'Status', 'Scheduled', 'Destination', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deliveries.map((dl: any) => (
                <tr key={dl.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{dl.chassis_number ?? `Vehicle #${dl.vehicle_id}`}</td>
                  <td className="px-4 py-3"><StatusBadge status={dl.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(dl.scheduled_date)}</td>
                  <td className="px-4 py-3 text-gray-500">{dl.delivery_address ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Link to={`/deliveries/${dl.id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Driver</h3>
            <p className="text-sm text-gray-600 mb-5">Are you sure you want to delete <strong>{driver.name}</strong>?</p>
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
