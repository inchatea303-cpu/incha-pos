import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Printer,
  Coins,
  Wifi,
  WifiOff,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  History,
  RotateCcw,
  Percent,
  Check,
  CreditCard,
  Banknote,
  Bluetooth,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  Store,
  Settings,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  Product,
  SalesItem,
  SalesChannel,
  PaymentMethod,
  SalesTransaction,
} from '../../types';
import { formatRupiah, formatDateWIB } from '../../utils/calculations';
import {
  bluetoothPrinter,
  printTestViaRawBT,
  isNativeAndroidApp,
  openNativeAppSettings,
  getPairedBluetoothPrinters,
  NativeBTDevice,
} from '../../utils/bluetoothPrinter';
import { ReceiptModal } from './ReceiptModal';
import { CheckoutConfirmModal } from './CheckoutConfirmModal';

interface CartItem extends SalesItem {
  maxDiscountPct: number;
}

export const CashierMain: React.FC = () => {
  const {
    products,
    ingredients,
    currentEmployee,
    role,
    isOnline,
    pendingOfflineCount,
    transactions,
    recordSale,
    voidTransaction,
    syncPendingTransactions,
  } = useStore();

  // POS State
  const [activePosTab, setActivePosTab] = useState<'order' | 'history' | 'printer' | 'stock'>('order');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [channel, setChannel] = useState<SalesChannel>('direct');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashInput, setCashInput] = useState<string>('');

  // Modals state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [completedTx, setCompletedTx] = useState<SalesTransaction | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Void modal state
  const [voidTxTarget, setVoidTxTarget] = useState<SalesTransaction | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');

  // Bluetooth State
  const [btStatus, setBtStatus] = useState<string>(
    bluetoothPrinter.connected ? `Terhubung: ${bluetoothPrinter.name}` : 'Belum Terhubung'
  );
  const [pairedDevices, setPairedDevices] = useState<NativeBTDevice[]>([]);
  const [selectedDeviceAddress, setSelectedDeviceAddress] = useState<string>('');

  const refreshPairedDevices = async () => {
    if (isNativeAndroidApp()) {
      const devs = await getPairedBluetoothPrinters();
      setPairedDevices(devs);
      if (devs.length > 0 && !selectedDeviceAddress) {
        const saved = localStorage.getItem('incha_native_bt_address');
        const match = (saved ? devs.find(d => d.address === saved) : null)
          || devs.find(d => /xantri|pos|print|rpp|bt/i.test(d.name))
          || devs[0];
        if (match) setSelectedDeviceAddress(match.address);
      }
    }
  };

  useEffect(() => {
    if (activePosTab === 'printer') {
      refreshPairedDevices();
    }
  }, [activePosTab]);

  useEffect(() => {
    const unsubscribe = bluetoothPrinter.onStatusChange((status) => {
      setBtStatus(status);
    });

    // Otomatis sambungkan kembali di latar belakang saat halaman dimuat/refresh (tanpa popup izin)
    if (!bluetoothPrinter.connected) {
      bluetoothPrinter.tryAutoConnectOnLoad().then((connected) => {
        if (connected) {
          setBtStatus(`Terhubung otomatis: ${bluetoothPrinter.name}`);
        }
      });
    }

    return () => unsubscribe();
  }, []);

  // Calculations for Cart
  const totalGross = cart.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const totalDiscount = cart.reduce((sum, it) => sum + it.discountAmount, 0);
  const totalNet = Math.max(0, totalGross - totalDiscount);
  const totalCups = cart.reduce((sum, it) => sum + it.quantity, 0);

  const cashNum = parseFloat(cashInput) || 0;
  const cashChange = paymentMethod === 'cash' ? Math.max(0, cashNum - totalNet) : 0;
  const isCashSufficient = paymentMethod === 'qris' || cashNum >= totalNet;

  // Add Item to Cart
  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((it) => it.productId === product.id);
      if (existing) {
        return prev.map((it) =>
          it.productId === product.id
            ? {
                ...it,
                quantity: it.quantity + 1,
                subtotal: (it.quantity + 1) * it.unitPrice - it.discountAmount,
              }
            : it
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.sellPrice,
          discountAmount: 0,
          subtotal: product.sellPrice,
          hppPerUnit: 0,
          maxDiscountPct: product.maxDiscountPct,
        },
      ];
    });
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) => {
          if (it.productId === productId) {
            const nextQty = it.quantity + delta;
            if (nextQty <= 0) return null;
            return {
              ...it,
              quantity: nextQty,
              subtotal: nextQty * it.unitPrice - it.discountAmount,
            };
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((it) => it.productId !== productId));
  };

  const handleApplyDiscount = (productId: string, discountPct: number) => {
    setCart((prev) =>
      prev.map((it) => {
        if (it.productId === productId) {
          // Validasi tidak boleh melebihi batas diskon kasir
          const cappedPct = Math.min(discountPct, it.maxDiscountPct);
          if (discountPct > it.maxDiscountPct) {
            alert(
              `Batas diskon kasir untuk ${it.productName} adalah maksimal ${it.maxDiscountPct}%. Diskon disesuaikan ke batas maksimal.`
            );
          }
          const itemGross = it.unitPrice * it.quantity;
          const discountAmt = Math.round((cappedPct / 100) * itemGross);
          return {
            ...it,
            discountAmount: discountAmt,
            subtotal: itemGross - discountAmt,
          };
        }
        return it;
      })
    );
  };

  // Quick cash buttons
  const handleQuickCash = (amount: number) => {
    setCashInput(amount.toString());
  };

  // Checkout submission
  const handleCheckoutClick = () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'cash' && !isCashSufficient) {
      alert(`Uang tunai yang diterima (Rp${cashNum.toLocaleString('id-ID')}) kurang dari total tagihan (Rp${totalNet.toLocaleString('id-ID')}).`);
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleConfirmOrder = async () => {
    setIsConfirmOpen(false);

    const saleRecord = await recordSale({
      cashierId: 'kasir-outlet',
      cashierName: 'Kasir Toko',
      channel,
      paymentMethod,
      items: cart,
      totalGross,
      totalDiscount,
      totalNet,
      totalHpp: 0,
      cashReceived: paymentMethod === 'cash' ? cashNum : totalNet,
      cashChange: paymentMethod === 'cash' ? cashChange : 0,
    });

    // Otomatis kirim perintah buka laci kas jika bayar tunai
    if (paymentMethod === 'cash' && bluetoothPrinter.connected) {
      bluetoothPrinter.openCashDrawer();
    }

    // Reset Cart
    setCart([]);
    setCashInput('');
    setCompletedTx(saleRecord);
    setIsReceiptOpen(true);
  };

  // Void Handler
  const handleConfirmVoid = () => {
    if (!voidTxTarget || !voidReason.trim()) {
      alert('Alasan pembatalan transaksi wajib diisi!');
      return;
    }
    voidTransaction(voidTxTarget.id, voidReason.trim());
    setVoidTxTarget(null);
    setVoidReason('');
  };

  // Bluetooth Actions
  const handleConnectBt = async () => {
    setBtStatus('Mencari printer Bluetooth...');
    const res = await bluetoothPrinter.connect(selectedDeviceAddress || undefined);
    setBtStatus(res.message);
    refreshPairedDevices();
  };

  const handleTestPrint = async () => {
    const res = await bluetoothPrinter.printTest();
    alert(res.message);
  };

  const handleDrawerKick = async () => {
    const res = await bluetoothPrinter.openCashDrawer();
    alert(res.message);
  };

  // Filtered Menu
  const filteredProducts = products.filter((prod) => {
    const matchesCategory = selectedCategory === 'all' || prod.category === selectedCategory;
    const matchesSearch = prod.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-2xl shadow-lg border border-[#E6E4DD] overflow-hidden my-2 flex flex-col min-h-[85vh]">
      {/* 1. Android Status Bar & Sync Indicator */}
      <div className="bg-[#1B2A5C] text-white px-5 py-2.5 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-wider">INCHA KASIR</span>
          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-200">
            Karang Tengah
          </span>
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <div className="flex items-center gap-1 text-emerald-300 font-semibold text-[11px]">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-amber-300 font-semibold text-[11px]">
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span>Offline (Lokal)</span>
            </div>
          )}

          {pendingOfflineCount > 0 && (
            <button
              onClick={() => syncPendingTransactions()}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400 text-amber-950 font-bold text-[10px] animate-pulse"
              title="Sinkronkan antrean transaksi ke server"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{pendingOfflineCount} Antrean</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Cashier Header Info */}
      <div className="bg-[#131E42] text-white px-4 py-3 flex items-center justify-between border-b border-[#243775]">
        <div className="flex items-center gap-2.5">
          <img
            src="/incha-emblem.png"
            alt="INCHA"
            className="w-8 h-8 rounded-full border border-white/30 shrink-0 object-cover shadow-xs"
          />
          <div>
            <div className="font-bold text-sm text-white leading-tight">
              Kasir Toko (POS)
            </div>
            <div className="text-[11px] text-gray-300">
              INCHA Karang Tengah, Tangerang
            </div>
          </div>
        </div>

        {/* Quick Tab Switcher */}
        <div className="flex gap-1 bg-[#1B2A5C] p-1 rounded-xl border border-[#243775]">
          <button
            type="button"
            onClick={() => setActivePosTab('order')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activePosTab === 'order'
                ? 'bg-white text-[#1B2A5C] shadow'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Order ({cart.length})
          </button>
          <button
            type="button"
            onClick={() => setActivePosTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activePosTab === 'history'
                ? 'bg-white text-[#1B2A5C] shadow'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Riwayat
          </button>
          <button
            type="button"
            onClick={() => setActivePosTab('printer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activePosTab === 'printer'
                ? 'bg-white text-[#1B2A5C] shadow'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Printer
          </button>
        </div>
      </div>

      {/* 3. TAB: ORDER KASIR */}
      {activePosTab === 'order' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Category Filter Pills (Thumb-friendly touch targets) */}
          <div className="p-3 bg-[#FAF8F4] border-b border-[#E2DED6] flex gap-2 overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: 'all', label: 'Semua Menu' },
              { id: 'milk_tea', label: 'Milk Tea' },
              { id: 'pure_tea', label: 'Pure Tea' },
              { id: 'fruity_tea', label: 'Fruity Tea' },
              { id: 'special_blend', label: 'Special' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`min-h-[44px] px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap shadow-sm select-none ${
                  selectedCategory === cat.id
                    ? 'bg-[#1B2A5C] text-white'
                    : 'bg-white text-gray-700 border border-[#E2DED6] hover:bg-gray-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="px-3 pt-2 bg-[#FAF8F4] shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#6B7280]" />
              <input
                type="text"
                placeholder="Cari menu (Oolong, Osmanthus, Peach)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white text-xs border border-[#E2DED6] rounded-xl focus:outline-none focus:border-[#1B2A5C]"
              />
            </div>
          </div>

          {/* Menu Grid (Thumb Ergonomic & 56px+ Touch Buttons) */}
          <div className="p-3 bg-[#FAF8F4] overflow-y-auto flex-1 space-y-2">
            <div className="grid grid-cols-2 gap-2.5">
              {filteredProducts.map((prod) => {
                const initials = prod.name
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('');

                const inCartItem = cart.find((it) => it.productId === prod.id);

                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleAddToCart(prod)}
                    className={`min-h-[96px] p-3 rounded-2xl bg-white border text-left flex flex-col justify-between shadow-sm transition-all active:scale-[0.98] select-none ${
                      inCartItem
                        ? 'border-2 border-[#1B2A5C] bg-[#1B2A5C]/5'
                        : 'border-[#E2DED6] hover:border-[#1B2A5C]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      {prod.imageUrl ? (
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="w-10 h-10 rounded-xl object-cover border border-[#E2DED6] shadow-xs"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#1B2A5C] text-white font-bold text-xs flex items-center justify-center">
                          {initials}
                        </div>
                      )}
                      {inCartItem ? (
                        <span className="w-6 h-6 rounded-full bg-[#1B2A5C] text-white font-bold text-xs flex items-center justify-center tabular-nums">
                          {inCartItem.quantity}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase text-[#6B7280] bg-[#FAF8F4] px-1.5 py-0.5 rounded border border-[#E2DED6]">
                          {prod.category.split('_')[0]}
                        </span>
                      )}
                    </div>

                    <div className="mt-2">
                      <div className="font-bold text-xs text-[#1F2937] line-clamp-2 leading-tight">
                        {prod.name}
                      </div>
                      <div className="font-extrabold text-sm text-[#1B2A5C] mt-1 tabular-nums">
                        {formatRupiah(prod.sellPrice)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cart & Checkout Sheet (Pinned Bottom) */}
          <div className="bg-white border-t-2 border-[#E2DED6] p-4 shadow-lg shrink-0 space-y-3">
            {/* Cart Items Preview if cart not empty */}
            {cart.length > 0 && (
              <div className="max-h-44 overflow-y-auto divide-y divide-gray-100 border border-[#E2DED6] rounded-xl p-2 bg-[#FAF8F4] space-y-1">
                {cart.map((item) => (
                  <div key={item.productId} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex-1 pr-2">
                      <div className="font-bold text-[#1F2937]">{item.productName}</div>
                      <div className="text-[11px] text-[#6B7280] tabular-nums">
                        {formatRupiah(item.unitPrice)} / cup
                      </div>
                    </div>

                    {/* Qty Stepper (>= 56px thumb target) */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white border border-[#E2DED6] rounded-lg">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, -1)}
                          className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-100 rounded-l active:bg-gray-200"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-bold text-xs tabular-nums text-[#1F2937]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, 1)}
                          className="w-8 h-8 flex items-center justify-center text-[#1B2A5C] hover:bg-gray-100 rounded-r active:bg-gray-200"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="w-20 text-right font-bold text-[#1B2A5C] tabular-nums">
                        {formatRupiah(item.subtotal)}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.productId)}
                        className="text-gray-400 hover:text-[#D7262E] p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sales Channel Selector */}
            <div className="grid grid-cols-4 gap-1.5 text-[11px]">
              {[
                { id: 'direct', label: 'Langsung (0%)' },
                { id: 'gofood', label: 'GoFood (20%)' },
                { id: 'grabfood', label: 'GrabFood (20%)' },
                { id: 'shopeefood', label: 'Shopee (20%)' },
              ].map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setChannel(ch.id as SalesChannel)}
                  className={`py-2 px-1 rounded-xl font-bold text-center border transition-all ${
                    channel === ch.id
                      ? 'bg-[#1B2A5C] text-white border-[#1B2A5C]'
                      : 'bg-white text-gray-700 border-[#E2DED6] hover:bg-gray-50'
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`h-11 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-[#1B2A5C] text-white border-[#1B2A5C] shadow'
                    : 'bg-white text-gray-700 border-[#E2DED6]'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-400" />
                <span>Tunai (Cash)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('qris');
                  setCashInput(totalNet.toString());
                }}
                className={`h-11 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  paymentMethod === 'qris'
                    ? 'bg-[#1B2A5C] text-white border-[#1B2A5C] shadow'
                    : 'bg-white text-gray-700 border-[#E2DED6]'
                }`}
              >
                <CreditCard className="w-4 h-4 text-blue-400" />
                <span>QRIS Instant</span>
              </button>
            </div>

            {/* Cash Input & Quick Cash Buttons (if Cash selected) */}
            {paymentMethod === 'cash' && cart.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-[#E2DED6]">
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => handleQuickCash(totalNet)}
                    className="flex-1 py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-[#1F2937] text-[11px] font-bold rounded-lg border border-gray-300 tabular-nums whitespace-nowrap"
                  >
                    Uang Pas
                  </button>
                  {[10000, 20000, 50000, 100000].map((nominal) => (
                    <button
                      key={nominal}
                      type="button"
                      onClick={() => handleQuickCash(nominal)}
                      className="flex-1 py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-[#1F2937] text-[11px] font-bold rounded-lg border border-gray-300 tabular-nums whitespace-nowrap"
                    >
                      {formatRupiah(nominal)}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-500">Rp</span>
                    <input
                      type="number"
                      placeholder="Nominal uang diterima..."
                      value={cashInput}
                      onChange={(e) => setCashInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E2DED6] rounded-xl font-bold tabular-nums focus:outline-none focus:border-[#1B2A5C]"
                    />
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#6B7280]">Kembalian:</div>
                    <div className="text-xs font-extrabold text-emerald-700 tabular-nums">
                      {formatRupiah(cashChange)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Big Checkout Trigger Button (>= 56px Thumb target) */}
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={handleCheckoutClick}
              className={`w-full h-14 rounded-2xl font-bold text-sm shadow-xl flex items-center justify-between px-5 transition-all active:scale-[0.98] ${
                cart.length > 0
                  ? 'bg-[#1B2A5C] hover:bg-[#243775] text-white cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-white" />
                <div className="text-left">
                  <div className="font-extrabold text-sm">BAYAR SEKARANG</div>
                  <div className="text-[10px] text-gray-200 font-normal">
                    {totalCups} Cup • {paymentMethod.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-black text-base tabular-nums">
                  {formatRupiah(totalNet)}
                </div>
                {totalDiscount > 0 && (
                  <div className="text-[10px] text-red-300">
                    Hemat: {formatRupiah(totalDiscount)}
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 4. TAB: RIWAYAT TRANSAKSI & VOID */}
      {activePosTab === 'history' && (
        <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-[#FAF8F4]">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#1B2A5C] flex items-center gap-1.5">
              <History className="w-4 h-4" />
              <span>Transaksi Kasir Hari Ini ({transactions.length})</span>
            </h3>
            <span className="text-[11px] text-[#6B7280]">Bisa cetak ulang & void</span>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-[#E2DED6] text-xs text-[#6B7280]">
              Belum ada transaksi yang tercatat hari ini.
            </div>
          ) : (
            <div className="space-y-2.5">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className={`p-3.5 rounded-2xl border bg-white shadow-sm space-y-2 ${
                    tx.isVoided ? 'opacity-60 border-red-200 bg-red-50/30' : 'border-[#E2DED6]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-xs text-[#1F2937] flex items-center gap-1.5">
                        <span>{tx.invoiceNumber}</span>
                        {tx.isVoided && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#FCE8E9] text-[#D7262E] border border-[#D7262E]/30">
                            VOID
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                            tx.syncStatus === 'terkirim'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {tx.syncStatus}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#6B7280] mt-0.5">
                        {formatDateWIB(tx.timestamp)} • Kasir: {tx.cashierName} • [{tx.channel.toUpperCase()}]
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-extrabold text-xs text-[#1B2A5C] tabular-nums">
                        {formatRupiah(tx.totalNet)}
                      </div>
                      <div className="text-[10px] uppercase text-[#6B7280]">
                        {tx.paymentMethod}
                      </div>
                    </div>
                  </div>

                  {/* Items mini list */}
                  <div className="text-[11px] text-[#4B5563] bg-[#FAF8F4] p-2 rounded-lg">
                    {tx.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>
                          {it.quantity}x {it.productName}
                        </span>
                        <span className="tabular-nums font-semibold">{formatRupiah(it.subtotal)}</span>
                      </div>
                    ))}
                  </div>

                  {tx.isVoided && tx.voidReason && (
                    <div className="text-[10px] text-[#D7262E] italic">
                      Alasan Void: "{tx.voidReason}" (Oleh: {tx.voidedBy})
                    </div>
                  )}

                  {/* Action Buttons: Cetak Ulang & Void */}
                  {!tx.isVoided && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => {
                          setCompletedTx(tx);
                          setIsReceiptOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 flex items-center gap-1"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Cetak Ulang</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVoidTxTarget(tx)}
                        className="px-3 py-1.5 rounded-lg bg-[#FCE8E9] hover:bg-red-200 text-xs font-semibold text-[#D7262E] flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Void Transaksi</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. TAB: PRINTER & BLUETOOTH */}
      {activePosTab === 'printer' && (
        <div className="p-4 flex-1 overflow-y-auto space-y-4 bg-[#FAF8F4]">
          {/* KARTU RAWBT (BEBAS PUTUS UNTUK TABLET ANDROID) */}
          <div className="bg-white p-4 rounded-2xl border-2 border-emerald-500/40 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="font-bold text-sm text-[#1B2A5C] flex items-center gap-2">
                    <span>Layanan RawBT (Tablet Android)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      Direkomendasikan (Anti-Putus)
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#6B7280]">
                    Koneksi OS permanen 24 jam. Tidak perlu reconnect walau aplikasi di-refresh!
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const ok = printTestViaRawBT();
                if (!ok) {
                  alert('Gagal memicu RawBT. Pastikan aplikasi RawBT sudah terinstall di tablet.');
                }
              }}
              className="w-full h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow"
            >
              <Printer className="w-4 h-4" />
              <span>Tes Cetak via RawBT (RPP02N)</span>
            </button>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E2DED6] shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Bluetooth className="w-5 h-5 text-[#1B2A5C]" />
              <div>
                <h3 className="font-bold text-sm text-[#1B2A5C]">
                  {isNativeAndroidApp()
                    ? 'Printer Bluetooth Native (Aplikasi Android APK)'
                    : 'Printer Web Bluetooth (Jalur Alternatif)'}
                </h3>
                <p className="text-[11px] text-[#6B7280]">
                  {isNativeAndroidApp()
                    ? 'Koneksi langsung sistem Android anti-putus (Tanpa RawBT)'
                    : 'Koneksi manual langsung lewat browser'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#FAF8F4] rounded-xl border border-[#E2DED6] text-xs">
              <div className="text-[11px] text-[#6B7280]">Status Perangkat:</div>
              <div className="font-bold text-sm text-[#1B2A5C] mt-0.5">{btStatus}</div>
            </div>

            {btStatus.toLowerCase().includes('izin') && isNativeAndroidApp() && (
              <button
                type="button"
                onClick={openNativeAppSettings}
                className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow transition-all active:scale-95"
              >
                <Settings className="w-4 h-4" />
                <span>Buka Pengaturan HP (Izinkan &quot;Perangkat di Sekitar&quot;)</span>
              </button>
            )}

            {isNativeAndroidApp() && (
              <div className="space-y-1.5 p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1B2A5C]">
                    Pilih Printer Bluetooth (Xantri / RPP02N):
                  </label>
                  <button
                    type="button"
                    onClick={refreshPairedDevices}
                    className="text-[11px] font-semibold text-blue-700 hover:underline"
                  >
                    Scan Ulang
                  </button>
                </div>
                {pairedDevices.length > 0 ? (
                  <select
                    value={selectedDeviceAddress}
                    onChange={(e) => setSelectedDeviceAddress(e.target.value)}
                    className="w-full p-2.5 text-xs font-medium border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:border-[#1B2A5C]"
                  >
                    {pairedDevices.map((d) => (
                      <option key={d.address} value={d.address}>
                        {d.name} ({d.address})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[11px] text-gray-600">
                    Belum ada printer yang di-pair di Bluetooth HP. Buka menu Bluetooth HP dan pasangkan printer Xantri / RPP02N terlebih dahulu.
                  </p>
                )}
              </div>
            )}

            {(btStatus.includes('-1') || btStatus.includes('terkunci') || btStatus.includes('timeout')) && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <span>💡 Tips Printer Xantri / RPP02N Sibuk:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Printer thermal hanya bisa terhubung ke 1 aplikasi. Matikan tombol power printer selama 3 detik lalu nyalakan kembali, dan pastikan aplikasi RawBT ditutup agar koneksi Bluetooth tidak rebutan.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleConnectBt}
                className="w-full h-12 rounded-xl bg-[#1B2A5C] hover:bg-[#243775] text-white font-bold text-xs flex items-center justify-center gap-2 shadow"
              >
                <Bluetooth className="w-4 h-4" />
                <span>Sambungkan Printer Bluetooth</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleTestPrint}
                  className="h-11 rounded-xl bg-white hover:bg-gray-50 text-[#1B2A5C] border border-[#1B2A5C] font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Tes Cetak Struk</span>
                </button>

                <button
                  type="button"
                  onClick={handleDrawerKick}
                  className="h-11 rounded-xl bg-white hover:bg-gray-50 text-[#1B2A5C] border border-[#1B2A5C] font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <Coins className="w-4 h-4" />
                  <span>Buka Laci Kas</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-[#6B7280] leading-relaxed pt-2 border-t border-[#E2DED6]">
              * Fitur Web Bluetooth beroperasi optimal di browser <strong>Google Chrome di Android</strong>. Pastikan Bluetooth di HP dalam posisi aktif sebelum memasangkan printer.
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI ORDER SEBELUM SELESAI */}
      <CheckoutConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmOrder}
        items={cart}
        channel={channel}
        paymentMethod={paymentMethod}
        totalGross={totalGross}
        totalDiscount={totalDiscount}
        totalNet={totalNet}
        cashReceived={paymentMethod === 'cash' ? cashNum : totalNet}
        cashChange={paymentMethod === 'cash' ? cashChange : 0}
        cashierName="Kasir Toko"
      />

      {/* MODAL: CETAK STRUK SUKSES */}
      {completedTx && (
        <ReceiptModal
          transaction={completedTx}
          isOpen={isReceiptOpen}
          onClose={() => {
            setIsReceiptOpen(false);
            setCompletedTx(null);
          }}
        />
      )}

      {/* MODAL: INPUT ALASAN VOID TRANSAKSI */}
      {voidTxTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#FAF8F4] w-full max-w-sm rounded-2xl shadow-2xl border border-[#E2DED6] overflow-hidden p-5 space-y-4">
            <div className="flex items-center gap-2 text-[#D7262E]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <h3 className="font-bold text-sm text-[#1F2937]">Batalkan Transaksi (VOID)?</h3>
                <p className="text-[11px] text-[#6B7280]">{voidTxTarget.invoiceNumber}</p>
              </div>
            </div>

            <p className="text-xs text-[#1F2937]">
              Membatalkan transaksi akan <strong>mengembalikan seluruh stok bahan baku</strong> ke gudang secara otomatis dan mencatat audit log.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                Alasan Pembatalan (Wajib diisi):
              </label>
              <textarea
                rows={3}
                required
                placeholder="Contoh: Pelanggan salah pilih varian, atau pesanan dibatalkan..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full p-2.5 text-xs bg-white border border-[#E2DED6] rounded-xl focus:outline-none focus:border-[#1B2A5C]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setVoidTxTarget(null);
                  setVoidReason('');
                }}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-[#D7262E] hover:bg-red-700 text-white shadow"
              >
                Konfirmasi VOID
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
