import React, { useState } from 'react';
import { useStore } from './context/StoreContext';
import { Sidebar, OwnerNavigationPage } from './components/owner/Sidebar';
import { UnifiedLoginView } from './components/auth/UnifiedLoginView';
import { DashboardView } from './components/owner/DashboardView';
import { ProductMaster } from './components/owner/ProductMaster';
import { IngredientMaster } from './components/owner/IngredientMaster';
import { PackagingConfigCard } from './components/owner/PackagingConfigCard';
import { EmployeeManagementCard } from './components/owner/EmployeeManagementCard';
import { AuditLogView } from './components/owner/AuditLogView';
import { FinanceView } from './components/owner/FinanceView';
import { CashierMain } from './components/pos/CashierMain';
import { AlertBanner } from './components/common/AlertBanner';
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Lock,
  LogOut,
  Store,
} from 'lucide-react';

export const AppContent: React.FC = () => {
  const {
    authenticatedOwner,
    isCashierAuthenticated,
    sessionExpiredMessage,
    ownerLogin,
    ownerLogout,
    loginCashier,
    logoutCashier,
    activeAlert,
    clearAlert,
  } = useStore();

  const [currentPage, setCurrentPage] = useState<OwnerNavigationPage>('dashboard');
  const [isOwnerTestingCashier, setIsOwnerTestingCashier] = useState(false);

  // =========================================================================
  // 1. JIKA BELUM ADA YANG LOGIN (Wajib Login Kasir atau Admin)
  // =========================================================================
  if (!authenticatedOwner && !isCashierAuthenticated) {
    return (
      <UnifiedLoginView
        onOwnerLoginSuccess={(owner) => {
          ownerLogin(owner);
          setIsOwnerTestingCashier(false);
        }}
        onCashierLoginSuccess={() => {
          loginCashier('1234');
        }}
        sessionExpiredMessage={sessionExpiredMessage}
      />
    );
  }

  // =========================================================================
  // 2. JIKA KASIR TERAUTENTIKASI (Hanya Akses Kasir POS, Tanpa Nama Petugas)
  // =========================================================================
  if (isCashierAuthenticated && !authenticatedOwner) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex flex-col font-sans select-none">
        {/* Header Bersih & Modern Khusus Kasir */}
        <header className="bg-[#1B2A5C] text-white px-4 sm:px-6 py-3 flex items-center justify-between shadow-md border-b border-[#243775]">
          <div className="flex items-center gap-3">
            <img
              src="/incha-emblem.png"
              alt="INCHA"
              className="w-9 h-9 rounded-full border border-white/30 shrink-0 object-cover shadow-xs"
            />
            <div>
              <div className="text-sm font-bold text-white tracking-tight leading-tight flex items-center gap-2">
                <span>INCHA Karang Tengah</span>
                <span className="text-[10px] font-semibold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Kasir POS
                </span>
              </div>
              <div className="text-[11px] text-gray-300">
                Artisan Milk Tea • Tangerang
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tombol Masuk ke Portal Pemilik */}
            <button
              type="button"
              onClick={logoutCashier}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 text-xs font-bold transition-all duration-150"
              title="Buka portal pemilik & laporan omzet"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>Portal Pemilik</span>
            </button>

            {/* Tombol Keluar Kasir */}
            <button
              type="button"
              onClick={logoutCashier}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-[#D7262E] text-xs font-semibold text-white transition-all duration-150"
              title="Keluar dari akun kasir dan kembali ke menu login"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar Kasir</span>
            </button>
          </div>
        </header>

        {/* Konten POS Kasir Utama */}
        <main className="flex-1 p-3 sm:p-5 max-w-6xl w-full mx-auto">
          <CashierMain />
        </main>
      </div>
    );
  }

  // =========================================================================
  // 3. JIKA PEMILIK / ADMIN LOGIN
  // =========================================================================

  // A. Jika Pemilik sedang menguji/membuka Kasir POS
  if (isOwnerTestingCashier) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex flex-col font-sans select-none">
        <header className="bg-[#1B2A5C] text-white px-4 sm:px-6 py-3 flex items-center justify-between shadow-md border-b border-[#243775]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsOwnerTestingCashier(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Dashboard Pemilik</span>
            </button>
            <span className="text-gray-400">|</span>
            <span className="text-xs font-medium text-gray-200 hidden sm:inline">
              Mode Uji Kasir (Akses Pemilik)
            </span>
          </div>

          <div className="text-xs text-gray-300 font-medium">
            {authenticatedOwner?.name}
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-5 max-w-6xl w-full mx-auto">
          <CashierMain />
        </main>
      </div>
    );
  }

  // B. Portal Pemilik / Admin Lengkap
  return (
    <div className="min-h-screen bg-[#F8F6F0] flex font-sans antialiased text-[#1B2A5C]">
      {/* 1. Sidebar Kiri (240px di Desktop, 64px di Tablet 768px) */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        currentOwner={authenticatedOwner!}
        onLogout={ownerLogout}
      />

      {/* 2. Area Konten Utama (Maksimal 1120px dengan padding lapang) */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Banner Alert bila ada */}
        {activeAlert && (
          <div className="p-4 max-w-[1120px] mx-auto w-full">
            <AlertBanner message={activeAlert} onClose={clearAlert} />
          </div>
        )}

        <main className="flex-1 w-full max-w-[1120px] mx-auto p-4 sm:p-6 md:p-8">
          {currentPage === 'dashboard' && (
            <DashboardView
              onNavigateToFinance={() => setCurrentPage('finance')}
              onOpenCashier={() => setIsOwnerTestingCashier(true)}
            />
          )}

          {currentPage === 'products' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2">
                <div>
                  <h1 className="text-2xl font-bold text-[#1B2A5C] tracking-tight">
                    Produk & HPP
                  </h1>
                  <p className="text-xs text-[#64748B] mt-1 font-medium">
                    Kelola menu, resep bahan baku, dan target margin keuntungan
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-6">
                <ProductMaster />
              </div>
            </div>
          )}

          {currentPage === 'ingredients' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2">
                <div>
                  <h1 className="text-2xl font-bold text-[#1B2A5C] tracking-tight">
                    Bahan & Restock
                  </h1>
                  <p className="text-xs text-[#64748B] mt-1 font-medium">
                    Pantau sisa stok bahan baku, batas minimum, dan harga beli
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-6">
                <IngredientMaster onOpenHistory={() => {}} />
              </div>
            </div>
          )}

          {currentPage === 'finance' && (
            <FinanceView onOpenCashier={() => setIsOwnerTestingCashier(true)} />
          )}

          {currentPage === 'analysis' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-[#1B2A5C] tracking-tight">
                  Analisa & BEP
                </h1>
                <p className="text-xs text-[#64748B] mt-1 font-medium">
                  Simulasi titik impas modal kemitraan INCHA Karang Tengah
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-6">
                <PackagingConfigCard />
              </div>
            </div>
          )}

          {currentPage === 'promo' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-[#1B2A5C] tracking-tight">
                  Promo & Diskon
                </h1>
                <p className="text-xs text-[#64748B] mt-1 font-medium">
                  Atur strategi diskon, batas kuota per hari, dan cek dampak terhadap margin laba
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-8 text-center">
                <p className="text-sm text-[#64748B]">
                  Modul Promo siap diatur sesuai rencana promosi outlet.
                </p>
              </div>
            </div>
          )}

          {currentPage === 'settings' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-[#1B2A5C] tracking-tight">
                  Pengaturan
                </h1>
                <p className="text-xs text-[#64748B] mt-1 font-medium">
                  Parameter operasional, akun pemilik terdaftar, dan hak akses PIN kasir
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-6">
                <EmployeeManagementCard />
              </div>
            </div>
          )}

          {currentPage === 'audit' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-[#1B2A5C] tracking-tight">
                  Riwayat Perubahan (Audit Log)
                </h1>
                <p className="text-xs text-[#64748B] mt-1 font-medium">
                  Catatan otomatis setiap perubahan resep, harga bahan, dan pengaturan
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-6">
                <AuditLogView />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return <AppContent />;
}
