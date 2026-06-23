/**
 * LiveTransferMonitoringPage.tsx
 *
 * Real-time view of all vehicles currently in transit (workflow_status = 'in_transit').
 * Auto-refreshes every 60 seconds.
 *
 * Routes:
 *   /operations/live-transfers            — all in-transit vehicles
 *   /manifests/:id/live-transfers         — scoped to a specific manifest
 *
 * Fullscreen mode:
 *   Uses the browser Fullscreen API on document.documentElement.
 *   Adds data-fs="1" to <html> which the global CSS uses to hide the
 *   sidebar and header — giving a clean control-room style view.
 *   Exit via the button or pressing Escape.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { workflowApi } from '../../api';
import BackButton from '../../components/tpfcs/BackButton';
import ManifestSelector from '../../components/tpfcs/ManifestSelector';
import type { Manifest } from '../../types';

const RAW_API     = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000/api';
const SERVER_BASE = RAW_API.replace(/\/api(\/v\d+)?$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveVehicle {
  vehicle_id:         number;
  chassis_number:     string;
  brand?:             string;
  model?:             string;
  color?:             string;
  destination?:       string;
  delivery_location?: string;
  manifest_number?:   string;
  manifest_id?:       number;
  vessel_name?:       string;
  icdv_name?:         string;
  driver_name?:       string;
  driver_phone?:      string;
  driver_license?:    string;
  driver_id_card?:    string;
  driver_photo?:      string | null;
  transfer_id:        number;
  transferred_at:     string;
  elapsed_minutes:    number;
  normal_minutes:     number;
  max_minutes:        number;
  delay_status:       'on_time' | 'warning' | 'delayed';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const fmtElapsed = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const STATUS_CONFIG = {
  on_time: {
    label:   'On Time',
    card:    'border-green-200 dark:border-green-500/30 bg-green-50/50 dark:bg-green-500/5',
    badge:   'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
    dot:     'bg-green-500',
    elapsed: 'text-green-600 dark:text-green-400',
  },
  warning: {
    label:   'Approaching Delay',
    card:    'border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5',
    badge:   'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
    dot:     'bg-amber-500',
    elapsed: 'text-amber-600 dark:text-amber-400',
  },
  delayed: {
    label:   'Delayed',
    card:    'border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5',
    badge:   'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
    dot:     'bg-red-500 animate-pulse',
    elapsed: 'text-red-600 dark:text-red-400 font-bold',
  },
};

// ─── Vehicle Card ─────────────────────────────────────────────────────────────

function VehicleCard({ v, isFS }: { v: LiveVehicle; isFS: boolean }) {
  const cfg = STATUS_CONFIG[v.delay_status];
  const [showDriver, setShowDriver] = useState(false);
  const [zoomed,     setZoomed]     = useState(false);
  const photoUrl = v.driver_photo ? `${SERVER_BASE}${v.driver_photo}` : null;

  return (
    <div className={`relative rounded-xl border p-4 space-y-3 transition-all ${cfg.card}`}>
      <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${cfg.dot}`} />

      <div>
        <p className={`font-bold font-mono tracking-wide ${isFS ? 'text-base' : 'text-sm'} text-gray-800 dark:text-white`}>
          {v.chassis_number}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {[v.brand, v.model, v.color].filter(Boolean).join(' · ') || 'Vehicle'}
        </p>
      </div>

      {v.manifest_number && (
        <div className="flex items-center gap-1.5">
          <ManifestIcon />
          <Link to={`/manifests/${v.manifest_id}`}
            className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
            {v.manifest_number}
          </Link>
        </div>
      )}

      {v.icdv_name && (
        <div className="flex items-center gap-1.5">
          <LocationIcon />
          <span className="text-xs text-gray-600 dark:text-gray-400">{v.icdv_name}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <ClockIcon />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Gate Out: {v.transferred_at ? fmtTime(v.transferred_at) : '—'}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Transit Time</p>
          <p className={`font-bold ${isFS ? 'text-2xl' : 'text-lg'} ${cfg.elapsed}`}>
            {fmtElapsed(v.elapsed_minutes)}
          </p>
          <p className="text-[10px] text-gray-400">
            Normal: {v.normal_minutes}m · Max: {v.max_minutes}m
          </p>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>

      <button
        onClick={() => setShowDriver(s => !s)}
        className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline-offset-2 hover:underline mt-1"
      >
        {showDriver ? 'Hide driver' : 'Show driver'}
      </button>

      {showDriver && (
        <div className="rounded-lg bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 p-3 mt-1 space-y-2">

          {/* Photo + name row */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => photoUrl && setZoomed(true)}
              className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border bg-gray-100 dark:bg-gray-800
                ${photoUrl ? 'border-brand-200 dark:border-brand-500/30 cursor-zoom-in hover:border-brand-400 transition-colors' : 'border-gray-200 dark:border-gray-700 cursor-default'}`}
              title={photoUrl ? 'Click to zoom' : undefined}
            >
              {photoUrl ? (
                <img src={photoUrl} alt={v.driver_name ?? ''} className="w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </button>
            <p className="text-xs font-semibold text-gray-800 dark:text-white leading-tight">{v.driver_name ?? '—'}</p>
          </div>

          {v.driver_license && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wide w-14 flex-shrink-0">Licence</span>
              <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{v.driver_license}</span>
            </div>
          )}

          {v.driver_id_card && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wide w-14 flex-shrink-0">ID Card</span>
              <button
                onClick={() => navigator.clipboard.writeText(v.driver_id_card!)}
                title="Click to copy"
                className="text-xs font-mono text-brand-600 dark:text-brand-400 hover:underline cursor-copy"
              >
                {v.driver_id_card}
              </button>
              <CopyIcon />
            </div>
          )}

          {v.driver_phone && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wide w-14 flex-shrink-0">Phone</span>
              <a href={`tel:${v.driver_phone}`}
                className="text-xs text-green-600 dark:text-green-400 hover:underline font-medium flex items-center gap-1">
                <PhoneIcon />
                {v.driver_phone}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Photo lightbox */}
      {zoomed && photoUrl && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setZoomed(false)}
        >
          <div className="relative max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <img src={photoUrl} alt={v.driver_name ?? ''}
              className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]" />
            <div className="mt-3 text-center">
              <p className="text-white font-semibold text-sm">{v.driver_name}</p>
              <p className="text-white/60 text-xs mt-0.5">{v.driver_id_card}</p>
            </div>
            <button
              onClick={() => setZoomed(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-gray-800 flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fullscreen hook ──────────────────────────────────────────────────────────

function useFullscreen() {
  const [isFS, setIsFS] = useState(false);

  // Sync state when user presses Escape (browser exits FS without our button)
  useEffect(() => {
    const handler = () => {
      const active = !!document.fullscreenElement;
      setIsFS(active);
      // Drive the CSS hide/show of sidebar + header
      if (active) {
        document.documentElement.setAttribute('data-fs', '1');
      } else {
        document.documentElement.removeAttribute('data-fs');
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      // Always clean up when component unmounts (e.g. navigation away)
      document.documentElement.removeAttribute('data-fs');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const enter = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Browser denied fullscreen (e.g. in iframe) — simulate with CSS only
      document.documentElement.setAttribute('data-fs', '1');
      setIsFS(true);
    }
  };

  const exit = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch { /* ignore */ }
    document.documentElement.removeAttribute('data-fs');
    setIsFS(false);
  };

  return { isFS, enter, exit };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LiveTransferMonitoringPage() {
  const { id: manifestId }            = useParams<{ id?: string }>();
  const [vehicles,     setVehicles]   = useState<LiveVehicle[]>([]);
  const [loading,      setLoading]    = useState(true);
  const [lastUpdate,   setLastUpdate] = useState<Date | null>(null);
  const [search,       setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'on_time' | 'warning' | 'delayed'>('');
  // Manifest filter — pre-populated when opened from /manifests/:id/live-transfers
  const [selectedManifest, setSelectedManifest] = useState<Manifest | null>(null);
  const intervalRef                   = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isFS, enter, exit }         = useFullscreen();

  // Effective manifest filter: URL param takes priority over dropdown selection
  const effectiveManifestId = manifestId
    ? Number(manifestId)
    : selectedManifest?.manifest_id ?? null;

  const load = useCallback(async () => {
    try {
      const r = await workflowApi.getLiveTransfers();
      let data: LiveVehicle[] = r.data;
      if (effectiveManifestId) data = data.filter(v => v.manifest_id === effectiveManifestId);
      setVehicles(data);
      setLastUpdate(new Date());
    } catch { /* silent — page shows stale data */ }
    finally { setLoading(false); }
  }, [effectiveManifestId]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      v.chassis_number.toLowerCase().includes(q) ||
      (v.manifest_number ?? '').toLowerCase().includes(q);
    const matchStatus = !statusFilter || v.delay_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const delayed = filtered.filter(v => v.delay_status === 'delayed').length;
  const warning = filtered.filter(v => v.delay_status === 'warning').length;
  const onTime  = filtered.filter(v => v.delay_status === 'on_time').length;

  // In fullscreen the page fills the entire screen with its own mini topbar
  const wrapCls = isFS
    ? 'fixed inset-0 z-[200] bg-gray-100 dark:bg-gray-950 overflow-y-auto flex flex-col'
    : 'p-4 sm:p-6 space-y-5';

  const innerCls = isFS ? 'flex-1 p-4 sm:p-6 space-y-5' : '';

  return (
    <div className={wrapCls}>

      {/* ── Fullscreen top-bar (only visible in FS mode) ── */}
      {isFS && (
        <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-bold text-gray-800 dark:text-white tracking-wide uppercase">
              Live Transfer Monitoring
            </span>
            {manifestId && (
              <span className="text-xs text-gray-400 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded-full">
                Manifest scoped
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {lastUpdate && `Updated ${lastUpdate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
            </span>
            <button onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <RefreshIcon /> Refresh
            </button>
            <button onClick={exit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-gray-700 text-white text-xs font-medium hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors">
              <ExitFSIcon /> Exit Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className={innerCls || 'space-y-5'}>

        {/* Header — only in normal mode */}
        {!isFS && (
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <BackButton />
              <div>
                <h1 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Live Transfer Monitoring
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {manifestId
                    ? 'Manifest-scoped · '
                    : selectedManifest
                      ? `${selectedManifest.manifest_number} · `
                      : ''}
                  {loading ? 'Loading…' : `${vehicles.length} vehicles in transit`}
                  {lastUpdate && ` · Updated ${lastUpdate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <RefreshIcon /> Refresh
              </button>
              <button onClick={enter}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                title="Fullscreen — hides sidebar and header for control room view">
                <FullscreenIcon /> Fullscreen
              </button>
            </div>
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'In Transit',  value: vehicles.length, color: 'text-gray-800 dark:text-white',           bg: 'bg-white dark:bg-gray-900' },
            { label: 'On Time',     value: onTime,          color: 'text-green-600 dark:text-green-400',       bg: 'bg-green-50/50 dark:bg-green-500/5' },
            { label: 'Approaching', value: warning,         color: 'text-amber-600 dark:text-amber-400',       bg: 'bg-amber-50/50 dark:bg-amber-500/5' },
            { label: 'Delayed',     value: delayed,         color: 'text-red-600 dark:text-red-400 font-bold', bg: 'bg-red-50/50 dark:bg-red-500/5' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border border-gray-200 dark:border-gray-700 ${s.bg} p-4 text-center`}>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Manifest filter — only show when NOT opened via /manifests/:id/live-transfers */}
          {!manifestId && (
            <div className="w-64">
              <ManifestSelector
                value={selectedManifest}
                onChange={setSelectedManifest}
                placeholder="All manifests…"
                allLabel="All manifests (no filter)"
                statusFilter="active"
              />
            </div>
          )}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search chassis or manifest…"
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 w-56"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="on_time">On Time</option>
            <option value="warning">Approaching Delay</option>
            <option value="delayed">Delayed</option>
          </select>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-12 text-center">
            <p className="text-sm text-gray-400">
              {vehicles.length === 0 ? 'No vehicles currently in transit.' : 'No vehicles match your filters.'}
            </p>
          </div>
        ) : (
          <div className={`grid gap-4 grid-cols-1 sm:grid-cols-2 ${isFS ? 'lg:grid-cols-4 xl:grid-cols-5' : 'lg:grid-cols-3 xl:grid-cols-4'}`}>
            {filtered.map(v => <VehicleCard key={v.vehicle_id} v={v} isFS={isFS} />)}
          </div>
        )}

        <p className="text-xs text-center text-gray-400 dark:text-gray-600">
          Auto-refreshes every 60 seconds{isFS ? ' · Press Esc to exit fullscreen' : ''}
        </p>

      </div>
    </div>
  );
}

// ── Micro icons ───────────────────────────────────────────────────────────────
const ManifestIcon   = () => <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>;
const LocationIcon   = () => <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>;
const ClockIcon      = () => <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>;
const RefreshIcon    = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>;
const FullscreenIcon = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2"/></svg>;
const ExitFSIcon     = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>;
const PhoneIcon      = () => <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>;
const CopyIcon       = () => <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>;
