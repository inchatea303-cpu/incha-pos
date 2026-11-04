import React, { useState } from 'react';
import { X, Lock, CheckCircle, AlertCircle, Delete } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { UserRole } from '../../types';

interface PinModalProps {
  isOpen: boolean;
  targetRole: UserRole;
  onClose: () => void;
  onSuccess: () => void;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  targetRole,
  onClose,
  onSuccess,
}) => {
  const { loginWithPin, employees } = useStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError(null);

      // Auto-submit on 4 digits if matches
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const verifyPin = (pinToTest: string) => {
    const result = loginWithPin(pinToTest);
    if (result.success) {
      setPin('');
      setError(null);
      onSuccess();
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#FAF8F4] w-full max-w-sm rounded-2xl shadow-2xl border border-[#E2DED6] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-[#1B2A5C] text-white p-5 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-300 hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-bold text-lg text-white">
            {targetRole === 'pemilik' ? 'Verifikasi PIN Pemilik' : 'Masuk PIN Kasir'}
          </h3>
          <p className="text-xs text-gray-200 mt-1">
            {targetRole === 'pemilik'
              ? 'Masukkan 4 digit PIN Pemilik (Default: 8888)'
              : 'Masukkan PIN Karyawan aktif (Default: 1234)'}
          </p>
        </div>

        {/* PIN Display Dots */}
        <div className="p-6">
          <div className="flex justify-center items-center gap-3 mb-6">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  pin.length > idx
                    ? 'bg-[#1B2A5C] border-[#1B2A5C] scale-110'
                    : 'border-gray-300 bg-white'
                }`}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-2.5 rounded-lg bg-[#FCE8E9] border border-[#D7262E]/30 text-[#93171D] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Demo PIN Chips */}
          <div className="mb-4 flex flex-wrap gap-2 justify-center">
            {employees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => {
                  setPin(emp.pin);
                  verifyPin(emp.pin);
                }}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  emp.role === 'pemilik'
                    ? 'bg-[#1B2A5C]/10 text-[#1B2A5C] border-[#1B2A5C]/30 hover:bg-[#1B2A5C]/20'
                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                } ${!emp.isActive ? 'line-through opacity-50' : ''}`}
              >
                {emp.name} ({emp.pin})
              </button>
            ))}
          </div>

          {/* Numeric Keypad (Minimum 56px touch target buttons) */}
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit)}
                className="h-14 rounded-xl bg-white text-[#1B2A5C] font-bold text-xl border border-[#E2DED6] shadow-sm hover:bg-[#F0EDE6] active:bg-[#1B2A5C] active:text-white transition-all flex items-center justify-center select-none"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-14 rounded-xl bg-white text-gray-500 font-medium text-xs border border-[#E2DED6] hover:bg-[#F0EDE6] transition-all flex items-center justify-center uppercase tracking-wider"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="h-14 rounded-xl bg-white text-[#1B2A5C] font-bold text-xl border border-[#E2DED6] shadow-sm hover:bg-[#F0EDE6] active:bg-[#1B2A5C] active:text-white transition-all flex items-center justify-center select-none"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="h-14 rounded-xl bg-white text-gray-600 border border-[#E2DED6] hover:bg-[#F0EDE6] transition-all flex items-center justify-center"
              aria-label="Hapus satu angka"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
