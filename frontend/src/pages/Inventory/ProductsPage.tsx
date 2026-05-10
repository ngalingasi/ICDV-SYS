import { useEffect, useState, useCallback } from 'react';
import { productsApi } from '../../api';
import Modal from '../../components/tpfcs/Modal';
import { FormInput, FormSelect, FormTextArea } from '../../components/tpfcs/FormField';
import { toast } from '../../components/tpfcs/Toast';
import { useAuth } from '../../store/authStore';

const STATUS_STYLES: Record<string, string> = {
  active:       'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  inactive:     'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  discontinued: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};
const TYPE_STYLES: Record<string, string> = {
  hardware: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  software: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
};

function ProductForm({ product, categories, onSaved, onClose }: {
  product?: any; categories: any[];
  onSaved: () => void; onClose: () => void;
}) {
  const isEdit = !!product;
  const [form, setForm] = useState({
    sku_barcode:    product?.sku_barcode    ?? '',
    product_name:   product?.product_name  ?? '',
    product_type:   product?.product_type  ?? 'hardware',
    category_id:    product?.category_id?.toString() ?? '',
    brand:          product?.brand         ?? '',
    unit_type:      product?.unit_type     ?? '',
    description:    product?.description   ?? '',
    status:         product?.status        ?? 'active',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const filteredCats = categories.filter(c =>
    c.product_type === form.product_type || c.product_type === 'both'
  );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_name.trim()) { setError('Product name is required'); return; }
    if (!form.product_type)        { setError('Product type is required'); return; }
    if (!form.unit_type)           { setError('Unit type is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        category_id:    form.category_id    ? Number(form.category_id)    : null,
        sku_barcode:    form.sku_barcode    || null,
      };
      if (isEdit) await productsApi.update(product.product_id, payload);
      else        await productsApi.create(payload);
      toast.success(isEdit ? 'Product updated' : 'Product created');
      onSaved(); onClose();
    } catch (err: any) {
      const m = err?.response?.data?.message ?? 'Failed to save'; setError(m); toast.error('Failed', m);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <FormInput label="Product Name" required value={form.product_name} onChange={e => set('product_name', e.target.value)} placeholder="e.g. Dell Laptop XPS 15" />
        <FormInput label="SKU / Barcode" value={form.sku_barcode} onChange={e => set('sku_barcode', e.target.value)} placeholder="SKU-001" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormSelect label="Product Type" required value={form.product_type} onChange={e => set('product_type', e.target.value)}>
          <option value="hardware">Hardware</option>
          <option value="software">Software</option>
        </FormSelect>
        <FormSelect label="Category" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
          <option value="">Select category...</option>
          {filteredCats.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
        </FormSelect>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormInput label="Brand" value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="e.g. Dell, Microsoft" />
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Unit Type <span className="text-red-500">*</span>
          </label>
          <select value={form.unit_type} onChange={e => set('unit_type', e.target.value)} required
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400">
            <option value="">Select unit...</option>
            <optgroup label="Count">
              {['Piece','Box','Set','Pack','Dozen','Pair','Bag','Bottle','Can','Roll','Sheet','Tray','Case','Carton'].map(u => <option key={u} value={u}>{u}</option>)}
            </optgroup>
            <optgroup label="Weight">
              {['Kilogram (kg)','Gram (g)','Tonne'].map(u => <option key={u} value={u}>{u}</option>)}
            </optgroup>
            <optgroup label="Volume">
              {['Litre (L)','Millilitre (ml)'].map(u => <option key={u} value={u}>{u}</option>)}
            </optgroup>
            <optgroup label="Length / Area">
              {['Meter (m)','Centimeter (cm)','Millimeter (mm)','Square Meter (m²)','Cubic Meter (m³)'].map(u => <option key={u} value={u}>{u}</option>)}
            </optgroup>
            <optgroup label="Time">
              {['Hour','Day','Month','Year'].map(u => <option key={u} value={u}>{u}</option>)}
            </optgroup>
            <optgroup label="Other">
              <option value="License">License (software)</option>
              <option value="Unit">Unit (generic)</option>
              <option value="Nos">Nos (Numbers)</option>
              <option value="Lumpsum">Lumpsum</option>
            </optgroup>
          </select>
        </div>
      </div>
      <FormSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="discontinued">Discontinued</option>
      </FormSelect>
      <FormTextArea label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Product description..." />
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
        <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
          {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

function DeleteConfirm({ name, onConfirm, onCancel, loading }: { name: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">Delete product <strong className="text-gray-800 dark:text-white">"{name}"</strong>?</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
          {loading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin';
  const fmt = (n: any) => n != null && n !== '' ? `TZS ${Number(n).toLocaleString()}` : '—';

  const [data,       setData]       = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [typeF,      setTypeF]      = useState('');
  const [catF,       setCatF]       = useState('');
  const [statusF,    setStatusF]    = useState('');
  const [page,       setPage]       = useState(1);
  const [modal,      setModal]      = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected,   setSelected]   = useState<any>(null);
  const [deleting,   setDeleting]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.list({ page, limit: 12, search: search || undefined, product_type: typeF || undefined, category_id: catF || undefined, status: statusF || undefined });
      setData(res.data);
    } finally { setLoading(false); }
  }, [page, search, typeF, catF, statusF]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { productsApi.getCategories().then(r => setCategories(r.data)).catch(() => {}); }, []);

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try { await productsApi.delete(selected.product_id); toast.success('Product deleted'); await load(); setModal(null); }
    finally { setDeleting(false); }
  };

  const filteredCats = categories.filter(c => !typeF || c.product_type === typeF || c.product_type === 'both');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Products & Equipment</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{data?.totalResults ?? 0} total products</p>
        </div>
        {canManage && (
          <button onClick={() => { setSelected(null); setModal('create'); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Product
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input type="text" placeholder="Search products, SKU, brand..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400" />
        <select value={typeF} onChange={e => { setTypeF(e.target.value); setCatF(''); setPage(1); }}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none">
          <option value="">All Types</option>
          <option value="hardware">Hardware</option>
          <option value="software">Software</option>
        </select>
        <select value={catF} onChange={e => { setCatF(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none">
          <option value="">All Categories</option>
          {filteredCats.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="discontinued">Discontinued</option>
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {['Product','SKU','Type','Category','Brand','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? Array.from({length:5}).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({length:8}).map((__, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" /></td>)}
                </tr>
              )) : data?.results.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No products found</td></tr>
              ) : data?.results.map((p: any) => (
                <tr key={p.product_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white max-w-[180px] truncate">{p.product_name}</td>
                  <td className="px-4 py-3">
                    {p.sku_barcode
                      ? <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{p.sku_barcode}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${TYPE_STYLES[p.product_type]}`}>{p.product_type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.category_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.brand ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setSelected(p); setModal('edit'); }}
                        className="px-2.5 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-md">
                        {canManage ? 'Edit' : 'View'}
                      </button>
                      {canManage && (
                        <button onClick={() => { setSelected(p); setModal('delete'); }}
                          className="px-2.5 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md">Delete</button>
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
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page === data.totalPages} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="Add Product" size="md">
        <ProductForm categories={categories} onSaved={load} onClose={() => setModal(null)} />
      </Modal>
      <Modal isOpen={modal === 'edit' && !!selected} onClose={() => setModal(null)} title="Edit Product" size="md">
        {selected && <ProductForm product={selected} categories={categories} onSaved={load} onClose={() => setModal(null)} />}
      </Modal>
      <Modal isOpen={modal === 'delete' && !!selected} onClose={() => setModal(null)} title="Delete Product" size="sm">
        <DeleteConfirm name={selected?.product_name ?? ''} onConfirm={handleDelete} onCancel={() => setModal(null)} loading={deleting} />
      </Modal>
    </div>
  );
}
