import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { manifestsApi, vehiclesApi } from '../../api';
import type { Manifest, Vehicle } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import Modal from '../../components/tpfcs/Modal';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

export default function ManifestDetail() {
  const { id } = useParams();
  const [manifest, setManifest]   = useState<Manifest | null>(null);
  const [vehicles, setVehicles]   = useState<Vehicle[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText]     = useState('');
  const [importing, setImporting] = useState(false);

  const load = () => {
    Promise.all([
      manifestsApi.get(Number(id)),
      vehiclesApi.list({ manifest_id: id, limit: 200 }),
    ]).then(([mr, vr]) => {
      setManifest(mr.data);
      setVehicles(vr.data.results);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  const parseCsv = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const vals = line.split(',');
      const obj: any = {};
      headers.forEach((h, i) => obj[h] = vals[i]?.trim() ?? '');
      return obj;
    });
  };

  const handleImport = async () => {
    const vehicles = parseCsv(csvText);
    if (!vehicles.length) { toast.error('No valid rows found'); return; }
    setImporting(true);
    try {
      const r = await manifestsApi.importVehicles(Number(id), vehicles);
      toast.success(`Imported ${r.data.created} vehicles. Skipped: ${r.data.skipped}`);
      setShowImport(false);
      setCsvText('');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading manifest…</div>;
  if (!manifest) return <div className="p-6 text-sm text-red-500">Manifest not found</div>;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">{manifest.manifest_number}</h1>
              <StatusBadge status={manifest.status} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Vessel: {manifest.vessel_name} · Arrived {fmtDate(manifest.arrival_date)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium">
            Import CSV
          </button>
          <Link to={`/manifests/${id}/edit`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium">
            Edit
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Vehicles', value: manifest.total_vehicles ?? vehicles.length, color: 'text-gray-800 dark:text-white' },
          { label: 'Released', value: manifest.released_vehicles ?? 0, color: 'text-green-600' },
          { label: 'Delivered', value: manifest.delivered_vehicles ?? 0, color: 'text-teal-600' },
          { label: 'Pending', value: (manifest.total_vehicles ?? 0) - (manifest.released_vehicles ?? 0), color: 'text-yellow-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Vehicles table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Vehicles ({vehicles.length})</h2>
          <Link to={`/vehicles?manifest_id=${id}`} className="text-xs text-brand-500 hover:text-brand-600">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Chassis #','Engine #','Brand','Model','Year','Color','Customer','Release','Op. Status',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {vehicles.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">No vehicles — use Import CSV to add vehicles</td></tr>
              ) : vehicles.map(v => (
                <tr key={v.vehicle_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-mono text-xs text-gray-800 dark:text-white">
                    <Link to={`/vehicles/${v.vehicle_id}`} className="hover:text-brand-600">{v.chassis_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">{v.engine_number ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{v.brand ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{v.model ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{v.year ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{v.color ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[120px] truncate">{v.customer_name ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={v.release_status} /></td>
                  <td className="px-4 py-3"><StatusBadge status={v.operational_status} /></td>
                  <td className="px-4 py-3">
                    <Link to={`/vehicles/${v.vehicle_id}`} className="text-xs text-brand-600 hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import CSV modal */}
      {showImport && (
        <Modal isOpen onClose={() => setShowImport(false)} title="Import Vehicles from CSV">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Paste CSV content below. Required column: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">chassis_number</code>.
              Optional: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">engine_number, brand, model, year, color, customer_name, destination</code>
            </p>
            <textarea value={csvText} onChange={e => setCsvText(e.target.value)}
              rows={10} placeholder="chassis_number,brand,model,year,color,customer_name&#10;ABC123,Toyota,Hilux,2023,White,John Doe"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowImport(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">Cancel</button>
              <button onClick={handleImport} disabled={importing || !csvText.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium disabled:opacity-70">
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
