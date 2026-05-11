// ─────────────────────────────────────────────────────────────────────────────
// FILE: frontend/src/pages/SuperAdmin/CreateIcdvWizard.tsx
//
// A 2-step wizard for super admins to:
//   Step 1 — Register a new ICDV (tenant)
//   Step 2 — Create the ICDV's first admin user (optional but encouraged)
//
// Route (add to App.tsx):
//   <Route path="/super-admin/icdvs/create" element={<CreateIcdvWizard />} />
//
// Also update IcdvList.tsx: change the "New ICDV" link from
//   to="/super-admin/icdvs/new"  →  to="/super-admin/icdvs/create"
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import PageBreadCrumb from '../../components/common/PageBreadCrumb';
import { icdvsApi } from '../../api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface IcdvForm {
  name: string;
  code: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  address: string;
  is_active: string;
}

interface AdminForm {
  full_name: string;
  username: string;
  email: string;
  mobile: string;
  password: string;
  confirm_password: string;
}

interface FieldError<T> {
  [key: string]: string | undefined;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const ICDV_EMPTY: IcdvForm = {
  name: '', code: '', email: '', phone: '',
  city: 'Dar es Salaam', country: 'Tanzania',
  address: '', is_active: '1',
};

const ADMIN_EMPTY: AdminForm = {
  full_name: '', username: '', email: '', mobile: '',
  password: '', confirm_password: '',
};

// ─── Shared Styles ────────────────────────────────────────────────────────────
const InputCls =
  'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 ' +
  'text-gray-800 dark:text-white px-3 py-2.5 text-sm focus:outline-none ' +
  'focus:border-brand-400 focus:ring-1 focus:ring-brand-400 transition-colors';
const LabelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
const ErrCls   = 'mt-1 text-xs text-red-500';

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 }) {
  const steps = [
    { n: 1, label: 'ICDV Details',  icon: BuildingIcon },
    { n: 2, label: 'Admin Account', icon: UserIcon },
  ];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, idx) => {
        const done    = step > s.n;
        const active  = step === s.n;
        const Icon    = s.icon;
        return (
          <div key={s.n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                transition-all duration-300
                ${done   ? 'bg-green-500 text-white'
                : active ? 'bg-brand-500 text-white ring-4 ring-brand-100 dark:ring-brand-500/20'
                         : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}
              `}>
                {done
                  ? <CheckIcon className="w-5 h-5" />
                  : <Icon className="w-5 h-5" />
                }
              </div>
              <span className={`
                mt-2 text-xs font-medium whitespace-nowrap
                ${active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'}
              `}>{s.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`
                h-0.5 w-20 sm:w-32 mx-2 mb-5 rounded transition-all duration-500
                ${step > s.n ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}
              `} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: ICDV Form ────────────────────────────────────────────────────────
function Step1({
  form, errors, apiError, saving,
  onChange, onSubmit,
}: {
  form: IcdvForm;
  errors: FieldError<IcdvForm>;
  apiError: string;
  saving: boolean;
  onChange: (field: keyof IcdvForm) => (e: React.ChangeEvent<any>) => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Register ICDV</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Enter the details for the new ICDV tenant. Fields marked <span className="text-red-500">*</span> are required.
        </p>
      </div>

      {apiError && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm flex items-start gap-2">
          <AlertIcon className="w-4 h-4 mt-0.5 shrink-0" />
          {apiError}
        </div>
      )}

      <div className="space-y-5">
        {/* Name — full width */}
        <div>
          <label className={LabelCls}>ICDV Name <span className="text-red-500">*</span></label>
          <input
            type="text" value={form.name} onChange={onChange('name')}
            placeholder="e.g. Tanzania Ports Authority – Dar es Salaam"
            className={InputCls}
          />
          {errors.name && <p className={ErrCls}>{errors.name}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Code */}
          <div>
            <label className={LabelCls}>
              Code <span className="text-red-500">*</span>
              <span className="ml-1.5 text-gray-400 font-normal">(short identifier)</span>
            </label>
            <input
              type="text" value={form.code} onChange={onChange('code')}
              placeholder="e.g. TPA-DSM"
              className={InputCls + ' uppercase tracking-widest'}
            />
            {errors.code && <p className={ErrCls}>{errors.code}</p>}
          </div>

          {/* Status */}
          <div>
            <label className={LabelCls}>Status</label>
            <select value={form.is_active} onChange={onChange('is_active')} className={InputCls}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </div>

          {/* Email */}
          <div>
            <label className={LabelCls}>Contact Email</label>
            <input type="email" value={form.email} onChange={onChange('email')} placeholder="info@icdv.co.tz" className={InputCls} />
          </div>

          {/* Phone */}
          <div>
            <label className={LabelCls}>Contact Phone</label>
            <input type="tel" value={form.phone} onChange={onChange('phone')} placeholder="+255 22 000 0000" className={InputCls} />
          </div>

          {/* City */}
          <div>
            <label className={LabelCls}>City</label>
            <input type="text" value={form.city} onChange={onChange('city')} className={InputCls} />
          </div>

          {/* Country */}
          <div>
            <label className={LabelCls}>Country</label>
            <input type="text" value={form.country} onChange={onChange('country')} className={InputCls} />
          </div>
        </div>

        {/* Address — full width */}
        <div>
          <label className={LabelCls}>Address</label>
          <textarea rows={2} value={form.address} onChange={onChange('address')} placeholder="Physical address…" className={InputCls} />
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Link
          to="/super-admin/icdvs"
          className="px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={onSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? (
            <>
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              Creating ICDV…
            </>
          ) : (
            <>
              Next: Create Admin
              <ChevronRightIcon className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Admin User Form ──────────────────────────────────────────────────
function Step2({
  icdvName, form, errors, apiError, saving,
  onChange, onSubmit, onSkip,
}: {
  icdvName: string;
  form: AdminForm;
  errors: FieldError<AdminForm>;
  apiError: string;
  saving: boolean;
  onChange: (field: keyof AdminForm) => (e: React.ChangeEvent<any>) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  const [showPw, setShowPw] = useState(false);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create ICDV Admin</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Set up the first administrator for{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-200">{icdvName}</span>.
          This user will have full access to manage this ICDV.
        </p>
      </div>

      {/* Info callout */}
      <div className="mb-5 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 text-sm flex gap-3">
        <InfoIcon className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          The admin will be assigned role <code className="text-xs bg-blue-100 dark:bg-blue-500/20 px-1.5 py-0.5 rounded font-mono">admin</code> and scoped exclusively to this ICDV. They will be prompted to change their password on first login.
        </div>
      </div>

      {apiError && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm flex items-start gap-2">
          <AlertIcon className="w-4 h-4 mt-0.5 shrink-0" />
          {apiError}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={LabelCls}>Full Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.full_name} onChange={onChange('full_name')} placeholder="e.g. John Mwita" className={InputCls} />
            {errors.full_name && <p className={ErrCls}>{errors.full_name}</p>}
          </div>

          <div>
            <label className={LabelCls}>Username <span className="text-red-500">*</span></label>
            <input type="text" value={form.username} onChange={onChange('username')} placeholder="e.g. jmwita" className={InputCls} autoComplete="off" />
            {errors.username && <p className={ErrCls}>{errors.username}</p>}
          </div>

          <div>
            <label className={LabelCls}>Email <span className="text-red-500">*</span></label>
            <input type="email" value={form.email} onChange={onChange('email')} placeholder="admin@icdv.co.tz" className={InputCls} autoComplete="off" />
            {errors.email && <p className={ErrCls}>{errors.email}</p>}
          </div>

          <div>
            <label className={LabelCls}>Mobile</label>
            <input type="tel" value={form.mobile} onChange={onChange('mobile')} placeholder="+255 7xx xxx xxx" className={InputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className={LabelCls}>Temporary Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password} onChange={onChange('password')}
                placeholder="Min. 8 characters"
                className={InputCls + ' pr-10'}
                autoComplete="new-password"
              />
              <button
                type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showPw ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className={ErrCls}>{errors.password}</p>}
          </div>

          <div>
            <label className={LabelCls}>Confirm Password <span className="text-red-500">*</span></label>
            <input
              type={showPw ? 'text' : 'password'}
              value={form.confirm_password} onChange={onChange('confirm_password')}
              placeholder="Repeat password"
              className={InputCls}
              autoComplete="new-password"
            />
            {errors.confirm_password && <p className={ErrCls}>{errors.confirm_password}</p>}
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          onClick={onSkip}
          className="px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={onSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? (
            <>
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              Creating Admin…
            </>
          ) : (
            <>
              <CheckIcon className="w-4 h-4" />
              Create Admin & Finish
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({ icdvName, icdvId, adminCreated }: { icdvName: string; icdvId: number; adminCreated: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="text-center py-8">
      <div className="inline-flex w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/10 items-center justify-center mb-4">
        <CheckIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">ICDV Created!</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-1">
        <span className="font-semibold text-gray-700 dark:text-gray-200">{icdvName}</span> is now registered on the platform.
      </p>
      {adminCreated ? (
        <p className="text-sm text-green-600 dark:text-green-400 mb-8">Admin user created and ready to log in.</p>
      ) : (
        <p className="text-sm text-amber-600 dark:text-amber-400 mb-8">No admin user created — you can add one from the ICDV detail page.</p>
      )}
      <div className="flex justify-center gap-3 flex-wrap">
        <button
          onClick={() => navigate(`/super-admin/icdvs/${icdvId}`)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors"
        >
          View ICDV <ChevronRightIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate('/super-admin/icdvs')}
          className="px-5 py-2.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Back to ICDV List
        </button>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────
export default function CreateIcdvWizard() {
  const navigate = useNavigate();

  const [step,         setStep]         = useState<1 | 2 | 'done'>(1);
  const [createdIcdvId,   setCreatedIcdvId]   = useState<number | null>(null);
  const [createdIcdvName, setCreatedIcdvName] = useState('');
  const [adminCreated,    setAdminCreated]    = useState(false);

  // ICDV form state
  const [icdvForm,   setIcdvForm]   = useState<IcdvForm>(ICDV_EMPTY);
  const [icdvErrors, setIcdvErrors] = useState<FieldError<IcdvForm>>({});
  const [icdvApiErr, setIcdvApiErr] = useState('');
  const [icdvSaving, setIcdvSaving] = useState(false);

  // Admin form state
  const [adminForm,   setAdminForm]   = useState<AdminForm>(ADMIN_EMPTY);
  const [adminErrors, setAdminErrors] = useState<FieldError<AdminForm>>({});
  const [adminApiErr, setAdminApiErr] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);

  // ── Generic change handlers ──
  const icdvChange = (field: keyof IcdvForm) => (e: React.ChangeEvent<any>) => {
    setIcdvForm(f => ({ ...f, [field]: e.target.value }));
    setIcdvErrors(er => ({ ...er, [field]: undefined }));
  };

  const adminChange = (field: keyof AdminForm) => (e: React.ChangeEvent<any>) => {
    setAdminForm(f => ({ ...f, [field]: e.target.value }));
    setAdminErrors(er => ({ ...er, [field]: undefined }));
  };

  // ── Step 1 validation & submit ──
  const validateIcdv = (): boolean => {
    const errs: FieldError<IcdvForm> = {};
    if (!icdvForm.name.trim()) errs.name = 'ICDV name is required';
    if (!icdvForm.code.trim()) errs.code = 'ICDV code is required';
    else if (!/^[A-Za-z0-9_-]+$/.test(icdvForm.code)) errs.code = 'Code must be alphanumeric (hyphens/underscores allowed)';
    setIcdvErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitIcdv = async () => {
    if (!validateIcdv()) return;
    setIcdvSaving(true); setIcdvApiErr('');
    try {
      const payload = { ...icdvForm, is_active: Number(icdvForm.is_active) };
      const res = await icdvsApi.create(payload);
      setCreatedIcdvId(res.data.icdv_id);
      setCreatedIcdvName(res.data.name);
      setStep(2);
    } catch (e: any) {
      setIcdvApiErr(e?.response?.data?.message || 'Failed to create ICDV. Please try again.');
    } finally {
      setIcdvSaving(false);
    }
  };

  // ── Step 2 validation & submit ──
  const validateAdmin = (): boolean => {
    const errs: FieldError<AdminForm> = {};
    if (!adminForm.full_name.trim()) errs.full_name = 'Full name is required';
    if (!adminForm.username.trim())  errs.username  = 'Username is required';
    if (!adminForm.email.trim())     errs.email     = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminForm.email)) errs.email = 'Enter a valid email address';
    if (!adminForm.password)         errs.password  = 'Password is required';
    else if (adminForm.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (adminForm.password !== adminForm.confirm_password) errs.confirm_password = 'Passwords do not match';
    setAdminErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitAdmin = async () => {
    if (!validateAdmin() || !createdIcdvId) return;
    setAdminSaving(true); setAdminApiErr('');
    const { confirm_password, ...payload } = adminForm;
    try {
      await icdvsApi.createAdmin(createdIcdvId, payload);
      setAdminCreated(true);
      setStep('done');
    } catch (e: any) {
      setAdminApiErr(e?.response?.data?.message || 'Failed to create admin user. You can add one later from the ICDV detail page.');
    } finally {
      setAdminSaving(false);
    }
  };

  const skipAdmin = () => {
    setAdminCreated(false);
    setStep('done');
  };

  return (
    <div className="p-4 sm:p-6">
      <PageBreadCrumb pageTitle="Create ICDV" />

      {/* Super Admin notice */}
      <div className="mb-6 p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-400 text-xs flex items-center gap-2">
        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
        </svg>
        Super Admin · Platform Management — New ICDV Onboarding
      </div>

      <div className="max-w-2xl">
        {/* Step indicator */}
        {step !== 'done' && <StepIndicator step={step as 1 | 2} />}

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-sm">
          {step === 1 && (
            <Step1
              form={icdvForm}
              errors={icdvErrors}
              apiError={icdvApiErr}
              saving={icdvSaving}
              onChange={icdvChange}
              onSubmit={submitIcdv}
            />
          )}

          {step === 2 && (
            <Step2
              icdvName={createdIcdvName}
              form={adminForm}
              errors={adminErrors}
              apiError={adminApiErr}
              saving={adminSaving}
              onChange={adminChange}
              onSubmit={submitAdmin}
              onSkip={skipAdmin}
            />
          )}

          {step === 'done' && (
            <SuccessScreen
              icdvName={createdIcdvName}
              icdvId={createdIcdvId!}
              adminCreated={adminCreated}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}
function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
    </svg>
  );
}
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}
