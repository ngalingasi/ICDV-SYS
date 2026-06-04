import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { incidentApi } from '../../api';
import { useAuth } from '../../store/authStore';
import { toast } from '../../components/tpfcs/Toast';

const SEVERITY_STYLES: Record<string, { label: string; cls: string }> = {
  low:      { label: 'Low',      cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
  medium:   { label: 'Medium',   cls: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' },
  high:     { label: 'High',     cls: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400' },
  critical: { label: 'Critical', cls: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' },
};
const STATUS_STYLES: Record<string, string> = {
  reported:     'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',
  acknowledged: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
  resolved:     'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400',
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const API_BASE = ((import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/api(\/v\d+)?$/, '');

export default function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const { user }       = useAuth();
  const [inc,       setInc]       = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [resNotes,  setResNotes]  = useState('');
  const [showRes,   setShowRes]   = useState(false);
  const [acting,    setActing]    = useState(false);
  const [zoomed,    setZoomed]    = useState<string | null>(null);

  const canManage = ['supervisor', 'admin', 'super_admin', 'system_admin'].includes(user?.role ?? '');

  const load = async () => {
    setLoading(true);
    try {
      const r = await incidentApi.get(Number(incidentId));
      setInc(r.data);
    } catch { setError('Incident not found'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [incidentId]); // eslint-disable-line

  const handleAcknowledge = async () => {
    setActing(true);
    try { await incidentApi.acknowledge(Number(incidentId)); toast.success('Acknowledged'); load(); }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed'); }
    finally { setActing(false); }
  };

  const handleResolve = async () => {
    setActing(true);
    try { await incidentApi.resolve(Number(incidentId), resNotes); toast.success('Resolved'); setShowRes(false); load(); }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed'); }
    finally { setActing(false); }
  };

  if (loading) return <div className="space-y-4">{Array.from({length:5}).map((_,i)=><div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"/>)}</div>;
  if (error || !inc) return <div className="text-red-600 dark:text-red-400">{error || 'Not found'}</div>;

  const sev = SEVERITY_STYLES[inc.severity] ?? SEVERITY_STYLES.medium;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">{inc.incident_type_name}</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${sev.cls}`}>{sev.label}</span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[inc.status]}`}>{inc.status}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Reported {fmtDate(inc.reported_at)} by {inc.reported_by_name}
          </p>
        </div>
        <Link to="/incidents" className="text-sm text-brand-500 hover:text-brand-600">← Back</Link>
      </div>

      {/* Vehicle info */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Vehicle</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-gray-400">Chassis</p><p className="font-mono font-bold text-gray-900 dark:text-white">{inc.chassis_number}</p></div>
          <div><p className="text-xs text-gray-400">Vehicle</p><p className="text-gray-700 dark:text-gray-300">{[inc.brand, inc.model].filter(Boolean).join(' ') || '—'}</p></div>
          <div><p className="text-xs text-gray-400">Manifest</p><p className="text-gray-700 dark:text-gray-300">{inc.manifest_number ?? '—'}</p></div>
          <div><p className="text-xs text-gray-400">ICDV</p><p className="text-gray-700 dark:text-gray-300">{inc.icdv_name ?? '—'}</p></div>
        </div>
      </div>

      {/* Driver */}
      {inc.driver_snapshot && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Driver at time of incident</p>
          <p className="text-sm font-medium text-gray-800 dark:text-white">{inc.driver_snapshot}</p>
        </div>
      )}

      {/* Description */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Description</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{inc.description}</p>
      </div>

      {/* Attachments */}
      {inc.attachments?.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Evidence / Photos ({inc.attachments.length})</p>
          <div className="grid grid-cols-3 gap-3">
            {inc.attachments.map((att: any) => {
              const isImage = att.mime_type?.startsWith('image/');
              const url = `${API_BASE}${att.file_path}`;
              return isImage ? (
                <button key={att.attachment_id} onClick={() => setZoomed(url)}
                  className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-brand-400 transition-colors cursor-zoom-in">
                  <img src={url} alt={att.file_name} className="w-full h-full object-cover" />
                </button>
              ) : (
                <a key={att.attachment_id} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center aspect-square rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-brand-400 transition-colors gap-2">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="text-[10px] text-gray-400 text-center px-1 truncate w-full">{att.file_name}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Photo lightbox */}
      {zoomed && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setZoomed(null)}>
          <div className="relative max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <img src={zoomed} className="w-full rounded-xl shadow-2xl max-h-[80vh] object-contain" />
            <button onClick={() => setZoomed(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-gray-800 flex items-center justify-center shadow-lg hover:bg-gray-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Status Timeline</p>
        <div className="space-y-3">
          {[
            { label: 'Reported',     at: inc.reported_at,     by: inc.reported_by_name,     active: true },
            { label: 'Acknowledged', at: inc.acknowledged_at, by: inc.acknowledged_by_name, active: !!inc.acknowledged_at },
            { label: 'Resolved',     at: inc.resolved_at,     by: inc.resolved_by_name,     active: !!inc.resolved_at, notes: inc.resolution_notes },
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${step.active ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
              <div>
                <p className={`text-sm font-medium ${step.active ? 'text-gray-800 dark:text-white' : 'text-gray-400'}`}>{step.label}</p>
                {step.active && step.at && <p className="text-xs text-gray-500">{fmtDate(step.at)}{step.by ? ` · ${step.by}` : ''}</p>}
                {step.notes && <p className="text-xs text-gray-500 mt-0.5 italic">"{step.notes}"</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {canManage && inc.status !== 'resolved' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Actions</p>
          <div className="flex gap-2">
            {inc.status === 'reported' && (
              <button onClick={handleAcknowledge} disabled={acting}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                Acknowledge
              </button>
            )}
            <button onClick={() => setShowRes(true)}
              className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
              Mark Resolved
            </button>
          </div>

          {showRes && (
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <textarea value={resNotes} onChange={e => setResNotes(e.target.value)} rows={3}
                placeholder="Resolution notes (optional)…"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <div className="flex gap-2">
                <button onClick={() => setShowRes(false)} className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600">Cancel</button>
                <button onClick={handleResolve} disabled={acting}
                  className="flex-[2] py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50">
                  {acting ? 'Saving…' : 'Confirm Resolved'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
