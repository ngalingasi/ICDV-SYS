import { useEffect, useState } from 'react';
import { invoicesApi } from '../../api';

export default function InvoiceItemsPanel() {
  const [items,   setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null); // null = new, object = edit
  const [form,    setForm]    = useState({ name: '', description: '', default_rate: '', unit: 'vehicle', status: 'active' });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string|null>(null);

  const load = () => {
    setLoading(true);
    invoicesApi.listItems().then(r => setItems(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew  = () => { setForm({ name: '', description: '', default_rate: '', unit: 'vehicle', status: 'active' }); setEditing({}); setError(null); };
  const openEdit = (item: any) => { setForm({ name: item.name, description: item.description ?? '', default_rate: item.default_rate, unit: item.unit, status: item.status }); setEditing(item); setError(null); };
  const close    = () => { setEditing(null); setError(null); };

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError(null);
    try {
      if (editing?.item_id) await invoicesApi.updateItem(editing.item_id, { ...form, default_rate: parseFloat(form.default_rate) || 0 });
      else                  await invoicesApi.createItem({ ...form, default_rate: parseFloat(form.default_rate) || 0 });
      close(); load();
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  const deactivate = async (id: number) => {
    if (!window.confirm('Deactivate this item? It will no longer appear in new invoices.')) return;
    await invoicesApi.deleteItem(id).catch(() => {});
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{items.length} catalog items</p>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-medium">
          + New Item
        </button>
      </div>

      {/* Modal */}
      {editing !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 space-y-4 relative z-[201]">
            <h2 className="text-base font-bold text-gray-800 dark:text-white">{editing?.item_id ? 'Edit Item' : 'New Invoice Item'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Default Rate (TZS)</label>
                  <input type="number" min={0} value={form.default_rate} onChange={e => setForm(f => ({ ...f, default_rate: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
                    <option value="vehicle">Per Vehicle</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="trip">Per Trip</option>
                    <option value="day">Per Day</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={save} disabled={saving} className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={close} className="flex-1 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading
        ? <p className="text-sm text-gray-400">Loading…</p>
        : items.length === 0
          ? <p className="text-sm text-gray-400">No catalog items yet. Create one to use in invoices.</p>
          : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    {['Name','Unit','Default Rate','Status',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map(item => (
                    <tr key={item.item_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 dark:text-white">{item.name}</p>
                        {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 capitalize">{item.unit}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-800 dark:text-white">
                        TZS {Number(item.default_rate).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${item.status === 'active' ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(item)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Edit</button>
                          {item.status === 'active' && <button onClick={() => deactivate(item.item_id)} className="text-xs text-red-500 hover:underline">Deactivate</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }
    </div>
  );
}
