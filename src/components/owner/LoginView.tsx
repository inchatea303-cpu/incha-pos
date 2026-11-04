import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { authService, LoginResult } from '../../utils/authService';
import { OwnerAccount } from '../../types';

interface LoginViewProps {
  onLoginSuccess: (owner: OwnerAccount) => void;
  sessionExpiredMessage?: string | null;
  onSwitchToCashier?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  sessionExpiredMessage,
  onSwitchToCashier,
}) => {
  const [email, setEmail] = useState('owner1@incha.id');
  const [password, setPassword] = useState('Incha2026!');
  const [errorMessage, setErrorMessage] = useState<string | null>(
    sessionExpiredMessage || null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotFeedback, setForgotFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    // Simulasi delay autentikasi 300ms untuk feedback UI yang tenang
    setTimeout(() => {
      const result: LoginResult = authService.login(email, password, new Date());
      setIsLoading(false);

      if (result.success && result.owner) {
        onLoginSuccess(result.owner);
      } else {
        setErrorMessage(result.error || 'Email atau password salah.');
      }
    }, 300);
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const res = authService.requestPasswordReset(forgotEmail);
    setForgotFeedback(res);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center p-4 font-sans select-none">
      {/* Kartu Login Utama 380px */}
      <div className="w-full max-w-[380px] bg-white rounded-xl border border-[#E6E9F2] p-8 shadow-none transition-all">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1B2A5C] text-white font-bold text-xl mb-3">
            IN
          </div>
          <h1 className="text-2xl font-semibold text-[#1B2A5C] tracking-tight">
            Masuk ke dashboard
          </h1>
          <p className="text-sm text-[#5B6478] mt-1">
            INCHA Karang Tengah, Tangerang
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-lg bg-[#FCE8E9] border border-[#D7262E]/20 text-[#D7262E] text-xs font-medium flex items-start gap-2 leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[#1B7F3B] text-xs font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-[#5B6478] tracking-wider mb-1.5">
              Email Pemilik
            </label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="owner1@incha.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 bg-white border border-[#E6E9F2] rounded-lg text-sm text-[#1B2A5C] focus:outline-none focus:border-[#1B2A5C] transition-colors placeholder:text-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-[#5B6478] tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-3.5 bg-white border border-[#E6E9F2] rounded-lg text-sm text-[#1B2A5C] focus:outline-none focus:border-[#1B2A5C] transition-colors placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Tombol Masuk Merah Lebar Penuh */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-[#D7262E] hover:bg-[#B81E25] active:bg-[#9E181E] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all duration-150"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Memproses...</span>
                </>
              ) : (
                <span>Masuk</span>
              )}
            </button>
          </div>
        </form>

        {/* Link Lupa Password */}
        <div className="text-center mt-5 pt-4 border-t border-[#E6E9F2]">
          <button
            type="button"
            onClick={() => {
              setForgotEmail(email);
              setForgotFeedback(null);
              setIsForgotModalOpen(true);
            }}
            className="text-xs text-[#5B6478] hover:text-[#1B2A5C] font-medium transition-colors"
          >
            Lupa password?
          </button>
        </div>

        {/* Info Akun Default untuk Kemudahan Pengujian */}
        <div className="mt-6 p-3 rounded-lg bg-[#FAF8F4] border border-[#E6E9F2] text-[11px] text-[#5B6478] space-y-1">
          <div className="font-semibold text-[#1B2A5C]">Akun Pemilik Terdaftar:</div>
          <div className="flex justify-between">
            <span>owner1@incha.id</span>
            <span className="font-mono text-[#1B2A5C]">Incha2026!</span>
          </div>
          <div className="flex justify-between">
            <span>owner2@incha.id</span>
            <span className="font-mono text-[#1B2A5C]">Incha2026!</span>
          </div>
        </div>

        {/* Akses ke Aplikasi Kasir Karyawan */}
        {onSwitchToCashier && (
          <div className="mt-4 pt-3 border-t border-[#E6E9F2] text-center">
            <button
              type="button"
              onClick={onSwitchToCashier}
              className="text-xs font-semibold text-[#1B2A5C] hover:text-[#D7262E] transition-colors"
            >
              Beralih ke Aplikasi Kasir (Login PIN Karyawan) →
            </button>
          </div>
        )}
      </div>

      {/* Modal Lupa Password */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-[360px] rounded-xl border border-[#E6E9F2] p-6 space-y-4">
            <h3 className="text-base font-semibold text-[#1B2A5C]">
              Pemulihan Password
            </h3>
            <p className="text-xs text-[#5B6478] leading-relaxed">
              Tautan pemulihan hanya dapat dikirimkan ke email pemilik yang terdaftar dalam sistem.
            </p>

            {forgotFeedback && (
              <div
                className={`p-3 rounded-lg text-xs font-medium ${
                  forgotFeedback.success
                    ? 'bg-emerald-50 text-[#1B7F3B] border border-emerald-200'
                    : 'bg-[#FCE8E9] text-[#D7262E] border border-[#D7262E]/20'
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
                className="w-full h-10 px-3 bg-white border border-[#E6E9F2] rounded-lg text-xs text-[#1B2A5C] focus:outline-none focus:border-[#1B2A5C]"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="flex-1 h-9 rounded-lg bg-[#FAF8F4] hover:bg-gray-200 text-xs font-semibold text-[#5B6478] transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="flex-1 h-9 rounded-lg bg-[#1B2A5C] hover:bg-[#243775] text-xs font-semibold text-white transition-colors"
                >
                  Kirim Tautan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
