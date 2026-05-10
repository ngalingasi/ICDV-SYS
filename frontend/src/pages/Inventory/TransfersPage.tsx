import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { transfersApi, storesApi, productsApi, logisticsApi } from '../../api';
import Modal from '../../components/tpfcs/Modal';
import { FormDateInput } from '../../components/tpfcs/FormField';
import { toast } from '../../components/tpfcs/Toast';
import { useAuth } from '../../store/authStore';

const STATUS_STYLES: Record<string,string> = {
  draft:               'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  approved:            'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  dispatched:          'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  under_inspection:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  inspection_approved: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  received:            'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  closed:              'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  cancelled:           'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

const TRANSIT_METHODS = ['Internal Vehicle','Courier','Air Freight','Sea Freight','Third-party Logistics','Pickup','Manual Delivery'];

let _uid = 0; const uid = () => ++_uid;

interface StockMap { [productId: number]: { quantity: number; product_name: string; sku_barcode: string; unit_type: string } }

// ── Transfer Form ─────────────────────────────────────────────────────────────
function TransferForm({ transfer, stores, products, logisticsCompanies, onSaved, onClose }: {
  transfer?: any; stores: any[]; products: any[]; logisticsCompanies: any[];
  onSaved: ()=>void; onClose: ()=>void;
}) {
  const isEdit = !!transfer;
  const [srcId,   setSrcId]   = useState(transfer?.source_store_id?.toString()      ?? '');
  const [dstId,   setDstId]   = useState(transfer?.destination_store_id?.toString() ?? '');
  const [date,    setDate]    = useState(transfer?.transfer_date?.slice(0,10) ?? new Date().toISOString().slice(0,10));
  const [notes,   setNotes]   = useState(transfer?.notes ?? '');
  const [reqInsp, setReqInsp] = useState(transfer ? !!transfer.requires_inspection : true);

  // Transit
  const [reqTransit, setReqTransit]   = useState(!!transfer?.requires_transit);
  const [transitMethod, setTransitMethod] = useState(transfer?.transit_method ?? '');
  const [transitProvider, setTransitProvider] = useState(transfer?.transit_provider ?? '');
  const [trackingNo, setTrackingNo]   = useState(transfer?.tracking_number ?? '');
  const [arrivalDate, setArrivalDate] = useState(transfer?.expected_arrival_date?.slice(0,10) ?? '');
  const [vehicleInfo, setVehicleInfo] = useState(transfer?.vehicle_information ?? '');
  const [driverInfo, setDriverInfo]   = useState(transfer?.driver_information ?? '');
  const [logisticsNotes, setLogisticsNotes] = useState(transfer?.logistics_notes ?? '');
  const [logisticsCompanyId, setLogisticsCompanyId] = useState(transfer?.logistics_company_id?.toString() ?? '');

  // Items
  const [items, setItems] = useState<{_key:number;product_id:string;quantity:string;notes:string}[]>(
    transfer?.items?.length
      ? transfer.items.map((i: any) => ({ _key: uid(), product_id: i.product_id?.toString(), quantity: i.quantity?.toString(), notes: i.notes ?? '' }))
      : [{ _key: uid(), product_id:'', quantity:'', notes:'' }]
  );

  // Source store stock
  const [stockMap,    setStockMap]    = useState<StockMap>({});
  const [loadingStock, setLoadingStock] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  // Fetch stock when source store changes
  useEffect(() => {
    if (!srcId) { setStockMap({}); return; }
    setLoadingStock(true);
    transfersApi.getStoreStock(Number(srcId))
      .then(r => setStockMap(r.data))
      .catch(() => {})
      .finally(() => setLoadingStock(false));
  }, [srcId]);

  const addItem = () => setItems(p => [...p, { _key: uid(), product_id:'', quantity:'', notes:'' }]);
  const removeItem = (k: number) => setItems(p => p.filter(i => i._key !== k));
  const setItem = (k: number, f: string, v: string) => setItems(p => p.map(i => i._key===k ? {...i,[f]:v} : i));

  // Validation per item
  const itemValidation = useMemo(() => {
    const result: Record<number, { available: number; remaining: number; error: string | null }> = {};
    items.forEach(item => {
      if (!item.product_id) { result[item._key] = { available: 0, remaining: 0, error: null }; return; }
      const stock = stockMap[Number(item.product_id)];
      const available = stock?.quantity ?? 0;
      const qty = parseFloat(item.quantity) || 0;
      const remaining = available - qty;
      let err: string | null = null;
      if (!stock) err = 'Product not in source store';
      else if (qty <= 0) err = null;
      else if (qty > available) err = `Exceeds available stock (${available})`;
      result[item._key] = { available, remaining, error: err };
    });
    return result;
  }, [items, stockMap]);

  const hasErrors = Object.values(itemValidation).some(v => v.error !== null);
  const validItems = items.filter(i => i.product_id && parseFloat(i.quantity) > 0);

  const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srcId || !dstId) { setError('Source and destination stores required'); return; }
    if (srcId === dstId)  { setError('Source and destination must be different'); return; }
    if (!validItems.length) { setError('At least one item with quantity is required'); return; }
    if (hasErrors) { setError('Fix validation errors before saving'); return; }
    if (reqTransit && !transitMethod) { setError('Transit method is required when logistics enabled'); return; }

    setSaving(true); setError('');
    try {
      const payload: any = {
        source_store_id: Number(srcId), destination_store_id: Number(dstId),
        transfer_date: date, notes: notes || null, requires_inspection: reqInsp,
        requires_transit: reqTransit,
        items: validItems.map(i => ({ product_id: Number(i.product_id), quantity: parseFloat(i.quantity), notes: i.notes || null })),
      };
      if (reqTransit) {
        payload.logistics_company_id = logisticsCompanyId ? Number(logisticsCompanyId) : null;
        Object.assign(payload, {
          transit_method: transitMethod || null, transit_provider: transitProvider || null,
          tracking_number: trackingNo || null, expected_arrival_date: arrivalDate || null,
          vehicle_information: vehicleInfo || null, driver_information: driverInfo || null,
          logistics_notes: logisticsNotes || null,
        });
      }
      if (isEdit) await transfersApi.update(transfer.transfer_id, payload);
      else        await transfersApi.create(payload);
      toast.success(isEdit ? 'Transfer updated' : 'Transfer created');
      onSaved(); onClose();
    } catch (err: any) {
      const m = err?.response?.data?.message ?? 'Failed'; setError(m); toast.error('Failed', m);
    } finally { setSaving(false); }
  };

  // Products that have stock in source store
  const sourceProducts = srcId
    ? products.filter(p => stockMap[p.product_id] !== undefined)
    : products;

  return (
    <form onSubmit={save} className="space-y-5">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg border border-red-200 dark:border-red-500/20">{error}</p>}

      {/* Stores */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">From Store <span className="text-red-500">*</span></label>
          <select value={srcId} onChange={e => { setSrcId(e.target.value); setItems([{ _key: uid(), product_id:'', quantity:'', notes:'' }]); }} className={inputCls}>
            <option value="">Select source...</option>
            {stores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}{s.region_name ? ` — ${s.region_name}` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">To Store <span className="text-red-500">*</span></label>
          <select value={dstId} onChange={e => setDstId(e.target.value)} className={inputCls}>
            <option value="">Select destination...</option>
            {stores.filter(s => s.store_id !== Number(srcId)).map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}{s.region_name ? ` — ${s.region_name}` : ''}</option>)}
          </select>
        </div>
      </div>

      <FormDateInput label="Transfer Date" id="trf-date" required value={date} onChange={setDate} />

      {/* Toggles */}
      <div className="flex gap-4">
        {[
          { label:'Requires inspection at destination', val: reqInsp, set: setReqInsp },
          { label:'Requires transit / logistics',       val: reqTransit, set: setReqTransit },
        ].map(t => (
          <label key={t.label} className="flex items-center gap-2.5 cursor-pointer select-none flex-1 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
            <div className="relative flex-shrink-0">
              <input type="checkbox" checked={t.val} onChange={e => t.set(e.target.checked)} className="sr-only"/>
              <div className={`w-9 h-5 rounded-full transition-colors ${t.val ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${t.val ? 'translate-x-4' : ''}`}/>
              </div>
            </div>
            <span className="text-xs text-gray-700 dark:text-gray-300">{t.label}</span>
          </label>
        ))}
      </div>

      {/* Transit fields — conditional */}
      {reqTransit && (
        <div className="rounded-lg border border-brand-200 dark:border-brand-500/30 bg-brand-50/30 dark:bg-brand-500/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-brand-700 dark:text-brand-400 mb-1">Transit / Logistics Details</p>

          {/* Provider from Logistics Companies */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Logistics Provider / Carrier <span className="text-red-500">*</span>
              <span className="ml-1 text-[10px] font-normal text-gray-400">— from Logistics module</span>
            </label>
            {logisticsCompanies.length === 0 ? (
              <div className="rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 p-3 text-xs text-orange-700 dark:text-orange-400">
                No logistics companies found.{' '}
                <a href="/logistics/companies" target="_blank" className="underline font-medium">Add one in the Logistics module</a> first.
              </div>
            ) : (
              <select value={logisticsCompanyId} onChange={e => setLogisticsCompanyId(e.target.value)} className={inputCls}>
                <option value="">— Select provider —</option>
                {logisticsCompanies.map((lc: any) => (
                  <option key={lc.logistics_company_id} value={lc.logistics_company_id}>
                    {lc.company_name} — {lc.company_type}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Transit Method</label>
              <select value={transitMethod} onChange={e => setTransitMethod(e.target.value)} className={inputCls}>
                <option value="">Select method...</option>
                {TRANSIT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Provider Reference</label>
              <input value={transitProvider} onChange={e => setTransitProvider(e.target.value)} placeholder="Account / booking reference" className={inputCls}/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Tracking Number</label>
              <input value={trackingNo} onChange={e => setTrackingNo(e.target.value)} placeholder="e.g. TRK-12345678" className={inputCls}/>
            </div>
            <FormDateInput label="Expected Arrival" id="arrival-date" value={arrivalDate} onChange={setArrivalDate}/>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Vehicle Info</label>
              <input value={vehicleInfo} onChange={e => setVehicleInfo(e.target.value)} placeholder="e.g. Truck T-254A" className={inputCls}/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Driver Info</label>
              <input value={driverInfo} onChange={e => setDriverInfo(e.target.value)} placeholder="Driver name & contact" className={inputCls}/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Logistics Notes</label>
            <textarea rows={2} value={logisticsNotes} onChange={e => setLogisticsNotes(e.target.value)} placeholder="Special handling, route notes..." className={inputCls + ' resize-none'}/>
          </div>
        </div>
      )}

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Transfer Items
            {srcId && loadingStock && <span className="ml-2 text-brand-500 font-normal normal-case">Loading stock...</span>}
            {srcId && !loadingStock && Object.keys(stockMap).length === 0 && <span className="ml-2 text-orange-500 font-normal normal-case">No stock in source store</span>}
          </p>
          <button type="button" onClick={addItem} className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add Item
          </button>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-12 gap-2 mb-1 text-[10px] font-medium text-gray-400 uppercase px-1">
          <span className="col-span-4">Product</span>
          <span className="col-span-2 text-right">Available</span>
          <span className="col-span-2">Qty to Transfer</span>
          <span className="col-span-2 text-right">Remaining</span>
          <span className="col-span-1">Unit</span>
          <span className="col-span-1"/>
        </div>

        <div className="space-y-2">
          {items.map(item => {
            const v = itemValidation[item._key];
            const stock = item.product_id ? stockMap[Number(item.product_id)] : null;
            const hasError = !!v?.error;
            const qty = parseFloat(item.quantity) || 0;
            return (
              <div key={item._key} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg ${hasError ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20' : 'bg-gray-50 dark:bg-gray-800/30 border border-transparent'}`}>
                {/* Product dropdown */}
                <div className="col-span-4">
                  <select value={item.product_id} onChange={e => setItem(item._key, 'product_id', e.target.value)}
                    className={`w-full rounded-lg border ${hasError ? 'border-red-300 dark:border-red-500/40' : 'border-gray-300 dark:border-gray-700'} bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-brand-400`}>
                    <option value="">Select product...</option>
                    {(srcId ? sourceProducts : products).map(p => (
                      <option key={p.product_id} value={p.product_id}>{p.product_name}{p.sku_barcode ? ` [${p.sku_barcode}]` : ''}</option>
                    ))}
                  </select>
                  {v?.error && <p className="text-[10px] text-red-500 mt-0.5 ml-1">{v.error}</p>}
                </div>

                {/* Available stock */}
                <div className="col-span-2 text-right">
                  {item.product_id && (
                    <span className={`text-xs font-semibold ${v?.available > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {v?.available ?? 0}
                    </span>
                  )}
                </div>

                {/* Qty input */}
                <div className="col-span-2">
                  <input type="number" min="0.0001" step="any" value={item.quantity}
                    onChange={e => setItem(item._key, 'quantity', e.target.value)}
                    className={`w-full rounded-lg border ${hasError && qty > 0 ? 'border-red-300 dark:border-red-500/40' : 'border-gray-300 dark:border-gray-700'} bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-brand-400`}
                    placeholder="0"/>
                </div>

                {/* Remaining balance */}
                <div className="col-span-2 text-right">
                  {item.product_id && qty > 0 && v && (
                    <span className={`text-xs font-medium ${v.remaining >= 0 ? 'text-gray-600 dark:text-gray-400' : 'text-red-500 font-bold'}`}>
                      {v.remaining >= 0 ? v.remaining : `−${Math.abs(v.remaining)}`}
                    </span>
                  )}
                </div>

                {/* Unit */}
                <div className="col-span-1 text-xs text-gray-400 text-center">
                  {stock?.unit_type ?? '—'}
                </div>

                {/* Remove */}
                <div className="col-span-1 flex justify-center">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(item._key)} className="text-red-400 hover:text-red-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals summary */}
        {validItems.length > 0 && (
          <div className="mt-2 flex justify-end text-xs text-gray-400">
            {validItems.length} product{validItems.length !== 1 ? 's' : ''} — total qty: {validItems.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0).toLocaleString()}
          </div>
        )}
      </div>

      <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="General transfer notes..." className={inputCls + ' resize-none'}/>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
        <button type="submit" disabled={saving || hasErrors}
          className="px-5 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
          {saving ? 'Saving...' : isEdit ? 'Update Transfer' : 'Create Transfer'}
        </button>
      </div>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TransfersPage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const canManage = ['admin','manager'].includes(user?.role ?? '');

  const [data,     setData]     = useState<any>(null);
  const [stores,          setStores]          = useState<any[]>([]);
  const [products,        setProducts]        = useState<any[]>([]);
  const [logisticsCompanies, setLogisticsCompanies] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [statusF,  setStatusF]  = useState('');
  const [page,     setPage]     = useState(1);
  const [modal,    setModal]    = useState<'create'|'edit'|null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [acting,   setActing]   = useState<number|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await transfersApi.list({ page, limit:15, search:search||undefined, status:statusF||undefined });
      setData(res.data);
    } finally { setLoading(false); }
  }, [page, search, statusF]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([
      storesApi.list({ limit:100, status:'active' }),
      productsApi.list({ limit:500, status:'active' }),
      logisticsApi.listCompanies({ limit:100, status:'active' }),
    ]).then(([s, p, lc]) => { setStores(s.data.results); setProducts(p.data.results); setLogisticsCompanies(lc.data.results); }).catch(()=>{});
  }, []);

  const action = async (id: number, fn: ()=>Promise<any>, label: string) => {
    setActing(id);
    try { await fn(); toast.success(`Transfer ${label}`); load(); }
    catch (err: any) { toast.error('Failed', err?.response?.data?.message); }
    finally { setActing(null); }
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';

  const openEdit = async (t: any) => {
    try {
      const res = await transfersApi.get(t.transfer_id);
      setSelected(res.data); setModal('edit');
    } catch { toast.error('Failed', 'Could not load transfer'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Stock Transfers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{data?.totalResults ?? 0} transfers</p>
        </div>
        {canManage && (
          <button onClick={() => { setSelected(null); setModal('create'); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New Transfer
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search transfer number, stores..."
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400"/>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_STYLES).map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {['Transfer #','From','To','Date','Inspection','Transit','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? Array.from({length:4}).map((_,i) => (
                <tr key={i} className="animate-pulse">{Array.from({length:8}).map((_,j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded"/></td>)}</tr>
              )) : data?.results.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No transfers found</td></tr>
              ) : data?.results.map((t: any) => (
                <tr key={t.transfer_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">{t.transfer_number}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{t.source_store_name}</p>
                    {t.source_region && <p className="text-xs text-gray-400">{t.source_region}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{t.destination_store_name}</p>
                    {t.destination_region && <p className="text-xs text-gray-400">{t.destination_region}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(t.transfer_date)}</td>
                  <td className="px-4 py-3">
                    {t.requires_inspection
                      ? <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400">Required</span>
                      : <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">No</span>}
                  </td>
                  <td className="px-4 py-3">
                    {t.requires_transit
                      ? <div><span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">{t.transit_method ?? 'Yes'}</span></div>
                      : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_STYLES[t.status]}`}>
                      {t.status.replace(/_/g,' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 flex-wrap">
                      <button onClick={() => navigate(`/inventory/transfers/${t.transfer_id}`)} className="px-2.5 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-md">View</button>
                      {canManage && t.status === 'draft' && (
                        <>
                          <button onClick={() => openEdit(t)} className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">Edit</button>
                          <button onClick={() => action(t.transfer_id, () => transfersApi.approve(t.transfer_id), 'approved')} disabled={acting===t.transfer_id}
                            className="px-2.5 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50">Approve</button>
                        </>
                      )}
                      {canManage && t.status === 'approved' && (
                        <button onClick={() => action(t.transfer_id, () => transfersApi.dispatch(t.transfer_id), 'dispatched')} disabled={acting===t.transfer_id}
                          className="px-2.5 py-1 text-xs bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50">Dispatch</button>
                      )}
                      {canManage && t.status === 'dispatched' && !t.requires_inspection && (
                        <button onClick={() => action(t.transfer_id, () => transfersApi.receive(t.transfer_id), 'received')} disabled={acting===t.transfer_id}
                          className="px-2.5 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50">Receive</button>
                      )}
                      {!['cancelled','closed','received'].includes(t.status) && canManage && (
                        <button onClick={() => action(t.transfer_id, () => transfersApi.cancel(t.transfer_id), 'cancelled')} disabled={acting===t.transfer_id}
                          className="px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md">Cancel</button>
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

      <Modal isOpen={modal==='create'} onClose={() => setModal(null)} title="New Stock Transfer" size="xl">
        <TransferForm stores={stores} products={products} logisticsCompanies={logisticsCompanies} onSaved={load} onClose={() => setModal(null)}/>
      </Modal>
      <Modal isOpen={modal==='edit' && !!selected} onClose={() => setModal(null)} title="Edit Transfer" size="xl">
        {selected && <TransferForm key={selected.transfer_id} transfer={selected} stores={stores} products={products} logisticsCompanies={logisticsCompanies} onSaved={load} onClose={() => setModal(null)}/>}
      </Modal>
    </div>
  );
}
