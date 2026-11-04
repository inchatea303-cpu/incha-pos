import React, { useState } from 'react';
import { X, Plus, Trash2, Calculator, Info, Check } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product, RecipeItem } from '../../types';
import {
  calculateHPP,
  calculateMargin,
  calculateMarginPct,
  calculateOnlineMargin,
  formatRupiah,
} from '../../utils/calculations';

interface RecipeEditorModalProps {
  product: Product;
  onClose: () => void;
}

export const RecipeEditorModal: React.FC<RecipeEditorModalProps> = ({
  product,
  onClose,
}) => {
  const {
    ingredients,
    packaging,
    businessParams,
    updateProductRecipe,
  } = useStore();

  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>(product.recipe);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>(
    ingredients[0]?.id || ''
  );
  const [amountInput, setAmountInput] = useState<string>('1');

  const ingredientsMap = React.useMemo(() => {
    const map: Record<string, any> = {};
    ingredients.forEach((i) => {
      map[i.id] = i;
    });
    return map;
  }, [ingredients]);

  // Real-time calculation based on current editor state
  const liveHpp = calculateHPP(recipeItems, ingredientsMap, packaging);
  const liveMargin = calculateMargin(product.sellPrice, liveHpp);
  const liveMarginPct = calculateMarginPct(liveMargin, product.sellPrice);
  const liveOnlineMargin = calculateOnlineMargin(
    product.sellPrice,
    liveHpp,
    businessParams.ojolCommissionPct
  );

  const handleAddIngredient = () => {
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) {
      alert('Takaran porsi harus lebih dari 0');
      return;
    }

    const existingIndex = recipeItems.findIndex(
      (item) => item.ingredientId === selectedIngredientId
    );
    if (existingIndex >= 0) {
      const updated = [...recipeItems];
      updated[existingIndex].amount += amount;
      setRecipeItems(updated);
    } else {
      setRecipeItems([
        ...recipeItems,
        { ingredientId: selectedIngredientId, amount },
      ]);
    }
  };

  const handleRemoveIngredient = (index: number) => {
    setRecipeItems(recipeItems.filter((_, idx) => idx !== index));
  };

  const handleAmountChange = (index: number, newAmount: number) => {
    if (newAmount <= 0) return;
    const updated = [...recipeItems];
    updated[index].amount = newAmount;
    setRecipeItems(updated);
  };

  const handleSaveRecipe = () => {
    updateProductRecipe(product.id, recipeItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#FAF8F4] w-full max-w-2xl rounded-2xl shadow-2xl border border-[#E2DED6] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#1B2A5C] text-white p-5 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{product.name}</h3>
              <span className="text-[10px] uppercase font-bold bg-[#FAF8F4] text-[#1B2A5C] px-2 py-0.5 rounded">
                Resep Standar
              </span>
            </div>
            <p className="text-xs text-gray-200 mt-1">
              Atur takaran porsi bahan. HPP & margin dihitung otomatis secara presisi.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Packaging Note */}
          <div className="bg-white p-3.5 rounded-lg border border-[#E2DED6] text-xs text-[#6B7280] flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#1B2A5C] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#1F2937]">Komponen Kemasan Otomatis:</span> Setiap cup otomatis ditambahkan biaya Cup ({formatRupiah(packaging.cupPrice)}), Lid Sealer ({formatRupiah(packaging.lidRollPrice / packaging.lidCupsPerRoll)}), dan Biaya Operasional Cup ({formatRupiah(packaging.otherCostsPerCup)}).
            </div>
          </div>

          {/* Add Ingredient Section */}
          <div className="bg-white p-4 rounded-xl border border-[#E2DED6] shadow-sm">
            <div className="text-xs font-bold text-[#1B2A5C] uppercase mb-2">
              Tambah Bahan ke Resep
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-7">
                <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                  Pilih Bahan Baku
                </label>
                <select
                  value={selectedIngredientId}
                  onChange={(e) => setSelectedIngredientId(e.target.value)}
                  className="w-full text-xs p-2 bg-[#FAF8F4] border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C]"
                >
                  {ingredients
                    .filter((i) => i.category !== 'packaging')
                    .map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({formatRupiah(ing.costPerPortion)} / porsi)
                      </option>
                    ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-[#1F2937] mb-1">
                  Takaran Porsi
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full text-xs p-2 bg-[#FAF8F4] border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] tabular-nums font-semibold"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  className="w-full py-2 bg-[#1B2A5C] hover:bg-[#243775] text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>
          </div>

          {/* List of Ingredients in Recipe */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#1F2937] uppercase flex items-center justify-between">
              <span>Bahan dalam Resep ({recipeItems.length})</span>
              <span className="text-[11px] text-[#6B7280] font-normal">Takaran per 1 cup</span>
            </div>

            {recipeItems.length === 0 ? (
              <div className="text-center py-6 bg-white rounded-lg border border-[#E2DED6] text-xs text-[#6B7280]">
                Belum ada bahan dalam resep ini. Silakan tambahkan bahan di atas.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#E2DED6] divide-y divide-[#E2DED6] overflow-hidden">
                {recipeItems.map((item, idx) => {
                  const ing = ingredientsMap[item.ingredientId];
                  const itemCost = ing ? ing.costPerPortion * item.amount : 0;

                  return (
                    <div
                      key={idx}
                      className="p-3 flex items-center justify-between text-xs hover:bg-[#FAF8F4]/50"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-[#1F2937]">
                          {ing ? ing.name : 'Bahan Tidak Dikenal'}
                        </div>
                        <div className="text-[11px] text-[#6B7280]">
                          {formatRupiah(ing?.costPerPortion || 0)} per porsi
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={item.amount}
                            onChange={(e) =>
                              handleAmountChange(idx, parseFloat(e.target.value) || 0)
                            }
                            className="w-16 px-2 py-1 text-center font-bold bg-[#FAF8F4] border border-[#E2DED6] rounded text-xs tabular-nums"
                          />
                          <span className="text-[#6B7280] text-[11px]">porsi</span>
                        </div>

                        <div className="w-24 text-right font-bold text-[#1B2A5C] tabular-nums">
                          {formatRupiah(itemCost)}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(idx)}
                          className="text-[#6B7280] hover:text-[#D7262E] p-1 rounded"
                          title="Hapus bahan dari resep"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Financial Calculation Box */}
          <div className="bg-[#1B2A5C]/5 border border-[#1B2A5C]/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1B2A5C] uppercase mb-3">
              <Calculator className="w-4 h-4" />
              <span>Simulasi HPP & Margin Real-Time</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-[#E2DED6]">
                <div className="text-[11px] text-[#6B7280]">Harga Jual Menu</div>
                <div className="text-sm font-bold text-[#1F2937] tabular-nums">
                  {formatRupiah(product.sellPrice)}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-[#E2DED6]">
                <div className="text-[11px] text-[#6B7280]">Total HPP / Cup</div>
                <div className="text-sm font-bold text-[#1B2A5C] tabular-nums">
                  {formatRupiah(liveHpp)}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-[#E2DED6]">
                <div className="text-[11px] text-[#6B7280]">Margin Langsung</div>
                <div className="text-sm font-bold text-emerald-700 tabular-nums">
                  {formatRupiah(liveMargin)} ({liveMarginPct.toFixed(1)}%)
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-[#E2DED6]">
                <div className="text-[11px] text-[#6B7280]">Margin Online (20%)</div>
                <div className="text-sm font-bold text-blue-700 tabular-nums">
                  {formatRupiah(liveOnlineMargin)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FAF8F4] border-t border-[#E2DED6] flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSaveRecipe}
            className="px-5 py-2 text-xs font-bold rounded-lg bg-[#1B2A5C] hover:bg-[#243775] text-white shadow transition-colors flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Simpan Resep & Perbarui HPP</span>
          </button>
        </div>
      </div>
    </div>
  );
};
