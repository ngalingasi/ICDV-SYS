import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { driversApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

const DRIVER_STATUSES = ['active', 'inactive', 'suspended'];

interface FormData {
  name: string; license_number: string; phone: string; email: string;
  address: string; status: string; notes: string;
}
const empty: FormData = { name: '', license_number: '', phone: '', email: '', address: '', status: 'active', notes: '' };

export default function DriverForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm]   = useState<FormData>(empty);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState<Partial<FormData>>({});

  useEffect(() => {
    if (isEdit) {
      driversApi.get(Number(id)).then(r => {
        const d = r.data;
        setForm({ name: d.name ?? '', license_number: d.license_number ?? '', phone: d.phone ?? '', email: d.email ?? '', address: d.address ?? '', status: d.status ?? 'active', notes: d.notes ?? '' });
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const set = (k: keyof FormData, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  const validate = () => {
    const e: Partial<FormData> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.license_number.trim()) e.license_number = 'License number is required';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const payload = { ...form, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined, notes: form.notes || undefined };
      if (isEdit) {
        await driversApi.update(Number(id), payload);
        toast.success('Driver updated');
        navigate(`/drivers/${id}`);
      } else {
        const r = await driversApi.create(payload);
        toast.success('Driver created');
        navigate(`/drivers/${r.data.id}`);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof FormData, opts?: { required?: boolean; placeholder?: string; type?: string }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{opts?.required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type={opts?.type ?? 'text'} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={opts?.placeholder}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[key] ? 'border-red-400' : 'border-gray-300'}`} />
      {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
    </div>
  );

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading…</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Driver' : 'Add Driver'}</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('Full Name', 'name', { required: true, placeholder: 'e.g. John Doe' })}
          {field('License Number', 'license_number', { required: true, placeholder: 'e.g. DL-2023-001' })}
          {field('Phone', 'phone', { type: 'tel', placeholder: 'Optional' })}
          {field('Email', 'email', { type: 'email', placeholder: 'Optional' })}
          {field('Address', 'address', { placeholder: 'Optional' })}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {DRIVER_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        </div>
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
          {saving ? 'Saving…' : (isEdit ? 'Update Driver' : 'Add Driver')}
        </button>
      </div>
    </div>
  );
}
