import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { inspectionApi, storesApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

const RESP_STYLE = (v: string) => {
  const l = v?.toLowerCase();
  if (l === 'pass' || l === 'yes') return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400';
  if (l === 'fail' || l === 'no')  return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
};

export default function InspectionApprove() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data,    setData]    = useState<any>(null);
  const [stores,  setStores]  = useState<any[]>([]);
  const [storeId, setStoreId] = useState('');
  const [note,    setNote]    = useState('');
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState(false);
  const [preview, setPreview] = useState<{url:string;name:string;type:string}|null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      inspectionApi.getRequest(Number(id)),
      storesApi.list({ limit: 100, status: 'active' }),
    ]).then(([irRes, stRes]) => {
      setData(irRes.data);
      setStores(stRes.data.results);
    }).catch(() => toast.error('Failed', 'Could not load data'))
      .finally(() => setLoading(false));
  }, [id]);

  const base = (import.meta.env.VITE_API_URL ?? '').replace('/api','');

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

  const handleApprove = async () => {
    if (!note.trim()) { toast.error('Required', 'Approval note is required'); return; }
    if (data.inspection_type === 'GRI' && !storeId) { toast.error('Required', 'Select a receiving store for GRI inspection'); return; }
    setActing(true);
    try {
      await inspectionApi.approveInspection(Number(id), { approval_note: note, receiving_store_id: Number(storeId) });
      toast.success('Inspection approved', 'Stock has been added to the selected store');
      navigate(`/inspection/requests/${id}`);
    } catch (err: any) {
      toast.error('Failed', err?.response?.data?.message);
    } finally { setActing(false); }
  };

  const handleReject = async () => {
    if (!note.trim()) { toast.error('Required', 'Rejection reason is required'); return; }
    setActing(true);
    try {
      await inspectionApi.rejectApproval(Number(id), { approval_note: note });
      toast.success('Inspection rejected');
      navigate(`/inspection/requests/${id}`);
    } catch (err: any) {
      toast.error('Failed', err?.response?.data?.message);
    } finally { setActing(false); }
  };

  if (loading) return <div className="animate-pulse max-w-4xl mx-auto space-y-4">{[1,2,3].map(i=><div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl"/>)}</div>;
  if (!data)   return <p className="text-center py-20 text-gray-400">Inspection not found</p>;
  if (data.status !== 'pending_approval') return (
    <div className="max-w-4xl mx-auto text-center py-20">
      <p className="text-gray-400 mb-4">This inspection is not pending approval (status: {data.status})</p>
      <Link to={`/inspection/requests/${id}`} className="text-brand-500 hover:underline">← Back to request</Link>
    </div>
  );

  // Get responses keyed by checklist_item_id
  const respMap: Record<number, any> = {};
  (data.responses ?? []).forEach((r: any) => { respMap[r.checklist_item_id] = r; });

  const passCount = Object.values(respMap).filter((r: any) => ['pass','yes'].includes(r.response_value?.toLowerCase())).length;
  const failCount = Object.values(respMap).filter((r: any) => ['fail','no'].includes(r.response_value?.toLowerCase())).length;

  const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400";

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/inspection/requests" className="hover:text-brand-500">Inspection Requests</Link>
          <span>/</span>
          <Link to={`/inspection/requests/${id}`} className="hover:text-brand-500 font-mono">{data.request_number}</Link>
          <span>/</span>
          <span className="text-gray-700 dark:text-gray-300">Approval</span>
        </div>
        <BackButton to={`/inspection/requests/${id}`} />
      </div>

      {/* Inspection summary */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-lg font-bold font-mono text-gray-800 dark:text-white">{data.request_number}</h1>
          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400">Pending Approval</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
          {[
            { label: 'Order',       value: data.order_number },
            { label: 'Supplier',    value: data.supplier_name },
            { label: 'Project',     value: data.project_name ?? '—' },
            { label: 'Date',        value: fmtDate(data.inspection_date) },
            { label: 'Location',    value: data.location_name },
            { label: 'Submitted',   value: fmtDate(data.submitted_at) },
            { label: 'Recommendation', value: data.recommendation ?? '—' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
              <p className={`font-medium text-sm ${
                item.label === 'Recommendation'
                  ? data.recommendation === 'approved' ? 'text-green-600 dark:text-green-400'
                  : data.recommendation === 'rejected' ? 'text-red-500 dark:text-red-400'
                  : 'text-orange-500 dark:text-orange-400'
                  : 'text-gray-800 dark:text-white'
              }`}>{item.value}</p>
            </div>
          ))}
        </div>
        {/* Result summary badges */}
        <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400">{passCount} Pass / Yes</span>
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">{failCount} Fail / No</span>
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{Object.keys(respMap).length} Total Responses</span>
        </div>
        {data.general_remarks && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-400 mb-1">Inspector Remarks</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{data.general_remarks}</p>
          </div>
        )}
      </div>

      {/* Checklist responses review */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Checklist Responses — {data.checklist_name}</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.checklist_items?.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400">No checklist items</p>
          ) : data.checklist_items?.map((item: any, idx: number) => {
            const resp = respMap[item.checklist_item_id];
            return (
              <div key={item.checklist_item_id} className="px-5 py-3 flex items-start gap-3">
                <span className="text-xs text-gray-400 w-6 flex-shrink-0 mt-0.5">{idx+1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.item_title}</p>
                  {resp?.response_comment && <p className="text-xs text-gray-400 mt-0.5">{resp.response_comment}</p>}
                  {resp?.evidence_path && (
                    <button
                      onClick={() => {
                        const fname = resp.evidence_path.split('/').pop();
                        const isImg = /\.(jpg|jpeg|png|gif)$/i.test(fname);
                        setPreview({ url: `${base}/uploads/${fname}`, name: resp.evidence_name ?? fname, type: isImg ? 'image' : 'pdf' });
                      }}
                      className="mt-1 flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-600">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      View Evidence
                    </button>
                  )}
                </div>
                {resp ? (
                  <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${RESP_STYLE(resp.response_value)}`}>
                    {resp.response_value || 'Answered'}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 flex-shrink-0">
                    {item.is_required ? '⚠ No answer' : 'Skipped'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Approval action */}
      <div className="rounded-xl border border-brand-200 dark:border-brand-500/30 bg-white dark:bg-gray-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Approval Decision</h2>

        {/* Store selection — GRI only */}
        {data.inspection_type === 'GRI' ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Receiving Store <span className="text-red-500">*</span>
              <span className="ml-1 font-normal text-gray-400">(inspected goods will be added to this store's inventory)</span>
            </label>
            <select value={storeId} onChange={e => setStoreId(e.target.value)} className={inputCls}>
              <option value="">— Select store —</option>
              {stores.map(s => (
                <option key={s.store_id} value={s.store_id}>
                  {s.store_name}{s.region_name ? ` — ${s.region_name}` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          /* FA — no store needed */
          <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-3 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Factory Assessment — No inventory movement</p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">FA inspections evaluate supplier/factory quality only. No goods are received into stock.</p>
            </div>
          </div>
        )}

        {/* Approval note */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Approval Note <span className="text-red-500">*</span>
          </label>
          <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Add approval notes, conditions, or rejection reason..."
            className={inputCls + ' resize-none'} />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button onClick={handleReject} disabled={acting || !note.trim()}
            className="px-5 py-2.5 text-sm font-medium border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40">
            Reject
          </button>
          <button onClick={handleApprove} disabled={acting || !note.trim() || (data?.inspection_type === 'GRI' && !storeId)}
            className="px-6 py-2.5 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-40">
            {acting ? 'Processing...' : data.inspection_type === 'GRI' ? 'Approve & Add to Stock' : 'Approve Inspection'}
          </button>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="absolute inset-0 bg-black/80" />
          <div className="relative max-w-3xl w-full bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium truncate">{preview.name}</p>
              <div className="flex gap-2">
                <a href={preview.url} download={preview.name} className="px-3 py-1 text-xs bg-brand-500 text-white rounded-lg">Download</a>
                <button onClick={() => setPreview(null)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">✕</button>
              </div>
            </div>
            <div className="overflow-auto flex-1">
              {preview.type === 'image'
                ? <img src={preview.url} alt={preview.name} className="w-full h-auto" />
                : <object data={preview.url} type="application/pdf" className="w-full h-[70vh]"><p className="p-6 text-sm text-gray-400">Cannot preview. <a href={preview.url} target="_blank" rel="noreferrer" className="text-brand-500">Open in new tab</a></p></object>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
