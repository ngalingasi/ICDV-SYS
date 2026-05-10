import { useState } from 'react';
import { useModal } from '../../hooks/useModal';
import { Modal } from '../ui/modal';
import Button from '../ui/button/Button';
import Label from '../form/Label';
import { useAuth } from '../../store/authStore';
import { authApi } from '../../api/auth';
import { EyeCloseIcon, EyeIcon } from '../../icons';

// Defined OUTSIDE to prevent remount on keystroke → focus loss
function PwField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 pr-11 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
        <span onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer">
          {show ? <EyeIcon className="fill-gray-400 size-[18px]" /> : <EyeCloseIcon className="fill-gray-400 size-[18px]" />}
        </span>
      </div>
    </div>
  );
}

export default function UserAddressCard() {
  const { isOpen, openModal, closeModal } = useModal();
  const { updateUser } = useAuth();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState(false);

  const rules = [
    { label: 'At least 8 characters',     ok: newPw.length >= 8 },
    { label: 'Contains uppercase letter', ok: /[A-Z]/.test(newPw) },
    { label: 'Contains a number',         ok: /\d/.test(newPw) },
    { label: 'Passwords match',           ok: newPw === confirmPw && confirmPw.length > 0 },
  ];
  const isValid = rules.every(r => r.ok);

  const handleClose = () => {
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setError(''); setSuccess(false);
    closeModal();
  };

  const handleSave = async () => {
    if (!isValid || !currentPw) return;
    setSaving(true); setError('');
    try {
      await authApi.changePassword(currentPw, newPw);
      updateUser({ must_change_password: 0 });
      setSuccess(true);
      setTimeout(handleClose, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to change password');
    } finally { setSaving(false); }
  };

  const lastChanged = 'Update your password regularly to keep your account secure.';

  return (
    <>
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
              Security
            </h4>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
              <div>
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Password</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">••••••••••</p>
              </div>
              <div>
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Two-Factor Auth</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">OTP via Email / SMS</p>
              </div>
              <div className="col-span-2">
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Security Note</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{lastChanged}</p>
              </div>
            </div>
          </div>

          <button
            onClick={openModal}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
          >
            <svg className="fill-current" width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z" fill="" />
            </svg>
            Change Password
          </button>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={handleClose} className="max-w-[500px]">
        <div className="no-scrollbar relative w-full max-w-[500px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-10">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">Change Password</h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Use a strong password you don't use elsewhere.</p>
          </div>

          {error   && <div className="mx-2 mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-500/20">{error}</div>}
          {success && <div className="mx-2 mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-sm border border-green-200 dark:border-green-500/20">✓ Password changed successfully</div>}

          <div className="px-2 space-y-4">
            <PwField label="Current Password" value={currentPw} onChange={setCurrentPw} />
            <PwField label="New Password"     value={newPw}     onChange={setNewPw} />
            <PwField label="Confirm Password" value={confirmPw} onChange={setConfirmPw} />

            {/* Strength checklist */}
            {newPw.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {rules.map(r => (
                  <div key={r.label} className="flex items-center gap-1.5">
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${r.ok ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                      {r.ok && <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                    <span className={`text-xs ${r.ok ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>{r.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
            <Button size="sm" variant="outline" onClick={handleClose}>Close</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !isValid || !currentPw}>
              {saving ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
