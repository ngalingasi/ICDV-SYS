import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { operationsApi, vehiclesApi } from '../../api';
import type { Vehicle } from '../../types';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

const OP_TYPES   = ['inspection', 'cleaning', 'repair', 'delivery_prep', 'release'];
const OP_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];

interface FormData {
  vehicle_id: string; operation_type: string; status: string; assigned_to: string; notes: string;
}
const empty: FormData = { vehicle_id: '', operation_type: 'inspection', status: 'pending', assigned_to: '', notes: '' };

export default function OperationForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm]     = useState<FormData>({ ...empty, vehicle_id: sp.get('vehicle_id') ?? '' });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading]   = useState(isEdit);
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState<Partial<FormData>>({});

  useEffect(() => {
    vehiclesApi.list({ limit: 200 }).then(r => setVehicles(r.data.results ?? []));
    if (isEdit) {
      operationsApi.get(Number(id)).then(r => {
        const o = r.data;
        setForm({ vehicle_id: String(o.vehicle_id ?? ''), operation_type: o.operation_type ?? 'inspection', status: o.status ?? 'pending', assigned_to: o.assigned_to ?? '', notes: o.notes ?? '' });
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const set = (k: keyof FormData, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  const validate = () => {
    const e: Partial<FormData> = {};
    if (!form.vehicle_id) e.vehicle_id = 'Vehicle is required';
    if (!form.operation_type) e.operation_type = 'Operation type is required';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const payload = { vehicle_id: Number(form.vehicle_id), operation_type: form.operation_type, status: form.status, assigned_to: form.assigned_to || undefined, notes: form.notes || undefined };
      if (isEdit) {
        await operationsApi.update(Number(id), payload);
        toast.success('Operation updated');
        navigate(`/operations/${id}`);
      } else {
        const r = await operationsApi.create(payload);
        toast.success('Operation created');
        navigate(`/operations/${r.data.id}`);
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
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Operation' : 'New Operation'}</h1>
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
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Operation Type <span className="text-red-500">*</span></label>
            <select value={form.operation_type} onChange={e => set('operation_type', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {OP_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {OP_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          {/* Assigned to */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
            <input type="text" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="Optional"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Optional notes…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={() => navigate(-1)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
        <button onClick={handleSubmit} disabled={saving}
          className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : (isEdit ? 'Update Operation' : 'Create Operation')}
        </button>
      </div>
    </div>
  );
}
