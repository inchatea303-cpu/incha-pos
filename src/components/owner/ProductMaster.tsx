import React, { useState } from 'react';
import {
  Coffee,
  Edit3,
  Layers,
  AlertTriangle,
  Search,
  CheckCircle,
  Percent,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product, ProductCategory } from '../../types';
import { formatRupiah } from '../../utils/calculations';
import { RecipeEditorModal } from './RecipeEditorModal';

export const ProductMaster: React.FC = () => {
  const {
    role,
    products,
    getProductFinancials,
    updateProductPrice,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedProductForRecipe, setSelectedProductForRecipe] = useState<Product | null>(null);
  const [editingPriceProduct, setEditingPriceProduct] = useState<Product | null>(null);
  const [newSellPrice, setNewSellPrice] = useState<string>('');
  const [newMaxDiscount, setNewMaxDiscount] = useState<string>('');

  const filteredProducts = products.filter((prod) => {
    const matchesSearch = prod.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || prod.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleOpenPriceModal = (prod: Product) => {
    setEditingPriceProduct(prod);
    setNewSellPrice(prod.sellPrice.toString());
    setNewMaxDiscount(prod.maxDiscountPct.toString());
  };

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPriceProduct) return;

    const price = parseFloat(newSellPrice);
    const discount = parseFloat(newMaxDiscount);

    if (isNaN(price) || price < 0) {
      alert('Harga jual harus berupa bilangan positif.');
      return;
    }
    if (isNaN(discount) || discount < 0 || discount > 100) {
      alert('Batas diskon kasir harus antara 0% hingga 100%.');
      return;
    }

    updateProductPrice(editingPriceProduct.id, price, discount);
    setEditingPriceProduct(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-[#E2DED6] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1B2A5C]">Master Produk & HPP Otomatis</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1B2A5C]/10 text-[#1B2A5C] font-semibold">
              {products.length} Menu
            </span>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            {role === 'pemilik'
              ? 'HPP dihitung otomatis dari komposisi bahan baku + packaging (cup, lid sealer, biaya lain). Margin online menghitung komisi ojol 20%.'
              : 'Daftar menu aktif dan harga jual kasir. Data HPP dan margin dirahasiakan oleh database RLS.'}
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Cari menu (mis. Oolong, Osmanthus, Matcha)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] text-[#1F2937]"
        >
          <option value="all">Semua Kategori Menu</option>
          <option value="milk_tea">Milk Tea Series</option>
          <option value="pure_tea">Pure Tea Series</option>
          <option value="fruity_tea">Fruity Tea Series</option>
          <option value="special_blend">Special Blend</option>
        </select>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl border border-[#E2DED6] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAF8F4] text-[#1B2A5C] text-xs uppercase font-semibold border-b border-[#E2DED6]">
              <tr>
                <th className="py-3 px-4">Nama Menu & Kategori</th>
                <th className="py-3 px-4 text-right">Harga Jual</th>
                {role === 'pemilik' ? (
                  <>
                    <th className="py-3 px-4 text-right">HPP Otomatis</th>
                    <th className="py-3 px-4 text-right">Margin Langsung</th>
                    <th className="py-3 px-4 text-right">Margin Online (20%)</th>
                    <th className="py-3 px-4 text-right">Harga Min.</th>
                    <th className="py-3 px-4 text-center">Batas Diskon</th>
                    <th className="py-3 px-4 text-center">Aksi Resep</th>
                  </>
                ) : (
                  <th className="py-3 px-4 text-center">Proteksi Finansial</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2DED6]">
              {filteredProducts.map((prod) => {
                const fin = getProductFinancials(prod.id);

                return (
                  <tr key={prod.id} className="hover:bg-[#FAF8F4]/60 transition-colors">
                    {/* Nama Menu & Tag */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#1F2937]">{prod.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="capitalize text-[11px] text-[#6B7280]">
                          {prod.category.replace('_', ' ')}
                        </span>
                        {prod.verificationNote && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                            {prod.verificationNote}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Harga Jual */}
                    <td className="py-3 px-4 text-right font-bold text-[#1F2937] tabular-nums">
                      {formatRupiah(prod.sellPrice)}
                    </td>

                    {/* Finansial (HANYA PEMILIK) */}
                    {role === 'pemilik' && fin ? (
                      <>
                        {/* HPP */}
                        <td className="py-3 px-4 text-right font-semibold text-[#1B2A5C] tabular-nums">
                          {formatRupiah(fin.hpp)}
                        </td>

                        {/* Margin Langsung */}
                        <td className="py-3 px-4 text-right tabular-nums">
                          <div className="font-bold text-emerald-700">
                            {formatRupiah(fin.margin)}
                          </div>
                          <div className="text-[11px] text-emerald-600 font-medium">
                            {fin.marginPct.toFixed(1)}%
                          </div>
                        </td>

                        {/* Margin Online 20% */}
                        <td className="py-3 px-4 text-right tabular-nums">
                          <div className={`font-semibold ${fin.onlineMargin >= 0 ? 'text-blue-700' : 'text-[#D7262E]'}`}>
                            {formatRupiah(fin.onlineMargin)}
                          </div>
                          <div className="text-[10px] text-[#6B7280]">
                            net komisi 20%
                          </div>
                        </td>

                        {/* Harga Minimum */}
                        <td className="py-3 px-4 text-right tabular-nums text-xs">
                          <div className="text-[#1F2937] font-medium" title="Harga minimum penjualan langsung">
                            L: {formatRupiah(fin.minPriceDirect)}
                          </div>
                          <div className="text-[#6B7280]" title="Harga minimum penjualan online">
                            O: {formatRupiah(fin.minPriceOnline)}
                          </div>
                        </td>

                        {/* Batas Diskon Kasir */}
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-[#FAF8F4] border border-[#E2DED6] text-[#1F2937] tabular-nums">
                            Maks {prod.maxDiscountPct}%
                          </span>
                        </td>

                        {/* Aksi Resep & Harga */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedProductForRecipe(prod)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-white hover:bg-[#1B2A5C] hover:text-white text-xs font-semibold text-[#1B2A5C] border border-[#1B2A5C] transition-colors"
                              title="Buka Editor Resep Bahan"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Resep</span>
                            </button>
                            <button
                              onClick={() => handleOpenPriceModal(prod)}
                              className="p-1.5 rounded hover:bg-gray-100 text-[#6B7280] hover:text-[#1F2937] border border-transparent hover:border-gray-200 transition-colors"
                              title="Ubah Harga Jual & Batas Diskon"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      /* Karyawan Mode: Hidden */
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-gray-100 text-gray-500 border border-gray-200">
                          <ShieldAlert className="w-3.5 h-3.5 text-gray-400" />
                          HPP & Margin Dirahasiakan
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

      {/* Modal Recipe Editor */}
      {selectedProductForRecipe && (
        <RecipeEditorModal
          product={selectedProductForRecipe}
          onClose={() => setSelectedProductForRecipe(null)}
        />
      )}

      {/* Modal Edit Harga Jual Menu & Batas Diskon */}
      {editingPriceProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#FAF8F4] w-full max-w-sm rounded-2xl shadow-2xl border border-[#E2DED6] overflow-hidden">
            <div className="bg-[#1B2A5C] text-white p-5">
              <h3 className="font-bold text-base">Ubah Harga & Batas Diskon</h3>
              <p className="text-xs text-gray-200 mt-0.5">{editingPriceProduct.name}</p>
            </div>

            <form onSubmit={handleSavePrice} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                  Harga Jual Menu (Rupiah)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-500">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    value={newSellPrice}
                    onChange={(e) => setNewSellPrice(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] font-semibold tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                  Batas Maksimal Diskon Kasir (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    required
                    value={newMaxDiscount}
                    onChange={(e) => setNewMaxDiscount(e.target.value)}
                    className="w-full pr-8 pl-3 py-2 text-sm bg-white border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] font-semibold tabular-nums"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-gray-500">%</span>
                </div>
                <p className="text-[11px] text-[#6B7280] mt-1">
                  Kasir tidak dapat memberikan diskon melebihi persentase ini saat transaksi.
                </p>
              </div>

              <div className="pt-3 border-t border-[#E2DED6] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPriceProduct(null)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1B2A5C] hover:bg-[#243775] text-white text-xs font-bold shadow"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
