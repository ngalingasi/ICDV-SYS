import { useEffect, useState, useCallback } from 'react';
import { lookupsApi } from '../../api';
import type { Sector, Region, Implementer } from '../../types';
import Modal from '../../components/tpfcs/Modal';
import { FormInput, FormTextArea } from '../../components/tpfcs/FormField';
import { toast } from '../../components/tpfcs/Toast';

type LookupTab = 'sectors' | 'regions' | 'implementers';

// ── Defined OUTSIDE all panels to prevent remount on keystroke → focus loss ──

function DeleteConfirm({ name, onConfirm, onCancel, loading }: {
  name: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Are you sure you want to delete <strong className="text-gray-800 dark:text-white">"{name}"</strong>? This cannot be undone.
      </p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">{loading ? 'Deleting...' : 'Delete'}</button>
      </div>
    </div>
  );
}

function SectorForm({ form, setForm, sectors, selected, saving, error, onSubmit, onClose }: {
  form: { name: string; parent_sector_id: string };
  setForm: (f: any) => void;
  sectors: Sector[];
  selected: Sector | null;
  saving: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}
      <FormInput
        label="Sector Name" required
        value={form.name}
        onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
        placeholder="e.g. Water and Sanitation"
      />
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Parent Sector (optional)</label>
        <select
          value={form.parent_sector_id}
          onChange={e => setForm((f: any) => ({ ...f, parent_sector_id: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400"
        >
          <option value="">None (Root sector)</option>
          {sectors.filter(s => !selected || s.sector_id !== selected.sector_id).map(s => (
            <option key={s.sector_id} value={s.sector_id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  );
}

function RegionForm({ name, setName, saving, error, onSubmit, onClose }: {
  name: string; setName: (v: string) => void;
  saving: boolean; error: string;
  onSubmit: (e: React.FormEvent) => void; onClose: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}
      <FormInput
        label="Region Name" required
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Dar es Salaam"
      />
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  );
}

function ImplementerForm({ form, setForm, saving, error, onSubmit, onClose }: {
  form: { name: string; description: string };
  setForm: (f: any) => void;
  saving: boolean; error: string;
  onSubmit: (e: React.FormEvent) => void; onClose: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}
      <FormInput
        label="Name" required
        value={form.name}
        onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
        placeholder="e.g. Ministry of Water"
      />
      <FormTextArea
        label="Description"
        value={form.description}
        onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
        placeholder="Describe the implementer's role..."
      />
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SectorsPanel() {
  const [sectors,  setSectors]  = useState<Sector[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Sector | null>(null);
  const [form,     setForm]     = useState({ name: '', parent_sector_id: '' });
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await lookupsApi.sectors(); setSectors(r.data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ name: '', parent_sector_id: '' }); setError(''); setModal('create'); };
  const openEdit   = (s: Sector) => { setSelected(s); setForm({ name: s.name, parent_sector_id: s.parent_sector_id?.toString() ?? '' }); setError(''); setModal('edit'); };
  const openDelete = (s: Sector) => { setSelected(s); setError(''); setModal('delete'); };
  const closeModal = () => setModal(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = { name: form.name, parent_sector_id: form.parent_sector_id ? Number(form.parent_sector_id) : null };
      if (modal === 'edit' && selected) await lookupsApi.updateSector(selected.sector_id, payload);
      else await lookupsApi.createSector(payload);
      await load(); setModal(null);
      toast.success(modal === 'edit' ? 'Sector updated' : 'Sector created');
    } catch (err: any) { const m = err?.response?.data?.message ?? 'Failed to save'; setError(m); toast.error('Failed', m); }
    finally { setSaving(false); }
  };

  const deleteSector = async () => {
    if (!selected) return;
    setSaving(true);
    try { await lookupsApi.deleteSector(selected.sector_id); await load(); setModal(null); }
    catch (err: any) { setError(err?.response?.data?.message ?? 'Failed to delete'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Sector
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({length:4}).map((_,i)=><div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}</div>
      ) : sectors.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No sectors yet</div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Parent Sector</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sectors.map(s => (
                <tr key={s.sector_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {s.parent_sector_id ? sectors.find(p => p.sector_id === s.parent_sector_id)?.name ?? '—' : <span className="text-xs text-gray-400">Root</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(s)} className="px-3 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg">Edit</button>
                      <button onClick={() => openDelete(s)} className="px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={closeModal} title={modal === 'edit' ? 'Edit Sector' : 'Add Sector'}>
        <SectorForm form={form} setForm={setForm} sectors={sectors} selected={selected} saving={saving} error={error} onSubmit={save} onClose={closeModal} />
      </Modal>

      <Modal isOpen={modal === 'delete'} onClose={closeModal} title="Delete Sector" size="sm">
        <DeleteConfirm name={selected?.name ?? ''} onConfirm={deleteSector} onCancel={closeModal} loading={saving} />
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function RegionsPanel() {
  const [regions,  setRegions]  = useState<Region[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Region | null>(null);
  const [name,     setName]     = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await lookupsApi.regions(); setRegions(r.data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const closeModal = () => setModal(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Region name is required'); return; }
    setSaving(true); setError('');
    try {
      if (modal === 'edit' && selected) await lookupsApi.updateRegion(selected.region_id, { region_name: name });
      else await lookupsApi.createRegion({ region_name: name });
      await load(); setModal(null);
      toast.success(modal === 'edit' ? 'Region updated' : 'Region created');
    } catch (err: any) { const m = err?.response?.data?.message ?? 'Failed to save'; setError(m); toast.error('Failed', m); }
    finally { setSaving(false); }
  };

  const deleteRegion = async () => {
    if (!selected) return;
    setSaving(true);
    try { await lookupsApi.deleteRegion(selected.region_id); await load(); setModal(null); }
    catch (err: any) { setError(err?.response?.data?.message ?? 'Failed to delete'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => { setName(''); setError(''); setModal('create'); }}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Region
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({length:5}).map((_,i)=><div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}</div>
      ) : regions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No regions yet</div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Region Name</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {regions.map(r => (
                <tr key={r.region_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{r.region_name}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setSelected(r); setName(r.region_name); setError(''); setModal('edit'); }}
                        className="px-3 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg">Edit</button>
                      <button onClick={() => { setSelected(r); setError(''); setModal('delete'); }}
                        className="px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={closeModal} title={modal === 'edit' ? 'Edit Region' : 'Add Region'}>
        <RegionForm name={name} setName={setName} saving={saving} error={error} onSubmit={save} onClose={closeModal} />
      </Modal>

      <Modal isOpen={modal === 'delete'} onClose={closeModal} title="Delete Region" size="sm">
        <DeleteConfirm name={selected?.region_name ?? ''} onConfirm={deleteRegion} onCancel={closeModal} loading={saving} />
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ImplementersPanel() {
  const [items,    setItems]    = useState<Implementer[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Implementer | null>(null);
  const [form,     setForm]     = useState({ name: '', description: '' });
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await lookupsApi.implementers(); setItems(r.data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const closeModal = () => setModal(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      if (modal === 'edit' && selected) await lookupsApi.updateImplementer(selected.implementer_id, form);
      else await lookupsApi.createImplementer(form);
      await load(); setModal(null);
      toast.success(modal === 'edit' ? 'Implementer updated' : 'Implementer created');
    } catch (err: any) { const m = err?.response?.data?.message ?? 'Failed to save'; setError(m); toast.error('Failed', m); }
    finally { setSaving(false); }
  };

  const deleteItem = async () => {
    if (!selected) return;
    setSaving(true);
    try { await lookupsApi.deleteImplementer(selected.implementer_id); await load(); setModal(null); }
    catch (err: any) { setError(err?.response?.data?.message ?? 'Failed to delete'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => { setForm({ name: '', description: '' }); setError(''); setModal('create'); }}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Implementer
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({length:4}).map((_,i)=><div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No implementers yet</div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Description</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map(i => (
                <tr key={i.implementer_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{i.name}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">{i.description ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setSelected(i); setForm({ name: i.name, description: i.description ?? '' }); setError(''); setModal('edit'); }}
                        className="px-3 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg">Edit</button>
                      <button onClick={() => { setSelected(i); setError(''); setModal('delete'); }}
                        className="px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={closeModal} title={modal === 'edit' ? 'Edit Implementer' : 'Add Implementer'}>
        <ImplementerForm form={form} setForm={setForm} saving={saving} error={error} onSubmit={save} onClose={closeModal} />
      </Modal>

      <Modal isOpen={modal === 'delete'} onClose={closeModal} title="Delete Implementer" size="sm">
        <DeleteConfirm name={selected?.name ?? ''} onConfirm={deleteItem} onCancel={closeModal} loading={saving} />
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LookupsPage() {
  const [tab, setTab] = useState<LookupTab>('sectors');

  const TABS: { key: LookupTab; label: string }[] = [
    { key: 'sectors',      label: 'Sectors' },
    { key: 'regions',      label: 'Regions' },
    { key: 'implementers', label: 'Implementers' },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800 dark:text-white">Lookup Management</h1>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sectors'      && <SectorsPanel />}
      {tab === 'regions'      && <RegionsPanel />}
      {tab === 'implementers' && <ImplementersPanel />}
    </div>
  );
}
