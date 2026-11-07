import React, { useState } from 'react';
import { Shield, Key, Store, Lock, CheckCircle, ShieldAlert, KeyRound } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const EmployeeManagementCard: React.FC = () => {
  const { authenticatedOwner, addAuditLog } = useStore();
  const [cashierPin, setCashierPin] = useState('1234');
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinInput.length === 4) {
      setCashierPin(newPinInput);
      setIsEditingPin(false);
      setPinFeedback('PIN Kasir Toko berhasil diperbarui menjadi ' + newPinInput);
      addAuditLog('UBAH_PIN_KASIR', `PIN Kasir Toko diubah oleh ${authenticatedOwner?.name || 'Pemilik'}`);
      setTimeout(() => setPinFeedback(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Pengaturan Akses Kasir Toko */}
      <div className="bg-white p-6 rounded-2xl border border-[#E6E4DD] shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#1B2A5C]/10 text-[#1B2A5C] flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#1B2A5C]">
              Akses Terminal Kasir Toko
            </h3>
            <p className="text-xs text-[#64748B]">
              Kasir hanya memiliki akses untuk melayani pesanan, checkout, dan cetak struk Bluetooth. Data HPP & laba tersembunyi total.
            </p>
          </div>
        </div>

        {pinFeedback && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{pinFeedback}</span>
          </div>
        )}

        <div className="p-4 rounded-xl bg-[#F8F6F0] border border-[#E8E5DF] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-[#1B2A5C]">
              PIN Akses Kasir (4 Digit)
            </div>
            <div className="text-xs text-[#64748B] mt-0.5">
              Digunakan staf kasir saat login ke register POS toko
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="font-mono text-sm font-bold bg-white px-3 py-1.5 rounded-lg border border-[#E2DFD7] text-[#1B2A5C]">
              {cashierPin}
            </div>

            <button
              type="button"
              onClick={() => {
                setNewPinInput(cashierPin);
                setIsEditingPin(!isEditingPin);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#1B2A5C] hover:bg-[#131E42] text-white text-xs font-semibold transition-colors"
            >
              {isEditingPin ? 'Batal' : 'Ganti PIN'}
            </button>
          </div>
        </div>

        {isEditingPin && (
          <form onSubmit={handleSavePin} className="mt-4 p-4 rounded-xl bg-white border border-[#1B2A5C]/20 flex items-center gap-3">
            <input
              type="text"
              maxLength={4}
              pattern="[0-9]{4}"
              placeholder="4 digit angka..."
              value={newPinInput}
              onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
              className="w-36 h-10 px-3 border border-[#E2DFD7] rounded-lg text-sm font-mono text-center font-bold focus:outline-none focus:border-[#1B2A5C]"
              required
            />
            <button
              type="submit"
              className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
            >
              Simpan PIN Baru
            </button>
          </form>
        )}
      </div>

      {/* 2. Daftar Akun Pemilik / Admin */}
      <div className="bg-white p-6 rounded-2xl border border-[#E6E4DD] shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#1B2A5C]/10 text-[#1B2A5C] flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#1B2A5C]">
              Akun Pemilik / Admin Terdaftar
            </h3>
            <p className="text-xs text-[#64748B]">
              Dibatasi maksimal 2 akun pemilik dengan hak akses penuh ke finansial, resep HPP, dan laporan.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[#F8F6F0] border border-[#E8E5DF] space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-sm text-[#1B2A5C]">Jayden</div>
                <div className="text-xs text-[#64748B]">inchatea303@gmail.com</div>
              </div>
              <span className="text-[10px] uppercase font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Pemilik Utama
              </span>
            </div>
            <div className="pt-2 border-t border-[#E8E5DF] flex justify-between items-center text-xs text-[#64748B]">
              <span>Hak Akses: Penuh (RLS)</span>
              <span className="font-mono text-[#1B2A5C] font-semibold">Aktif</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8F6F0] border border-[#E8E5DF] space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-sm text-[#1B2A5C]">Cindy Wulandari</div>
                <div className="text-xs text-[#64748B]">owner2@incha.id</div>
              </div>
              <span className="text-[10px] uppercase font-bold bg-[#1B2A5C]/10 text-[#1B2A5C] px-2 py-0.5 rounded-full">
                Mitra Pemilik
              </span>
            </div>
            <div className="pt-2 border-t border-[#E8E5DF] flex justify-between items-center text-xs text-[#64748B]">
              <span>Hak Akses: Penuh (RLS)</span>
              <span className="font-mono text-[#1B2A5C] font-semibold">Aktif</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
