import React, { useState } from 'react';
import {
  ShieldCheck,
  Smartphone,
  LayoutDashboard,
  RotateCcw,
  Wifi,
  WifiOff,
  User,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface HeaderProps {
  currentView: 'portal_pemilik' | 'kasir_mobile';
  onViewChange: (view: 'portal_pemilik' | 'kasir_mobile') => void;
  onOpenPinModal: (targetRole: 'pemilik' | 'karyawan') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  onOpenPinModal,
}) => {
  const { role, currentEmployee, logout, resetAllData } = useStore();
  const [isOnline] = useState(true);

  const handleReset = () => {
    const confirmText = window.prompt(
      'PERINGATAN PEMILIK: Anda akan mengembalikan semua data ke seed awal INCHA.\n\nKetik "RESET" untuk mengonfirmasi:'
    );
    if (confirmText === 'RESET') {
      resetAllData();
    }
  };

  return (
    <header className="bg-[#1B2A5C] text-white border-b border-[#243775] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center font-bold text-[#1B2A5C] text-xl shadow-sm tracking-tight">
              IN
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-wide text-white">INCHA</span>
                <span className="text-xs px-2 py-0.5 rounded bg-[#243775] text-[#FAF8F4] font-medium border border-[#3B4E8C]">
                  Karang Tengah, Tangerang
                </span>
              </div>
              <p className="text-xs text-gray-300">Indonesian Artisan Milk Tea</p>
            </div>
          </div>

          {/* Center: View Switcher (Portal Web vs Mobile Kasir Preview) */}
          <div className="hidden md:flex items-center bg-[#131E42] p-1 rounded-lg border border-[#243775]">
            <button
              onClick={() => onViewChange('portal_pemilik')}
              disabled={role !== 'pemilik'}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                currentView === 'portal_pemilik'
                  ? 'bg-[#1B2A5C] text-white shadow'
                  : 'text-gray-300 hover:text-white'
              } ${role !== 'pemilik' ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={role !== 'pemilik' ? 'Khusus akun Pemilik' : 'Website Pemilik'}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Website Pemilik</span>
              {role !== 'pemilik' && <span className="text-[10px] bg-[#D7262E] px-1 rounded">Terkunci</span>}
            </button>
            <button
              onClick={() => onViewChange('kasir_mobile')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                currentView === 'kasir_mobile'
                  ? 'bg-[#1B2A5C] text-white shadow'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Aplikasi Kasir (Android)</span>
            </button>
          </div>

          {/* Right: Role Badge, Status, & Actions */}
          <div className="flex items-center gap-3">
            {/* Online Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#131E42] border border-[#243775] text-gray-300">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300">Offline</span>
                </>
              )}
            </div>

            {/* Active User & Role */}
            <div className="flex items-center gap-2 bg-[#243775] px-3 py-1.5 rounded-lg border border-[#3B4E8C]">
              <User className="w-4 h-4 text-gray-300" />
              <div className="text-left hidden sm:block">
                <div className="text-xs font-semibold text-white leading-tight">
                  {currentEmployee ? currentEmployee.name : 'Kasir'}
                </div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-amber-300">
                  {role === 'pemilik' ? 'Pemilik (Akses Penuh)' : 'Karyawan (Kasir)'}
                </div>
              </div>
            </div>

            {/* Role Switcher Button */}
            {role === 'pemilik' ? (
              <button
                onClick={() => onOpenPinModal('karyawan')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#131E42] hover:bg-[#243775] text-xs font-medium text-gray-200 border border-[#243775] transition-colors"
                title="Beralih ke mode Kasir Karyawan"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Mode Karyawan</span>
              </button>
            ) : (
              <button
                onClick={() => onOpenPinModal('pemilik')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#FAF8F4] hover:bg-white text-xs font-bold text-[#1B2A5C] shadow-sm transition-colors"
                title="Buka Website Pemilik dengan PIN"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#1B2A5C]" />
                <span>Masuk Pemilik</span>
              </button>
            )}

            {/* Reset Button (Owner only) */}
            {role === 'pemilik' && (
              <button
                onClick={handleReset}
                className="p-1.5 rounded-md bg-[#131E42] hover:bg-[#D7262E] text-gray-300 hover:text-white border border-[#243775] transition-colors"
                title="Reset semua data ke default kemitraan INCHA"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
