import { useEffect, useState } from 'react';
import { workflowApi } from '../../api';
import { useAuth } from '../../store/authStore';
import { toast } from '../../components/tpfcs/Toast';
import {
  ChassisInput, VehicleCard, DriverCard, NotesInput,
  ConfirmButton, ErrorAlert, SuccessBanner, Section, WorkflowProgress,
} from '../../components/tpfcs/WorkflowCard';

const RAW_API  = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000/api';
const API_BASE = RAW_API.replace(/\/api(\/v\d+)?$/, '');

// ── TPA Stats Panel ───────────────────────────────────────────────────────────
// Shown to transfer_officer (viewTpaStats right). Loads once on mount.
function TpaStatsPanel() {
  const [stats,   setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    workflowApi.getTpaStats()
      .then(r => setStats(r.data))
      .catch(() => {/* silently ignore — panel is informational only */})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-3/4" />
        </div>
      ))}
    </div>
  );

  if (!stats) return null;

  const statCards = [
    { label: 'Currently In Transit', value: stats.in_transit_count ?? 0,   color: 'text-orange-600 dark:text-orange-400' },
    { label: 'Transferred Today',    value: stats.transferred_today ?? 0,   color: 'text-brand-600 dark:text-brand-400' },
    { label: 'Total Transferred',    value: stats.transferred_total ?? 0,   color: 'text-green-600 dark:text-green-400' },
    { label: 'Active Drivers',       value: stats.active_drivers ?? 0,      color: 'text-purple-600 dark:text-purple-400' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-center">
            <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Per-batch breakdown */}
      {stats.by_batch?.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Active Batches — TPA Gate
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[360px]">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {['Batch', 'Vessel', 'In Transit', 'Received'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {stats.by_batch.map((b: any) => (
                  <tr key={b.batch_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-800 dark:text-white whitespace-nowrap">{b.batch_number}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{b.vessel_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                        {b.in_transit_count}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300">
                        {b.received_count ?? 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

type Step = 'vehicle' | 'driver' | 'confirm' | 'done';

function DriverIdCard({ driver }: { driver: any }) {
  const photoUrl = driver.photo ? `${API_BASE}${driver.photo}` : null;
  const [zoomed, setZoomed] = useState(false);

  return (
    <>
      {/* Clean driver info card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="flex gap-4 p-4">
          {/* Profile photo — clickable to zoom */}
          <button
            type="button"
            onClick={() => photoUrl && setZoomed(true)}
            className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 bg-gray-100 dark:bg-gray-800
              ${photoUrl ? 'border-brand-200 dark:border-brand-500/30 cursor-zoom-in hover:border-brand-400 transition-colors' : 'border-gray-200 dark:border-gray-700 cursor-default'}`}
            title={photoUrl ? 'Click to zoom' : undefined}
          >
            {photoUrl ? (
              <img src={photoUrl} alt={driver.full_name} className="w-full h-full object-cover"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-9 h-9 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </button>

          {/* Driver details */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight">{driver.full_name}</p>
                <span className={`inline-flex items-center gap-1 mt-0.5 text-xs font-medium px-2 py-0.5 rounded-full
                  ${driver.status === 'active'
                    ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${driver.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                  {driver.status === 'active' ? 'Active' : driver.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">ID Card No.</p>
                <p className="text-xs font-mono font-bold text-gray-800 dark:text-white">{driver.id_number ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">License No.</p>
                <p className="text-xs font-mono font-bold text-gray-800 dark:text-white">{driver.license_number ?? '—'}</p>
              </div>
              {driver.phone && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Mobile</p>
                  <p className="text-xs font-mono text-gray-700 dark:text-gray-300">{driver.phone}</p>
                </div>
              )}
              {driver.email && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Email</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{driver.email}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Verified bar */}
        <div className="px-4 py-2 bg-green-50 dark:bg-green-500/5 border-t border-green-100 dark:border-green-500/10 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs font-semibold text-green-700 dark:text-green-400">Driver verified — cleared for transfer</p>
        </div>
      </div>

      {/* Photo lightbox */}
      {zoomed && photoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setZoomed(false)}
        >
          <div className="relative max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <img src={photoUrl} alt={driver.full_name}
              className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]" />
            <div className="mt-3 text-center">
              <p className="text-white font-semibold text-sm">{driver.full_name}</p>
              <p className="text-white/60 text-xs mt-0.5">{driver.id_number}</p>
            </div>
            <button
              onClick={() => setZoomed(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-gray-800 flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function TransferPage() {
  const { user } = useAuth();
  const [step,    setStep]    = useState<Step>('vehicle');
  const [chassis, setChassis] = useState('');
  const [idCard,  setIdCard]  = useState('');
  const [vehicle, setVehicle] = useState<any>(null);
  const [driver,  setDriver]  = useState<any>(null);
  const [notes,   setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Show TPA stats for transfer_officer and admin+ roles
  const canViewTpaStats = user && [
    'transfer_officer', 'operator', 'supervisor', 'admin', 'system_admin', 'super_admin',
  ].includes(user.role);

  const reset = () => {
    setStep('vehicle'); setChassis(''); setIdCard('');
    setVehicle(null); setDriver(null); setNotes(''); setError('');
  };

  const handleVehicleSearch = async () => {
    if (chassis.trim().length < 4) return;
    setLoading(true); setError('');
    try {
      const r = await workflowApi.transferLookup(chassis.trim());
      setVehicle(r.data); setStep('driver');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Vehicle search failed');
    } finally { setLoading(false); }
  };

  const handleDriverSearch = async () => {
    if (!idCard.trim()) return;
    setLoading(true); setError('');
    try {
      const r = await workflowApi.driverLookup(idCard.trim());
      setDriver(r.data); setStep('confirm');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Driver lookup failed');
    } finally { setLoading(false); }
  };

  // Driver is optional — allow proceeding without one
  const handleSkipDriver = () => {
    setDriver(null);
    setIdCard('');
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!vehicle) return;
    setLoading(true); setError('');
    try {
      await workflowApi.transferConfirm({
        vehicle_id: vehicle.vehicle_id,
        ...(driver ? { driver_id: driver.driver_id, driver_id_card: idCard.trim() } : {}),
        notes,
      });
      const msg = driver
        ? `Vehicle ${vehicle.chassis_number} transferred with driver ${driver.full_name}`
        : `Vehicle ${vehicle.chassis_number} transferred (no driver assigned)`;
      toast.success(msg);
      setStep('done');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Transfer confirmation failed');
    } finally { setLoading(false); }
  };

  const stepLabels: Step[] = ['vehicle', 'driver', 'confirm'];

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">

      <div>
        <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">TPA Gate Transfer</h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Vehicle checkout from TPA gate to ICDV yard
        </p>
      </div>

      {/* TPA Stats — visible to transfer_officer and admin+ */}
      {canViewTpaStats && <TpaStatsPanel />}

      {vehicle && <WorkflowProgress status={vehicle.workflow_status} />}

      {/* Step pills — scroll horizontally on very narrow screens */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-2 min-w-max">
          {stepLabels.map((s, i) => (
            <div key={s} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
              step === s
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
                : stepLabels.indexOf(step) > i || step === 'done'
                  ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold">
                {stepLabels.indexOf(step) > i || step === 'done' ? '✓' : String(i + 1)}
              </span>
              {['Vehicle', 'Driver', 'Confirm'][i]}
            </div>
          ))}
        </div>
      </div>

      {step === 'vehicle' && (
        <Section title="Step 1 — Identify Vehicle">
          <ChassisInput value={chassis} onChange={setChassis} onSearch={handleVehicleSearch} loading={loading} />
          {error && <ErrorAlert message={error} />}
        </Section>
      )}

      {(step === 'driver' || step === 'confirm') && vehicle && (
        <Section title="Vehicle Confirmed"><VehicleCard v={vehicle} /></Section>
      )}

      {step === 'driver' && (
        <Section title="Step 2 — Scan Driver ID Card">
          <div className="flex gap-2">
            <input type="text" value={idCard} onChange={e => setIdCard(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDriverSearch()}
              placeholder="Enter driver internal ID card number..."
              autoComplete="off"
              className="flex-1 min-w-0 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button onClick={handleDriverSearch} disabled={loading || !idCard.trim()}
              className="flex-shrink-0 whitespace-nowrap px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {loading ? 'Looking...' : 'Lookup'}
            </button>
          </div>
          {error && <ErrorAlert message={error} />}
          {/* Skip button hidden — kept for future use when optional driver is re-enabled */}
          <div className="hidden">
            <button
              onClick={handleSkipDriver}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2 transition-colors"
            >
              Skip — proceed without assigning a driver
            </button>
          </div>
        </Section>
      )}

      {step === 'confirm' && (
        <>
          {driver && (
            <Section title="Driver Confirmed">
              <DriverIdCard driver={driver} />
            </Section>
          )}
          <Section title="Step 3 — Transfer Summary &amp; Confirm">
            <div className="rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 px-3 py-3 text-sm text-orange-700 dark:text-orange-400">
              <p className="font-semibold text-xs sm:text-sm">Transfer Summary</p>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed">
                Vehicle <strong className="font-mono break-all">{vehicle?.chassis_number}</strong> will be{' '}
                {driver
                  ? <>assigned to driver <strong>{driver.full_name}</strong> — </>
                  : <span className="italic">transferred without an assigned driver — </span>
                }
                status changes to IN_TRANSIT.
              </p>
            </div>
            <NotesInput value={notes} onChange={setNotes} />
            {error && <ErrorAlert message={error} />}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-1">
              <button onClick={reset}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <div className="flex-1 sm:flex-[2]">
                <ConfirmButton label="Confirm Transfer — In Transit" onClick={handleConfirm} loading={loading} variant="warning" />
              </div>
            </div>
          </Section>
        </>
      )}

      {step === 'done' && (
        <SuccessBanner
          message={driver
            ? `Vehicle ${vehicle?.chassis_number} transferred. Now in transit with ${driver.full_name}.`
            : `Vehicle ${vehicle?.chassis_number} transferred. Now in transit (no driver assigned).`}
          onReset={reset}
        />
      )}
    </div>
  );
}
