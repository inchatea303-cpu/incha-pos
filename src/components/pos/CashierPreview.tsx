import React, { useState } from 'react';
import {
  Smartphone,
  ShieldCheck,
  ShoppingBag,
  Layers,
  Search,
  Wifi,
  Package,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatRupiah } from '../../utils/calculations';

export const CashierPreview: React.FC = () => {
  const { products, ingredients, currentEmployee, role } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = products.filter((p) => {
    const matchCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl border-4 border-[#1B2A5C] overflow-hidden my-4">
      {/* Simulated Android Phone Notch & Bar */}
      <div className="bg-[#1B2A5C] text-white px-5 py-2.5 flex items-center justify-between text-xs">
        <span className="font-semibold tabular-nums">19:30 WIB</span>
        <div className="flex items-center gap-2">
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
            Online
          </span>
        </div>
      </div>

      {/* POS Mobile Header */}
      <div className="bg-[#1B2A5C] text-white p-4 border-b border-[#243775]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base tracking-wide">INCHA KASIR</h1>
            <p className="text-xs text-gray-200">Karang Tengah • Tangerang</p>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-white">
              {currentEmployee ? currentEmployee.name : 'Kasir'}
            </div>
            <span className="text-[10px] font-bold text-amber-300 bg-[#243775] px-2 py-0.5 rounded">
              {role === 'pemilik' ? 'AKUN PEMILIK' : 'AKUN KARYAWAN'}
            </span>
          </div>
        </div>

        {/* Security Notice for Employee */}
        <div className="mt-3 p-2 rounded-lg bg-[#131E42] border border-[#243775] flex items-center gap-2 text-[11px] text-gray-200">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            {role === 'pemilik'
              ? 'Anda login sebagai Pemilik (semua fitur kasir aktif).'
              : 'Mode Kasir Terproteksi: Harga beli, HPP, & laporan keuangan disembunyikan.'}
          </span>
        </div>
      </div>

      {/* Category Tabs (Big touch targets for single-thumb) */}
      <div className="bg-[#FAF8F4] p-2 border-b border-[#E2DED6] flex gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { id: 'all', label: 'Semua' },
          { id: 'milk_tea', label: 'Milk Tea' },
          { id: 'pure_tea', label: 'Pure Tea' },
          { id: 'fruity_tea', label: 'Fruity Tea' },
          { id: 'special_blend', label: 'Special' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id)}
            className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all select-none ${
              selectedCategory === tab.id
                ? 'bg-[#1B2A5C] text-white shadow'
                : 'bg-white text-gray-700 border border-[#E2DED6]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Menu Grid (Optimized for thumb tapping) */}
      <div className="p-3 bg-[#FAF8F4] max-h-[480px] overflow-y-auto space-y-2">
        <div className="text-[11px] font-bold text-[#6B7280] uppercase px-1">
          Pilih Menu Transaksi ({filtered.length})
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {filtered.map((prod) => {
            const initials = prod.name
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('');

            return (
              <button
                key={prod.id}
                type="button"
                className="min-h-[96px] p-3 rounded-2xl bg-white border border-[#E2DED6] shadow-sm hover:border-[#1B2A5C] active:scale-[0.98] transition-all text-left flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="w-8 h-8 rounded-lg bg-[#1B2A5C]/10 text-[#1B2A5C] font-bold text-xs flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <span className="text-[9px] uppercase font-bold text-[#6B7280] bg-[#FAF8F4] px-1.5 py-0.5 rounded border border-[#E2DED6]">
                    {prod.category.split('_')[0]}
                  </span>
                </div>

                <div className="mt-2">
                  <div className="font-bold text-xs text-[#1F2937] line-clamp-2 leading-tight">
                    {prod.name}
                  </div>
                  <div className="font-extrabold text-sm text-[#1B2A5C] mt-1 tabular-nums">
                    {formatRupiah(prod.sellPrice)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Physical Stock Status for Cashier */}
        <div className="mt-4 p-3 bg-white rounded-xl border border-[#E2DED6]">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1B2A5C] mb-2">
            <Package className="w-4 h-4" />
            <span>Pantauan Stok Fisik Bahan (Karyawan)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {ingredients.slice(0, 6).map((ing) => (
              <div
                key={ing.id}
                className="p-2 rounded-lg bg-[#FAF8F4] border border-[#E2DED6] flex items-center justify-between"
              >
                <span className="text-[11px] text-gray-700 truncate pr-1">{ing.name}</span>
                <span className="font-bold text-[#1B2A5C] tabular-nums shrink-0">
                  {ing.currentStock} {ing.unit}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#6B7280] mt-2 italic">
            * Karyawan hanya melihat jumlah fisik bahan tanpa harga modal (HPP).
          </p>
        </div>
      </div>

      {/* POS Bottom Action Bar (Thumb ergonomic 56px+ target) */}
      <div className="p-4 bg-white border-t border-[#E2DED6]">
        <button
          type="button"
          className="w-full h-14 rounded-2xl bg-[#1B2A5C] hover:bg-[#243775] text-white font-bold text-sm shadow-lg flex items-center justify-between px-5 transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            <span>Keranjang Kasir</span>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-gray-200">Total: 0 Item</div>
            <div className="font-extrabold text-sm tabular-nums">Rp0</div>
          </div>
        </button>
      </div>
    </div>
  );
};
