import { useState } from 'react';
import { Link } from 'react-router';
import { vehiclesApi } from '../../api';
import type { Vehicle } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';

export default function VehicleSearch() {
  const [query, setQuery]   = useState('');
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(''); setVehicle(null);
    try {
      const r = await vehiclesApi.searchByChassis(query.trim().toUpperCase());
      setVehicle(r.data);
    } catch {
      setError('Vehicle not found for chassis number: ' + query.trim().toUpperCase());
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Search by Chassis Number</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Enter a chassis number to look up a vehicle</p>
      </div>

      <div className="flex gap-2">
        <input value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="e.g. JTMBC3FV20J012345"
          className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono" />
        <button onClick={search} disabled={loading || !query.trim()}
          className="px-5 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-70 transition-colors">
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {vehicle && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Chassis Number</p>
              <p className="text-lg font-bold font-mono text-gray-800 dark:text-white mt-0.5">{vehicle.chassis_number}</p>
            </div>
            <Link to={`/vehicles/${vehicle.vehicle_id}`}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium">
              Full Details →
            </Link>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Brand',         value: vehicle.brand },
              { label: 'Model',         value: vehicle.model },
              { label: 'Year',          value: vehicle.year?.toString() },
              { label: 'Color',         value: vehicle.color },
              { label: 'Engine Number', value: vehicle.engine_number },
              { label: 'Customer',      value: vehicle.customer_name },
              { label: 'Destination',   value: vehicle.destination },
              { label: 'Manifest',      value: vehicle.manifest_number },
              { label: 'Vessel',        value: vehicle.vessel_name },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white mt-0.5">{value ?? '—'}</p>
              </div>
            ))}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Release Status</p>
              <div className="mt-1"><StatusBadge status={vehicle.release_status} /></div>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Operational Status</p>
              <div className="mt-1"><StatusBadge status={vehicle.operational_status} /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
