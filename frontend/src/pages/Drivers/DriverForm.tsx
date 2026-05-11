import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { driversApi } from '../../api';
import { toast } from '../../components/tpfcs/Toast';
import BackButton from '../../components/tpfcs/BackButton';

const DRIVER_STATUSES = ['active', 'inactive', 'suspended'];

interface FormData {
  full_name: string; license_number: string; id_number: string;
  phone: string; email: string; status: string; notes: string;
}
const empty: FormData = {
  full_name: '', license_number: '', id_number: '',
  phone: '', email: '', status: 'active', notes: '',
};

export default function DriverForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm]         = useState<FormData>(empty);
  const [photo, setPhoto]       = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null);
  const [loading, setLoading]   = useState(isEdit);
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState<Partial<FormData>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEdit) {
      driversApi.get(Number(id)).then(r => {
        const d = r.data;
        setForm({
          full_name:      d.full_name      ?? '',
          license_number: d.license_number ?? '',
          id_number:      d.id_number      ?? '',
          phone:          d.phone          ?? '',
          email:          d.email          ?? '',
          status:         d.status         ?? 'active',
          notes:          d.notes          ?? '',
        });
        if (d.photo) setExistingPhoto(d.photo);
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const set = (k: keyof FormData, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const e: Partial<FormData> = {};
    if (!form.full_name.trim())      e.full_name      = 'Full name is required';
    if (!form.license_number.trim()) e.license_number = 'License number is required';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      // Use FormData to support file upload
      const fd = new FormData();
      fd.append('full_name',      form.full_name);
      fd.append('license_number', form.license_number);
      if (form.id_number) fd.append('id_number', form.id_number);
      if (form.phone)     fd.append('phone',     form.phone);
      if (form.email)     fd.append('email',     form.email);
      fd.append('status', form.status);
      if (form.notes) fd.append('notes', form.notes);
      if (photo)      fd.append('photo', photo);

      if (isEdit) {
        await driversApi.update(Number(id), fd as any);
        toast.success('Driver updated');
        navigate(`/drivers/${id}`);
      } else {
        const r = await driversApi.create(fd as any);
        toast.success('Driver created');
        navigate(`/drivers/${r.data.driver_id}`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const field = (
    label: string,
    key: keyof FormData,
    opts?: { required?: boolean; placeholder?: string; type?: string }
  ) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{opts?.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={opts?.type ?? 'text'}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={opts?.placeholder}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          errors[key] ? 'border-red-400' : 'border-gray-300'
        }`}
      />
      {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
    </div>
  );

  const RAW_API_FORM = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000/api';
  const SERVER_BASE = RAW_API_FORM.replace(/\/api(\/v\d+)?$/, '');
  const currentPhoto = photoPreview ?? (existingPhoto ? `${SERVER_BASE}${existingPhoto}` : null);

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading…</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Driver' : 'Add Driver'}</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">

        {/* Photo upload */}
        <div className="flex items-center gap-5">
          <div
            onClick={() => fileRef.current?.click()}
            className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden hover:border-blue-400 transition-colors flex-shrink-0 bg-gray-50"
          >
            {currentPhoto ? (
              <img src={currentPhoto} alt="Driver" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-2">
                <svg className="w-8 h-8 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-xs text-gray-400 mt-1 block">Photo</span>
              </div>
            )}
          </div>
          <div>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
              {currentPhoto ? 'Change Photo' : 'Upload Photo'}
            </button>
            <p className="text-xs text-gray-400 mt-1.5">JPG, PNG or WEBP. Max 10MB.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('Full Name',      'full_name',      { required: true, placeholder: 'e.g. John Doe' })}
          {field('Driver ID No.',  'id_number',      { placeholder: 'Internal driver ID' })}
          {field('License Number', 'license_number', { required: true, placeholder: 'e.g. DL-2023-001' })}
          {field('Phone',          'phone',          { type: 'tel', placeholder: 'Optional' })}
          {field('Email',          'email',          { type: 'email', placeholder: 'Optional' })}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => set('status', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DRIVER_STATUSES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder="Optional notes…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={() => navigate(-1)}
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : (isEdit ? 'Update Driver' : 'Add Driver')}
        </button>
      </div>
    </div>
  );
}
