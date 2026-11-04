import React from 'react';
import {
  LayoutDashboard,
  Coffee,
  Package,
  Wallet,
  TrendingUp,
  Tag,
  Settings,
  History,
  LogOut,
  User,
} from 'lucide-react';
import { OwnerAccount } from '../../types';

export type OwnerNavigationPage =
  | 'dashboard'
  | 'products'
  | 'ingredients'
  | 'finance'
  | 'analysis'
  | 'promo'
  | 'settings'
  | 'audit';

interface SidebarProps {
  currentPage: OwnerNavigationPage;
  onNavigate: (page: OwnerNavigationPage) => void;
  currentOwner: OwnerAccount;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  currentOwner,
  onLogout,
}) => {
  const menuItems: {
    id: OwnerNavigationPage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Produk & HPP', icon: Coffee },
    { id: 'ingredients', label: 'Bahan & Restock', icon: Package },
    { id: 'finance', label: 'Keuangan', icon: Wallet },
    { id: 'analysis', label: 'Analisa', icon: TrendingUp },
    { id: 'promo', label: 'Promo', icon: Tag },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
    { id: 'audit', label: 'Riwayat Perubahan', icon: History },
  ];

  return (
    <aside className="w-16 md:w-60 bg-[#1B2A5C] text-white flex flex-col justify-between shrink-0 min-h-screen border-r border-[#243775] transition-all duration-150 select-none">
      {/* Bagian Atas: Logo & Navigasi */}
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-4 md:px-5 border-b border-[#243775] gap-3">
          <div className="w-8 h-8 rounded-lg bg-white text-[#1B2A5C] font-bold text-sm flex items-center justify-center shrink-0">
            IN
          </div>
          <div className="hidden md:block overflow-hidden">
            <div className="font-semibold text-sm tracking-wide text-white leading-tight">
              INCHA
            </div>
            <div className="text-[11px] text-gray-300 truncate">
              Karang Tengah, Tangerang
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="p-2 md:p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full h-11 flex items-center gap-3 px-3 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
                title={item.label}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="hidden md:inline truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bagian Bawah: Akun Pemilik & Tombol Keluar */}
      <div className="p-2 md:p-3 border-t border-[#243775] space-y-2">
        <div className="hidden md:flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-gray-300 shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-semibold text-white truncate">
              {currentOwner.name}
            </div>
            <div className="text-[10px] text-gray-300 truncate">
              {currentOwner.email}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full h-10 flex items-center justify-center md:justify-start gap-2.5 px-3 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#D7262E]/80 transition-colors duration-150"
          title="Keluar dari akun pemilik"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          <span className="hidden md:inline">Keluar</span>
        </button>
      </div>
    </aside>
  );
};
