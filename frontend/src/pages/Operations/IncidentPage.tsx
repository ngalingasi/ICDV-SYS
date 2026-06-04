import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router';
import { incidentApi } from '../../api';
import { useAuth } from '../../store/authStore';
import { toast } from '../../components/tpfcs/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { label: string; cls: string; dot: string }> = {
  low:      { label: 'Low',      cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',              dot: 'bg-gray-400' },
  medium:   { label: 'Medium',   cls: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',    dot: 'bg-yellow-500' },
  high:     { label: 'High',     cls: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400',    dot: 'bg-orange-500' },
  critical: { label: 'Critical', cls: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400',                dot: 'bg-red-500' },
};

const STATUS_STYLES: Record<string, string> = {
  reported:     'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',
  acknowledged: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
  resolved:     'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400',
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const API_BASE = ((import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/api(\/v\d+)?$/, '');

// ─── Report Form ──────────────────────────────────────────────────────────────

function ReportForm({ onReported }: { onReported: () => void }) {
  const [chassis,     setChassis]     = useState('');
  const [vehicle,     setVehicle]     = useState<any>(null);
  const [types,       setTypes]       = useState<any[]>([]);
  const [typeId,      setTypeId]      = useState('');
  const [severity,    setSeverity]    = useState('medium');
  const [description, setDescription] = useState('');
  const [files,       setFiles]       = useState<File[]>([]);
  const [step,        setStep]        = useState<'search' | 'form' | 'done'>('search');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    incidentApi.types().then(r => setTypes(r.data));
  }, []);

  const handleSearch = async () => {
    if (chassis.trim().length < 3) return;
    setLoading(true); setError('');
    try {
      const r = await incidentApi.lookup(chassis.trim());
      setVehicle(r.data);
      setStep('form');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Vehicle not found');
    } finally { setLoading(false); }
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    setFiles(prev => {
      const merged = [...prev, ...picked];
      // deduplicate by name+size, cap at 3
      const seen = new Set<string>();
      return merged.filter(f => {
        const key = `${f.name}-${f.size}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 3);
    });
    // reset input so same file can be re-picked after removal
    e.target.value = '';
  };

  const removeFile = (i: number) => setFiles(f => f.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!typeId)        { setError('Choose an incident type'); return; }
    if (!description.trim()) { setError('Description is required'); return; }
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('vehicle_id',   String(vehicle.vehicle_id));
      fd.append('type_id',      typeId);
      fd.append('severity',     severity);
      fd.append('description',  description.trim());
      if (vehicle.driver_id) {
        fd.append('driver_id',       String(vehicle.driver_id));
        fd.append('driver_snapshot', vehicle.driver_name);
      }
      files.forEach(f => fd.append('attachments', f));
      await incidentApi.create(fd);
      toast.success('Incident reported successfully');
      setStep('done');
      onReported();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to submit incident');
    } finally { setLoading(false); }
  };

  const reset = () => {
    setChassis(''); setVehicle(null); setTypeId(''); setSeverity('medium');
    setDescription(''); setFiles([]); setError(''); setStep('search');
  };

  if (step === 'done') {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/5 p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-green-800 dark:text-green-300">Incident reported</p>
        <p className="text-xs text-green-600 dark:text-green-400">A supervisor will review and acknowledge it shortly.</p>
        <button onClick={reset} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
          Report another incident
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step 1: chassis search */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Step 1 — Vehicle
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={chassis}
            onChange={e => setChassis(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Enter chassis number…"
            disabled={step === 'form'}
            className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {step === 'form' ? (
            <button onClick={reset} className="px-3 py-2.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Change
            </button>
          ) : (
            <button onClick={handleSearch} disabled={loading || chassis.trim().length < 3}
              className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
              {loading && step === 'search' ? 'Looking…' : 'Find'}
            </button>
          )}
        </div>
        {error && step === 'search' && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Vehicle card */}
        {vehicle && (
          <div className="rounded-lg border border-brand-100 dark:border-brand-500/20 bg-brand-50 dark:bg-brand-500/5 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono font-bold text-sm text-gray-900 dark:text-white">{vehicle.chassis_number}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ')} · {vehicle.manifest_number}
                </p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 capitalize">
                {vehicle.workflow_status?.replace(/_/g, ' ')}
              </span>
            </div>
            {vehicle.driver_name && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Driver: <strong className="text-gray-700 dark:text-gray-300">{vehicle.driver_name}</strong> · {vehicle.driver_id_card}</span>
                <span className="text-green-600 dark:text-green-400 text-[10px] font-medium">auto-assigned</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: incident details */}
      {step === 'form' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Step 2 — Incident Details
          </p>

          {/* Type */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Incident type *</label>
            <div className="flex flex-wrap gap-2">
              {types.map(t => (
                <button key={t.type_id} onClick={() => setTypeId(String(t.type_id))}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors
                    ${typeId === String(t.type_id)
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-brand-300'}`}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Severity</label>
            <div className="flex gap-2">
              {Object.entries(SEVERITY_STYLES).map(([key, s]) => (
                <button key={key} onClick={() => setSeverity(key)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors capitalize
                    ${severity === key ? `${s.cls} border-current` : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Description *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe what happened — location, time, circumstances, damage extent…"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
              Evidence / Photos <span className="font-normal">(up to 3 files)</span>
            </label>
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleFilePick} />
            {files.length === 0 ? (
              <button onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-6 text-sm text-gray-400 hover:border-brand-300 hover:text-brand-500 transition-colors flex flex-col items-center gap-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Click to attach photos or files
              </button>
            ) : (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="flex-1 text-xs text-gray-600 dark:text-gray-400 truncate">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {files.length < 3 && (
                  <button onClick={() => fileRef.current?.click()} className="text-xs text-brand-500 hover:text-brand-600">+ Add more</button>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={reset} className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-[2] py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
              {loading ? 'Submitting…' : 'Submit Incident Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Incident List ────────────────────────────────────────────────────────────

function IncidentList({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filters,   setFilters]   = useState({ status: '', severity: '' });
  const [resolveId, setResolveId] = useState<number | null>(null);
  const [resNotes,  setResNotes]  = useState('');
  const [acting,    setActing]    = useState(false);

  const canManage = ['supervisor', 'admin', 'super_admin', 'system_admin'].includes(user?.role ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await incidentApi.list({ status: filters.status || undefined, severity: filters.severity || undefined, limit: 50 });
      setIncidents(r.data.results ?? []);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleAcknowledge = async (id: number) => {
    setActing(true);
    try { await incidentApi.acknowledge(id); toast.success('Incident acknowledged'); load(); }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed'); }
    finally { setActing(false); }
  };

  const handleResolve = async () => {
    if (!resolveId) return;
    setActing(true);
    try { await incidentApi.resolve(resolveId, resNotes); toast.success('Incident resolved'); setResolveId(null); setResNotes(''); load(); }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed'); }
    finally { setActing(false); }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All Status</option>
          <option value="reported">Reported</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
        <select value={filters.severity} onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}
          className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All Severity</option>
          {Object.entries(SEVERITY_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Resolve modal */}
      {resolveId && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 w-full max-w-sm mx-4 space-y-4">
            <p className="text-sm font-semibold text-gray-800 dark:text-white">Resolve Incident</p>
            <textarea value={resNotes} onChange={e => setResNotes(e.target.value)} rows={3}
              placeholder="Resolution notes (optional)…"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <div className="flex gap-2">
              <button onClick={() => { setResolveId(null); setResNotes(''); }}
                className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600">Cancel</button>
              <button onClick={handleResolve} disabled={acting}
                className="flex-[2] py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50">
                {acting ? 'Saving…' : 'Mark Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({length:4}).map((_,i) => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : incidents.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 py-12 text-center text-sm text-gray-400">
          No incidents recorded
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map(inc => {
            const sev = SEVERITY_STYLES[inc.severity] ?? SEVERITY_STYLES.medium;
            return (
              <div key={inc.incident_id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                <div className="px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${sev.dot}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/incidents/${inc.incident_id}`}
                          className="text-sm font-semibold text-gray-800 dark:text-white hover:text-brand-600">
                          {inc.incident_type_name}
                        </Link>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sev.cls}`}>{sev.label}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[inc.status]}`}>{inc.status}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{inc.chassis_number}</span>
                        {inc.icdv_name ? ` · ${inc.icdv_name}` : ''}
                        {' · '}{fmtDate(inc.reported_at)}
                        {' · by '}{inc.reported_by_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{inc.description}</p>
                      {/* Show full attachments by linking to detail page */}
                      <Link to={`/incidents/${inc.incident_id}`} className="text-xs text-brand-500 hover:text-brand-600 mt-0.5 block">
                        View details →
                      </Link>
                      {inc.attachment_count > 0 && (
                        <div className="flex items-center gap-2 mt-1.5">
                          {inc.first_image_path && (
                            <Link to={`/incidents/${inc.incident_id}`}>
                              <img
                                src={`${API_BASE}${inc.first_image_path}`}
                                alt="evidence"
                                className="w-10 h-10 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
                              />
                            </Link>
                          )}
                          <span className="text-[10px] text-gray-400">
                            {inc.attachment_count} evidence file{inc.attachment_count > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {canManage && inc.status !== 'resolved' && (
                    <div className="flex gap-2 flex-shrink-0">
                      {inc.status === 'reported' && (
                        <button onClick={() => handleAcknowledge(inc.incident_id)} disabled={acting}
                          className="px-3 py-1.5 text-xs rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-50 transition-colors">
                          Acknowledge
                        </button>
                      )}
                      <button onClick={() => { setResolveId(inc.incident_id); setResNotes(''); }}
                        className="px-3 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors">
                        Resolve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IncidentPage() {
  const [tab, setTab]         = useState<'report' | 'list'>('report');
  const [refreshKey, setKey]  = useState(0);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Incidents</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Report and track vehicle incidents during operations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {([['report', 'Report Incident'], ['list', 'Incident Log']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${tab === key ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'report' && (
        <ReportForm onReported={() => { setKey(k => k + 1); }} />
      )}
      {tab === 'list' && (
        <IncidentList refreshKey={refreshKey} />
      )}
    </div>
  );
}
