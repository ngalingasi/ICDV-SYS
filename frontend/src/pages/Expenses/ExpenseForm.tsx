import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { expensesApi } from '../../api';
import BackButton from '../../components/tpfcs/BackButton';
import { FormDateInput } from '../../components/tpfcs/FormField';
import ManifestSelector from '../../components/tpfcs/ManifestSelector';
import type { Manifest } from '../../types';

interface LineItem {
  _key:         number;
  item_id?:     number | null;
  description:  string;
  shift_count: number;
  unit:         string;
  quantity:     number;
  unit_price:   number;
  line_total:   number;
}

const fmtMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });

let _keySeq = 0;
const newKey = () => ++_keySeq;

const EMPTY_LINE = (): LineItem => ({
  _key: newKey(), description: '', shift_count: 1, unit: 'unit', quantity: 1, unit_price: 0, line_total: 0,
});

export default function ExpenseForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [lines,        setLines]        = useState<LineItem[]>([EMPTY_LINE()]);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollToKeyRef = useRef<number | null>(null);
  const [manifest,     setManifest]     = useState<Manifest | null>(null);
  const [expenseDate,  setExpenseDate]  = useState(new Date().toISOString().slice(0, 10));
  const [notes,        setNotes]        = useState('');
  const [saving,       setSaving]       = useState(false);
  const [loading,      setLoading]      = useState(isEdit);
  const [error,        setError]        = useState<string | null>(null);
  const [loadError,    setLoadError]    = useState<string | null>(null);

  useEffect(() => {
    expensesApi.listItems({ status: 'active' })
      .then(r => setCatalogItems(r.data ?? []))
      .catch(() => setLoadError('Failed to load expense item catalog. Please refresh the page.'));
  }, []);

  // Edit mode: load the existing expense and prefill the form
  useEffect(() => {
    if (!isEdit) return;
    expensesApi.get(Number(id))
      .then(r => {
        const exp = r.data;
        setManifest({
          manifest_id: exp.manifest_id,
          manifest_number: exp.manifest_number,
          arrival_date: exp.arrival_date,
          status: exp.manifest_status,
        } as any);
        setExpenseDate((exp.expense_date || '').slice(0, 10));
        setNotes(exp.notes ?? '');
        setLines(
          (exp.line_items || []).map((l: any) => ({
            _key: newKey(),
            item_id: l.item_id ?? null,
            description: l.description,
            shift_count: l.shift_count !== undefined && l.shift_count !== null ? Number(l.shift_count) : 1,
            unit: l.unit,
            quantity: Number(l.quantity),
            unit_price: Number(l.unit_price),
            line_total: Number(l.line_total),
          }))
        );
      })
      .catch(() => setLoadError('Failed to load expense. Please go back and try again.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]); // eslint-disable-line

  // Totals — no withholding tax, just a straight sum
  const total = lines.reduce((s, l) => s + l.line_total, 0);

  const updateLine = (key: number, patch: Partial<LineItem>) => {
    setLines(prev => prev.map(l => {
      if (l._key !== key) return l;
      const updated = { ...l, ...patch };
      updated.line_total = parseFloat((updated.quantity * updated.unit_price * (updated.shift_count || 1)).toFixed(2));
      return updated;
    }));
  };

  const addLine = () => {
    const newLine = EMPTY_LINE();
    scrollToKeyRef.current = newLine._key;
    setLines(prev => [...prev, newLine]);
  };

  // After a new line is added, scroll it into view so the user lands right
  // where they need to type instead of staying put while the card appears
  // off-screen below.
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
      item_id:     item.item_id,
      description: item.name,
      unit:        item.unit,
      unit_price:  parseFloat(item.default_rate),
    });
  };

  const handleSubmit = async () => {
    if (!manifest)     { setError('Select a manifest'); return; }
    if (manifest.status === 'closed') { setError('This manifest is closed — expenses can no longer be recorded against it'); return; }
    if (!expenseDate)  { setError('Set the expense date'); return; }
    if (!lines.length || lines.some(l => !l.description.trim())) {
      setError('Every line needs a description'); return;
    }
    setSaving(true); setError(null);
    const payload = {
      manifest_id:   manifest.manifest_id,
      expense_date:  expenseDate,
      notes:         notes || null,
      line_items: lines.map((l, idx) => ({
        item_id:      l.item_id      || null,
        description:  l.description,
        shift_count:  l.shift_count || 1,
        unit:         l.unit,
        quantity:     l.quantity,
        unit_price:   l.unit_price,
        sort_order:   idx,
      })),
    };
    try {
      const exp = isEdit
        ? await expensesApi.update(Number(id), payload)
        : await expensesApi.create(payload);
      navigate(`/expenses/${exp.data.expense_id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? `Failed to ${isEdit ? 'update' : 'create'} expense`);
    } finally { setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">{isEdit ? 'Edit Expense' : 'New Expense'}</h1>
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
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Expense Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Manifest *</label>
            <ManifestSelector
              value={manifest}
              onChange={setManifest}
              placeholder="Select manifest…"
              allLabel="No manifest"
            />
            {manifest && manifest.status === 'closed' && (
              <p className="mt-1 text-xs text-red-500 font-medium">
                This manifest is closed — expenses can no longer be recorded against it. Please choose a different manifest.
              </p>
            )}
            {manifest && manifest.status !== 'closed' && (
              <p className="mt-1 text-xs text-gray-400">
                ICDV will be set from this manifest automatically.
              </p>
            )}
          </div>
          <FormDateInput label="Expense Date *" id="expense-date" value={expenseDate} onChange={setExpenseDate} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Notes (optional)</label>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Any additional context for this expense…"
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Expense Items</h2>
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

            {/* Description */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description *</label>
              <textarea rows={2} value={line.description}
                onChange={e => updateLine(line._key, { description: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            {/* Unit Price / Number of Units / Shifts / Total */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Unit Price (TZS)</label>
                <input type="number" min={0} step={100} value={line.unit_price}
                  onChange={e => updateLine(line._key, { unit_price: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Number of Units</label>
                <input type="number" min={0} step={1} value={line.quantity}
                  onChange={e => updateLine(line._key, { quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Shifts</label>
                <input type="number" min={0} step={1} value={line.shift_count}
                  onChange={e => updateLine(line._key, { shift_count: parseFloat(e.target.value) || 1 })}
                  placeholder="1"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Total</label>
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
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex justify-between font-bold text-gray-800 dark:text-white text-base">
            <span>TOTAL</span>
            <span>TZS {fmtMoney(total)}</span>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

      <div className="flex gap-3">
        <button onClick={handleSubmit} disabled={saving}
          className="px-6 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors">
          {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Expense')}
        </button>
        <button onClick={() => navigate('/expenses')}
          className="px-6 py-2 border border-gray-200 dark:border-gray-700 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
          Cancel
        </button>
      </div>
    </div>
  );
}
