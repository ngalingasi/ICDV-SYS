import type { ReactNode } from 'react';
import StatusBadge from './StatusBadge';

// Derive static server base from VITE_API_URL (strips /api suffix)
const RAW_API   = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000/api';
const API_BASE  = RAW_API.replace(/\/api(\/v\d+)?$/, '');

const buildPhotoUrl = (photo?: string | null): string | null =>
  photo ? `${API_BASE}${photo}` : null;

// ── Vehicle info card ─────────────────────────────────────────────────────────
export function VehicleCard({ v }: { v: any }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-lg font-bold text-gray-900 dark:text-white tracking-wide">
            {v.chassis_number}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {[v.brand, v.model, v.year, v.color].filter(Boolean).join(' - ')}
          </p>
        </div>
        <StatusBadge status={v.workflow_status || v.status || 'unknown'} />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {v.vessel_name     && <Row label="Vessel"      value={v.vessel_name} />}
        {v.manifest_number && <Row label="Manifest"    value={v.manifest_number} />}
        {v.customer_name   && <Row label="Customer"    value={v.customer_name} />}
        {v.destination     && <Row label="Destination" value={v.destination} />}
        {v.current_location && <Row label="Location"   value={v.current_location.replace(/_/g, ' ')} />}
        {v.batch_number    && <Row label="Batch"       value={v.batch_number} />}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400 dark:text-gray-500">{label}: </span>
      <span className="font-medium text-gray-700 dark:text-gray-200">{value}</span>
    </div>
  );
}

// ── Driver info card — shows profile photo ────────────────────────────────────
export function DriverCard({ d }: { d: any }) {
  const photoUrl = buildPhotoUrl(d.photo);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
      <div className="flex items-center gap-4">
        {/* Profile photo */}
        <div className="w-14 h-14 rounded-full flex-shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-600 shadow-sm">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={d.full_name}
              className="w-full h-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-brand-100 dark:bg-brand-500/20">
              <svg className="w-7 h-7 text-brand-500 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>

        {/* Driver info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-gray-900 dark:text-white truncate">{d.full_name}</p>
            <StatusBadge status={d.status} />
          </div>
          <div className="mt-1 space-y-0.5 text-sm">
            <p className="text-gray-500 dark:text-gray-400">
              <span className="text-gray-400 dark:text-gray-500">License: </span>
              <span className="font-medium text-gray-700 dark:text-gray-200">{d.license_number}</span>
            </p>
            {d.id_number && (
              <p className="text-gray-500 dark:text-gray-400">
                <span className="text-gray-400 dark:text-gray-500">ID Card: </span>
                <span className="font-medium text-gray-700 dark:text-gray-200">{d.id_number}</span>
              </p>
            )}
            {d.phone && (
              <p className="text-gray-500 dark:text-gray-400">
                <span className="text-gray-400 dark:text-gray-500">Phone: </span>
                <span className="font-medium text-gray-700 dark:text-gray-200">{d.phone}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Workflow progress stepper ─────────────────────────────────────────────────
const STEPS = ['Manifested', 'Discharged', 'Batched', 'In Transit', 'Received'];
const STEP_MAP: Record<string, number> = {
  manifested: 0, discharged: 1, batched: 2, in_transit: 3, received: 4,
};

export function WorkflowProgress({ status }: { status: string }) {
  const current = STEP_MAP[status] ?? -1;
  return (
    <div className="flex items-center gap-0 w-full mb-4">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center flex-1">
            {i > 0 && (
              <div className={`h-0.5 w-full ${i <= current ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
            )}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold mt-1 border-2 ${
              i < current   ? 'bg-brand-500 border-brand-500 text-white' :
              i === current ? 'border-brand-500 text-brand-500 bg-white dark:bg-gray-900' :
              'border-gray-300 dark:border-gray-600 text-gray-400'
            }`}>{i + 1}</div>
            <span className={`mt-1 text-[10px] font-medium text-center leading-tight ${
              i === current ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'
            }`}>{step}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Chassis search input ──────────────────────────────────────────────────────
export function ChassisInput({
  value, onChange, onSearch, loading,
  placeholder = 'Enter last 4 chassis digits...',
}: {
  value: string; onChange: (v: string) => void;
  onSearch: () => void; loading: boolean; placeholder?: string;
}) {
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value.toUpperCase())}
        onKeyDown={e => e.key === 'Enter' && onSearch()}
        placeholder={placeholder}
        maxLength={17}
        className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase"
      />
      <button
        onClick={onSearch}
        disabled={loading || value.trim().length < 4}
        className="px-5 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Searching...' : 'Search'}
      </button>
    </div>
  );
}

// ── Notes textarea ────────────────────────────────────────────────────────────
export function NotesInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        Notes <span className="text-gray-400 font-normal">(optional)</span>
      </label>
      <textarea
        rows={2}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Add any relevant notes..."
        className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
      />
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

// ── Confirm button ────────────────────────────────────────────────────────────
export function ConfirmButton({
  label, onClick, loading, disabled = false, variant = 'primary',
}: {
  label: string; onClick: () => void; loading: boolean;
  disabled?: boolean; variant?: 'primary' | 'success' | 'warning';
}) {
  const cls = {
    primary: 'bg-brand-500 hover:bg-brand-600',
    success: 'bg-green-600 hover:bg-green-700',
    warning: 'bg-orange-500 hover:bg-orange-600',
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`w-full py-3 rounded-lg text-white font-semibold text-sm ${cls} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
    >
      {loading ? 'Processing...' : label}
    </button>
  );
}

// ── Error alert ───────────────────────────────────────────────────────────────
export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

// ── Success banner ────────────────────────────────────────────────────────────
export function SuccessBanner({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div className="rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 p-5 text-center space-y-3">
      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto">
        <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="font-semibold text-green-800 dark:text-green-300">{message}</p>
      <button
        onClick={onReset}
        className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
      >
        Process Next Vehicle
      </button>
    </div>
  );
}
