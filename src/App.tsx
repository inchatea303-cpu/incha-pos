import React, { useState, useEffect } from 'react';
import { useStore } from './context/StoreContext';
import { Sidebar, OwnerNavigationPage } from './components/owner/Sidebar';
import { LoginView } from './components/owner/LoginView';
import { DashboardView } from './components/owner/DashboardView';
import { ProductMaster } from './components/owner/ProductMaster';
import { IngredientMaster } from './components/owner/IngredientMaster';
import { PackagingConfigCard } from './components/owner/PackagingConfigCard';
import { EmployeeManagementCard } from './components/owner/EmployeeManagementCard';
import { AuditLogView } from './components/owner/AuditLogView';
import { CashierMain } from './components/pos/CashierMain';
import { CashierLoginView } from './components/pos/CashierLoginView';
import { AlertBanner } from './components/common/AlertBanner';
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Lock,
  LogOut,
  User,
  Store,
} from 'lucide-react';

export const AppContent: React.FC = () => {
  const {
    authenticatedOwner,
    currentEmployee,
    sessionExpiredMessage,
    ownerLogin,
    ownerLogout,
    logout: cashierLogout,
    activeAlert,
    clearAlert,
    role,
  } = useStore();

  // Mode Aplikasi: 'owner' (Portal Pemilik) atau 'cashier' (Kasir Outlet)
  const [appMode, setAppMode] = useState<'owner' | 'cashier'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('app') === 'kasir') return 'cashier';
      if (params.get('app') === 'pemilik') return 'owner';
      const saved = localStorage.getItem('incha_app_mode');
      if (saved === 'cashier') return 'cashier';
    }
    return 'owner';
  });

  const [currentPage, setCurrentPage] = useState<OwnerNavigationPage>('dashboard');

  const switchAppMode = (mode: 'owner' | 'cashier') => {
    setAppMode(mode);
    localStorage.setItem('incha_app_mode', mode);
  };

  // =========================================================================
  // JIKA DALAM MODE APLIKASI KASIR KARYAWAN
  // =========================================================================
  if (appMode === 'cashier') {
    // 1. Jika kasir belum memasukkan PIN, tampilkan form login PIN kasir
    if (!currentEmployee) {
      return (
        <CashierLoginView
          onSwitchToOwnerLogin={() => switchAppMode('owner')}
        />
      );
    }

    // 2. Jika kasir sudah login dengan PIN, tampilkan antarmuka kasir
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex flex-col font-sans select-none">
        {/* Header Khusus Kasir */}
        <header className="bg-[#1B2A5C] text-white px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white text-[#1B2A5C] font-bold text-sm flex items-center justify-center shrink-0">
              IN
            </div>
            <div>
              <div className="text-xs font-semibold text-white tracking-wide leading-tight">
                INCHA Karang Tengah
              </div>
              <div className="text-[11px] text-gray-300">
                Kasir: <span className="font-semibold text-white">{currentEmployee.name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tombol Kunci / Ganti Kasir (kembali ke input PIN) */}
            <button
              type="button"
              onClick={cashierLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors"
              title="Kunci layar kasir dan kembali ke input PIN"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Kunci Kasir</span>
            </button>

            {/* Jika dibuka oleh pemilik yang sedang login, ada opsi kembali ke Dashboard */}
            {authenticatedOwner ? (
              <button
                type="button"
                onClick={() => switchAppMode('owner')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D7262E] hover:bg-[#B81E25] text-xs font-medium text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Dashboard Pemilik</span>
              </button>
            ) : (
              /* Jika kasir biasa, opsi ini menuju ke login email/password pemilik */
              <button
                type="button"
                onClick={() => switchAppMode('owner')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-gray-300 transition-colors"
                title="Memerlukan email & password pemilik"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Akses Pemilik</span>
              </button>
            )}
          </div>
        </header>

        {/* Konten POS Kasir */}
        <main className="flex-1 p-3 sm:p-4 max-w-5xl w-full mx-auto">
          <CashierMain />
        </main>
      </div>
    );
  }

  // =========================================================================
  // JIKA DALAM MODE PORTAL PEMILIK
  // =========================================================================

  // 1. Jika belum login sebagai pemilik, tampilkan layar login Pemilik (Email & Password)
  if (!authenticatedOwner) {
    return (
      <LoginView
        onLoginSuccess={(owner) => {
          ownerLogin(owner);
          switchAppMode('owner');
        }}
        sessionExpiredMessage={sessionExpiredMessage}
        onSwitchToCashier={() => switchAppMode('cashier')}
      />
    );
  }

  // 2. Jika pemilik sudah login, tampilkan Portal Pemilik Lengkap
  return (
    <div className="min-h-screen bg-[#FAF8F4] flex font-sans antialiased text-[#1B2A5C]">
      {/* 1. Sidebar Kiri (240px di Desktop, 64px di Tablet 768px) */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        currentOwner={authenticatedOwner}
        onLogout={() => {
          ownerLogout();
          switchAppMode('owner');
        }}
      />

      {/* 2. Area Konten Utama (Maksimal 1120px dengan padding 32px) */}
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
              onOpenCashier={() => switchAppMode('cashier')}
            />
          )}

          {currentPage === 'products' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2">
                <div>
                  <h1 className="text-2xl font-semibold text-[#1B2A5C] tracking-tight">
                    Produk & HPP
                  </h1>
                  <p className="text-xs text-[#5B6478] mt-1">
                    Kelola menu, resep bahan baku, dan target margin keuntungan
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#E6E9F2] p-6">
                <ProductMaster />
              </div>
            </div>
          )}

          {currentPage === 'ingredients' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2">
                <div>
                  <h1 className="text-2xl font-semibold text-[#1B2A5C] tracking-tight">
                    Bahan & Restock
                  </h1>
                  <p className="text-xs text-[#5B6478] mt-1">
                    Pantau sisa stok bahan baku, batas minimum, dan harga beli
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#E6E9F2] p-6">
                <IngredientMaster onOpenHistory={() => {}} />
              </div>
            </div>
          )}

          {currentPage === 'finance' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2">
                <div>
                  <h1 className="text-2xl font-semibold text-[#1B2A5C] tracking-tight">
                    Keuangan
                  </h1>
                  <p className="text-xs text-[#5B6478] mt-1">
                    Ringkasan penjualan harian, pengeluaran operasional, dan tutup kas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => switchAppMode('cashier')}
                  className="h-9 px-3.5 rounded-lg border border-[#E6E9F2] bg-white text-xs font-semibold text-[#1B2A5C] hover:bg-gray-50 flex items-center gap-2 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Kasir</span>
                </button>
              </div>

              {/* Ringkasan Keuangan Sederhana */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-[#E6E9F2]">
                  <div className="text-xs font-semibold uppercase text-[#5B6478] tracking-wider">
                    Total Omzet
                  </div>
                  <div className="text-2xl font-semibold text-[#1B2A5C] mt-2 font-mono">
                    Rp1.150.000
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-[#E6E9F2]">
                  <div className="text-xs font-semibold uppercase text-[#5B6478] tracking-wider">
                    Total HPP
                  </div>
                  <div className="text-2xl font-semibold text-[#1B2A5C] mt-2 font-mono">
                    Rp483.000
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-[#E6E9F2]">
                  <div className="text-xs font-semibold uppercase text-[#5B6478] tracking-wider">
                    Pengeluaran
                  </div>
                  <div className="text-2xl font-semibold text-[#1B2A5C] mt-2 font-mono">
                    Rp150.000
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-[#E6E9F2]">
                  <div className="text-xs font-semibold uppercase text-[#5B6478] tracking-wider">
                    Laba Bersih
                  </div>
                  <div className="text-2xl font-semibold text-[#1B7F3B] mt-2 font-mono">
                    Rp517.000
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentPage === 'analysis' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold text-[#1B2A5C] tracking-tight">
                  Analisa & BEP
                </h1>
                <p className="text-xs text-[#5B6478] mt-1">
                  Simulasi titik impas modal kemitraan INCHA Karang Tengah
                </p>
              </div>
              <div className="bg-white rounded-xl border border-[#E6E9F2] p-6">
                <PackagingConfigCard />
              </div>
            </div>
          )}

          {currentPage === 'promo' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold text-[#1B2A5C] tracking-tight">
                  Promo & Diskon
                </h1>
                <p className="text-xs text-[#5B6478] mt-1">
                  Atur strategi diskon, batas kuota per hari, dan cek dampak terhadap margin laba
                </p>
              </div>
              <div className="bg-white rounded-xl border border-[#E6E9F2] p-8 text-center">
                <p className="text-sm text-[#5B6478]">
                  Modul Promo siap diimplementasikan pada Langkah 5 sesuai rencana kerja.
                </p>
              </div>
            </div>
          )}

          {currentPage === 'settings' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold text-[#1B2A5C] tracking-tight">
                  Pengaturan
                </h1>
                <p className="text-xs text-[#5B6478] mt-1">
                  Parameter operasional, akun pemilik terdaftar, dan hak akses PIN kasir
                </p>
              </div>
              <div className="bg-white rounded-xl border border-[#E6E9F2] p-6">
                <EmployeeManagementCard />
              </div>
            </div>
          )}

          {currentPage === 'audit' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold text-[#1B2A5C] tracking-tight">
                  Riwayat Perubahan (Audit Log)
                </h1>
                <p className="text-xs text-[#5B6478] mt-1">
                  Catatan otomatis setiap perubahan resep, harga bahan, dan pengaturan
                </p>
              </div>
              <div className="bg-white rounded-xl border border-[#E6E9F2] p-6">
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
