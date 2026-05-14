import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { vesselsApi, icdvsApi } from '../../api';
import { useAuth } from '../../store/authStore';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

const STATUSES   = ['active','inactive','decommissioned'] as const;
const VESSEL_TYPES = [
  'Container Ship', 'Ro-Ro', 'Bulk Carrier', 'General Cargo',
  'Car Carrier', 'Tanker', 'Ferry', 'Other',
];

export default function VesselForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '', imo_number: '', vessel_type: '',
    country_of_origin: '', notes: '', status: 'active',
  });
  const [saving, setSaving]         = useState(false);
  const [loading, setLoading]       = useState(isEdit);
  const [selectedIcdvId, setSelectedIcdvId] = useState('');
  const [icdvs, setIcdvs]           = useState<any[]>([]);
  const { isSuperAdmin, isSystemAdmin } = useAuth();
  const isCrossTenant = isSuperAdmin || isSystemAdmin;

  useEffect(() => {
    if (isCrossTenant) {
      icdvsApi.list({ limit: 200, status: 'active' }).then(r => setIcdvs(r.data.results ?? r.data));
    }
  }, [isCrossTenant]); // eslint-disable-line

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    vesselsApi.get(Number(id))
      .then(r => {
        const v = r.data;
        setForm({
          name:              v.name              ?? '',
          imo_number:        v.imo_number        ?? '',
          vessel_type:       v.vessel_type       ?? '',
          country_of_origin: v.country_of_origin ?? '',
          notes:             v.notes             ?? '',
          status:            v.status            ?? 'active',
        });
      })
      .catch(() => toast.error('Failed to load vessel'))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Vessel name is required'); return; }
    setSaving(true);
    try {
      if (isCrossTenant && !selectedIcdvId && !isEdit) {
        toast.error('Please select an ICDV for this vessel');
        setSaving(false);
        return;
      }
      const payload: any = {
        name:              form.name,
        imo_number:        form.imo_number        || null,
        vessel_type:       form.vessel_type       || null,
        country_of_origin: form.country_of_origin || null,
        notes:             form.notes             || null,
        status:            form.status as import('../../types').VesselStatus,
        ...(isCrossTenant && selectedIcdvId && !isEdit ? { icdv_id: Number(selectedIcdvId) } : {}),
      };
      if (isEdit) {
        await vesselsApi.update(Number(id), payload);
        toast.success('Vessel updated');
        navigate(`/vessels/${id}`);
      } else {
        const r = await vesselsApi.create(payload);
        toast.success('Vessel created');
        navigate(`/vessels/${r.data.vessel_id}`);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const cls = "w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500";

  if (loading) return <div className="p-6 text-center text-sm text-gray-500 animate-pulse">Loading…</div>;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">{isEdit ? 'Edit Vessel' : 'Add Vessel'}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Vessel is a reusable master record</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Vessel Name <span className="text-red-500">*</span>
            </label>
            <input value={form.name} onChange={e => set('name', e.target.value)} required className={cls} placeholder="e.g. MV Ocean Star" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">IMO Number</label>
            <input value={form.imo_number} onChange={e => set('imo_number', e.target.value)} className={cls} placeholder="e.g. IMO 9876543" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Vessel Type</label>
            <select value={form.vessel_type} onChange={e => set('vessel_type', e.target.value)} className={cls}>
              <option value="">Select type…</option>
              {VESSEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Country / Origin</label>
            <input value={form.country_of_origin} onChange={e => set('country_of_origin', e.target.value)} className={cls} placeholder="e.g. Japan" />
          </div>
          {isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={cls}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className={`${cls} resize-none`} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
          <button type="submit" disabled={saving}
            className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-70 transition-colors">
            {saving ? 'Saving…' : isEdit ? 'Update Vessel' : 'Create Vessel'}
          </button>
        </div>
      </form>
    </div>
  );
}
