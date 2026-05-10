import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router';
import { inspectionApi, purchaseOrdersApi, projectsApi, usersApi, lookupsApi, transfersApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import { FormDateInput } from '../../components/tpfcs/FormField';
import BackButton from '../../components/tpfcs/BackButton';
import type { Region } from '../../types';

// ── Outside to prevent focus loss ────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 pb-2 border-b border-gray-100 dark:border-gray-800">{title}</h2>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400";

// ─────────────────────────────────────────────────────────────────────────────

export default function InspectionRequestForm() {
  const { id }           = useParams<{ id: string }>();
  const [searchParams]   = useSearchParams();
  const navigate         = useNavigate();
  const isEdit           = !!id;

  // Source type — can come from URL params (when navigating from Transfer/Order detail)
  const [sourceType, setSourceType] = useState<'ORDER'|'TRANSFER'>(
    (searchParams.get('source_type') as 'ORDER'|'TRANSFER') ?? 'ORDER'
  );

  // ── Core fields ──────────────────────────────────────────────────────────
  const [inspType,    setInspType]    = useState('FA');
  const [checklistId, setChecklistId] = useState('');
  const [projectId,   setProjectId]   = useState('');
  const [notes,       setNotes]       = useState('');
  const [status,      setStatus]      = useState('draft');
  const [assignedIds, setAssignedIds] = useState<number[]>([]);
  const [orderItemIds,setOrderItemIds]= useState<number[]>([]);
  const [reqEvidence,      setReqEvidence]      = useState(false);
  const [reqEvidenceAccept,setReqEvidenceAccept]= useState(false);

  // ── ORDER source ─────────────────────────────────────────────────────────
  const [orderId,   setOrderId]   = useState(searchParams.get('order_id') ?? '');
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [orderItems,setOrderItems]= useState<any[]>([]);

  // ── TRANSFER source ──────────────────────────────────────────────────────
  const [transferId,   setTransferId]   = useState(searchParams.get('source_id') ?? '');
  const [transferInfo, setTransferInfo] = useState<any>(null);

  // ── Location ─────────────────────────────────────────────────────────────
  const [locationCountry,  setLocationCountry]  = useState('Tanzania');
  const [locationName,     setLocationName]     = useState('');
  const [locationAddr,     setLocationAddr]     = useState('');
  const [locationRegion,   setLocationRegion]   = useState('');
  const [locationRegionId, setLocationRegionId] = useState('');
  const [locationCity,     setLocationCity]     = useState('');
  const [lat,  setLat]  = useState('');
  const [lng,  setLng]  = useState('');

  // ── Schedule ─────────────────────────────────────────────────────────────
  const [inspDate, setInspDate] = useState('');
  const [inspTime, setInspTime] = useState('');

  // ── Lookup data ──────────────────────────────────────────────────────────
  const [checklists,  setChecklists]  = useState<any[]>([]);
  const [orders,      setOrders]      = useState<any[]>([]);
  const [transfers,   setTransfers]   = useState<any[]>([]);
  const [projects,    setProjects]    = useState<any[]>([]);
  const [users,       setUsers]       = useState<any[]>([]);
  const [regions,     setRegions]     = useState<Region[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  // ── Load lookups on mount ─────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      inspectionApi.listChecklists({ limit: 100, status: 'active' }),
      purchaseOrdersApi.list({ limit: 200 }),
      (transfersApi as any).list({ limit: 200 }),
      projectsApi.list({ limit: 100 }),
      usersApi.list({ limit: 200, status: 'active' }),
      lookupsApi.regions(),
    ]).then(([cl, ord, trf, proj, usr, reg]) => {
      setChecklists(cl.data.results);
      setOrders(ord.data.results);
      setTransfers(trf.data.results ?? []);
      setProjects(proj.data.results);
      setUsers(usr.data.results);
      setRegions(Array.isArray(reg.data) ? reg.data : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // ── Auto-load order info when orderId changes ─────────────────────────────
  useEffect(() => {
    if (sourceType !== 'ORDER' || !orderId) { setOrderInfo(null); setOrderItems([]); return; }
    purchaseOrdersApi.get(Number(orderId)).then(r => {
      setOrderInfo(r.data);
      setOrderItems(r.data.items ?? []);
      if (r.data.project_id) setProjectId(r.data.project_id.toString());
    }).catch(() => {});
  }, [orderId, sourceType]);

  // ── Auto-load transfer info when transferId changes ───────────────────────
  useEffect(() => {
    if (sourceType !== 'TRANSFER' || !transferId) { setTransferInfo(null); setOrderItems([]); return; }
    (transfersApi as any).get(Number(transferId)).then((r: any) => {
      setTransferInfo(r.data);
      setOrderItems(r.data.items ?? []);
      // Auto-set location to destination store
      if (r.data.destination_store_name) {
        setLocationName(r.data.destination_store_name);
        setLocationCountry('Tanzania');
      }
    }).catch(() => {});
  }, [transferId, sourceType]);

  // ── Load existing request on edit ─────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    inspectionApi.getRequest(Number(id)).then(res => {
      const ir = res.data;
      setSourceType((ir.source_type as 'ORDER'|'TRANSFER') ?? 'ORDER');
      setInspType(ir.inspection_type ?? 'FA');
      setProjectId(ir.project_id?.toString() ?? '');
      setOrderId(ir.purchase_order_id?.toString() ?? '');
      setTransferId(ir.source_type === 'TRANSFER' ? (ir.source_id?.toString() ?? '') : '');
      setChecklistId(ir.checklist_id?.toString() ?? '');
      setLocationCountry(ir.location_country ?? 'Tanzania');
      setLocationName(ir.location_name ?? '');
      setLocationAddr(ir.location_address ?? '');
      setLocationRegion(ir.location_region ?? '');
      setLocationRegionId(ir.location_region_id?.toString() ?? '');
      setLocationCity(ir.location_city ?? '');
      setLat(ir.latitude?.toString() ?? '');
      setLng(ir.longitude?.toString() ?? '');
      setInspDate(ir.inspection_date?.slice(0,10) ?? '');
      setInspTime(ir.inspection_time ?? '');
      setReqEvidence(!!ir.requires_evidence_upload);
      setReqEvidenceAccept(!!ir.require_evidence_on_acceptance);
      setNotes(ir.request_notes ?? '');
      setStatus(ir.status ?? 'draft');
      setAssignedIds(ir.assignments?.map((a: any) => a.user_id) ?? []);
      setOrderItemIds(ir.order_items?.map((i: any) => i.purchase_order_item_id) ?? []);
    }).catch(() => {});
  }, [id]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const filteredChecklists = checklists.filter(cl => cl.inspection_type === inspType);
  const toggleUser  = (uid: number) => setAssignedIds(p => p.includes(uid) ? p.filter(x=>x!==uid) : [...p, uid]);
  const toggleItem  = (itemId: number) => setOrderItemIds(p => p.includes(itemId) ? p.filter(x=>x!==itemId) : [...p, itemId]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceType === 'ORDER'    && !orderId)    { setError('Order is required');    return; }
    if (sourceType === 'TRANSFER' && !transferId) { setError('Transfer is required'); return; }
    if (!checklistId) { setError('Checklist is required'); return; }
    if (!locationName){ setError('Inspection location name is required'); return; }
    if (!inspDate)    { setError('Inspection date is required'); return; }
    if (!assignedIds.length) { setError('At least one staff must be assigned'); return; }
    if (locationCountry === 'Tanzania' && !locationRegionId) { setError('Region is required for local inspections'); return; }

    setSaving(true); setError('');
    try {
      const payload: any = {
        inspection_type:              inspType,
        project_id:                   projectId ? Number(projectId) : null,
        purchase_order_id:            sourceType === 'ORDER' ? (orderId ? Number(orderId) : null) : null,
        source_type:                  sourceType,
        source_id:                    sourceType === 'TRANSFER' ? Number(transferId) : null,
        destination_store_id:         sourceType === 'TRANSFER' && transferInfo ? transferInfo.destination_store_id : null,
        checklist_id:                 Number(checklistId),
        location_name:                locationName,
        location_address:             locationAddr || null,
        location_country:             locationCountry || null,
        location_region:              locationCountry === 'Tanzania' ? locationRegion || null : null,
        location_region_id:           locationCountry === 'Tanzania' && locationRegionId ? Number(locationRegionId) : null,
        location_city:                locationCountry !== 'Tanzania' ? locationCity || null : null,
        latitude:                     lat ? Number(lat) : null,
        longitude:                    lng ? Number(lng) : null,
        inspection_date:              inspDate,
        inspection_time:              inspTime || null,
        requires_evidence_upload:     reqEvidence,
        require_evidence_on_acceptance: reqEvidenceAccept,
        request_notes:                notes || null,
        status,
        assigned_user_ids:            assignedIds,
        order_item_ids:               orderItemIds,
      };

      if (isEdit) {
        await inspectionApi.updateRequest(Number(id), payload);
        toast.success('Inspection request updated');
        navigate(`/inspection/requests/${id}`);
      } else {
        const res = await inspectionApi.createRequest(payload);
        toast.success('Inspection request created', res.data.request_number);
        navigate(`/inspection/requests/${res.data.inspection_request_id}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to save';
      toast.error('Save failed', msg); setError(msg);
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="animate-pulse space-y-4 max-w-4xl mx-auto">
      {[1,2,3,4].map(i => <div key={i} className="h-36 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
    </div>
  );

  const displayItems = sourceType === 'TRANSFER'
    ? (transferInfo?.items ?? [])
    : orderItems;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/inspection/requests" className="hover:text-brand-500">Inspection Requests</Link>
          <span>/</span>
          <span className="text-gray-700 dark:text-gray-300">{isEdit ? 'Edit Request' : 'New Request'}</span>
        </div>
        <BackButton to="/inspection/requests" />
      </div>

      <h1 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
        {isEdit ? 'Edit Inspection Request' : 'New Inspection Request'}
      </h1>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm border border-red-200 dark:border-red-500/20">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Step 1: Inspection Type + Source Type ── */}
        <Section title="Inspection Setup">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Inspection type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Inspection Type <span className="text-red-500">*</span>
              </label>
              <select value={inspType} onChange={e => { setInspType(e.target.value); setChecklistId(''); }} className={inputCls}>
                <option value="FA">Factory Assessment (FA) — at supplier premises</option>
                <option value="GRI">Goods Receiving (GRI) — during receiving</option>
              </select>
            </div>

            {/* Source type — ORDER or TRANSFER */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Source Type <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 h-[42px]">
                {(['ORDER','TRANSFER'] as const).map(type => (
                  <button key={type} type="button"
                    onClick={() => {
                      setSourceType(type);
                      setOrderId(''); setOrderInfo(null);
                      setTransferId(''); setTransferInfo(null);
                      setOrderItemIds([]);
                    }}
                    className={`flex-1 rounded-lg text-sm font-medium border transition-colors ${
                      sourceType === type
                        ? type === 'ORDER'
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-orange-500 text-white border-orange-500'
                        : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}>
                    <span className="flex items-center justify-center gap-1.5">
                      {type === 'ORDER' ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                      )}
                      {type === 'ORDER' ? 'Order' : 'Transfer'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Checklist <span className="text-red-500">*</span>
            </label>
            <select value={checklistId} onChange={e => setChecklistId(e.target.value)} className={inputCls}>
              <option value="">Select checklist...</option>
              {filteredChecklists.map(cl => <option key={cl.checklist_id} value={cl.checklist_id}>{cl.checklist_name}</option>)}
            </select>
            {filteredChecklists.length === 0 && (
              <p className="text-xs text-orange-500 mt-1">No active checklists for {inspType === 'FA' ? 'Factory Assessment' : 'Goods Receiving'}. Create one first.</p>
            )}
          </div>
        </Section>

        {/* ── Step 2: Source (Order or Transfer) ── */}
        <Section title={sourceType === 'ORDER' ? 'Order Details' : 'Transfer Details'}>

          {sourceType === 'ORDER' ? (
            <>
              {/* Order selector */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Order <span className="text-red-500">*</span>
                </label>
                <select value={orderId} onChange={e => setOrderId(e.target.value)} className={inputCls}>
                  <option value="">— Select order —</option>
                  {orders.map(o => (
                    <option key={o.purchase_order_id} value={o.purchase_order_id}>
                      {o.order_number} — {o.supplier_name}{o.project_name ? ` · ${o.project_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Order info panel */}
              {orderInfo && (
                <div className="rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><p className="text-gray-400 mb-0.5">Order</p><p className="font-mono font-semibold text-brand-700 dark:text-brand-400">{orderInfo.order_number}</p></div>
                  <div><p className="text-gray-400 mb-0.5">Supplier</p><p className="font-medium text-gray-800 dark:text-white">{orderInfo.supplier_name}</p></div>
                  <div><p className="text-gray-400 mb-0.5">Project</p><p className="font-medium text-gray-800 dark:text-white">{orderInfo.project_name ?? '—'}</p></div>
                  <div><p className="text-gray-400 mb-0.5">Currency</p><p className="font-mono font-medium text-gray-800 dark:text-white">{orderInfo.currency_code}</p></div>
                </div>
              )}

              {/* Project — auto-filled, read-only if from order */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Project
                  {orderInfo?.project_id && <span className="ml-2 text-brand-500 font-normal text-[10px]">Auto-linked from order</span>}
                </label>
                {orderInfo?.project_id ? (
                  <div className={inputCls + ' bg-gray-50 dark:bg-gray-800/50 cursor-default text-gray-500 dark:text-gray-400'}>
                    {orderInfo.project_name}
                  </div>
                ) : (
                  <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputCls}>
                    <option value="">None</option>
                    {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
                  </select>
                )}
              </div>

              {/* Order items selection */}
              {orderId && orderItems.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Order Items to Inspect
                    <span className="ml-1 font-normal text-gray-400">(leave all unchecked to inspect entire order)</span>
                  </label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                    {orderItems.map((item: any) => (
                      <label key={item.item_id} className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1.5 rounded">
                        <input type="checkbox" checked={orderItemIds.includes(item.item_id)}
                          onChange={() => toggleItem(item.item_id)}
                          className="rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{item.product_name}</span>
                        <span className="text-xs text-gray-400 ml-auto">×{Number(item.quantity).toLocaleString()} {item.unit_type ?? ''}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Transfer selector */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Stock Transfer <span className="text-red-500">*</span>
                  <span className="ml-1 font-normal text-gray-400">(dispatched transfers only)</span>
                </label>
                <select value={transferId} onChange={e => setTransferId(e.target.value)} className={inputCls}>
                  <option value="">— Select transfer —</option>
                  {transfers.filter((t: any) => ['dispatched','under_inspection'].includes(t.status)).map((t: any) => (
                    <option key={t.transfer_id} value={t.transfer_id}>
                      {t.transfer_number} — {t.source_store_name} → {t.destination_store_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Transfer info panel */}
              {transferInfo && (
                <div className="rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 p-3 grid grid-cols-3 gap-3 text-xs">
                  <div><p className="text-gray-400 mb-0.5">Transfer #</p><p className="font-mono font-semibold text-orange-700 dark:text-orange-400">{transferInfo.transfer_number}</p></div>
                  <div><p className="text-gray-400 mb-0.5">From (Source)</p><p className="font-medium text-gray-800 dark:text-white">{transferInfo.source_store_name}</p></div>
                  <div><p className="text-gray-400 mb-0.5">To (Destination) ← Inspection here</p><p className="font-medium text-green-600 dark:text-green-400">{transferInfo.destination_store_name}</p></div>
                </div>
              )}

              {/* Manual project selection for transfers */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Project (optional)</label>
                <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputCls}>
                  <option value="">None</option>
                  {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
                </select>
              </div>

              {/* Transfer items */}
              {transferId && displayItems.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Transfer Items
                    <span className="ml-1 font-normal text-gray-400">(all items will be inspected)</span>
                  </label>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-gray-50 dark:bg-gray-800 text-gray-400">
                        <th className="text-left px-3 py-2">Product</th>
                        <th className="text-left px-3 py-2">SKU</th>
                        <th className="text-right px-3 py-2">Qty</th>
                        <th className="text-left px-3 py-2">Unit</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {displayItems.map((item: any) => (
                          <tr key={item.transfer_item_id ?? item.item_id}>
                            <td className="px-3 py-2 font-medium text-gray-800 dark:text-white">{item.product_name}</td>
                            <td className="px-3 py-2 font-mono text-gray-400">{item.sku_barcode ?? '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{Number(item.quantity).toLocaleString()}</td>
                            <td className="px-3 py-2 text-gray-400">{item.unit_type ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </Section>

        {/* ── Location ── */}
        <Section title="Inspection Location">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Country <span className="text-red-500">*</span></label>
              <select value={locationCountry} onChange={e => { setLocationCountry(e.target.value); setLocationRegionId(''); setLocationCity(''); }} className={inputCls}>
                <option value="Tanzania">Tanzania (Local)</option>
                <option value="Kenya">Kenya</option>
                <option value="Uganda">Uganda</option>
                <option value="Rwanda">Rwanda</option>
                <option value="China">China</option>
                <option value="UAE">UAE</option>
                <option value="India">India</option>
                <option value="USA">USA</option>
                <option value="UK">UK</option>
                <option value="Germany">Germany</option>
                <option value="South Africa">South Africa</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Location Name <span className="text-red-500">*</span></label>
              <input value={locationName} onChange={e => setLocationName(e.target.value)}
                placeholder={locationCountry === 'Tanzania' ? 'e.g. JNIA, Dar Port Warehouse' : 'e.g. Supplier Factory, Airport'}
                className={inputCls} />
            </div>
          </div>

          {locationCountry === 'Tanzania' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Region <span className="text-red-500">*</span></label>
                <select value={locationRegionId} onChange={e => setLocationRegionId(e.target.value)} className={inputCls}>
                  <option value="">Select region...</option>
                  {regions.map((r: any) => <option key={r.region_id} value={r.region_id}>{r.region_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Address</label>
                <input value={locationAddr} onChange={e => setLocationAddr(e.target.value)} placeholder="Street / building address" className={inputCls} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">City <span className="text-red-500">*</span></label>
                <input value={locationCity} onChange={e => setLocationCity(e.target.value)} placeholder="e.g. Guangzhou, Dubai" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Address</label>
                <input value={locationAddr} onChange={e => setLocationAddr(e.target.value)} placeholder="Street / building address" className={inputCls} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Latitude</label>
              <input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} placeholder="-6.7924" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Longitude</label>
              <input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} placeholder="39.2083" className={inputCls} />
            </div>
          </div>
        </Section>

        {/* ── Schedule ── */}
        <Section title="Schedule & Options">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormDateInput label="Inspection Date" id="insp-date" required value={inspDate} onChange={v => setInspDate(v)} />
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Inspection Time</label>
              <select value={inspTime} onChange={e => setInspTime(e.target.value)} className={inputCls}>
                <option value="">— Select time —</option>
                {Array.from({ length: 48 }, (_, i) => {
                  const h = Math.floor(i / 2);
                  const m = i % 2 === 0 ? '00' : '30';
                  const val = `${String(h).padStart(2,'0')}:${m}`;
                  const label = `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${m} ${h < 12 ? 'AM' : 'PM'}`;
                  return <option key={val} value={val}>{label}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                <option value="draft">Draft</option>
                <option value="pending_acceptance">Send for Acceptance</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Require evidence during inspection', sub: 'Inspector must upload photos/documents while conducting inspection', val: reqEvidence, set: setReqEvidence },
              { label: 'Require evidence before acceptance', sub: 'Assigned staff must upload supporting documents before accepting', val: reqEvidenceAccept, set: setReqEvidenceAccept },
            ].map(t => (
              <label key={t.label} className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative flex-shrink-0">
                  <input type="checkbox" checked={t.val} onChange={e => t.set(e.target.checked)} className="sr-only" />
                  <div className={`w-10 h-5 rounded-full transition-colors ${t.val ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${t.val ? 'translate-x-5' : ''}`} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.label}</p>
                  <p className="text-xs text-gray-400">{t.sub}</p>
                </div>
              </label>
            ))}
          </div>
        </Section>

        {/* ── Staff Assignment ── */}
        <Section title="Staff Assignment">
          <p className="text-xs text-gray-500 dark:text-gray-400">Select users who will conduct this inspection. They must accept the assignment before inspection becomes active.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            {users.map(u => (
              <label key={u.user_id} className={`flex items-center gap-2.5 cursor-pointer p-2 rounded-lg transition-colors ${assignedIds.includes(u.user_id) ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <input type="checkbox" checked={assignedIds.includes(u.user_id)} onChange={() => toggleUser(u.user_id)}
                  className="rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{u.full_name}</p>
                  <p className="text-xs text-gray-400 capitalize">{u.role}</p>
                </div>
              </label>
            ))}
          </div>
          {assignedIds.length > 0 && <p className="text-xs text-brand-600 dark:text-brand-400">{assignedIds.length} staff selected</p>}
        </Section>

        {/* ── Notes ── */}
        <Section title="Notes">
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Special instructions, preparation requirements..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400 resize-none" />
        </Section>

        <div className="flex items-center justify-between pb-8">
          <Link to="/inspection/requests" className="px-5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</Link>
          <button type="submit" disabled={saving} className="px-6 py-2.5 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update Request' : 'Create Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
