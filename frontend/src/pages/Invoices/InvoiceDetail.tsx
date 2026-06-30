import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { invoicesApi } from '../../api';
import { useAuth } from '../../store/authStore';
import BackButton from '../../components/tpfcs/BackButton';

const fmtDate  = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMoney = (n: any) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

const STATUS_STYLES: Record<string, string> = {
  invoiced:  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  approved:  'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  paid:      'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  cancelled: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
};

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin, isCashier } = useAuth();
  const [inv,     setInv]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState(false);
  const [error,   setError]   = useState<string|null>(null);
  const evidenceRef = useRef<HTMLInputElement>(null);
  const receiptRef  = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    invoicesApi.get(Number(id))
      .then(r => setInv(r.data))
      .catch(() => setError('Invoice not found'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const doAction = async (action: () => Promise<any>) => {
    setActing(true); setError(null);
    try { setInv((await action()).data); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Action failed'); }
    finally { setActing(false); }
  };

  const handleApprove  = () => doAction(() => invoicesApi.approve(Number(id)));
  const handleCancel   = () => {
    const reason = prompt('Cancellation reason (optional):');
    if (reason === null) return;
    doAction(() => invoicesApi.cancel(Number(id), reason));
  };
  const handleMarkPaid = () => doAction(() => invoicesApi.markPaid(Number(id)));

  const handleUploadEvidence = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('evidence', file);
    setActing(true); setError(null);
    try { await invoicesApi.uploadEvidence(Number(id), fd); load(); }
    catch (ex: any) { setError(ex?.response?.data?.message ?? 'Upload failed'); }
    finally { setActing(false); }
  };

  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('receipt', file);
    setActing(true); setError(null);
    try { await invoicesApi.uploadReceipt(Number(id), fd); load(); }
    catch (ex: any) { setError(ex?.response?.data?.message ?? 'Upload failed'); }
    finally { setActing(false); }
  };

  const handlePrint = async () => {
    const res = await invoicesApi.printData(Number(id));
    const { invoice: i, operator: op } = res.data;
    const lineRows = (i.line_items || []).map((l: any, idx: number) => `
      <tr style="background:${idx % 2 === 0 ? '#fff' : '#f9f9f9'}">
        <td style="text-align:center">${idx + 1}</td>
        <td>${l.description}${l.manifest_number ? `<div style="font-size:7.5pt;color:#3B82F6;margin-top:2px">Manifest: ${l.manifest_number}</div>` : ''}</td>
        <td style="text-align:center">${Number(l.quantity).toFixed(0)}</td>
        <td style="text-align:right">${fmtMoney(l.unit_price)}</td>
        <td style="text-align:right;font-weight:700">${fmtMoney(l.line_total)}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Invoice ${i.invoice_number}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#000;background:#fff}
      .logo-area{text-align:center;padding:10px 0 6px}
      .header{font-size:13pt;font-weight:900;text-align:center;letter-spacing:1px}
      .sub-header{font-size:8.5pt;text-align:center;color:#444;margin-bottom:4px}
      .divider{border-top:2px solid #000;margin:8px 0}
      .meta-table{width:100%;border-collapse:collapse;margin-bottom:10px}
      .meta-table td{padding:3px 6px;font-size:9pt;vertical-align:top}
      .meta-table td.label{font-weight:700;white-space:nowrap;width:130px}
      .section-title{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666;margin:8px 0 4px}
      .inv-table{width:100%;border-collapse:collapse;margin-bottom:12px}
      .inv-table thead tr{background:#333;color:#fff}
      .inv-table th{padding:6px 8px;text-align:left;font-size:8pt;text-transform:uppercase;border-right:1px solid #555;font-weight:700}
      .inv-table th:last-child{border-right:none}
      .inv-table td{padding:5px 8px;font-size:9pt;border-bottom:1px solid #ddd;border-right:1px solid #ddd}
      .inv-table td:last-child{border-right:none}
      .inv-table tbody tr:last-child td{border-bottom:1px solid #999}
      .totals{width:300px;margin-left:auto;border-collapse:collapse}
      .totals td{padding:4px 8px;font-size:10pt;border-bottom:1px solid #eee}
      .totals .total-row{font-weight:900;font-size:11pt;border-top:2px solid #000}
      .notes{margin-top:12px;font-size:8.5pt;color:#444;border-top:1px solid #ccc;padding-top:8px}
      .footer{margin-top:16px;font-size:8pt;color:#666;text-align:center}
      @page{size:A4;margin:12mm 15mm}
    </style></head><body>
    <div class="header">${op.name ?? ''}</div>
    <div class="sub-header">
      Address: ${op.address ?? ''} | Telephone: ${op.phone ?? ''} | Email: ${op.email ?? ''}
    </div>
    <div class="divider"></div>
    <table class="meta-table">
      <tr><td class="label">Date</td><td>${fmtDate(i.issued_date)}</td>
          <td style="text-align:right" class="label">Recipient</td><td style="text-align:right"></td></tr>
      <tr><td class="label">Invoice No:</td><td><strong>${i.invoice_number}</strong></td>
          <td style="text-align:right"><strong>${i.icdv_name}</strong></td><td></td></tr>
      ${i.icdv_tin ? `<tr><td></td><td></td><td style="text-align:right">TIN: ${i.icdv_tin}</td><td></td></tr>` : ''}
      ${i.icdv_vrn ? `<tr><td></td><td></td><td style="text-align:right">VRN: ${i.icdv_vrn}</td><td></td></tr>` : ''}
      ${i.icdv_address ? `<tr><td></td><td></td><td style="text-align:right">Address: ${i.icdv_address}</td><td></td></tr>` : ''}
    </table>
    <table class="inv-table">
      <thead><tr>
        <th style="width:4%">S/N</th>
        <th>Details</th>
        <th style="width:8%;text-align:center">Units</th>
        <th style="width:14%;text-align:right">Price</th>
        <th style="width:16%;text-align:right">Total</th>
      </tr></thead>
      <tbody>${lineRows}</tbody>
    </table>
    <table class="totals">
      <tr><td>SUB TOTAL</td><td style="text-align:right">${fmtMoney(i.subtotal)}</td></tr>
      <tr><td>WITHHOLDING TAX (${Number(i.withholding_tax_rate).toFixed(0)}%)</td>
          <td style="text-align:right">${fmtMoney(i.withholding_tax_amount)}</td></tr>
      <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${fmtMoney(i.total_amount)}</td></tr>
    </table>
    ${i.notes ? `<div class="notes">${i.notes.replace(/\n/g,'<br>')}</div>` : ''}
    <div style="margin-top:20px;font-size:9pt">Sincerely,<br><strong>${op.name ?? ''}</strong><br><em>For direct delivery</em></div>
    <div class="footer">Page 1 — ${i.invoice_number}</div>
    </body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  };

  if (loading) return <div className="p-6 text-center text-gray-400">Loading…</div>;
  if (!inv)    return <div className="p-6 text-center text-red-500">{error || 'Invoice not found'}</div>;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white font-mono">{inv.invoice_number}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{inv.icdv_name} · {fmtDate(inv.issued_date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[inv.status] ?? ''}`}>{inv.status}</span>
          <button onClick={handlePrint} className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">Print / PDF</button>
          {isSuperAdmin && inv.status === 'invoiced' && (
            <button onClick={() => navigate(`/invoices/${id}/edit`)}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              Edit
            </button>
          )}
          {!isSuperAdmin && !isCashier && inv.status === 'invoiced'  && <button onClick={handleApprove} disabled={acting} className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-medium disabled:opacity-60">Approve</button>}
          {isSuperAdmin && inv.status !== 'paid' && inv.status !== 'cancelled' && <button onClick={handleCancel} disabled={acting} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium disabled:opacity-60">Cancel</button>}
          {!isSuperAdmin && inv.status === 'approved' && <button onClick={handleMarkPaid} disabled={acting} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium disabled:opacity-60">Mark as Paid</button>}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {/* Recipient */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Recipient</h2>
        <p className="font-bold text-gray-800 dark:text-white">{inv.icdv_name}</p>
        {inv.icdv_tin && <p className="text-sm text-gray-600 dark:text-gray-400">TIN: {inv.icdv_tin}</p>}
        {inv.icdv_vrn && <p className="text-sm text-gray-600 dark:text-gray-400">VRN: {inv.icdv_vrn}</p>}
        {inv.icdv_address && <p className="text-sm text-gray-600 dark:text-gray-400">{inv.icdv_address}</p>}
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              {['S/N','Description','Units','Unit Price','Total'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {(inv.line_items || []).map((l: any, i: number) => (
              <tr key={l.line_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{i + 1}</td>
                <td className="px-4 py-3 text-sm text-gray-800 dark:text-white max-w-xs">
                  <p>{l.description}</p>
                  {l.manifest_number && <p className="text-xs text-brand-500 mt-0.5">Manifest: {l.manifest_number}</p>}
                </td>
                <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-white">{Number(l.quantity).toFixed(0)}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-white">{fmtMoney(l.unit_price)}</td>
                <td className="px-4 py-3 text-sm font-semibold text-right text-gray-800 dark:text-white">{fmtMoney(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Totals */}
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 space-y-1 text-sm">
          <div className="flex justify-end gap-8">
            <span className="text-gray-500 dark:text-gray-400">SUB TOTAL</span>
            <span className="font-semibold w-32 text-right text-gray-800 dark:text-white">{fmtMoney(inv.subtotal)}</span>
          </div>
          <div className="flex justify-end gap-8">
            <span className="text-red-500 dark:text-red-400">WITHHOLDING TAX ({Number(inv.withholding_tax_rate).toFixed(0)}%)</span>
            <span className="text-red-500 dark:text-red-400 w-32 text-right">({fmtMoney(inv.withholding_tax_amount)})</span>
          </div>
          <div className="flex justify-end gap-8 font-bold text-base border-t border-gray-200 dark:border-gray-700 pt-2">
            <span className="text-gray-800 dark:text-white">TOTAL</span>
            <span className="w-32 text-right text-gray-800 dark:text-white">{fmtMoney(inv.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {inv.notes && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Notes / Payment Instructions</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{inv.notes}</p>
        </div>
      )}

      {/* Payment Evidence */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Payment Evidence</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Uploaded by the ICDV when marking the invoice as paid</p>
          </div>
          {!isSuperAdmin && ['approved','paid'].includes(inv.status) && (
            <>
              <button onClick={() => evidenceRef.current?.click()} disabled={acting}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium whitespace-nowrap">
                + Upload Evidence
              </button>
              <input ref={evidenceRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUploadEvidence} />
            </>
          )}
        </div>
        {(inv.payments?.filter((p: any) => p.document_type !== 'receipt').length ?? 0) === 0
          ? <p className="text-xs text-gray-400 dark:text-gray-500">No payment evidence uploaded yet.</p>
          : inv.payments?.filter((p: any) => p.document_type !== 'receipt').map((p: any) => (
              <div key={p.payment_id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{p.evidence_name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(p.created_at)} · {p.paid_by_name}</p>
                </div>
                <a href={`/uploads/${p.evidence_path?.split('/').pop() ?? p.evidence_path}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex-shrink-0">View</a>
              </div>
            ))
        }
      </div>

      {/* Payment Receipt */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Payment Receipt</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Official receipt issued back to the ICDV once paid</p>
          </div>
          {isSuperAdmin && inv.status === 'paid' && (
            <>
              <button onClick={() => receiptRef.current?.click()} disabled={acting}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium whitespace-nowrap">
                + Upload Receipt
              </button>
              <input ref={receiptRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUploadReceipt} />
            </>
          )}
        </div>
        {(inv.payments?.filter((p: any) => p.document_type === 'receipt').length ?? 0) === 0
          ? <p className="text-xs text-gray-400 dark:text-gray-500">No receipt issued yet.</p>
          : inv.payments?.filter((p: any) => p.document_type === 'receipt').map((p: any) => (
              <div key={p.payment_id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{p.evidence_name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(p.created_at)} · {p.paid_by_name}</p>
                </div>
                <a href={`/uploads/${p.evidence_path?.split('/').pop() ?? p.evidence_path}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex-shrink-0">View</a>
              </div>
            ))
        }
      </div>
    </div>
  );
}
