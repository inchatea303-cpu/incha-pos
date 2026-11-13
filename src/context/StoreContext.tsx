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
  Expense,
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
import {
  pushTransactionsToCloud,
  fetchTransactionsFromCloud,
  resetCloudTransactions,
} from '../utils/cloudSync';

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
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  deleteExpense: (id: string) => void;
  resetExpenses: () => void;
  activeAlert: string | null;
  isOnline: boolean;
  pendingOfflineCount: number;
  clearAlert: () => void;
  // Auth & Roles
  authenticatedOwner: OwnerAccount | null;
  isCashierAuthenticated: boolean;
  sessionExpiredMessage: string | null;
  ownerLogin: (owner: OwnerAccount) => void;
  ownerLogout: () => void;
  loginCashier: (pin: string) => { success: boolean; message: string };
  logoutCashier: () => void;
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
  addIngredient: (
    data: Omit<Ingredient, 'id' | 'costPerPortion'>,
    actor?: string
  ) => void;
  deleteIngredient: (id: string, actor?: string) => void;
  // Product & Recipe Management
  updateProduct: (
    productId: string,
    data: Partial<Product>,
    updatedBy?: string
  ) => void;
  addProduct: (
    productData: Omit<Product, 'id'>,
    actor?: string
  ) => void;
  deleteProduct: (productId: string, actor?: string) => void;
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
  syncCloudData: () => Promise<void>;
  // Reset & Audit
  addAuditLog: (action: string, details: string, actor?: string) => void;
  resetTransactions: () => void;
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
  EXPENSES: 'incha_expenses',
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
      // Migrasi nama dan email pemilik ke Jayden / inchatea303@gmail.com
      if (parsed.email === 'owner1@incha.id' || parsed.name === 'Hendra Kusuma') {
        parsed.name = 'Jayden';
        parsed.email = 'inchatea303@gmail.com';
        localStorage.setItem(STORAGE_KEYS.OWNER_AUTH, JSON.stringify(parsed));
      }
      const session = authService.checkSession(parsed.lastActiveAt);
      if (!session.isValid) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const [isCashierAuthenticated, setIsCashierAuthenticated] = useState<boolean>(() => {
    const val = localStorage.getItem('incha_cashier_authenticated');
    return val === null ? true : val === 'true';
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

  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    const saved = safeLoadFromStorage(STORAGE_KEYS.INGREDIENTS, INITIAL_INGREDIENTS);
    const existingIds = new Set(saved.map((i: Ingredient) => i.id));
    const missing = INITIAL_INGREDIENTS.filter((init) => !existingIds.has(init.id));
    return missing.length > 0 ? [...saved, ...missing] : saved;
  });

  const [products, setProducts] = useState<Product[]>(() =>
    safeLoadFromStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS)
  );

  const [packaging, setPackaging] = useState<PackagingCosts>(() =>
    safeLoadFromStorage(STORAGE_KEYS.PACKAGING, INITIAL_PACKAGING)
  );

  const [businessParams, setBusinessParams] = useState<BusinessParameters>(() => {
    const saved = safeLoadFromStorage(STORAGE_KEYS.PARAMS, INITIAL_BUSINESS_PARAMS);
    if (saved.rentMonthly === 1500000 || saved.otherFixedMonthly === 3000000) {
      return INITIAL_BUSINESS_PARAMS;
    }
    return saved;
  });

  const [priceHistory, setPriceHistory] = useState<IngredientPriceHistory[]>(() =>
    safeLoadFromStorage(STORAGE_KEYS.PRICE_HISTORY, [])
  );

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() =>
    safeLoadFromStorage(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS)
  );

  const [transactions, setTransactions] = useState<SalesTransaction[]>(() =>
    safeLoadFromStorage(STORAGE_KEYS.TRANSACTIONS, [])
  );

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = safeLoadFromStorage<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    // Bersihkan dummy demo lama jika ada
    return saved.filter((e) => e.id !== 'exp-1' && e.id !== 'exp-2');
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  }, [expenses]);

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

    // Cross-tab / Multi-window Storage Event Listener
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.TRANSACTIONS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setTransactions(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Initial check pending offline queue
    getPendingOfflineTransactions().then((items) => {
      setPendingOfflineCount(items.length);
    });

    // Sinkronisasi transaksi dari Cloud ke Lokal saat awal buka
    syncCloudData();

    // Polling background setiap 10 detik agar tablet kasir dan HP pemilik selalu sinkron
    const syncInterval = setInterval(() => {
      if (navigator.onLine) {
        syncCloudData();
      }
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(syncInterval);
    };
  }, []);

  const syncCloudData = async () => {
    try {
      const cloudTxs = await fetchTransactionsFromCloud();
      if (cloudTxs && Array.isArray(cloudTxs)) {
        setTransactions((prev) => {
          // Merge by ID: gabungan cerdas (union) agar transaksi kasir lokal TIDAK PERNAH terhapus oleh cloud
          const txMap = new Map<string, SalesTransaction>();

          // Masukkan transaksi cloud
          cloudTxs.forEach((t) => {
            if (t && t.id) txMap.set(t.id, t);
          });

          // Masukkan transaksi lokal (prioritas mempertahankan status lokal)
          prev.forEach((t) => {
            if (t && t.id) {
              const existing = txMap.get(t.id);
              if (!existing) {
                txMap.set(t.id, t);
              } else {
                // Jika salah satu void, pertahankan status void
                if (t.isVoided && !existing.isVoided) {
                  txMap.set(t.id, t);
                }
              }
            }
          });

          const merged = Array.from(txMap.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );

          // Jika lokal memiliki transaksi yang belum masuk ke cloud, dorong data gabungan ke cloud
          const hasMissingInCloud = merged.some((m) => !cloudTxs.some((c) => c.id === m.id));
          if (hasMissingInCloud) {
            pushTransactionsToCloud(merged).catch((err) =>
              console.warn('[CloudSync] Gagal push transaksi gabungan ke cloud:', err)
            );
          }

          // Cek apakah data berubah sebelum memicu render ulang
          const isDifferent =
            merged.length !== prev.length ||
            merged.some(
              (m, i) =>
                m.id !== prev[i]?.id ||
                m.isVoided !== prev[i]?.isVoided ||
                m.syncStatus !== prev[i]?.syncStatus
            );

          if (isDifferent) {
            try {
              localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(merged));
            } catch {}
            return merged;
          }
          return prev;
        });
      }
    } catch (e) {
      console.warn('[CloudSync] Polling gagal:', e);
    }
  };

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

  const loginCashier = (pin: string): { success: boolean; message: string } => {
    if (pin === '1234') {
      setIsCashierAuthenticated(true);
      localStorage.setItem('incha_cashier_authenticated', 'true');
      setRole('karyawan');
      addAuditLog('LOGIN_KASIR', 'Akun Kasir Outlet berhasil masuk dengan PIN.', 'Kasir Outlet');
      return { success: true, message: 'Berhasil masuk ke Kasir POS' };
    }
    return { success: false, message: 'PIN Kasir salah. Silakan coba lagi.' };
  };

  const logoutCashier = () => {
    setIsCashierAuthenticated(false);
    localStorage.removeItem('incha_cashier_authenticated');
    addAuditLog('LOGOUT_KASIR', 'Kasir Outlet keluar.', 'Kasir Outlet');
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

  const addIngredient = (
    data: Omit<Ingredient, 'id' | 'costPerPortion'>,
    actor = 'Pemilik'
  ) => {
    const id = `ing-custom-${Date.now()}`;
    const costPerPortion = calculatePortionCost(data.buyPrice, data.portionsPerUnit);
    const newIngredient: Ingredient = {
      ...data,
      id,
      costPerPortion,
    };
    setIngredients((prev) => [...prev, newIngredient]);
    addAuditLog(
      'TAMBAH_BAHAN_BARU',
      `Menambahkan bahan baku baru: ${data.name} (${data.category}) seharga Rp${data.buyPrice.toLocaleString('id-ID')}/${data.unit}`,
      actor
    );
    setActiveAlert(`Bahan baku "${data.name}" berhasil ditambahkan ke daftar.`);
  };

  const deleteIngredient = (id: string, actor = 'Pemilik') => {
    const target = ingredients.find((i) => i.id === id);
    setIngredients((prev) => prev.filter((i) => i.id !== id));
    addAuditLog(
      'HAPUS_BAHAN',
      `Menghapus bahan baku: ${target?.name || id}`,
      actor
    );
    setActiveAlert(`Bahan baku "${target?.name || id}" telah dihapus.`);
  };

  const updateProduct = (
    productId: string,
    data: Partial<Product>,
    updatedBy?: string
  ) => {
    setProducts((prev) =>
      prev.map((prod) => (prod.id === productId ? { ...prod, ...data } : prod))
    );
    const prod = products.find((p) => p.id === productId);
    addAuditLog(
      'UPDATE_PRODUK',
      `Data menu ${prod?.name || productId} diperbarui.`,
      updatedBy
    );
  };

  const addProduct = (
    productData: Omit<Product, 'id'>,
    actor?: string
  ) => {
    const newId = `prod-${Date.now()}`;
    const newProd: Product = {
      ...productData,
      id: newId,
    };
    setProducts((prev) => [newProd, ...prev]);
    addAuditLog('TAMBAH_PRODUK', `Menambah menu baru: ${productData.name}`, actor);
    setActiveAlert(`Menu baru "${productData.name}" berhasil ditambahkan.`);
  };

  const deleteProduct = (productId: string, actor?: string) => {
    const target = products.find((p) => p.id === productId);
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    addAuditLog('HAPUS_PRODUK', `Menghapus menu: ${target?.name || productId}`, actor);
    setActiveAlert(`Menu "${target?.name || productId}" telah dihapus.`);
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

    // Hitung real HPP per item dari resep dan biaya bahan baku
    let calculatedTotalHpp = 0;
    for (const item of saleData.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        let itemHpp = 0;
        for (const recipeItem of prod.recipe) {
          const ing = ingredients.find((i) => i.id === recipeItem.ingredientId);
          if (ing) {
            itemHpp += (ing.costPerPortion || 0) * recipeItem.amount;
          }
        }
        calculatedTotalHpp += itemHpp * item.quantity;
      }
    }

    const newTx: SalesTransaction = {
      ...saleData,
      id,
      invoiceNumber,
      timestamp: now.toISOString(),
      syncStatus,
      isVoided: false,
      totalHpp: calculatedTotalHpp > 0 ? calculatedTotalHpp : (saleData.totalHpp || 0),
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

    // 2. Simpan Transaksi ke State & LocalStorage (Real-time Immutably)
    let updatedList: SalesTransaction[] = [];
    setTransactions((prev) => {
      const filtered = prev.filter((t) => t.id !== newTx.id);
      updatedList = [newTx, ...filtered];
      try {
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updatedList));
      } catch {}
      return updatedList;
    });

    // Push ke Cloud agar tablet kasir dan HP/Laptop pemilik langsung sinkron
    try {
      await pushTransactionsToCloud(updatedList.length > 0 ? updatedList : [newTx]);
    } catch (err) {
      console.warn('[CloudSync] Push transaksi baru gagal:', err);
    }

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

    let updatedAfterVoid: SalesTransaction[] = [];
    setTransactions((prev) => {
      updatedAfterVoid = prev.map((tx) =>
        tx.id === transactionId
          ? {
              ...tx,
              isVoided: true,
              voidReason: reason,
              voidedAt: now,
              voidedBy: actor,
            }
          : tx
      );
      try {
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updatedAfterVoid));
      } catch {}
      return updatedAfterVoid;
    });

    // Sinkronisasi status void ke cloud
    pushTransactionsToCloud(updatedAfterVoid).catch((err) =>
      console.warn('[CloudSync] Gagal push void ke cloud:', err)
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

  const addExpense = (data: Omit<Expense, 'id' | 'createdAt'>) => {
    const newExp: Expense = {
      ...data,
      id: `exp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setExpenses((prev) => [newExp, ...prev]);
    addAuditLog(
      'TAMBAH_PENGELUARAN',
      `Catat pengeluaran [${data.category}]: ${data.description} (${formatRupiah(data.amount)})`
    );
  };

  const deleteExpense = (id: string) => {
    const target = expenses.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    if (target) {
      addAuditLog(
        'HAPUS_PENGELUARAN',
        `Menghapus pengeluaran: ${target.description} (${formatRupiah(target.amount)})`
      );
    }
  };

  const resetExpenses = () => {
    setExpenses([]);
    localStorage.removeItem(STORAGE_KEYS.EXPENSES);
    addAuditLog('RESET_PENGELUARAN', 'Seluruh daftar pengeluaran operasional di-reset ke Rp0.');
  };

  const resetTransactions = async () => {
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    setTransactions([]);
    await resetCloudTransactions();
    // Kembalikan stok bahan fisik ke porsi semula
    setIngredients((prev) =>
      prev.map((ing) => {
        const initial = INITIAL_INGREDIENTS.find((i) => i.id === ing.id);
        return initial ? { ...ing, currentStock: initial.currentStock } : ing;
      })
    );
    addAuditLog(
      'RESET_PENJUALAN',
      'Seluruh transaksi penjualan uji coba telah dibersihkan dan omzet di-reset ke Rp0.'
    );
    setActiveAlert('Seluruh transaksi uji coba berhasil dibersihkan! Omzet & penjualan kini Rp0 dan siap untuk jualan resmi.');
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
    localStorage.removeItem(STORAGE_KEYS.EXPENSES);

    setIngredients(INITIAL_INGREDIENTS);
    setProducts(INITIAL_PRODUCTS);
    setPackaging(INITIAL_PACKAGING);
    setBusinessParams(INITIAL_BUSINESS_PARAMS);
    setEmployees(INITIAL_EMPLOYEES);
    setTransactions([]);
    setExpenses([]);
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
        expenses,
        addExpense,
        deleteExpense,
        resetExpenses,
        activeAlert,
        isOnline,
        pendingOfflineCount,
        clearAlert,
        authenticatedOwner,
        isCashierAuthenticated,
        sessionExpiredMessage,
        ownerLogin,
        ownerLogout,
        loginCashier,
        logoutCashier,
        loginWithPin,
        logout,
        switchRole,
        toggleEmployeeStatus,
        updateIngredientPrice,
        updateIngredientDetails,
        addIngredient,
        deleteIngredient,
        updateProduct,
        addProduct,
        deleteProduct,
        updateProductRecipe,
        updateProductPrice,
        updatePackaging,
        updateBusinessParams,
        getProductFinancials,
        getAllProductsFinancials,
        recordSale,
        voidTransaction,
        syncPendingTransactions,
        syncCloudData,
        addAuditLog,
        resetTransactions,
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
