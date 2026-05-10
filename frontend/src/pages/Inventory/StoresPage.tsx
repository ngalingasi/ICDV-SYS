import { useEffect, useState, useCallback } from 'react';
import { storesApi, lookupsApi } from '../../api';
import type { Region } from '../../types';
import Modal from '../../components/tpfcs/Modal';
import { FormInput, FormSelect, FormTextArea } from '../../components/tpfcs/FormField';
import { toast } from '../../components/tpfcs/Toast';
import { useAuth } from '../../store/authStore';

const STATUS_STYLES: Record<string, string> = {
  active:      'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  inactive:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  maintenance: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
};

function StoreForm({ store, regions, onSaved, onClose }: {
  store?: any; regions: Region[]; onSaved: () => void; onClose: () => void;
}) {
  const isEdit = !!store;
  const [form, setForm] = useState({
    store_name:     store?.store_name     ?? '',
    region_id:      store?.region_id?.toString() ?? '',
    address:        store?.address        ?? '',
    latitude:       store?.latitude?.toString()  ?? '',
    longitude:      store?.longitude?.toString() ?? '',
    contact_number: store?.contact_number ?? '',
    manager_name:   store?.manager_name  ?? '',
    capacity:       store?.capacity?.toString() ?? '',
    notes:          store?.notes         ?? '',
    status:         store?.status        ?? 'active',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.store_name.trim()) { setError('Store name is required'); return; }
    if (!form.region_id)         { setError('Region is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        region_id:  Number(form.region_id),
        latitude:   form.latitude  ? Number(form.latitude)  : null,
        longitude:  form.longitude ? Number(form.longitude) : null,
        capacity:   form.capacity  ? Number(form.capacity)  : null,
      };
      if (isEdit) await storesApi.update(store.store_id, payload);
      else        await storesApi.create(payload);
      toast.success(isEdit ? 'Store updated' : 'Store created');
      onSaved(); onClose();
    } catch (err: any) {
      const m = err?.response?.data?.message ?? 'Failed to save'; setError(m); toast.error('Failed', m);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <FormInput label="Store Name" required value={form.store_name} onChange={e => set('store_name', e.target.value)} placeholder="e.g. Dar es Salaam Main Store" />
        <FormSelect label="Region" required value={form.region_id} onChange={e => set('region_id', e.target.value)}>
          <option value="">Select region...</option>
          {regions.map(r => <option key={r.region_id} value={r.region_id}>{r.region_name}</option>)}
        </FormSelect>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormInput label="Manager Name" value={form.manager_name} onChange={e => set('manager_name', e.target.value)} placeholder="Store manager" />
        <FormInput label="Contact Number" value={form.contact_number} onChange={e => set('contact_number', e.target.value)} placeholder="+255712345678" />
      </div>
      <FormTextArea label="Address" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Physical address..." />
      <div className="grid grid-cols-3 gap-3">
        <FormInput label="Latitude" type="number" step="any" value={form.latitude} onChange={e => set('latitude', e.target.value)} placeholder="-6.7924" />
        <FormInput label="Longitude" type="number" step="any" value={form.longitude} onChange={e => set('longitude', e.target.value)} placeholder="39.2083" />
        <FormInput label="Capacity (units)" type="number" value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="maintenance">Maintenance</option>
        </FormSelect>
      </div>
      <FormTextArea label="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes..." />
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
      <p className="text-sm text-gray-600 dark:text-gray-400">Delete store <strong className="text-gray-800 dark:text-white">"{name}"</strong>?</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
          {loading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

export default function StoresPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin';

  const [data,     setData]     = useState<any>(null);
  const [regions,  setRegions]  = useState<Region[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [regionF,  setRegionF]  = useState('');
  const [statusF,  setStatusF]  = useState('');
  const [page,     setPage]     = useState(1);
  const [modal,    setModal]    = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storesApi.list({ page, limit: 12, search: search || undefined, region_id: regionF || undefined, status: statusF || undefined });
      setData(res.data);
    } finally { setLoading(false); }
  }, [page, search, regionF, statusF]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { lookupsApi.regions().then(r => setRegions(r.data)).catch(() => {}); }, []);

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try { await storesApi.delete(selected.store_id); toast.success('Store deleted'); await load(); setModal(null); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Store Locations</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{data?.totalResults ?? 0} total stores</p>
        </div>
        {canManage && (
          <button onClick={() => { setSelected(null); setModal('create'); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Store
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input type="text" placeholder="Search stores, manager..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none focus:border-brand-400" />
        <select value={regionF} onChange={e => { setRegionF(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none">
          <option value="">All Regions</option>
          {regions.map(r => <option key={r.region_id} value={r.region_id}>{r.region_name}</option>)}
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-900 dark:text-white focus:outline-none">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {['Store Name','Region','Manager','Contact','Capacity','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? Array.from({length:5}).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({length:7}).map((__, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" /></td>)}
                </tr>
              )) : data?.results.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No stores found</td></tr>
              ) : data?.results.map((s: any) => (
                <tr key={s.store_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-white">{s.store_name}</p>
                    {s.address && <p className="text-xs text-gray-400 truncate max-w-[160px]">{s.address}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.region_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.manager_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.contact_number ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {s.capacity ? `${Number(s.capacity).toLocaleString()} units` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[s.status]}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setSelected(s); setModal('edit'); }}
                        className="px-2.5 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-md">
                        {canManage ? 'Edit' : 'View'}
                      </button>
                      {canManage && (
                        <button onClick={() => { setSelected(s); setModal('delete'); }}
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

      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="Add Store" size="md">
        <StoreForm regions={regions} onSaved={load} onClose={() => setModal(null)} />
      </Modal>
      <Modal isOpen={modal === 'edit' && !!selected} onClose={() => setModal(null)} title="Edit Store" size="md">
        {selected && <StoreForm store={selected} regions={regions} onSaved={load} onClose={() => setModal(null)} />}
      </Modal>
      <Modal isOpen={modal === 'delete' && !!selected} onClose={() => setModal(null)} title="Delete Store" size="sm">
        <DeleteConfirm name={selected?.store_name ?? ''} onConfirm={handleDelete} onCancel={() => setModal(null)} loading={deleting} />
      </Modal>
    </div>
  );
}
