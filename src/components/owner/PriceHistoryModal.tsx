import React from 'react';
import { X, History, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatRupiah, formatDateWIB } from '../../utils/calculations';

interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { priceHistory } = useStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#FAF8F4] w-full max-w-2xl rounded-2xl shadow-2xl border border-[#E2DED6] overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#1B2A5C] text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-200" />
            <div>
              <h3 className="font-bold text-lg">Riwayat Perubahan Harga Bahan</h3>
              <p className="text-xs text-gray-200">
                Pencatatan otomatis kenaikan/penurunan harga beli bahan baku & peringatan kenaikan &gt; 5%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List Table */}
        <div className="p-6 overflow-y-auto flex-1">
          {priceHistory.length === 0 ? (
            <div className="text-center py-12 text-[#6B7280] text-sm">
              Belum ada riwayat perubahan harga bahan yang tercatat.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E2DED6] overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] text-[#1B2A5C] uppercase font-semibold border-b border-[#E2DED6]">
                  <tr>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Bahan</th>
                    <th className="py-3 px-4 text-right">Harga Lama</th>
                    <th className="py-3 px-4 text-right">Harga Baru</th>
                    <th className="py-3 px-4 text-center">Perubahan</th>
                    <th className="py-3 px-4">Diubah Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2DED6]">
                  {priceHistory.map((item) => {
                    const isIncrease = item.changePct > 0;

                    return (
                      <tr key={item.id} className="hover:bg-[#FAF8F4]/50">
                        <td className="py-3 px-4 text-[#6B7280] tabular-nums whitespace-nowrap">
                          {formatDateWIB(item.changedAt)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#1F2937]">
                          {item.ingredientName}
                        </td>
                        <td className="py-3 px-4 text-right text-[#6B7280] tabular-nums">
                          {formatRupiah(item.oldPrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#1B2A5C] tabular-nums">
                          {formatRupiah(item.newPrice)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold tabular-nums ${
                              item.isAlertOver5Pct
                                ? 'bg-[#FCE8E9] text-[#D7262E] border border-[#D7262E]/30'
                                : isIncrease
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-emerald-50 text-emerald-800'
                            }`}
                          >
                            {isIncrease ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : (
                              <ArrowDown className="w-3 h-3" />
                            )}
                            {item.changePct >= 0 ? '+' : ''}
                            {item.changePct.toFixed(1)}%
                          </span>
                          {item.isAlertOver5Pct && (
                            <div className="text-[10px] text-[#D7262E] font-semibold mt-0.5 flex items-center justify-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              &gt; 5%
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#1F2937] font-medium">
                          {item.changedBy}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FAF8F4] border-t border-[#E2DED6] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#1B2A5C] text-white text-xs font-semibold hover:bg-[#243775] transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
