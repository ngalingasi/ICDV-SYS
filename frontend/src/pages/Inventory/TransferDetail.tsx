import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { transfersApi, logisticsApi } from '../../api';
import Modal from '../../components/tpfcs/Modal';
import { FormDateInput } from '../../components/tpfcs/FormField';
import BackButton from '../../components/tpfcs/BackButton';
import { useAuth } from '../../store/authStore';
import { toast } from '../../components/tpfcs/Toast';

const STATUS_STEPS = ['draft','approved','dispatched','under_inspection','inspection_approved','received','closed'];
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

const STATUS_GUIDE: Record<string, { desc: string; next?: any }> = {
  draft:               { desc: 'Transfer created, awaiting approval',         next: 'Approve to proceed' },
  approved:            { desc: 'Approved, ready to dispatch',                 next: 'Dispatch to deduct stock from source store' },
  dispatched:          { desc: 'Stock deducted from source, in transit',      next: (req: boolean) => req ? 'Create Inspection Request at destination' : 'Mark Received directly' },
  under_inspection:    { desc: 'Inspection in progress at destination',       next: 'Complete inspection and submit for approval' },
  inspection_approved: { desc: 'Inspection approved, stock being added',      next: 'System auto-adds stock to destination store' },
  received:            { desc: 'Stock received at destination store',         next: 'Close transfer to finalise' },
  closed:              { desc: 'Transfer completed and closed' },
  cancelled:           { desc: 'Transfer cancelled' },
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

const CURRENCIES = ['TZS','USD','EUR','GBP','KES','CNY','AED','INR'];

export default function TransferDetail() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const canManage = ['admin','manager'].includes(user?.role ?? '');

  const [transfer,       setTransfer]       = useState<any>(null);
  const [loading,        setLoading]        = useState(true);
  const [acting,         setActing]         = useState<string|null>(null);
  const [hasInspection,  setHasInspection]  = useState(false);
  const [shipments,      setShipments]      = useState<any[]>([]);
  const [logCos,         setLogCos]         = useState<any[]>([]);
  // Create shipment modal state
  const [showShipmentModal,   setShowShipmentModal]   = useState(false);
  const [shipLogCoId,         setShipLogCoId]         = useState('');
  const [shipCost,            setShipCost]            = useState('');
  const [shipCurrency,        setShipCurrency]        = useState('TZS');
  const [shipRate,            setShipRate]            = useState('1');
  const [shipPayStatus,       setShipPayStatus]       = useState('pending');
  const [shipPayRef,          setShipPayRef]          = useState('');
  const [shipNotes,           setShipNotes]           = useState('');
  const [creatingShipment,    setCreatingShipment]    = useState(false);

  const load = () => {
    transfersApi.get(Number(id)).then(r => {
      setTransfer(r.data);
      // Auto-select logistics company from transfer
      if (r.data.logistics_company_id) setShipLogCoId(r.data.logistics_company_id.toString());
    }).catch(() => {}).finally(() => setLoading(false));
    logisticsApi.listTransactions({ stock_transfer_id: Number(id), limit: 50 })
      .then(ls => setShipments(ls.data.results ?? [])).catch(() => {});
    import('../../api').then(m =>
      m.inspectionApi.listRequests({ limit: 1, source_type: 'TRANSFER', source_id: Number(id) })
        .then((ir: any) => setHasInspection((ir.data.totalResults ?? 0) > 0))
        .catch(() => {})
    );
  };

  useEffect(() => { if (id) load(); }, [id]);
  useEffect(() => {
    logisticsApi.listCompanies({ limit: 100, status: 'active' })
      .then(r => setLogCos(r.data.results)).catch(() => {});
  }, []);

  const action = async (label: string, fn: () => Promise<any>, confirm_msg?: string) => {
    if (confirm_msg && !confirm(confirm_msg)) return;
    setActing(label);
    try { await fn(); toast.success(`Transfer ${label}`); load(); }
    catch (err: any) { toast.error('Failed', err?.response?.data?.message); }
    finally { setActing(null); }
  };

  const handleCreateShipment = async () => {
    if (!shipLogCoId) { toast.error('Required', 'Select a logistics provider'); return; }
    setCreatingShipment(true);
    try {
      const baseTzs = shipCost ? Number(shipCost) * (Number(shipRate) || 1) : null;
      await (transfersApi as any).createShipment(Number(id), {
        logistics_company_id:  Number(shipLogCoId),
        shipment_cost:         shipCost    ? Number(shipCost)   : null,
        currency_code:         shipCurrency,
        exchange_rate:         Number(shipRate) || 1,
        base_cost_tzs:         baseTzs,
        payment_status:        shipPayStatus,
        payment_reference:     shipPayRef  || null,
        expense_notes:         shipNotes   || null,
      });
      toast.success('Shipment created');
      setShowShipmentModal(false);
      setShipCost(''); setShipNotes(''); setShipPayRef('');
      load();
    } catch (err: any) { toast.error('Failed', err?.response?.data?.message); }
    finally { setCreatingShipment(false); }
  };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const fmtQty  = (n: any) => Number(n||0).toLocaleString(undefined,{maximumFractionDigits:4});
  const notEmpty = (v: any) => v !== null && v !== undefined && v !== '' && v !== '0' && v !== '0000-00-00';

  if (loading) return (
    <div className="animate-pulse max-w-4xl mx-auto space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl"/>)}
    </div>
  );
  if (!transfer) return <p className="text-center py-20 text-gray-400">Transfer not found</p>;

  const currentStep = STATUS_STEPS.indexOf(transfer.status);
  const guide = STATUS_GUIDE[transfer.status];
  const nextAction = typeof guide?.next === 'function'
    ? guide.next(Number(transfer.requires_inspection) === 1)
    : guide?.next;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/inventory/transfers" className="hover:text-brand-500">Transfers</Link>
          <span>/</span>
          <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{transfer.transfer_number}</span>
        </div>
        <BackButton to="/inventory/transfers"/>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold font-mono text-gray-800 dark:text-white">{transfer.transfer_number}</h1>
              <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_STYLES[transfer.status] ?? ''}`}>
                {transfer.status.replace(/_/g,' ')}
              </span>
            </div>
            <p className="text-sm text-gray-500">Created by {transfer.created_by_name} · {fmtDate(transfer.created_at)}</p>
            {guide && (
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <span className="text-gray-400">{guide.desc}</span>
                {nextAction && <>
                  <span className="text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-brand-600 dark:text-brand-400 font-medium">Next: {nextAction}</span>
                </>}
              </div>
            )}
          </div>

          {canManage && (
            <div className="flex gap-2 flex-wrap">
              {transfer.status === 'draft' && (
                <>
                  <button onClick={() => navigate(`/inventory/transfers/${id}/edit`)}
                    className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Edit</button>
                  <button onClick={() => action('approved', () => transfersApi.approve(Number(id)))} disabled={!!acting}
                    className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">Approve</button>
                </>
              )}
              {transfer.status === 'approved' && (
                <button onClick={() => action('dispatched', () => (transfersApi as any).dispatch(Number(id)), 'Dispatch? This will deduct stock from the source store.')} disabled={!!acting}
                  className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
                  {acting === 'dispatched' ? 'Dispatching...' : 'Dispatch'}
                </button>
              )}
              {transfer.status === 'dispatched' && Number(transfer.requires_inspection) === 1 && !hasInspection && (
                <button onClick={() => navigate(`/inspection/requests/new?source_type=TRANSFER&source_id=${id}`)}
                  className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                  Create Inspection
                </button>
              )}
              {transfer.status === 'dispatched' && !Number(transfer.requires_inspection) && (
                <button onClick={() => action('received', () => (transfersApi as any).receive(Number(id)), 'Mark as received? Stock will be added to destination store.')} disabled={!!acting}
                  className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50">
                  {acting === 'received' ? 'Processing...' : 'Mark Received'}
                </button>
              )}
              {Number(transfer.requires_transit) === 1 && !['cancelled','closed'].includes(transfer.status) && (
                shipments.length > 0 ? (
                  <div className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                    Shipment Created
                  </div>
                ) : (
                  <button onClick={() => setShowShipmentModal(true)}
                    className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                    Create Shipment
                  </button>
                )
              )}
              {transfer.status === 'received' && (
                <button onClick={() => action('closed', () => (transfersApi as any).close(Number(id)), 'Close this transfer? This is final.')} disabled={!!acting}
                  className="px-4 py-2 text-sm bg-gray-700 text-white dark:bg-gray-600 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  Close Transfer
                </button>
              )}
              {!['cancelled','closed','received'].includes(transfer.status) && (
                <button onClick={() => action('cancelled', () => (transfersApi as any).cancel(Number(id)), 'Cancel this transfer?')} disabled={!!acting}
                  className="px-4 py-2 text-sm text-red-600 border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50">Cancel</button>
              )}
            </div>
          )}
        </div>

        {/* Status timeline */}
        <div className="flex items-start gap-0 overflow-x-auto pb-2 mt-2">
          {STATUS_STEPS.map((step, i) => {
            const done = i < currentStep; const current = i === currentStep;
            return (
              <div key={step} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${done ? 'bg-green-500 border-green-500 text-white' : current ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-400'}`}>
                    {done ? '✓' : i+1}
                  </div>
                  <span className={`text-[9px] mt-1 text-center capitalize leading-tight ${current ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-gray-400'}`}>
                    {step.replace(/_/g,' ')}
                  </span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`h-0.5 w-8 flex-shrink-0 mx-0.5 mb-4 ${done ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`}/>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Store cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            From (Source)
          </p>
          <p className="text-base font-bold text-gray-800 dark:text-white">{transfer.source_store_name}</p>
          {transfer.source_region && <p className="text-xs text-gray-400 mt-0.5">{transfer.source_region}</p>}
          {transfer.dispatched_at && <p className="text-xs text-gray-400 mt-1">Dispatched: {fmtDate(transfer.dispatched_at)}</p>}
        </div>
        <div className="rounded-xl border border-brand-200 dark:border-brand-500/30 bg-brand-50/20 dark:bg-brand-500/5 p-5">
          <p className="text-xs text-brand-500 mb-1 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            To (Destination)
          </p>
          <p className="text-base font-bold text-gray-800 dark:text-white">{transfer.destination_store_name}</p>
          {transfer.destination_region && <p className="text-xs text-gray-400 mt-0.5">{transfer.destination_region}</p>}
          {transfer.received_at && <p className="text-xs text-green-600 dark:text-green-400 mt-1">Received: {fmtDate(transfer.received_at)}</p>}
        </div>
      </div>

      {/* Transfer items */}
      <Section title={`Transfer Items (${transfer.items?.length ?? 0})`}>
        {!transfer.items?.length ? <p className="text-sm text-gray-400">No items</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                {['Product','SKU','Unit','Transfer Qty','Source Stock'].map(h =>
                  <th key={h} className="text-left pb-2 pr-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {transfer.items.map((item: any) => (
                <tr key={item.transfer_item_id}>
                  <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-white">{item.product_name}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-gray-400">{item.sku_barcode || '—'}</td>
                  <td className="py-2.5 pr-4 text-gray-500">{item.unit_type || '—'}</td>
                  <td className="py-2.5 pr-4 font-bold text-brand-600 dark:text-brand-400">{fmtQty(item.quantity)}</td>
                  <td className="py-2.5 text-gray-500">{item.current_stock != null ? fmtQty(item.current_stock) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Logistics Shipments */}
      {(shipments.length > 0 || Number(transfer.requires_transit) === 1) && (
        <Section title={`Logistics Shipments (${shipments.length})`}>
          {shipments.length === 0 ? (
            <p className="text-sm text-gray-400">
              No shipments created yet.
              {Number(transfer.requires_transit) === 1 && !['cancelled','closed'].includes(transfer.status) && (
                <button onClick={() => setShowShipmentModal(true)} className="ml-2 text-brand-500 hover:underline">Create one now</button>
              )}
            </p>
          ) : (
            <div className="space-y-2">
              {shipments.map((sh: any) => (
                <div key={sh.logistics_transaction_id}
                  onClick={() => navigate(`/logistics/shipments/${sh.logistics_transaction_id}`)}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div>
                    <p className="font-mono text-sm font-semibold text-brand-600 dark:text-brand-400">{sh.logistics_number}</p>
                    <p className="text-xs text-gray-500">{sh.logistics_company_name}</p>
                    {notEmpty(sh.tracking_number) && <p className="font-mono text-xs text-gray-400">{sh.tracking_number}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {notEmpty(sh.shipment_cost) && (
                      <span className="text-xs text-gray-500">{Number(sh.shipment_cost).toLocaleString()} {sh.currency_code}</span>
                    )}
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                      sh.status === 'delivered'  ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                      sh.status === 'in_transit' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' :
                      sh.status === 'delayed'    ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>{sh.status.replace(/_/g,' ')}</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Transit info */}
      {Number(transfer.requires_transit) === 1 && (
        <Section title="Transit / Logistics">
          {(() => {
            const fields = [
              { label: 'Provider',         value: transfer.logistics_company_name || null },
              { label: 'Method',           value: notEmpty(transfer.transit_method)           ? transfer.transit_method : null },
              { label: 'Provider Ref',     value: notEmpty(transfer.transit_provider)         ? transfer.transit_provider : null },
              { label: 'Tracking #',       value: notEmpty(transfer.tracking_number)          ? transfer.tracking_number : null },
              { label: 'Expected Arrival', value: notEmpty(transfer.expected_arrival_date)    ? fmtDate(transfer.expected_arrival_date) : null },
              { label: 'Vehicle',          value: notEmpty(transfer.vehicle_information)      ? transfer.vehicle_information : null },
              { label: 'Driver',           value: notEmpty(transfer.driver_information)       ? transfer.driver_information : null },
            ].filter(f => f.value !== null);
            return fields.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {fields.map(item => (
                  <div key={item.label}>
                    <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                    <p className="font-medium text-gray-800 dark:text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">No logistics details provided</p>;
          })()}
          {notEmpty(transfer.logistics_notes) && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-400 mb-1">Logistics Notes</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{transfer.logistics_notes}</p>
            </div>
          )}
        </Section>
      )}

      {/* Notes */}
      {notEmpty(transfer.notes) && (
        <Section title="Notes">
          <p className="text-sm text-gray-600 dark:text-gray-400">{transfer.notes}</p>
        </Section>
      )}

      {/* Create Shipment Modal */}
      <Modal isOpen={showShipmentModal} onClose={() => setShowShipmentModal(false)} title="Create Logistics Shipment" size="md">
        <div className="space-y-4">
          {/* Provider */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Provider / Carrier <span className="text-red-500">*</span>
            </label>
            {logCos.length === 0 ? (
              <p className="text-sm text-orange-500">No logistics companies found. <a href="/logistics/companies" className="underline">Add one first</a>.</p>
            ) : (
              <>
                <select value={shipLogCoId} onChange={e => setShipLogCoId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm dark:text-white focus:outline-none focus:border-brand-400">
                  <option value="">— Select provider —</option>
                  {logCos.map((lc: any) => (
                    <option key={lc.logistics_company_id} value={lc.logistics_company_id}>{lc.company_name} ({lc.company_type})</option>
                  ))}
                </select>
                {shipLogCoId && (() => {
                  const selected = logCos.find((lc: any) => lc.logistics_company_id === Number(shipLogCoId));
                  return selected ? (
                    <div className="mt-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-3 py-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <div>
                        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{selected.company_name}</p>
                        <p className="text-[10px] text-indigo-500 dark:text-indigo-400">{selected.company_type}{selected.city ? ` · ${selected.city}` : ''}</p>
                      </div>
                    </div>
                  ) : null;
                })()}
              </>
            )}
          </div>

          {/* Cost */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Currency</label>
              <select value={shipCurrency} onChange={e => setShipCurrency(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm dark:text-white focus:outline-none focus:border-brand-400">
                {CURRENCIES.map(cur => <option key={cur} value={cur}>{cur}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Shipment Cost</label>
              <input type="number" min="0" step="any" value={shipCost} onChange={e => setShipCost(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm dark:text-white focus:outline-none focus:border-brand-400"/>
            </div>
          </div>

          {shipCurrency !== 'TZS' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Exchange Rate (1 {shipCurrency} = ? TZS)
              </label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="any" value={shipRate} onChange={e => setShipRate(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm dark:text-white focus:outline-none focus:border-brand-400"/>
                {shipCost && <span className="text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">
                  = TZS {(Number(shipCost) * (Number(shipRate) || 1)).toLocaleString()}
                </span>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Payment Status</label>
              <select value={shipPayStatus} onChange={e => setShipPayStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm dark:text-white focus:outline-none focus:border-brand-400">
                <option value="pending">Pending</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Payment Reference</label>
              <input value={shipPayRef} onChange={e => setShipPayRef(e.target.value)} placeholder="Receipt / invoice #"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm dark:text-white focus:outline-none focus:border-brand-400"/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Notes</label>
            <textarea rows={2} value={shipNotes} onChange={e => setShipNotes(e.target.value)}
              placeholder="Cost breakdown, payment terms..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm dark:text-white focus:outline-none focus:border-brand-400 resize-none"/>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setShowShipmentModal(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
            <button onClick={handleCreateShipment} disabled={creatingShipment || !shipLogCoId}
              className="px-5 py-2 text-sm font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50">
              {creatingShipment ? 'Creating...' : 'Create Shipment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
