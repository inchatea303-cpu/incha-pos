import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserRole,
  OwnerAccount,
  Employee,
  Ingredient,
  IngredientPriceHistory,
  Product,
  PackagingCosts,
  BusinessParameters,
  AuditLog,
  ProductFinancials,
  RecipeItem,
  SalesTransaction,
  SalesItem,
  SyncStatus,
} from '../types';
import {
  INITIAL_OWNER_ACCOUNTS,
  INITIAL_EMPLOYEES,
  INITIAL_PACKAGING,
  INITIAL_BUSINESS_PARAMS,
  INITIAL_INGREDIENTS,
  INITIAL_PRODUCTS,
  INITIAL_AUDIT_LOGS,
} from '../database/seedData';
import { authService, SESSION_INACTIVITY_LIMIT_MS } from '../utils/authService';
import {
  calculatePortionCost,
  calculateHPP,
  calculateMargin,
  calculateMarginPct,
  calculateOnlineMargin,
  calculateMinPrice,
  formatRupiah,
} from '../utils/calculations';
import {
  saveTransactionToIndexedDB,
  getAllOfflineTransactions,
  getPendingOfflineTransactions,
  updateTransactionSyncStatus,
  syncOfflineQueue,
} from '../utils/offlineQueue';

interface StoreContextType {
  role: UserRole;
  currentEmployee: Employee | null;
  employees: Employee[];
  ingredients: Ingredient[];
  products: Product[];
  packaging: PackagingCosts;
  businessParams: BusinessParameters;
  priceHistory: IngredientPriceHistory[];
  auditLogs: AuditLog[];
  transactions: SalesTransaction[];
  activeAlert: string | null;
  isOnline: boolean;
  pendingOfflineCount: number;
  clearAlert: () => void;
  // Auth & Roles
  authenticatedOwner: OwnerAccount | null;
  sessionExpiredMessage: string | null;
  ownerLogin: (owner: OwnerAccount) => void;
  ownerLogout: () => void;
  loginWithPin: (pin: string) => { success: boolean; message: string; role?: UserRole };
  logout: () => void;
  switchRole: (newRole: UserRole, pin?: string) => boolean;
  toggleEmployeeStatus: (employeeId: string, isActive: boolean) => void;
  // Ingredient Management
  updateIngredientPrice: (
    ingredientId: string,
    newBuyPrice: number,
    newPortionsPerUnit?: number,
    updatedBy?: string
  ) => { changePct: number; isOver5Pct: boolean };
  updateIngredientDetails: (
    ingredientId: string,
    data: Partial<Ingredient>,
    updatedBy?: string
  ) => void;
  // Product & Recipe Management
  updateProductRecipe: (
    productId: string,
    recipe: RecipeItem[],
    updatedBy?: string
  ) => void;
  updateProductPrice: (
    productId: string,
    newSellPrice: number,
    maxDiscountPct: number,
    updatedBy?: string
  ) => void;
  // Packaging & Business Config
  updatePackaging: (newPackaging: Partial<PackagingCosts>) => void;
  updateBusinessParams: (newParams: Partial<BusinessParameters>) => void;
  // Real-time calculations
  getProductFinancials: (productId: string) => ProductFinancials | null;
  getAllProductsFinancials: () => ProductFinancials[];
  // Transactions & POS Flow
  recordSale: (
    saleData: Omit<SalesTransaction, 'id' | 'invoiceNumber' | 'timestamp' | 'syncStatus' | 'isVoided'>
  ) => Promise<SalesTransaction>;
  voidTransaction: (transactionId: string, reason: string) => void;
  syncPendingTransactions: () => Promise<number>;
  // Reset & Audit
  addAuditLog: (action: string, details: string, actor?: string) => void;
  resetAllData: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ROLE: 'incha_user_role',
  CURRENT_EMP: 'incha_current_emp',
  OWNER_AUTH: 'incha_authenticated_owner',
  EMPLOYEES: 'incha_employees',
  INGREDIENTS: 'incha_ingredients',
  PRODUCTS: 'incha_products',
  PACKAGING: 'incha_packaging',
  PARAMS: 'incha_business_params',
  PRICE_HISTORY: 'incha_price_history',
  AUDIT_LOGS: 'incha_audit_logs',
  TRANSACTIONS: 'incha_sales_transactions',
};

