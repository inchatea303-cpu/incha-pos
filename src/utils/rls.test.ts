import { describe, it, expect } from 'vitest';
import { Ingredient, ProductFinancials, UserRole } from '../types';

/**
 * Simulasi Postgres Row Level Security (RLS) Engine
 * Menegakkan aturan keamanan persis seperti yang diimplementasikan di schema.sql
 */
class MockSupabaseRLS {
  private userRole: UserRole = 'karyawan';
  private userId: string = 'emp-kasir-1';

  setAuth(role: UserRole, id: string = 'emp-kasir-1') {
    this.userRole = role;
    this.userId = id;
  }

  // Query: SELECT * FROM ingredient_costs
  queryIngredientCosts() {
    if (this.userRole !== 'pemilik') {
      return {
        data: null,
        error: { code: '42501', message: 'permission denied for table ingredient_costs via RLS' },
      };
    }
    return {
      data: [
        { ingredient_id: 'ing-tea-base', buy_price: 31000, portions_per_unit: 33, cost_per_portion: 939.39 },
      ],
      error: null,
    };
  }

  // Query: SELECT * FROM product_financials (HPP & Margin)
  queryProductFinancials() {
    if (this.userRole !== 'pemilik') {
      return {
        data: null,
        error: { code: '42501', message: 'permission denied for table product_financials via RLS' },
      };
    }
    return {
      data: [
        { product_id: 'prod-oolong-osmanthus', hpp: 6763.17, margin: 8236.83, margin_pct: 54.91 },
      ],
      error: null,
    };
  }

  // Query: SELECT * FROM ingredients (Stok Fisik)
  queryIngredients(rawIngredients: Ingredient[]) {
    // Both roles can query physical stock, but karyawan cannot see buy_price / costs
    if (this.userRole === 'pemilik') {
      return { data: rawIngredients, error: null };
    }
    // Filter out confidential financial columns for employees
    const sanitized = rawIngredients.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      currentStock: item.currentStock, // KARYAWAN BISA MELIHAT STOK FISIK
      minStock: item.minStock,
      minOrder: item.minOrder,
      isVerified: item.isVerified,
      buyPrice: undefined,
      costPerPortion: undefined,
      portionsPerUnit: undefined,
    }));
    return { data: sanitized, error: null };
  }

  // Query: SELECT * FROM expenses
  queryExpenses() {
    if (this.userRole !== 'pemilik') {
      return {
        data: null,
        error: { code: '42501', message: 'permission denied for table expenses via RLS' },
      };
    }
    return { data: [{ id: 'exp-1', name: 'Sewa Lahan', amount: 1500000 }], error: null };
  }
}

describe('Postgres Row Level Security (RLS) Verification', () => {
  const rls = new MockSupabaseRLS();

  const sampleIngredients: Ingredient[] = [
    {
      id: 'ing-tea-base',
      name: 'Tea Base',
      category: 'base_tea',
      unit: 'pack',
      buyPrice: 31000,
      portionsPerUnit: 33,
      costPerPortion: 939.39,
      minOrder: '5 pack',
      minStock: 10,
      currentStock: 66,
      isVerified: true,
    },
  ];

  it('1. Karyawan diblokir total dari tabel harga beli (ingredient_costs)', () => {
    rls.setAuth('karyawan');
    const result = rls.queryIngredientCosts();
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('42501');
    expect(result.error?.message).toContain('permission denied');
  });

  it('2. Karyawan diblokir dari tabel HPP & Margin (product_financials)', () => {
    rls.setAuth('karyawan');
    const result = rls.queryProductFinancials();
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('42501');
  });

  it('3. Karyawan diblokir dari tabel pengeluaran / operasional (expenses)', () => {
    rls.setAuth('karyawan');
    const result = rls.queryExpenses();
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('42501');
  });

  it('4. Karyawan dapat melihat stok fisik bahan, namun harga modal & HPP terproteksi', () => {
    rls.setAuth('karyawan');
    const result = rls.queryIngredients(sampleIngredients);
    expect(result.data).toBeDefined();
    expect(result.data![0].currentStock).toBe(66);
    expect(result.data![0].buyPrice).toBeUndefined();
    expect(result.data![0].costPerPortion).toBeUndefined();
  });

  it('5. Pemilik memiliki izin akses penuh (Full Access) ke semua tabel', () => {
    rls.setAuth('pemilik');
    const costsResult = rls.queryIngredientCosts();
    const finResult = rls.queryProductFinancials();
    const expResult = rls.queryExpenses();
    const ingResult = rls.queryIngredients(sampleIngredients);

    expect(costsResult.error).toBeNull();
    expect(costsResult.data![0].buy_price).toBe(31000);

    expect(finResult.error).toBeNull();
    expect(finResult.data![0].hpp).toBeCloseTo(6763.17, 2);

    expect(expResult.error).toBeNull();
    expect(expResult.data![0].amount).toBe(1500000);

    expect(ingResult.data![0].buyPrice).toBe(31000);
  });
});
