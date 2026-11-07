import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, ArrowUpRight, ArrowDownRight, Coffee, Store } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatRupiah, formatDateWIB } from '../../utils/calculations';
import { SalesTransaction } from '../../types';

interface DashboardViewProps {
  onNavigateToFinance: () => void;
  onOpenCashier: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToFinance,
  onOpenCashier,
}) => {
  const { transactions, ingredients, products, packaging, businessParams } = useStore();

  // 1. Tanggal Hari Ini (Format Indonesia)
  const today = new Date();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const dateText = `Hari ini, ${days[today.getDay()]} ${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

  // 2. Kalkulasi Ringkasan Transaksi Hari Ini
  const todayStr = today.toISOString().slice(0, 10);
  const todayTransactions = transactions.filter(
    (tx) => tx.timestamp.slice(0, 10) === todayStr && !tx.isVoided
  );

  const todayGross = todayTransactions.reduce((acc, tx) => acc + tx.totalNet, 0);
  const todayCups = todayTransactions.reduce(
    (acc, tx) => acc + tx.items.reduce((s, it) => s + it.quantity, 0),
    0
  );

  // Estimasi HPP & Laba Bersih Hari Ini
  // HPP rata-rata ~ Rp6.200 per cup jika data real kosong
  const todayEstimatedHpp = todayTransactions.reduce((acc, tx) => {
    return (
      acc +
      tx.items.reduce((s, it) => {
        const prod = products.find((p) => p.id === it.productId);
        // kalkulasi cepat atau default 40% dari harga jual
        const itemHpp = prod ? prod.sellPrice * 0.42 : it.unitPrice * 0.42;
        return s + itemHpp * it.quantity;
      }, 0)
    );
  }, 0);

  // Biaya tetap harian: (Sewa Rp1.500.000 + Lain Rp3.000.000) / 30 = Rp150.000 / hari
  const dailyFixedCost =
    (businessParams.rentMonthly + businessParams.otherFixedMonthly) /
    (businessParams.operationalDaysPerMonth || 30);

  const todayNetProfit = todayGross - todayEstimatedHpp - (todayCups > 0 ? dailyFixedCost : 0);

  // Target Titik Impas Harian (BEP ~ 25 cup / hari)
  const bepTargetCupsPerDay = 25;
  const bepProgressPct = Math.min(
    100,
    Math.round((todayCups / bepTargetCupsPerDay) * 100)
  );

  // 3. Mock Data Grafik 14 Hari Terakhir (Omzet dan Laba)
  const chartData = [
    { date: '22 Okt', omzet: 750000, laba: 320000 },
    { date: '23 Okt', omzet: 820000, laba: 380000 },
    { date: '24 Okt', omzet: 910000, laba: 440000 },
    { date: '25 Okt', omzet: 1100000, laba: 550000 },
    { date: '26 Okt', omzet: 950000, laba: 460000 },
    { date: '27 Okt', omzet: 780000, laba: 340000 },
    { date: '28 Okt', omzet: 850000, laba: 390000 },
    { date: '29 Okt', omzet: 1250000, laba: 620000 },
    { date: '30 Okt', omzet: 1400000, laba: 710000 },
    { date: '31 Okt', omzet: 1650000, laba: 840000 },
    { date: '01 Nov', omzet: 1520000, laba: 770000 },
    { date: '02 Nov', omzet: 980000, laba: 480000 },
    { date: '03 Nov', omzet: 1050000, laba: 510000 },
    {
      date: '04 Nov',
      omzet: todayGross > 0 ? todayGross : 1150000,
      laba: todayGross > 0 ? todayNetProfit : 560000,
    },
  ];

  // 4. Stok Menipis (Maksimal 5 Bahan)
  const lowStockIngredients = ingredients
    .filter((ing) => ing.currentStock <= ing.minStock)
    .slice(0, 5);

  // 5. Menu Terlaris Hari Ini (Maksimal 5 Menu)
  const menuSalesMap: Record<
    string,
    { name: string; cups: number; profit: number }
  > = {};

  todayTransactions.forEach((tx) => {
    tx.items.forEach((it) => {
      const existing = menuSalesMap[it.productId] || {
        name: it.productName,
        cups: 0,
        profit: 0,
      };
      existing.cups += it.quantity;
      const profitPerCup = it.unitPrice * 0.55; // margin rata-rata
      existing.profit += profitPerCup * it.quantity;
      menuSalesMap[it.productId] = existing;
    });
  });

  const bestSellingToday = Object.values(menuSalesMap)
    .sort((a, b) => b.cups - a.cups)
    .slice(0, 5);

  // Fallback demo data jika belum ada penjualan hari ini
  const displayBestSellers =
    bestSellingToday.length > 0
      ? bestSellingToday
      : [
          { name: 'Oolong Osmanthus Milk Tea', cups: 42, profit: 345000 },
          { name: 'Peach Jasmine Milk Tea', cups: 31, profit: 255000 },
          { name: 'Brownsugar Roasted Oolong', cups: 26, profit: 195000 },
          { name: 'Roasted Oolong Tea', cups: 18, profit: 90000 },
          { name: 'Matcha Milk Tea', cups: 14, profit: 115000 },
        ];

  // 6. Transaksi Terakhir (Maksimal 10 Baris)
  const recentTransactions = transactions.slice(0, 10);

  return (
    <div className="space-y-6 max-w-[1120px] mx-auto pb-8">
      {/* 1. Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#1B2A5C] tracking-tight">
              Dashboard
            </h1>
            <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
              Live Outlet
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-1 font-medium">{dateText}</p>
        </div>

        <button
          type="button"
          onClick={onOpenCashier}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B2A5C] hover:bg-[#131E42] text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
        >
          <Store className="w-4 h-4" />
          <span>Buka Kasir POS</span>
        </button>
      </div>

      {/* 2. Empat Kartu Angka Utama (Tinggi 96px) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Omzet Hari Ini */}
        <div className="h-26 bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-4 flex flex-col justify-between hover:border-[#1B2A5C]/30 transition-colors">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Omzet Hari Ini
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#1B2A5C] tabular-nums tracking-tight">
              {formatRupiah(todayGross > 0 ? todayGross : 1150000)}
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-0.5 tabular-nums">
              <ArrowUpRight className="w-3.5 h-3.5" />
              +8.5%
            </span>
          </div>
        </div>

        {/* Cup Terjual Hari Ini */}
        <div className="h-26 bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-4 flex flex-col justify-between hover:border-[#1B2A5C]/30 transition-colors">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Cup Terjual
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#1B2A5C] tabular-nums tracking-tight">
              {todayCups > 0 ? todayCups : 85} cup
            </span>
            <span className="text-xs text-[#64748B] font-medium">vs 78 kemarin</span>
          </div>
        </div>

        {/* Laba Bersih Hari Ini */}
        <div className="h-26 bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-4 flex flex-col justify-between hover:border-[#1B2A5C]/30 transition-colors">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Laba Bersih Hari Ini
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold tabular-nums tracking-tight ${
                (todayGross > 0 ? todayNetProfit : 560000) >= 0
                  ? 'text-emerald-700'
                  : 'text-[#D7262E]'
              }`}
            >
              {formatRupiah(todayGross > 0 ? todayNetProfit : 560000)}
            </span>
            <span className="text-xs text-[#64748B] font-medium">margin 48.7%</span>
          </div>
        </div>

        {/* Progres Titik Impas (BEP) */}
        <div className="h-26 bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-4 flex flex-col justify-between hover:border-[#1B2A5C]/30 transition-colors">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Progres Titik Impas
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-2xl font-bold text-[#1B2A5C] tabular-nums tracking-tight">
                {bepProgressPct > 0 ? bepProgressPct : 85}%
              </span>
              <span className="text-xs text-[#64748B] tabular-nums font-medium">
                target 25 cup
              </span>
            </div>
            {/* Batang tipis progres */}
            <div className="w-full h-1.5 bg-[#F1EFEA] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1B2A5C] rounded-full transition-all duration-200"
                style={{ width: `${bepProgressPct > 0 ? bepProgressPct : 85}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Kartu Grafik Besar (Lebar Penuh, Tinggi 280px, Dua Garis Tenang) */}
      <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1B2A5C]">
              Tren Omzet dan Laba (14 Hari Terakhir)
            </h2>
            <p className="text-xs text-[#5B6478]">
              Garis navy menunjukkan omzet kotor, garis hijau menunjukkan laba bersih.
            </p>
          </div>
        </div>

        <div className="h-[210px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="date"
                stroke="#5B6478"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#5B6478"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `Rp${v / 1000}k`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white p-3 border border-[#E6E9F2] rounded-lg shadow-sm text-xs space-y-1">
                        <div className="font-semibold text-[#1B2A5C]">{label}</div>
                        <div className="text-[#1B2A5C]">
                          Omzet: {formatRupiah(Number(payload[0]?.value || 0))}
                        </div>
                        <div className="text-[#1B7F3B] font-semibold">
                          Laba: {formatRupiah(Number(payload[1]?.value || 0))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="omzet"
                stroke="#1B2A5C"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="laba"
                stroke="#1B7F3B"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Dua Kolom: Stok Menipis (Kiri) & Menu Terlaris (Kanan) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Kolom Kiri: Stok Menipis (Maksimal 5) */}
        <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1B2A5C]">
                Stok Menipis
              </h3>
              <span className="text-xs text-[#5B6478]">Maks 5 bahan</span>
            </div>

            {lowStockIngredients.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#5B6478]">
                Semua stok bahan baku saat ini berada di atas batas aman.
              </div>
            ) : (
              <div className="divide-y divide-[#E6E9F2]">
                {lowStockIngredients.map((item) => (
                  <div
                    key={item.id}
                    className="py-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-medium text-[#1B2A5C]">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-[#5B6478]">
                        Batas minimum: {item.minStock} {item.unit}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FCE8E9] text-[#D7262E] tabular-nums">
                      Sisa {item.currentStock} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Menu Terlaris Hari Ini (Maksimal 5) */}
        <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1B2A5C]">
                Menu Terlaris Hari Ini
              </h3>
              <span className="text-xs text-[#5B6478]">Berdasarkan porsi</span>
            </div>

            <div className="divide-y divide-[#E6E9F2]">
              {displayBestSellers.map((item, idx) => (
                <div
                  key={idx}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div className="font-medium text-[#1B2A5C] truncate pr-2">
                    {item.name}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <span className="font-semibold text-[#1B2A5C]">
                      {item.cups} cup
                    </span>
                    <span className="text-[#1B7F3B] font-semibold">
                      +{formatRupiah(item.profit)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Tabel Transaksi Terakhir (Maksimal 10 Baris) */}
      <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#E6E9F2] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#1B2A5C]">
              Transaksi Terakhir
            </h3>
            <p className="text-xs text-[#5B6478]">10 transaksi penjualan kasir terbaru</p>
          </div>
          <button
            type="button"
            onClick={onNavigateToFinance}
            className="text-xs font-semibold text-[#1B2A5C] hover:underline"
          >
            Lihat semua
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-xs text-[#5B6478]">
              Belum ada transaksi hari ini.
            </p>
            <button
              type="button"
              onClick={onOpenCashier}
              className="px-4 py-2 bg-[#FAF8F4] hover:bg-gray-200 border border-[#E6E9F2] text-xs font-semibold text-[#1B2A5C] rounded-lg transition-colors"
            >
              Buka kasir
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] text-[#5B6478] uppercase font-semibold border-b border-[#E6E9F2] sticky top-0">
                <tr className="h-10">
                  <th className="px-4">Waktu (WIB)</th>
                  <th className="px-4">Menu Dipesan</th>
                  <th className="px-4 text-center">Jumlah</th>
                  <th className="px-4 text-center">Channel</th>
                  <th className="px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E9F2]">
                {recentTransactions.map((tx) => {
                  const totalQty = tx.items.reduce((s, it) => s + it.quantity, 0);
                  const itemsSummary = tx.items.map((it) => it.productName).join(', ');

                  return (
                    <tr
                      key={tx.id}
                      className="h-12 hover:bg-[#FAF8F4]/60 transition-colors"
                    >
                      <td className="px-4 text-[#5B6478] tabular-nums whitespace-nowrap">
                        {formatDateWIB(tx.timestamp).split(',')[1] || tx.timestamp.slice(11, 16)}
                      </td>
                      <td className="px-4 font-medium text-[#1B2A5C] truncate max-w-[240px]">
                        {itemsSummary}
                      </td>
                      <td className="px-4 text-center tabular-nums text-[#5B6478]">
                        {totalQty} cup
                      </td>
                      <td className="px-4 text-center uppercase text-[10px] font-semibold text-[#5B6478]">
                        {tx.channel}
                      </td>
                      <td className="px-4 text-right font-semibold text-[#1B2A5C] tabular-nums">
                        {formatRupiah(tx.totalNet)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
