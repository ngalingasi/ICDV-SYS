import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { workflowApi } from '../../api';
import StatusBadge from '../../components/tpfcs/StatusBadge';
import { useAuth } from '../../store/authStore';
import { toast } from '../../components/tpfcs/Toast';

// ── SVG print icon ────────────────────────────────────────────────────────────
const PrintIcon = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
);

// ── Batch List ────────────────────────────────────────────────────────────────
export function BatchListPage() {
  const [batches,  setBatches]  = useState<any[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [page,     setPage]     = useState(1);
  const limit = 15;

  const load = () => {
    setLoading(true);
    workflowApi.listBatches({ page, limit, status: status || undefined, search: search || undefined })
      .then(r => { setBatches(r.data.results); setTotal(r.data.totalResults); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, status]); // eslint-disable-line
  useEffect(() => { const t = setTimeout(load, 350); return () => clearTimeout(t); }, [search]); // eslint-disable-line

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">Batches</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{total} total batches</p>
        </div>
        <div className="sm:ml-auto flex flex-wrap items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search batch number..."
            className="flex-1 min-w-0 sm:w-52 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">All Statuses</option>
            {['open','full','closed','transferred'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <Link to="/operations/batch"
            className="flex-shrink-0 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors whitespace-nowrap">
            + Batch Vehicle
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {['Batch Number','Vessel','Date','Vehicles','Batch Status','Doc Status','GC Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading
                ? Array.from({length:6}).map((_,i) => (
                    <tr key={i}>{Array.from({length:8}).map((_,j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                : batches.length
                  ? batches.map(b => (
                      <tr key={b.batch_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800 dark:text-white whitespace-nowrap">{b.batch_number}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{b.vessel_name}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{b.batch_date}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="font-semibold text-gray-800 dark:text-white">{b.vehicle_count}</span>
                          <span className="text-gray-400">/{b.max_vehicles}</span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            b.document_status === 'ready'
                              ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                          }`}>
                            {b.document_status === 'ready' ? 'Ready' : 'Not Ready'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            b.gc_status === 'sent'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {b.gc_status === 'sent' ? 'Sent' : 'Not Sent'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/operations/batches/${b.batch_id}`}
                            className="text-brand-500 hover:text-brand-600 text-xs font-medium">View</Link>
                        </td>
                      </tr>
                    ))
                  : <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">No batches found</td></tr>
              }
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            <span>Page {page} of {totalPages} · {total} batches</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                className="px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Prev</button>
              <button onClick={() => setPage(p => p+1)} disabled={page>=totalPages}
                className="px-3 py-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Status pill helper ────────────────────────────────────────────────────────
function Pill({ label, color }: { label: string; color: 'green' | 'yellow' | 'blue' | 'gray' }) {
  const cls = {
    green:  'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
    blue:   'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    gray:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  }[color];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ── Status row — shows current value + inline edit on click ──────────────────
type DocStatusValue = 'not_ready' | 'ready';
type GcStatusValue  = 'not_sent'  | 'sent';
type StatusType     = 'document'  | 'gc';

interface StatusRowProps {
  type:        StatusType;
  currentVal:  string;
  remark:      string | null;
  updatedBy:   string | null;
  updatedAt:   string | null;
  saving:      boolean;
  onSave:      (val: string, remark: string) => void;
  // For GC row only — used to block GC=sent when doc=not_ready
  docStatus?:  string;
}

function StatusRow({ type, currentVal, remark, updatedBy, updatedAt, saving, onSave, docStatus }: StatusRowProps) {
  const [editing,    setEditing]    = useState(false);
  const [newVal,     setNewVal]     = useState(currentVal);
  const [newRemark,  setNewRemark]  = useState('');
  const [validErr,   setValidErr]   = useState('');

  // Sync if parent reloads
  useEffect(() => { setNewVal(currentVal); setValidErr(''); }, [currentVal]);

  const isDoc   = type === 'document';
  const label   = isDoc ? 'Document Status' : 'GC Status';

  const currentColor = isDoc
    ? (currentVal === 'ready'  ? 'green' : 'yellow')
    : (currentVal === 'sent'   ? 'blue'  : 'gray');

  const currentLabel = isDoc
    ? (currentVal === 'ready'  ? 'Ready' : 'Not Ready')
    : (currentVal === 'sent'   ? 'Sent'  : 'Not Sent');

  const handleValChange = (val: string) => {
    setNewVal(val);
    setValidErr('');
    // Live validation: warn as soon as GC=sent is selected while doc=not_ready
    if (!isDoc && val === 'sent' && (docStatus ?? 'not_ready') === 'not_ready') {
      setValidErr('Document status must be "Ready" before marking GC as "Sent".');
    }
  };

  const handleSave = () => {
    // Hard block: GC sent requires document ready
    if (!isDoc && newVal === 'sent' && (docStatus ?? 'not_ready') === 'not_ready') {
      setValidErr('Document status must be "Ready" before marking GC as "Sent".');
      return;
    }
    setValidErr('');
    onSave(newVal, newRemark);
    setEditing(false);
    setNewRemark('');
  };

  const handleCancel = () => {
    setEditing(false);
    setNewVal(currentVal);
    setNewRemark('');
    setValidErr('');
  };

  const saveBlocked = !isDoc && newVal === 'sent' && (docStatus ?? 'not_ready') === 'not_ready';

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 overflow-hidden">
      {/* Current status bar */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
            {label}
          </span>
          <Pill label={currentLabel} color={currentColor as any} />
          {remark && (
            <span className="text-xs text-gray-400 dark:text-gray-500 italic truncate max-w-[180px]" title={remark}>
              "{remark}"
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {updatedBy && updatedAt && (
            <span className="hidden sm:block text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
              by {updatedBy} · {new Date(updatedAt).toLocaleDateString()}
            </span>
          )}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs px-2.5 py-1 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Update
            </button>
          )}
        </div>
      </div>

      {/* Inline edit */}
      {editing && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-200 dark:border-gray-700 space-y-3 bg-white dark:bg-gray-900">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              New {label}
            </label>
            {isDoc ? (
              <select
                value={newVal}
                onChange={e => handleValChange(e.target.value)}
                className="w-full sm:w-56 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="not_ready">Not Ready</option>
                <option value="ready">Ready</option>
              </select>
            ) : (
              <select
                value={newVal}
                onChange={e => handleValChange(e.target.value)}
                className={`w-full sm:w-56 border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 ${
                  saveBlocked
                    ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
                    : 'border-gray-200 dark:border-gray-700 focus:ring-brand-500'
                }`}
              >
                <option value="not_sent">Not Sent</option>
                <option value="sent">Sent</option>
              </select>
            )}
          </div>

          {/* Validation error */}
          {validErr && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-3 py-2.5">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-xs text-red-700 dark:text-red-400 font-medium">{validErr}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Remark <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={newRemark}
              onChange={e => setNewRemark(e.target.value)}
              placeholder="Add a remark..."
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || saveBlocked}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Batch Print Page ──────────────────────────────────────────────────────────
export function BatchPrintPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const printedRef = useRef(false);

  useEffect(() => {
    if (!batchId) return;
    workflowApi.getBatchPrint(Number(batchId))
      .then(r => {
        setData(r.data);
        // Auto-print after render
        setTimeout(() => {
          if (!printedRef.current) {
            printedRef.current = true;
            window.print();
          }
        }, 600);
      })
      .catch(e => setError(e?.response?.data?.message ?? 'Failed to load batch'))
      .finally(() => setLoading(false));
  }, [batchId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>
  );
  if (!data) return null;

  const { batch, vehicles, printed_at } = data;
  const printedDate = new Date(printed_at).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm 12mm; }
          body  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: Arial, sans-serif; background: #fff; color: #000; }
      `}</style>

      {/* Screen-only controls */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold hover:bg-gray-900 shadow-lg transition-colors"
        >
          <PrintIcon /> Print
        </button>
        <button
          onClick={() => window.close()}
          className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 shadow-lg transition-colors"
        >
          Close
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{batch.icdv_name ?? 'ICDV'}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{batch.icdv_code}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Printed: {printedDate}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Batch Number</p>
              <p className="text-xl font-bold font-mono text-gray-900">{batch.batch_number}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Vessel</p>
              <p className="text-base font-semibold text-gray-800">{batch.vessel_name}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Date</p>
              <p className="text-base font-semibold text-gray-800">{batch.batch_date}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Vehicles</p>
              <p className="text-base font-semibold text-gray-800">{batch.vehicle_count} / {batch.max_vehicles}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</p>
              <p className="text-base font-semibold text-gray-800 capitalize">{batch.status}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Doc Status</p>
              <p className={`text-base font-semibold ${batch.document_status === 'ready' ? 'text-green-700' : 'text-yellow-600'}`}>
                {batch.document_status === 'ready' ? 'Ready' : 'Not Ready'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">GC Status</p>
              <p className={`text-base font-semibold ${batch.gc_status === 'sent' ? 'text-blue-700' : 'text-gray-500'}`}>
                {batch.gc_status === 'sent' ? 'Sent' : 'Not Sent'}
              </p>
            </div>
          </div>
        </div>

        {/* Vehicle table */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border border-gray-300">
              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide w-10">#</th>
              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide">Chassis Number</th>
              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide">Workflow</th>
            </tr>
          </thead>
          <tbody>
            {(vehicles || []).map((v: any, idx: number) => (
              <tr key={v.vehicle_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-200 px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                <td className="border border-gray-200 px-3 py-2 font-mono text-xs font-semibold">{v.chassis_number}</td>
                <td className="border border-gray-200 px-3 py-2 text-xs capitalize">{v.workflow_status?.replace(/_/g,' ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 text-xs text-gray-400 text-center">
          {batch.batch_number} · {vehicles?.length ?? 0} vehicles · Printed {printedDate}
        </div>
      </div>
    </>
  );
}

// ── Batch Detail ──────────────────────────────────────────────────────────────
export function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const { user } = useAuth();
  const [batch,    setBatch]    = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [docSaving, setDocSaving] = useState(false);
  const [gcSaving,  setGcSaving]  = useState(false);

  const canUpdateBatchStatus = user && [
    'backoffice_officer', 'operator', 'supervisor', 'admin', 'system_admin', 'super_admin',
  ].includes(user.role);

  const canPrintBatches = user && [
    'backoffice_officer', 'operator', 'supervisor', 'admin', 'system_admin', 'super_admin',
  ].includes(user.role);

  // printDeliverySheet right: backoffice_officer + yard_officer + operator/supervisor/admin+
  const canPrintDeliverySheet = user && [
    'backoffice_officer', 'yard_officer', 'operator', 'supervisor', 'admin', 'system_admin', 'super_admin',
  ].includes(user.role);

  const loadBatch = () => {
    if (!batchId) return;
    workflowApi.getBatch(Number(batchId))
      .then(r => setBatch(r.data))
      .catch(() => setError('Batch not found'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadBatch(); }, [batchId]); // eslint-disable-line

  const handleDocSave = async (val: string, remark: string) => {
    if (!batchId) return;
    setDocSaving(true);
    try {
      await workflowApi.updateBatchStatus(Number(batchId), {
        document_status: val as DocStatusValue,
        document_remark: remark || undefined,
      });
      toast.success('Document status updated');
      loadBatch();
    } catch (err: any) {
      toast.error('Update failed', err?.response?.data?.message ?? 'Could not update document status');
    } finally { setDocSaving(false); }
  };

  const handleGcSave = async (val: string, remark: string) => {
    if (!batchId) return;
    setGcSaving(true);
    try {
      await workflowApi.updateBatchStatus(Number(batchId), {
        gc_status: val as GcStatusValue,
        gc_remark: remark || undefined,
      });
      toast.success('GC status updated');
      loadBatch();
    } catch (err: any) {
      toast.error('Update failed', err?.response?.data?.message ?? 'Could not update GC status');
    } finally { setGcSaving(false); }
  };

  if (loading) return (
    <div className="space-y-4 p-1">
      {Array.from({length:4}).map((_,i) => <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
    </div>
  );
  if (error || !batch) return <div className="py-6 text-red-600 dark:text-red-400">{error || 'Batch not found'}</div>;

  const opReady = batch.operational_status === 'ready';

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-bold font-mono text-gray-800 dark:text-white break-all">
            {batch.batch_number}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {batch.vessel_name} · {batch.batch_date}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {canPrintBatches && (
            <a
              href={`/operations/batches/${batch.batch_id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-700 text-white text-xs font-semibold hover:bg-gray-800 transition-colors whitespace-nowrap dark:bg-gray-600 dark:hover:bg-gray-500"
            >
              <PrintIcon /> Print Batch
            </a>
          )}
          {canPrintDeliverySheet && (
            <a
              href={`/operations/batches/${batch.batch_id}/delivery-sheet`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <PrintIcon /> Print Delivery Sheet
            </a>
          )}
          <StatusBadge status={batch.status} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Vehicles', value: `${batch.vehicle_count} / ${batch.max_vehicles}` },
          { label: 'Status',   value: batch.status },
          { label: 'Date',     value: batch.batch_date },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 sm:p-4 text-center">
            <p className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white break-words">{s.value}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Document & GC Status Panel ─────────────────────────────────────── */}
      {canUpdateBatchStatus && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Document &amp; GC Status
            </h2>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
              opReady
                ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
            }`}>
              Operational: {opReady ? 'Ready' : 'Not Ready'}
            </span>
          </div>
          <div className="p-4 space-y-3">
            <StatusRow
              type="document"
              currentVal={batch.document_status ?? 'not_ready'}
              remark={batch.document_remark ?? null}
              updatedBy={batch.document_updated_by_name ?? null}
              updatedAt={batch.document_updated_at ?? null}
              saving={docSaving}
              onSave={handleDocSave}
            />
            <StatusRow
              type="gc"
              currentVal={batch.gc_status ?? 'not_sent'}
              remark={batch.gc_remark ?? null}
              updatedBy={batch.gc_updated_by_name ?? null}
              updatedAt={batch.gc_updated_at ?? null}
              saving={gcSaving}
              onSave={handleGcSave}
              docStatus={batch.document_status ?? 'not_ready'}
            />
          </div>
        </div>
      )}

      {/* Vehicle list */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Vehicles in this batch ({batch.vehicles?.length || 0})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[360px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <tr>
                {['SN','Chassis #','Status','Location'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(batch.vehicles || []).map((v: any, idx: number) => (
                <tr key={v.vehicle_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-gray-400 dark:text-gray-500 w-10">{idx + 1}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-800 dark:text-white whitespace-nowrap">{v.chassis_number}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={v.workflow_status} /></td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{v.current_location?.replace(/_/g,' ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


