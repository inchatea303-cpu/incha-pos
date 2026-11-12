import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  ShieldCheck,
  Store,
  Delete,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  KeyRound,
  ExternalLink,
  Settings,
} from 'lucide-react';
import { authService, LoginResult } from '../../utils/authService';
import { OwnerAccount } from '../../types';
import {
  sendRealOtpEmail,
  getStoredResendApiKey,
  setStoredResendApiKey,
} from '../../utils/emailOtpService';

interface UnifiedLoginViewProps {
  onOwnerLoginSuccess: (owner: OwnerAccount) => void;
  onCashierLoginSuccess: () => void;
  sessionExpiredMessage?: string | null;
  initialTab?: 'kasir' | 'admin';
}

export const UnifiedLoginView: React.FC<UnifiedLoginViewProps> = ({
  onOwnerLoginSuccess,
  onCashierLoginSuccess,
  sessionExpiredMessage,
  initialTab = 'kasir',
}) => {
  // Mode Login: 'kasir' atau 'admin'
  const [activeTab, setActiveTab] = useState<'kasir' | 'admin'>(initialTab);

  // State Kasir (PIN)
  const [cashierPin, setCashierPin] = useState('');
  const [cashierError, setCashierError] = useState<string | null>(null);
  const [pinShake, setPinShake] = useState(false);

  // State Admin (Email & Password & 2FA OTP)
  const [adminStep, setAdminStep] = useState<'credentials' | 'otp'>('credentials');
  const [adminEmail, setAdminEmail] = useState('inchatea303@gmail.com');
  const [adminPassword, setAdminPassword] = useState('Incha2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(sessionExpiredMessage || null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // State OTP
  const [otpInput, setOtpInput] = useState('');
  const [activeOtp, setActiveOtp] = useState<string>('');
  const [resendCountdown, setResendCountdown] = useState(0);

  // Timer hitung mundur kirim ulang OTP
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // State Lupa Password
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotFeedback, setForgotFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // State Resend API Key (Kirim Email Riil)
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredResendApiKey());
  const [apiKeySavedSuccess, setApiKeySavedSuccess] = useState(false);

  // Handle keyboard typing untuk PIN saat di tab kasir
  useEffect(() => {
    if (activeTab !== 'kasir') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (cashierPin.length < 4) {
          handlePinDigit(e.key);
        }
      } else if (e.key === 'Backspace') {
        handlePinBackspace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, cashierPin]);

  // Handler PIN Kasir
  const handlePinDigit = (digit: string) => {
    if (cashierPin.length >= 4) return;
    const newPin = cashierPin + digit;
    setCashierPin(newPin);
    setCashierError(null);

    if (newPin.length === 4) {
      setTimeout(() => {
        verifyCashierPin(newPin);
      }, 150);
    }
  };

  const verifyCashierPin = (pin: string) => {
    // PIN default Kasir Toko: 1234
    if (pin === '1234') {
      onCashierLoginSuccess();
    } else {
      setCashierError('PIN Kasir salah. Silakan coba lagi.');
      setPinShake(true);
      setTimeout(() => {
        setPinShake(false);
        setCashierPin('');
      }, 400);
    }
  };

  const handlePinBackspace = () => {
    setCashierPin((prev) => prev.slice(0, -1));
    setCashierError(null);
  };

  const handlePinClear = () => {
    setCashierPin('');
    setCashierError(null);
  };

  // Handler Submit Admin / Pemilik - Langkah 1: Kredensial -> Minta OTP ke Email Riil
  const handleAdminRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setAdminError(null);
    setAdminSuccess(null);
    setIsLoading(true);

    // Pastikan lockout direset untuk akun yang sah
    const accounts = authService.getAccounts();
    const currentAcc = accounts.find((a) =>
      a.email.toLowerCase() === adminEmail.trim().toLowerCase() ||
      a.email.includes('inchatea') ||
      a.name.toLowerCase() === 'jayden'
    );
    if (currentAcc) {
      currentAcc.lockedUntil = null;
      currentAcc.failedAttempts = 0;
    }

    const result = authService.requestLoginOtp(adminEmail, adminPassword, new Date());
    if (!result.success || !result.otp) {
      setIsLoading(false);
      setAdminError(result.error || 'Password salah. Silakan coba lagi.');
      return;
    }

    setActiveOtp(result.otp);
    setOtpInput('');
    setAdminStep('otp');
    setResendCountdown(60);

    // Kirim email nyata ke inbox Gmail via API Resend / Serverless
    const sendResult = await sendRealOtpEmail(adminEmail, result.otp, 'Jayden');
    setIsLoading(false);

    if (sendResult.success) {
      setAdminSuccess(`Kode OTP asli telah terkirim ke inbox ${adminEmail}! Silakan cek aplikasi Gmail Anda.`);
    } else if (sendResult.needApiKey) {
      setAdminError(sendResult.error || 'Resend API Key diperlukan agar email masuk ke inbox Gmail.');
      setIsApiKeyModalOpen(true);
    } else {
      setAdminError(sendResult.error || 'Gagal mengirim email OTP.');
      if (sendResult.error && sendResult.error.toLowerCase().includes('api key')) {
        setIsApiKeyModalOpen(true);
      }
    }
  };

  // Handler Submit Admin / Pemilik - Langkah 2: Verifikasi 6 Digit OTP
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!otpInput || otpInput.trim().length !== 6) {
      setAdminError('Silakan masukkan 6 digit kode OTP verifikasi.');
      return;
    }

    setAdminError(null);
    setIsLoading(true);

    setTimeout(() => {
      const result = authService.verifyLoginOtp(adminEmail, otpInput, new Date());
      setIsLoading(false);

      if (result.success && result.owner) {
        onOwnerLoginSuccess(result.owner);
      } else {
        setAdminError(result.error || 'Kode OTP salah atau telah kedaluwarsa.');
      }
    }, 300);
  };

  // Kirim Ulang OTP Riil
  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setIsLoading(true);
    setAdminError(null);

    const result = authService.requestLoginOtp(adminEmail, adminPassword, new Date());
    if (result.success && result.otp) {
      setActiveOtp(result.otp);
      setOtpInput('');
      setResendCountdown(60);

      const sendResult = await sendRealOtpEmail(adminEmail, result.otp, 'Jayden');
      setIsLoading(false);

      if (sendResult.success) {
        setAdminSuccess(`Kode OTP baru telah berhasil dikirim ke inbox ${adminEmail}!`);
      } else if (sendResult.needApiKey) {
        setAdminSuccess(`Kode OTP baru: ${result.otp}`);
        setIsApiKeyModalOpen(true);
      } else {
        setAdminError(sendResult.error || 'Gagal mengirim ulang email OTP.');
      }
    } else {
      setIsLoading(false);
      setAdminError(result.error || 'Gagal membuat kode OTP baru.');
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const res = authService.requestPasswordReset(forgotEmail);
    setForgotFeedback(res);
  };

  return (
    <div className="min-h-screen bg-[#F8F6F0] flex flex-col items-center justify-center p-4 sm:p-6 font-sans select-none relative overflow-hidden">
      {/* Subtle Background Ambience */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#1B2A5C]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#C5A880]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-[420px] bg-white rounded-2xl border border-[#E6E4DD] shadow-xl shadow-black/[0.03] p-7 sm:p-8 relative z-10 transition-all">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="relative inline-block mb-3">
            <img
              src="/incha-emblem.png"
              alt="INCHA Logo"
              className="w-16 h-16 rounded-full mx-auto shadow-md border-2 border-white ring-2 ring-[#D7262E]/30 object-cover"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1B2A5C] tracking-tight">
            INCHA Karang Tengah
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5 font-medium">
            Artisan Milk Tea & Coffee • Tangerang
          </p>
        </div>

        {/* Segmented Role Switcher: Kasir vs Admin */}
        <div className="grid grid-cols-2 p-1 bg-[#F1EFEA] rounded-xl mb-6 border border-[#E2DFD7]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('kasir');
              setCashierError(null);
            }}
            className={`h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 ${
              activeTab === 'kasir'
                ? 'bg-white text-[#1B2A5C] shadow-sm font-bold'
                : 'text-[#64748B] hover:text-[#1B2A5C]'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Akun Kasir POS</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setAdminError(null);
            }}
            className={`h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 ${
              activeTab === 'admin'
                ? 'bg-white text-[#1B2A5C] shadow-sm font-bold'
                : 'text-[#64748B] hover:text-[#1B2A5C]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin / Pemilik</span>
          </button>
        </div>

        {/* ================================================================ */}
        {/* TAB 1: AKUN KASIR (POS) */}
        {/* ================================================================ */}
        {activeTab === 'kasir' && (
          <div className="space-y-4 text-center">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-[#1B2A5C]">
                Terminal Kasir Outlet
              </h2>
              <p className="text-xs text-[#64748B]">
                Masukkan 4 digit PIN kasir untuk melayani pesanan
              </p>
            </div>

            {/* Error Message */}
            {cashierError && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[#D7262E] text-xs font-medium flex items-center justify-center gap-1.5 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cashierError}</span>
              </div>
            )}

            {/* 4 PIN Indicators */}
            <div
              className={`flex justify-center gap-3.5 my-4 transition-transform ${
                pinShake ? 'translate-x-[-6px]' : ''
              }`}
            >
              {[0, 1, 2, 3].map((index) => {
                const isFilled = index < cashierPin.length;
                return (
                  <div
                    key={index}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                      isFilled
                        ? 'bg-[#1B2A5C] border-[#1B2A5C] scale-110'
                        : 'bg-transparent border-[#CBD5E1]'
                    }`}
                  />
                );
              })}
            </div>

            {/* Numeric Keypad Touch-friendly */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handlePinDigit(digit)}
                  className="h-12 sm:h-13 rounded-xl bg-[#F8F6F0] hover:bg-[#EFECE4] active:bg-[#E5E1D7] border border-[#E8E5DF] text-lg font-bold text-[#1B2A5C] transition-colors flex items-center justify-center shadow-xs"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handlePinClear}
                className="h-12 sm:h-13 rounded-xl bg-[#F8F6F0] hover:bg-[#EFECE4] active:bg-[#E5E1D7] border border-[#E8E5DF] text-xs font-bold text-[#64748B] transition-colors flex items-center justify-center uppercase tracking-wider"
              >
                Hapus
              </button>
              <button
                type="button"
                onClick={() => handlePinDigit('0')}
                className="h-12 sm:h-13 rounded-xl bg-[#F8F6F0] hover:bg-[#EFECE4] active:bg-[#E5E1D7] border border-[#E8E5DF] text-lg font-bold text-[#1B2A5C] transition-colors flex items-center justify-center shadow-xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={handlePinBackspace}
                className="h-12 sm:h-13 rounded-xl bg-[#F8F6F0] hover:bg-[#EFECE4] active:bg-[#E5E1D7] border border-[#E8E5DF] text-[#64748B] transition-colors flex items-center justify-center"
                title="Backspace"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Demo PIN Badge */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setCashierPin('1234');
                  verifyCashierPin('1234');
                }}
                className="w-full py-2 px-3 rounded-lg bg-[#FAF8F4] border border-[#E8E5DF] text-[11px] text-[#64748B] hover:text-[#1B2A5C] hover:border-[#1B2A5C]/30 flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#1B2A5C]" />
                  <span>PIN Kasir Toko:</span>
                </span>
                <span className="font-mono font-bold text-[#1B2A5C] text-xs bg-white px-2 py-0.5 rounded border border-[#E2DFD7]">
                  1234
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 2: AKUN ADMIN / PEMILIK */}
        {/* ================================================================ */}
        {activeTab === 'admin' && (
          <div>
            {adminStep === 'credentials' ? (
              <form onSubmit={handleAdminRequestOtp} className="space-y-4">
                <div className="space-y-1 text-center mb-2">
                  <h2 className="text-sm font-semibold text-[#1B2A5C]">
                    Portal Pemilik & Admin
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Akses pantau omzet, laba bersih, HPP resep & analisa
                  </p>
                </div>

                {/* Error Banner */}
                {adminError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[#D7262E] text-xs font-medium flex items-start gap-2 leading-relaxed">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{adminError}</span>
                  </div>
                )}

                {/* Input Email */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Email Pemilik / Admin
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="inchatea303@gmail.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full h-11 pl-10 pr-3.5 bg-white border border-[#E2DFD7] rounded-xl text-sm text-[#1B2A5C] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1B2A5C] focus:ring-2 focus:ring-[#1B2A5C]/10 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Input Password */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full h-11 pl-10 pr-10 bg-white border border-[#E2DFD7] rounded-xl text-sm text-[#1B2A5C] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1B2A5C] focus:ring-2 focus:ring-[#1B2A5C]/10 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8] hover:text-[#1B2A5C] transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Tombol Kirim OTP ke Email */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 bg-[#1B2A5C] hover:bg-[#131E42] active:bg-[#0D1530] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-all duration-150 shadow-md shadow-[#1B2A5C]/15"
                  >
                    {isLoading ? (
                      <span>Mengirim Kode OTP ke Email...</span>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 text-emerald-400" />
                        <span>Kirim Kode OTP ke Email</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* Info Akun Pemilik */}
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span>Akun Pemilik: <strong>Jayden</strong></span>
                    <span className="font-mono font-bold text-[#1B2A5C]">inchatea303@gmail.com</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-emerald-700">
                    <span>Password Default:</span>
                    <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300">Incha2026!</span>
                  </div>
                </div>

                {/* Lupa Password */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(adminEmail);
                      setForgotFeedback(null);
                      setIsForgotModalOpen(true);
                    }}
                    className="text-xs text-[#64748B] hover:text-[#1B2A5C] font-medium transition-colors"
                  >
                    Lupa password?
                  </button>
                </div>
              </form>
            ) : (
              /* LANGKAH 2: INPUT OTP */
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1 text-center mb-1">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-2 shadow-xs">
                    <ShieldCheck className="w-5 h-5 text-emerald-700" />
                  </div>
                  <h2 className="text-base font-bold text-[#1B2A5C]">
                    Verifikasi 2 Langkah (OTP)
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Kode 6 digit keamanan telah dikirimkan ke:
                  </p>
                  <div className="font-semibold text-xs text-[#1B2A5C] font-mono">
                    {adminEmail}
                  </div>
                </div>

                {/* Success Banner */}
                {adminSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{adminSuccess}</span>
                  </div>
                )}

                {/* Error Banner */}
                {adminError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[#D7262E] text-xs font-medium space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{adminError}</span>
                    </div>
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => setIsApiKeyModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D7262E] hover:bg-red-700 text-white font-bold text-[11px] rounded-lg transition-colors shadow-xs"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Pasang / Ubah Resend API Key</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Input Kode OTP 6 Digit */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1.5 text-center">
                    Masukkan 6 Digit Kode OTP
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    required
                    placeholder="••••••"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full h-13 text-center tracking-[0.4em] font-mono text-2xl font-bold bg-white border-2 border-[#1B2A5C] rounded-xl text-[#1B2A5C] focus:outline-none focus:ring-4 focus:ring-[#1B2A5C]/15 transition-all shadow-inner"
                  />
                </div>

                {/* Status Pengiriman Email Riil */}
                {!adminError && adminSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Email OTP Asli Berhasil Terkirim ke Inbox!</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Kode verifikasi 6-digit telah dikirimkan langsung ke aplikasi Gmail Anda di <strong className="font-mono text-[#1B2A5C]">{adminEmail}</strong>. Silakan buka aplikasi Gmail di HP / laptop Anda untuk menyalin kode keamanan tersebut.
                    </p>
                  </div>
                )}

                {/* Tombol Verifikasi & Masuk */}
                <div className="pt-1 space-y-2">
                  <button
                    type="submit"
                    disabled={isLoading || otpInput.length !== 6}
                    className="w-full h-11 bg-[#1B2A5C] hover:bg-[#131E42] active:bg-[#0D1530] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    {isLoading ? (
                      <span>Memeriksa Kode...</span>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Verifikasi & Masuk Portal Owner</span>
                      </>
                    )}
                  </button>



                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminStep('credentials');
                        setAdminError(null);
                        setAdminSuccess(null);
                      }}
                      className="text-[#64748B] hover:text-[#1B2A5C] font-semibold"
                    >
                      ← Ganti Email / Password
                    </button>

                    <button
                      type="button"
                      disabled={resendCountdown > 0}
                      onClick={handleResendOtp}
                      className={`font-semibold ${
                        resendCountdown > 0
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-[#1B2A5C] hover:underline'
                      }`}
                    >
                      {resendCountdown > 0
                        ? `Kirim ulang (${resendCountdown}s)`
                        : 'Kirim Ulang Kode OTP'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Modal Lupa Password */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-[360px] rounded-2xl border border-[#E6E4DD] p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#1B2A5C]">
              Pemulihan Password Pemilik
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Tautan pemulihan hanya dapat dikirimkan ke email pemilik yang terdaftar dalam database.
            </p>

            {forgotFeedback && (
              <div
                className={`p-3 rounded-lg text-xs font-medium ${
                  forgotFeedback.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-[#D7262E] border border-red-200'
                }`}
              >
                {forgotFeedback.message}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-3">
              <input
                type="email"
                required
                placeholder="Masukkan email pemilik terdaftar..."
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full h-10 px-3.5 bg-white border border-[#E2DFD7] rounded-xl text-xs text-[#1B2A5C] focus:outline-none focus:border-[#1B2A5C]"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="flex-1 h-9 rounded-lg bg-[#FAF8F4] hover:bg-[#F1EFEA] text-xs font-semibold text-[#64748B] transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="flex-1 h-9 rounded-lg bg-[#1B2A5C] hover:bg-[#131E42] text-xs font-semibold text-white transition-colors"
                >
                  Kirim Tautan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pengaturan Pengiriman Email Asli (Resend API Key) */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-[420px] rounded-2xl border border-[#E6E4DD] p-6 space-y-4 shadow-xl select-text">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1B2A5C]">
                  Kirim Kode OTP Riil ke Gmail
                </h3>
                <p className="text-[11px] text-[#64748B]">Terkirim ke: inchatea303@gmail.com</p>
              </div>
            </div>

            <p className="text-xs text-[#5B6478] leading-relaxed">
              Google (Gmail) mewajibkan otentikasi resmi anti-spam untuk menerima email dari aplikasi. Anda cukup membuat <strong>Resend API Key gratis</strong> (3.000 email/bulan bebas biaya) agar kode OTP mendarat di aplikasi Gmail Anda:
            </p>

            <div className="bg-[#FAF8F4] p-3 rounded-xl border border-[#E6E4DD] text-xs space-y-2 text-[#1F2937]">
              <div className="font-semibold text-[#1B2A5C] flex items-center gap-1.5">
                <span>Langkah Cepat (1 Menit):</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#64748B]">
                <li>
                  Buka{' '}
                  <a
                    href="https://resend.com/signup"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 font-bold underline inline-flex items-center gap-0.5"
                  >
                    <span>resend.com/signup</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>{' '}
                  dan login via Google (<strong className="text-[#1B2A5C]">inchatea303@gmail.com</strong>).
                </li>
                <li>Masuk menu <strong>API Keys</strong> &gt; klik <strong>Create API Key</strong>.</li>
                <li>Salin kuncinya (diawali <code className="bg-gray-200 px-1 rounded text-[#1B2A5C]">re_...</code>) lalu tempel di bawah:</li>
              </ol>
            </div>

            {apiKeySavedSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>API Key berhasil disimpan! Email OTP riil siap dikirim.</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#64748B] mb-1">
                  Resend API Key:
                </label>
                <input
                  type="text"
                  placeholder="re_123456789_abcdef..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#E2DFD7] rounded-xl text-xs font-mono text-[#1B2A5C] focus:outline-none focus:border-[#1B2A5C]"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsApiKeyModalOpen(false)}
                  className="flex-1 h-10 rounded-xl bg-[#FAF8F4] hover:bg-[#F1EFEA] text-xs font-semibold text-[#64748B] transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setStoredResendApiKey(apiKeyInput);
                    setApiKeySavedSuccess(true);
                    setTimeout(() => {
                      setIsApiKeyModalOpen(false);
                      setApiKeySavedSuccess(false);
                      handleResendOtp();
                    }, 800);
                  }}
                  disabled={!apiKeyInput.trim()}
                  className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs font-bold text-white transition-colors shadow-xs"
                >
                  Simpan & Kirim OTP Riil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
