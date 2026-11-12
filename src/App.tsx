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
  Settings,
} from 'lucide-react';

export const AppContent: React.FC = () => {
  const {
    authenticatedOwner,
    activeAlert,
    clearAlert,
  } = useStore();

  const [currentPage, setCurrentPage] = useState<OwnerNavigationPage>('dashboard');
  const [showFullOwnerDashboard, setShowFullOwnerDashboard] = useState(false);

  // Jika Pemilik ingin membuka menu pengaturan resep/biaya lengkap di sidebar
  if (showFullOwnerDashboard) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex font-sans antialiased text-[#1B2A5C]">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          currentOwner={authenticatedOwner || {
            id: 'owner-1',
            email: 'inchatea303@gmail.com',
            name: 'Jayden',
            role: 'pemilik',
            passwordHash: 'Incha2026!',
            failedAttempts: 0,
            lockedUntil: null,
            lastActiveAt: new Date().toISOString(),
            createdAt: '2026-10-01T00:00:00.000Z',
          }}
          onLogout={() => setShowFullOwnerDashboard(false)}
        />
        <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-y-auto">
          <header className="bg-white border-b border-[#E6E4DD] px-4 py-2.5 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={() => setShowFullOwnerDashboard(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1B2A5C] text-white text-xs font-bold shadow hover:bg-[#131E42] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>← Kembali ke Kasir &amp; Pantau Penjualan</span>
            </button>
            <div className="text-xs text-gray-600 font-bold">
              INCHA Karang Tengah • Pemilik: Jayden
            </div>
          </header>

          {activeAlert && (
            <div className="p-4 max-w-[1120px] mx-auto w-full">
              <AlertBanner message={activeAlert} onClose={clearAlert} />
            </div>
          )}

          <main className="flex-1 w-full max-w-[1120px] mx-auto p-4 sm:p-6 md:p-8">
            {currentPage === 'dashboard' && (
              <DashboardView
                onNavigateToFinance={() => setCurrentPage('finance')}
                onOpenCashier={() => setShowFullOwnerDashboard(false)}
              />
            )}
            {currentPage === 'products' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1B2A5C] tracking-tight">Produk &amp; HPP</h1>
                  <p className="text-xs text-[#64748B] mt-1 font-medium">Kelola menu, resep bahan baku, dan target margin keuntungan</p>
                </div>
                <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-6">
                  <ProductMaster />
                </div>
              </div>
            )}
            {currentPage === 'ingredients' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1B2A5C] tracking-tight">Bahan &amp; Restock</h1>
                  <p className="text-xs text-[#64748B] mt-1 font-medium">Pantau sisa stok bahan baku, batas minimum, dan harga beli</p>
                </div>
                <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-6">
                  <IngredientMaster onOpenHistory={() => {}} />
                </div>
              </div>
            )}
            {currentPage === 'finance' && (
              <FinanceView onOpenCashier={() => setShowFullOwnerDashboard(false)} />
            )}
            {currentPage === 'analysis' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1B2A5C] tracking-tight">Analisa &amp; BEP</h1>
                  <p className="text-xs text-[#64748B] mt-1 font-medium">Simulasi titik impas modal kemitraan INCHA Karang Tengah</p>
                </div>
                <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-6">
                  <PackagingConfigCard />
                </div>
              </div>
            )}
            {currentPage === 'settings' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1B2A5C] tracking-tight">Pengaturan</h1>
                  <p className="text-xs text-[#64748B] mt-1 font-medium">Parameter operasional, akun pemilik, dan PIN kasir</p>
                </div>
                <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-6">
                  <EmployeeManagementCard />
                </div>
              </div>
            )}
            {currentPage === 'audit' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1B2A5C] tracking-tight">Riwayat Perubahan (Audit Log)</h1>
                  <p className="text-xs text-[#64748B] mt-1 font-medium">Catatan otomatis setiap perubahan resep dan pengaturan</p>
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
  }

  // TAMPILAN UTAMA TOKO (LANGSUNG KASIR & PANTAU PENJUALAN TANPA PORTAL SAMA SEKALI)
  return (
    <div className="min-h-screen bg-[#F8F6F0] flex flex-col font-sans select-none">
      <header className="bg-[#1B2A5C] text-white px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-md border-b border-[#243775]">
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
                Pemilik: Jayden
              </span>
            </div>
            <div className="text-[11px] text-gray-300">
              Artisan Milk Tea • Kasir &amp; Pengawasan Omzet Langsung
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tombol Kelola Master Menu & Biaya */}
          <button
            type="button"
            onClick={() => setShowFullOwnerDashboard(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 text-xs font-bold transition-all duration-150"
            title="Kelola resep, bahan baku, dan biaya operasional"
          >
            <Settings className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Kelola Resep &amp; Biaya</span>
            <span className="sm:hidden">Resep</span>
          </button>
        </div>
      </header>

      {/* Konten Utama: Kasir POS, Live Omzet & Anti-Bocor, Riwayat, Printer & Suara QRIS */}
      <main className="flex-1 p-2 sm:p-4 max-w-6xl w-full mx-auto">
        <CashierMain />
      </main>
    </div>
  );
};

export default function App() {
  return <AppContent />;
}
