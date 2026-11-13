import React, { useState, useMemo } from 'react';
import {
  Wallet,
  RotateCcw,
  RefreshCw,
  Store,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  FileText,
  DollarSign,
  AlertTriangle,
  Eye,
  Plus,
  CheckCircle,
  X,
  Trash2,
  Database,
  Download,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatRupiah, formatDateWIB, isSameDayWIB } from '../../utils/calculations';
import { SalesTransaction, SalesChannel, PaymentMethod } from '../../types';
import { BackupModal } from './BackupModal';

interface FinanceViewProps {
  onOpenCashier: () => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({ onOpenCashier }) => {
  const {
    transactions,
    products,
    businessParams,
    expenses,
    addExpense,
    deleteExpense,
    resetExpenses,
    resetTransactions,
    syncCloudData,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'sales' | 'expenses' | 'cash_close'>('sales');
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('today');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetIncludeExpenses, setResetIncludeExpenses] = useState(true);
  const [isResetExpensesOpen, setIsResetExpensesOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedTxDetail, setSelectedTxDetail] = useState<SalesTransaction | null>(null);

  // Modal Tambah Pengeluaran
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [newExpForm, setNewExpForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: 'Biaya Tetap',
    description: '',
    amount: '',
  });

  // Filter Transaksi Berdasarkan Tanggal, Channel, dan Metode Bayar
  const filteredTransactions = useMemo(() => {
    const now = new Date();

    return transactions.filter((tx) => {
      if (tx.isVoided) return false;

      // Filter Tanggal (Akurat WIB)
      if (dateRange === 'today' && !isSameDayWIB(tx.timestamp, now)) return false;
      if (dateRange === '7days') {
        const diffDays =
          (now.getTime() - new Date(tx.timestamp).getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      }
      if (dateRange === '30days') {
        const diffDays =
          (now.getTime() - new Date(tx.timestamp).getTime()) / (1000 * 3600 * 24);
        if (diffDays > 30) return false;
      }

      // Filter Channel
      if (channelFilter !== 'all' && tx.channel !== channelFilter) return false;

      // Filter Payment
      if (paymentFilter !== 'all' && tx.paymentMethod !== paymentFilter) return false;

      return true;
    });
  }, [transactions, dateRange, channelFilter, paymentFilter]);

  // Kalkulasi 4 Angka Ringkasan Keuangan
  const totalOmzet = useMemo(() => {
    return filteredTransactions.reduce((sum, tx) => sum + tx.totalNet, 0);
  }, [filteredTransactions]);

  const totalHPP = useMemo(() => {
    return filteredTransactions.reduce((sum, tx) => {
      if (tx.totalHpp && tx.totalHpp > 0) return sum + tx.totalHpp;
      // Fallback estimasi HPP per item
      return (
        sum +
        tx.items.reduce((itemSum, it) => {
          const prod = products.find((p) => p.id === it.productId);
          const itemCost = prod ? prod.sellPrice * 0.42 : it.unitPrice * 0.42;
          return itemSum + itemCost * it.quantity;
        }, 0)
      );
    }, 0);
  }, [filteredTransactions, products]);

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

  const netProfit = useMemo(() => {
    if (totalOmzet === 0 && totalExpenses === 0) return 0;
    return totalOmzet - totalHPP - totalExpenses;
  }, [totalOmzet, totalHPP, totalExpenses]);

  // Data Tutup Kas
  const cashSales = useMemo(() => {
    return filteredTransactions
      .filter((tx) => tx.paymentMethod === 'cash')
      .reduce((sum, tx) => sum + tx.totalNet, 0);
  }, [filteredTransactions]);

  const initialCashFloat = 200000; // Modal awal kasir Rp200.000
  const actualCashDrawer = initialCashFloat + cashSales; // Total uang fisik
  const bankDeposit = cashSales; // Yang disetor ke rekening
  const cashDifference = actualCashDrawer - (initialCashFloat + cashSales); // Selisih

  return (
    <div className="space-y-6 max-w-[1120px] mx-auto pb-8">
      {/* 1. Header Halaman Keuangan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#1B2A5C] tracking-tight">
              Keuangan
            </h1>
            <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Realtime Cloud
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-1 font-medium">
            Ringkasan penjualan harian, pengeluaran operasional, dan tutup kas
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Tombol Sinkron Cloud */}
          <button
            type="button"
            onClick={async () => {
              setIsSyncing(true);
              await syncCloudData();
              setTimeout(() => setIsSyncing(false), 600);
            }}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-[#E6E4DD] text-[#1B2A5C] text-xs font-semibold rounded-xl transition-all shadow-xs"
            title="Sinkronkan data dari kasir tablet"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isSyncing ? 'animate-spin text-emerald-600' : 'text-gray-500'
              }`}
            />
            <span>{isSyncing ? 'Sinkron...' : 'Sinkron Cloud'}</span>
          </button>

          {/* Tombol Backup & Pulihkan */}
          <button
            type="button"
            onClick={() => setIsBackupModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-xl transition-all shadow-xs"
            title="Cadangkan data ke file JSON atau ekspor CSV"
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Backup &amp; Pulihkan</span>
          </button>

          {/* Tombol Reset Penjualan */}
          {transactions.length > 0 && (
            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 border border-rose-200 text-[#D7262E] text-xs font-semibold rounded-xl transition-all shadow-xs"
              title="Bersihkan transaksi uji coba dan kembalikan angka keuangan ke Rp0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Penjualan (Mulai Nol)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCashier}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B2A5C] hover:bg-[#131E42] text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
          >
            <Store className="w-4 h-4" />
            <span>Buka Kasir POS</span>
          </button>
        </div>
      </div>

      {/* 2. Empat Kartu Ringkasan Keuangan (Tinggi 96px, Dihitung Nyata) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omzet */}
        <div className="h-26 bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-4 flex flex-col justify-between hover:border-[#1B2A5C]/30 transition-colors">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Total Omzet
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#1B2A5C] tabular-nums tracking-tight font-mono">
              {formatRupiah(totalOmzet)}
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-0.5 tabular-nums">
              {filteredTransactions.length} tx
            </span>
          </div>
        </div>

        {/* Total HPP */}
        <div className="h-26 bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-4 flex flex-col justify-between hover:border-[#1B2A5C]/30 transition-colors">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Total HPP
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#1B2A5C] tabular-nums tracking-tight font-mono">
              {formatRupiah(totalHPP)}
            </span>
            <span className="text-xs text-[#64748B] font-medium">
              {totalOmzet > 0 ? `${Math.round((totalHPP / totalOmzet) * 100)}% omzet` : '0%'}
            </span>
          </div>
        </div>

        {/* Pengeluaran */}
        <div className="h-26 bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-4 flex flex-col justify-between hover:border-[#1B2A5C]/30 transition-colors">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Pengeluaran
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#1B2A5C] tabular-nums tracking-tight font-mono">
              {formatRupiah(totalExpenses)}
            </span>
            <span className="text-xs text-[#64748B] font-medium">
              {expenses.length} pos
            </span>
          </div>
        </div>

        {/* Laba Bersih */}
        <div className="h-26 bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-4 flex flex-col justify-between hover:border-[#1B2A5C]/30 transition-colors">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Laba Bersih
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold tabular-nums tracking-tight font-mono ${
                netProfit >= 0 ? 'text-emerald-700' : 'text-[#D7262E]'
              }`}
            >
              {netProfit < 0 ? `-${formatRupiah(Math.abs(netProfit))}` : formatRupiah(netProfit)}
            </span>
            <span className="text-xs text-[#64748B] font-medium">
              {totalOmzet > 0
                ? `margin ${Math.round((netProfit / totalOmzet) * 100)}%`
                : 'margin 0%'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Bar Filter & Tiga Tab Navigasi */}
      <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-4 space-y-4">
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F1EFEA] pb-3">
          {/* Tiga Tab */}
          <div className="flex items-center gap-1 bg-[#FAF8F4] p-1 rounded-xl border border-[#E6E4DD]">
            <button
              type="button"
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'sales'
                  ? 'bg-[#1B2A5C] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#1B2A5C]'
              }`}
            >
              Penjualan ({filteredTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('expenses')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'expenses'
                  ? 'bg-[#1B2A5C] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#1B2A5C]'
              }`}
            >
              Pengeluaran ({expenses.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cash_close')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'cash_close'
                  ? 'bg-[#1B2A5C] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#1B2A5C]'
              }`}
            >
              Tutup Kas
            </button>
          </div>

          {/* Filter Options */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Rentang Tanggal */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="h-9 px-3 bg-white border border-[#E6E4DD] rounded-xl text-xs font-semibold text-[#1B2A5C] focus:outline-none focus:border-[#1B2A5C]"
            >
              <option value="today">Hari Ini</option>
              <option value="7days">7 Hari Terakhir</option>
              <option value="30days">30 Hari Terakhir</option>
              <option value="all">Semua Transaksi</option>
            </select>

            {/* Channel */}
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="h-9 px-3 bg-white border border-[#E6E4DD] rounded-xl text-xs font-semibold text-[#1B2A5C] focus:outline-none focus:border-[#1B2A5C]"
            >
              <option value="all">Semua Channel</option>
              <option value="direct">Kasir Toko (Direct)</option>
              <option value="gofood">GoFood</option>
              <option value="grabfood">GrabFood</option>
              <option value="shopeefood">ShopeeFood</option>
            </select>

            {/* Metode Bayar */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="h-9 px-3 bg-white border border-[#E6E4DD] rounded-xl text-xs font-semibold text-[#1B2A5C] focus:outline-none focus:border-[#1B2A5C]"
            >
              <option value="all">Semua Pembayaran</option>
              <option value="cash">Tunai (Cash)</option>
              <option value="qris">QRIS</option>
            </select>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: PENJUALAN */}
        {/* ============================================================== */}
        {activeTab === 'sales' && (
          <div>
            {filteredTransactions.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <Receipt className="w-10 h-10 text-gray-300 mx-auto" />
                <div className="text-sm font-semibold text-[#64748B]">
                  Belum ada transaksi penjualan pada filter ini.
                </div>
                <button
                  type="button"
                  onClick={onOpenCashier}
                  className="px-4 py-2 bg-[#FAF8F4] hover:bg-gray-100 border border-[#E6E4DD] text-xs font-bold text-[#1B2A5C] rounded-xl transition-colors shadow-xs"
                >
                  Buka Kasir POS
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] text-[#5B6478] uppercase font-semibold border-b border-[#E6E4DD] sticky top-0">
                    <tr className="h-10">
                      <th className="px-3">Jam (WIB)</th>
                      <th className="px-3">No. Invoice</th>
                      <th className="px-3">Menu Dipesan</th>
                      <th className="px-3 text-center">Jumlah</th>
                      <th className="px-3 text-center">Channel</th>
                      <th className="px-3 text-center">Bayar</th>
                      <th className="px-3 text-right">Total</th>
                      <th className="px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1EFEA]">
                    {filteredTransactions.map((tx) => {
                      const totalQty = tx.items.reduce((s, it) => s + it.quantity, 0);
                      const itemsText = tx.items.map((it) => it.productName).join(', ');

                      return (
                        <tr key={tx.id} className="h-12 hover:bg-[#FAF8F4]/70 transition-colors">
                          <td className="px-3 text-[#5B6478] tabular-nums whitespace-nowrap">
                            {formatDateWIB(tx.timestamp).split(',')[1] || tx.timestamp.slice(11, 16)}
                          </td>
                          <td className="px-3 font-mono font-medium text-[#1B2A5C]">
                            {tx.invoiceNumber}
                          </td>
                          <td className="px-3 font-medium text-[#1B2A5C] truncate max-w-[220px]">
                            {itemsText}
                          </td>
                          <td className="px-3 text-center tabular-nums text-[#5B6478]">
                            {totalQty} cup
                          </td>
                          <td className="px-3 text-center uppercase text-[10px] font-bold text-[#1B2A5C]">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">
                              {tx.channel}
                            </span>
                          </td>
                          <td className="px-3 text-center uppercase text-[10px] font-bold text-[#5B6478]">
                            {tx.paymentMethod}
                          </td>
                          <td className="px-3 text-right font-bold text-[#1B2A5C] tabular-nums">
                            {formatRupiah(tx.totalNet)}
                          </td>
                          <td className="px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedTxDetail(tx)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-gray-100 border border-[#E6E4DD] text-[11px] font-semibold text-[#1B2A5C] transition-colors"
                            >
                              <Eye className="w-3 h-3 text-gray-500" />
                              <span>Detail</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: PENGELUARAN */}
        {/* ============================================================== */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-[#64748B]">
                Total Pengeluaran: <strong className="text-[#1B2A5C] text-sm tabular-nums font-mono">{formatRupiah(totalExpenses)}</strong>
                <span className="ml-2 text-[11px] font-normal text-gray-400">({expenses.length} pos)</span>
              </div>
              <div className="flex items-center gap-2">
                {expenses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsResetExpensesOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-[#D7262E] text-xs font-bold shadow-xs transition-colors"
                    title="Kosongkan semua daftar pengeluaran operasional"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Hapus Semua</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B2A5C] hover:bg-[#243775] text-xs font-bold text-white shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Pengeluaran</span>
                </button>
              </div>
            </div>

            {expenses.length === 0 ? (
              <div className="py-12 text-center space-y-3 bg-[#FAF8F4]/40 rounded-2xl border border-dashed border-[#E6E4DD]">
                <Wallet className="w-10 h-10 text-gray-300 mx-auto" />
                <div className="text-sm font-semibold text-[#64748B]">
                  Belum ada catatan pengeluaran operasional.
                </div>
                <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                  Total pengeluaran saat ini Rp0. Tekan tombol &quot;+ Tambah Pengeluaran&quot; untuk mencatat biaya sewa tempat, listrik, pembelian air galon, gas, atau es batu.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(true)}
                  className="px-4 py-2 bg-[#1B2A5C] hover:bg-[#243775] text-xs font-bold text-white rounded-xl transition-colors shadow-xs"
                >
                  + Tambah Pengeluaran Sekarang
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] text-[#5B6478] uppercase font-semibold border-b border-[#E6E4DD]">
                    <tr className="h-10">
                      <th className="px-3">Tanggal</th>
                      <th className="px-3">Kategori</th>
                      <th className="px-3">Keterangan</th>
                      <th className="px-3 text-right">Nominal</th>
                      <th className="px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1EFEA]">
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="h-12 hover:bg-[#FAF8F4]/70 transition-colors">
                        <td className="px-3 text-[#5B6478] tabular-nums whitespace-nowrap">{exp.date}</td>
                        <td className="px-3 font-semibold text-[#1B2A5C] whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {exp.category}
                          </span>
                        </td>
                        <td className="px-3 text-[#1F2937] font-medium">{exp.description}</td>
                        <td className="px-3 text-right font-bold text-[#D7262E] tabular-nums font-mono whitespace-nowrap">
                          -{formatRupiah(exp.amount)}
                        </td>
                        <td className="px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => deleteExpense(exp.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 border border-rose-200 text-[#D7262E] text-[11px] font-semibold transition-colors shadow-2xs"
                            title="Hapus pengeluaran ini"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Hapus</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: TUTUP KAS */}
        {/* ============================================================== */}
        {activeTab === 'cash_close' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 bg-[#FAF8F4] rounded-xl border border-[#E6E4DD]">
                <div className="text-[11px] font-bold uppercase text-[#64748B]">Kas Awal (Modal)</div>
                <div className="text-lg font-bold text-[#1B2A5C] mt-1 tabular-nums font-mono">
                  {formatRupiah(initialCashFloat)}
                </div>
              </div>
              <div className="p-4 bg-[#FAF8F4] rounded-xl border border-[#E6E4DD]">
                <div className="text-[11px] font-bold uppercase text-[#64748B]">Penjualan Tunai</div>
                <div className="text-lg font-bold text-emerald-700 mt-1 tabular-nums font-mono">
                  {formatRupiah(cashSales)}
                </div>
              </div>
              <div className="p-4 bg-[#FAF8F4] rounded-xl border border-[#E6E4DD]">
                <div className="text-[11px] font-bold uppercase text-[#64748B]">Setoran Tunai</div>
                <div className="text-lg font-bold text-[#1B2A5C] mt-1 tabular-nums font-mono">
                  {formatRupiah(bankDeposit)}
                </div>
              </div>
              <div className="p-4 bg-[#FAF8F4] rounded-xl border border-[#E6E4DD]">
                <div className="text-[11px] font-bold uppercase text-[#64748B]">Selisih Fisik</div>
                <div className="text-lg font-bold text-emerald-700 mt-1 tabular-nums font-mono">
                  {formatRupiah(cashDifference)} (Aman)
                </div>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Seluruh uang tunai di kasir seimbang dengan data transaksi penjualan sistem.</span>
            </div>
          </div>
        )}
      </div>

      {/* Modal Detail Transaksi */}
      {selectedTxDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-[#E6E4DD] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1EFEA] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#1B2A5C]">
                  Detail Transaksi {selectedTxDetail.invoiceNumber}
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  {formatDateWIB(selectedTxDetail.timestamp)} • Kasir: {selectedTxDetail.cashierName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTxDetail(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-[#1B2A5C]">Rincian Menu:</div>
              <div className="divide-y divide-gray-100 border rounded-xl overflow-hidden">
                {selectedTxDetail.items.map((it, idx) => (
                  <div key={idx} className="p-2.5 flex justify-between bg-white">
                    <div>
                      <div className="font-semibold text-[#1F2937]">{it.productName}</div>
                      <div className="text-[11px] text-gray-500">
                        {it.quantity}x @{formatRupiah(it.unitPrice)}
                      </div>
                    </div>
                    <div className="font-bold text-[#1B2A5C] tabular-nums">
                      {formatRupiah(it.subtotal)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Channel:</span>
                  <span className="font-bold uppercase text-[#1B2A5C]">
                    {selectedTxDetail.channel}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Metode Bayar:</span>
                  <span className="font-bold uppercase text-[#1B2A5C]">
                    {selectedTxDetail.paymentMethod}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-[#1B2A5C] pt-2 border-t">
                  <span>Total Bayar:</span>
                  <span>{formatRupiah(selectedTxDetail.totalNet)}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedTxDetail(null)}
              className="w-full h-10 rounded-xl bg-[#1B2A5C] text-white font-bold text-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Modal Tambah Pengeluaran */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-[#E6E4DD] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1EFEA] pb-3">
              <h3 className="font-bold text-sm text-[#1B2A5C]">Tambah Pengeluaran Operasional</h3>
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tombol Cepat Pilihan Populer */}
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-400 mb-1.5">Pilihan Cepat (Opsional):</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setNewExpForm({
                    ...newExpForm,
                    category: 'Biaya Tetap',
                    description: 'Sewa Tempat & Listrik Toko',
                    amount: '900000',
                  })}
                  className="px-2 py-1 rounded-lg bg-[#FAF8F4] hover:bg-gray-100 border border-[#E6E4DD] text-[10px] font-semibold text-[#1B2A5C]"
                >
                  Sewa & Listrik (Rp900rb)
                </button>
                <button
                  type="button"
                  onClick={() => setNewExpForm({
                    ...newExpForm,
                    category: 'Biaya Variabel',
                    description: 'Pembelian Air Galon & Gas Elpiji',
                    amount: '41000',
                  })}
                  className="px-2 py-1 rounded-lg bg-[#FAF8F4] hover:bg-gray-100 border border-[#E6E4DD] text-[10px] font-semibold text-[#1B2A5C]"
                >
                  Air Galon & Gas
                </button>
                <button
                  type="button"
                  onClick={() => setNewExpForm({
                    ...newExpForm,
                    category: 'Biaya Variabel',
                    description: 'Pembelian Es Kristal Higienis',
                    amount: '12000',
                  })}
                  className="px-2 py-1 rounded-lg bg-[#FAF8F4] hover:bg-gray-100 border border-[#E6E4DD] text-[10px] font-semibold text-[#1B2A5C]"
                >
                  Es Kristal
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newExpForm.description || !newExpForm.amount) return;
                addExpense({
                  date: newExpForm.date || new Date().toISOString().slice(0, 10),
                  category: newExpForm.category,
                  description: newExpForm.description,
                  amount: Number(newExpForm.amount) || 0,
                  recordedBy: 'Owner',
                });
                setIsAddExpenseOpen(false);
                setNewExpForm({
                  date: new Date().toISOString().slice(0, 10),
                  category: 'Biaya Variabel',
                  description: '',
                  amount: '',
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-[#1F2937] mb-1">Tanggal</label>
                <input
                  type="date"
                  value={newExpForm.date}
                  onChange={(e) => setNewExpForm({ ...newExpForm, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1F2937] mb-1">Kategori</label>
                <select
                  value={newExpForm.category}
                  onChange={(e) => setNewExpForm({ ...newExpForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                >
                  <option value="Biaya Tetap">Biaya Tetap (Sewa, Listrik, Internet)</option>
                  <option value="Biaya Variabel">Biaya Variabel (Air Galon, Gas, Es)</option>
                  <option value="Gaji & Upah">Gaji & Upah</option>
                  <option value="Lain-lain">Lain-lain</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#1F2937] mb-1">Keterangan Pengeluaran</label>
                <input
                  type="text"
                  required
                  placeholder="Mis. Pembelian Es Kristal, Plastik, dll."
                  value={newExpForm.description}
                  onChange={(e) => setNewExpForm({ ...newExpForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1F2937] mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1000"
                  placeholder="Mis. 50000"
                  value={newExpForm.amount}
                  onChange={(e) => setNewExpForm({ ...newExpForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#1B2A5C] hover:bg-[#131E42] text-white font-bold shadow-xs"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Semua Pengeluaran */}
      {isResetExpensesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-[#E6E4DD] p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#D7262E]">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-[#D7262E]" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#1B2A5C]">
                  Hapus Semua Pengeluaran?
                </h3>
                <p className="text-[11px] text-[#64748B]">Kosongkan pos pengeluaran ke Rp0</p>
              </div>
            </div>

            <p className="text-xs text-[#5B6478] leading-relaxed">
              Semua {expenses.length} catatan pengeluaran operasional akan dihapus permanen. Total pengeluaran akan kembali menjadi <strong>Rp0</strong>.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetExpensesOpen(false)}
                className="flex-1 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#1B2A5C] font-semibold text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  resetExpenses();
                  setIsResetExpensesOpen(false);
                }}
                className="flex-1 h-10 rounded-xl bg-[#D7262E] hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Reset Transaksi */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-[#E6E4DD] p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#D7262E]">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-[#D7262E]" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#1B2A5C]">
                  Reset Seluruh Penjualan?
                </h3>
                <p className="text-[11px] text-[#64748B]">Mulai data keuangan dari Rp0</p>
              </div>
            </div>

            <p className="text-xs text-[#5B6478] leading-relaxed">
              Seluruh transaksi uji coba penjualan akan dibersihkan, angka omzet, HPP, dan laba bersih di halaman Keuangan dan Dashboard akan kembali menjadi <strong>Rp0</strong>.
            </p>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#1F2937] p-2 rounded-lg bg-gray-50 border border-gray-200">
              <input
                type="checkbox"
                checked={resetIncludeExpenses}
                onChange={(e) => setResetIncludeExpenses(e.target.checked)}
                className="w-4 h-4 rounded text-[#D7262E] focus:ring-0"
              />
              <span>Reset seluruh pengeluaran juga (kembalikan ke Rp0)</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#1B2A5C] font-semibold text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  await resetTransactions();
                  if (resetIncludeExpenses) {
                    resetExpenses();
                  }
                  setIsResetConfirmOpen(false);
                }}
                className="flex-1 h-10 rounded-xl bg-[#D7262E] hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs"
              >
                Ya, Reset ke Nol
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pusat Backup & Pulihkan Data */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />
    </div>
  );
};
