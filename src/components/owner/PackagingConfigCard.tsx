import React, { useState } from 'react';
import { Package, Check, AlertCircle } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatRupiah } from '../../utils/calculations';

export const PackagingConfigCard: React.FC = () => {
  const { packaging, updatePackaging } = useStore();
  const [cupPrice, setCupPrice] = useState(packaging.cupPrice.toString());
  const [lidPrice, setLidPrice] = useState(packaging.lidRollPrice.toString());
  const [lidCups, setLidCups] = useState(packaging.lidCupsPerRoll.toString());
  const [otherCosts, setOtherCosts] = useState(packaging.otherCostsPerCup.toString());
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updatePackaging({
      cupPrice: parseFloat(cupPrice) || 0,
      lidRollPrice: parseFloat(lidPrice) || 0,
      lidCupsPerRoll: parseInt(lidCups, 10) || 1,
      otherCostsPerCup: parseFloat(otherCosts) || 0,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const lidPerCup = (parseFloat(lidPrice) || 0) / (parseInt(lidCups, 10) || 1);

  return (
    <div className="bg-white p-5 rounded-xl border border-[#E2DED6] shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-5 h-5 text-[#1B2A5C]" />
        <h3 className="font-bold text-base text-[#1B2A5C]">
          Komponen Biaya Kemasan & Biaya Lain (HPP Universal)
        </h3>
      </div>
      <p className="text-xs text-[#6B7280] mb-4">
        Biaya ini otomatis diakumulasikan ke setiap porsi cup seluruh menu untuk menghitung HPP akhir.
      </p>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#1F2937] mb-1">
              Biaya Cup Khusus (pcs)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-500">Rp</span>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={cupPrice}
                onChange={(e) => setCupPrice(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F4] border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] font-semibold tabular-nums"
              />
            </div>
            <div className="text-[10px] text-[#6B7280] mt-1">Min. order 200 pcs</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F2937] mb-1">
              Lid Sealer per Roll (1.200 Cup)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-500">Rp</span>
              <input
                type="number"
                min="0"
                step="1000"
                required
                value={lidPrice}
                onChange={(e) => setLidPrice(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F4] border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] font-semibold tabular-nums"
              />
            </div>
            <div className="text-[10px] text-[#1B2A5C] font-medium mt-1">
              = {formatRupiah(lidPerCup)} / cup
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#1F2937]">
                Biaya Lain per Cup
              </label>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                ASUMSI
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-500">Rp</span>
              <input
                type="number"
                min="0"
                step="100"
                required
                value={otherCosts}
                onChange={(e) => setOtherCosts(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F4] border border-[#E2DED6] rounded-lg focus:outline-none focus:border-[#1B2A5C] font-semibold tabular-nums"
              />
            </div>
            <div className="text-[10px] text-[#6B7280] mt-1">
              Es batu, gula cair, sedotan, plastik
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#E2DED6]">
          <div className="text-xs text-[#1B2A5C] font-bold">
            Total Komponen Kemasan Dasar:{' '}
            <span className="text-sm underline underline-offset-2">
              {formatRupiah((parseFloat(cupPrice) || 0) + lidPerCup + (parseFloat(otherCosts) || 0))}
            </span>{' '}
            / cup
          </div>

          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1B2A5C] hover:bg-[#243775] text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tersimpan!</span>
              </>
            ) : (
              <span>Perbarui Biaya Kemasan</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
