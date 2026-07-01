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
      setData(r.data); setStep('confirm');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Lookup failed');
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!data) return;
    setLoading(true); setError('');
    try {
      const companionIds = (data.companions ?? []).map((c: any) => c.vehicle_id);
      await workflowApi.receiveConfirm(
        data.driver.driver_id,
        data.assignment.vehicle_id,
        notes,
        companionIds,
      );
      const allChassis = [data.assignment.chassis_number, ...(data.companions ?? []).map((c: any) => c.chassis_number)];
      const msg = allChassis.length > 1
        ? `${allChassis.length} vehicles (${allChassis.join(', ')}) have been received at the ICDV Yard.`
        : `Vehicle ${data.assignment.chassis_number} has been received at the ICDV Yard.`;
      toast.success(msg);
      setStep('done');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Receive confirmation failed');
    } finally { setLoading(false); }
  };

  const assignment  = data?.assignment;
  const driver      = data?.driver;
  const companions  = data?.companions ?? [];
  const allVehicles = assignment ? [assignment, ...companions] : [];

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">

      <div>
        <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">Yard Receiving</h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Confirm vehicle arrival at ICDV yard
        </p>
      </div>

      {assignment && <WorkflowProgress status={step === 'done' ? 'received' : assignment.workflow_status} completed />}

      {step === 'lookup' && (
        <Section title="Driver ID Card Scan">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Enter the driver's internal ID card number. The system will automatically
            fetch the driver's assigned vehicle(s).
          </p>
          <div className="flex gap-2">
            <input type="text" value={idCard} onChange={e => setIdCard(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              placeholder="Driver ID card number..."
              autoComplete="off"
              className="flex-1 min-w-0 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button onClick={handleLookup} disabled={loading || !idCard.trim()}
              className="flex-shrink-0 whitespace-nowrap px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {loading ? 'Looking...' : 'Lookup'}
            </button>
          </div>
          {error && <ErrorAlert message={error} />}
        </Section>
      )}

      {step === 'confirm' && driver && assignment && (
        <>
          <Section title="Driver"><DriverCard d={driver} /></Section>

          {/* Show all vehicles — primary + companions */}
          {companions.length === 0 ? (
            <Section title="Assigned Vehicle">
              <VehicleCard v={{
                ...assignment,
                chassis_number:  assignment.chassis_number,
                vessel_name:     assignment.vessel_name,
                manifest_number: assignment.manifest_number,
              }} />
              {assignment.transferred_at && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Transferred at:{' '}
                  {new Date(assignment.transferred_at).toLocaleString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </Section>
          ) : (
            <Section title={`${allVehicles.length} Vehicles in This Trip`}>
              <div className="space-y-2">
                {allVehicles.map((v: any, i: number) => (
                  <div key={v.vehicle_id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 ${i === 0 ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                        {i === 0 ? 'Primary' : 'Companion'}
                      </span>
                      <p className="font-mono text-sm font-semibold text-gray-800 dark:text-white">{v.chassis_number}</p>
                    </div>
                    {(v.brand || v.model || v.color) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 ml-0.5">
                        {[v.brand, v.model, v.color].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {assignment.transferred_at && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Transferred at:{' '}
                  {new Date(assignment.transferred_at).toLocaleString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </Section>
          )}

          <Section title="Confirm Yard Receipt">
            <div className="rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 px-3 py-3">
              <p className="font-semibold text-xs sm:text-sm text-green-800 dark:text-green-300">Ready to receive</p>
              <p className="mt-1 text-xs sm:text-sm text-green-800 dark:text-green-300 leading-relaxed">
                {allVehicles.length === 1
                  ? <>Confirming will mark vehicle <strong className="font-mono break-all">{assignment.chassis_number}</strong> as RECEIVED at ICDV Yard and close the driver assignment.</>
                  : <>Confirming will mark all {allVehicles.length} vehicles as RECEIVED at ICDV Yard and close the driver assignment.</>
                }
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
                <ConfirmButton
                  label={allVehicles.length === 1 ? 'Confirm Receipt at ICDV Yard' : `Confirm Receipt — ${allVehicles.length} Vehicles`}
                  onClick={handleConfirm}
                  loading={loading}
                  variant="success"
                />
              </div>
            </div>
          </Section>
        </>
      )}

      {step === 'done' && (
        <SuccessBanner
          message={
            companions.length === 0
              ? `Vehicle ${assignment?.chassis_number} has been received at the ICDV Yard. Driver assignment closed.`
              : `${allVehicles.length} vehicles have been received at the ICDV Yard. Driver assignment closed.`
          }
          onReset={reset}
        />
      )}
    </div>
  );
}
