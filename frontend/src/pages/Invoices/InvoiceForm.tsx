import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { invoicesApi } from '../../api';
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
  const [icdvList,    setIcdvList]    = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [lines,       setLines]       = useState<LineItem[]>([{ _key: newKey(), description: '', unit: 'vehicle', quantity: 1, unit_price: 0, line_total: 0 }]);
  const [icdvId,      setIcdvId]      = useState('');
  const [issuedDate,  setIssuedDate]  = useState(new Date().toISOString().slice(0,10));
  const [dueDate,     setDueDate]     = useState('');
  const [notes,       setNotes]       = useState('');
  const [whtRate,     setWhtRate]     = useState(5);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string|null>(null);

  useEffect(() => {
    // Load ICDVs and catalog items
    Promise.all([
      fetch('/api/v1/icdvs', { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }).then(r => r.json()),
      invoicesApi.listItems({ status: 'active' }),
    ]).then(([icdvRes, itemRes]) => {
      setIcdvList(icdvRes.results ?? []);
      setCatalogItems(itemRes.data ?? []);
    }).catch(() => {});
  }, []);

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

  const addLine = () => setLines(prev => [...prev, { _key: newKey(), description: '', unit: 'vehicle', quantity: 1, unit_price: 0, line_total: 0 }]);
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
    invoicesApi.getManifestVehicleCount(manifest.manifest_id).then(r => {
      const count = r.data.total_vehicles ?? 1;
      updateLine(key, {
        manifest_id:     manifest.manifest_id,
        manifest_number: manifest.manifest_number,
        description:     `BEING PAYMENT IN RESPECT OF VEHICLES DISCHARGE PROCESS AND TRANSFER FROM DAR PORT HOLDING AREA TO FAB ICD ${(manifest as any).vessel_name ?? manifest.manifest_number}`,
        quantity:        count,
      });
    }).catch(() => updateLine(key, { manifest_id: manifest.manifest_id, manifest_number: manifest.manifest_number }));
  }, []); // eslint-disable-line

  const handleSubmit = async () => {
    if (!icdvId)   { setError('Select an ICDV'); return; }
    if (!issuedDate) { setError('Set invoice date'); return; }
    if (!lines.length) { setError('Add at least one line item'); return; }
    setSaving(true); setError(null);
    try {
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
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to create invoice');
    } finally { setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">New Invoice</h1>
      </div>

      {/* Header fields */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Invoice Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Recipient ICDV *</label>
            <select value={icdvId} onChange={e => setIcdvId(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
              <option value="">Select ICDV…</option>
              {icdvList.map(i => <option key={i.icdv_id} value={i.icdv_id}>{i.name}</option>)}
            </select>
          </div>
          <FormDateInput label="Invoice Date *" id="issued-date" value={issuedDate} onChange={setIssuedDate} />
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
          <div key={line._key} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
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
              <label className="block text-xs text-gray-500 mb-1">Link to Manifest (optional — auto-fills description & quantity)</label>
              <ManifestSelector
                value={line.manifest_id ? ({ manifest_id: line.manifest_id, manifest_number: line.manifest_number } as any) : null}
                onChange={(m) => pickManifest(line._key, m)}
                placeholder="Select manifest to link…"
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
          {saving ? 'Creating…' : 'Create Invoice (Draft)'}
        </button>
        <button onClick={() => navigate('/invoices')}
          className="px-6 py-2 border border-gray-200 dark:border-gray-700 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
          Cancel
        </button>
      </div>
    </div>
  );
}
