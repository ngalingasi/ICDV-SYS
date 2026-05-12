import { useState } from 'react';
import { workflowApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import {
  ChassisInput, VehicleCard, NotesInput,
  ConfirmButton, ErrorAlert, SuccessBanner, Section, WorkflowProgress,
} from '../../components/tpfcs/WorkflowCard';

type Step = 'search' | 'confirm' | 'done';

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
    <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Discharge Process</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Move vehicle from vessel to Holding Ground
        </p>
      </div>

      {vehicle && <WorkflowProgress status={vehicle.workflow_status} />}

      {step === 'search' && (
        <Section title="Step 1 — Search Vehicle">
          <ChassisInput
            value={chassis} onChange={setChassis}
            onSearch={handleSearch} loading={loading}
          />
          {error && <ErrorAlert message={error} />}
          <p className="text-xs text-gray-400">Enter the last 4 digits of the chassis number</p>
        </Section>
      )}

      {step === 'confirm' && vehicle && (
        <>
          <Section title="Step 2 — Confirm Vehicle">
            <VehicleCard v={vehicle} />
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              ⚠ Confirm this is the correct vehicle before discharging
            </p>
          </Section>

          <Section title="Step 3 — Notes &amp; Confirm">
            <NotesInput value={notes} onChange={setNotes} />
            {error && <ErrorAlert message={error} />}
            <div className="flex gap-3 pt-1">
              <button
                onClick={reset}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <ConfirmButton
                label="Confirm Discharge → Holding Ground"
                onClick={handleConfirm}
                loading={loading}
                variant="warning"
              />
            </div>
          </Section>
        </>
      )}

      {step === 'done' && (
        <SuccessBanner
          message={`Vehicle ${vehicle?.chassis_number} successfully discharged to Holding Ground`}
          onReset={reset}
        />
      )}
    </div>
  );
}
