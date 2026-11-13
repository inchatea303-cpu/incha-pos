import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  FileSpreadsheet,
  Database,
  PlusCircle,
  X,
  CheckCircle,
  AlertCircle,
  Calendar,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  downloadJsonBackup,
  downloadSalesCsv,
  parseBackupFile,
} from '../../utils/backupService';
import { formatRupiah } from '../../utils/calculations';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const {
    transactions,
    expenses,
    restoreTransactionsBackup,
    recordManualSale,
    syncCloudData,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'manual'>('backup');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State Form Input Manual
  const [manualForm, setManualForm] = useState({
    menuName: 'Penjualan Artisan Milk Tea',
    cups: 1,
    totalAmount: '',
    paymentMethod: 'qris' as 'cash' | 'qris',
    date: new Date().toISOString().slice(0, 10),
  });

  if (!isOpen) return null;

  const validTxs = transactions.filter((t) => !t.isVoided);
  const totalOmzet = validTxs.reduce((sum, t) => sum + t.totalNet, 0);
  const totalCups = validTxs.reduce(
    (sum, t) => sum + t.items.reduce((s, it) => s + it.quantity, 0),
    0
  );

  const handleDownloadJson = () => {
    try {
      downloadJsonBackup(transactions, expenses);
      setFeedback({
        type: 'success',
        message: 'File cadangan (.json) berhasil diunduh ke perangkat Anda.',
      });
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: `Gagal mengunduh backup: ${e?.message || 'Terjadi kesalahan'}`,
      });
    }
  };

  const handleDownloadCsv = () => {
    try {
      downloadSalesCsv(transactions);
      setFeedback({
        type: 'success',
        message: 'Laporan penjualan spreadsheet (.csv) siap dibuka di Excel.',
      });
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: `Gagal mengunduh CSV: ${e?.message || 'Terjadi kesalahan'}`,
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFeedback(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = parseBackupFile(text);

        if (!res.success) {
          setFeedback({ type: 'error', message: res.message });
          setIsProcessing(false);
          return;
        }

        const addedCount = await restoreTransactionsBackup(res.transactions);
        setFeedback({
          type: 'success',
          message: `Berhasil memulihkan ${addedCount} data transaksi baru ke dalam database omzet toko.`,
        });
      } catch (err: any) {
        setFeedback({
          type: 'error',
          message: `Gagal memproses file: ${err?.message || 'Format tidak didukung'}`,
        });
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setFeedback({ type: 'error', message: 'Gagal membaca berkas dari media perangkat.' });
      setIsProcessing(false);
    };

    reader.readAsText(file);
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(manualForm.totalAmount.replace(/\D/g, ''), 10);
    if (!amountNum || amountNum <= 0) {
      setFeedback({ type: 'error', message: 'Nominal total omzet wajib diisi dan lebih dari Rp0.' });
      return;
    }

    setIsProcessing(true);
    try {
      await recordManualSale({
        menuName: manualForm.menuName || 'Penjualan Minuman INCHA',
        cups: Math.max(1, Number(manualForm.cups) || 1),
        totalAmount: amountNum,
        paymentMethod: manualForm.paymentMethod,
        date: manualForm.date,
      });

      setFeedback({
        type: 'success',
        message: `Penjualan ${formatRupiah(amountNum)} (${manualForm.cups} cup) berhasil ditambahkan ke dashboard omzet!`,
      });

      setManualForm({
        menuName: 'Penjualan Artisan Milk Tea',
        cups: 1,
        totalAmount: '',
        paymentMethod: 'qris',
        date: new Date().toISOString().slice(0, 10),
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Gagal mencatat transaksi: ${err?.message || 'Kesalahan sistem'}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#E6E4DD] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-5 border-b border-[#E6E9F2] flex items-center justify-between bg-[#1B2A5C] text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                Pusat Cadangan &amp; Pemulihan Omzet
              </h2>
              <p className="text-[11px] text-gray-300">
                INCHA Karang Tengah • Amankan &amp; Pulihkan Data Penjualan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Tab Navigasi */}
        <div className="flex border-b border-[#E6E9F2] bg-[#FAF8F4] px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('backup');
              setFeedback(null);
            }}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'backup'
                ? 'border-[#1B2A5C] text-[#1B2A5C]'
                : 'border-transparent text-[#64748B] hover:text-[#1B2A5C]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Cadangkan Data</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('restore');
              setFeedback(null);
            }}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'restore'
                ? 'border-[#1B2A5C] text-[#1B2A5C]'
                : 'border-transparent text-[#64748B] hover:text-[#1B2A5C]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Pulihkan File</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('manual');
              setFeedback(null);
            }}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'manual'
                ? 'border-[#1B2A5C] text-[#1B2A5C]'
                : 'border-transparent text-[#64748B] hover:text-[#1B2A5C]'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Input Koreksi Penjualan</span>
          </button>
        </div>

        {/* Isi Modal */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Status Feedback */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 leading-relaxed ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-[#D7262E]'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#D7262E]" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* TAB 1: CADANGKAN DATA */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-[#FAF8F4] rounded-xl border border-[#E6E4DD] space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Ringkasan Database Saat Ini
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#1B2A5C]">Total Omzet Tersimpan:</span>
                  <span className="font-bold text-base text-[#1B2A5C] tabular-nums">
                    {formatRupiah(totalOmzet)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#64748B]">
                  <span>Total Transaksi Valid:</span>
                  <span className="font-medium tabular-nums">{validTxs.length} order ({totalCups} cup)</span>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                {/* Tombol Unduh JSON */}
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="w-full p-3.5 rounded-xl border border-[#E6E4DD] hover:border-[#1B2A5C] hover:bg-gray-50 flex items-center justify-between transition-all group shadow-xs"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-[#1B2A5C]">
                        Unduh File Backup Lengkap (.JSON)
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        Menyimpan seluruh riwayat penjualan untuk dipulihkan jika ganti HP/tablet.
                      </div>
                    </div>
                  </div>
                </button>

                {/* Tombol Unduh CSV / Excel */}
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="w-full p-3.5 rounded-xl border border-[#E6E4DD] hover:border-[#1B2A5C] hover:bg-gray-50 flex items-center justify-between transition-all group shadow-xs"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-[#1B2A5C]">
                        Ekspor Laporan Spreadsheet (.CSV / Excel)
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        Tabel rincian omzet per invoice, menu, waktu &amp; metode bayar.
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              <p className="text-[11px] text-[#64748B] leading-relaxed">
                Tip: Simpan file backup ini ke Google Drive atau kirim ke WhatsApp Anda secara berkala agar riwayat omzet selalu aman.
              </p>
            </div>
          )}

          {/* TAB 2: PULIHKAN DATA */}
          {activeTab === 'restore' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Pemulihan Aman (Tidak Menimpa Data Yang Ada)</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Data transaksi di dalam file cadangan akan digabungkan (merge) dengan data di perangkat ini. Transaksi yang sudah ada tidak akan hilang atau terduplikasi.
                </p>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-[#D1D5DB] hover:border-[#1B2A5C] rounded-2xl bg-[#FAF8F4] flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-gray-50"
              >
                <div className="w-12 h-12 rounded-full bg-[#1B2A5C]/10 text-[#1B2A5C] flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="font-bold text-sm text-[#1B2A5C]">
                  {isProcessing ? 'Sedang Membaca Berkas...' : 'Pilih File Backup (.JSON)'}
                </div>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Klik di sini untuk memilih file backup dari penyimpanan HP / Laptop
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: INPUT KOREKSI PENJUALAN */}
          {activeTab === 'manual' && (
            <form onSubmit={handleSubmitManual} className="space-y-3.5">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-relaxed">
                Gunakan form ini jika ada penjualan minuman hari ini yang belum sempat terinput di kasir tablet/APK agar nominal omzet di dashboard langsung terhitung benar.
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">
                  Nama Menu / Ringkasan Pesanan
                </label>
                <input
                  type="text"
                  required
                  value={manualForm.menuName}
                  onChange={(e) => setManualForm({ ...manualForm, menuName: e.target.value })}
                  placeholder="Contoh: Roasted Oolong Milk Tea (3 cup)"
                  className="w-full h-10 px-3 bg-white border border-[#E2DFD7] rounded-xl text-xs font-semibold text-[#1B2A5C] focus:outline-none focus:border-[#1B2A5C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">
                    Jumlah Cup
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={manualForm.cups}
                    onChange={(e) => setManualForm({ ...manualForm, cups: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    className="w-full h-10 px-3 bg-white border border-[#E2DFD7] rounded-xl text-xs font-semibold text-[#1B2A5C] focus:outline-none focus:border-[#1B2A5C]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">
                    Total Omzet (Rp)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 45000"
                    value={manualForm.totalAmount}
                    onChange={(e) => {
                      const num = e.target.value.replace(/\D/g, '');
                      setManualForm({ ...manualForm, totalAmount: num ? parseInt(num, 10).toLocaleString('id-ID') : '' });
                    }}
                    className="w-full h-10 px-3 bg-white border border-[#E2DFD7] rounded-xl text-xs font-bold text-[#1B2A5C] focus:outline-none focus:border-[#1B2A5C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={manualForm.paymentMethod}
                    onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value as any })}
                    className="w-full h-10 px-3 bg-white border border-[#E2DFD7] rounded-xl text-xs font-semibold text-[#1B2A5C] focus:outline-none focus:border-[#1B2A5C]"
                  >
                    <option value="qris">QRIS (GoPay / ShopeePay / BCA)</option>
                    <option value="cash">Tunai (Cash)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-1">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    value={manualForm.date}
                    onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                    className="w-full h-10 px-3 bg-white border border-[#E2DFD7] rounded-xl text-xs font-semibold text-[#1B2A5C] focus:outline-none focus:border-[#1B2A5C]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full h-11 bg-[#1B2A5C] hover:bg-[#131E42] active:bg-[#0D1530] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <span>{isProcessing ? 'Menyimpan...' : 'Simpan ke Dashboard Omzet'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer Modal */}
        <div className="p-3.5 bg-gray-50 border-t border-[#E6E9F2] flex items-center justify-between text-xs text-[#64748B]">
          <span className="text-[11px]">Database INCHA Pos Karang Tengah</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold text-[#1B2A5C] transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
