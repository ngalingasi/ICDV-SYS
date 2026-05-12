import { useState } from 'react';
import { workflowApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import {
  VehicleCard, DriverCard, NotesInput,
  ConfirmButton, ErrorAlert, SuccessBanner, Section, WorkflowProgress,
} from '../../components/tpfcs/WorkflowCard';

type Step = 'vehicle' | 'driver' | 'confirm' | 'done';

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
        vehicle_id:    vehicle.vehicle_id,
        driver_id:     driver.driver_id,
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
    <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-5">
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
          <div key={s} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            step === s
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
              : stepLabels.indexOf(step) > i || step === 'done'
                ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          }`}>
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold">
              {(stepLabels.indexOf(step) > i || step === 'done') ? '✓' : String(i + 1)}
            </span>
            {['Vehicle', 'Driver', 'Confirm'][i]}
          </div>
        ))}
      </div>

      {/* Step 1: Vehicle */}
      {step === 'vehicle' && (
        <Section title="Step 1 — Identify Vehicle">
          <div className="flex gap-2">
            <input
              type="text"
              value={chassis}
              onChange={e => setChassis(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleVehicleSearch()}
              placeholder="Enter last 4 chassis digits…"
              className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase"
            />
            <button
              onClick={handleVehicleSearch}
              disabled={loading || chassis.trim().length < 4}
              className="px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
          {error && <ErrorAlert message={error} />}
        </Section>
      )}

      {/* Vehicle confirmed panel (shown in driver + confirm steps) */}
      {(step === 'driver' || step === 'confirm') && vehicle && (
        <Section title="Vehicle Confirmed">
          <VehicleCard v={vehicle} />
        </Section>
      )}

      {/* Step 2: Driver */}
      {step === 'driver' && (
        <Section title="Step 2 — Identify Driver">
          <div className="flex gap-2">
            <input
              type="text"
              value={idCard}
              onChange={e => setIdCard(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDriverSearch()}
              placeholder="Driver internal ID card number…"
              className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={handleDriverSearch}
              disabled={loading || !idCard.trim()}
              className="px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Looking…' : 'Lookup'}
            </button>
          </div>
          {error && <ErrorAlert message={error} />}
        </Section>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && driver && (
        <>
          <Section title="Driver Confirmed">
            <DriverCard d={driver} />
          </Section>

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
              <button onClick={reset}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancel
              </button>
              <ConfirmButton
                label="Confirm Transfer → In Transit"
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
          message={`Vehicle ${vehicle?.chassis_number} transferred. Now in transit with ${driver?.full_name}.`}
          onReset={reset}
        />
      )}
    </div>
  );
}
