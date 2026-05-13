import { useState } from 'react';
import { workflowApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import {
  ChassisInput, VehicleCard, DriverCard, NotesInput,
  ConfirmButton, ErrorAlert, SuccessBanner, Section, WorkflowProgress,
} from '../../components/tpfcs/WorkflowCard';

const RAW_API  = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000/api';
const API_BASE = RAW_API.replace(/\/api(\/v\d+)?$/, '');

type Step = 'vehicle' | 'driver' | 'confirm' | 'done';

// ── Driver ID Card — hidden, preserved for future use ────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _DriverIdCard({ driver }: { driver: any }) {
  const photoUrl = driver.photo ? `${API_BASE}${driver.photo}` : null;
  return (
    <div className="relative w-full max-w-xs sm:max-w-sm mx-auto select-none">
      <div className="relative rounded-2xl overflow-hidden shadow-xl"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563a8 60%, #1d4ed8 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-1.5"
          style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)' }} />
        <div className="relative p-4 sm:p-5">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="w-[64px] h-[80px] sm:w-[76px] sm:h-[92px] rounded-xl overflow-hidden border-2 border-white/30 bg-blue-900/60">
                {photoUrl ? (
                  <img src={photoUrl} alt={driver.full_name} className="w-full h-full object-cover"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-300/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">{driver.full_name}</p>
              <p className="font-mono text-[11px] text-yellow-300 font-bold mt-1">{driver.id_number ?? '—'}</p>
              <p className="font-mono text-[11px] text-white/90">{driver.license_number}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TransferPage() {
  const [step,    setStep]    = useState<Step>('vehicle');
  const [chassis, setChassis] = useState('');
  const [idCard,  setIdCard]  = useState('');
  const [vehicle, setVehicle] = useState<any>(null);
  const [driver,  setDriver]  = useState<any>(null);
  const [notes,   setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

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

  const handleConfirm = async () => {
    if (!vehicle || !driver) return;
    setLoading(true); setError('');
    try {
      await workflowApi.transferConfirm({
        vehicle_id: vehicle.vehicle_id, driver_id: driver.driver_id,
        driver_id_card: idCard.trim(), notes,
      });
      toast.success(`Vehicle ${vehicle.chassis_number} transferred with driver ${driver.full_name}`);
      setStep('done');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Transfer confirmation failed');
    } finally { setLoading(false); }
  };

  const stepLabels: Step[] = ['vehicle', 'driver', 'confirm'];
  const stepNames = ['Vehicle', 'Driver', 'Confirm'];

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">

      <div>
        <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">TPA Gate Transfer</h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Vehicle checkout from TPA gate to ICDV yard
        </p>
      </div>

      {vehicle && <WorkflowProgress status={vehicle.workflow_status} />}

      {/* Step pills — horizontal scroll on very small screens */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-2 min-w-max">
          {stepLabels.map((s, i) => {
            const done = stepLabels.indexOf(step) > i || step === 'done';
            return (
              <div key={s} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                step === s ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
                : done     ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                           : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold">
                  {done ? '✓' : String(i + 1)}
                </span>
                {stepNames[i]}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1 — Vehicle */}
      {step === 'vehicle' && (
        <Section title="Step 1 — Identify Vehicle">
          <ChassisInput value={chassis} onChange={setChassis} onSearch={handleVehicleSearch} loading={loading} />
          {error && <ErrorAlert message={error} />}
        </Section>
      )}

      {/* Vehicle confirmed (steps 2 + 3) */}
      {(step === 'driver' || step === 'confirm') && vehicle && (
        <Section title="Vehicle Confirmed">
          <VehicleCard v={vehicle} />
        </Section>
      )}

      {/* Step 2 — Driver ID */}
      {step === 'driver' && (
        <Section title="Step 2 — Scan Driver ID Card">
          <div className="flex gap-2">
            <input
              type="text" value={idCard} onChange={e => setIdCard(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDriverSearch()}
              placeholder="Enter driver ID card number..."
              autoComplete="off"
              className="flex-1 min-w-0 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button onClick={handleDriverSearch} disabled={loading || !idCard.trim()}
              className="flex-shrink-0 whitespace-nowrap px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {loading ? 'Looking...' : 'Lookup'}
            </button>
          </div>
          {error && <ErrorAlert message={error} />}
        </Section>
      )}

      {/* Step 3 — Confirm */}
      {step === 'confirm' && driver && (
        <>
          <Section title="Driver Confirmed">
            <DriverCard d={driver} />
          </Section>

          <Section title="Step 3 — Transfer Summary &amp; Confirm">
            <div className="rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 px-3 py-3">
              <p className="font-semibold text-xs sm:text-sm text-orange-700 dark:text-orange-400">Transfer Summary</p>
              <p className="mt-1 text-xs sm:text-sm text-orange-700 dark:text-orange-400 leading-relaxed">
                Vehicle <strong className="font-mono break-all">{vehicle.chassis_number}</strong> will be
                assigned to driver <strong>{driver.full_name}</strong> — status changes to IN_TRANSIT.
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
          message={`Vehicle ${vehicle?.chassis_number} transferred. Now in transit with ${driver?.full_name}.`}
          onReset={reset}
        />
      )}
    </div>
  );
}
