import React, { useState } from 'react';
import {
  Coffee,
  Package,
  Layers,
  Users,
  ScrollText,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useStore } from './context/StoreContext';
import { Header } from './components/Header';
import { ProductMaster } from './components/owner/ProductMaster';
import { IngredientMaster } from './components/owner/IngredientMaster';
import { PackagingConfigCard } from './components/owner/PackagingConfigCard';
import { EmployeeManagementCard } from './components/owner/EmployeeManagementCard';
import { AuditLogView } from './components/owner/AuditLogView';
import { PriceHistoryModal } from './components/owner/PriceHistoryModal';
import { PinModal } from './components/auth/PinModal';
import { AlertBanner } from './components/common/AlertBanner';
import { CashierMain } from './components/pos/CashierMain';
import { UserRole } from './types';

type OwnerTab = 'products' | 'ingredients' | 'packaging' | 'employees' | 'audit';

export const AppContent: React.FC = () => {
  const { role, activeAlert, clearAlert, switchRole } = useStore();
  const [currentView, setCurrentView] = useState<'portal_pemilik' | 'kasir_mobile'>('portal_pemilik');
  const [activeTab, setActiveTab] = useState<OwnerTab>('products');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinTargetRole, setPinTargetRole] = useState<UserRole>('pemilik');
  const [isPriceHistoryOpen, setIsPriceHistoryOpen] = useState(false);

  // If role is employee, force mobile cashier view
  React.useEffect(() => {
    if (role === 'karyawan') {
      setCurrentView('kasir_mobile');
    }
  }, [role]);

  const handleOpenPin = (target: UserRole) => {
    setPinTargetRole(target);
    setIsPinModalOpen(true);
  };

  const handlePinSuccess = () => {
    setIsPinModalOpen(false);
    if (pinTargetRole === 'pemilik') {
      setCurrentView('portal_pemilik');
    } else {
      setCurrentView('kasir_mobile');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] flex flex-col font-sans">
      {/* Top Header */}
      <Header
        currentView={currentView}
        onViewChange={(view) => {
          if (view === 'portal_pemilik' && role !== 'pemilik') {
            handleOpenPin('pemilik');
          } else {
            setCurrentView(view);
          }
        }}
        onOpenPinModal={handleOpenPin}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Global Alert Notification */}
        <AlertBanner message={activeAlert} onClose={clearAlert} />

        {currentView === 'portal_pemilik' && role === 'pemilik' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Sidebar Navigation */}
            <aside className="lg:col-span-3 bg-white p-4 rounded-xl border border-[#E2DED6] shadow-sm space-y-1">
              <div className="text-[11px] font-bold text-[#6B7280] uppercase px-3 py-1 mb-1">
                Menu Portal Pemilik
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'products'
                    ? 'bg-[#1B2A5C] text-white shadow-sm'
                    : 'text-[#1F2937] hover:bg-[#FAF8F4]'
                }`}
              >
                <Coffee className="w-4 h-4 shrink-0" />
                <span>Master Menu & HPP</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ingredients')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'ingredients'
                    ? 'bg-[#1B2A5C] text-white shadow-sm'
                    : 'text-[#1F2937] hover:bg-[#FAF8F4]'
                }`}
              >
                <Package className="w-4 h-4 shrink-0" />
                <span>Master Bahan & Stok</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('packaging')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'packaging'
                    ? 'bg-[#1B2A5C] text-white shadow-sm'
                    : 'text-[#1F2937] hover:bg-[#FAF8F4]'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>Biaya Kemasan & Cup</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('employees')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'employees'
                    ? 'bg-[#1B2A5C] text-white shadow-sm'
                    : 'text-[#1F2937] hover:bg-[#FAF8F4]'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Karyawan & Akses PIN</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'audit'
                    ? 'bg-[#1B2A5C] text-white shadow-sm'
                    : 'text-[#1F2937] hover:bg-[#FAF8F4]'
                }`}
              >
                <ScrollText className="w-4 h-4 shrink-0" />
                <span>Audit Log Perubahan</span>
              </button>

              {/* Quick Info Box on Outlet & Franchise */}
              <div className="mt-6 pt-4 border-t border-[#E2DED6] text-[11px] text-[#6B7280] space-y-1.5 px-2">
                <div className="font-bold text-[#1B2A5C]">INCHA Karang Tengah</div>
                <div>Paket Kemitraan: Rp38.000.000</div>
                <div>DP Tercatat: Rp19.000.000</div>
                <div>Ongkir: Rp2.000.000</div>
                <div>Komisi Ojol: 20% (Default)</div>
              </div>
            </aside>

            {/* Right Main Content */}
            <section className="lg:col-span-9 space-y-6">
              {activeTab === 'products' && <ProductMaster />}
              {activeTab === 'ingredients' && (
                <IngredientMaster onOpenHistory={() => setIsPriceHistoryOpen(true)} />
              )}
              {activeTab === 'packaging' && <PackagingConfigCard />}
              {activeTab === 'employees' && <EmployeeManagementCard />}
              {activeTab === 'audit' && <AuditLogView />}
            </section>
          </div>
        ) : (
          /* Mobile Cashier View (Android PWA Frame) */
          <div>
            <div className="text-center mb-4 hidden md:block">
              <h2 className="text-base font-bold text-[#1B2A5C]">
                Antarmuka Kasir Mobile Android (PWA)
              </h2>
              <p className="text-xs text-[#6B7280]">
                {role === 'pemilik'
                  ? 'Mode Simulasi Kasir: Pemilik dapat menguji checkout, cetak struk Bluetooth, dan pemotongan stok otomatis.'
                  : 'Aplikasi Kasir Karyawan aktif. Nilai modal HPP terproteksi penuh di database.'}
              </p>
            </div>
            <CashierMain />
          </div>
        )}
      </main>

      {/* Modals */}
      <PinModal
        isOpen={isPinModalOpen}
        targetRole={pinTargetRole}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
      />

      <PriceHistoryModal
        isOpen={isPriceHistoryOpen}
        onClose={() => setIsPriceHistoryOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppContent />
  );
}
