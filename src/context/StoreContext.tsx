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
} from '../utils/offlineQueue';
import {
  pushTransactionsToCloud,
  fetchTransactionsFromCloud,
  resetCloudTransactions,
} from '../utils/cloudSync';

export interface CloudState {
  status: 'checking' | 'connected' | 'unconfigured' | 'error';
  provider?: string;
  error?: string;
  lastSyncedAt?: string;
}

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
  cloudState: CloudState;
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
  // Reset & Audit & Backup
  addAuditLog: (action: string, details: string, actor?: string) => void;
  resetTransactions: () => void;
  resetAllData: () => void;
  restoreTransactionsBackup: (importedTxs: SalesTransaction[]) => Promise<number>;
  recordManualSale: (data: {
    menuName: string;
    totalAmount: number;
    cups: number;
    paymentMethod: 'cash' | 'qris';
    date?: string;
  }) => Promise<SalesTransaction>;
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
  const transactionsRef = React.useRef<SalesTransaction[]>(transactions);
  transactionsRef.current = transactions;

  const roleRef = React.useRef<UserRole>(role);
  roleRef.current = role;

  const isSyncingRef = React.useRef<boolean>(false);

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
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(() =>
    transactions.filter((t) => !t.isVoided && t.syncStatus !== 'terkirim').length
  );
  const [cloudState, setCloudState] = useState<CloudState>({
    status: 'checking',
  });

  const refreshPendingCount = async (currentList?: SalesTransaction[]) => {
    const list = currentList || transactionsRef.current;
    const localUnsyncedIds = new Set(
      list.filter((t) => !t.isVoided && t.syncStatus !== 'terkirim').map((t) => t.id)
    );
    try {
      const idbPending = await getPendingOfflineTransactions();
      idbPending.forEach((t) => {
        if (!t.isVoided) localUnsyncedIds.add(t.id);
      });
    } catch {}
    setPendingOfflineCount(localUnsyncedIds.size);
    return localUnsyncedIds.size;
  };

  const applyTransactionsState = (nextList: SalesTransaction[]) => {
    const sorted = [...nextList].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    transactionsRef.current = sorted;
    setTransactions(sorted);
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(sorted));
    } catch {}
    setPendingOfflineCount(
      sorted.filter((t) => !t.isVoided && t.syncStatus !== 'terkirim').length
    );
  };

  // Monitor Online/Offline Status & Live Cloud Sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncCloudData();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncCloudData();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    // Cross-tab / Multi-window Storage Event Listener
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.TRANSACTIONS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            transactionsRef.current = parsed;
            setTransactions(parsed);
            setPendingOfflineCount(
              parsed.filter((t: SalesTransaction) => !t.isVoided && t.syncStatus !== 'terkirim').length
            );
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Recovery data dari IndexedDB agar transaksi offline di APK tidak pernah hilang
    getAllOfflineTransactions()
      .then((idbItems) => {
        if (idbItems && idbItems.length > 0) {
          const map = new Map<string, SalesTransaction>();
          transactionsRef.current.forEach((t) => {
            if (t && t.id) map.set(t.id, t);
          });
          let recovered = false;
          idbItems.forEach((t) => {
            if (t && t.id && !map.has(t.id)) {
              map.set(t.id, t);
              recovered = true;
            }
          });
          if (recovered) {
            applyTransactionsState(Array.from(map.values()));
          }
        }
        return refreshPendingCount();
      })
      .finally(() => {
        syncCloudData();
      });

    // Polling terarah:
    // - Pemilik di website Vercel: tarik live update setiap 15 detik saat tab aktif
    // - Kasir di tablet: dorong otomatis tiap 15 detik jika ada antrean belum terkirim, atau cek per 60 detik
    let tickCount = 0;
    const syncInterval = setInterval(() => {
      if (!navigator.onLine) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      tickCount++;
      const hasPending = transactionsRef.current.some(
        (t) => !t.isVoided && t.syncStatus !== 'terkirim'
      );
      if (roleRef.current === 'pemilik' || hasPending || tickCount % 4 === 0) {
        syncCloudData();
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(syncInterval);
    };
  }, []);

  const syncCloudData = async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      // 1. Kumpulkan transaksi lokal yang belum terkirim + antrean IndexedDB
      const currentLocal = transactionsRef.current;
      let unsyncedList = currentLocal.filter((t) => !t.isVoided && t.syncStatus !== 'terkirim');

      try {
        const idbPending = await getPendingOfflineTransactions();
        const unsyncedMap = new Map<string, SalesTransaction>();
        unsyncedList.forEach((t) => unsyncedMap.set(t.id, t));
        idbPending.forEach((t) => {
          if (!t.isVoided && !unsyncedMap.has(t.id)) {
            unsyncedMap.set(t.id, t);
          }
        });
        unsyncedList = Array.from(unsyncedMap.values());
      } catch {}

      // Jika ada transaksi baru / offline yang belum terkirim ke server -> PUSH DULU
      if (unsyncedList.length > 0) {
        const pushRes = await pushTransactionsToCloud(unsyncedList);
        if (pushRes.ok && pushRes.transactions) {
          for (const t of unsyncedList) {
            try {
              await updateTransactionSyncStatus(t.id, 'terkirim');
            } catch {}
          }

          const mergedMap = new Map<string, SalesTransaction>();
          pushRes.transactions.forEach((t) => {
            if (t && t.id) mergedMap.set(t.id, { ...t, syncStatus: 'terkirim' });
          });

          applyTransactionsState(Array.from(mergedMap.values()));
          setCloudState({
            status: 'connected',
            provider: pushRes.provider,
            lastSyncedAt: new Date().toISOString(),
          });
          return;
        }

        setCloudState({
          status: pushRes.configured ? 'error' : 'unconfigured',
          error: pushRes.error,
        });
        return;
      }

      // 2. Tarik data terbaru dari Cloud Server Vercel
      const fetchRes = await fetchTransactionsFromCloud();
      if (!fetchRes.ok || !fetchRes.transactions) {
        setCloudState({
          status: fetchRes.configured ? 'error' : 'unconfigured',
          error: fetchRes.error,
        });
        return;
      }

      const cloudTxs = fetchRes.transactions;

      // Migrasi aman: jika cloud baru pertama kali aktif (lastUpdated === null & kosong),
      // dorong riwayat lokal yang sudah ada di tablet agar tidak hilang.
      if (cloudTxs.length === 0 && !fetchRes.lastUpdated && currentLocal.length > 0) {
        const validLocal = currentLocal.filter((t) => !t.isVoided);
        if (validLocal.length > 0) {
          const migrateRes = await pushTransactionsToCloud(validLocal);
          if (migrateRes.ok && migrateRes.transactions) {
            for (const t of validLocal) {
              try {
                await updateTransactionSyncStatus(t.id, 'terkirim');
              } catch {}
            }
            applyTransactionsState(
              migrateRes.transactions.map((t) => ({ ...t, syncStatus: 'terkirim' as SyncStatus }))
            );
            setCloudState({
              status: 'connected',
              provider: migrateRes.provider,
              lastSyncedAt: new Date().toISOString(),
            });
            return;
          }
        }
      }

      // Merge cloud dengan transaksi yang belum terkirim saja (jika owner reset cloud, data lama tidak bangkit kembali)
      const txMap = new Map<string, SalesTransaction>();
      cloudTxs.forEach((t) => {
        if (t && t.id) txMap.set(t.id, { ...t, syncStatus: 'terkirim' });
      });

      currentLocal.forEach((t) => {
        if (t && t.id && t.syncStatus !== 'terkirim' && !t.isVoided && !txMap.has(t.id)) {
          txMap.set(t.id, t);
        }
      });

      const merged = Array.from(txMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const isDifferent =
        merged.length !== currentLocal.length ||
        merged.some(
          (m, i) =>
            m.id !== currentLocal[i]?.id ||
            m.syncStatus !== currentLocal[i]?.syncStatus ||
            m.totalNet !== currentLocal[i]?.totalNet
        );

      if (isDifferent) {
        applyTransactionsState(merged);
      }

      setCloudState({
        status: 'connected',
        provider: fetchRes.provider,
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      console.warn('[CloudSync] Polling gagal:', e);
      setCloudState({
        status: 'error',
        error: e?.message || 'Sinkronisasi cloud gagal.',
      });
    } finally {
      isSyncingRef.current = false;
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
    const seq = (transactionsRef.current.length + 1).toString().padStart(4, '0');
    const invoiceNumber = `INV-${dateStr}-${seq}`;
    const id = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

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
      syncStatus: 'lokal', // Awalnya 'lokal' sampai server Cloud benar-benar konfirmasi OK!
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

    // 2. Simpan Transaksi ke State & LocalStorage & IndexedDB secara aman (tanpa race condition React 18)
    const nextList = [newTx, ...transactionsRef.current.filter((t) => t.id !== newTx.id)];
    applyTransactionsState(nextList);

    try {
      await saveTransactionToIndexedDB(newTx);
    } catch (e) {
      console.warn('Gagal menyimpan ke IndexedDB:', e);
    }

    // 3. Push seluruh transaksi yang belum terkirim ke Cloud Server Vercel
    let finalSyncStatus: SyncStatus = 'lokal';
    const unsyncedPayload = nextList.filter((t) => !t.isVoided && t.syncStatus !== 'terkirim');

    if (navigator.onLine) {
      const pushRes = await pushTransactionsToCloud(
        unsyncedPayload.length > 0 ? unsyncedPayload : [newTx]
      );

      if (pushRes.ok) {
        finalSyncStatus = 'terkirim';
        for (const t of unsyncedPayload) {
          try {
            await updateTransactionSyncStatus(t.id, 'terkirim');
          } catch {}
        }

        if (pushRes.transactions && Array.isArray(pushRes.transactions)) {
          const mergedMap = new Map<string, SalesTransaction>();
          pushRes.transactions.forEach((t) => {
            if (t && t.id) mergedMap.set(t.id, { ...t, syncStatus: 'terkirim' });
          });
          applyTransactionsState(Array.from(mergedMap.values()));
        } else {
          const confirmedList = transactionsRef.current.map((t) =>
            unsyncedPayload.some((u) => u.id === t.id)
              ? { ...t, syncStatus: 'terkirim' as SyncStatus }
              : t
          );
          applyTransactionsState(confirmedList);
        }

        setCloudState({
          status: 'connected',
          provider: pushRes.provider,
          lastSyncedAt: new Date().toISOString(),
        });
      } else {
        setCloudState({
          status: pushRes.configured ? 'error' : 'unconfigured',
          error: pushRes.error,
        });
      }
    }

    await refreshPendingCount();

    const savedTx: SalesTransaction = { ...newTx, syncStatus: finalSyncStatus };

    // 4. Catat Audit Log
    addAuditLog(
      'TRANSAKSI_KASIR',
      `Penjualan ${invoiceNumber} (${saleData.channel.toUpperCase()} - ${formatRupiah(saleData.totalNet)}) dicatat oleh ${saleData.cashierName}. Stok ${totalCupsSold} cup bahan berkurang otomatis. Status Cloud: ${finalSyncStatus.toUpperCase()}.`
    );

    return savedTx;
  };

  // Void Transaksi Dinonaktifkan (Kebijakan Anti-Korupsi INCHA)
  const voidTransaction = (_transactionId: string, _reason: string) => {
    addAuditLog(
      'VOID_DITOLAK',
      'Percobaan pembatalan transaksi (Void) ditolak otomatis oleh sistem anti-korupsi.'
    );
    setActiveAlert('Fitur Void Transaksi telah dinonaktifkan untuk mencegah kebocoran omzet kasir.');
  };

  // Sinkronisasi antrean transaksi offline nyata ke Cloud Server Vercel
  const syncPendingTransactions = async (): Promise<number> => {
    const beforePending = transactionsRef.current.filter(
      (t) => !t.isVoided && t.syncStatus !== 'terkirim'
    ).length;

    await syncCloudData();

    const afterPending = await refreshPendingCount();
    const syncedCount = Math.max(0, beforePending - afterPending);

    if (syncedCount > 0) {
      setActiveAlert(
        `${syncedCount} transaksi berhasil disinkronkan ke Website Vercel.`
      );
    }

    return syncedCount;
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
    if (!authenticatedOwner) {
      setActiveAlert('Hanya Pemilik terautentikasi yang dapat mereset data penjualan.');
      return;
    }
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    applyTransactionsState([]);
    await resetCloudTransactions(authenticatedOwner.passwordHash || 'Jayden134?');
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

  // Pulihkan transaksi dari berkas cadangan (Backup Restore)
  const restoreTransactionsBackup = async (importedTxs: SalesTransaction[]): Promise<number> => {
    let countAdded = 0;
    const map = new Map<string, SalesTransaction>();
    transactionsRef.current.forEach((t) => map.set(t.id, t));

    importedTxs.forEach((t) => {
      if (!map.has(t.id)) {
        countAdded++;
      }
      map.set(t.id, { ...t, syncStatus: 'lokal' });
    });

    const mergedList = Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    applyTransactionsState(mergedList);

    if (mergedList.length > 0) {
      const pushRes = await pushTransactionsToCloud(mergedList);
      if (pushRes.ok) {
        applyTransactionsState(
          mergedList.map((t) => ({ ...t, syncStatus: 'terkirim' as SyncStatus }))
        );
        setCloudState({
          status: 'connected',
          provider: pushRes.provider,
          lastSyncedAt: new Date().toISOString(),
        });
      }
    }

    addAuditLog(
      'RESTORE_BACKUP',
      `Memulihkan data backup: ${importedTxs.length} transaksi diproses (${countAdded} transaksi baru ditambahkan).`
    );
    setActiveAlert(`Berhasil memulihkan ${countAdded} transaksi baru dari file backup.`);
    return countAdded;
  };

  // Catat Penjualan Manual / Susulan untuk Menyesuaikan Omzet Toko
  const recordManualSale = async (data: {
    menuName: string;
    totalAmount: number;
    cups: number;
    paymentMethod: 'cash' | 'qris';
    date?: string;
  }): Promise<SalesTransaction> => {
    const targetDate = data.date ? new Date(data.date) : new Date();
    const dateStr = targetDate.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = (transactionsRef.current.length + 1).toString().padStart(4, '0');
    const invoiceNumber = `INV-${dateStr}-${seq}-M`;
    const id = `tx-man-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const newTx: SalesTransaction = {
      id,
      invoiceNumber,
      timestamp: targetDate.toISOString(),
      cashierId: 'owner-manual',
      cashierName: authenticatedOwner?.name || 'Pemilik (Manual)',
      channel: 'direct',
      paymentMethod: data.paymentMethod,
      items: [
        {
          productId: 'manual-entry',
          productName: data.menuName || 'Penjualan Minuman INCHA',
          quantity: data.cups || 1,
          unitPrice: Math.round(data.totalAmount / (data.cups || 1)),
          discountAmount: 0,
          subtotal: data.totalAmount,
          hppPerUnit: Math.round((data.totalAmount / (data.cups || 1)) * 0.42),
        },
      ],
      totalGross: data.totalAmount,
      totalDiscount: 0,
      totalNet: data.totalAmount,
      totalHpp: Math.round(data.totalAmount * 0.42),
      cashReceived: data.totalAmount,
      cashChange: 0,
      syncStatus: 'lokal',
      isVoided: false,
    };

    const nextList = [newTx, ...transactionsRef.current];
    applyTransactionsState(nextList);

    const pushRes = await pushTransactionsToCloud([newTx]);
    if (pushRes.ok) {
      applyTransactionsState(
        nextList.map((t) =>
          t.id === newTx.id ? { ...t, syncStatus: 'terkirim' as SyncStatus } : t
        )
      );
      setCloudState({
        status: 'connected',
        provider: pushRes.provider,
        lastSyncedAt: new Date().toISOString(),
      });
    }

    addAuditLog(
      'INPUT_MANUAL_OMZET',
      `Pemilik mencatat penjualan susulan: ${newTx.invoiceNumber} senilai ${formatRupiah(data.totalAmount)} (${data.cups} cup) via ${data.paymentMethod.toUpperCase()}.`
    );

    setActiveAlert(`Penjualan sebesar ${formatRupiah(data.totalAmount)} (${data.cups} cup) berhasil ditambahkan ke omzet.`);
    return newTx;
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
    applyTransactionsState([]);
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
        cloudState,
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
        restoreTransactionsBackup,
        recordManualSale,
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
