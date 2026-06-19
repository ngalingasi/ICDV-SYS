import { useEffect, useState, useCallback } from 'react';
import { lookupsApi, transferRateApi, incidentApi, workflowApi, icdvsApi } from '../../api';
import type { Region } from '../../types';
import Modal from '../../components/tpfcs/Modal';
import { FormInput } from '../../components/tpfcs/FormField';
import { toast } from '../../components/tpfcs/Toast';
import { useAuth } from '../../store/authStore';

type LookupTab = 'regions' | 'transfer_rate' | 'incident_types' | 'transit_times' | 'invoice_items' | 'operator_config';

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

// ── Regions Panel ─────────────────────────────────────────────────────────────

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

// ── Transfer Rate Panel ───────────────────────────────────────────────────────

function TransferRatePanel() {
  const { user } = useAuth();
  const [rate,    setRate]    = useState<number | null>(null);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState(false);
  const [error,   setError]   = useState('');

  const canEdit = ['admin', 'super_admin', 'system_admin'].includes(user?.role ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await transferRateApi.get();
      setRate(r.data.rate);
      setInput(String(r.data.rate));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const val = parseFloat(input);
    if (isNaN(val) || val < 0) { setError('Enter a valid non-negative number'); return; }
    setSaving(true); setError('');
    try {
      const r = await transferRateApi.update(val);
      setRate(r.data.rate);
      setInput(String(r.data.rate));
      setEditing(false);
      toast.success('Transfer rate updated');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to update');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="space-y-3">
      <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
    </div>
  );

  return (
    <div className="max-w-xl space-y-5">
      {/* Current rate card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Global Transfer Rate</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {rate !== null ? 'TZS ' + rate.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">TZS per vehicle · applied to all manifests by default</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          </div>
        </div>

        {canEdit && !editing && (
          <button
            onClick={() => { setInput(String(rate ?? 0)); setEditing(true); setError(''); }}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Edit Rate
          </button>
        )}

        {canEdit && editing && (
          <div className="mt-4 space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">New rate per vehicle (TZS)</p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={input}
                onChange={e => {
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setInput(v);
                }}
                onKeyDown={e => e.key === 'Enter' && save()}
                autoFocus
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="e.g. 15000"
              />
              <button onClick={save} disabled={saving}
                className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setError(''); }}
                className="px-3 py-2.5 border border-gray-200 dark:border-gray-700 text-sm text-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        {!canEdit && (
          <p className="mt-3 text-xs text-gray-400 italic">Only admins can change the global transfer rate.</p>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-blue-100 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 p-4 text-sm text-blue-700 dark:text-blue-300 space-y-1">
        <p className="font-semibold text-xs uppercase tracking-wide text-blue-500 dark:text-blue-400">How it works</p>
        <p>This global rate is automatically applied to every new manifest as its default transfer rate.</p>
        <p>Each manifest can then have its rate overridden individually on the manifest edit page.</p>
        <p>The delivery sheet uses the manifest's rate to calculate <strong>Amount to Pay</strong> per driver (vehicles × rate in TZS).</p>
      </div>
    </div>
  );
}

// ── Incident Types Panel ──────────────────────────────────────────────────────

function IncidentTypesPanel() {
  const { user } = useAuth();
  const [types,   setTypes]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState<'create' | 'edit' | 'delete' | null>(null);
  const [sel,     setSel]     = useState<any>(null);
  const [name,    setName]    = useState('');
  const [sortOrd, setSortOrd] = useState('0');
  const [active,  setActive]  = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const canManage = ['admin', 'super_admin', 'system_admin'].includes(user?.role ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await incidentApi.types(); setTypes(r.data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setName(''); setSortOrd('0'); setActive(true); setError(''); setModal('create'); };
  const openEdit   = (t: any) => { setSel(t); setName(t.name); setSortOrd(String(t.sort_order ?? 0)); setActive(!!t.is_active); setError(''); setModal('edit'); };
  const openDelete = (t: any) => { setSel(t); setError(''); setModal('delete'); };
  const closeModal = () => setModal(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      if (modal === 'edit' && sel) {
        await incidentApi.updateType(sel.type_id, { name: name.trim(), sort_order: Number(sortOrd), is_active: active });
      } else {
        await incidentApi.createType({ name: name.trim(), sort_order: Number(sortOrd) });
      }
      await load(); setModal(null);
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Failed to save'); }
    finally { setSaving(false); }
  };

  const deactivate = async () => {
    if (!sel) return;
    setSaving(true);
    try {
      await incidentApi.updateType(sel.type_id, { is_active: 0 });
      await load(); setModal(null);
    } catch (err: any) { setError(err?.response?.data?.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  const SEVERITY_DOT: Record<string, string> = {};

  return (
    <div>
      {canManage && (
        <div className="flex justify-end mb-4">
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Type
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({length:6}).map((_,i)=><div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"/>)}</div>
      ) : types.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No incident types yet</div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Order</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
                {canManage && <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {types.map(t => (
                <tr key={t.type_id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!t.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{t.name}</td>
                  <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{t.sort_order}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_active ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(t)}
                          className="px-3 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg">Edit</button>
                        {t.is_active && (
                          <button onClick={() => openDelete(t)}
                            className="px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">Deactivate</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={closeModal} title={modal === 'edit' ? 'Edit Incident Type' : 'Add Incident Type'}>
        <form onSubmit={save} className="space-y-4">
          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus required
              placeholder="e.g. Tyre Puncture"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Sort Order</label>
            <input type="number" value={sortOrd} onChange={e => setSortOrd(e.target.value)} min="0"
              className="w-24 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <p className="text-xs text-gray-400 mt-1">Lower numbers appear first</p>
          </div>
          {modal === 'edit' && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="activeCheck" checked={active} onChange={e => setActive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
              <label htmlFor="activeCheck" className="text-sm text-gray-700 dark:text-gray-300">Active (visible in incident form)</label>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Deactivate confirm */}
      <Modal isOpen={modal === 'delete'} onClose={closeModal} title="Deactivate Type" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Deactivate <strong className="text-gray-800 dark:text-white">"{sel?.name}"</strong>? It will be hidden from the incident form but existing records will keep the type.
          </p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-3">
            <button onClick={closeModal} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
            <button onClick={deactivate} disabled={saving} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">{saving ? 'Deactivating…' : 'Deactivate'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Transit Times Panel ───────────────────────────────────────────────────────
// One transit time config per ICDV.
// Tracks expected TPA gate-out → ICDV yard arrival duration.
// system_admin / super_admin can pick any ICDV; regular admin only configures their own.

interface TransitConfig {
  config_id:      number;
  icdv_id:        number;
  icdv_name?:     string;
  icdv_code?:     string;
  normal_minutes: number;
  max_minutes:    number;
  notes?:         string;
}

function TransitTimesPanel() {
  const { user, isSuperAdmin, isSystemAdmin } = useAuth();
  const isCrossTenant = isSuperAdmin || isSystemAdmin;
  const canManage = user && ['admin', 'supervisor', 'super_admin', 'system_admin'].includes(user.role);

  const [configs,  setConfigs]  = useState<TransitConfig[]>([]);
  const [icdvs,    setIcdvs]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState<'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<TransitConfig | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  // Form state
  const [selectedIcdvId, setSelectedIcdvId] = useState<number | ''>('');
  const [normalMinutes,  setNormalMinutes]   = useState('30');
  const [maxMinutes,     setMaxMinutes]      = useState('60');
  const [notes,          setNotes]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await workflowApi.getTransitConfigs();
      setConfigs(r.data);
    } catch { toast.error('Failed to load transit time configs'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load ICDV list for cross-tenant users
  useEffect(() => {
    if (!isCrossTenant) return;
    icdvsApi.list({ limit: 200, status: 'active' })
      .then(r => setIcdvs(r.data.results ?? r.data))
      .catch(() => {});
  }, [isCrossTenant]);

  const openEdit = (c: TransitConfig) => {
    setSelected(c);
    setSelectedIcdvId(c.icdv_id);
    setNormalMinutes(String(c.normal_minutes));
    setMaxMinutes(String(c.max_minutes));
    setNotes(c.notes ?? '');
    setError('');
    setModal('edit');
  };

  const openCreate = () => {
    setSelected(null);
    setSelectedIcdvId('');
    setNormalMinutes('30');
    setMaxMinutes('60');
    setNotes('');
    setError('');
    setModal('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(normalMinutes);
    const m = Number(maxMinutes);
    if (isCrossTenant && !selectedIcdvId) { setError('Please select an ICDV'); return; }
    if (!n || n < 1) { setError('Normal minutes must be at least 1'); return; }
    if (!m || m <= n){ setError('Max minutes must be greater than normal minutes'); return; }

    setSaving(true); setError('');
    try {
      await workflowApi.upsertTransitConfig({
        normal_minutes: n,
        max_minutes:    m,
        notes:          notes.trim() || undefined,
        ...(isCrossTenant && selectedIcdvId ? { icdv_id: Number(selectedIcdvId) } : {}),
      });
      toast.success(selected ? 'Transit time updated' : 'Transit time saved');
      setModal(null);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await workflowApi.deleteTransitConfig(selected.config_id);
      toast.success('Transit time config deleted');
      setModal(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Delete failed');
    } finally { setSaving(false); }
  };

  // ICDVs that don't yet have a config (for the create picker)
  const configuredIcdvIds = new Set(configs.map(c => c.icdv_id));
  const availableIcdvs = icdvs.filter(ic => !configuredIcdvIds.has(ic.icdv_id));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Transit Time Configuration</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Set expected transit duration from TPA gate to each ICDV's yard.
            One config per ICDV — used by Live Transfer Monitoring to flag delayed vehicles.
          </p>
        </div>
        {canManage && (isCrossTenant ? availableIcdvs.length > 0 : configs.length === 0) && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium whitespace-nowrap">
            + Add Config
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-4 py-3 text-xs text-blue-700 dark:text-blue-400 space-y-1">
        <p className="font-semibold">Delay detection — TPA gate-out → ICDV yard arrival</p>
        <div className="flex flex-wrap gap-x-5 gap-y-0.5 mt-1">
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1.5 align-middle" />Within normal time → Green</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mr-1.5 align-middle" />Approaching max → Amber</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5 align-middle" />Exceeds max → Red (Delayed)</span>
        </div>
        <p className="text-blue-500 italic">ICDVs without a config use defaults: Normal 30 min · Max 60 min</p>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {['ICDV', 'Normal Time (TPA → Yard)', 'Max Allowed', 'Notes', ...(canManage ? ['Actions'] : [])].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 4 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" /></td>
                ))}</tr>
              ))
            ) : configs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                No transit time configs yet. All ICDVs use default: Normal 30 min, Max 60 min.
              </td></tr>
            ) : configs.map(c => (
              <tr key={c.config_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800 dark:text-white">{c.icdv_name ?? `ICDV #${c.icdv_id}`}</p>
                  {c.icdv_code && <p className="text-xs text-gray-400">{c.icdv_code}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">
                    {c.normal_minutes} min
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
                    {c.max_minutes} min
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{c.notes || '—'}</td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => openEdit(c)} className="text-xs text-brand-600 hover:underline">Edit</button>
                      <button onClick={() => { setSelected(c); setModal('delete'); }} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit / Create modal */}
      {modal === 'edit' && (
        <Modal isOpen onClose={() => setModal(null)} title={selected ? `Edit: ${selected.icdv_name ?? 'Transit Time'}` : 'Add Transit Time Config'}>
          <form onSubmit={handleSave} className="space-y-4">
            {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">{error}</p>}

            {/* ICDV picker — only for cross-tenant users; regular admin auto-uses their own ICDV */}
            {isCrossTenant && !selected && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  ICDV <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedIcdvId}
                  onChange={e => setSelectedIcdvId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select ICDV…</option>
                  {availableIcdvs.map((ic: any) => (
                    <option key={ic.icdv_id} value={ic.icdv_id}>{ic.name} ({ic.code})</option>
                  ))}
                </select>
              </div>
            )}

            {/* When editing, show ICDV name as read-only */}
            {isCrossTenant && selected && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-xs text-gray-500 block mb-0.5">ICDV</span>
                <strong>{selected.icdv_name}</strong>
                {selected.icdv_code && <span className="text-gray-400 ml-2">{selected.icdv_code}</span>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Normal Time (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" min="1" max="480"
                  value={normalMinutes} onChange={e => setNormalMinutes(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-green-600 mt-1">🟢 On-time threshold</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Max Allowed (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" min="1" max="480"
                  value={maxMinutes} onChange={e => setMaxMinutes(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-red-600 mt-1">🔴 Delayed threshold</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Notes (optional)</label>
              <input
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. 12 km from TPA, highway route"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete modal */}
      {modal === 'delete' && selected && (
        <Modal isOpen onClose={() => setModal(null)} title="Delete Transit Time Config">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Delete transit time config for <strong className="text-gray-800 dark:text-white">{selected.icdv_name}</strong>?
            {' '}This ICDV will fall back to the default (Normal 30 min, Max 60 min).
          </p>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">Cancel</button>
            <button onClick={handleDelete} disabled={saving} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
              {saving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LookupsPage() {
  const [tab, setTab] = useState<LookupTab>('regions');

  const TABS: { key: LookupTab; label: string }[] = [
    { key: 'regions',        label: 'Regions' },
    { key: 'incident_types', label: 'Incident Types' },
    { key: 'transfer_rate',  label: 'Transfer Rate' },
    { key: 'transit_times',  label: 'Transit Times' },
    { key: 'invoice_items',  label: 'Invoice Items' },
    { key: 'operator_config',label: 'Operator Details' },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800 dark:text-white">Lookup Management</h1>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'regions'        && <RegionsPanel />}
      {tab === 'incident_types' && <IncidentTypesPanel />}
      {tab === 'transfer_rate'  && <TransferRatePanel />}
      {tab === 'transit_times'  && <TransitTimesPanel />}
      {tab === 'invoice_items'  && <InvoiceItemsPanelWrapper />}
      {tab === 'operator_config'&& <OperatorConfigPanel />}
    </div>
  );
}

// ── Invoice Items wrapper (lazy import to keep file light) ──────────────────
import InvoiceItemsPanelExternal from '../Invoices/InvoiceItemsPanel';

function InvoiceItemsPanelWrapper() {
  return <InvoiceItemsPanelExternal />;
}

// ── Operator Config Panel ────────────────────────────────────────────────────
import { invoicesApi } from '../../api';

function OperatorConfigPanel() {
  const [config,  setConfig]  = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string|null>(null);

  useEffect(() => {
    invoicesApi.getOperatorConfig()
      .then(r => setConfig(r.data))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: string, v: string) => setConfig(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const res = await invoicesApi.updateOperatorConfig(config);
      setConfig(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Save failed');
    } finally { setSaving(false); }
  };

  const fields: { key: string; label: string; placeholder?: string }[] = [
    { key: 'name',         label: 'Company Name',     placeholder: 'ODOGWU COMPANY LIMITED' },
    { key: 'address',      label: 'Address',          placeholder: 'Kinondoni, Macho Street' },
    { key: 'phone',        label: 'Phone',            placeholder: '0762-992-000' },
    { key: 'email',        label: 'Email',            placeholder: 'info@odogwu.tz' },
    { key: 'tin',          label: 'TIN',              placeholder: 'Tax Identification Number' },
    { key: 'vrn',          label: 'VRN',              placeholder: 'VAT Registration Number' },
    { key: 'bank_name',    label: 'Bank Name',        placeholder: 'NMB Bank' },
    { key: 'bank_account', label: 'Bank Account No.', placeholder: '22610059509' },
    { key: 'bank_branch',  label: 'Bank Branch',      placeholder: 'Branch name (optional)' },
  ];

  if (loading) return <div className="text-sm text-gray-400 animate-pulse">Loading operator config…</div>;

  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        These details appear on every invoice as the issuing operator (Odogwu Company Limited).
      </p>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{f.label}</label>
            <input
              value={config[f.key] ?? ''}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        ))}

        {error  && <p className="text-xs text-red-500">{error}</p>}
        {saved  && <p className="text-xs text-green-600 dark:text-green-400">Saved successfully.</p>}

        <button onClick={save} disabled={saving}
          className="px-6 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors">
          {saving ? 'Saving…' : 'Save Operator Details'}
        </button>
      </div>
    </div>
  );
}
