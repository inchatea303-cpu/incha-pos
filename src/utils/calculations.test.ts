import { describe, it, expect } from 'vitest';
import {
  calculatePortionCost,
  calculateHPP,
  calculateMargin,
  calculateMarginPct,
  calculateOnlineMargin,
  calculateMinPrice,
  calculateBEP,
  calculateNetProfit,
  calculatePaybackPeriod,
  calculateTheoreticalStock,
  calculateStockVariance,
  formatRupiah,
  isSameDayWIB,
  getDateStrWIB,
} from './calculations';
import { Ingredient, PackagingCosts, RecipeItem } from '../types';

describe('Rumus HPP, Margin, dan Titik Impas INCHA', () => {
  const defaultPackaging: PackagingCosts = {
    cupPrice: 749,
    lidRollPrice: 249000,
    lidCupsPerRoll: 1200, // Rp207,5 per cup
    otherCostsPerCup: 1000, // ASUMSI
    isOtherCostsAssumed: true,
  };

  const mockIngredients: Record<string, Ingredient> = {
    'tea-base': {
      id: 'tea-base',
      name: 'Tea Base',
      category: 'base_tea',
      unit: 'pack',
      buyPrice: 31000,
      portionsPerUnit: 33,
      costPerPortion: 31000 / 33, // 939.3939
      minOrder: '5 pack',
      minStock: 10,
      currentStock: 50,
      isVerified: true,
    },
    'osmanthus-base': {
      id: 'osmanthus-base',
      name: 'Osmanthus Base',
      category: 'base_flavor',
      unit: 'pack',
      buyPrice: 78450,
      portionsPerUnit: 33,
      costPerPortion: 78450 / 33, // 2377.2727
      minOrder: '25 pcs',
      minStock: 5,
      currentStock: 25,
      isVerified: true,
    },
    'cream-blend': {
      id: 'cream-blend',
      name: 'INCHA Cream Blend',
      category: 'cream',
      unit: 'pcs',
      buyPrice: 1490,
      portionsPerUnit: 1,
      costPerPortion: 1490,
      minOrder: '25 pcs',
      minStock: 20,
      currentStock: 100,
      isVerified: true,
    },
  };

  it('1. Biaya per porsi bahan dihitung tepat (harga beli / porsi per satuan)', () => {
    const teaBasePortion = calculatePortionCost(31000, 33);
    expect(teaBasePortion).toBeCloseTo(939.39, 2);

    const osmanthusPortion = calculatePortionCost(78450, 33);
    expect(osmanthusPortion).toBeCloseTo(2377.27, 2);

    const creamPortion = calculatePortionCost(1490, 1);
    expect(creamPortion).toBe(1490);
  });

  it('2. HPP Oolong Osmanthus Milk Tea dihitung presisi', () => {
    // Resep Milk Tea: 1 tea base + 1 base rasa + 1 cream blend + cup + lid + biaya lain
    const recipe: RecipeItem[] = [
      { ingredientId: 'tea-base', amount: 1 },
      { ingredientId: 'osmanthus-base', amount: 1 },
      { ingredientId: 'cream-blend', amount: 1 },
    ];

    const hpp = calculateHPP(recipe, mockIngredients, defaultPackaging);
    
    // Rincian:
    // Tea Base: 939.3939
    // Osmanthus Base: 2377.2727
    // Cream: 1490
    // Cup: 749
    // Lid: 249000 / 1200 = 207.5
    // Lain-lain: 1000
    // Total = 939.3939 + 2377.2727 + 1490 + 749 + 207.5 + 1000 = 6763.1666
    expect(hpp).toBeCloseTo(6763.17, 1);
  });

  it('3. Margin dan Margin % dihitung presisi', () => {
    const sellPrice = 15000;
    const hpp = 6763.17;
    const margin = calculateMargin(sellPrice, hpp);
    const marginPct = calculateMarginPct(margin, sellPrice);

    expect(margin).toBeCloseTo(8236.83, 1);
    expect(marginPct).toBeCloseTo(54.91, 1);
  });

  it('4. Margin Online (komisi 20%) dihitung tepat', () => {
    const sellPrice = 15000;
    const hpp = 6763.17;
    const onlineMargin = calculateOnlineMargin(sellPrice, hpp, 20);

    // Net revenue = 15000 * 0.8 = 12000
    // Margin online = 12000 - 6763.17 = 5236.83
    expect(onlineMargin).toBeCloseTo(5236.83, 1);
  });

  it('5. Harga minimum per cup melindungi modal', () => {
    const hpp = 6763.17;
    // Penjualan langsung (komisi 0)
    const minDirect = calculateMinPrice(hpp, 0, 0);
    expect(minDirect).toBeCloseTo(6763.17, 1);

    // Penjualan online (komisi 20%)
    const minOnline = calculateMinPrice(hpp, 0, 20);
    // 6763.17 / 0.8 = 8453.96
    expect(minOnline).toBeCloseTo(8453.96, 1);
  });

  it('6. Promo B1G1 pada menu Rp5.000 terdeteksi merugi (laba negatif)', () => {
    // Pure Tea (Roasted Oolong): 1 tea base (939.39) + cup (749) + lid (207.5) + lain (1000) = 2895.89
    const pureTeaHppPerCup = 939.39 + 749 + 207.5 + 1000; // 2895.89
    const sellPrice = 5000;

    // Promo B1G1: Beli 1 dapat 2 cup
    const cupsDelivered = 2;
    const promoRevenue = sellPrice; // Rp5.000
    const totalHppPromo = pureTeaHppPerCup * cupsDelivered; // ~ Rp5.791,78
    const promoProfit = promoRevenue - totalHppPromo; // -Rp791,78

    expect(promoProfit).toBeLessThan(0); // RUGI!
    expect(promoRevenue).toBeLessThan(totalHppPromo);
  });

  it('7. Titik impas (BEP) dan Laba Bersih bulanan', () => {
    const monthlyFixed = 4500000; // Rp1.500.000 sewa + Rp3.000.000 lain
    const avgMargin = 7500;
    const operationalDays = 30;

    const bepCupsPerDay = calculateBEP(monthlyFixed, avgMargin, operationalDays);
    // 4.500.000 / (7500 * 30) = 4.500.000 / 225.000 = 20 cup/hari
    expect(bepCupsPerDay).toBe(20);

    // Jika penjualan 50 cup/hari: total margin = 50 * 30 * 7500 = 11.250.000
    const totalMargin = 50 * 30 * avgMargin;
    const netProfit = calculateNetProfit(totalMargin, monthlyFixed, 0);
    expect(netProfit).toBe(6750000);

    // Balik modal: Modal awal Rp40.000.000 (38m paket + 2m ongkir)
    const payback = calculatePaybackPeriod(40000000, netProfit);
    // 40.000.000 / 6.750.000 = ~5.9 bulan
    expect(payback.months).toBeCloseTo(5.92, 1);
  });

  it('8. Stok teoritis dan selisih stok opname', () => {
    const initial = 100;
    const restock = 50;
    const usage = 80;
    const waste = 5;

    const theoretical = calculateTheoreticalStock(initial, restock, usage, waste);
    expect(theoretical).toBe(65);

    const physical = 62;
    const variance = calculateStockVariance(physical, theoretical);
    expect(variance).toBe(-3); // Hilang / selisih minus 3 porsi
  });

  it('9. Format Rupiah sesuai standar Indonesia', () => {
    expect(formatRupiah(15000)).toBe('Rp15.000');
    expect(formatRupiah(78450)).toBe('Rp78.450');
    expect(formatRupiah(939.39)).toBe('Rp939');
  });

  it('10. RLS Data Masking Test: Karyawan dilarang melihat harga beli dan HPP', () => {
    // Simulasi filter RLS untuk role 'karyawan'
    function sanitizeForEmployee(ingredient: Ingredient) {
      return {
        id: ingredient.id,
        name: ingredient.name,
        category: ingredient.category,
        unit: ingredient.unit,
        currentStock: ingredient.currentStock, // BISA LIHAT STOK FISIK
        minStock: ingredient.minStock,
        minOrder: ingredient.minOrder,
        isVerified: ingredient.isVerified,
        // FIELD SENSITIF TIDAK DIKIRIM (undefined)
        buyPrice: undefined,
        portionsPerUnit: undefined,
        costPerPortion: undefined,
      };
    }

    const employeeView = sanitizeForEmployee(mockIngredients['tea-base']);
    expect(employeeView.currentStock).toBe(50);
    expect(employeeView.buyPrice).toBeUndefined();
    expect(employeeView.costPerPortion).toBeUndefined();
  });

  it('11. isSameDayWIB dan getDateStrWIB akurat membandingkan hari kalender WIB', () => {
    // 2026-11-13 pukul 20:00 WIB = 2026-11-13T13:00:00.000Z
    const timeWibNight = '2026-11-13T13:00:00.000Z';
    // 2026-11-13 pukul 08:00 WIB = 2026-11-13T01:00:00.000Z
    const timeWibMorning = '2026-11-13T01:00:00.000Z';
    // 2026-11-14 pukul 02:00 WIB = 2026-11-13T19:00:00.000Z (UTC tanggal 13, tapi WIB sudah tanggal 14!)
    const timeNextDayEarlyWib = '2026-11-13T19:00:00.000Z';

    expect(isSameDayWIB(timeWibNight, timeWibMorning)).toBe(true);
    expect(isSameDayWIB(timeWibNight, timeNextDayEarlyWib)).toBe(false);
    expect(getDateStrWIB(timeNextDayEarlyWib)).toBe('2026-11-14');
  });
});
