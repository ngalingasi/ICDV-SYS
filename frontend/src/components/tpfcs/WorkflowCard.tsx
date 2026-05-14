import type { ReactNode } from 'react';
import StatusBadge from './StatusBadge';

const RAW_API  = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000/api';
const API_BASE = RAW_API.replace(/\/api(\/v\d+)?$/, '');

const buildPhotoUrl = (photo?: string | null): string | null =>
  photo ? `${API_BASE}${photo}` : null;

// ── Vehicle info card ─────────────────────────────────────────────────────────
export function VehicleCard({ v }: { v: any }) {
  const details = [v.brand, v.model, v.year, v.color].filter(Boolean).join(' - ');
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
      {/* Header: chassis never overflows, badge never gets squeezed */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-wide break-all">
            {v.chassis_number}
          </p>
          {details && (
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {details}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 pt-0.5">
          <StatusBadge status={v.workflow_status || v.status || 'unknown'} />
        </div>
      </div>

      {/* Detail grid: 1 col on xs, 2 cols from sm */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {v.vessel_name      && <Row label="Vessel"      value={v.vessel_name} />}
        {v.manifest_number  && <Row label="Manifest"    value={v.manifest_number} />}
        {v.customer_name    && <Row label="Customer"    value={v.customer_name} />}
        {v.destination      && <Row label="Destination" value={v.destination} />}
        {v.current_location && <Row label="Location"    value={v.current_location.replace(/_/g, ' ')} />}
        {v.batch_number     && <Row label="Batch"       value={v.batch_number} />}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}: </span>
      <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 break-words">
        {value}
      </span>
    </div>
  );
}

// ── Driver info card ──────────────────────────────────────────────────────────
export function DriverCard({ d }: { d: any }) {
  const photoUrl = buildPhotoUrl(d.photo);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Photo scales down on mobile */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex-shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-600 shadow-sm">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={d.full_name}
              className="w-full h-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-brand-100 dark:bg-brand-500/20">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-brand-500 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 dark:text-white truncate text-sm sm:text-base">
              {d.full_name}
            </p>
            <StatusBadge status={d.status} />
          </div>
          <div className="mt-1 space-y-0.5 text-xs sm:text-sm">
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

// ── Workflow progress stepper — responsive ────────────────────────────────────
// Full labels on sm+; abbreviated 3-letter codes on xs so stepper never overflows
const STEPS       = ['Manifested', 'Discharged', 'Batched', 'In Transit', 'Received'];
const STEPS_SHORT = ['MFD',        'DCH',        'BTH',     'TRN',        'RCV'];
const STEP_MAP: Record<string, number> = {
  manifested: 0, discharged: 1, batched: 2, in_transit: 3, received: 4,
};

export function WorkflowProgress({ status }: { status: string }) {
  const current = STEP_MAP[status] ?? -1;
  return (
    <div className="w-full overflow-x-auto pb-1 -mb-1">
      <div className="flex items-start min-w-[260px] w-full mb-1">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-start flex-1">
            {/* Connector line */}
            {i > 0 && (
              <div className="flex-1 flex items-center" style={{ paddingTop: '14px' }}>
                <div className={`h-0.5 w-full ${i <= current ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
              </div>
            )}
            {/* Circle + label */}
            <div className="flex flex-col items-center flex-shrink-0 w-9 sm:w-14">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 ${
                i < current
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : i === current
                    ? 'border-brand-500 text-brand-500 bg-white dark:bg-gray-900'
                    : 'border-gray-300 dark:border-gray-600 text-gray-400 bg-white dark:bg-gray-900'
              }`}>
                {i < current ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : String(i + 1)}
              </div>
              <span className={`mt-1 text-center leading-tight font-medium ${
                i === current ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'
              }`}>
                {/* Full label on sm+, short on xs */}
                <span className="hidden sm:block text-[10px]">{step}</span>
                <span className="block sm:hidden text-[9px]">{STEPS_SHORT[i]}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Chassis search input — button never clips ─────────────────────────────────
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
        autoComplete="off"
        className="flex-1 min-w-0 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase"
      />
      <button
        onClick={onSearch}
        disabled={loading || value.trim().length < 4}
        className="flex-shrink-0 whitespace-nowrap px-4 sm:px-5 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="hidden xs:inline">Searching</span>
          </span>
        ) : 'Search'}
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 sm:p-5 space-y-4">
      <h3 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Confirm button — spinner while loading ────────────────────────────────────
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
      className={`w-full py-3 px-4 rounded-lg text-white font-semibold text-sm ${cls} disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2`}
    >
      {loading ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Processing...
        </>
      ) : label}
    </button>
  );
}

// ── Error alert ───────────────────────────────────────────────────────────────
export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2.5 text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-xs sm:text-sm">{message}</span>
    </div>
  );
}

// ── Success banner ────────────────────────────────────────────────────────────
export function SuccessBanner({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div className="rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 p-5 sm:p-6 text-center space-y-3">
      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto">
        <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="font-semibold text-green-800 dark:text-green-300 text-sm sm:text-base px-2">
        {message}
      </p>
      <button
        onClick={onReset}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Process Next Vehicle
      </button>
    </div>
  );
}
