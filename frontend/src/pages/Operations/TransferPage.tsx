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

// ── Driver ID Card component ──────────────────────────────────────────────────
function DriverIdCard({ driver }: { driver: any }) {
  const photoUrl = driver.photo ? `${API_BASE}${driver.photo}` : null;

  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      {/* Card body */}
      <div
        className="relative rounded-2xl overflow-hidden shadow-xl"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563a8 60%, #1d4ed8 100%)' }}
      >
        {/* Top gold accent strip */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)' }}
        />

        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
            backgroundSize: '12px 12px',
          }}
        />

        {/* Decorative glow circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #93c5fd, transparent)' }} />

        {/* ── Card inner content ── */}
        <div className="relative p-5">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200">
                ICDV Port Authority
              </p>
              <p className="text-[11px] text-blue-300 mt-0.5">Driver Identification Card</p>
            </div>
            {/* Shield icon */}
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>

          {/* Photo + fields */}
          <div className="flex gap-4">
            {/* Photo box */}
            <div className="flex-shrink-0">
              <div className="w-[76px] h-[92px] rounded-xl overflow-hidden border-2 border-white/30 bg-blue-900/60 shadow-lg">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={driver.full_name}
                    className="w-full h-full object-cover"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-blue-300/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Fields */}
            <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">
              <div>
                <p className="text-white font-bold text-base leading-tight truncate">
                  {driver.full_name}
                </p>
                <p className="text-blue-300 text-[11px] font-medium mt-0.5">
                  {driver.status === 'active' ? 'Authorised Driver' : driver.status?.toUpperCase()}
                </p>
              </div>
              <CardField label="ID Card No."  value={driver.id_number ?? '—'} highlight />
              <CardField label="License No."  value={driver.license_number} />
              {driver.phone && <CardField label="Mobile" value={driver.phone} />}
            </div>
          </div>

          {/* Bottom status row */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 animate-pulse ${
                driver.status === 'active' ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <span className={`text-[11px] font-semibold uppercase tracking-wide ${
                driver.status === 'active' ? 'text-green-300' : 'text-red-300'
              }`}>
                {driver.status === 'active' ? 'Active — Cleared for duty' : driver.status}
              </span>
            </div>
            {/* Chip graphic */}
            <div
              className="w-9 h-6 rounded border border-yellow-300/40"
              style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(251,191,36,0.06))' }}
            >
              <div className="w-full h-full grid grid-cols-3 gap-px p-[3px] opacity-50">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="bg-yellow-300/60 rounded-[1px]" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer bar */}
        <div className="px-5 py-2 bg-black/25 border-t border-white/10">
          <p className="text-[9px] text-blue-300/60 tracking-[0.14em] uppercase text-center font-mono">
            ICDV Vehicle Import &amp; Delivery Management System
          </p>
        </div>
      </div>

      {/* Ambient glow shadow */}
      <div
        className="absolute -inset-1 rounded-2xl blur-lg -z-10 opacity-25"
        style={{ background: 'linear-gradient(135deg, #1e3a5f, #2563a8)' }}
      />
    </div>
  );
}

function CardField({
  label, value, highlight = false,
}: {
  label: string; value: string; highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.12em] text-blue-300/60 font-medium leading-none mb-0.5">
        {label}
      </p>
      <p className={`text-[12px] font-mono leading-tight truncate ${
        highlight ? 'text-yellow-300 font-bold tracking-wider' : 'text-white/90 font-medium'
      }`}>
        {value}
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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
      setVehicle(r.data);
      setStep('driver');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Vehicle search failed');
    } finally { setLoading(false); }
  };

  const handleDriverSearch = async () => {
    if (!idCard.trim()) return;
    setLoading(true); setError('');
    try {
      const r = await workflowApi.driverLookup(idCard.trim());
      setDriver(r.data);
      setStep('confirm');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Driver lookup failed');
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!vehicle || !driver) return;
    setLoading(true); setError('');
    try {
      await workflowApi.transferConfirm({
        vehicle_id:     vehicle.vehicle_id,
        driver_id:      driver.driver_id,
        driver_id_card: idCard.trim(),
        notes,
      });
      toast.success(`Vehicle ${vehicle.chassis_number} transferred with driver ${driver.full_name}`);
      setStep('done');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Transfer confirmation failed');
    } finally { setLoading(false); }
  };

  const stepLabels: Step[] = ['vehicle', 'driver', 'confirm'];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">TPA Gate Transfer</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Vehicle checkout from TPA gate to ICDV yard
        </p>
      </div>

      {vehicle && <WorkflowProgress status={vehicle.workflow_status} />}

      {/* Step pills */}
      <div className="flex gap-2">
        {stepLabels.map((s, i) => (
          <div key={s} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
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

      {/* ── Step 1: Vehicle ─────────────────────────────────────────────── */}
      {step === 'vehicle' && (
        <Section title="Step 1 — Identify Vehicle">
          <ChassisInput
            value={chassis} onChange={setChassis}
            onSearch={handleVehicleSearch} loading={loading}
          />
          {error && <ErrorAlert message={error} />}
        </Section>
      )}

      {/* Vehicle confirmed (steps 2 + 3) */}
      {(step === 'driver' || step === 'confirm') && vehicle && (
        <Section title="Vehicle Confirmed">
          <VehicleCard v={vehicle} />
        </Section>
      )}

      {/* ── Step 2: Driver ID scan ───────────────────────────────────────── */}
      {step === 'driver' && (
        <Section title="Step 2 — Scan Driver ID Card">
          <div className="flex gap-2">
            <input
              type="text"
              value={idCard}
              onChange={e => setIdCard(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDriverSearch()}
              placeholder="Enter driver internal ID card number..."
              className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={handleDriverSearch}
              disabled={loading || !idCard.trim()}
              className="px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Looking...' : 'Lookup'}
            </button>
          </div>
          {error && <ErrorAlert message={error} />}
        </Section>
      )}

      {/* ── Step 3: ID Card + confirm ────────────────────────────────────── */}
      {step === 'confirm' && driver && (
        <>
          <Section title="Driver Confirmed">
            <DriverCard d={driver} />
          </Section>

          {/* Summary + action */}
          <Section title="Step 3 — Transfer Summary &amp; Confirm">
            <div className="rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 px-4 py-3 text-sm text-orange-700 dark:text-orange-400">
              <p className="font-semibold">Transfer Summary</p>
              <p className="mt-1">
                Vehicle <strong className="font-mono">{vehicle.chassis_number}</strong> will be
                assigned to driver <strong>{driver.full_name}</strong> and status will change
                to IN_TRANSIT.
              </p>
            </div>
            <NotesInput value={notes} onChange={setNotes} />
            {error && <ErrorAlert message={error} />}
            <div className="flex gap-3 pt-1">
              <button
                onClick={reset}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <ConfirmButton
                label="Confirm Transfer — In Transit"
                onClick={handleConfirm}
                loading={loading}
                variant="warning"
              />
            </div>
          </Section>
        </>
      )}

      {/* Done */}
      {step === 'done' && (
        <SuccessBanner
          message={`Vehicle ${vehicle?.chassis_number} transferred. Now in transit with ${driver?.full_name}.`}
          onReset={reset}
        />
      )}
    </div>
  );
}
