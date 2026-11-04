import React from 'react';
import {
  CheckCircle,
  X,
  AlertTriangle,
  ArrowRight,
  ShoppingBag,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { SalesItem, SalesChannel, PaymentMethod } from '../../types';
import { formatRupiah } from '../../utils/calculations';

interface CheckoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  items: SalesItem[];
  channel: SalesChannel;
  paymentMethod: PaymentMethod;
  totalGross: number;
  totalDiscount: number;
  totalNet: number;
  cashReceived?: number;
  cashChange?: number;
  cashierName: string;
}

export const CheckoutConfirmModal: React.FC<CheckoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  items,
  channel,
  paymentMethod,
  totalGross,
  totalDiscount,
  totalNet,
  cashReceived,
  cashChange,
  cashierName,
}) => {
  if (!isOpen) return null;

  const totalCups = items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#FAF8F4] w-full max-w-sm rounded-2xl shadow-2xl border border-[#E2DED6] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#1B2A5C] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Konfirmasi Transaksi Kasir</h3>
              <p className="text-[11px] text-gray-200">Periksa detail sebelum menyelesaikan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-3 text-xs flex-1">
          {/* Metadata Card */}
          <div className="bg-white p-3 rounded-xl border border-[#E2DED6] space-y-1.5">
            <div className="flex justify-between text-[#6B7280]">
              <span>Kasir:</span>
              <span className="font-semibold text-[#1F2937]">{cashierName}</span>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Channel Penjualan:</span>
              <span className="font-bold text-[#1B2A5C] uppercase bg-[#1B2A5C]/10 px-2 py-0.5 rounded">
                {channel}
              </span>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Metode Pembayaran:</span>
              <span className="font-bold text-[#1F2937] uppercase flex items-center gap-1">
                {paymentMethod === 'cash' ? (
                  <>
                    <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tunai (Cash)</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                    <span>QRIS Statis/Dinamis</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Items Summary */}
          <div className="bg-white p-3 rounded-xl border border-[#E2DED6] space-y-2">
            <div className="font-bold text-[#1B2A5C] uppercase text-[11px] flex justify-between">
              <span>Pesanan ({totalCups} Cup)</span>
              <span>Subtotal</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-36 overflow-y-auto">
              {items.map((it, idx) => (
                <div key={idx} className="py-1.5 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-[#1F2937]">{it.productName}</div>
                    <div className="text-[10px] text-[#6B7280]">
                      {it.quantity}x @{formatRupiah(it.unitPrice)}
                      {it.discountAmount > 0 && ` (Diskon: -${formatRupiah(it.discountAmount)})`}
                    </div>
                  </div>
                  <div className="font-bold text-[#1F2937] tabular-nums">
                    {formatRupiah(it.subtotal)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment & Change Summary */}
          <div className="bg-[#1B2A5C]/5 p-3 rounded-xl border border-[#1B2A5C]/20 space-y-1.5">
            <div className="flex justify-between text-[#6B7280]">
              <span>Subtotal Kotor:</span>
              <span className="tabular-nums font-semibold">{formatRupiah(totalGross)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-[#D7262E]">
                <span>Total Diskon Kasir:</span>
                <span className="tabular-nums font-bold">-{formatRupiah(totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-[#1B2A5C] pt-1 border-t border-[#1B2A5C]/10">
              <span>TOTAL DIBAYAR:</span>
              <span className="tabular-nums">{formatRupiah(totalNet)}</span>
            </div>

            {paymentMethod === 'cash' && cashReceived !== undefined && (
              <>
                <div className="flex justify-between text-[#1F2937] pt-1">
                  <span>Uang Diterima:</span>
                  <span className="tabular-nums font-bold">{formatRupiah(cashReceived)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  <span>KEMBALIAN:</span>
                  <span className="tabular-nums">{formatRupiah(cashChange || 0)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-white border-t border-[#E2DED6] flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 text-xs font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            Periksa Kembali
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 text-xs font-bold rounded-xl bg-[#1B2A5C] hover:bg-[#243775] text-white shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <span>Selesaikan Order</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
