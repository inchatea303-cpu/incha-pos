import React, { useState } from 'react';
import {
  Printer,
  X,
  CheckCircle,
  Copy,
  Check,
  Coins,
  RefreshCw,
} from 'lucide-react';
import { SalesTransaction } from '../../types';
import {
  bluetoothPrinter,
  generateReceiptText,
  printViaRawBT,
  isNativeAndroidApp,
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
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const receiptText = generateReceiptText(transaction);

  const handlePrint = async () => {
    setIsPrinting(true);
    setPrintStatus('Mengirim ke printer Bluetooth...');
    try {
      const result = await bluetoothPrinter.printReceipt(transaction, true);
      if (result.success) {
        setPrintStatus('Struk berhasil dicetak & laci kas dibuka!');
      } else {
        setPrintStatus(
          'Printer fisik belum terhubung via Web Bluetooth. Struk ditampilkan secara virtual.'
        );
      }
    } catch (e: any) {
      setPrintStatus(`Gagal cetak: ${e.message}`);
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
      <div className="bg-[#FAF8F4] w-full max-w-sm rounded-2xl shadow-2xl border border-[#E2DED6] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#1B2A5C] text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Transaksi Berhasil!</h3>
              <p className="text-[11px] text-gray-200">{transaction.invoiceNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal Receipt Paper Mockup */}
        <div className="p-4 overflow-y-auto flex-1 bg-gray-100 flex justify-center">
          <div id="printable-receipt" className="w-full max-w-[280px] bg-white p-4 rounded shadow font-mono text-xs text-gray-800 leading-tight border border-dashed border-gray-300 select-none">
            <div className="text-center font-bold text-sm mb-1 text-black">
              INCHA MILK TEA
            </div>
            <div className="text-center text-[10px] text-gray-500 mb-2">
              Karang Tengah, Tangerang
            </div>
            <div className="border-b border-dashed border-gray-400 my-1.5" />

            <div className="text-[10px] space-y-0.5 text-gray-600">
              <div className="flex justify-between">
                <span>No: {transaction.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Wkt: {formatDateWIB(transaction.timestamp)}</span>
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

            {/* Totals Ringkas (Hemat Kertas) */}
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
        </div>

        {/* Print Feedback Status */}
        {printStatus && (
          <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-amber-800 text-[11px] text-center font-medium">
            {printStatus}
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-4 bg-white border-t border-[#E2DED6] space-y-2 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={async () => {
                const electron = (window as any).electronAPI;
                if (electron && typeof electron.printSilent === 'function') {
                  setIsPrinting(true);
                  setPrintStatus('Mencetak langsung ke printer kasir Windows...');
                  try {
                    const res = await electron.printSilent();
                    if (res.success) {
                      setPrintStatus('Struk berhasil dicetak langsung!');
                    } else {
                      setPrintStatus('Gagal cetak via desktop: ' + (res.error || 'Periksa printer Windows'));
                    }
                  } catch (err: any) {
                    setPrintStatus('Error cetak: ' + err.message);
                  } finally {
                    setIsPrinting(false);
                  }
                  return;
                }

                if (isNativeAndroidApp()) {
                  setIsPrinting(true);
                  setPrintStatus('Mencetak langsung via Native Bluetooth (Anti-Putus)...');
                  try {
                    const res = await bluetoothPrinter.printReceipt(transaction);
                    if (res.success) {
                      setPrintStatus('Struk berhasil dicetak langsung!');
                    } else {
                      // Fallback coba RawBT jika socket belum pairing
                      printViaRawBT(transaction);
                      setPrintStatus('Mengirim ke printer...');
                    }
                  } catch (err: any) {
                    setPrintStatus('Error cetak native: ' + err.message);
                  } finally {
                    setIsPrinting(false);
                  }
                  return;
                }

                const isAndroid = /android/i.test(navigator.userAgent);
                if (isAndroid) {
                  setPrintStatus('Mengirim struk ke RawBT Printer...');
                  printViaRawBT(transaction);
                } else {
                  window.print();
                }
              }}
              className="h-12 rounded-xl bg-[#1B2A5C] hover:bg-[#243775] text-white font-bold text-xs flex items-center justify-center gap-2 shadow transition-all active:scale-95"
              title="Cetak lewat RawBT (Android) atau Spooler Windows tanpa risiko terputus"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Cetak Struk (RawBT / Anti-Putus)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="h-12 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
            >
              <Printer className="w-4 h-4 text-gray-500" />
              <span>Cetak Web Bluetooth</span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleOpenDrawer}
              className="flex-1 py-2 text-xs font-semibold text-[#1B2A5C] bg-[#FAF8F4] hover:bg-gray-100 border border-[#1B2A5C]/30 rounded-lg flex items-center justify-center gap-1 transition-colors"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Buka Laci</span>
            </button>
            <button
              type="button"
              onClick={handleCopyText}
              className="flex-1 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center gap-1 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
