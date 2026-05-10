import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { logisticsApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';
import { useAuth } from '../../store/authStore';
import Modal from '../../components/tpfcs/Modal';
import { FormDateInput } from '../../components/tpfcs/FormField';

const STATUS_STEPS = ['draft','pending_pickup','picked_up','in_transit','delayed','arrived','delivered'];
const STATUS_LABELS: Record<string,string> = {
  draft:'Draft', pending_pickup:'Pending Pickup', picked_up:'Picked Up',
  in_transit:'In Transit', delayed:'Delayed', arrived:'Arrived', delivered:'Delivered', cancelled:'Cancelled',
};
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

const EVENT_ICONS: Record<string,string> = {
  created:          'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  pickup_scheduled: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  picked_up:        'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  in_transit:       'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  arrived:          'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
  delivered:        'M5 13l4 4L19 7',
  delayed:          'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  cancelled:        'M6 18L18 6M6 6l12 12',
  note:             'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
};

function Section({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatusActionModal({ title, children, onClose }: { title:string; children:React.ReactNode; onClose:()=>void }) {
  return (
    <Modal isOpen onClose={onClose} title={title} size="sm">
      {children}
    </Modal>
  );
}

export default function LogisticsTransactionDetail() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const canManage = ['admin','manager'].includes(user?.role ?? '');

  const [txn,     setTxn]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<string|null>(null);
  const [modal,   setModal]   = useState<string|null>(null);
  const [note,    setNote]    = useState('');
  const [location,setLocation]= useState('');
  const [reason,  setReason]  = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [pickupDate, setPickupDate] = useState('');

  const load = () => logisticsApi.getTransaction(Number(id))
    .then(r => setTxn(r.data)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { if (id) load(); }, [id]);

  const act = async (label: string, fn: () => Promise<any>) => {
    setActing(label);
    try { await fn(); toast.success(`Shipment ${label}`); setModal(null); load(); }
    catch (err: any) { toast.error('Failed', err?.response?.data?.message); }
    finally { setActing(null); }
  };

  const fmtDate  = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const fmtTime  = (d?: string) => d ? new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
  const notEmpty = (v: any) => v !== null && v !== undefined && v !== '' && v !== '0';

  if (loading) return (
    <div className="animate-pulse max-w-4xl mx-auto space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl"/>)}
    </div>
  );
  if (!txn) return <p className="text-center py-20 text-gray-400">Shipment not found</p>;

  const currentStep = STATUS_STEPS.indexOf(txn.status);
  const isCancelled = txn.status === 'cancelled';
  const isDelivered = txn.status === 'delivered';
  const isDone      = isCancelled || isDelivered;

  const trackingLink = txn.tracking_url && txn.tracking_number
    ? `${txn.tracking_url}${txn.tracking_number}` : null;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/logistics/shipments" className="hover:text-brand-500">Shipments</Link>
          <span>/</span>
          <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{txn.logistics_number}</span>
        </div>
        <BackButton to="/logistics/shipments"/>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-xl font-bold font-mono text-gray-800 dark:text-white">{txn.logistics_number}</h1>
              <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[txn.status]}`}>
                {STATUS_LABELS[txn.status]}
              </span>
              {txn.source_type && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400">{txn.source_type}</span>
              )}
            </div>
            <p className="text-sm text-gray-500">{txn.logistics_company_name} · {txn.company_type}</p>
            {txn.transfer_number && (
              <Link to={`/inventory/transfers/${txn.stock_transfer_id}`}
                className="text-xs text-brand-500 hover:underline mt-0.5 block">
                Linked Transfer: {txn.transfer_number}
              </Link>
            )}
          </div>

          {canManage && !isDone && (
            <div className="flex gap-2 flex-wrap">
              {txn.status === 'draft' && (
                <button onClick={() => setModal('schedule')} className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">Schedule Pickup</button>
              )}
              {txn.status === 'pending_pickup' && (
                <button onClick={() => act('picked up', () => logisticsApi.markPickedUp(Number(id), { notes: 'Picked up', location }))} className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600">Mark Picked Up</button>
              )}
              {txn.status === 'picked_up' && (
                <button onClick={() => act('in transit', () => logisticsApi.markInTransit(Number(id), { notes: 'In transit', location }))} className="px-4 py-2 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">Mark In Transit</button>
              )}
              {['picked_up','in_transit'].includes(txn.status) && (
                <button onClick={() => setModal('delay')} className="px-4 py-2 text-sm text-red-600 border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">Mark Delayed</button>
              )}
              {['in_transit','delayed'].includes(txn.status) && (
                <button onClick={() => act('arrived', () => logisticsApi.markArrived(Number(id), { notes: 'Arrived at destination', location }))} className="px-4 py-2 text-sm bg-teal-500 text-white rounded-lg hover:bg-teal-600">Mark Arrived</button>
              )}
              {txn.status === 'arrived' && (
                <button onClick={() => setModal('deliver')} className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium">Mark Delivered</button>
              )}
              <button onClick={() => setModal('note')} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Add Note</button>
              <button onClick={() => { if (confirm('Cancel shipment?')) act('cancelled', () => logisticsApi.cancelShipment(Number(id), { reason: 'Cancelled by user' })); }}
                className="px-4 py-2 text-sm text-red-600 border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">Cancel</button>
            </div>
          )}
        </div>

        {/* Status timeline */}
        {!isCancelled && (
          <div className="flex items-start gap-0 overflow-x-auto pb-2 mt-2">
            {STATUS_STEPS.map((step, i) => {
              const done = i < currentStep;
              const current = i === currentStep;
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
        )}
      </div>

      {/* Shipment details */}
      <Section title="Shipment Details">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Logistics Company', value: txn.logistics_company_name },
            { label: 'Type',              value: txn.company_type },
            { label: 'Pickup Location',   value: txn.pickup_location },
            { label: 'Delivery Location', value: txn.delivery_location },
            { label: 'Pickup Date',       value: fmtDate(txn.pickup_date) },
            { label: 'Expected Delivery', value: fmtDate(txn.expected_delivery_date) },
            { label: 'Actual Delivery',   value: fmtDate(txn.actual_delivery_date) },
            { label: 'Delivered By',      value: notEmpty(txn.delivered_by) ? txn.delivered_by : null },
            { label: 'Delivered At',      value: notEmpty(txn.delivered_at) ? fmtTime(txn.delivered_at) : null },
          ].filter(i => i.value !== null && i.value !== '—').map(item => (
            <div key={item.label}>
              <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
              <p className="font-medium text-gray-800 dark:text-white">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Tracking */}
        {notEmpty(txn.tracking_number) && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-400 mb-1.5">Tracking</p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg text-gray-800 dark:text-white">{txn.tracking_number}</span>
              {notEmpty(txn.external_reference_number) && (
                <span className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg text-gray-500">{txn.external_reference_number}</span>
              )}
              {trackingLink && (
                <a href={trackingLink} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-brand-500 hover:text-brand-600 hover:underline">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                  Track on {txn.logistics_company_name}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Vehicle / Driver */}
        {(notEmpty(txn.vehicle_information) || notEmpty(txn.driver_information)) && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-4">
            {notEmpty(txn.vehicle_information) && <div><p className="text-xs text-gray-400 mb-0.5">Vehicle</p><p className="text-sm text-gray-700 dark:text-gray-300">{txn.vehicle_information}</p></div>}
            {notEmpty(txn.driver_information)  && <div><p className="text-xs text-gray-400 mb-0.5">Driver</p><p className="text-sm text-gray-700 dark:text-gray-300">{txn.driver_information}</p></div>}
          </div>
        )}

        {/* Cost section */}
        {(notEmpty(txn.shipment_cost) || notEmpty(txn.payment_status)) && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Shipment Cost</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {notEmpty(txn.shipment_cost) && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Cost</p>
                  <p className="font-bold text-gray-800 dark:text-white">
                    {Number(txn.shipment_cost).toLocaleString()} {txn.currency_code}
                  </p>
                </div>
              )}
              {txn.currency_code !== 'TZS' && notEmpty(txn.base_cost_tzs) && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Cost (TZS)</p>
                  <p className="font-bold text-gray-800 dark:text-white">TZS {Number(txn.base_cost_tzs).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">@ {txn.exchange_rate} rate</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Payment Status</p>
                <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                  txn.payment_status === 'paid'           ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                  txn.payment_status === 'partially_paid' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                  txn.payment_status === 'cancelled'      ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>{txn.payment_status?.replace(/_/g,' ') || 'Pending'}</span>
              </div>
              {notEmpty(txn.payment_reference) && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Payment Ref</p>
                  <p className="font-mono text-sm text-gray-700 dark:text-gray-300">{txn.payment_reference}</p>
                </div>
              )}
            </div>
            {notEmpty(txn.expense_notes) && (
              <p className="text-xs text-gray-400 mt-2">{txn.expense_notes}</p>
            )}
          </div>
        )}

        {notEmpty(txn.shipment_description) && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800"><p className="text-xs text-gray-400 mb-1">Description</p><p className="text-sm text-gray-600 dark:text-gray-400">{txn.shipment_description}</p></div>
        )}
        {notEmpty(txn.transit_notes) && (
          <div className="mt-3"><p className="text-xs text-gray-400 mb-1">Transit Notes</p><p className="text-sm text-gray-600 dark:text-gray-400">{txn.transit_notes}</p></div>
        )}
      </Section>

      {/* Timeline */}
      <Section title={`Timeline (${txn.events?.length ?? 0} events)`}>
        {!txn.events?.length ? (
          <p className="text-sm text-gray-400">No events yet</p>
        ) : (
          <div className="space-y-0">
            {txn.events.map((ev: any, idx: number) => {
              const icon = EVENT_ICONS[ev.event_type] ?? EVENT_ICONS.note;
              const isLast = idx === txn.events.length - 1;
              return (
                <div key={ev.event_id} className="flex gap-3">
                  {/* Icon + line */}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      ev.event_type === 'delivered'  ? 'bg-green-100 dark:bg-green-500/20' :
                      ev.event_type === 'delayed'    ? 'bg-red-100 dark:bg-red-500/20' :
                      ev.event_type === 'cancelled'  ? 'bg-gray-100 dark:bg-gray-800' :
                      ev.event_type === 'created'    ? 'bg-brand-100 dark:bg-brand-500/20' :
                      'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      <svg className={`w-4 h-4 ${
                        ev.event_type === 'delivered' ? 'text-green-600 dark:text-green-400' :
                        ev.event_type === 'delayed'   ? 'text-red-500' :
                        ev.event_type === 'created'   ? 'text-brand-600 dark:text-brand-400' :
                        'text-gray-500 dark:text-gray-400'
                      }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={icon}/>
                      </svg>
                    </div>
                    {!isLast && <div className="w-0.5 flex-1 bg-gray-100 dark:bg-gray-800 my-1"/>}
                  </div>
                  {/* Content */}
                  <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{ev.event_description}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{fmtTime(ev.event_time)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400">{ev.created_by_name}</span>
                      {ev.event_location && <span className="text-xs text-gray-400">· 📍 {ev.event_location}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Modals ── */}
      {modal === 'schedule' && (
        <StatusActionModal title="Schedule Pickup" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <FormDateInput label="Pickup Date" id="sched-pickup" value={pickupDate} onChange={setPickupDate}/>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Location</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Pickup location" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:border-brand-400"/>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
              <button onClick={() => act('pickup scheduled', () => logisticsApi.schedulePickup(Number(id), { pickup_date: pickupDate, location, notes: 'Pickup scheduled' }))} disabled={!!acting}
                className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50">Confirm</button>
            </div>
          </div>
        </StatusActionModal>
      )}
      {modal === 'delay' && (
        <StatusActionModal title="Mark Delayed" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Reason <span className="text-red-500">*</span></label>
              <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain the delay..." className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:border-brand-400 resize-none"/>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
              <button onClick={() => act('delayed', () => logisticsApi.markDelayed(Number(id), { reason, location }))} disabled={!!acting || !reason.trim()}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">Confirm</button>
            </div>
          </div>
        </StatusActionModal>
      )}
      {modal === 'deliver' && (
        <StatusActionModal title="Confirm Delivery" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Received By</label>
              <input value={deliveredBy} onChange={e => setDeliveredBy(e.target.value)} placeholder="Person who received the shipment" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:border-brand-400"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Delivery Notes</label>
              <textarea rows={2} value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} placeholder="Any notes about the delivery..." className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:border-brand-400 resize-none"/>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
              <button onClick={() => act('delivered', () => logisticsApi.markDelivered(Number(id), { delivered_by: deliveredBy, delivery_notes: deliveryNotes, location }))} disabled={!!acting}
                className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium disabled:opacity-50">Confirm Delivery</button>
            </div>
          </div>
        </StatusActionModal>
      )}
      {modal === 'note' && (
        <StatusActionModal title="Add Note" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Note <span className="text-red-500">*</span></label>
              <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Enter note or update..." className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:border-brand-400 resize-none"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Location (optional)</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Current location" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-white focus:outline-none focus:border-brand-400"/>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
              <button onClick={() => act('noted', () => logisticsApi.addNote(Number(id), note, location))} disabled={!!acting || !note.trim()}
                className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">Save Note</button>
            </div>
          </div>
        </StatusActionModal>
      )}
    </div>
  );
}