// Helper aman membaca localStorage tanpa resiko SyntaxError jika data corrupt
function safeLoadFromStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved || saved === 'undefined' || saved === 'null') return fallback;
    return JSON.parse(saved) as T;
  } catch (err) {
    console.warn(`[Storage] Gagal memuat data ${key}, beralih ke fallback.`, err);
    return fallback;
  }
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load state from localStorage or seed
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  const [authenticatedOwner, setAuthenticatedOwner] = useState<OwnerAccount | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.OWNER_AUTH);
      if (!saved || saved === 'undefined' || saved === 'null') return null;
      const parsed: OwnerAccount = JSON.parse(saved);
      if (!parsed || !parsed.email) return null;
      const session = authService.checkSession(parsed.lastActiveAt);
      if (!session.isValid) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const [role, setRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ROLE);
    return (saved as UserRole) || 'karyawan';
  });

  const [employees, setEmployees] = useState<Employee[]>(() =>
    safeLoadFromStorage(STORAGE_KEYS.EMPLOYEES, INITIAL_EMPLOYEES)
  );

  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(() =>
    safeLoadFromStorage<Employee | null>(STORAGE_KEYS.CURRENT_EMP, null)
  );

  const [ingredients, setIngredients] = useState<Ingredient[]>(() =>
    safeLoadFromStorage(STORAGE_KEYS.INGREDIENTS, INITIAL_INGREDIENTS)
  );

  const [products, setProducts] = useState<Product[]>(() =>
    safeLoadFromStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS)
  );

  const [packaging, setPackaging] = useState<PackagingCosts>(() =>
    safeLoadFromStorage(STORAGE_KEYS.PACKAGING, INITIAL_PACKAGING)
  );

  const [businessParams, setBusinessParams] = useState<BusinessParameters>(() =>
    safeLoadFromStorage(STORAGE_KEYS.PARAMS, INITIAL_BUSINESS_PARAMS)
  );

  const [priceHistory, setPriceHistory] = useState<IngredientPriceHistory[]>(() =>
    safeLoadFromStorage(STORAGE_KEYS.PRICE_HISTORY, [])
  );

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() =>
    safeLoadFromStorage(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS)
  );

  const [transactions, setTransactions] = useState<SalesTransaction[]>(() =>
    safeLoadFromStorage(STORAGE_KEYS.TRANSACTIONS, [])
  );

  const [activeAlert, setActiveAlert] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);

  // Monitor Online/Offline Status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingTransactions();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check pending offline queue
    getPendingOfflineTransactions().then((items) => {
      setPendingOfflineCount(items.length);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ROLE, role);
    localStorage.setItem(STORAGE_KEYS.CURRENT_EMP, JSON.stringify(currentEmployee));
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
    localStorage.setItem(STORAGE_KEYS.INGREDIENTS, JSON.stringify(ingredients));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    localStorage.setItem(STORAGE_KEYS.PACKAGING, JSON.stringify(packaging));
    localStorage.setItem(STORAGE_KEYS.PARAMS, JSON.stringify(businessParams));
    localStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(priceHistory));
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }, [
    role,
    currentEmployee,
    employees,
    ingredients,
    products,
    packaging,
    businessParams,
    priceHistory,
    auditLogs,
    transactions,
  ]);

  const clearAlert = () => setActiveAlert(null);

  const ownerLogin = (owner: OwnerAccount) => {
    const updated = { ...owner, lastActiveAt: new Date().toISOString() };
    setAuthenticatedOwner(updated);
    setSessionExpiredMessage(null);
    localStorage.setItem(STORAGE_KEYS.OWNER_AUTH, JSON.stringify(updated));
    setRole('pemilik');
    addAuditLog('LOGIN_PEMILIK', `Pemilik ${owner.name} (${owner.email}) masuk ke sistem.`, owner.name);
  };

  const ownerLogout = () => {
    if (authenticatedOwner) {
      addAuditLog('LOGOUT_PEMILIK', `Pemilik ${authenticatedOwner.name} keluar dari sistem.`, authenticatedOwner.name);
    }
    setAuthenticatedOwner(null);
    localStorage.removeItem(STORAGE_KEYS.OWNER_AUTH);
  };

  const addAuditLog = (
    action: string,
    details: string,
    actor?: string,
    page?: string,
    changesBefore?: string,
    changesAfter?: string
  ) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      actor: actor || authenticatedOwner?.name || (role === 'pemilik' ? 'Pemilik' : 'Karyawan'),
      page: page || 'Sistem',
      action,
      details,
      changesBefore,
      changesAfter,
      ipAddress: '127.0.0.1 (Lokal)',
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const loginWithPin = (pin: string) => {
    const emp = employees.find((e) => e.pin === pin);
    if (!emp) {
      return { success: false, message: 'PIN salah. Silakan coba lagi.' };
    }
    if (!emp.isActive) {
      return { success: false, message: 'Akun dinonaktifkan oleh Pemilik. Hubungi pemilik untuk akses.' };
    }
    setCurrentEmployee(emp);
    localStorage.setItem(STORAGE_KEYS.CURRENT_EMP, JSON.stringify(emp));
    setRole(emp.role);
    addAuditLog('LOGIN_KASIR', `Kasir ${emp.name} berhasil masuk dengan PIN.`, emp.name);
    return { success: true, message: `Selamat datang, ${emp.name}`, role: emp.role };
  };

  const logout = () => {
    if (currentEmployee) {
      addAuditLog('LOGOUT_KASIR', `Kasir ${currentEmployee.name} keluar.`, currentEmployee.name);
    }
    setCurrentEmployee(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_EMP);
    setRole('karyawan');
  };

  const switchRole = (newRole: UserRole, pin?: string): boolean => {
    if (newRole === 'pemilik') {
      if (authenticatedOwner) {
        setRole('pemilik');
        addAuditLog('SWITCH_ROLE', `Beralih ke Portal Pemilik oleh ${authenticatedOwner.name}`);
        return true;
      }
      return false;
    } else {
      const activeKasir = employees.find((e) => e.role === 'karyawan' && e.isActive);
      if (activeKasir) setCurrentEmployee(activeKasir);
      setRole('karyawan');
      return true;
    }
  };

  const toggleEmployeeStatus = (employeeId: string, isActive: boolean) => {
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === employeeId ? { ...emp, isActive } : emp))
    );
    const target = employees.find((e) => e.id === employeeId);
    addAuditLog(
      isActive ? 'AKTIFKAN_KARYAWAN' : 'NONAKTIFKAN_KARYAWAN',
      `Status akun karyawan ${target?.name} diubah menjadi ${isActive ? 'Aktif' : 'Nonaktif'}.`
    );
  };

  // Helper map for fast calculation
  const ingredientsMap = React.useMemo(() => {
    const map: Record<string, Ingredient> = {};
    for (const ing of ingredients) {
      map[ing.id] = ing;
    }
    return map;
  }, [ingredients]);

  // Update Harga Bahan with >5% Alert & Reactive HPP recalculation
  const updateIngredientPrice = (
    ingredientId: string,
    newBuyPrice: number,
    newPortionsPerUnit?: number,
    updatedBy?: string
  ) => {
    const target = ingredients.find((i) => i.id === ingredientId);
    if (!target) return { changePct: 0, isOver5Pct: false };

    const oldPrice = target.buyPrice;
    const portions = newPortionsPerUnit ?? target.portionsPerUnit;
    const newPortionCost = calculatePortionCost(newBuyPrice, portions);
    const changePct = oldPrice > 0 ? ((newBuyPrice - oldPrice) / oldPrice) * 100 : 0;
    const isOver5Pct = changePct > 5.0;

    const actor = updatedBy || currentEmployee?.name || 'Pemilik';

    const historyEntry: IngredientPriceHistory = {
      id: `ph-${Date.now()}`,
      ingredientId,
      ingredientName: target.name,
      oldPrice,
      newPrice: newBuyPrice,
      changePct: parseFloat(changePct.toFixed(2)),
      changedAt: new Date().toISOString(),
      changedBy: actor,
      isAlertOver5Pct: isOver5Pct,
    };

    setPriceHistory((prev) => [historyEntry, ...prev]);

    setIngredients((prev) =>
      prev.map((ing) =>
        ing.id === ingredientId
          ? {
              ...ing,
              buyPrice: newBuyPrice,
              portionsPerUnit: portions,
              costPerPortion: newPortionCost,
            }
          : ing
      )
    );

    const alertMsg = isOver5Pct
      ? `PERINGATAN: Harga ${target.name} naik sebesar ${changePct.toFixed(1)}% (dari Rp${oldPrice.toLocaleString('id-ID')} ke Rp${newBuyPrice.toLocaleString('id-ID')}). HPP menu otomatis diperbarui!`
      : `Harga ${target.name} diperbarui ke Rp${newBuyPrice.toLocaleString('id-ID')} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%).`;

    if (isOver5Pct) {
      setActiveAlert(alertMsg);
    }

    addAuditLog('UBAH_HARGA_BAHAN', alertMsg, actor);

    return { changePct, isOver5Pct };
  };

  const updateIngredientDetails = (
    ingredientId: string,
    data: Partial<Ingredient>,
    updatedBy?: string
  ) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === ingredientId ? { ...ing, ...data } : ing))
    );
    const ing = ingredients.find((i) => i.id === ingredientId);
    addAuditLog(
      'UPDATE_BAHAN',
      `Data bahan ${ing?.name} diperbarui: ${Object.keys(data).join(', ')}`,
      updatedBy
    );
  };

  const updateProductRecipe = (
    productId: string,
    recipe: RecipeItem[],
    updatedBy?: string
  ) => {
    setProducts((prev) =>
      prev.map((prod) => (prod.id === productId ? { ...prod, recipe } : prod))
    );
    const prod = products.find((p) => p.id === productId);
    addAuditLog(
      'UPDATE_RESEP',
      `Resep menu ${prod?.name} diperbarui (${recipe.length} bahan).`,
      updatedBy
    );
  };

  const updateProductPrice = (
    productId: string,
    newSellPrice: number,
    maxDiscountPct: number,
    updatedBy?: string
  ) => {
    const prod = products.find((p) => p.id === productId);
    const oldPrice = prod?.sellPrice || 0;
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, sellPrice: newSellPrice, maxDiscountPct }
          : p
      )
    );
    addAuditLog(
      'UBAH_HARGA_MENU',
      `Harga menu ${prod?.name} diubah dari Rp${oldPrice.toLocaleString('id-ID')} ke Rp${newSellPrice.toLocaleString('id-ID')}, batas diskon kasir: ${maxDiscountPct}%.`,
      updatedBy
    );
  };

  const updatePackaging = (newPackaging: Partial<PackagingCosts>) => {
    setPackaging((prev) => ({ ...prev, ...newPackaging }));
    addAuditLog(
      'UPDATE_BIAYA_PACKAGING',
      `Konfigurasi packaging/biaya cup diperbarui: ${Object.keys(newPackaging).join(', ')}`
    );
  };

  const updateBusinessParams = (newParams: Partial<BusinessParameters>) => {
    setBusinessParams((prev) => ({ ...prev, ...newParams }));
    addAuditLog(
      'UPDATE_PARAMETER_BISNIS',
      `Parameter bisnis & biaya tetap diperbarui: ${Object.keys(newParams).join(', ')}`
    );
  };

  const getProductFinancials = (productId: string): ProductFinancials | null => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return null;

    const hpp = calculateHPP(prod.recipe, ingredientsMap, packaging);
    const margin = calculateMargin(prod.sellPrice, hpp);
    const marginPct = calculateMarginPct(margin, prod.sellPrice);
    const minPriceDirect = calculateMinPrice(hpp, 0, 0);
    const minPriceOnline = calculateMinPrice(hpp, 0, businessParams.ojolCommissionPct);
    const onlineMargin = calculateOnlineMargin(prod.sellPrice, hpp, businessParams.ojolCommissionPct);

    return {
      productId: prod.id,
      productName: prod.name,
      sellPrice: prod.sellPrice,
      hpp,
      margin,
      marginPct,
      minPriceDirect,
      minPriceOnline,
      onlineMargin,
    };
  };

  const getAllProductsFinancials = (): ProductFinancials[] => {
    return products.map((prod) => {
      const hpp = calculateHPP(prod.recipe, ingredientsMap, packaging);
      const margin = calculateMargin(prod.sellPrice, hpp);
      const marginPct = calculateMarginPct(margin, prod.sellPrice);
      const minPriceDirect = calculateMinPrice(hpp, 0, 0);
      const minPriceOnline = calculateMinPrice(hpp, 0, businessParams.ojolCommissionPct);
      const onlineMargin = calculateOnlineMargin(prod.sellPrice, hpp, businessParams.ojolCommissionPct);

      return {
        productId: prod.id,
        productName: prod.name,
        sellPrice: prod.sellPrice,
        hpp,
        margin,
        marginPct,
        minPriceDirect,
        minPriceOnline,
        onlineMargin,
      };
    });
  };

  // =========================================================================
  // FASE 2: TRANSAKSI POS, PENGURANGAN STOK OTOMATIS & OFFLINE QUEUE
  // =========================================================================

  const recordSale = async (
    saleData: Omit<SalesTransaction, 'id' | 'invoiceNumber' | 'timestamp' | 'syncStatus' | 'isVoided'>
  ): Promise<SalesTransaction> => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = (transactions.length + 1).toString().padStart(4, '0');
    const invoiceNumber = `INV-${dateStr}-${seq}`;
    const id = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const syncStatus: SyncStatus = isOnline ? 'terkirim' : 'lokal';

    const newTx: SalesTransaction = {
      ...saleData,
      id,
      invoiceNumber,
      timestamp: now.toISOString(),
      syncStatus,
      isVoided: false,
    };

    // 1. PENGURANGAN STOK BAHAN OTOMATIS SESUAI RESEP
    const stockDeductionMap: Record<string, number> = {};
    let totalCupsSold = 0;

    for (const item of saleData.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        totalCupsSold += item.quantity;
        for (const recipeItem of prod.recipe) {
          const qtyNeeded = recipeItem.amount * item.quantity;
          stockDeductionMap[recipeItem.ingredientId] =
            (stockDeductionMap[recipeItem.ingredientId] || 0) + qtyNeeded;
        }
      }
    }

    // Tambahkan cup & lid sealer otomatis
    stockDeductionMap['ing-cup'] = (stockDeductionMap['ing-cup'] || 0) + totalCupsSold;
    stockDeductionMap['ing-lid-sealer'] = (stockDeductionMap['ing-lid-sealer'] || 0) + totalCupsSold;

    // Update stok bahan baku
    setIngredients((prev) =>
      prev.map((ing) => {
        const deduction = stockDeductionMap[ing.id] || 0;
        if (deduction > 0) {
          return {
            ...ing,
            currentStock: Math.max(0, parseFloat((ing.currentStock - deduction).toFixed(2))),
          };
        }
        return ing;
      })
    );

    // 2. Simpan Transaksi ke State & LocalStorage
    setTransactions((prev) => [newTx, ...prev]);

    // 3. Simpan ke IndexedDB (Antrean Offline)
    try {
      await saveTransactionToIndexedDB(newTx);
      const pending = await getPendingOfflineTransactions();
      setPendingOfflineCount(pending.length);
    } catch (e) {
      console.warn('Gagal menyimpan ke IndexedDB:', e);
    }

    // 4. Catat Audit Log
    addAuditLog(
      'TRANSAKSI_KASIR',
      `Penjualan ${invoiceNumber} (${saleData.channel.toUpperCase()} - ${formatRupiah(saleData.totalNet)}) dicatat oleh ${saleData.cashierName}. Stok ${totalCupsSold} cup bahan berkurang otomatis. Status: ${syncStatus.toUpperCase()}.`
    );

    return newTx;
  };

  // Void Transaksi (Membatalkan Transaksi & Mengembalikan Stok Bahan Baku)
  const voidTransaction = (transactionId: string, reason: string) => {
    const target = transactions.find((t) => t.id === transactionId);
    if (!target || target.isVoided) return;

    // Kembalikan stok bahan baku
    const returnStockMap: Record<string, number> = {};
    let totalCupsReturned = 0;

    for (const item of target.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        totalCupsReturned += item.quantity;
        for (const recipeItem of prod.recipe) {
          const qty = recipeItem.amount * item.quantity;
          returnStockMap[recipeItem.ingredientId] =
            (returnStockMap[recipeItem.ingredientId] || 0) + qty;
        }
      }
    }

    returnStockMap['ing-cup'] = (returnStockMap['ing-cup'] || 0) + totalCupsReturned;
    returnStockMap['ing-lid-sealer'] = (returnStockMap['ing-lid-sealer'] || 0) + totalCupsReturned;

    setIngredients((prev) =>
      prev.map((ing) => {
        const toReturn = returnStockMap[ing.id] || 0;
        if (toReturn > 0) {
          return {
            ...ing,
            currentStock: parseFloat((ing.currentStock + toReturn).toFixed(2)),
          };
        }
        return ing;
      })
    );

    const now = new Date().toISOString();
    const actor = currentEmployee?.name || 'Kasir';

    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === transactionId
          ? {
              ...tx,
              isVoided: true,
              voidReason: reason,
              voidedAt: now,
              voidedBy: actor,
            }
          : tx
      )
    );

    addAuditLog(
      'VOID_TRANSAKSI',
      `Transaksi ${target.invoiceNumber} dibatalkan (VOID) oleh ${actor}. Alasan: "${reason}". Stok ${totalCupsReturned} cup bahan dikembalikan.`
    );
  };

  // Sinkronisasi antrean transaksi offline saat sinyal kembali
  const syncPendingTransactions = async (): Promise<number> => {
    try {
      const result = await syncOfflineQueue(async (tx) => {
        // Simulasi pengiriman ke server/database Supabase
        return true;
      });

      // Update status transaksi di state jika terkirim
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.syncStatus === 'lokal' ? { ...tx, syncStatus: 'terkirim' } : tx
        )
      );

      const remainingPending = await getPendingOfflineTransactions();
      setPendingOfflineCount(remainingPending.length);

      if (result.synced > 0) {
        setActiveAlert(
          `Koneksi tersambung: ${result.synced} transaksi offline berhasil disinkronkan ke server tanpa data ganda.`
        );
      }

      return result.synced;
    } catch (err) {
      console.error('Error saat sinkronisasi offline queue:', err);
      return 0;
    }
  };

  const resetAllData = () => {
    localStorage.removeItem(STORAGE_KEYS.INGREDIENTS);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.PACKAGING);
    localStorage.removeItem(STORAGE_KEYS.PARAMS);
    localStorage.removeItem(STORAGE_KEYS.PRICE_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.EMPLOYEES);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);

    setIngredients(INITIAL_INGREDIENTS);
    setProducts(INITIAL_PRODUCTS);
    setPackaging(INITIAL_PACKAGING);
    setBusinessParams(INITIAL_BUSINESS_PARAMS);
    setEmployees(INITIAL_EMPLOYEES);
    setTransactions([]);
    setPriceHistory([]);
    setAuditLogs([
      {
        id: `reset-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: 'Pemilik',
        page: 'Pengaturan',
        action: 'RESET_DATA',
        details: 'Data aplikasi di-reset ke nilai default awal (seed).',
        ipAddress: '127.0.0.1 (Lokal)',
      },
    ]);
    setActiveAlert('Semua data berhasil di-reset ke data default awal kemitraan INCHA.');
  };

  return (
    <StoreContext.Provider
      value={{
        role,
        currentEmployee,
        employees,
        ingredients,
        products,
        packaging,
        businessParams,
        priceHistory,
        auditLogs,
        transactions,
        activeAlert,
        isOnline,
        pendingOfflineCount,
        clearAlert,
        authenticatedOwner,
        sessionExpiredMessage,
        ownerLogin,
        ownerLogout,
        loginWithPin,
        logout,
        switchRole,
        toggleEmployeeStatus,
        updateIngredientPrice,
        updateIngredientDetails,
        updateProductRecipe,
        updateProductPrice,
        updatePackaging,
        updateBusinessParams,
        getProductFinancials,
        getAllProductsFinancials,
        recordSale,
        voidTransaction,
        syncPendingTransactions,
        addAuditLog,
        resetAllData,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
