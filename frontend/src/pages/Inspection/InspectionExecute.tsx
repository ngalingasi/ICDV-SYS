import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { inspectionApi, storesApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

const RESPONSE_LABELS: Record<string, string> = {
  pass_fail: 'Pass / Fail', yes_no: 'Yes / No',
  text: 'Text', number: 'Number', photo: 'Photo Upload', file: 'File Upload',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function InspectionExecute() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data,        setData]        = useState<any>(null);
  const [responses,   setResponses]   = useState<Record<number, { value: string; comment: string; file?: File | null }>>({});
  const [remarks,     setRemarks]     = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [preview,     setPreview]     = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    inspectionApi.getExecutionData(Number(id))
      .then(r => {
        setData(r.data);
        // Pre-populate existing responses
        const existing: typeof responses = {};
        (r.data.responses ?? []).forEach((resp: any) => {
          existing[resp.checklist_item_id] = {
            value:   resp.response_value ?? '',
            comment: resp.response_comment ?? '',
          };
        });
        setResponses(existing);
        setRemarks(r.data.general_remarks ?? '');
        setRecommendation(r.data.recommendation ?? '');
      })
      .catch(() => toast.error('Failed', 'Could not load inspection'))
      .finally(() => setLoading(false));
  }, [id]);

  const setResp = (itemId: number, field: 'value' | 'comment', val: string) =>
    setResponses(p => ({ ...p, [itemId]: { ...p[itemId], value: p[itemId]?.value ?? '', comment: p[itemId]?.comment ?? '', [field]: val } }));

  const setRespFile = (itemId: number, file: File | null) =>
    setResponses(p => ({ ...p, [itemId]: { ...p[itemId], value: p[itemId]?.value ?? '', comment: p[itemId]?.comment ?? '', file } }));

  const buildFormData = () => {
    const fd = new FormData();
    const respArray = Object.entries(responses).map(([itemId, r]) => ({
      checklist_item_id: Number(itemId),
      response_value:    r.value,
      response_comment:  r.comment,
      evidence_file:     !!r.file,
    }));
    fd.append('responses', JSON.stringify(respArray));
    // Attach first file found (API handles single file per save call)
    const fileEntry = Object.values(responses).find(r => r.file);
    if (fileEntry?.file) fd.append('evidence', fileEntry.file);
    return fd;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await inspectionApi.saveResponses(Number(id), buildFormData());
      toast.success('Draft saved');
    } catch (err: any) {
      toast.error('Save failed', err?.response?.data?.message);
    } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    if (!recommendation) { toast.error('Required', 'Select an overall recommendation before submitting'); return; }
    // Validate required items
    const missing = data.checklist_items?.filter((item: any) =>
      item.is_required && !responses[item.checklist_item_id]?.value?.trim()
    );
    if (missing?.length) {
      toast.error('Incomplete', `Required: ${missing.map((i: any) => i.item_title).join(', ')}`);
      return;
    }
    setSubmitting(true);
    try {
      // Save responses first then submit
      await inspectionApi.saveResponses(Number(id), buildFormData());
      await inspectionApi.submitInspection(Number(id), { general_remarks: remarks, recommendation });
      toast.success('Inspection submitted', 'Sent for approval');
      navigate(`/inspection/requests/${id}`);
    } catch (err: any) {
      toast.error('Failed', err?.response?.data?.message);
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="animate-pulse space-y-4 max-w-4xl mx-auto">
      {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
    </div>
  );
  if (!data) return <p className="text-center py-20 text-gray-400">Inspection not found</p>;

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400";

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/inspection/requests" className="hover:text-brand-500">Inspection Requests</Link>
          <span>/</span>
          <Link to={`/inspection/requests/${id}`} className="hover:text-brand-500">{data.request_number}</Link>
          <span>/</span>
          <span className="text-gray-700 dark:text-gray-300">Execute</span>
        </div>
        <BackButton to={`/inspection/requests/${id}`} />
      </div>

      {/* Header info */}
      <Section title={`Execute Inspection — ${data.request_number}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {[
            { label: 'Order',     value: data.order_number },
            { label: 'Supplier',  value: data.supplier_name },
            { label: 'Project',   value: data.project_name ?? '—' },
            { label: 'Checklist', value: data.checklist_name },
            { label: 'Date',      value: fmtDate(data.inspection_date) },
            { label: 'Location',  value: data.location_name },
            { label: 'Type',      value: data.inspection_type === 'FA' ? 'Factory Assessment' : 'Goods Receiving' },
            { label: 'Evidence Required', value: data.requires_evidence_upload ? 'Yes' : 'No' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
              <p className="font-medium text-gray-800 dark:text-white text-sm">{item.value}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Order items */}
      {data.order_items?.length > 0 && (
        <Section title={`Order Items (${data.order_items.length})`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                {['Product','SKU','Qty','Unit','Description'].map(h =>
                  <th key={h} className="text-left pb-2 pr-4 font-medium">{h}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {data.order_items.map((item: any) => (
                <tr key={item.id}>
                  <td className="py-2 pr-4 font-medium text-gray-800 dark:text-white">{item.product_name}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-400">{item.sku_barcode ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{Number(item.quantity).toLocaleString()}</td>
                  <td className="py-2 pr-4 text-gray-500">{item.unit_type ?? '—'}</td>
                  <td className="py-2 text-gray-400 text-xs">{item.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Checklist responses */}
      <Section title={`Checklist — ${data.checklist_name}`}>
        <div className="space-y-5">
          {data.checklist_items?.map((item: any, idx: number) => {
            const resp = responses[item.checklist_item_id] ?? { value: '', comment: '' };
            const isAnswered = !!resp.value?.trim();
            return (
              <div key={item.checklist_item_id} className={`rounded-lg border p-4 ${
                item.is_required && !isAnswered
                  ? 'border-orange-200 dark:border-orange-500/30 bg-orange-50/30 dark:bg-orange-500/5'
                  : isAnswered
                  ? 'border-green-200 dark:border-green-500/20 bg-green-50/20 dark:bg-green-500/5'
                  : 'border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-white">
                      <span className="text-gray-400 mr-2">{idx + 1}.</span>
                      {item.item_title}
                      {item.is_required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    {item.item_description && (
                      <p className="text-xs text-gray-400 mt-0.5 ml-5">{item.item_description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded flex-shrink-0">
                    {RESPONSE_LABELS[item.response_type]}
                  </span>
                </div>

                {/* Response input */}
                <div className="ml-5 space-y-2">
                  {(item.response_type === 'pass_fail' || item.response_type === 'yes_no') ? (
                    <div className="flex gap-2">
                      {(item.response_type === 'pass_fail' ? ['Pass','Fail'] : ['Yes','No']).map(opt => (
                        <button key={opt} type="button"
                          onClick={() => setResp(item.checklist_item_id, 'value', opt)}
                          className={`px-5 py-2 text-sm rounded-lg font-medium transition-colors ${
                            resp.value === opt
                              ? opt === 'Pass' || opt === 'Yes'
                                ? 'bg-green-500 text-white'
                                : 'bg-red-500 text-white'
                              : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}>{opt}</button>
                      ))}
                    </div>
                  ) : item.response_type === 'number' ? (
                    <input type="number" value={resp.value} onChange={e => setResp(item.checklist_item_id, 'value', e.target.value)} className={inputCls} placeholder="Enter number..." />
                  ) : item.response_type === 'text' ? (
                    <textarea rows={2} value={resp.value} onChange={e => setResp(item.checklist_item_id, 'value', e.target.value)} className={inputCls + ' resize-none'} placeholder="Enter response..." />
                  ) : (
                    /* photo / file */
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        {resp.file ? resp.file.name : 'Attach file'}
                        <input type="file" className="hidden"
                          accept={item.response_type === 'photo' ? 'image/*' : '*'}
                          onChange={e => {
                            const f = e.target.files?.[0] ?? null;
                            setRespFile(item.checklist_item_id, f);
                            if (f) setResp(item.checklist_item_id, 'value', f.name);
                          }} />
                      </label>
                      {resp.value && !resp.file && (
                        <span className="text-xs text-brand-500">{resp.value}</span>
                      )}
                    </div>
                  )}

                  {/* Comment */}
                  {(item.requires_comment || resp.comment) && (
                    <input type="text" value={resp.comment}
                      onChange={e => setResp(item.checklist_item_id, 'comment', e.target.value)}
                      placeholder={item.requires_comment ? 'Comment (required)...' : 'Add comment...'}
                      className={inputCls + ' mt-1.5'} />
                  )}
                  {!item.requires_comment && !resp.comment && (
                    <button type="button" onClick={() => setResp(item.checklist_item_id, 'comment', ' ')}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline">
                      + Add comment
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Summary */}
      <Section title="Inspection Summary & Recommendation">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">General Remarks</label>
            <textarea rows={3} value={remarks} onChange={e => setRemarks(e.target.value)}
              placeholder="Overall observations, notes for approver..."
              className={inputCls + ' resize-none'} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Overall Recommendation <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              {[
                { value: 'approved',    label: 'Approve',     cls: 'bg-green-500 text-white' },
                { value: 'conditional', label: 'Conditional', cls: 'bg-orange-500 text-white' },
                { value: 'rejected',    label: 'Reject',      cls: 'bg-red-500 text-white' },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setRecommendation(opt.value)}
                  className={`px-5 py-2 text-sm rounded-lg font-medium transition-all ${
                    recommendation === opt.value ? opt.cls : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Actions */}
      <div className="flex items-center justify-between pb-8">
        <Link to={`/inspection/requests/${id}`} className="px-5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
          Back
        </Link>
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 text-sm border border-brand-300 dark:border-brand-500/40 text-brand-600 dark:text-brand-400 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button onClick={handleSubmit} disabled={submitting || !recommendation}
            className="px-6 py-2.5 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Inspection'}
          </button>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="absolute inset-0 bg-black/80" />
          <div className="relative max-w-3xl w-full bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium truncate">{preview.name}</p>
              <button onClick={() => setPreview(null)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
            </div>
            <img src={preview.url} alt={preview.name} className="w-full h-auto object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
