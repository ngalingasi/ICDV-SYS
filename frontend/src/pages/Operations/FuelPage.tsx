import { useState } from 'react';
import { Link } from 'react-router';
import { fuelApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import {
  ChassisInput, VehicleCard, NotesInput,
  ConfirmButton, ErrorAlert, SuccessBanner, Section,
} from '../../components/tpfcs/WorkflowCard';

type Step = 'search' | 'fuel' | 'confirm' | 'done';

type StockRow = { fuel_type: string; total_ordered: number; total_dispensed: number; current_stock: number } | null;

function StockBadge({ stock, type }: { stock: StockRow; type: string }) {
  if (!stock) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20">
      No {type} stock ordered
    </span>
  );
  const available = parseFloat(String(stock.current_stock));
  const color = available > 50 ? 'green' : available > 10 ? 'amber' : 'red';
  const cls = {
    green: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    red:   'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
  }[color];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
      {type}: {available.toFixed(1)}L available
    </span>
  );
}

export default function FuelPage() {
  const [step,       setStep]       = useState<Step>('search');
  const [chassis,    setChassis]    = useState('');
  const [vehicle,    setVehicle]    = useState<any>(null);
  const [fuelType,   setFuelType]   = useState<'diesel' | 'petrol'>('diesel');
  const [litres,     setLitres]     = useState('');
  const [notes,      setNotes]      = useState('');
  const [result,     setResult]     = useState<any>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const reset = () => {
    setStep('search'); setChassis(''); setVehicle(null);
    setFuelType('diesel'); setLitres(''); setNotes('');
    setResult(null); setError('');
  };

  const handleSearch = async () => {
    if (chassis.trim().length < 4) return;
    setLoading(true); setError('');
    try {
      const r = await fuelApi.lookup(chassis.trim());
      setVehicle(r.data);
      setStep('fuel');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Vehicle not found');
    } finally { setLoading(false); }
  };

  const handleFuelNext = () => {
    const l = parseFloat(litres);
    if (!l || l <= 0) { setError('Enter a valid litre amount'); return; }
    const stock: StockRow = vehicle?.stock?.[fuelType];
    if (!stock || parseFloat(String(stock.current_stock)) <= 0) {
      setError(`No approved ${fuelType} stock available for this manifest`);
      return;
    }
    if (l > parseFloat(String(stock.current_stock))) {
      setError(`Requested ${l}L exceeds available stock of ${parseFloat(String(stock.current_stock)).toFixed(1)}L`);
      return;
    }
    setError('');
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!vehicle) return;
    setLoading(true); setError('');
    try {
      const r = await fuelApi.dispense({
        vehicle_id:       vehicle.vehicle_id,
        fuel_type:        fuelType,
        litres_dispensed: parseFloat(litres),
        notes:            notes || undefined,
      });
      setResult(r.data);
      toast.success(`Dispensed ${litres}L of ${fuelType} to ${vehicle.chassis_number}`);
      setStep('done');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Dispense failed');
    } finally { setLoading(false); }
  };

  const stockForType: StockRow = vehicle?.stock?.[fuelType] ?? null;

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">Fuel Dispense</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Dispense diesel or petrol to a vehicle
          </p>
        </div>
        <Link to="/manifests" className="flex-shrink-0 text-xs sm:text-sm text-brand-500 hover:text-brand-600 font-medium whitespace-nowrap">
          Manifests →
        </Link>
      </div>

      {/* Step 1 — Chassis search */}
      {step === 'search' && (
        <Section title="Step 1 — Search Vehicle">
          <ChassisInput value={chassis} onChange={setChassis} onSearch={handleSearch} loading={loading} />
          {error && <ErrorAlert message={error} />}
        </Section>
      )}

      {/* Step 2 — Choose fuel type + litres */}
      {step === 'fuel' && vehicle && (
        <>
          <VehicleCard v={vehicle} />

          {/* Stock summary for this manifest */}
          <Section title="Manifest Fuel Stock">
            <div className="flex flex-wrap gap-2">
              <StockBadge stock={vehicle.stock?.diesel} type="Diesel" />
              <StockBadge stock={vehicle.stock?.petrol} type="Petrol" />
            </div>
            {vehicle.prior_dispensings?.length > 0 && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Prior dispensings for this vehicle:{' '}
                {vehicle.prior_dispensings.map((d: any) =>
                  `${d.fuel_type} ×${d.times} (${parseFloat(d.total_litres).toFixed(1)}L)`
                ).join(', ')}
              </div>
            )}
          </Section>

          <Section title="Step 2 — Fuel Details">
            {/* Fuel type toggle */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Fuel type</p>
              <div className="flex gap-2">
                {(['diesel', 'petrol'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setFuelType(t); setError(''); }}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors
                      ${fuelType === t
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-brand-300 dark:hover:border-brand-600'
                      }`}
                  >
                    {t === 'diesel' ? 'Diesel' : 'Petrol'}
                  </button>
                ))}
              </div>
            </div>

            {/* Litres input */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Litres to dispense
                {stockForType && (
                  <span className="ml-2 text-gray-400 dark:text-gray-500 font-normal">
                    (max {parseFloat(String(stockForType.current_stock)).toFixed(1)}L available)
                  </span>
                )}
              </p>
              <input
                type="text"
                inputMode="decimal"
                value={litres}
                onChange={e => {
                  // Allow digits, one decimal point, and empty string only
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setLitres(v);
                }}
                onKeyDown={e => e.key === 'Enter' && handleFuelNext()}
                placeholder="e.g. 40.0"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {!stockForType && (
              <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2.5 text-xs text-red-700 dark:text-red-400">
                No approved {fuelType} orders exist for this manifest. A supervisor or admin must approve a fuel order before dispensing.
              </div>
            )}

            {error && <ErrorAlert message={error} />}

            <div className="flex gap-2 pt-1">
              <button onClick={reset}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleFuelNext}
                disabled={!litres || parseFloat(litres) <= 0 || !stockForType}
                className="flex-[2] py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                Continue →
              </button>
            </div>
          </Section>
        </>
      )}

      {/* Step 3 — Confirm */}
      {step === 'confirm' && vehicle && (
        <>
          <VehicleCard v={vehicle} />
          <Section title="Step 3 — Confirm Dispense">
            <div className="rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 px-4 py-3 text-sm">
              <p className="font-semibold text-brand-800 dark:text-brand-300 text-xs uppercase tracking-wide mb-2">Dispense Summary</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Vehicle</span>
                  <p className="font-mono font-bold text-gray-900 dark:text-white">{vehicle.chassis_number}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Manifest</span>
                  <p className="font-medium text-gray-700 dark:text-gray-300">{vehicle.manifest_number}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Fuel type</span>
                  <p className="font-medium capitalize text-gray-700 dark:text-gray-300">{fuelType}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Litres</span>
                  <p className="font-bold text-gray-900 dark:text-white">{parseFloat(litres).toFixed(1)}L</p>
                </div>
              </div>
              {stockForType && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Remaining stock after dispense:{' '}
                  <strong>{(parseFloat(String(stockForType.current_stock)) - parseFloat(litres)).toFixed(1)}L</strong>
                </p>
              )}
            </div>
            <NotesInput value={notes} onChange={setNotes} />
            {error && <ErrorAlert message={error} />}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep('fuel')}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Back
              </button>
              <div className="flex-[2]">
                <ConfirmButton
                  label={`Confirm — Dispense ${parseFloat(litres).toFixed(1)}L ${fuelType}`}
                  onClick={handleConfirm}
                  loading={loading}
                  variant="success"
                />
              </div>
            </div>
          </Section>
        </>
      )}

      {/* Done */}
      {step === 'done' && result && (
        <SuccessBanner
          message={`${result.litres_dispensed}L of ${result.fuel_type} dispensed to ${result.chassis_number}. Remaining stock: ${parseFloat(result.remaining_stock).toFixed(1)}L`}
          onReset={reset}
        />
      )}
    </div>
  );
}
