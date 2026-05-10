import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { manifestsApi, vesselsApi } from '../../api';
import type { Vessel } from '../../types';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

export default function ManifestForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    manifest_number: '', vessel_id: sp.get('vessel_id') ?? '',
    arrival_date: '', notes: '', status: 'pending',
  });
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    vesselsApi.list({ limit: 100 }).then(r => setVessels(r.data.results));
    if (!id) return;
    setLoading(true);
    manifestsApi.get(Number(id)).then(r => {
      const m = r.data;
      setForm({
        manifest_number: m.manifest_number, vessel_id: String(m.vessel_id),
        arrival_date: m.arrival_date?.slice(0, 10) ?? '',
        notes: m.notes ?? '', status: m.status,
      });
    }).finally(() => setLoading(false));
  }, [id]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.manifest_number.trim() || !form.vessel_id || !form.arrival_date) {
      toast('Manifest number, vessel and arrival date are required', 'error'); return;
    }
    setSaving(true);
    try {
      const payload = { ...form, vessel_id: Number(form.vessel_id), notes: form.notes || null };
      if (isEdit) {
        await manifestsApi.update(Number(id), payload);
        toast.success('Manifest updated');
        navigate(`/manifests/${id}`);
      } else {
        const r = await manifestsApi.create(payload);
        toast.success('Manifest created');
        navigate(`/manifests/${r.data.manifest_id}`);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading…</div>;

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">{isEdit ? 'Edit Manifest' : 'Add Manifest'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-5">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Manifest Number <span className="text-red-500">*</span></label>
          <input value={form.manifest_number} onChange={e => set('manifest_number', e.target.value)} required
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Vessel <span className="text-red-500">*</span></label>
          <select value={form.vessel_id} onChange={e => set('vessel_id', e.target.value)} required
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">Select vessel…</option>
            {vessels.map(v => <option key={v.vessel_id} value={v.vessel_id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Arrival Date <span className="text-red-500">*</span></label>
          <input type="date" value={form.arrival_date} onChange={e => set('arrival_date', e.target.value)} required
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        {isEdit && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500">
              {['pending','active','completed','cancelled'].map(s =>
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">Cancel</button>
          <button type="submit" disabled={saving}
            className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-70">
            {saving ? 'Saving…' : isEdit ? 'Update Manifest' : 'Create Manifest'}
          </button>
        </div>
      </form>
    </div>
  );
}
