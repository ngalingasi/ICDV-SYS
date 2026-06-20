// ─────────────────────────────────────────────────────────────────────────────
// NEW FILE: frontend/src/pages/SuperAdmin/IcdvForm.tsx
// Super admin: create or edit an ICDV tenant.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import PageBreadCrumb from '../../components/common/PageBreadCrumb';
import { icdvsApi } from '../../api';

interface FormState {
  name:     string;
  code:     string;
  email:    string;
  phone:    string;
  city:     string;
  country:  string;
  address:  string;
  tin:      string;
  vrn:      string;
  is_active: string;
}

const EMPTY: FormState = {
  name: '', code: '', email: '', phone: '',
  city: 'Dar es Salaam', country: 'Tanzania',
  address: '', is_active: '1',
  tin: '', vrn: '',
};

export default function IcdvForm() {
  const { icdvId } = useParams<{ icdvId: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(icdvId);

  const [form,     setForm]     = useState<FormState>(EMPTY);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [apiError, setApiError] = useState('');
  const [errors,   setErrors]   = useState<Partial<FormState>>({});

  useEffect(() => {
    if (!isEdit || !icdvId) return;
    setLoading(true);
    icdvsApi.get(Number(icdvId))
      .then(r => setForm({
        name:      r.data.name      ?? '',
        code:      r.data.code      ?? '',
        email:     r.data.email     ?? '',
        phone:     r.data.phone     ?? '',
        city:      r.data.city      ?? '',
        country:   r.data.country   ?? 'Tanzania',
        address:   r.data.address   ?? '',
        tin:       r.data.tin       ?? '',
        vrn:       r.data.vrn       ?? '',
        is_active: String(r.data.is_active ?? 1),
      }))
      .catch(() => setApiError('Failed to load ICDV'))
      .finally(() => setLoading(false));
  }, [icdvId, isEdit]);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(f => ({ ...f, [field]: e.target.value }));
      setErrors(er => ({ ...er, [field]: undefined }));
    };

  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.name.trim()) errs.name = 'ICDV name is required';
    if (!form.code.trim()) errs.code = 'Code is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true); setApiError('');
    const payload = { ...form, is_active: Number(form.is_active) };
    try {
      if (isEdit && icdvId) {
        await icdvsApi.update(Number(icdvId), payload);
        navigate(`/super-admin/icdvs/${icdvId}`);
      } else {
        const res = await icdvsApi.create(payload);
        navigate(`/super-admin/icdvs/${res.data.icdv_id}`);
      }
    } catch (e: any) {
      setApiError(e?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      {Array.from({length:5}).map((_,i) => <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
    </div>
  );

  const InputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400";
  const LabelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";
  const ErrCls   = "mt-1 text-xs text-red-500";

  return (
    <div className="p-4 sm:p-6">
      <PageBreadCrumb pageTitle={isEdit ? 'Edit ICDV' : 'New ICDV'} />

      <div className="mb-4 p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-400 text-xs">
        Super Admin · Platform Management
      </div>

      <div className="max-w-2xl">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            {isEdit ? 'Edit ICDV' : 'Register New ICDV'}
          </h1>

          {apiError && <div className="mb-5 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{apiError}</div>}

          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={LabelCls}>ICDV Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={set('name')}
                  placeholder="e.g. Tanzania Ports Authority ICDV"
                  className={InputCls} />
                {errors.name && <p className={ErrCls}>{errors.name}</p>}
              </div>
              <div>
                <label className={LabelCls}>Code <span className="text-red-500">*</span></label>
                <input type="text" value={form.code} onChange={set('code')}
                  placeholder="e.g. TPA-DSM"
                  className={InputCls + ' uppercase'} />
                {errors.code && <p className={ErrCls}>{errors.code}</p>}
              </div>
              <div>
                <label className={LabelCls}>Status</label>
                <select value={form.is_active} onChange={set('is_active')} className={InputCls}>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div>
                <label className={LabelCls}>Email</label>
                <input type="email" value={form.email} onChange={set('email')} className={InputCls} />
              </div>
              <div>
                <label className={LabelCls}>Phone</label>
                <input type="tel" value={form.phone} onChange={set('phone')} className={InputCls} />
              </div>
              <div>
                <label className={LabelCls}>City</label>
                <input type="text" value={form.city} onChange={set('city')} className={InputCls} />
              </div>
              <div>
                <label className={LabelCls}>Country</label>
                <input type="text" value={form.country} onChange={set('country')} className={InputCls} />
              </div>
              <div>
                <label className={LabelCls}>TIN <span className="text-gray-400 font-normal">(Tax ID)</span></label>
                <input type="text" value={form.tin} onChange={set('tin')} className={InputCls} placeholder="100-237-350" />
              </div>
              <div>
                <label className={LabelCls}>VRN <span className="text-gray-400 font-normal">(VAT Reg. No.)</span></label>
                <input type="text" value={form.vrn} onChange={set('vrn')} className={InputCls} placeholder="10011831D" />
              </div>
              <div className="sm:col-span-2">
                <label className={LabelCls}>Address</label>
                <textarea rows={2} value={form.address} onChange={set('address')} className={InputCls} />
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={handleSubmit} disabled={saving}
              className="px-5 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create ICDV'}
            </button>
            <Link to={isEdit ? `/super-admin/icdvs/${icdvId}` : '/super-admin/icdvs'}
              className="px-5 py-2.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
