import { useEffect, useState, useCallback } from 'react';
import { fuelApi } from '../../api';
import { useAuth } from '../../store/authStore';
import { toast } from '../../components/tpfcs/Toast';
import Modal from '../../components/tpfcs/Modal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockRow { fuel_type: string; total_ordered: number; total_dispensed: number; current_stock: number; }
interface FuelOrder {
  order_id: number; manifest_id: number; fuel_type: string;
  ordered_litres: number; status: 'pending' | 'approved' | 'rejected';
  notes?: string; review_notes?: string;
  ordered_by_name?: string; reviewed_by_name?: string;
  created_at: string; reviewed_at?: string;
}
interface FuelRecord {
  fuel_record_id: number; fuel_type: string; litres_dispensed: number;
  chassis_number: string; brand?: string; model?: string;
  dispensed_by_name?: string; dispensed_at: string; notes?: string;
}
interface DashboardData {
  manifest: { manifest_id: number; manifest_number: string; icdv_name?: string; arrival_date?: string };
  stock: { diesel?: StockRow; petrol?: StockRow };
  order_summary: { pending: number; approved: number; rejected: number; total_orders: number };
  orders: FuelOrder[];
  records: FuelRecord[];
  vehicle_stats: { total_vehicles: number; fuelled_vehicles: number; unfuelled_vehicles: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
}
function fmtNum(n: any) { return parseFloat(String(n ?? 0)).toFixed(1); }

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  approved: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20',
  rejected: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
};

// ─── New Order Form ───────────────────────────────────────────────────────────

