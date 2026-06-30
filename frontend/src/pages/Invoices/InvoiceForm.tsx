import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { invoicesApi, icdvsApi } from '../../api';
import BackButton from '../../components/tpfcs/BackButton';
import { FormDateInput } from '../../components/tpfcs/FormField';
import ManifestSelector from '../../components/tpfcs/ManifestSelector';
import type { Manifest } from '../../types';

interface LineItem {
  _key:        number;
  item_id?:    number | null;
  manifest_id?: number | null;
  manifest_number?: string;
  description: string;
  unit:        string;
  quantity:    number;
  unit_price:  number;
  line_total:  number;
}

const fmtMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });

let _keySeq = 0;
const newKey = () => ++_keySeq;

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [icdvList,    setIcdvList]    = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [lines,       setLines]       = useState<LineItem[]>([{ _key: newKey(), description: '', unit: 'vehicle', quantity: 1, unit_price: 0, line_total: 0 }]);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollToKeyRef = useRef<number | null>(null);
  const [icdvId,      setIcdvId]      = useState('');
  const [issuedDate,  setIssuedDate]  = useState(new Date().toISOString().slice(0,10));
  const [dueDate,     setDueDate]     = useState('');
  const [notes,       setNotes]       = useState('');
  const [notesTouched, setNotesTouched] = useState(false); // user manually edited notes
  const [whtRate,     setWhtRate]     = useState(5);
  const [saving,      setSaving]      = useState(false);
  const [loading,     setLoading]     = useState(isEdit);
  const [error,       setError]       = useState<string|null>(null);
  const [loadError,   setLoadError]   = useState<string|null>(null);
  const [locked,      setLocked]      = useState(false); // invoice exists but status no longer allows editing

  useEffect(() => {
    // Load ICDVs, catalog items, and operator config (for notes prefill)
    Promise.all([
      icdvsApi.list({ limit: 200, is_active: 1 }),
      invoicesApi.listItems({ status: 'active' }),
      invoicesApi.getOperatorConfig(),
    ]).then(([icdvRes, itemRes, opRes]) => {
      setIcdvList(icdvRes.data.results ?? []);
      setCatalogItems(itemRes.data ?? []);

      // Prefill notes with bank details from operator config, only if user
      // hasn't already typed something
      const op = opRes.data;
      const bankLines = [
        op.bank_name && op.bank_account
          ? `Deposit the amount in TSHS A/C No. ${op.bank_account} at ${op.bank_name}${op.bank_branch ? ` (${op.bank_branch})` : ''}, this Invoice is due for payment on Presentation.`
          : null,
        op.email ? `In case of any problem with this invoice, contact us on ${op.email}` : null,
      ].filter(Boolean).join('\n');
      if (bankLines) setNotes(prev => (prev ? prev : bankLines));
    }).catch(() => setLoadError('Failed to load form data. Please refresh the page.'));
  }, []);

  // Edit mode: load the existing invoice and prefill the form. Only
  // 'invoiced' (not yet approved) invoices are editable — guarded both
  // here (so the form can't even render stale data for a locked invoice)
  // and again server-side in updateInvoice().
  useEffect(() => {
    if (!isEdit) return;
    invoicesApi.get(Number(id))
      .then(r => {
        const inv = r.data;
        if (inv.status !== 'invoiced') {
          setLocked(true);
          setLoadError(`This invoice is "${inv.status}" and can no longer be edited. Only invoices awaiting approval can be changed.`);
          setLoading(false);
          return;
        }
        setIcdvId(String(inv.icdv_id));
        setIssuedDate((inv.issued_date || '').slice(0, 10));
        setDueDate((inv.due_date || '').slice(0, 10));
        setNotes(inv.notes ?? '');
        setNotesTouched(true); // don't let the bank-details prefill clobber saved notes
        setWhtRate(Number(inv.withholding_tax_rate));
        setLines(
          (inv.line_items || []).map((l: any) => ({
            _key: newKey(),
            item_id: l.item_id ?? null,
            manifest_id: l.manifest_id ?? null,
            manifest_number: l.manifest_number,
            description: l.description,
            unit: l.unit,
            quantity: Number(l.quantity),
            unit_price: Number(l.unit_price),
            line_total: Number(l.line_total),
          }))
        );
      })
      .catch(() => setLoadError('Failed to load invoice. Please go back and try again.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]); // eslint-disable-line

  // Totals
  const subtotal  = lines.reduce((s, l) => s + l.line_total, 0);
  const whtAmount = parseFloat((subtotal * (whtRate / 100)).toFixed(2));
  const total     = parseFloat((subtotal - whtAmount).toFixed(2));

  const updateLine = (key: number, patch: Partial<LineItem>) => {
    setLines(prev => prev.map(l => {
      if (l._key !== key) return l;
      const updated = { ...l, ...patch };
      updated.line_total = parseFloat((updated.quantity * updated.unit_price).toFixed(2));
      return updated;
    }));
  };

  const addLine = () => {
    const key = newKey();
    scrollToKeyRef.current = key;
    setLines(prev => [...prev, { _key: key, description: '', unit: 'vehicle', quantity: 1, unit_price: 0, line_total: 0 }]);
  };

  useEffect(() => {
    if (scrollToKeyRef.current === null) return;
    const el = lineRefs.current.get(scrollToKeyRef.current);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    scrollToKeyRef.current = null;
  }, [lines]);
  const removeLine = (key: number) => setLines(prev => prev.filter(l => l._key !== key));

  const pickCatalogItem = (key: number, itemId: string) => {
    const item = catalogItems.find(i => String(i.item_id) === itemId);
    if (!item) return;
    updateLine(key, {
      item_id:    item.item_id,
      description: item.name,
      unit:        item.unit,
      unit_price:  parseFloat(item.default_rate),
    });
  };

  const pickManifest = useCallback((key: number, manifest: Manifest | null) => {
    if (!manifest) { updateLine(key, { manifest_id: null, manifest_number: undefined }); return; }
    const selectedIcdv = icdvList.find(i => i.icdv_id === Number(icdvId));
    const icdvName = selectedIcdv?.name ?? 'the ICDV';
    invoicesApi.getManifestVehicleCount(manifest.manifest_id).then(r => {
      const count = r.data.total_vehicles ?? 1;
      updateLine(key, {
        manifest_id:     manifest.manifest_id,
        manifest_number: manifest.manifest_number,
        description:     `BEING PAYMENT IN RESPECT OF VEHICLES DISCHARGE PROCESS AND TRANSFER FROM DAR PORT HOLDING AREA TO ${icdvName} ICD, ${(manifest as any).vessel_name ?? manifest.manifest_number}`,
        quantity:        count,
      });
    }).catch(() => updateLine(key, { manifest_id: manifest.manifest_id, manifest_number: manifest.manifest_number }));
  }, [icdvId, icdvList]); // eslint-disable-line

  const handleSubmit = async () => {
    if (!icdvId)   { setError('Select an ICDV'); return; }
    if (!issuedDate) { setError('Set invoice date'); return; }
    if (!lines.length) { setError('Add at least one line item'); return; }
    setSaving(true); setError(null);
    try {
      if (isEdit) {
        // updateInvoice() does not accept icdv_id — the recipient is fixed
        // once an invoice exists, so it's intentionally left out here.
        const inv = await invoicesApi.update(Number(id), {
          due_date: dueDate || null,
          notes: notes || null,
          withholding_tax_rate: whtRate,
          line_items: lines.map((l, idx) => ({
            item_id:     l.item_id     || null,
            manifest_id: l.manifest_id || null,
            description: l.description,
            unit:        l.unit,
            quantity:    l.quantity,
            unit_price:  l.unit_price,
            sort_order:  idx,
          })),
        });
        navigate(`/invoices/${inv.data.invoice_id}`);
      } else {
        const inv = await invoicesApi.create({
          icdv_id: Number(icdvId),
          issued_date: issuedDate,
          due_date: dueDate || null,
          notes: notes || null,
          withholding_tax_rate: whtRate,
          line_items: lines.map((l, idx) => ({
            item_id:     l.item_id     || null,
            manifest_id: l.manifest_id || null,
            description: l.description,
            unit:        l.unit,
            quantity:    l.quantity,
            unit_price:  l.unit_price,
            sort_order:  idx,
          })),
        });
        navigate(`/invoices/${inv.data.invoice_id}`);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? `Failed to ${isEdit ? 'update' : 'create'} invoice`);
    } finally { setSaving(false); }
  };

  if (locked) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <BackButton />
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Edit Invoice</h1>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {loadError}
        </div>
        <button onClick={() => navigate(`/invoices/${id}`)}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
          View Invoice
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h1>
      </div>

      {loading && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
      )}

      {loadError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{loadError}</span>
          <button onClick={() => window.location.reload()} className="text-xs underline font-medium">Retry</button>
        </div>
      )}

      {/* Header fields */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Invoice Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Recipient ICDV *</label>
            <select value={icdvId} onChange={e => setIcdvId(e.target.value)} disabled={isEdit}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 disabled:opacity-60 disabled:cursor-not-allowed">
              <option value="">Select ICDV…</option>
              {icdvList.map(i => <option key={i.icdv_id} value={i.icdv_id}>{i.name}</option>)}
            </select>
            {isEdit && <p className="mt-1 text-xs text-gray-400">Recipient can't be changed after the invoice is created.</p>}
          </div>
          <div>
            <FormDateInput label="Invoice Date *" id="issued-date" value={issuedDate} onChange={setIssuedDate} />
            {isEdit && <p className="mt-1 text-xs text-gray-400">Invoice date can't be changed after creation.</p>}
          </div>
          <FormDateInput label="Due Date" id="due-date" value={dueDate} onChange={setDueDate} placeholder="Optional" />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Withholding Tax %</label>
            <input type="number" min={0} max={100} step={0.5} value={whtRate}
              onChange={e => setWhtRate(parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Notes (Bank details, payment instructions, etc.)</label>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Deposit the amount in TSHS A/C No. XXXXXXXX at NMB Bank, this Invoice is due for payment on Presentation."
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Line Items</h2>
          <button onClick={addLine} className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">+ Add Line</button>
        </div>

        {lines.map((line, idx) => (
          <div key={line._key}
            ref={el => { if (el) lineRefs.current.set(line._key, el); else lineRefs.current.delete(line._key); }}
            className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Line {idx + 1}</span>
              {lines.length > 1 && (
                <button onClick={() => removeLine(line._key)} className="text-xs text-red-500 hover:underline">Remove</button>
              )}
            </div>

            {/* Catalog item picker */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">From Catalog (optional)</label>
              <select onChange={e => pickCatalogItem(line._key, e.target.value)} defaultValue=""
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">
                <option value="">Select catalog item to prefill…</option>
                {catalogItems.map(i => (
                  <option key={i.item_id} value={i.item_id}>{i.name} — TZS {Number(i.default_rate).toLocaleString()}</option>
                ))}
              </select>
            </div>

            {/* Manifest linker */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Link to Manifest (optional — auto-fills description & quantity)
                {!icdvId && <span className="text-amber-500"> — select recipient ICDV first</span>}
              </label>
              <ManifestSelector
                value={line.manifest_id ? ({ manifest_id: line.manifest_id, manifest_number: line.manifest_number } as any) : null}
                onChange={(m) => pickManifest(line._key, m)}
                icdvId={icdvId ? Number(icdvId) : null}
                disabled={!icdvId}
                placeholder={icdvId ? 'Select manifest to link…' : 'Select recipient ICDV first…'}
                allLabel="No manifest (free-text)"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description *</label>
              <textarea rows={2} value={line.description}
                onChange={e => updateLine(line._key, { description: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            {/* Qty / Price / Total */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Quantity (Units)</label>
                <input type="number" min={0} step={1} value={line.quantity}
                  onChange={e => updateLine(line._key, { quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Unit Price (TZS)</label>
                <input type="number" min={0} step={100} value={line.unit_price}
                  onChange={e => updateLine(line._key, { unit_price: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Line Total</label>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-semibold">
                  TZS {fmtMoney(line.line_total)}
                </div>
              </div>
            </div>
          </div>
        ))}

        <button onClick={addLine}
          className="w-full py-2.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-brand-600 dark:text-brand-400 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 font-medium transition-colors">
          + Add Line
        </button>

        {/* Totals summary */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Sub Total</span>
            <span className="font-semibold text-gray-800 dark:text-white">TZS {fmtMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between text-red-600 dark:text-red-400">
            <span>Withholding Tax ({whtRate}%)</span>
            <span>TZS {fmtMoney(whtAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-800 dark:text-white text-base border-t border-gray-200 dark:border-gray-700 pt-2">
            <span>TOTAL</span>
            <span>TZS {fmtMoney(total)}</span>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

      <div className="flex gap-3">
        <button onClick={handleSubmit} disabled={saving}
          className="px-6 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors">
          {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Invoice')}
        </button>
        <button onClick={() => navigate('/invoices')}
          className="px-6 py-2 border border-gray-200 dark:border-gray-700 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
          Cancel
        </button>
      </div>
    </div>
  );
}
