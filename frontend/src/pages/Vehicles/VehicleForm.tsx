import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { vehiclesApi, manifestsApi } from '../../api';
import type { Manifest } from '../../types';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

const RELEASE_STATUSES   = ['unreleased', 'released', 'collected', 'on_hold'];
const OP_STATUSES        = ['pending', 'in_operation', 'ready', 'delivered', 'cancelled'];

interface FormData {
  chassis_number: string; engine_number: string; brand: string; model: string;
  year: string; color: string; customer_name: string; destination: string;
  manifest_id: string; release_status: string; operational_status: string;
}

const empty: FormData = {
  chassis_number: '', engine_number: '', brand: '', model: '', year: '',
  color: '', customer_name: '', destination: '', manifest_id: '',
  release_status: 'unreleased', operational_status: 'pending',
};

export default function VehicleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm]         = useState<FormData>(empty);
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [loading, setLoading]   = useState(isEdit);
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState<Partial<FormData>>({});

  useEffect(() => {
    manifestsApi.list({ limit: 200 }).then(r => setManifests(r.data.results ?? []));
    if (isEdit) {
      vehiclesApi.get(Number(id)).then(r => {
        const v = r.data;
        setForm({
          chassis_number: v.chassis_number ?? '',
          engine_number: v.engine_number ?? '',
          brand: v.brand ?? '',
          model: v.model ?? '',
          year: String(v.year ?? ''),
          color: v.color ?? '',
          customer_name: v.customer_name ?? '',
          destination: v.destination ?? '',
          manifest_id: String(v.manifest_id ?? ''),
          release_status: v.release_status ?? 'unreleased',
          operational_status: v.operational_status ?? 'pending',
        });
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const set = (k: keyof FormData, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: Partial<FormData> = {};
    if (!form.chassis_number.trim()) e.chassis_number = 'Chassis number is required';
    if (!form.brand.trim()) e.brand = 'Brand is required';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        year: form.year ? Number(form.year) : undefined,
        manifest_id: form.manifest_id ? Number(form.manifest_id) : undefined,
        engine_number: form.engine_number || undefined,
        color: form.color || undefined,
        customer_name: form.customer_name || undefined,
        destination: form.destination || undefined,
        release_status: form.release_status as import('../../types').ReleaseStatus,
        operational_status: form.operational_status as import('../../types').OperationalStatus,
      };
      if (isEdit) {
        await vehiclesApi.update(Number(id), payload);
        toast.success('Vehicle updated');
        navigate(`/vehicles/${id}`);
      } else {
        const r = await vehiclesApi.create(payload);
        toast.success('Vehicle created');
        navigate(`/vehicles/${r.data.id}`);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof FormData, opts?: { type?: string; required?: boolean; placeholder?: string }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{opts?.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={opts?.type ?? 'text'}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={opts?.placeholder}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[key] ? 'border-red-400' : 'border-gray-300'}`}
      />
      {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
    </div>
  );

  const select = (label: string, key: keyof FormData, options: { value: string; label: string }[]) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select value={form[key]} onChange={e => set(key, e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Vehicle' : 'Add Vehicle'}</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700 border-b pb-3">Vehicle Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('Chassis Number', 'chassis_number', { required: true, placeholder: 'e.g. WVWZZZ1JZ3W386752' })}
          {field('Engine Number', 'engine_number', { placeholder: 'Optional' })}
          {field('Brand', 'brand', { required: true, placeholder: 'e.g. Toyota' })}
          {field('Model', 'model', { placeholder: 'e.g. Corolla' })}
          {field('Year', 'year', { type: 'number', placeholder: 'e.g. 2023' })}
          {field('Color', 'color', { placeholder: 'e.g. White' })}
          {field('Customer Name', 'customer_name', { placeholder: 'Optional' })}
          {field('Destination', 'destination', { placeholder: 'Optional' })}
        </div>

        <h2 className="text-sm font-semibold text-gray-700 border-b pb-3 pt-2">Assignment & Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Manifest</label>
            <select value={form.manifest_id} onChange={e => set('manifest_id', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Select manifest —</option>
              {manifests.map(m => (
                <option key={m.id} value={m.id}>#{m.manifest_number} {m.vessel_name ? `(${m.vessel_name})` : ''}</option>
              ))}
            </select>
          </div>
          {select('Release Status', 'release_status', RELEASE_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') })))}
          {select('Operational Status', 'operational_status', OP_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') })))}
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={() => navigate(-1)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
        <button onClick={handleSubmit} disabled={saving}
          className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : (isEdit ? 'Update Vehicle' : 'Add Vehicle')}
        </button>
      </div>
    </div>
  );
}
