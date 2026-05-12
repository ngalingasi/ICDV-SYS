import { useState } from 'react';
import { workflowApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import {
  VehicleCard, DriverCard, NotesInput,
  ConfirmButton, ErrorAlert, SuccessBanner, Section, WorkflowProgress,
} from '../../components/tpfcs/WorkflowCard';

type Step = 'lookup' | 'confirm' | 'done';

export default function ReceivePage() {
  const [step,    setStep]    = useState<Step>('lookup');
  const [idCard,  setIdCard]  = useState('');
  const [data,    setData]    = useState<any>(null);
  const [notes,   setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const reset = () => {
    setStep('lookup'); setIdCard(''); setData(null); setNotes(''); setError('');
  };

  const handleLookup = async () => {
    if (!idCard.trim()) return;
    setLoading(true); setError('');
    try {
      const r = await workflowApi.receiveLookup(idCard.trim());
      setData(r.data);
      setStep('confirm');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Lookup failed');
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!data) return;
    setLoading(true); setError('');
    try {
      await workflowApi.receiveConfirm(data.driver.driver_id, data.assignment.vehicle_id, notes);
      toast.success(`Vehicle ${data.assignment.chassis_number} received at ICDV Yard`);
      setStep('done');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Receive confirmation failed');
    } finally { setLoading(false); }
  };

  const assignment = data?.assignment;
  const driver     = data?.driver;

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Yard Receiving</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Confirm vehicle arrival at ICDV yard
        </p>
      </div>

      {assignment && <WorkflowProgress status={assignment.workflow_status} />}

      {step === 'lookup' && (
        <Section title="Driver ID Card Scan">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter the driver's internal ID card number. The system will automatically
            fetch the driver's assigned vehicle.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={idCard}
              onChange={e => setIdCard(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              placeholder="Driver ID card number…"
              className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={handleLookup}
              disabled={loading || !idCard.trim()}
              className="px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Looking…' : 'Lookup'}
            </button>
          </div>
          {error && <ErrorAlert message={error} />}
        </Section>
      )}

      {step === 'confirm' && driver && assignment && (
        <>
          <Section title="Driver">
            <DriverCard d={driver} />
          </Section>

          <Section title="Assigned Vehicle">
            <VehicleCard v={{
              ...assignment,
              chassis_number:  assignment.chassis_number,
              vessel_name:     assignment.vessel_name,
              manifest_number: assignment.manifest_number,
            }} />
            {assignment.transferred_at && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Transferred at: {new Date(assignment.transferred_at).toLocaleString()}
              </p>
            )}
          </Section>

          <Section title="Confirm Yard Receipt">
            <div className="rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 px-4 py-3 text-sm text-green-800 dark:text-green-300">
              <p className="font-semibold">Ready to receive</p>
              <p className="mt-1">
                Confirming will mark vehicle{' '}
                <strong className="font-mono">{assignment.chassis_number}</strong>{' '}
                as RECEIVED at ICDV Yard and close the driver assignment.
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
                label="Confirm Receipt at ICDV Yard"
                onClick={handleConfirm}
                loading={loading}
                variant="success"
              />
            </div>
          </Section>
        </>
      )}

      {step === 'done' && (
        <SuccessBanner
          message={`Vehicle ${assignment?.chassis_number} received at ICDV Yard. Driver assignment closed.`}
          onReset={reset}
        />
      )}
    </div>
  );
}
