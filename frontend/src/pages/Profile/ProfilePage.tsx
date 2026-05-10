import { useState } from 'react';
import { useAuth } from '../../store/authStore';
import { authApi } from '../../api/auth';
import { usersApi } from '../../api';
import { FormInput, FormSelect } from '../../components/tpfcs/FormField';
import { EyeCloseIcon, EyeIcon } from '../../icons';

// ── Password strength helper ──────────────────────────────────────────────────
function strengthRules(pw: string) {
  return [
    { label: 'At least 8 characters',     ok: pw.length >= 8 },
    { label: 'Contains uppercase letter', ok: /[A-Z]/.test(pw) },
    { label: 'Contains lowercase letter', ok: /[a-z]/.test(pw) },
    { label: 'Contains a number',         ok: /\d/.test(pw) },
  ];
}

// ── Password input — defined outside to prevent focus loss ───────────────────
interface PwInputProps {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder: string; required?: boolean;
}
function PwInput({ label, value, onChange, show, onToggle, placeholder, required }: PwInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 pr-10 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20"
        />
        <span onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer">
          {show ? <EyeIcon className="fill-gray-400 size-4" /> : <EyeCloseIcon className="fill-gray-400 size-4" />}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, updateUser } = useAuth();

  // Profile form
  const [profile, setProfile] = useState({
    full_name: user?.full_name ?? '',
    email:     user?.email     ?? '',
    mobile:    user?.mobile    ?? '',
    gender:    user?.gender    ?? 'male',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password form
  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving,   setPwSaving]   = useState(false);
  const [pwMsg,      setPwMsg]      = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const rules    = strengthRules(newPw);
  const pwsMatch = newPw === confirmPw && confirmPw.length > 0;
  const pwValid  = rules.every(r => r.ok) && pwsMatch;

  const setP = (k: string, v: string) => setProfile(f => ({ ...f, [k]: v }));

  // ── Save profile ────────────────────────────────────────────────────────────
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.full_name.trim()) { setProfileMsg({ type: 'error', text: 'Full name is required' }); return; }
    setProfileSaving(true); setProfileMsg(null);
    try {
      await usersApi.update(user!.user_id, profile);
      updateUser(profile);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err?.response?.data?.message ?? 'Failed to update profile' });
    } finally { setProfileSaving(false); }
  };

  // ── Change password ─────────────────────────────────────────────────────────
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwValid) return;
    setPwSaving(true); setPwMsg(null);
    try {
      await authApi.changePassword(currentPw, newPw);
      updateUser({ must_change_password: 0 });
      setPwMsg({ type: 'success', text: 'Password changed successfully' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      setPwMsg({ type: 'error', text: err?.response?.data?.message ?? 'Failed to change password' });
    } finally { setPwSaving(false); }
  };

  const Alert = ({ msg }: { msg: { type: 'success' | 'error'; text: string } | null }) => {
    if (!msg) return null;
    return (
      <div className={`p-3 rounded-lg text-sm border ${
        msg.type === 'success'
          ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400'
          : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400'
      }`}>{msg.text}</div>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-800 dark:text-white">My Profile</h1>

      {/* Avatar + name header */}
      <div className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xl font-bold text-brand-600 dark:text-brand-400">
            {user?.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </span>
        </div>
        <div>
          <p className="text-base font-semibold text-gray-800 dark:text-white">{user?.full_name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">@{user?.username}</p>
          <span className={`mt-1 inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
            user?.role === 'admin'   ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
            user?.role === 'manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                                       'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}>{user?.role}</span>
        </div>
      </div>

      {/* Profile details */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Personal Information</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <Alert msg={profileMsg} />
          <FormInput label="Full Name" required value={profile.full_name} onChange={e => setP('full_name', e.target.value)} placeholder="Your full name" />
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Email" type="email" value={profile.email} onChange={e => setP('email', e.target.value)} placeholder="your@email.com" />
            <FormInput label="Mobile" value={profile.mobile} onChange={e => setP('mobile', e.target.value)} placeholder="+255712345678" />
          </div>
          <FormSelect label="Gender" value={profile.gender} onChange={e => setP('gender', e.target.value)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </FormSelect>
          <div className="flex justify-end">
            <button type="submit" disabled={profileSaving}
              className="px-5 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
              {profileSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Change Password</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Choose a strong password you haven't used before</p>
        <form onSubmit={changePassword} className="space-y-4">
          <Alert msg={pwMsg} />
          <PwInput label="Current Password" required value={currentPw} onChange={setCurrentPw}
            show={showCurrent} onToggle={() => setShowCurrent(v => !v)} placeholder="Enter current password" />
          <PwInput label="New Password" required value={newPw} onChange={setNewPw}
            show={showNew} onToggle={() => setShowNew(v => !v)} placeholder="Enter new password" />
          <PwInput label="Confirm New Password" required value={confirmPw} onChange={setConfirmPw}
            show={showConfirm} onToggle={() => setShowConfirm(v => !v)} placeholder="Confirm new password" />

          {/* Strength checklist */}
          {newPw.length > 0 && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-2">
              {[...rules, { label: 'Passwords match', ok: pwsMatch }].map(rule => (
                <div key={rule.label} className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${rule.ok ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                    {rule.ok && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  <span className={`text-xs ${rule.ok ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>{rule.label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={pwSaving || !pwValid || !currentPw}
              className="px-5 py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
              {pwSaving ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
