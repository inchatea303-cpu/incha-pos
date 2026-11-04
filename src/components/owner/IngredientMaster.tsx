import React, { useState } from 'react';
import {
  Package,
  History,
  AlertTriangle,
  Edit2,
  CheckCircle,
  HelpCircle,
  Search,
  Filter,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Ingredient } from '../../types';
import { formatRupiah } from '../../utils/calculations';

interface IngredientMasterProps {
  onOpenHistory: () => void;
}

export const IngredientMaster: React.FC<IngredientMasterProps> = ({ onOpenHistory }) => {
  const {
    role,
    ingredients,
    updateIngredientPrice,
    updateIngredientDetails,
    priceHistory,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [newBuyPrice, setNewBuyPrice] = useState<string>('');
  const [newPortions, setNewPortions] = useState<string>('');
  const [previewAlert, setPreviewAlert] = useState<{ changePct: number; isOver5Pct: boolean } | null>(null);

  const filteredIngredients = ingredients.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleOpenEdit = (item: Ingredient) => {
    if (role !== 'pemilik') return;
    setEditingIngredient(item);
    setNewBuyPrice(item.buyPrice.toString());
    setNewPortions(item.portionsPerUnit.toString());
    setPreviewAlert(null);
  };

  const handlePriceChange = (val: string) => {
    setNewBuyPrice(val);
    const numVal = parseFloat(val) || 0;
    if (editingIngredient && editingIngredient.buyPrice > 0) {
      const changePct = ((numVal - editingIngredient.buyPrice) / editingIngredient.buyPrice) * 100;
      setPreviewAlert({
        changePct,
        isOver5Pct: changePct > 5.0,
      });
    }
  };

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIngredient) return;

    const priceNum = parseFloat(newBuyPrice);
    const portionsNum = parseFloat(newPortions);

    if (isNaN(priceNum) || priceNum < 0) {
      alert('Harga beli harus berupa angka positif.');
      return;
    }
    if (isNaN(portionsNum) || portionsNum <= 0) {
      alert('Porsi per satuan harus lebih dari 0.');
      return;
    }

    updateIngredientPrice(editingIngredient.id, priceNum, portionsNum);
    setEditingIngredient(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-[#E2DED6] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1B2A5C]">Master Bahan Baku & Stok Fisik</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1B2A5C]/10 text-[#1B2A5C] font-semibold">
              {ingredients.length} Item
            </span>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            {role === 'pemilik'
              ? 'Kelola harga beli, porsi per kemasan, dan pantau stok bahan. Perubahan harga otomatis memperbarui HPP.'
              : 'Daftar stok bahan fisik gudang. Harga beli dan HPP dirahasiakan oleh sistem.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {role === 'pemilik' && (
            <button
              onClick={onOpenHistory}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#FAF8F4] hover:bg-[#F0EDE6] text-xs font-semibold text-[#1B2A5C] border border-[#E2DED6] transition-colors"
            >
              <History className="w-4 h-4 text-[#1B2A5C]" />
              <span>Riwayat Harga Bahan ({priceHistory.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Cari bahan (mis. Osmanthus, Cup, Cream)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] transition-colors"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] text-[#1F2937]"
        >
          <option value="all">Semua Kategori</option>
          <option value="base_tea">Base Tea</option>
          <option value="base_flavor">Base Rasa / Sirup</option>
          <option value="blend_flavor">Blend Buah / Bubuk</option>
          <option value="cream">Cream & Topping</option>
          <option value="packaging">Packaging (Cup & Lid)</option>
        </select>
      </div>

      {/* Main Ingredient Table */}
      <div className="bg-white rounded-xl border border-[#E2DED6] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAF8F4] text-[#1B2A5C] text-xs uppercase font-semibold border-b border-[#E2DED6]">
              <tr>
                <th className="py-3 px-4">Nama Bahan</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4 text-center">Stok Fisik</th>
                <th className="py-3 px-4">Satuan & Min. Order</th>
                {role === 'pemilik' ? (
                  <>
                    <th className="py-3 px-4 text-right">Harga Beli</th>
                    <th className="py-3 px-4 text-center">Porsi / Satuan</th>
                    <th className="py-3 px-4 text-right">Biaya / Porsi</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </>
                ) : (
                  <th className="py-3 px-4 text-center">Status Akses</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2DED6]">
              {filteredIngredients.map((item) => {
                const isLowStock = item.currentStock <= item.minStock;

                return (
                  <tr key={item.id} className="hover:bg-[#FAF8F4]/60 transition-colors">
                    {/* Nama & Tag Status */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#1F2937]">{item.name}</div>
                      {/* Tag Verifikasi */}
                      {item.verificationNote && (
                        <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          {item.verificationNote}
                        </span>
                      )}
                      {!item.verificationNote && item.isVerified && (
                        <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                          <CheckCircle className="w-3 h-3" />
                          Terverifikasi
                        </span>
                      )}
                    </td>

                    {/* Kategori */}
                    <td className="py-3 px-4">
                      <span className="capitalize text-xs text-[#6B7280]">
                        {item.category.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Stok Fisik Saat Ini */}
                    <td className="py-3 px-4 text-center">
                      <div
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tabular-nums ${
                          isLowStock
                            ? 'bg-[#FCE8E9] text-[#D7262E] border border-[#D7262E]/30'
                            : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {item.currentStock} {item.unit}
                      </div>
                      {isLowStock && (
                        <div className="text-[10px] text-[#D7262E] mt-0.5 font-medium">
                          Di bawah batas ({item.minStock})
                        </div>
                      )}
                    </td>

                    {/* Min Order & Satuan */}
                    <td className="py-3 px-4">
                      <div className="text-xs text-[#1F2937] font-medium">
                        Per {item.unit}
                      </div>
                      <div className="text-[11px] text-[#6B7280]">
                        Min: {item.minOrder}
                      </div>
                    </td>

                    {/* Data Finansial (HANYA PEMILIK) */}
                    {role === 'pemilik' ? (
                      <>
                        <td className="py-3 px-4 text-right font-medium tabular-nums text-[#1F2937]">
                          {formatRupiah(item.buyPrice)}
                        </td>
                        <td className="py-3 px-4 text-center tabular-nums text-xs text-[#6B7280]">
                          {item.portionsPerUnit} porsi
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#1B2A5C] tabular-nums">
                          {formatRupiah(item.costPerPortion)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-white hover:bg-[#1B2A5C] hover:text-white text-xs font-semibold text-[#1B2A5C] border border-[#1B2A5C] transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Ubah Harga</span>
                          </button>
                        </td>
                      </>
                    ) : (
                      /* Karyawan Restricted Notice */
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-100 text-gray-500 border border-gray-200">
                          <ShieldAlert className="w-3.5 h-3.5 text-gray-400" />
                          Dirahasiakan RLS
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Harga Bahan */}
      {editingIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#FAF8F4] w-full max-w-md rounded-2xl shadow-2xl border border-[#E2DED6] overflow-hidden">
            <div className="bg-[#1B2A5C] text-white p-5">
              <h3 className="font-bold text-lg">Ubah Harga Bahan Baku</h3>
              <p className="text-xs text-gray-200 mt-0.5">
                {editingIngredient.name} ({editingIngredient.unit})
              </p>
            </div>

            <form onSubmit={handleSavePrice} className="p-6 space-y-4">
              {/* Alert jika kenaikan harga > 5% */}
              {previewAlert && (
                <div
                  className={`p-3 rounded-lg text-xs leading-relaxed border ${
                    previewAlert.isOver5Pct
                      ? 'bg-[#FCE8E9] border-[#D7262E] text-[#93171D]'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {previewAlert.isOver5Pct && <AlertTriangle className="w-4 h-4 text-[#D7262E]" />}
                    Perubahan Harga: {previewAlert.changePct >= 0 ? '+' : ''}
                    {previewAlert.changePct.toFixed(2)}%
                  </div>
                  {previewAlert.isOver5Pct && (
                    <p className="mt-1">
                      Kenaikan lebih dari 5%! Sistem akan mencatat riwayat audit khusus dan
                      otomatis memperbarui seluruh HPP dan margin menu yang menggunakan bahan ini.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                  Harga Beli per {editingIngredient.unit} (Rupiah)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-500">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={newBuyPrice}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] font-semibold tabular-nums"
                  />
                </div>
                <p className="text-[11px] text-[#6B7280] mt-1">
                  Harga sebelumnya: {formatRupiah(editingIngredient.buyPrice)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                  Porsi per {editingIngredient.unit}
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  value={newPortions}
                  onChange={(e) => setNewPortions(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] font-semibold tabular-nums"
                />
                <p className="text-[11px] text-[#6B7280] mt-1">
                  Biaya per porsi baru: {' '}
                  <span className="font-bold text-[#1B2A5C]">
                    {formatRupiah((parseFloat(newBuyPrice) || 0) / (parseFloat(newPortions) || 1))}
                  </span>
                </p>
              </div>

              <div className="pt-4 border-t border-[#E2DED6] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingIngredient(null)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1B2A5C] hover:bg-[#243775] text-xs font-bold text-white shadow transition-colors flex items-center gap-1.5"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Simpan Perubahan & Update HPP</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
