import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { vesselsApi, icdvsApi } from '../../api';
import { useAuth } from '../../store/authStore';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';
import DatePicker from '../../components/form/date-picker';

// DB schema status enum: expected | arrived | processing | completed | departed
const STATUSES = ['expected', 'arrived', 'processing', 'completed', 'departed'] as const;

const VESSEL_TYPES = [
  'Container Ship', 'Ro-Ro', 'Bulk Carrier', 'General Cargo',
  'Car Carrier', 'Tanker', 'Ferry', 'Other',
];

export default function VesselForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  // All fields matching the DB vessels table
  const [form, setForm] = useState({
    name:              '',
    imo_number:        '',
    vessel_type:       '',
    flag:              '',
    shipping_line:     '',
    country_of_origin: '',
    port_of_origin:    '',
    berth_number:      '',
    arrival_date:      '',
    departure_date:    '',
    notes:             '',
    status:            'expected',
  });

  const [saving,          setSaving]          = useState(false);
  const [loading,         setLoading]         = useState(isEdit);
  const [selectedIcdvId,  setSelectedIcdvId]  = useState('');
  const [icdvs,           setIcdvs]           = useState<any[]>([]);
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
          flag:              v.flag              ?? '',
          shipping_line:     v.shipping_line     ?? '',
          country_of_origin: v.country_of_origin ?? '',
          port_of_origin:    v.port_of_origin    ?? '',
          berth_number:      v.berth_number      ?? '',
          arrival_date:      v.arrival_date   ? v.arrival_date.slice(0, 10)   : '',
          departure_date:    v.departure_date ? v.departure_date.slice(0, 10) : '',
          notes:             v.notes             ?? '',
          status:            v.status            ?? 'expected',
        });
      })
      .catch(() => toast.error('Failed to load vessel'))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())     { toast.error('Vessel name is required');  return; }
    if (!form.arrival_date)    { toast.error('Arrival date is required'); return; }
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
        flag:              form.flag              || null,
        shipping_line:     form.shipping_line     || null,
        country_of_origin: form.country_of_origin || null,
        port_of_origin:    form.port_of_origin    || null,
        berth_number:      form.berth_number      || null,
        arrival_date:      form.arrival_date      || null,
        departure_date:    form.departure_date    || null,
        notes:             form.notes             || null,
        status:            form.status,
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isEdit ? 'Update vessel details' : 'Register a new vessel'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-5">

        {/* ICDV selector — super/system admin only */}
        {isCrossTenant && !isEdit && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              ICDV <span className="text-red-500">*</span>
            </label>
            <select value={selectedIcdvId} onChange={e => setSelectedIcdvId(e.target.value)} required className={cls}>
              <option value="">Select ICDV…</option>
              {icdvs.map(i => <option key={i.icdv_id} value={i.icdv_id}>{i.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Vessel Name */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Vessel Name <span className="text-red-500">*</span>
            </label>
            <input value={form.name} onChange={e => set('name', e.target.value)} required className={cls} placeholder="e.g. MV Ocean Star" />
          </div>

          {/* IMO Number */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">IMO Number</label>
            <input value={form.imo_number} onChange={e => set('imo_number', e.target.value)} className={cls} placeholder="e.g. IMO 9876543" />
          </div>

          {/* Vessel Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Vessel Type</label>
            <select value={form.vessel_type} onChange={e => set('vessel_type', e.target.value)} className={cls}>
              <option value="">Select type…</option>
              {VESSEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Flag */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Flag</label>
            <input value={form.flag} onChange={e => set('flag', e.target.value)} className={cls} placeholder="e.g. Panama" />
          </div>

          {/* Shipping Line */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Shipping Line</label>
            <input value={form.shipping_line} onChange={e => set('shipping_line', e.target.value)} className={cls} placeholder="e.g. Maersk" />
          </div>

          {/* Country of Origin */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Country of Origin</label>
            <input value={form.country_of_origin} onChange={e => set('country_of_origin', e.target.value)} className={cls} placeholder="e.g. Japan" />
          </div>

          {/* Port of Origin */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Port of Origin</label>
            <input value={form.port_of_origin} onChange={e => set('port_of_origin', e.target.value)} className={cls} placeholder="e.g. Yokohama" />
          </div>

          {/* Berth Number */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Berth Number</label>
            <input value={form.berth_number} onChange={e => set('berth_number', e.target.value)} className={cls} placeholder="e.g. B-12" />
          </div>

          {/* Arrival Date — flatpickr datepicker */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Arrival Date <span className="text-red-500">*</span>
            </label>
            <DatePicker
              id="vessel-arrival-date"
              placeholder="Select arrival date"
              defaultDate={form.arrival_date || undefined}
              onChange={(dates) => {
                if (dates[0]) {
                  const d = dates[0];
                  const yyyy = d.getFullYear();
                  const mm   = String(d.getMonth() + 1).padStart(2, '0');
                  const dd   = String(d.getDate()).padStart(2, '0');
                  set('arrival_date', `${yyyy}-${mm}-${dd}`);
                } else {
                  set('arrival_date', '');
                }
              }}
            />
          </div>

          {/* Departure Date — flatpickr datepicker */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Departure Date</label>
            <DatePicker
              id="vessel-departure-date"
              placeholder="Select departure date"
              defaultDate={form.departure_date || undefined}
              onChange={(dates) => {
                if (dates[0]) {
                  const d = dates[0];
                  const yyyy = d.getFullYear();
                  const mm   = String(d.getMonth() + 1).padStart(2, '0');
                  const dd   = String(d.getDate()).padStart(2, '0');
                  set('departure_date', `${yyyy}-${mm}-${dd}`);
                } else {
                  set('departure_date', '');
                }
              }}
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={cls}>
              {STATUSES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className={`${cls} resize-none`} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-70 transition-colors">
            {saving ? 'Saving…' : isEdit ? 'Update Vessel' : 'Create Vessel'}
          </button>
        </div>
      </form>
    </div>
  );
}
