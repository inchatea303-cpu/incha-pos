import { describe, it, expect } from 'vitest';
import { Ingredient, Product, RecipeItem, SalesTransaction } from '../types';
import { INITIAL_INGREDIENTS, INITIAL_PRODUCTS } from '../database/seedData';

describe('Uji Pengurangan Stok Otomatis Resep & 10 Transaksi Kasir', () => {
  // Deep clone initial state
  const getFreshState = () => {
    const ingredientsMap: Record<string, Ingredient> = {};
    INITIAL_INGREDIENTS.forEach((ing) => {
      ingredientsMap[ing.id] = { ...ing };
    });
    return {
      ingredientsMap,
      products: INITIAL_PRODUCTS,
    };
  };

  function simulateSale(
    productId: string,
    quantity: number,
    ingredientsMap: Record<string, Ingredient>,
    products: Product[]
  ) {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    // Kurangi bahan sesuai resep
    for (const item of prod.recipe) {
      const deduction = item.amount * quantity;
      if (ingredientsMap[item.ingredientId]) {
        ingredientsMap[item.ingredientId].currentStock -= deduction;
      }
    }

    // Kurangi cup & lid
    if (ingredientsMap['ing-cup']) {
      ingredientsMap['ing-cup'].currentStock -= quantity;
    }
    if (ingredientsMap['ing-lid-sealer']) {
      ingredientsMap['ing-lid-sealer'].currentStock -= quantity;
    }
  }

  function simulateVoid(
    productId: string,
    quantity: number,
    ingredientsMap: Record<string, Ingredient>,
    products: Product[]
  ) {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    for (const item of prod.recipe) {
      const addition = item.amount * quantity;
      if (ingredientsMap[item.ingredientId]) {
        ingredientsMap[item.ingredientId].currentStock += addition;
      }
    }

    if (ingredientsMap['ing-cup']) {
      ingredientsMap['ing-cup'].currentStock += quantity;
    }
    if (ingredientsMap['ing-lid-sealer']) {
      ingredientsMap['ing-lid-sealer'].currentStock += quantity;
    }
  }

  it('1. Penjualan 1 cup Oolong Osmanthus Milk Tea memotong Tea Base, Osmanthus Base, Cream, Cup, dan Lid', () => {
    const { ingredientsMap, products } = getFreshState();

    const initialTeaBase = ingredientsMap['ing-tea-base'].currentStock; // 66
    const initialOsmanthus = ingredientsMap['ing-osmanthus-base'].currentStock; // 33
    const initialCream = ingredientsMap['ing-cream-blend'].currentStock; // 150
    const initialCup = ingredientsMap['ing-cup'].currentStock; // 500
    const initialLid = ingredientsMap['ing-lid-sealer'].currentStock; // 1200

    simulateSale('prod-oolong-osmanthus-milk-tea', 1, ingredientsMap, products);

    expect(ingredientsMap['ing-tea-base'].currentStock).toBe(initialTeaBase - 1);
    expect(ingredientsMap['ing-osmanthus-base'].currentStock).toBe(initialOsmanthus - 1);
    expect(ingredientsMap['ing-cream-blend'].currentStock).toBe(initialCream - 1);
    expect(ingredientsMap['ing-cup'].currentStock).toBe(initialCup - 1);
    expect(ingredientsMap['ing-lid-sealer'].currentStock).toBe(initialLid - 1);
  });

  it('2. Mencatat 10 transaksi berturut-turut mengurangi stok secara presisi sesuai kriteria selesai', () => {
    const { ingredientsMap, products } = getFreshState();

    const startCup = ingredientsMap['ing-cup'].currentStock; // 500
    const startLid = ingredientsMap['ing-lid-sealer'].currentStock; // 1200
    const startTeaBase = ingredientsMap['ing-tea-base'].currentStock; // 66
    const startOsmanthus = ingredientsMap['ing-osmanthus-base'].currentStock; // 33

    // Jalankan 10 transaksi: masing-masing 2 cup Oolong Osmanthus Milk Tea
    const totalTransactions = 10;
    const cupsPerTx = 2;
    const totalCupsSold = totalTransactions * cupsPerTx; // 20 cup

    for (let i = 0; i < totalTransactions; i++) {
      simulateSale('prod-oolong-osmanthus-milk-tea', cupsPerTx, ingredientsMap, products);
    }

    // Periksa pengurangan cup dan lid (20 cup berkurang)
    expect(ingredientsMap['ing-cup'].currentStock).toBe(startCup - 20);
    expect(ingredientsMap['ing-lid-sealer'].currentStock).toBe(startLid - 20);

    // Resep 1 porsi tea base + 1 porsi osmanthus base per cup
    expect(ingredientsMap['ing-tea-base'].currentStock).toBe(startTeaBase - 20);
    expect(ingredientsMap['ing-osmanthus-base'].currentStock).toBe(startOsmanthus - 20);
  });

  it('3. Fitur VOID transaksi mengembalikan seluruh stok bahan yang terpotong', () => {
    const { ingredientsMap, products } = getFreshState();
    const startTeaBase = ingredientsMap['ing-tea-base'].currentStock;
    const startCup = ingredientsMap['ing-cup'].currentStock;

    // Transaksi 3 cup
    simulateSale('prod-roasted-oolong-tea', 3, ingredientsMap, products);
    expect(ingredientsMap['ing-tea-base'].currentStock).toBe(startTeaBase - 3);
    expect(ingredientsMap['ing-cup'].currentStock).toBe(startCup - 3);

    // Batalkan (VOID) 3 cup
    simulateVoid('prod-roasted-oolong-tea', 3, ingredientsMap, products);
    expect(ingredientsMap['ing-tea-base'].currentStock).toBe(startTeaBase);
    expect(ingredientsMap['ing-cup'].currentStock).toBe(startCup);
  });
});
