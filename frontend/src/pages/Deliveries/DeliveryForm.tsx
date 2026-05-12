import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { deliveriesApi, vehiclesApi, driversApi } from '../../api';
import type { Vehicle, Driver } from '../../types';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

const DELIVERY_STATUSES = ['scheduled', 'in_transit', 'delivered', 'failed', 'cancelled'];

interface FormData {
  vehicle_id: string; driver_id: string; status: string;
  scheduled_date: string; delivery_address: string; notes: string;
}
const empty: FormData = { vehicle_id: '', driver_id: '', status: 'scheduled', scheduled_date: '', delivery_address: '', notes: '' };

export default function DeliveryForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm]       = useState<FormData>({ ...empty, vehicle_id: sp.get('vehicle_id') ?? '' });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers]   = useState<Driver[]>([]);
  const [loading, setLoading]   = useState(isEdit);
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState<Partial<FormData>>({});

  useEffect(() => {
    Promise.all([
      vehiclesApi.list({ limit: 200 }),
      driversApi.list({ limit: 200 }),
    ]).then(([vr, dr]) => { setVehicles(vr.data.results ?? []); setDrivers(dr.data.results ?? []); });
    if (isEdit) {
      deliveriesApi.get(Number(id)).then(r => {
        const d = r.data;
        setForm({
          vehicle_id: String(d.vehicle_id ?? ''),
          driver_id: String(d.driver_id ?? ''),
          status: d.status ?? 'scheduled',
          scheduled_date: d.scheduled_date ? d.scheduled_date.slice(0, 10) : '',
          delivery_address: d.delivery_address ?? '',
          notes: d.notes ?? '',
        });
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const set = (k: keyof FormData, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  const validate = () => {
    const e: Partial<FormData> = {};
    if (!form.vehicle_id) e.vehicle_id = 'Vehicle is required';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const payload = {
        vehicle_id: Number(form.vehicle_id),
        driver_id: form.driver_id ? Number(form.driver_id) : undefined,
        status: form.status as import('../../types').DeliveryStatus,
        scheduled_date: form.scheduled_date || undefined,
        delivery_address: form.delivery_address || undefined,
        notes: form.notes || undefined,
      };
      if (isEdit) {
        await deliveriesApi.update(Number(id), payload);
        toast.success('Delivery updated');
        navigate(`/deliveries/${id}`);
      } else {
        const r = await deliveriesApi.create(payload);
        toast.success('Delivery created');
        navigate(`/deliveries/${r.data.id}`);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Save failed');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading…</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Delivery' : 'New Delivery'}</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        {/* Vehicle */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle <span className="text-red-500">*</span></label>
          <select value={form.vehicle_id} onChange={e => set('vehicle_id', e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.vehicle_id ? 'border-red-400' : 'border-gray-300'}`}>
            <option value="">— Select vehicle —</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.chassis_number} {v.brand ? `(${v.brand} ${v.model ?? ''})` : ''}</option>
            ))}
          </select>
          {errors.vehicle_id && <p className="text-xs text-red-500 mt-1">{errors.vehicle_id}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Driver */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Driver</label>
            <select value={form.driver_id} onChange={e => set('driver_id', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Optional —</option>
              {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.full_name} ({d.license_number})</option>)}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {DELIVERY_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          {/* Scheduled date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Date</label>
            <input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Address</label>
          <input type="text" value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} placeholder="Optional"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Optional…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={() => navigate(-1)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
        <button onClick={handleSubmit} disabled={saving}
          className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : (isEdit ? 'Update Delivery' : 'Create Delivery')}
        </button>
      </div>
    </div>
  );
}
