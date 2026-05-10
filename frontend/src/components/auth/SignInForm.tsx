import { useState } from 'react';
import { useNavigate } from 'react-router';
import { EyeCloseIcon, EyeIcon } from '../../icons';
import Label from '../form/Label';
import Input from '../form/input/InputField';
import Button from '../ui/button/Button';
import { authApi } from '../../api/auth';
import { useAuth } from '../../store/authStore';
import type { OtpChannel } from '../../types';

type Step = 'credentials' | 'channel' | 'otp';

export default function SignInForm() {
  const navigate  = useNavigate();
  const { login } = useAuth();

  const [step,            setStep]            = useState<Step>('credentials');
  const [loginField,      setLoginField]       = useState('');
  const [password,        setPassword]         = useState('');
  const [showPassword,    setShowPassword]     = useState(false);
  const [channels,        setChannels]         = useState<OtpChannel[]>([]);
  const [selectedChannel, setSelectedChannel]  = useState<'email' | 'sms' | null>(null);
  const [maskedContact,   setMaskedContact]    = useState('');
  const [otp,             setOtp]              = useState(['', '', '', '', '', '']);
  const [loading,         setLoading]          = useState(false);
  const [error,           setError]            = useState('');
  const [resending,       setResending]        = useState(false);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.validateCredentials(loginField, password);
      if (!data.status) {
        if (data.must_change_password) {
          const res = await authApi.login(loginField, password);
          login(res.data.user, res.data.tokens.access.token, res.data.tokens.refresh.token);
          navigate('/change-password');
          return;
        }
        setError(data.message);
        return;
      }
      setChannels(data.channels ?? []);
      setStep('channel');
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (channel: 'email' | 'sms') => {
    setError('');
    setLoading(true);
    setSelectedChannel(channel);
    try {
      const { data } = await authApi.sendOtp(loginField, channel);
      setMaskedContact(data.maskedContact);
      setStep('otp');
    } catch {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter the complete 6-digit code.'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.verifyOtp(loginField, code);
      login(data.user, data.tokens.access.token, data.tokens.refresh.token);
      navigate(data.user.must_change_password ? '/change-password' : '/');
    } catch {
      setError('Invalid or expired OTP. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!selectedChannel) return;
    setResending(true);
    setError('');
    try {
      const { data } = await authApi.sendOtp(loginField, selectedChannel);
      setMaskedContact(data.maskedContact);
      setOtp(['', '', '', '', '', '']);
    } catch {
      setError('Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (val: string, idx: number) => {
    const updated = [...otp];
    updated[idx] = val.replace(/\D/g, '').slice(-1);
    setOtp(updated);
    if (val && idx < 5) {
      (document.getElementById(`otp-${idx + 1}`) as HTMLInputElement)?.focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      (document.getElementById(`otp-${idx - 1}`) as HTMLInputElement)?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const chars = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    const updated = [...otp];
    chars.forEach((c, i) => { updated[i] = c; });
    setOtp(updated);
    (document.getElementById(`otp-${Math.min(chars.length, 5)}`) as HTMLInputElement)?.focus();
  };

  const otpInputCls = 'h-12 w-full rounded-lg border border-gray-300 bg-transparent text-center text-xl font-bold text-gray-800 shadow-theme-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto px-4">

        {/* Logo header:
             - credentials step → hidden on lg (right panel has big logo), shown on mobile
             - channel & otp steps → always shown with logo (no right panel context) */}
        {step === 'credentials' && (
          <div className="mb-8 text-center lg:hidden">
            <img src="/logo.png" alt="TPFCS" className="w-20 h-20 object-contain mx-auto mb-3" />
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">Tanzania Police Force</h1>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Corporation Sole</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Project Management System</p>
          </div>
        )}

        {(step === 'channel' || step === 'otp') && (
          <div className="mb-8 text-center">
            <img src="/logo.png" alt="TPFCS" className="w-24 h-24 object-contain mx-auto mb-3 drop-shadow-md" />
            <h1 className="text-base font-bold text-gray-800 dark:text-white">Tanzania Police Force</h1>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Corporation Sole</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Project Management System</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
            {error}
          </div>
        )}

        {step === 'credentials' && (
          <form onSubmit={handleCredentials} className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Sign In</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Enter your credentials to continue</p>
            </div>
            <div>
              <Label>Username or Email <span className="text-red-500">*</span></Label>
              <Input placeholder="admin or admin@tpfcs.go.tz" value={loginField} onChange={(e) => setLoginField(e.target.value)} />
            </div>
            <div>
              <Label>Password <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <span onClick={() => setShowPassword(!showPassword)} className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2">
                  {showPassword ? <EyeIcon className="fill-gray-500 size-5" /> : <EyeCloseIcon className="fill-gray-500 size-5" />}
                </span>
              </div>
            </div>
            <Button className="w-full" size="sm" disabled={loading || !loginField || !password}>
              {loading ? 'Verifying...' : 'Continue →'}
            </Button>
          </form>
        )}

        {step === 'channel' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Choose Verification Method</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Select how you want to receive your OTP</p>
            </div>
            <div className="space-y-3">
              {channels.map((ch) => (
                <button key={ch.type} onClick={() => handleSendOtp(ch.type)} disabled={loading}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-brand-400 hover:bg-brand-50 transition-all dark:border-gray-700 dark:hover:border-brand-500 dark:hover:bg-brand-500/10 disabled:opacity-60">
                  <div className="w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                    {ch.type === 'email'
                      ? <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      : <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-medium text-gray-800 dark:text-white">{ch.label}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{ch.display}</p>
                  </div>
                  {loading && selectedChannel === ch.type && (
                    <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </button>
              ))}
            </div>
            <button onClick={() => { setStep('credentials'); setError(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">← Back</button>
          </div>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Enter Verification Code</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Code sent to <span className="font-medium text-gray-700 dark:text-gray-300">{maskedContact}</span>
              </p>
            </div>
            <div>
              <Label>6-digit security code</Label>
              <div className="flex gap-2">
                {otp.map((digit, idx) => (
                  <input key={idx} id={`otp-${idx}`} type="text" inputMode="numeric" maxLength={1}
                    value={digit} onChange={(e) => handleOtpChange(e.target.value, idx)}
                    onKeyDown={(e) => handleOtpKeyDown(e, idx)} onPaste={handleOtpPaste}
                    className={otpInputCls} />
                ))}
              </div>
            </div>
            <Button className="w-full" size="sm" disabled={loading || otp.join('').length < 6}>
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => { setStep('channel'); setError(''); setOtp(['','','','','','']); }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400">← Change method</button>
              <button type="button" onClick={handleResend} disabled={resending}
                className="text-brand-500 hover:text-brand-600 disabled:opacity-50">
                {resending ? 'Sending...' : 'Resend code'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
