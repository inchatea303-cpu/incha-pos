import { Ingredient, PackagingCosts, RecipeItem } from '../types';

/**
 * Biaya per porsi bahan = harga beli ÷ porsi per satuan
 */
export function calculatePortionCost(buyPrice: number, portionsPerUnit: number): number {
  if (portionsPerUnit <= 0) return 0;
  return buyPrice / portionsPerUnit;
}

/**
 * HPP per cup = jumlah(takaran × biaya per porsi) + cup + (harga roll lid ÷ isi roll) + biaya lain per cup
 */
export function calculateHPP(
  recipe: RecipeItem[],
  ingredientsMap: Record<string, Ingredient>,
  packaging: PackagingCosts
): number {
  let ingredientsCost = 0;

  for (const item of recipe) {
    const ing = ingredientsMap[item.ingredientId];
    if (ing) {
      const portionCost = ing.costPerPortion > 0 
        ? ing.costPerPortion 
        : calculatePortionCost(ing.buyPrice, ing.portionsPerUnit);
      ingredientsCost += item.amount * portionCost;
    }
  }

  const lidPerCup = packaging.lidCupsPerRoll > 0 
    ? packaging.lidRollPrice / packaging.lidCupsPerRoll 
    : 0;

  const totalHpp = ingredientsCost + packaging.cupPrice + lidPerCup + packaging.otherCostsPerCup;
  return totalHpp;
}

/**
 * Margin = harga jual − HPP
 */
export function calculateMargin(sellPrice: number, hpp: number): number {
  return sellPrice - hpp;
}

/**
 * Margin % = margin ÷ harga jual
 */
export function calculateMarginPct(margin: number, sellPrice: number): number {
  if (sellPrice <= 0) return 0;
  return (margin / sellPrice) * 100;
}

/**
 * Margin online = harga jual × (1 − komisi%) − HPP
 */
export function calculateOnlineMargin(sellPrice: number, hpp: number, commissionPct: number = 20): number {
  const netRevenue = sellPrice * (1 - commissionPct / 100);
  return netRevenue - hpp;
}

/**
 * Harga minimum per cup = (HPP + biaya lain) ÷ (1 − komisi%)
 * Untuk penjualan langsung, komisi = 0.
 */
export function calculateMinPrice(hpp: number, additionalCost: number = 0, commissionPct: number = 0): number {
  const factor = 1 - commissionPct / 100;
  if (factor <= 0) return hpp;
  return (hpp + additionalCost) / factor;
}

/**
 * Titik impas (cup per hari) = biaya tetap bulanan ÷ (margin rata-rata tertimbang × hari operasional)
 */
export function calculateBEP(
  monthlyFixedCosts: number,
  weightedAvgMargin: number,
  operationalDays: number = 30
): number {
  const denominator = weightedAvgMargin * operationalDays;
  if (denominator <= 0) return 0;
  return monthlyFixedCosts / denominator;
}

/**
 * Laba bersih bulanan = total margin − biaya tetap − biaya variabel lain
 */
export function calculateNetProfit(
  totalMargin: number,
  fixedCosts: number,
  otherVariableCosts: number = 0
): number {
  return totalMargin - fixedCosts - otherVariableCosts;
}

/**
 * Balik modal = modal awal total ÷ laba bersih bulanan (tampilkan "belum balik modal" jika laba ≤ 0)
 */
export function calculatePaybackPeriod(
  initialCapitalTotal: number,
  monthlyNetProfit: number
): { months: number | null; text: string } {
  if (monthlyNetProfit <= 0) {
    return { months: null, text: 'Belum balik modal' };
  }
  const months = initialCapitalTotal / monthlyNetProfit;
  return {
    months,
    text: `${months.toFixed(1)} bulan`,
  };
}

/**
 * Stok teoritis = stok awal + restock − pemakaian resep − waste
 */
export function calculateTheoreticalStock(
  initialStock: number,
  restockQty: number,
  recipeUsage: number,
  waste: number
): number {
  return initialStock + restockQty - recipeUsage - waste;
}

/**
 * Selisih = stok fisik − stok teoritis
 */
export function calculateStockVariance(physicalStock: number, theoreticalStock: number): number {
  return physicalStock - theoreticalStock;
}

/**
 * Format standard Rupiah: Rp15.000
 * Pembulatan tampilan ke bilangan bulat, tanpa desimal.
 */
export function formatRupiah(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded);

  // Normalisasi spasi setelah Rp agar seragam "Rp15.000"
  return formatted.replace(/\s+/g, '');
}

/**
 * Format tanggal Indonesia (WIB)
 */
export function formatDateWIB(dateInput: string | Date | number): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' 
    ? new Date(dateInput) 
    : dateInput;

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];

  const d = date.getDate().toString().padStart(2, '0');
  const m = months[date.getMonth()];
  const y = date.getFullYear();
  const hr = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');

  return `${d} ${m} ${y}, ${hr}:${min} WIB`;
}

/**
 * Dapatkan string tanggal YYYY-MM-DD dalam zona waktu Indonesia Barat (WIB / Asia/Jakarta)
 */
export function getDateStrWIB(dateInput: string | Date | number = new Date()): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;
  if (isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
  } catch {
    // Fallback jika Intl timeZone tidak didukung
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Cek apakah dua waktu/tanggal berada di hari kalender yang sama dalam zona WIB
 */
export function isSameDayWIB(
  dateInputA: string | Date | number,
  dateInputB: string | Date | number = new Date()
): boolean {
  if (!dateInputA || !dateInputB) return false;
  const strA = getDateStrWIB(dateInputA);
  const strB = getDateStrWIB(dateInputB);
  if (!strA || !strB) return false;
  return strA === strB;
}
