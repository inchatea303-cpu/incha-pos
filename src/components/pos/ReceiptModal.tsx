import React, { useState } from 'react';
import {
  Printer,
  X,
  CheckCircle,
  Copy,
  Check,
  Coins,
  Tag,
  Sparkles,
} from 'lucide-react';
import { SalesTransaction } from '../../types';
import {
  bluetoothPrinter,
  generateReceiptText,
  printViaRawBT,
  isNativeAndroidApp,
  extractQueueNumber,
} from '../../utils/bluetoothPrinter';
import { formatRupiah, formatDateWIB } from '../../utils/calculations';

interface ReceiptModalProps {
  transaction: SalesTransaction;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  isOpen,
  onClose,
}) => {
  const [activePreviewTab, setActivePreviewTab] = useState<'receipt' | 'label'>('receipt');
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const totalCups = transaction.items.reduce((sum, it) => sum + (it.quantity || 1), 0);
  const queueNo = extractQueueNumber(transaction.invoiceNumber);
  const receiptText = generateReceiptText(transaction);

  const dateObj = new Date(transaction.timestamp || Date.now());
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes} WIB`;

  // 1. Cetak Keduanya Sekaligus (1 Tombol Struk + Stiker Cup)
  const handlePrintBoth = async () => {
    setIsPrinting(true);
    setPrintStatus('Mengirim ke Printer Struk & Printer Stiker EPPOS...');
    try {
      const res = await bluetoothPrinter.printDual(transaction, { receipt: true, label: true });
      if (res.receiptSuccess || res.labelSuccess) {
        setPrintStatus(`✅ Berhasil: ${res.message}`);
      } else {
        setPrintStatus('⚠️ Periksa koneksi Bluetooth: Pastikan Printer Kasir & EPPOS sudah tersambung.');
      }
    } catch (e: any) {
      setPrintStatus(`Gagal cetak: ${e.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  // 2. Cetak Struk Saja
  const handlePrintReceiptOnly = async () => {
    setIsPrinting(true);
    setPrintStatus('Mencetak struk kasir...');
    try {
      const res = await bluetoothPrinter.printReceipt(transaction, true);
      if (res.success) {
        setPrintStatus('✅ Struk kasir berhasil dicetak!');
      } else {
        // Fallback coba RawBT jika native socket belum pairing
        printViaRawBT(transaction);
        setPrintStatus('Mengirim struk via RawBT...');
      }
    } catch (e: any) {
      setPrintStatus(`Gagal cetak struk: ${e.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  // 3. Cetak Stiker Cup Saja
  const handlePrintLabelsOnly = async () => {
    setIsPrinting(true);
    setPrintStatus(`Mencetak ${totalCups} stiker cup ke printer EPPOS...`);
    try {
      const res = await bluetoothPrinter.printCupLabels(transaction);
      if (res.success) {
        setPrintStatus(`✅ Berhasil mencetak ${res.printedCups} stiker cup!`);
      } else {
        setPrintStatus(`⚠️ ${res.message}`);
      }
    } catch (e: any) {
      setPrintStatus(`Gagal cetak stiker cup: ${e.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleOpenDrawer = async () => {
    const res = await bluetoothPrinter.openCashDrawer();
    setPrintStatus(res.message);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(receiptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#FAF8F4] w-full max-w-sm rounded-2xl shadow-2xl border border-[#E2DED6] overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="bg-[#1B2A5C] text-white p-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Transaksi Berhasil!</h3>
              <p className="text-[11px] text-gray-200">
                Antrian <span className="font-extrabold text-amber-300">{queueNo}</span> · {totalCups} Cup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector Preview: Struk vs Stiker Cup */}
        <div className="flex border-b border-gray-200 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActivePreviewTab('receipt')}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activePreviewTab === 'receipt'
                ? 'border-[#1B2A5C] text-[#1B2A5C] bg-[#FAF8F4]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Struk Kasir</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePreviewTab('label')}
            className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activePreviewTab === 'label'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-emerald-600" />
            <span>Stiker Cup ({totalCups})</span>
          </button>
        </div>

        {/* Preview Area */}
        <div className="p-4 overflow-y-auto flex-1 bg-gray-100 flex flex-col items-center justify-start space-y-3">
          {activePreviewTab === 'receipt' ? (
            /* Mockup Struk Kasir */
            <div id="printable-receipt" className="w-full max-w-[280px] bg-white p-4 rounded shadow font-mono text-xs text-gray-800 leading-tight border border-dashed border-gray-300 select-none">
              <div className="text-center font-bold text-sm mb-0.5 text-black">
                INCHA MILK TEA
              </div>
              <div className="text-center text-[10px] text-gray-500 mb-2">
                Karang Tengah, Tangerang
              </div>
              <div className="border-b border-dashed border-gray-400 my-1.5" />

              <div className="text-[10px] space-y-0.5 text-gray-600">
                <div className="flex justify-between font-bold text-black">
                  <span>Antrian: {queueNo}</span>
                  <span>{timeStr}</span>
                </div>
                <div className="flex justify-between">
                  <span>No: {transaction.invoiceNumber}</span>
                </div>
                <div className="flex justify-between font-semibold text-black">
                  <span>Kasir: {transaction.cashierName}</span>
                  <span className="uppercase font-bold text-[#1B2A5C]">
                    [{transaction.channel}]
                  </span>
                </div>
              </div>

              <div className="border-b border-dashed border-gray-400 my-1.5" />

              {/* Items */}
              <div className="space-y-1.5 my-1.5">
                {transaction.items.map((it, idx) => (
                  <div key={idx}>
                    <div className="font-bold text-[11px] text-black">
                      {it.productName}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>
                        {it.quantity}x @{formatRupiah(it.unitPrice)}
                      </span>
                      <span className="font-semibold text-black">
                        {formatRupiah(it.subtotal)}
                      </span>
                    </div>
                    {it.discountAmount > 0 && (
                      <div className="flex justify-between text-[10px] text-[#D7262E]">
                        <span>Diskon</span>
                        <span>-{formatRupiah(it.discountAmount)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-b border-dashed border-gray-400 my-1.5" />

              {/* Totals */}
              <div className="space-y-1 text-[11px]">
                {transaction.totalDiscount > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatRupiah(transaction.totalGross)}</span>
                    </div>
                    <div className="flex justify-between text-[#D7262E]">
                      <span>Diskon</span>
                      <span>-{formatRupiah(transaction.totalDiscount)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-extrabold text-sm text-black pt-1 border-t border-gray-300">
                  <span>TOTAL</span>
                  <span>{formatRupiah(transaction.totalNet)}</span>
                </div>
                {transaction.paymentMethod === 'cash' &&
                  transaction.cashReceived !== undefined && (
                    <>
                      <div className="flex justify-between text-[10px] text-gray-600">
                        <span>Tunai</span>
                        <span>{formatRupiah(transaction.cashReceived)}</span>
                      </div>
                      {(transaction.cashChange || 0) > 0 && (
                        <div className="flex justify-between text-[10px] font-bold text-black">
                          <span>Kembali</span>
                          <span>{formatRupiah(transaction.cashChange || 0)}</span>
                        </div>
                      )}
                    </>
                  )}
                {transaction.paymentMethod === 'qris' && (
                  <div className="flex justify-between text-[10px] text-blue-700 font-bold">
                    <span>Bayar</span>
                    <span>QRIS (LUNAS)</span>
                  </div>
                )}
              </div>

              <div className="border-b border-dashed border-gray-400 my-1.5" />
              <div className="text-center text-[10px] text-gray-600 leading-normal">
                Terima Kasih!
                <br />
                @incha.karangtengah
              </div>
            </div>
          ) : (
            /* Mockup Stiker Cup EPPOS (Dicetak per cup) */
            <div className="w-full space-y-2.5">
              <div className="text-[11px] text-center text-gray-500 font-medium">
                Pratinjau {totalCups} Stiker Cup (Kertas EPPOS 30mm):
              </div>
              {(() => {
                let cupCounter = 0;
                return transaction.items.map((item, itemIdx) => {
                  const qty = item.quantity || 1;
                  return Array.from({ length: qty }).map((_, cupIdx) => {
                    cupCounter++;
                    return (
                      <div
                        key={`${itemIdx}-${cupIdx}`}
                        className="w-full max-w-[260px] mx-auto bg-white p-3 rounded-xl shadow-md border-2 border-emerald-400 font-mono text-center text-gray-900 select-none space-y-1 relative"
                      >
                        <span className="absolute top-1 right-2 text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                          Cup {cupCounter} dari {totalCups}
                        </span>
                        <div className="font-extrabold text-xs tracking-wider text-black">
                          INCHA TEA
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-gray-700 px-1 border-b border-gray-300 pb-1">
                          <span>{totalCups > 1 ? `${queueNo} (${cupCounter}/${totalCups})` : queueNo}</span>
                          <span>{timeStr}</span>
                        </div>
                        <div className="py-1.5 px-0.5">
                          <div className="font-extrabold text-xs uppercase leading-tight text-black">
                            {item.productName}
                          </div>
                        </div>
                        <div className="border-t border-gray-300 pt-1 text-[10px] font-bold text-emerald-800 flex items-center justify-center gap-1">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          <span>Have a Good Day! ✨</span>
                        </div>
                      </div>
                    );
                  });
                });
              })()}
            </div>
          )}
        </div>

        {/* Print Feedback Status */}
        {printStatus && (
          <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-amber-800 text-[11px] text-center font-medium leading-tight shrink-0">
            {printStatus}
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-3 bg-white border-t border-[#E2DED6] space-y-2 shrink-0">
          {/* TOMBOL UTAMA: CETAK KEDUANYA SEKALIGUS */}
          <button
            type="button"
            onClick={handlePrintBoth}
            disabled={isPrinting}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-60"
          >
            <Printer className="w-4 h-4 text-emerald-200" />
            <span>Cetak Struk + Stiker Cup ({totalCups}x)</span>
          </button>

          {/* OPSI CETAK TERPISAH */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePrintReceiptOnly}
              disabled={isPrinting}
              className="h-10 rounded-lg bg-[#1B2A5C] hover:bg-[#243775] text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-60"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Struk Saja</span>
            </button>

            <button
              type="button"
              onClick={handlePrintLabelsOnly}
              disabled={isPrinting}
              className="h-10 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-60"
            >
              <Tag className="w-3.5 h-3.5 text-emerald-700" />
              <span>Stiker Cup ({totalCups}x)</span>
            </button>
          </div>

          {/* Buka Laci, Salin Teks, Selesai */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleOpenDrawer}
              className="flex-1 py-1.5 text-xs font-semibold text-[#1B2A5C] bg-[#FAF8F4] hover:bg-gray-100 border border-[#1B2A5C]/30 rounded-lg flex items-center justify-center gap-1 transition-colors"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Laci</span>
            </button>
            <button
              type="button"
              onClick={handleCopyText}
              className="flex-1 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center gap-1 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin' : 'Salin'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-1.5 text-xs font-bold text-white bg-gray-800 hover:bg-gray-900 rounded-lg shadow-sm transition-colors"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