function NewOrderForm({ manifestId, onCreated }: { manifestId: number; onCreated: () => void }) {
  const [open,     setOpen]     = useState(false);
  const [fuelType, setFuelType] = useState<'diesel' | 'petrol'>('diesel');
  const [litres,   setLitres]   = useState('');
  const [notes,    setNotes]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const close = () => { setOpen(false); setError(''); setLitres(''); setNotes(''); };

  const submit = async () => {
    const l = parseFloat(litres);
    if (!l || l <= 0) { setError('Enter a valid litre amount'); return; }
    setLoading(true); setError('');
    try {
      await fuelApi.createOrder(manifestId, { fuel_type: fuelType, ordered_litres: l, notes: notes || undefined });
      toast.success('Fuel order created — awaiting approval');
      close();
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to create order');
    } finally { setLoading(false); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors">
        + New Fuel Order
      </button>

      <Modal isOpen={open} onClose={close} title="New Fuel Order" size="sm">
        <div className="space-y-4">
          {/* Fuel type toggle */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Fuel type</p>
            <div className="flex gap-2">
              {(['diesel', 'petrol'] as const).map(t => (
                <button key={t} onClick={() => setFuelType(t)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors
                    ${fuelType === t
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-brand-300 dark:hover:border-brand-600'}`}>
                  {t === 'diesel' ? 'Diesel' : 'Petrol'}
                </button>
              ))}
            </div>
          </div>

          {/* Litres */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
              Litres requested
            </label>
            <input
              type="number" step="0.1" min="1"
              value={litres} onChange={e => setLitres(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="e.g. 500"
              autoFocus
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
              Notes <span className="font-normal">(optional)</span>
            </label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="e.g. urgent, for TPA batch 3"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={close}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button onClick={submit} disabled={loading || !litres}
              className="flex-[2] py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-50 transition-colors">
              {loading ? 'Submitting…' : 'Submit Order'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ─── Approve / Reject row actions ─────────────────────────────────────────────

function OrderRow({ order, manifestId, canApprove, onRefresh }: { order: FuelOrder; manifestId: number; canApprove: boolean; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState<'approve' | 'reject' | null>(null);

  const act = async (action: 'approve' | 'reject') => {
    setLoading(true);
    try {
      if (action === 'approve') await fuelApi.approveOrder(manifestId, order.order_id, note || undefined);
      else                       await fuelApi.rejectOrder(manifestId, order.order_id, note || undefined);
      toast.success(`Order ${action}d`);
      setShowNote(null); setNote('');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? `Failed to ${action}`);
    } finally { setLoading(false); }
  };

  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm capitalize">{order.fuel_type}</span>
          <span className="font-bold text-sm text-gray-800 dark:text-white">{fmtNum(order.ordered_litres)}L</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[order.status]}`}>{order.status}</span>
        </div>
        <span className="text-xs text-gray-400">{fmtDate(order.created_at)} · {order.ordered_by_name}</span>
      </div>
      {order.notes && <p className="text-xs text-gray-500 dark:text-gray-400 italic">{order.notes}</p>}
      {order.status !== 'pending' && order.reviewed_by_name && (
        <p className="text-xs text-gray-400">Reviewed by {order.reviewed_by_name}{order.review_notes ? ` — "${order.review_notes}"` : ''}</p>
      )}
      {canApprove && order.status === 'pending' && !showNote && (
        <div className="flex gap-2 pt-1">
          <button onClick={() => setShowNote('approve')}
            className="flex-1 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors">Approve</button>
          <button onClick={() => setShowNote('reject')}
            className="flex-1 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors">Reject</button>
        </div>
      )}
      {showNote && (
        <div className="space-y-2 pt-1">
          <input value={note} onChange={e => setNote(e.target.value)} placeholder={`Optional note for ${showNote}…`}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          <div className="flex gap-2">
            <button onClick={() => { setShowNote(null); setNote(''); }}
              className="flex-1 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-500">Cancel</button>
            <button onClick={() => act(showNote)} disabled={loading}
              className={`flex-[2] py-1.5 rounded-lg text-white text-xs font-medium disabled:opacity-50 transition-colors ${showNote === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
              {loading ? '…' : `Confirm ${showNote}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stock Card ───────────────────────────────────────────────────────────────

function StockCard({ label, fuelType, stock }: { label: string; fuelType: string; stock?: StockRow }) {
  const ordered    = parseFloat(String(stock?.total_ordered   ?? 0));
  const dispensed  = parseFloat(String(stock?.total_dispensed ?? 0));
  const available  = parseFloat(String(stock?.current_stock   ?? 0));
  const pct        = ordered > 0 ? Math.min(100, (dispensed / ordered) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        {fuelType === 'diesel'
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C12 2 5 10 5 14a7 7 0 0014 0c0-4-7-12-7-12z" />
          : <><path strokeLinecap="round" strokeLinejoin="round" d="M3 6a2 2 0 012-2h8a2 2 0 012 2v12H3V6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 8h2a2 2 0 012 2v3a1 1 0 002 0v-5l-3-3" /></>
        }
      </svg>
        <p className="text-sm font-semibold text-gray-800 dark:text-white">{label}</p>
      </div>
      {!stock ? (
        <p className="text-xs text-gray-400 italic">No orders yet</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Ordered</p>
              <p className="font-bold text-sm text-gray-800 dark:text-white">{ordered.toFixed(1)}L</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Dispensed</p>
              <p className="font-bold text-sm text-gray-800 dark:text-white">{dispensed.toFixed(1)}L</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">In Stock</p>
              <p className={`font-bold text-sm ${available > 10 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {available.toFixed(1)}L
              </p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-400 text-right">{pct.toFixed(0)}% dispensed</p>
        </>
      )}
    </div>
  );
}

// ─── Print sheet ──────────────────────────────────────────────────────────────

function buildFuelPrintHTML(data: DashboardData): string {
  const { manifest, stock, records, vehicle_stats, orders } = data;

  const orderRows = orders.map((o, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9f9f9'}">
      <td>${i + 1}</td>
      <td style="text-transform:capitalize">${o.fuel_type}</td>
      <td style="text-align:right">${fmtNum(o.ordered_litres)}</td>
      <td><span style="padding:2px 8px;border-radius:10px;font-size:7.5pt;background:${o.status === 'approved' ? '#dcfce7' : o.status === 'rejected' ? '#fee2e2' : '#fef9c3'};color:${o.status === 'approved' ? '#166534' : o.status === 'rejected' ? '#991b1b' : '#854d0e'}">${o.status}</span></td>
      <td>${o.ordered_by_name ?? '—'}</td>
      <td>${fmtDate(o.created_at)}</td>
      <td>${o.reviewed_by_name ?? '—'}</td>
      <td>${o.review_notes ?? '—'}</td>
    </tr>`).join('');

  const dispensingRows = records.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9f9f9'}">
      <td>${i + 1}</td>
      <td style="font-family:monospace">${r.chassis_number}</td>
      <td>${r.brand ?? ''} ${r.model ?? ''}</td>
      <td style="text-transform:capitalize">${r.fuel_type}</td>
      <td style="text-align:right;font-weight:700">${fmtNum(r.litres_dispensed)}</td>
      <td>${r.dispensed_by_name ?? '—'}</td>
      <td>${fmtDate(r.dispensed_at)}</td>
      <td>${r.notes ?? '—'}</td>
    </tr>`).join('');

  const totalDiesel   = records.filter(r => r.fuel_type === 'diesel').reduce((s, r) => s + parseFloat(String(r.litres_dispensed)), 0);
  const totalPetrol   = records.filter(r => r.fuel_type === 'petrol').reduce((s, r) => s + parseFloat(String(r.litres_dispensed)), 0);
  const grandTotal    = totalDiesel + totalPetrol;
  const printDate     = new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Fuel Sheet — ${manifest.manifest_number}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:9pt;color:#000;background:#fff}
  .hdr{width:100%;border-collapse:collapse;border-bottom:2px solid #000;margin-bottom:6px}
  .hdr td{padding:4px 6px}
  .info{width:100%;border-collapse:collapse;border:1px solid #ccc;margin-bottom:10px;background:#f5f5f5}
  .info td{padding:5px 10px;border-right:1px solid #ccc;font-size:8.5pt;vertical-align:top}
  .info td:last-child{border-right:none}
  .lbl{font-size:7pt;text-transform:uppercase;color:#666;letter-spacing:0.5px;display:block;margin-bottom:1px}
  .stock-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
  .stock-box{border:1px solid #ccc;padding:8px 12px;border-radius:4px}
  .stock-box h4{font-size:8pt;font-weight:700;text-transform:uppercase;margin-bottom:6px;color:#444}
  .stock-row{display:flex;justify-content:space-between;font-size:8pt;margin-bottom:2px}
  .stock-row .val{font-weight:700}
  .tbl{width:100%;border-collapse:collapse;border:1px solid #999;margin-bottom:12px}
  .tbl thead tr{background:#333;color:#fff}
  .tbl th{padding:5px 7px;text-align:left;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.4px;border-right:1px solid #555}
  .tbl th:last-child{border-right:none}
  .tbl td{padding:4px 7px;font-size:8.5pt;border-bottom:1px solid #ddd;border-right:1px solid #ddd;vertical-align:top}
  .tbl td:last-child{border-right:none}
  .tbl tbody tr:last-child td{border-bottom:none}
  .tbl tfoot tr{background:#e8e8e8;font-weight:700;border-top:2px solid #333}
  .tbl tfoot td{padding:5px 7px;font-size:8.5pt}
  .sec-title{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:10px 0 5px;border-bottom:1px solid #ccc;padding-bottom:3px}
  .footer{display:flex;justify-content:space-between;font-size:7.5pt;color:#666;border-top:1px solid #ccc;padding-top:4px;margin-top:4px}
  @page{size:A4 landscape;margin:10mm 12mm}
</style></head><body>
  <table class="hdr"><tr>
    <td style="width:33%"><strong>${manifest.icdv_name ?? 'ICDV'}</strong><br><span style="font-size:8pt;color:#555">Fuel Consumption Sheet</span></td>
    <td style="width:34%;text-align:center"><div style="font-size:14pt;font-weight:900;letter-spacing:1px">FUEL SHEET</div><div style="font-size:8pt;color:#555">Manifest fuel orders &amp; dispensing record</div></td>
    <td style="width:33%;text-align:right;font-size:8pt;color:#555">Manifest: <strong>${manifest.manifest_number}</strong><br>Printed: ${printDate}</td>
  </tr></table>

  <table class="info"><tr>
    <td><span class="lbl">Manifest</span><strong>${manifest.manifest_number}</strong></td>
    <td><span class="lbl">ICDV</span>${manifest.icdv_name ?? '—'}</td>
    <td><span class="lbl">Total vehicles</span><strong>${vehicle_stats.total_vehicles}</strong></td>
    <td><span class="lbl">Fuelled</span><strong>${vehicle_stats.fuelled_vehicles}</strong></td>
    <td><span class="lbl">Not fuelled</span>${vehicle_stats.unfuelled_vehicles}</td>
    <td><span class="lbl">Total dispensed</span><strong>${grandTotal.toFixed(1)}L</strong></td>
  </tr></table>

  <div class="stock-grid">
    <div class="stock-box">
      <h4>Diesel</h4>
      <div class="stock-row"><span>Ordered</span><span class="val">${fmtNum(stock?.diesel?.total_ordered ?? 0)}L</span></div>
      <div class="stock-row"><span>Dispensed</span><span class="val">${fmtNum(stock?.diesel?.total_dispensed ?? 0)}L</span></div>
      <div class="stock-row"><span>In Stock</span><span class="val">${fmtNum(stock?.diesel?.current_stock ?? 0)}L</span></div>
    </div>
    <div class="stock-box">
      <h4>Petrol</h4>
      <div class="stock-row"><span>Ordered</span><span class="val">${fmtNum(stock?.petrol?.total_ordered ?? 0)}L</span></div>
      <div class="stock-row"><span>Dispensed</span><span class="val">${fmtNum(stock?.petrol?.total_dispensed ?? 0)}L</span></div>
      <div class="stock-row"><span>In Stock</span><span class="val">${fmtNum(stock?.petrol?.current_stock ?? 0)}L</span></div>
    </div>
  </div>

  <div class="sec-title">Fuel Orders (${orders.length})</div>
  <table class="tbl">
    <thead><tr>
      <th style="width:24px">#</th><th style="width:55px">Type</th><th style="width:60px;text-align:right">Litres</th>
      <th style="width:65px">Status</th><th>Ordered by</th><th style="width:80px">Date</th>
      <th>Approved by</th><th>Review note</th>
    </tr></thead>
    <tbody>${orderRows || '<tr><td colspan="8" style="text-align:center;padding:10px;color:#888">No orders yet</td></tr>'}</tbody>
  </table>

  <div class="sec-title">Dispensing Records (${records.length} dispenses · ${grandTotal.toFixed(1)}L total)</div>
  <table class="tbl">
    <thead><tr>
      <th style="width:24px">#</th><th style="width:110px">Chassis</th><th>Vehicle</th>
      <th style="width:55px">Type</th><th style="width:55px;text-align:right">Litres</th>
      <th>Dispensed by</th><th style="width:80px">Date</th><th>Notes</th>
    </tr></thead>
    <tbody>${dispensingRows || '<tr><td colspan="8" style="text-align:center;padding:10px;color:#888">No dispensings recorded</td></tr>'}</tbody>
    <tfoot><tr>
      <td colspan="4" style="text-align:right;padding-right:10px;font-size:8pt;text-transform:uppercase;letter-spacing:0.5px">Grand Total</td>
      <td style="text-align:right">${grandTotal.toFixed(1)}L</td>
      <td colspan="3" style="font-size:8pt;color:#555">Diesel: ${totalDiesel.toFixed(1)}L · Petrol: ${totalPetrol.toFixed(1)}L</td>
    </tr></tfoot>
  </table>

  <div class="footer">
    <span>${manifest.icdv_name ?? 'ICDV'} — ${manifest.manifest_number}</span>
    <span>${grandTotal.toFixed(1)}L total dispensed across ${records.length} events</span>
    <span>CONFIDENTIAL</span>
  </div>
</body></html>`;
}

function printViaIframe(html: string) {
  const id = 'fuel-print-frame';
  const old = document.getElementById(id);
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = id;
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
  document.body.appendChild(iframe);
  iframe.contentDocument!.open();
  iframe.contentDocument!.write(html);
  iframe.contentDocument!.close();
  iframe.onload = () => { setTimeout(() => iframe.contentWindow!.print(), 300); };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ManifestFuelTab({ manifestId }: { manifestId: number }) {
  const { user } = useAuth();
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const canApprove = ['supervisor', 'admin', 'super_admin', 'system_admin'].includes(user?.role ?? '');
  const canCreate  = ['fuel_officer', 'supervisor', 'admin', 'super_admin', 'system_admin'].includes(user?.role ?? '');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fuelApi.dashboard(manifestId);
      setData(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load fuel data');
    } finally { setLoading(false); }
  }, [manifestId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="py-12 flex justify-center">
      <div className="w-7 h-7 border-2 border-gray-200 border-t-brand-500 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
        {error}
      </div>
    </div>
  );

  if (!data) return null;

  const { stock, order_summary, orders, records, vehicle_stats } = data;
  const pendingCount = order_summary.pending;

  return (
    <div className="space-y-6">

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Fuel Management</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {vehicle_stats.fuelled_vehicles}/{vehicle_stats.total_vehicles} vehicles fuelled ·{' '}
            {pendingCount > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{pendingCount} order{pendingCount > 1 ? 's' : ''} pending approval · </span>}
            {((parseFloat(String(stock?.diesel?.current_stock ?? 0)) + parseFloat(String(stock?.petrol?.current_stock ?? 0)))).toFixed(1)}L total in stock
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canCreate && <NewOrderForm manifestId={manifestId} onCreated={load} />}
          <button
            onClick={() => data && printViaIframe(buildFuelPrintHTML(data))}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print Fuel Sheet
          </button>
        </div>
      </div>

      {/* Stock cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StockCard label="Diesel" fuelType="diesel" stock={stock?.diesel} />
        <StockCard label="Petrol" fuelType="petrol" stock={stock?.petrol} />
      </div>

      {/* Orders */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Fuel Orders ({orders.length})
        </h4>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No fuel orders yet.</p>
        ) : (
          <div className="space-y-2">
            {orders.map(o => (
              <OrderRow key={o.order_id} order={o} manifestId={manifestId} canApprove={canApprove} onRefresh={load} />
            ))}
          </div>
        )}
      </div>

      {/* Dispensing records */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Dispensing Records ({records.length})
        </h4>
        {records.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No dispensings recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {['Chassis', 'Vehicle', 'Type', 'Litres', 'Dispensed by', 'Date'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {records.map(r => (
                  <tr key={r.fuel_record_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2.5 font-mono text-xs font-bold text-gray-800 dark:text-white">{r.chassis_number}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{[r.brand, r.model].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-3 py-2.5 capitalize text-xs">
                      <span className={`px-2 py-0.5 rounded-full border text-xs ${r.fuel_type === 'diesel' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' : 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20'}`}>
                        {r.fuel_type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-xs text-gray-800 dark:text-white">{fmtNum(r.litres_dispensed)}L</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{r.dispensed_by_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{fmtDate(r.dispensed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
