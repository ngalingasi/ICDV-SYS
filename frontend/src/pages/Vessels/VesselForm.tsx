import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { vesselsApi } from '../../api';
import type { Vessel } from '../../types';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

const STATUSES = ['expected','arrived','processing','completed','departed'] as const;

export default function VesselForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '', imo_number: '', flag: '', shipping_line: '',
    arrival_date: '', departure_date: '', berth_number: '',
    port_of_origin: '', notes: '', status: 'expected',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    vesselsApi.get(Number(id))
      .then(r => {
        const v: Vessel = r.data;
        setForm({
          name: v.name, imo_number: v.imo_number ?? '', flag: v.flag ?? '',
          shipping_line: v.shipping_line ?? '',
          arrival_date: v.arrival_date?.slice(0, 10) ?? '',
          departure_date: v.departure_date?.slice(0, 10) ?? '',
          berth_number: v.berth_number ?? '', port_of_origin: v.port_of_origin ?? '',
          notes: v.notes ?? '', status: v.status,
        });
      })
      .catch(() => toast.error('Failed to load vessel'))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.arrival_date) {
      toast.error('Name and arrival date are required'); return;
    }
    setSaving(true);
    try {
      const payload = { ...form,
        imo_number: form.imo_number || null, flag: form.flag || null,
        shipping_line: form.shipping_line || null, departure_date: form.departure_date || null,
        berth_number: form.berth_number || null, port_of_origin: form.port_of_origin || null,
        notes: form.notes || null,
      };
      if (isEdit) {
        await vesselsApi.update(Number(id), payload);
        toast.success('Vessel updated');
      } else {
        const r = await vesselsApi.create(payload);
        toast.success('Vessel created');
        navigate(`/vessels/${r.data.vessel_id}`);
        return;
      }
      navigate(`/vessels/${id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-sm text-gray-500 animate-pulse">Loading…</div>;

  const Field = ({ label, name, type = 'text', required = false }: { label: string; name: string; type?: string; required?: boolean }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type={type} value={(form as any)[name]} onChange={e => set(name, e.target.value)}
        required={required}
        className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">{isEdit ? 'Edit Vessel' : 'Add Vessel'}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Fill in the vessel details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Vessel Name" name="name" required />
          <Field label="IMO Number" name="imo_number" />
          <Field label="Shipping Line" name="shipping_line" />
          <Field label="Flag (Country)" name="flag" />
          <Field label="Arrival Date" name="arrival_date" type="date" required />
          <Field label="Departure Date" name="departure_date" type="date" />
          <Field label="Berth Number" name="berth_number" />
          <Field label="Port of Origin" name="port_of_origin" />
        </div>

        {isEdit && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500">
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
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
