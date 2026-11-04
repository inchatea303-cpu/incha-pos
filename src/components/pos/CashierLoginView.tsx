import React, { useState, useEffect } from 'react';
import { Delete, Lock, ShieldCheck, ArrowRight, AlertCircle, Store } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

interface CashierLoginViewProps {
  onSwitchToOwnerLogin: () => void;
}

export const CashierLoginView: React.FC<CashierLoginViewProps> = ({
  onSwitchToOwnerLogin,
}) => {
  const { loginWithPin, employees } = useStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  // Handle keyboard typing (0-9 and Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 4) {
          handleDigitPress(e.key);
        }
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  const handleDigitPress = (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError(null);

    // Auto-verify when 4 digits are entered
    if (newPin.length === 4) {
      setTimeout(() => {
        const result = loginWithPin(newPin);
        if (!result.success) {
          setError(result.message);
          setShake(true);
          setTimeout(() => {
            setShake(false);
            setPin('');
          }, 400);
        }
      }, 150);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] flex flex-col items-center justify-center p-4 font-sans select-none">
      {/* Kartu Utama Login Kasir */}
      <div className="w-full max-w-[360px] bg-white rounded-xl border border-[#E6E9F2] p-7 shadow-none text-center">
        {/* Brand Icon & Heading */}
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1B2A5C] text-white font-bold text-xl mb-3">
          IN
        </div>
        <h1 className="text-xl font-semibold text-[#1B2A5C] tracking-tight">
          Aplikasi Kasir Outlet
        </h1>
        <p className="text-xs text-[#5B6478] mt-0.5">
          INCHA Karang Tengah, Tangerang
        </p>

        {/* Status Error */}
        {error ? (
          <div className="mt-4 p-2.5 rounded-lg bg-[#FCE8E9] border border-[#D7262E]/20 text-[#D7262E] text-xs font-medium flex items-center justify-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="mt-4 text-xs font-medium text-[#5B6478]">
            Masukkan 4 digit PIN kasir Anda
          </div>
        )}

        {/* 4-Digit PIN Indicators */}
        <div
          className={`flex justify-center gap-3.5 my-5 transition-transform ${
            shake ? 'translate-x-[-6px]' : ''
          }`}
        >
          {[0, 1, 2, 3].map((index) => {
            const isFilled = index < pin.length;
            return (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                  isFilled
                    ? 'bg-[#1B2A5C] border-[#1B2A5C] scale-110'
                    : 'bg-transparent border-[#CBD5E1]'
                }`}
              />
            );
          })}
        </div>

        {/* Keypad Angka 0-9 */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitPress(digit)}
              className="h-14 rounded-lg bg-[#FAF8F4] hover:bg-[#F0EDE6] active:bg-[#E5E0D6] border border-[#E6E9F2] text-xl font-semibold text-[#1B2A5C] transition-colors duration-150 flex items-center justify-center"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-lg bg-[#FAF8F4] hover:bg-[#F0EDE6] active:bg-[#E5E0D6] border border-[#E6E9F2] text-xs font-semibold text-[#5B6478] transition-colors duration-150 flex items-center justify-center uppercase tracking-wider"
          >
            Hapus
          </button>
          <button
            type="button"
            onClick={() => handleDigitPress('0')}
            className="h-14 rounded-lg bg-[#FAF8F4] hover:bg-[#F0EDE6] active:bg-[#E5E0D6] border border-[#E6E9F2] text-xl font-semibold text-[#1B2A5C] transition-colors duration-150 flex items-center justify-center"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-lg bg-[#FAF8F4] hover:bg-[#F0EDE6] active:bg-[#E5E0D6] border border-[#E6E9F2] text-[#5B6478] transition-colors duration-150 flex items-center justify-center"
            title="Backspace"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Demo PIN Info */}
        <div className="p-2.5 rounded-lg bg-[#FAF8F4] border border-[#E6E9F2] text-[11px] text-[#5B6478] space-y-1 text-left">
          <div className="font-semibold text-[#1B2A5C]">Akses PIN Kasir Aktif:</div>
          <div className="flex justify-between items-center">
            <span>Siti Rahma (Kasir 1)</span>
            <button
              type="button"
              onClick={() => {
                setPin('1234');
                loginWithPin('1234');
              }}
              className="font-mono text-[#1B2A5C] font-semibold underline hover:text-[#D7262E]"
            >
              1234
            </button>
          </div>
          <div className="flex justify-between items-center">
            <span>Dimas Aditya (Kasir 2)</span>
            <button
              type="button"
              onClick={() => {
                setPin('5678');
                loginWithPin('5678');
              }}
              className="font-mono text-[#1B2A5C] font-semibold underline hover:text-[#D7262E]"
            >
              5678
            </button>
          </div>
        </div>

        {/* Link ke Login Portal Pemilik (Memerlukan Email & Password) */}
        <div className="mt-5 pt-4 border-t border-[#E6E9F2]">
          <button
            type="button"
            onClick={onSwitchToOwnerLogin}
            className="w-full text-xs font-semibold text-[#1B2A5C] hover:text-[#D7262E] flex items-center justify-center gap-1.5 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Akses Portal Pemilik (Khusus Owner)</span>
          </button>
          <p className="text-[10px] text-[#5B6478] mt-1">
            Data HPP, margin & laba bersih terproteksi database.
          </p>
        </div>
      </div>
    </div>
  );
};
