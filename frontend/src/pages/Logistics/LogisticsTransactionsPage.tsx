import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { logisticsApi, transfersApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import { useAuth } from '../../store/authStore';
import Modal from '../../components/tpfcs/Modal';
import { FormDateInput } from '../../components/tpfcs/FormField';

const STATUS_STYLES: Record<string,string> = {
  draft:          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  pending_pickup: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  picked_up:      'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  in_transit:     'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  delayed:        'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  arrived:        'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400',
  delivered:      'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  cancelled:      'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
};

const SOURCE_STYLES: Record<string,string> = {
  TRANSFER:    'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  PROCUREMENT: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  DELIVERY:    'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  OTHER:       'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400";

// ── Transaction Form ──────────────────────────────────────────────────────────
function TransactionForm({ companies, transfers, txn, onSaved, onClose }: {
  companies: any[]; transfers: any[]; txn?: any; onSaved: ()=>void; onClose: ()=>void;
}) {
  const isEdit = !!txn;
  const [form, setForm] = useState({
    source_type:               txn?.source_type              ?? 'TRANSFER',
    stock_transfer_id:         txn?.stock_transfer_id?.toString() ?? '',
    logistics_company_id:      txn?.logistics_company_id?.toString() ?? '',
    tracking_number:           txn?.tracking_number           ?? '',
    external_reference_number: txn?.external_reference_number ?? '',
    shipment_description:      txn?.shipment_description      ?? '',
    pickup_location:           txn?.pickup_location           ?? '',
    delivery_location:         txn?.delivery_location         ?? '',
    pickup_date:               txn?.pickup_date?.slice(0,10)  ?? '',
    expected_delivery_date:    txn?.expected_delivery_date?.slice(0,10) ?? '',
    transit_notes:             txn?.transit_notes             ?? '',
    vehicle_information:       txn?.vehicle_information       ?? '',
    driver_information:        txn?.driver_information        ?? '',
    shipment_cost:             txn?.shipment_cost?.toString() ?? '',
    currency_code:             txn?.currency_code             ?? 'TZS',
    exchange_rate:             txn?.exchange_rate?.toString() ?? '1',
    payment_status:            txn?.payment_status            ?? 'pending',
    payment_reference:         txn?.payment_reference         ?? '',
    expense_notes:             txn?.expense_notes             ?? '',
  });
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState('');
  const set = (k: string, v: string) => setForm(p => ({...p, [k]: v}));

  // Auto-fill pickup/delivery from transfer
  useEffect(() => {
    if (form.source_type !== 'TRANSFER' || !form.stock_transfer_id) return;
    const tf = transfers.find((t: any) => t.transfer_id === Number(form.stock_transfer_id));
    if (tf) {
      setForm(p => ({
        ...p,
        pickup_location:   tf.source_store_name      || p.pickup_location,
        delivery_location: tf.destination_store_name || p.delivery_location,
      }));
    }
  }, [form.stock_transfer_id, form.source_type]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.logistics_company_id) { setError('Logistics company required'); return; }
    if (!form.pickup_location)      { setError('Pickup location required'); return; }
    if (!form.delivery_location)    { setError('Delivery location required'); return; }
    setSaving(true); setError('');
    try {
      const payload: any = { ...form };
      payload.logistics_company_id = Number(form.logistics_company_id);
      payload.stock_transfer_id    = form.stock_transfer_id ? Number(form.stock_transfer_id) : null;
      // Nullify empty strings
      ['tracking_number','external_reference_number','shipment_description','transit_notes',
       'vehicle_information','driver_information','pickup_date','expected_delivery_date',
       'shipment_cost','payment_reference','expense_notes',
      ].forEach(k => { if (!payload[k]) payload[k] = null; });
      // Numeric conversions
      if (payload.shipment_cost) payload.shipment_cost = Number(payload.shipment_cost);
      if (payload.exchange_rate) payload.exchange_rate = Number(payload.exchange_rate);
      if (payload.shipment_cost && payload.exchange_rate) {
        payload.base_cost_tzs = payload.shipment_cost * payload.exchange_rate;
      }

      if (isEdit) await logisticsApi.updateTransaction(txn.logistics_transaction_id, payload);
      else        await logisticsApi.createTransaction(payload);
      toast.success(isEdit ? 'Shipment updated' : 'Shipment created');
      onSaved(); onClose();
    } catch (err: any) {
      const m = err?.response?.data?.message ?? 'Failed'; setError(m); toast.error('Failed', m);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg border border-red-200 dark:border-red-500/20">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Source Type <span className="text-red-500">*</span></label>
          <select value={form.source_type} onChange={e => set('source_type', e.target.value)} className={inputCls}>
            <option value="TRANSFER">Stock Transfer</option>
            <option value="PROCUREMENT">Procurement</option>
            <option value="DELIVERY">Delivery</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        {form.source_type === 'TRANSFER' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Stock Transfer</label>
            <select value={form.stock_transfer_id} onChange={e => set('stock_transfer_id', e.target.value)} className={inputCls}>
              <option value="">— Select transfer —</option>
              {transfers.map((t: any) => (
                <option key={t.transfer_id} value={t.transfer_id}>
                  {t.transfer_number} — {t.source_store_name} → {t.destination_store_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Logistics Company <span className="text-red-500">*</span></label>
        <select value={form.logistics_company_id} onChange={e => set('logistics_company_id', e.target.value)} className={inputCls}>
          <option value="">— Select company —</option>
          {companies.filter((c: any) => c.status === 'active').map((co: any) => (
            <option key={co.logistics_company_id} value={co.logistics_company_id}>
              {co.company_name} ({co.company_type})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Tracking Number</label>
          <input value={form.tracking_number} onChange={e => set('tracking_number', e.target.value)} placeholder="e.g. DHL-88992211" className={inputCls}/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">External Reference</label>
          <input value={form.external_reference_number} onChange={e => set('external_reference_number', e.target.value)} placeholder="e.g. MRSK-2026001" className={inputCls}/>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Pickup Location <span className="text-red-500">*</span></label>
          <input value={form.pickup_location} onChange={e => set('pickup_location', e.target.value)} placeholder="Source address / store" className={inputCls}/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Delivery Location <span className="text-red-500">*</span></label>
          <input value={form.delivery_location} onChange={e => set('delivery_location', e.target.value)} placeholder="Destination address / store" className={inputCls}/>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormDateInput label="Pickup Date" id="log-pickup" value={form.pickup_date} onChange={v => set('pickup_date', v)}/>
        <FormDateInput label="Expected Delivery" id="log-delivery" value={form.expected_delivery_date} onChange={v => set('expected_delivery_date', v)}/>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Vehicle Info</label>
          <input value={form.vehicle_information} onChange={e => set('vehicle_information', e.target.value)} placeholder="Truck / container info" className={inputCls}/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Driver Info</label>
          <input value={form.driver_information} onChange={e => set('driver_information', e.target.value)} placeholder="Driver name & contact" className={inputCls}/>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Shipment Description</label>
        <textarea rows={2} value={form.shipment_description} onChange={e => set('shipment_description', e.target.value)} placeholder="Describe contents / special handling..." className={inputCls + ' resize-none'}/>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Transit Notes</label>
        <textarea rows={2} value={form.transit_notes} onChange={e => set('transit_notes', e.target.value)} placeholder="Route notes, customs, etc." className={inputCls + ' resize-none'}/>
      </div>

      {/* Cost / Expense section */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Shipment Cost & Payment</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Currency</label>
            <select value={form.currency_code} onChange={e => set('currency_code', e.target.value)} className={inputCls}>
              {['TZS','USD','EUR','GBP','KES','CNY','AED','INR'].map(cur => <option key={cur} value={cur}>{cur}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Shipment Cost</label>
            <input type="number" min="0" step="any" value={form.shipment_cost} onChange={e => set('shipment_cost', e.target.value)}
              placeholder="0.00" className={inputCls}/>
          </div>
        </div>
        {form.currency_code !== 'TZS' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Exchange Rate (1 {form.currency_code} = ? TZS)
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="any" value={form.exchange_rate} onChange={e => set('exchange_rate', e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm dark:text-white focus:outline-none focus:border-brand-400"/>
              {form.shipment_cost && (
                <span className="text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">
                  = TZS {(Number(form.shipment_cost) * (Number(form.exchange_rate) || 1)).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Payment Status</label>
            <select value={form.payment_status} onChange={e => set('payment_status', e.target.value)} className={inputCls}>
              <option value="pending">Pending</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Payment Reference</label>
            <input value={form.payment_reference} onChange={e => set('payment_reference', e.target.value)}
              placeholder="Receipt / invoice #" className={inputCls}/>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Expense Notes</label>
          <textarea rows={2} value={form.expense_notes} onChange={e => set('expense_notes', e.target.value)}
            placeholder="Cost breakdown, payment terms..." className={inputCls + ' resize-none'}/>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
        <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
          {saving ? 'Saving...' : isEdit ? 'Update' : 'Create Shipment'}
        </button>
      </div>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LogisticsTransactionsPage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const canManage = ['admin','manager'].includes(user?.role ?? '');

  const [data,      setData]      = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [statusF,   setStatusF]   = useState('');
  const [sourceF,   setSourceF]   = useState('');
  const [page,      setPage]      = useState(1);
  const [modal,     setModal]     = useState<'create'|'edit'|null>(null);
  const [selected,  setSelected]  = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await logisticsApi.listTransactions({ page, limit:15, search:search||undefined, status:statusF||undefined, source_type:sourceF||undefined });
      setData(res.data);
    } finally { setLoading(false); }
  }, [page, search, statusF, sourceF]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([
      logisticsApi.listCompanies({ limit: 100 }),
      transfersApi.list({ limit: 200 }),
    ]).then(([co, tf]) => { setCompanies(co.data.results); setTransfers(tf.data.results); }).catch(() => {});
  }, []);

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Logistics Shipments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{data?.totalResults ?? 0} shipments</p>
        </div>
        {canManage && (
          <button onClick={() => { setSelected(null); setModal('create'); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New Shipment
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search LOG#, tracking number, company..."
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400"/>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_STYLES).map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
        <select value={sourceF} onChange={e => { setSourceF(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white">
          <option value="">All Sources</option>
          <option value="TRANSFER">Transfer</option>
          <option value="PROCUREMENT">Procurement</option>
          <option value="DELIVERY">Delivery</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              {['LOG #','Source','Company','Tracking #','From → To','Pickup','ETA','Status',''].map(h =>
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? Array.from({length:5}).map((_,i) => (
                <tr key={i} className="animate-pulse">{Array.from({length:9}).map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded"/></td>)}</tr>
              )) : data?.results.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No shipments found</td></tr>
              ) : data?.results.map((lt: any) => (
                <tr key={lt.logistics_transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">{lt.logistics_number}</td>
                  <td className="px-4 py-3">
                    <div>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${SOURCE_STYLES[lt.source_type]}`}>{lt.source_type}</span>
                      {lt.transfer_number && <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{lt.transfer_number}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{lt.logistics_company_name}</p>
                    <span className="text-[10px] text-gray-400">{lt.company_type}</span>
                  </td>
                  <td className="px-4 py-3">
                    {lt.tracking_number
                      ? <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{lt.tracking_number}</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[150px]">{lt.pickup_location}</p>
                    <p className="text-xs text-brand-600 dark:text-brand-400 truncate max-w-[150px]">→ {lt.delivery_location}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(lt.pickup_date)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(lt.expected_delivery_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_STYLES[lt.status]}`}>
                      {lt.status.replace(/_/g,' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => navigate(`/logistics/shipments/${lt.logistics_transaction_id}`)}
                        className="px-2.5 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-md">View</button>
                      {canManage && !['delivered','cancelled'].includes(lt.status) && (
                        <button onClick={() => { setSelected(lt); setModal('edit'); }}
                          className="px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">Edit</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">Page {data.page} of {data.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p=>p+1)} disabled={page===data.totalPages} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={modal==='create'} onClose={() => setModal(null)} title="New Shipment" size="xl">
        <TransactionForm companies={companies} transfers={transfers} onSaved={load} onClose={() => setModal(null)}/>
      </Modal>
      <Modal isOpen={modal==='edit' && !!selected} onClose={() => setModal(null)} title="Edit Shipment" size="xl">
        {selected && <TransactionForm key={selected.logistics_transaction_id} txn={selected} companies={companies} transfers={transfers} onSaved={load} onClose={() => setModal(null)}/>}
      </Modal>
    </div>
  );
}
