import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { inspectionApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';
import { useAuth } from '../../store/authStore';
import Modal from '../../components/tpfcs/Modal';

const STATUS_STYLES: Record<string,string> = {
  draft:'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  pending_acceptance:'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  scheduled:'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  active:'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  completed:'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  cancelled:'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};
const ASSIGN_STYLES: Record<string,string> = {
  pending:'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  accepted:'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  rejected:'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  cancelled:'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';

function RejectModal({ assignmentId, onDone, onClose }: { assignmentId: number; onDone: ()=>void; onClose: ()=>void }) {
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) return;
    setSaving(true);
    try { await inspectionApi.rejectAssignment(assignmentId, remarks); toast.success('Assignment rejected'); onDone(); onClose(); }
    catch (err: any) { toast.error('Failed', err?.response?.data?.message); }
    finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Reason for rejection <span className="text-red-500">*</span></label>
        <textarea rows={3} value={remarks} onChange={e => setRemarks(e.target.value)} required
          placeholder="Please provide a reason..."
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400 resize-none" />
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
        <button type="submit" disabled={saving || !remarks.trim()} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
          {saving ? 'Submitting...' : 'Reject'}
        </button>
      </div>
    </form>
  );
}

export default function InspectionRequestDetail() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = ['admin','manager'].includes(user?.role ?? '');

  const [ir,         setIr]         = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [rejectId,   setRejectId]   = useState<number | null>(null);
  const [evidenceMap,setEvidenceMap]= useState<Record<number, any[]>>({});
  const [uploading,  setUploading]  = useState<number | null>(null);
  const [preview,    setPreview]    = useState<{url:string;name:string;type:string}|null>(null);

  const load = () => inspectionApi.getRequest(Number(id))
    .then(async r => {
      setIr(r.data);
      // Load evidence for all assignments
      const ev: Record<number, any[]> = {};
      for (const a of (r.data.assignments ?? [])) {
        try {
          const eRes = await inspectionApi.getEvidence(a.inspection_assignment_id);
          ev[a.inspection_assignment_id] = eRes.data;
        } catch { ev[a.inspection_assignment_id] = []; }
      }
      setEvidenceMap(ev);
    }).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { if (id) load(); }, [id]);

  const handleEvidenceUpload = async (assignmentId: number, file: File) => {
    setUploading(assignmentId);
    try {
      const fd = new FormData(); fd.append('evidence', file);
      await inspectionApi.uploadEvidence(assignmentId, fd);
      toast.success('Evidence uploaded');
      load();
    } catch (err: any) { toast.error('Upload failed', err?.response?.data?.message); }
    finally { setUploading(null); }
  };

  const handleAccept = async (assignmentId: number) => {
    try { await inspectionApi.acceptAssignment(assignmentId); toast.success('Assignment accepted'); load(); }
    catch (err: any) { toast.error('Failed', err?.response?.data?.message); }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this inspection request?')) return;
    try { await inspectionApi.cancelRequest(Number(id)); toast.success('Cancelled'); load(); }
    catch (err: any) { toast.error('Failed', err?.response?.data?.message); }
  };

  if (loading) return <div className="animate-pulse space-y-4 max-w-4xl mx-auto">{[1,2,3].map(i => <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}</div>;
  if (!ir) return <p className="text-center py-20 text-gray-400">Request not found</p>;

  const myAssignment = ir.assignments?.find((a: any) => a.user_id === user?.user_id);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/inspection/requests" className="hover:text-brand-500">Inspection Requests</Link>
          <span>/</span>
          <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{ir.request_number}</span>
        </div>
        <BackButton to="/inspection/requests" />
      </div>

      {/* Header */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold font-mono text-gray-800 dark:text-white">{ir.request_number}</h1>
              <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_STYLES[ir.status]}`}>{ir.status.replace(/_/g,' ')}</span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${ir.inspection_type === 'FA' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'}`}>
                {ir.inspection_type === 'FA' ? 'Factory Assessment' : 'Goods Receiving'}
              </span>
            </div>
            <p className="text-sm text-gray-500">Created {fmtDate(ir.created_at)} by {ir.created_by_name}</p>
          </div>
          {/* Action buttons — stacked: manager actions top, staff response bottom */}
          <div className="flex flex-col gap-2 items-end flex-shrink-0">

            {/* Assigned staff: Execute Inspection */}
            {myAssignment && myAssignment.assignment_status === 'accepted' &&
             ['scheduled','active'].includes(ir.status) && (
              <button onClick={() => navigate(`/inspection/requests/${id}/execute`)}
                className="px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                Execute Inspection
              </button>
            )}

            {/* Manager: Approve button */}
            {canManage && ir.status === 'pending_approval' && (
              <button onClick={() => navigate(`/inspection/requests/${id}/approve`)}
                className="px-4 py-2 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Review & Approve
              </button>
            )}

            {/* Manager: Edit + Cancel */}
            {canManage && !['cancelled','completed'].includes(ir.status) && (
              <div className="flex gap-2">
                <button onClick={() => navigate(`/inspection/requests/${id}/edit`)}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  Edit
                </button>
                <button onClick={handleCancel}
                  className="px-4 py-2 text-sm text-red-600 border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                  Cancel
                </button>
              </div>
            )}

            {/* Staff: Accept + Reject (separate row, with evidence warning) */}
            {myAssignment && myAssignment.assignment_status === 'pending' && (() => {
              const myEvidence    = evidenceMap[myAssignment.inspection_assignment_id] ?? [];
              const needsEvidence = !!ir.require_evidence_on_acceptance;
              const hasEvidence   = myEvidence.length > 0;
              const canAccept     = !needsEvidence || hasEvidence;
              return (
                <div className="flex flex-col gap-1.5 items-end">
                  <div className="flex gap-2">
                    <button
                      onClick={() => canAccept && handleAccept(myAssignment.inspection_assignment_id)}
                      disabled={!canAccept}
                      className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                        canAccept
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed line-through'
                      }`}>
                      Accept
                    </button>
                    <button onClick={() => setRejectId(myAssignment.inspection_assignment_id)}
                      className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">
                      Reject
                    </button>
                  </div>
                  {needsEvidence && !hasEvidence && (
                    <p className="text-xs text-orange-500 dark:text-orange-400 flex items-center gap-1">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      Upload evidence below to enable Accept
                    </p>
                  )}
                  {needsEvidence && hasEvidence && (
                    <p className="text-xs text-green-600 dark:text-green-400">✓ Evidence uploaded — Accept is enabled</p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {[
            { label: 'Order',        value: ir.order_number },
            { label: 'Supplier',     value: ir.supplier_name },
            { label: 'Project',      value: ir.project_name ?? '—' },
            { label: 'Checklist',    value: ir.checklist_name },
            { label: 'Date',         value: fmtDate(ir.inspection_date) + (ir.inspection_time ? ` at ${ir.inspection_time}` : '') },
            { label: 'Evidence Required', value: ir.requires_evidence_upload ? 'Yes' : 'No' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
              <p className="font-medium text-gray-800 dark:text-white text-sm">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Location */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Inspection Location</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {[
            { label:'Location', value: ir.location_name },
            { label:'Country',  value: ir.location_country ?? '—' },
            { label:'Region',   value: ir.location_region ?? '—' },
            { label:'Address',  value: ir.location_address ?? '—' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
              <p className="text-gray-700 dark:text-gray-300">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Assignments */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Staff Assignments ({ir.assignments?.length ?? 0})</h2>
        {ir.assignments?.length === 0 ? (
          <p className="text-sm text-gray-400">No staff assigned</p>
        ) : (
          <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
            {ir.assignments.map((a: any) => {
              const aEvidence = evidenceMap[a.inspection_assignment_id] ?? [];
              const isMe      = a.user_id === user?.user_id;
              const isPending = a.assignment_status === 'pending';
              const needsEv   = !!ir.require_evidence_on_acceptance;
              const canAcceptNow = !needsEv || aEvidence.length > 0;
              const base = (import.meta.env.VITE_API_URL ?? '').replace('/api','');
              return (
                <div key={a.inspection_assignment_id} className="py-3">
                  {/* Name + status row */}
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{a.full_name}</p>
                      <p className="text-xs text-gray-400 capitalize">{a.role}</p>
                      {a.remarks && <p className="text-xs text-gray-400 italic mt-0.5">"{a.remarks}"</p>}
                    </div>
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${ASSIGN_STYLES[a.assignment_status]}`}>
                      {a.assignment_status.replace('_',' ')}
                    </span>
                  </div>

                  {/* Evidence panel — show when required OR files exist OR it's mine and pending */}
                  {(needsEv || aEvidence.length > 0 || (isMe && isPending)) && (
                    <div className={`rounded-lg p-3 space-y-2.5 ${needsEv && aEvidence.length === 0 && isMe && isPending ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20' : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700'}`}>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        Evidence Documents
                        {needsEv && isPending && isMe && aEvidence.length === 0 && (
                          <span className="text-orange-600 dark:text-orange-400 font-normal ml-0.5">— required before you can accept</span>
                        )}
                      </p>

                      {/* Uploaded files list with preview */}
                      {aEvidence.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {aEvidence.map((ev: any) => {
                            const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(ev.file_name);
                            const isPdf = /\.pdf$/i.test(ev.file_name);
                            const fileUrl = `${base}/uploads/${ev.file_path?.split('/').pop() ?? ev.file_name}`;
                            return (
                              <button key={ev.assignment_evidence_id}
                                onClick={() => setPreview({ url: fileUrl, name: ev.file_name, type: isImg ? 'image' : isPdf ? 'pdf' : 'file' })}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-brand-200 dark:border-brand-500/30 bg-white dark:bg-gray-900 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors max-w-[200px]">
                                {isImg ? <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  : <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                }
                                <span className="truncate">{ev.file_name}</span>
                                <svg className="w-3 h-3 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No evidence uploaded yet</p>
                      )}

                      {/* Upload button — only for the assigned user when pending */}
                      {isMe && isPending && (
                        <div className="flex items-center gap-2">
                          <label className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                            needsEv && aEvidence.length === 0
                              ? 'bg-orange-500 text-white hover:bg-orange-600'
                              : 'bg-brand-500 text-white hover:bg-brand-600'
                          } ${uploading === a.inspection_assignment_id ? 'opacity-60 cursor-wait' : ''}`}>
                            {uploading === a.inspection_assignment_id ? (
                              <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Uploading...</>
                            ) : (
                              <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                              {aEvidence.length > 0 ? 'Upload More Evidence' : 'Upload Evidence'}</>
                            )}
                            <input type="file" className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.zip,.mp4"
                              disabled={uploading === a.inspection_assignment_id}
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleEvidenceUpload(a.inspection_assignment_id, f); e.target.value = ''; }} />
                          </label>
                          {needsEv && !canAcceptNow && (
                            <p className="text-xs text-orange-600 dark:text-orange-400">Upload at least one file to enable Accept</p>
                          )}
                          {aEvidence.length > 0 && needsEv && (
                            <p className="text-xs text-green-600 dark:text-green-400">✓ Evidence received — you can now Accept above</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order items */}
      {ir.order_items?.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Items for Inspection ({ir.order_items.length})</h2>
          <div className="space-y-1.5">
            {ir.order_items.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">{item.product_name}</p>
                <span className="text-xs text-gray-400">{item.sku_barcode ?? ''}</span>
                <span className="ml-auto text-xs text-gray-500">×{Number(item.quantity).toLocaleString()} {item.unit_type ?? ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checklist Responses — shown when inspection has been executed */}
      {ir.checklist_items?.length > 0 && ir.responses?.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Checklist Responses — {ir.checklist_name}
            </h2>
            {(() => {
              const respMap: Record<number,any> = {};
              (ir.responses ?? []).forEach((r: any) => { respMap[r.checklist_item_id] = r; });
              const pass = Object.values(respMap).filter((r: any) => ['pass','yes'].includes(r.response_value?.toLowerCase())).length;
              const fail = Object.values(respMap).filter((r: any) => ['fail','no'].includes(r.response_value?.toLowerCase())).length;
              return (
                <div className="flex gap-2">
                  {pass > 0 && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400">{pass} Pass/Yes</span>}
                  {fail > 0 && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">{fail} Fail/No</span>}
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{ir.responses.length}/{ir.checklist_items.length} Answered</span>
                </div>
              );
            })()}
          </div>

          {/* Inspector remarks & recommendation */}
          {(ir.general_remarks || ir.recommendation) && (
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ir.general_remarks && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Inspector Remarks</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{ir.general_remarks}</p>
                </div>
              )}
              {ir.recommendation && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Recommendation</p>
                  <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                    ir.recommendation === 'approved'    ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                    ir.recommendation === 'rejected'    ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                    'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
                  }`}>{ir.recommendation}</span>
                </div>
              )}
            </div>
          )}

          {/* Per-item responses */}
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {(() => {
              const respMap: Record<number,any> = {};
              (ir.responses ?? []).forEach((r: any) => { respMap[r.checklist_item_id] = r; });
              const base = (import.meta.env.VITE_API_URL ?? '').replace('/api','');
              return ir.checklist_items.map((item: any, idx: number) => {
                const resp = respMap[item.checklist_item_id];
                const val  = resp?.response_value ?? '';
                const isPass = ['pass','yes'].includes(val.toLowerCase());
                const isFail = ['fail','no'].includes(val.toLowerCase());
                return (
                  <div key={item.checklist_item_id} className="px-5 py-3 flex items-start gap-3">
                    {/* Index */}
                    <span className="text-xs text-gray-400 w-5 flex-shrink-0 mt-0.5">{idx+1}.</span>

                    {/* Item info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {item.item_title}
                        {item.is_required && <span className="text-red-400 ml-1 text-xs">*</span>}
                      </p>
                      {resp?.response_comment && (
                        <p className="text-xs text-gray-400 mt-0.5 italic">"{resp.response_comment}"</p>
                      )}
                      {resp?.evidence_path && (
                        <button
                          onClick={() => {
                            const fname = resp.evidence_path.split('/').pop();
                            const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(fname);
                            setPreview({ url: `${base}/uploads/${fname}`, name: resp.evidence_name ?? fname, type: isImg ? 'image' : 'pdf' });
                          }}
                          className="mt-1 flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 hover:underline">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          View evidence
                        </button>
                      )}
                    </div>

                    {/* Response badge */}
                    {resp ? (
                      <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                        isPass ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                        isFail ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {val || 'Answered'}
                      </span>
                    ) : (
                      <span className={`px-2.5 py-0.5 text-xs rounded-full flex-shrink-0 ${
                        item.is_required
                          ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                          : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                      }`}>
                        {item.is_required ? 'Missing' : 'Skipped'}
                      </span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {ir.request_notes && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{ir.request_notes}</p>
        </div>
      )}

      {/* File preview modal */}
      {preview && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="absolute inset-0 bg-black/80" />
          <div className="relative max-w-3xl w-full max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{preview.name}</p>
              <div className="flex items-center gap-2">
                <a href={preview.url} download={preview.name} target="_blank" rel="noreferrer"
                  className="px-3 py-1 text-xs bg-brand-500 text-white rounded-lg hover:bg-brand-600">Download</a>
                <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
              </div>
            </div>
            <div className="overflow-auto max-h-[calc(90vh-56px)]">
              {preview.type === 'image' ? (
                <img src={preview.url} alt={preview.name} className="w-full h-auto" />
              ) : preview.type === 'pdf' ? (
                <object data={preview.url} type="application/pdf" className="w-full h-[75vh]">
                  <p className="p-6 text-sm text-gray-500">Cannot preview PDF. <a href={preview.url} target="_blank" rel="noreferrer" className="text-brand-500 underline">Open in new tab</a></p>
                </object>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500 text-sm mb-4">Preview not available for this file type.</p>
                  <a href={preview.url} download={preview.name} className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm hover:bg-brand-600">Download File</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={!!rejectId} onClose={() => setRejectId(null)} title="Reject Assignment" size="sm">
        {rejectId && <RejectModal assignmentId={rejectId} onDone={load} onClose={() => setRejectId(null)} />}
      </Modal>
    </div>
  );
}
