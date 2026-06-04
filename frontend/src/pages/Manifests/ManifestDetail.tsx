import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { manifestsApi, vehiclesApi } from '../../api';
import type { Manifest, Vehicle } from '../../types';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import Modal from '../../components/tpfcs/Modal';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';
import ManifestFuelTab from './ManifestFuelTab';

const STEPS = [
  { key: 'manifested_count', label: 'Manifested', bar: 'bg-slate-400' },
  { key: 'discharged_count', label: 'Discharged', bar: 'bg-cyan-500' },
  { key: 'batched_count',    label: 'Batched',    bar: 'bg-violet-500' },
  { key: 'in_transit_count', label: 'In Transit', bar: 'bg-orange-500' },
  { key: 'received_count',   label: 'Received',   bar: 'bg-emerald-500' },
];

const ACCEPTED = '.csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export default function ManifestDetail() {
  const { id }   = useParams();
  const fileRef  = useRef<HTMLInputElement>(null);

  const [manifest,   setManifest]  = useState<Manifest | null>(null);
  const [vehicles,   setVehicles]  = useState<Vehicle[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [showImport, setShowImport]= useState(false);
  const [file,       setFile]      = useState<File | null>(null);
  const [dragOver,   setDragOver]  = useState(false);
  const [importing,  setImporting] = useState(false);
  const [activeTab,  setActiveTab] = useState<'vehicles' | 'fuel'>('vehicles');

  const load = () => {
    setLoading(true);
    Promise.all([
      manifestsApi.get(Number(id)),
      vehiclesApi.list({ manifest_id: id, limit: 200 }),
    ]).then(([mr, vr]) => {
      setManifest(mr.data);
      setVehicles(vr.data.results);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const closeImport = () => { setShowImport(false); setFile(null); };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleImport = async () => {
    if (!file) { toast.error('Please select a file first'); return; }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('csv', file, file.name);
      const r = await manifestsApi.importVehicles(Number(id), fd);
      const { imported, failed, duplicates = [], errors = [] } = r.data;
      if (imported > 0) {
        toast.success(`Imported ${imported} vehicle${imported !== 1 ? 's' : ''}${failed > 0 ? `. ${failed} failed.` : '.'}`);
      } else {
        toast.error(`No vehicles imported. ${failed} row${failed !== 1 ? 's' : ''} failed.`);
      }
      if (duplicates.length > 0) toast.error(`${duplicates.length} duplicate chassis skipped.`);
      if (errors.length > 0 && errors.length <= 5)
        errors.forEach((e: any) => toast.error(`Row ${e.row}: ${e.error}`));
      closeImport(); load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Import failed');
    } finally { setImporting(false); }
  };

  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading manifest...</div>;
  if (!manifest) return <div className="p-6 text-sm text-red-500">Manifest not found</div>;

  const m     = manifest as any;
  const total = m.total_vehicles ?? vehicles.length ?? 0;
  const pct   = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
  const fileExt = file?.name.split('.').pop()?.toLowerCase() ?? '';

  return (
    <div className="p-4 sm:p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">{manifest.manifest_number}</h1>
              <StatusBadge status={manifest.status} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Vessel: {manifest.vessel_name} &middot; Arrived {fmtDate(manifest.arrival_date)}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a
            href={`/manifests/${id}/delivery-sheet`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Delivery Sheet
          </a>
          <a
            href={`/manifests/${id}/delivery-sheet?combined=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium whitespace-nowrap"
            title="All batches merged — one row per driver with all chassis"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Combined Sheet
          </a>
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Import Vehicles
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
          { label: 'Total Vehicles',  value: total,                    color: 'text-gray-800 dark:text-white' },
          { label: 'Released',        value: m.released_vehicles ?? 0, color: 'text-green-600 dark:text-green-400' },
          { label: 'Received',        value: m.received_count ?? 0,    color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Still on Vessel', value: m.manifested_count ?? 0,  color: 'text-slate-600 dark:text-slate-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Workflow funnel */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Vehicle Status Breakdown</h2>
          <span className="text-xs text-gray-400">{total} vehicles total</span>
        </div>
        <div className="grid grid-cols-5 gap-2 mb-4">
          {STEPS.map((step, i) => {
            const val: number = m[step.key] ?? 0;
            return (
              <div key={step.key} className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 p-2.5 text-center">
                <p className="text-[10px] text-gray-400 font-medium">{i + 1}</p>
                <p className="text-xl font-bold text-gray-800 dark:text-white">{val}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{step.label}</p>
              </div>
            );
          })}
        </div>
        <div className="space-y-1.5">
          {STEPS.map(step => {
            const val: number = m[step.key] ?? 0;
            const p = pct(val);
            return (
              <div key={step.key} className="flex items-center gap-3">
                <span className="w-20 text-[11px] text-gray-500 dark:text-gray-400 shrink-0">{step.label}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={`h-2 rounded-full ${step.bar} transition-all`} style={{ width: `${p}%` }} />
                </div>
                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 w-16 text-right">{val} ({p}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(['vehicles', 'fuel'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px
              ${activeTab === tab
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            {tab === 'vehicles' ? `Vehicles (${vehicles.length})` : 'Fuel'}
          </button>
        ))}
      </div>

      {/* Vehicles tab */}
      {activeTab === 'vehicles' && (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Vehicles ({vehicles.length})</h2>
          <Link to={`/vehicles?manifest_id=${id}`} className="text-xs text-brand-500 hover:text-brand-600">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                {['Chassis #','Brand / Model','Customer','Workflow Status','Location','Release',''].map(h => (
                  <th key={h} className={`text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap${h === 'Brand / Model' || h === 'Customer' ? ' hidden' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                    No vehicles — click <strong>Import Vehicles</strong> to upload an Excel or CSV file
                  </td>
                </tr>
              ) : vehicles.map(v => {
                const vv = v as any;
                return (
                  <tr key={v.vehicle_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800 dark:text-white">
                      <Link to={`/vehicles/${v.vehicle_id}`} className="hover:text-brand-600">{v.chassis_number}</Link>
                    </td>
                    <td className="hidden px-4 py-3 text-gray-700 dark:text-gray-300">{[v.brand,v.model].filter(Boolean).join(' ') || '—'}</td>
                    <td className="hidden px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[120px] truncate">{v.customer_name ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={vv.workflow_status ?? v.operational_status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{vv.current_location?.replace(/_/g,' ') ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={v.release_status} /></td>
                    <td className="px-4 py-3"><Link to={`/vehicles/${v.vehicle_id}`} className="text-xs text-brand-600 hover:underline">View</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Fuel tab */}
      {activeTab === 'fuel' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <ManifestFuelTab manifestId={Number(id)} />
        </div>
      )}

      {/* Import modal — Excel / CSV file upload */}
      {showImport && (
        <Modal isOpen onClose={closeImport} title="Import Vehicles">
          <div className="space-y-4">

            {/* Format info */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-3 py-2.5 text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <p className="font-semibold">Accepted: Excel (.xlsx, .xls) or CSV (.csv)</p>
              <p><span className="font-medium">Required:</span> <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded">Unit ID (RoRo)</code> or <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded">chassis_no</code></p>
              <p><span className="font-medium">Optional columns (all nullable):</span></p>
              <p className="pl-2 leading-relaxed">
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Bill of Lading</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Vessel Visit</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Marks and Numbers (Bulk/Break Bulk)</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Driver Licence#</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Driver Name</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Driver Contact</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Place of Destination</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Place of Delivery</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Quantity</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Weight</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Volume</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Reference #</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Self Driven (Y/N) for RoRo</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Truck #</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Transport Company Name</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Declaration #</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded mr-1">Trip #</code>
                <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded">Terminal Gate #</code>
              </p>
              <p className="text-blue-500 dark:text-blue-500 italic">Driver fields are stored from the manifest as-is. They are not linked to ICDV drivers and may be left blank.</p>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              className={`cursor-pointer border-2 border-dashed rounded-xl p-8 text-center transition-colors select-none ${
                dragOver   ? 'border-brand-400 bg-brand-50 dark:bg-brand-500/10' :
                file       ? 'border-green-400 bg-green-50 dark:bg-green-500/10' :
                             'border-gray-300 dark:border-gray-600 hover:border-brand-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              {file ? (
                <div className="space-y-1">
                  <p className="text-3xl">{fileExt === 'xlsx' || fileExt === 'xls' ? '📊' : '📄'}</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{file.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Click to browse or drag & drop</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Excel (.xlsx, .xls) or CSV (.csv) — max 10 MB</p>
                </div>
              )}
            </div>

            <input ref={fileRef} type="file" accept={ACCEPTED} className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />

            <div className="flex justify-end gap-3 pt-1">
              <button onClick={closeImport}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button onClick={handleImport} disabled={importing || !file}
                className="px-5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                {importing ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Importing...</>
                ) : 'Import'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}