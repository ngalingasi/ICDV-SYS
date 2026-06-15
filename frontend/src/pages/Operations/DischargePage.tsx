import { useState } from 'react';
import { workflowApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import {
  ChassisInput, VehicleCard, NotesInput,
  ConfirmButton, ErrorAlert, SuccessBanner, Section, WorkflowProgress,
} from '../../components/tpfcs/WorkflowCard';

type Step = 'search' | 'confirm' | 'done';

const WarningIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

export default function DischargePage() {
  const [step,    setStep]    = useState<Step>('search');
  const [chassis, setChassis] = useState('');
  const [vehicle, setVehicle] = useState<any>(null);
  const [notes,   setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const reset = () => {
    setStep('search'); setChassis(''); setVehicle(null);
    setNotes(''); setError('');
  };

  const handleSearch = async () => {
    if (chassis.trim().length < 4) return;
    setLoading(true); setError('');
    try {
      const r = await workflowApi.dischargeLookup(chassis.trim());
      setVehicle(r.data);
      setStep('confirm');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Search failed');
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!vehicle) return;
    setLoading(true); setError('');
    try {
      await workflowApi.dischargeConfirm(vehicle.vehicle_id, notes);
      toast.success(`Vehicle ${vehicle.chassis_number} discharged to Holding Ground`);
      setStep('done');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Discharge failed');
    } finally { setLoading(false); }
  };

  return (
    /*
     * Removed p-4/p-6 — AppLayout already provides horizontal padding.
     * max-w-2xl keeps it readable on wide screens without double-indenting on mobile.
     */
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">

      <div>
        <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
          Discharge Process
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Move vehicle from vessel to Holding Ground
        </p>
      </div>

      {vehicle && <WorkflowProgress status={step === 'done' ? 'discharged' : vehicle.workflow_status} />}

      {/* ── Step 1: Search ─────────────────────────────────────────────── */}
      {step === 'search' && (
        <Section title="Step 1 — Search Vehicle">
          <ChassisInput
            value={chassis} onChange={setChassis}
            onSearch={handleSearch} loading={loading}
          />
          {error && <ErrorAlert message={error} />}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Enter the last 4 or more digits of the chassis number.
          </p>
        </Section>
      )}

      {/* ── Steps 2 + 3: Confirm + Notes ───────────────────────────────── */}
      {step === 'confirm' && vehicle && (
        <>
          <Section title="Step 2 — Confirm Vehicle">
            <VehicleCard v={vehicle} />
            {/* Warning: flex row so icon stays left-aligned when text wraps */}
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-2.5">
              <span className="text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0">
                <WarningIcon />
              </span>
              <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400 font-medium">
                Confirm this is the correct vehicle before discharging.
              </p>
            </div>
          </Section>

          <Section title="Step 3 — Notes &amp; Confirm">
            <NotesInput value={notes} onChange={setNotes} />
            {error && <ErrorAlert message={error} />}
            {/*
             * Buttons: column-reverse on mobile (primary on top),
             * side-by-side from sm upward.
             */}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-1">
              <button
                onClick={reset}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <div className="flex-1 sm:flex-[2]">
                <ConfirmButton
                  label="Confirm Discharge to Holding Ground"
                  onClick={handleConfirm}
                  loading={loading}
                  variant="warning"
                />
              </div>
            </div>
          </Section>
        </>
      )}

      {/* ── Done ───────────────────────────────────────────────────────── */}
      {step === 'done' && (
        <SuccessBanner
          message={`Vehicle ${vehicle?.chassis_number} successfully discharged to Holding Ground`}
          onReset={reset}
        />
      )}
    </div>
  );
}
