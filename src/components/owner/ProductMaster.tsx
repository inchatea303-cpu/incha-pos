import React, { useState, useRef } from 'react';
import {
  Coffee,
  Edit3,
  Layers,
  AlertTriangle,
  Search,
  CheckCircle,
  Plus,
  Camera,
  Trash2,
  Image as ImageIcon,
  Upload,
  X,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product, ProductCategory } from '../../types';
import { formatRupiah } from '../../utils/calculations';
import { RecipeEditorModal } from './RecipeEditorModal';
import { PRESET_PRODUCT_IMAGES, compressImageFile } from '../../utils/imageHelper';

export const ProductMaster: React.FC = () => {
  const {
    role,
    products,
    getProductFinancials,
    updateProductPrice,
    updateProduct,
    addProduct,
    deleteProduct,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedProductForRecipe, setSelectedProductForRecipe] = useState<Product | null>(null);
  const [editingPriceProduct, setEditingPriceProduct] = useState<Product | null>(null);
  const [newSellPrice, setNewSellPrice] = useState<string>('');
  const [newMaxDiscount, setNewMaxDiscount] = useState<string>('');

  // State untuk Modal Ubah Foto Produk
  const [editingPhotoProduct, setEditingPhotoProduct] = useState<Product | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State untuk Modal Tambah Menu Baru
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newMenuName, setNewMenuName] = useState<string>('');
  const [newMenuCategory, setNewMenuCategory] = useState<ProductCategory>('milk_tea');
  const [newMenuSellPrice, setNewMenuSellPrice] = useState<string>('24000');
  const [newMenuMaxDiscount, setNewMenuMaxDiscount] = useState<string>('15');
  const [newMenuImageUrl, setNewMenuImageUrl] = useState<string>('');
  const addFileInputRef = useRef<HTMLInputElement>(null);

  // State untuk Konfirmasi Hapus Menu
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

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

  // Buka Modal Foto
  const handleOpenPhotoModal = (prod: Product) => {
    setEditingPhotoProduct(prod);
    setPreviewImageUrl(prod.imageUrl || '');
  };

  // Upload dan kompresi file foto
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isForNewMenu = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressedDataUrl = await compressImageFile(file, 320, 0.82);
      if (isForNewMenu) {
        setNewMenuImageUrl(compressedDataUrl);
      } else {
        setPreviewImageUrl(compressedDataUrl);
      }
    } catch (err: any) {
      alert('Gagal memproses gambar: ' + err.message);
    } finally {
      setIsCompressing(false);
    }
  };

  // Simpan foto produk yang diedit
  const handleSavePhoto = () => {
    if (!editingPhotoProduct) return;
    updateProduct(editingPhotoProduct.id, { imageUrl: previewImageUrl });
    setEditingPhotoProduct(null);
  };

  // Simpan Menu Baru
  const handleCreateNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newMenuSellPrice);
    const maxDiscount = parseFloat(newMenuMaxDiscount);

    if (!newMenuName.trim()) {
      alert('Nama menu wajib diisi.');
      return;
    }
    if (isNaN(price) || price <= 0) {
      alert('Harga jual harus berupa nominal yang valid.');
      return;
    }

    addProduct({
      name: newMenuName.trim(),
      category: newMenuCategory,
      sellPrice: price,
      maxDiscountPct: isNaN(maxDiscount) ? 10 : maxDiscount,
      recipe: [],
      isVerified: true,
      active: true,
      imageUrl: newMenuImageUrl.trim() || undefined,
    });

    // Reset Form
    setNewMenuName('');
    setNewMenuCategory('milk_tea');
    setNewMenuSellPrice('24000');
    setNewMenuMaxDiscount('15');
    setNewMenuImageUrl('');
    setIsAddModalOpen(false);
  };

  // Eksekusi Hapus Menu
  const handleConfirmDelete = () => {
    if (!productToDelete) return;
    deleteProduct(productToDelete.id);
    setProductToDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Info & Tombol Tambah Menu */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-[#E2DED6] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1B2A5C]">Master Produk & Foto Menu</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1B2A5C]/10 text-[#1B2A5C] font-semibold">
              {products.length} Menu
            </span>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            {role === 'pemilik'
              ? 'Kelola foto produk, harga jual, margin HPP otomatis, dan komposisi resep. Foto yang diunggah otomatis tampil di aplikasi kasir POS.'
              : 'Daftar menu aktif dan harga jual kasir. Data HPP dan margin dirahasiakan oleh database RLS.'}
          </p>
        </div>

        {role === 'pemilik' && (
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1B2A5C] hover:bg-[#243775] text-white rounded-xl text-xs font-bold shadow transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Menu Baru</span>
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Cari menu (mis. Oolong, Osmanthus, Matcha, Peach)..."
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
                <th className="py-3 px-3 text-center w-16">Foto</th>
                <th className="py-3 px-4">Nama Menu & Kategori</th>
                <th className="py-3 px-4 text-right">Harga Jual</th>
                {role === 'pemilik' ? (
                  <>
                    <th className="py-3 px-4 text-right">HPP Otomatis</th>
                    <th className="py-3 px-4 text-right">Margin Langsung</th>
                    <th className="py-3 px-4 text-right">Margin Online (20%)</th>
                    <th className="py-3 px-4 text-center">Batas Diskon</th>
                    <th className="py-3 px-4 text-center">Aksi & Foto</th>
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
                    {/* Thumbnail Foto Menu */}
                    <td className="py-3 px-3 text-center">
                      <div className="relative group mx-auto w-12 h-12">
                        {prod.imageUrl ? (
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-12 h-12 rounded-xl object-cover border border-[#E2DED6] shadow-xs cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => role === 'pemilik' && handleOpenPhotoModal(prod)}
                            title="Klik untuk ubah foto"
                          />
                        ) : (
                          <div
                            onClick={() => role === 'pemilik' && handleOpenPhotoModal(prod)}
                            className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 border border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer transition-colors text-gray-400 hover:text-[#1B2A5C]"
                            title="Klik untuk tambah foto"
                          >
                            <Camera className="w-5 h-5" />
                            <span className="text-[9px] font-bold mt-0.5">+ Foto</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Nama Menu & Tag */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#1F2937] flex items-center gap-1.5">
                        <span>{prod.name}</span>
                        {!prod.active && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500 font-medium">
                            Nonaktif
                          </span>
                        )}
                      </div>
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

                        {/* Batas Diskon Kasir */}
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-[#FAF8F4] border border-[#E2DED6] text-[#1F2937] tabular-nums">
                            Maks {prod.maxDiscountPct}%
                          </span>
                        </td>

                        {/* Aksi Resep, Foto, Harga & Hapus */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Tombol Foto */}
                            <button
                              type="button"
                              onClick={() => handleOpenPhotoModal(prod)}
                              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
                              title="Ubah / Unggah Foto Menu"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>

                            {/* Tombol Resep */}
                            <button
                              type="button"
                              onClick={() => setSelectedProductForRecipe(prod)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-white hover:bg-[#1B2A5C] hover:text-white text-xs font-semibold text-[#1B2A5C] border border-[#1B2A5C] transition-colors"
                              title="Buka Editor Resep Bahan"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Resep</span>
                            </button>

                            {/* Tombol Ubah Harga */}
                            <button
                              type="button"
                              onClick={() => handleOpenPriceModal(prod)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-[#6B7280] hover:text-[#1F2937] border border-transparent hover:border-gray-200 transition-colors"
                              title="Ubah Harga Jual & Batas Diskon"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Tombol Hapus Menu */}
                            <button
                              type="button"
                              onClick={() => setProductToDelete(prod)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 border border-transparent hover:border-red-200 transition-colors"
                              title="Hapus Menu"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* ========================================================================= */}
      {/* MODAL UBAH / UNGGAH FOTO MENU                                             */}
      {/* ========================================================================= */}
      {editingPhotoProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#FAF8F4] w-full max-w-lg rounded-2xl shadow-2xl border border-[#E2DED6] overflow-hidden my-6">
            <div className="bg-[#1B2A5C] text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Camera className="w-5 h-5 text-amber-400" />
                  <span>Foto Menu Minuman</span>
                </h3>
                <p className="text-xs text-gray-200 mt-0.5">{editingPhotoProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPhotoProduct(null)}
                className="p-1 rounded-full text-gray-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Preview Foto */}
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-[#E2DED6]">
                <div className="relative w-36 h-36 rounded-2xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 shadow-sm flex items-center justify-center">
                  {previewImageUrl ? (
                    <img
                      src={previewImageUrl}
                      alt="Preview Foto"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-3 text-gray-400">
                      <ImageIcon className="w-8 h-8 mx-auto mb-1 text-gray-300" />
                      <span className="text-xs">Belum ada foto</span>
                    </div>
                  )}
                  {isCompressing && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-xs">
                      <span>Mengompresi...</span>
                    </div>
                  )}
                </div>
                {previewImageUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewImageUrl('')}
                    className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:underline"
                  >
                    Hapus Foto Ini
                  </button>
                )}
              </div>

              {/* Opsi 1: Unggah dari Kamera / Galeri HP */}
              <div>
                <label className="block text-xs font-bold text-[#1F2937] mb-1.5 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[#1B2A5C]" />
                  <span>1. Unggah dari Galeri / Kamera HP atau Laptop</span>
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, false)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-[#1B2A5C]/40 bg-white hover:bg-blue-50/50 text-[#1B2A5C] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <span>Pilih File Gambar (Otomatis Diringankan Ringan & Cepat)</span>
                </button>
                <p className="text-[11px] text-[#6B7280] mt-1">
                  Foto otomatis dikompres ke format ringan (~15KB) sehingga tidak memberatkan memori kasir offline.
                </p>
              </div>

              {/* Opsi 2: Pilih Preset Gambar Estetik Incha */}
              <div>
                <label className="block text-xs font-bold text-[#1F2937] mb-1.5">
                  2. Atau Pilih dari Koleksi Preset Minuman Estetik:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_PRODUCT_IMAGES.map((preset) => {
                    const isSelected = previewImageUrl === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setPreviewImageUrl(preset.url)}
                        className={`p-1.5 rounded-xl border text-left flex flex-col items-center transition-all ${
                          isSelected
                            ? 'border-2 border-[#1B2A5C] bg-[#1B2A5C]/10 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-400'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-full h-16 rounded-lg object-cover"
                        />
                        <span className="text-[10px] font-semibold text-[#1F2937] text-center mt-1 line-clamp-1">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opsi 3: Input URL Custom */}
              <div>
                <label className="block text-xs font-bold text-[#1F2937] mb-1">
                  3. Atau Tempel Link / URL Foto Kustom:
                </label>
                <input
                  type="url"
                  placeholder="https://contoh.com/foto-minuman.jpg"
                  value={previewImageUrl.startsWith('data:') ? '' : previewImageUrl}
                  onChange={(e) => setPreviewImageUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C]"
                />
              </div>

              {/* Tombol Aksi Simpan */}
              <div className="pt-3 border-t border-[#E2DED6] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPhotoProduct(null)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSavePhoto}
                  className="px-5 py-2 rounded-lg bg-[#1B2A5C] hover:bg-[#243775] text-white text-xs font-bold shadow"
                >
                  Simpan Foto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL TAMBAH MENU BARU                                                    */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#FAF8F4] w-full max-w-md rounded-2xl shadow-2xl border border-[#E2DED6] overflow-hidden my-6">
            <div className="bg-[#1B2A5C] text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Plus className="w-5 h-5 text-amber-400" />
                  <span>Tambah Menu Minuman Baru</span>
                </h3>
                <p className="text-xs text-gray-200 mt-0.5">
                  Tambahkan menu ke daftar kasir POS & atur resep bahan baku
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-full text-gray-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewProduct} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                  Nama Menu Minuman *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Taro Milk Tea with Boba"
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                  Kategori Menu *
                </label>
                <select
                  value={newMenuCategory}
                  onChange={(e) => setNewMenuCategory(e.target.value as ProductCategory)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] font-semibold text-[#1F2937]"
                >
                  <option value="milk_tea">Milk Tea Series</option>
                  <option value="pure_tea">Pure Tea Series</option>
                  <option value="fruity_tea">Fruity Tea Series</option>
                  <option value="special_blend">Special Blend</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                    Harga Jual Kasir (Rp) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-500">Rp</span>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      required
                      value={newMenuSellPrice}
                      onChange={(e) => setNewMenuSellPrice(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] font-semibold tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                    Batas Diskon (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      required
                      value={newMenuMaxDiscount}
                      onChange={(e) => setNewMenuMaxDiscount(e.target.value)}
                      className="w-full pr-8 pl-3 py-2 text-sm bg-white border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] font-semibold tabular-nums"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-gray-500">%</span>
                  </div>
                </div>
              </div>

              {/* Upload Foto untuk Menu Baru */}
              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1 flex items-center justify-between">
                  <span>Foto Menu (Opsional)</span>
                  {newMenuImageUrl && (
                    <button
                      type="button"
                      onClick={() => setNewMenuImageUrl('')}
                      className="text-[10px] text-red-600 hover:underline"
                    >
                      Hapus
                    </button>
                  )}
                </label>
                <div className="flex items-center gap-3 p-3 bg-white border border-[#E2DED6] rounded-xl">
                  <div className="w-14 h-14 rounded-xl bg-gray-100 border border-gray-300 flex items-center justify-center shrink-0 overflow-hidden">
                    {newMenuImageUrl ? (
                      <img
                        src={newMenuImageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="file"
                      ref={addFileInputRef}
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, true)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => addFileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg border border-gray-300 transition-colors"
                    >
                      Pilih dari File / Kamera
                    </button>
                    <p className="text-[10px] text-gray-500">
                      Bisa juga dipilih dari preset minuman setelah menu disimpan.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2DED6] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#1B2A5C] hover:bg-[#243775] text-white text-xs font-bold shadow"
                >
                  Simpan Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI HAPUS MENU                                               */}
      {/* ========================================================================= */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#FAF8F4] w-full max-w-sm rounded-2xl shadow-2xl border border-[#E2DED6] overflow-hidden p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#1F2937]">Hapus Menu Minuman?</h3>
                <p className="text-xs text-[#6B7280]">
                  Menu &quot;{productToDelete.name}&quot; akan dihapus dari daftar kasir.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow"
              >
                Ya, Hapus Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL RESEP BAHAN (RECIPE EDITOR)                                         */}
      {/* ========================================================================= */}
      {selectedProductForRecipe && (
        <RecipeEditorModal
          product={selectedProductForRecipe}
          onClose={() => setSelectedProductForRecipe(null)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL EDIT HARGA JUAL MENU & BATAS DISKON                                 */}
      {/* ========================================================================= */}
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
