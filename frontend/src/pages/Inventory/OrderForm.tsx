import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { purchaseOrdersApi, suppliersApi, productsApi, projectsApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

// ── Defined OUTSIDE to prevent focus loss ─────────────────────────────────────

const CURRENCIES = ['TZS','USD','EUR','GBP','AED','CNY','KES','UGX','ZAR','INR'];

const STATUS_OPTIONS = ['draft','pending','approved','ordered','partially_received','completed','cancelled'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 pb-2 border-b border-gray-100 dark:border-gray-800">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400";
const selectCls = inputCls;

// ─────────────────────────────────────────────────────────────────────────────

let _uid = 0;
const uid = () => `item_${++_uid}`;

interface OrderItem {
  _key: string;
  product_id: string;
  product_name: string;
  description: string;
  unit_type: string;
  quantity: string;
  unit_price: string;
}

export default function OrderForm() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const isEdit    = !!id;

  // ── Header state ─────────────────────────────────────────────────────────────
  const [supplierId,    setSupplierId]    = useState('');
  const [projectId,     setProjectId]     = useState('');
  const [currency,      setCurrency]      = useState('TZS');
  const [exchangeRate,  setExchangeRate]  = useState('1');
  const [orderDate,     setOrderDate]     = useState(new Date().toISOString().slice(0,10));
  const [deliveryDate,  setDeliveryDate]  = useState('');
  const [notes,         setNotes]         = useState('');
  const [status,        setStatus]        = useState('draft');

  // ── Items state ───────────────────────────────────────────────────────────────
  const [items, setItems] = useState<OrderItem[]>([
    { _key: uid(), product_id: '', product_name: '', description: '', unit_type: '', quantity: '', unit_price: '' }
  ]);

  // ── Lookup data ───────────────────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products,  setProducts]  = useState<any[]>([]);
  const [projects,  setProjects]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  // ── Load lookups ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      suppliersApi.list({ limit: 200, status: 'active' }),
      productsApi.list({ limit: 500, status: 'active' }),
      projectsApi.list({ limit: 100 }),
    ]).then(([sRes, pRes, prRes]) => {
      setSuppliers(sRes.data.results);
      setProducts(pRes.data.results);
      setProjects(prRes.data.results);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // ── Auto-fill currency from supplier ─────────────────────────────────────────
  useEffect(() => {
    if (!supplierId) return;
    const sup = suppliers.find(s => s.supplier_id === Number(supplierId));
    if (sup?.currency) {
      setCurrency(sup.currency);
      if (sup.currency === 'TZS') setExchangeRate('1');
    }
  }, [supplierId, suppliers]);

  // ── Load existing PO for edit ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    purchaseOrdersApi.get(Number(id)).then(res => {
      const po = res.data;
      setSupplierId(po.supplier_id?.toString() ?? '');
      setProjectId(po.project_id?.toString()   ?? '');
      setCurrency(po.currency_code ?? 'TZS');
      setExchangeRate(po.exchange_rate?.toString() ?? '1');
      setOrderDate(po.order_date?.slice(0,10) ?? '');
      setDeliveryDate(po.expected_delivery_date?.slice(0,10) ?? '');
      setNotes(po.notes ?? '');
      setStatus(po.status ?? 'draft');
      if (po.items?.length) {
        setItems(po.items.map((item: any) => ({
          _key:        uid(),
          product_id:  item.product_id?.toString() ?? '',
          product_name:item.product_name ?? '',
          description: item.description ?? '',
          unit_type:   item.unit_type ?? '',
          quantity:    item.quantity?.toString() ?? '',
          unit_price:  item.unit_price?.toString() ?? '',
        })));
      }
    }).catch(() => {});
  }, [id]);

  // ── Item helpers ──────────────────────────────────────────────────────────────
  const addItem = () =>
    setItems(prev => [...prev, { _key: uid(), product_id: '', product_name: '', description: '', unit_type: '', quantity: '', unit_price: '' }]);

  const removeItem = (key: string) =>
    setItems(prev => prev.filter(i => i._key !== key));

  const setItem = (key: string, field: keyof OrderItem, value: string) =>
    setItems(prev => prev.map(i => i._key === key ? { ...i, [field]: value } : i));

  const onProductChange = (key: string, productId: string) => {
    const product = products.find(p => p.product_id === Number(productId));
    setItems(prev => prev.map(i => i._key === key ? {
      ...i,
      product_id:   productId,
      product_name: product?.product_name ?? '',
      unit_type:    product?.unit_type ?? i.unit_type,
    } : i));
  };

  // ── Calculations ──────────────────────────────────────────────────────────────
  const rate = parseFloat(exchangeRate) || 1;

  const calcItem = (item: OrderItem) => {
    const qty   = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    const totalForeign = qty * price;
    const totalTzs     = totalForeign * rate;
    return { totalForeign, totalTzs };
  };

  const totals = useMemo(() => {
    return items.reduce((acc, item) => {
      const { totalForeign, totalTzs } = calcItem(item);
      return { foreign: acc.foreign + totalForeign, tzs: acc.tzs + totalTzs };
    }, { foreign: 0, tzs: 0 });
  }, [items, exchangeRate]);

  const fmtAmt = (n: number, code = currency) =>
    `${code} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId)  { setError('Supplier is required'); return; }
    if (!orderDate)   { setError('Order date is required'); return; }
    if (!currency)    { setError('Currency is required'); return; }
    if (currency !== 'TZS' && (!exchangeRate || parseFloat(exchangeRate) <= 0)) {
      setError('Exchange rate is required for non-TZS currency'); return;
    }
    const validItems = items.filter(i => i.product_id && parseFloat(i.quantity) > 0 && parseFloat(i.unit_price) >= 0);

    setSaving(true); setError('');
    try {
      const payload = {
        supplier_id:            Number(supplierId),
        project_id:             projectId ? Number(projectId) : null,
        currency_code:          currency,
        exchange_rate:          parseFloat(exchangeRate) || 1,
        order_date:             orderDate,
        expected_delivery_date: deliveryDate || null,
        notes:                  notes || null,
        status,
        items: validItems.map(item => ({
          product_id:  Number(item.product_id),
          description: item.description || null,
          unit_type:   item.unit_type || null,
          quantity:    parseFloat(item.quantity),
          unit_price:  parseFloat(item.unit_price),
        })),
      };

      if (isEdit) {
        await purchaseOrdersApi.update(Number(id), payload);
        toast.success('Purchase order updated');
        navigate(`/inventory/orders/${id}`);
      } else {
        const res = await purchaseOrdersApi.create(payload);
        toast.success('Purchase order created', res.data.order_number);
        navigate(`/inventory/orders/${res.data.purchase_order_id}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to save';
      toast.error('Save failed', msg);
      setError(msg);
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="animate-pulse space-y-4 max-w-5xl mx-auto">
      {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/inventory/orders" className="hover:text-brand-500">Orders</Link>
          <span>/</span>
          <span className="text-gray-700 dark:text-gray-300">{isEdit ? `Edit ${id}` : 'New Order'}</span>
        </div>
        <BackButton to="/inventory/orders" />
      </div>

      <h1 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
        {isEdit ? 'Edit Order' : 'Create Order'}
      </h1>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm border border-red-200 dark:border-red-500/20">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Supplier & Project ── */}
        <Section title="Supplier & Project">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Supplier" required>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={selectCls}>
                <option value="">Select supplier...</option>
                {suppliers.map(s => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.company_name}{s.country ? ` — ${s.country}` : ''}
                  </option>
                ))}
              </select>
              {supplierId && (() => {
                const sup = suppliers.find(s => s.supplier_id === Number(supplierId));
                return sup ? (
                  <p className="text-xs text-gray-400 mt-1">
                    {sup.contact_person && `${sup.contact_person} · `}{sup.country ?? ''}{sup.currency ? ` · ${sup.currency}` : ''}
                  </p>
                ) : null;
              })()}
            </Field>

            <Field label="Project (optional)">
              <select value={projectId} onChange={e => setProjectId(e.target.value)} className={selectCls}>
                <option value="">None</option>
                {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        {/* ── Order Info ── */}
        <Section title="Order Information">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Order Date" required>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Expected Delivery">
              <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Status">
              <select value={status} onChange={e => setStatus(e.target.value)} className={selectCls}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {/* ── Currency ── */}
        <Section title="Currency & Exchange Rate">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Currency" required>
              <select value={currency} onChange={e => { setCurrency(e.target.value); if (e.target.value === 'TZS') setExchangeRate('1'); }} className={selectCls}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label={`Exchange Rate (1 ${currency} = ? TZS)`} required={currency !== 'TZS'}>
              <input
                type="number" min="0" step="0.000001"
                value={exchangeRate}
                onChange={e => setExchangeRate(e.target.value)}
                disabled={currency === 'TZS'}
                className={inputCls + (currency === 'TZS' ? ' opacity-50 cursor-not-allowed' : '')}
                placeholder="e.g. 2650"
              />
            </Field>
            {currency !== 'TZS' && parseFloat(exchangeRate) > 0 && (
              <div className="flex items-end pb-0.5">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  1 {currency} = <strong className="text-gray-800 dark:text-white">TZS {Number(exchangeRate).toLocaleString()}</strong>
                </p>
              </div>
            )}
          </div>
        </Section>

        {/* ── Order Items ── */}
        <Section title="Order Items">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400">
                  <th className="text-left py-2 pr-3 font-medium w-48">Product</th>
                  <th className="text-left py-2 pr-3 font-medium w-32">Unit Type</th>
                  <th className="text-left py-2 pr-3 font-medium w-24">Quantity</th>
                  <th className="text-left py-2 pr-3 font-medium w-32">Unit Price ({currency})</th>
                  <th className="text-left py-2 pr-3 font-medium w-32">Total ({currency})</th>
                  <th className="text-left py-2 font-medium w-32">Total (TZS)</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {items.map(item => {
                  const { totalForeign, totalTzs } = calcItem(item);
                  return (
                    <tr key={item._key}>
                      <td className="py-2 pr-3">
                        <select value={item.product_id}
                          onChange={e => onProductChange(item._key, e.target.value)}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-brand-400">
                          <option value="">Select product...</option>
                          {products.map(p => (
                            <option key={p.product_id} value={p.product_id}>
                              {p.product_name}{p.sku_barcode ? ` [${p.sku_barcode}]` : ''}
                            </option>
                          ))}
                        </select>
                        <input value={item.description}
                          onChange={e => setItem(item._key, 'description', e.target.value)}
                          placeholder="Description (optional)"
                          className="mt-1 w-full rounded border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1 text-xs text-gray-500 focus:outline-none focus:border-brand-400" />
                      </td>
                      <td className="py-2 pr-3">
                        <input value={item.unit_type}
                          onChange={e => setItem(item._key, 'unit_type', e.target.value)}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-brand-400"
                          placeholder="e.g. Piece" />
                      </td>
                      <td className="py-2 pr-3">
                        <input type="number" min="0" step="0.0001"
                          value={item.quantity}
                          onChange={e => setItem(item._key, 'quantity', e.target.value)}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-brand-400"
                          placeholder="0" />
                      </td>
                      <td className="py-2 pr-3">
                        <input type="number" min="0" step="0.0001"
                          value={item.unit_price}
                          onChange={e => setItem(item._key, 'unit_price', e.target.value)}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-xs text-gray-800 dark:text-white focus:outline-none focus:border-brand-400"
                          placeholder="0.00" />
                      </td>
                      <td className="py-2 pr-3 text-xs font-medium text-gray-700 dark:text-gray-300">
                        {totalForeign > 0 ? fmtAmt(totalForeign) : '—'}
                      </td>
                      <td className="py-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                        {totalTzs > 0 ? `TZS ${totalTzs.toLocaleString(undefined, {maximumFractionDigits:0})}` : '—'}
                      </td>
                      <td className="py-2 pl-2">
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(item._key)}
                            className="text-red-400 hover:text-red-600 w-6 h-6 flex items-center justify-center rounded">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={addItem}
            className="flex items-center gap-2 text-sm text-brand-500 hover:text-brand-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Item
          </button>
        </Section>

        {/* ── Notes ── */}
        <Section title="Notes">
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Order notes, special instructions..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400 resize-none" />
        </Section>

        {/* ── Totals summary (sticky) ── */}
        <div className="sticky bottom-4 z-10">
          <div className="rounded-xl border border-brand-200 dark:border-brand-500/30 bg-white dark:bg-gray-900 shadow-lg px-6 py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Subtotal ({currency})</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">{fmtAmt(totals.foreign)}</p>
                </div>
                {currency !== 'TZS' && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Total (TZS)</p>
                    <p className="text-lg font-bold text-brand-600 dark:text-brand-400">
                      TZS {totals.tzs.toLocaleString(undefined, {maximumFractionDigits:0})}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Items</p>
                  <p className="text-lg font-bold text-gray-600 dark:text-gray-400">{items.filter(i => i.product_id).length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link to="/inventory/orders"
                  className="px-5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  Cancel
                </Link>
                <button type="submit" disabled={saving}
                  className="px-6 py-2.5 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
                  {saving ? 'Saving...' : isEdit ? 'Update Order' : 'Create Order'}
                </button>
              </div>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
