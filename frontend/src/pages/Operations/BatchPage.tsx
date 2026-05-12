import { useState } from 'react';
import { Link } from 'react-router';
import { workflowApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import {
  ChassisInput, VehicleCard, NotesInput,
  ConfirmButton, ErrorAlert, Section, WorkflowProgress,
} from '../../components/tpfcs/WorkflowCard';

type Step = 'search' | 'confirm' | 'done';

export default function BatchPage() {
  const [step,    setStep]    = useState<Step>('search');
  const [chassis, setChassis] = useState('');
  const [vehicle, setVehicle] = useState<any>(null);
  const [notes,   setNotes]   = useState('');
  const [result,  setResult]  = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const reset = () => {
    setStep('search'); setChassis(''); setVehicle(null);
    setNotes(''); setResult(null); setError('');
  };

  const handleSearch = async () => {
    if (chassis.trim().length < 4) return;
    setLoading(true); setError('');
    try {
      const r = await workflowApi.batchLookup(chassis.trim());
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
      const r = await workflowApi.batchConfirm(vehicle.vehicle_id, notes);
      setResult(r.data);
      toast.success(`Vehicle added to batch ${r.data.batch_number}`);
      setStep('done');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Batch assignment failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Batch Process</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Group discharged vehicles into operational batches
          </p>
        </div>
        <Link to="/operations/batches"
          className="text-sm text-brand-500 hover:text-brand-600 font-medium">
          View Batches →
        </Link>
      </div>

      {vehicle && <WorkflowProgress status={vehicle.workflow_status} />}

      <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-4 py-3 text-xs text-blue-700 dark:text-blue-400">
        System automatically assigns to today's batch for the vessel. Max 20 vehicles per batch.
        A new batch is created when the current one is full.
      </div>

      {step === 'search' && (
        <Section title="Step 1 — Search Vehicle">
          <ChassisInput
            value={chassis} onChange={setChassis}
            onSearch={handleSearch} loading={loading}
          />
          {error && <ErrorAlert message={error} />}
        </Section>
      )}

      {step === 'confirm' && vehicle && (
        <>
          <Section title="Step 2 — Confirm Vehicle">
            <VehicleCard v={vehicle} />
          </Section>
          <Section title="Step 3 — Confirm Batch Assignment">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-4 py-3 text-sm">
              <p className="text-gray-500 dark:text-gray-400">
                Vessel: <span className="font-semibold text-gray-800 dark:text-white">{vehicle.vessel_name}</span>
              </p>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                System will assign to today's open batch or create a new one automatically.
              </p>
            </div>
            <NotesInput value={notes} onChange={setNotes} />
            {error && <ErrorAlert message={error} />}
            <div className="flex gap-3 pt-1">
              <button onClick={reset}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancel
              </button>
              <ConfirmButton
                label="Confirm — Add to Batch"
                onClick={handleConfirm}
                loading={loading}
              />
            </div>
          </Section>
        </>
      )}

      {step === 'done' && result && (
        <div className="rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 p-5 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-semibold text-green-800 dark:text-green-300">Vehicle added to batch</p>
          <div className="inline-block rounded-lg bg-white dark:bg-gray-900 border border-green-200 dark:border-green-500/30 px-4 py-2">
            <p className="font-mono font-bold text-gray-900 dark:text-white text-lg">{result.batch_number}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Batch Number</p>
          </div>
          <div className="flex gap-2 justify-center">
            <button onClick={reset}
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors">
              Process Next Vehicle
            </button>
            <Link to={`/operations/batches/${result.batch_id}`}
              className="px-4 py-2 rounded-lg border border-green-300 dark:border-green-500/40 text-green-700 dark:text-green-400 text-sm font-medium hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors">
              View Batch
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
