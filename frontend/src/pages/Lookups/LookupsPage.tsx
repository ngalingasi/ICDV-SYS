import { useEffect, useState, useCallback } from 'react';
import { lookupsApi, transferRateApi } from '../../api';
import type { Region } from '../../types';
import Modal from '../../components/tpfcs/Modal';
import { FormInput } from '../../components/tpfcs/FormField';
import { toast } from '../../components/tpfcs/Toast';
import { useAuth } from '../../store/authStore';

type LookupTab = 'regions' | 'transfer_rate';

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LookupsPage() {
  const [tab, setTab] = useState<LookupTab>('regions');

  const TABS: { key: LookupTab; label: string }[] = [
    { key: 'regions',       label: 'Regions' },
    { key: 'transfer_rate', label: 'Transfer Rate' },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800 dark:text-white">Lookup Management</h1>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
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

      {tab === 'regions'       && <RegionsPanel />}
      {tab === 'transfer_rate' && <TransferRatePanel />}
    </div>
  );
}
