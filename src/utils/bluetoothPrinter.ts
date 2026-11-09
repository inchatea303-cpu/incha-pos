import { SalesTransaction } from '../types';
import { formatRupiah, formatDateWIB } from './calculations';
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface NativeBTDevice {
  name: string;
  address: string;
}

export interface NativeBluetoothPrinterPlugin {
  listPrinters(): Promise<{ printers: NativeBTDevice[] }>;
  connect(options: { address: string; target?: 'receipt' | 'label' }): Promise<{
    success: boolean;
    target?: string;
    name: string;
    address: string;
  }>;
  printBytes(options: {
    base64: string;
    target?: 'receipt' | 'label';
    address?: string;
  }): Promise<{ success: boolean; target?: string }>;
  isConnected(options?: { target?: 'receipt' | 'label' }): Promise<{
    connected: boolean;
    name?: string;
    address?: string;
    receiptConnected?: boolean;
    receiptName?: string;
    receiptAddress?: string;
    labelConnected?: boolean;
    labelName?: string;
    labelAddress?: string;
  }>;
  disconnect(options?: { target?: 'receipt' | 'label' | 'all' }): Promise<{ success: boolean }>;
  requestBluetoothPermission(): Promise<{ granted: boolean }>;
  openSettings(): Promise<{ success: boolean }>;
}

export const NativePrinter = registerPlugin<NativeBluetoothPrinterPlugin>('BluetoothPrinter');
export const isNativeAndroidApp = () => Capacitor.isNativePlatform();

export async function openNativeAppSettings() {
  if (isNativeAndroidApp()) {
    try {
      await NativePrinter.openSettings();
    } catch (e) {
      console.warn('Gagal buka settings:', e);
    }
  }
}

// Standard ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;

export const ESC_POS = {
  INIT: [ESC, 0x40], // Initialize printer
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  DOUBLE_WIDTH: [ESC, 0x21, 0x20],
  DOUBLE_BOTH: [ESC, 0x21, 0x30],
  NORMAL: [ESC, 0x21, 0x00],
  LINE_FEED: [0x0A],
  FORM_FEED: [0x0C], // Advance to label gap (EPPOS / Label mode)
  // Universal Cash Drawer Kick Pulse (Pin 2 & Pin 5)
  OPEN_CASH_DRAWER: [
    ESC, 0x70, 0x00, 0x32, 0xFA,
    ESC, 0x70, 0x01, 0x32, 0xFA,
    0x10, 0x14, 0x01, 0x00, 0x05,
  ],
  CUT_PAPER: [GS, 0x56, 0x41, 0x03],
  STATUS_KEEPALIVE: [0x10, 0x04, 0x01],
};

export async function getPairedBluetoothPrinters(): Promise<NativeBTDevice[]> {
  if (isNativeAndroidApp()) {
    try {
      await NativePrinter.requestBluetoothPermission();
      const res = await NativePrinter.listPrinters();
      return res.printers || [];
    } catch (e) {
      console.warn('Gagal ambil list printer:', e);
    }
  }
  return [];
}

export function extractQueueNumber(invoiceNumber: string): string {
  if (!invoiceNumber) return '#001';
  const parts = invoiceNumber.split('-');
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last)) {
    return '#' + last.slice(-3).padStart(3, '0');
  }
  return '#' + (invoiceNumber.slice(-3) || '001');
}

export class BluetoothPrinterService {
  // Web Bluetooth fallback instances
  private receiptDevice: any = null;
  private receiptCharacteristic: any = null;
  private isReceiptConnected: boolean = false;
  private receiptPrinterName: string = '';

  private labelDevice: any = null;
  private labelCharacteristic: any = null;
  private isLabelConnected: boolean = false;
  private labelPrinterName: string = '';

  private statusListeners: Array<(status: string, connected: boolean) => void> = [];

  get connected(): boolean {
    return this.isReceiptConnected || this.isLabelConnected;
  }

  get receiptConnected(): boolean {
    return this.isReceiptConnected;
  }

  get labelConnected(): boolean {
    return this.isLabelConnected;
  }

  get name(): string {
    const parts = [];
    if (this.receiptPrinterName) parts.push(`Kasir: ${this.receiptPrinterName}`);
    if (this.labelPrinterName) parts.push(`Cup: ${this.labelPrinterName}`);
    return parts.length > 0 ? parts.join(' | ') : 'Belum Terhubung';
  }

  get receiptName(): string {
    return this.receiptPrinterName;
  }

  get labelName(): string {
    return this.labelPrinterName;
  }

  onStatusChange(listener: (status: string, connected: boolean) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notify(status: string, connected: boolean) {
    this.statusListeners.forEach((l) => l(status, connected));
  }

  isSupported(): boolean {
    if (isNativeAndroidApp()) return true;
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  // Sambungkan Printer Struk Kasir (Slot 1)
  async connectReceipt(targetAddress?: string): Promise<{ success: boolean; message: string }> {
    return this.connect(targetAddress, 'receipt');
  }

  // Sambungkan Printer Stiker Cup EPPOS (Slot 2)
  async connectLabel(targetAddress?: string): Promise<{ success: boolean; message: string }> {
    return this.connect(targetAddress, 'label');
  }

  // Sambungkan ke printer Bluetooth ESC/POS (Receipt atau Label)
  async connect(
    targetAddress?: string,
    target: 'receipt' | 'label' = 'receipt'
  ): Promise<{ success: boolean; message: string }> {
    const isLabel = target === 'label';
    const targetTitle = isLabel ? 'Stiker Cup (EPPOS)' : 'Struk Kasir';

    // JALUR 1: APLIKASI ANDROID NATIVE
    if (isNativeAndroidApp()) {
      try {
        try {
          await NativePrinter.requestBluetoothPermission();
        } catch (pErr) {
          console.warn('[BT Perm] Request error:', pErr);
        }

        const { printers } = await NativePrinter.listPrinters();
        if (!printers || printers.length === 0) {
          return {
            success: false,
            message: `Tidak ada printer Bluetooth yang terpasang (paired). Pasangkan printer di menu Bluetooth HP terlebih dahulu.`,
          };
        }

        const storageKey = isLabel ? 'incha_native_bt_label_address' : 'incha_native_bt_receipt_address';
        const savedAddr = targetAddress || localStorage.getItem(storageKey);

        const targetDevice =
          (savedAddr ? printers.find((p) => p.address === savedAddr) : null) ||
          (isLabel
            ? printers.find((p) => /eppos|label|cup|sticker|ep58/i.test(p.name)) || printers[0]
            : printers.find((p) => /xantri|pos|print|rpp|bt/i.test(p.name)) || printers[0]);

        const res = await NativePrinter.connect({
          address: targetDevice.address,
          target,
        });

        if (isLabel) {
          this.isLabelConnected = true;
          this.labelPrinterName = res.name || targetDevice.name;
          localStorage.setItem(storageKey, targetDevice.address);
          localStorage.setItem('incha_bt_label_name', this.labelPrinterName);
        } else {
          this.isReceiptConnected = true;
          this.receiptPrinterName = res.name || targetDevice.name;
          localStorage.setItem(storageKey, targetDevice.address);
          localStorage.setItem('incha_bt_receipt_name', this.receiptPrinterName);
        }

        const msg = `Terhubung: ${isLabel ? this.labelPrinterName : this.receiptPrinterName} (${targetTitle})`;
        this.notify(msg, true);
        return { success: true, message: msg };
      } catch (err: any) {
        if (isLabel) this.isLabelConnected = false;
        else this.isReceiptConnected = false;
        const msg = err.message || `Gagal koneksi printer ${targetTitle}.`;
        this.notify(msg, false);
        return { success: false, message: msg };
      }
    }

    // JALUR 2: BROWSER WEB BLUETOOTH
    if (!this.isSupported()) {
      return {
        success: false,
        message: 'Web Bluetooth tidak didukung pada browser ini. Gunakan Google Chrome di Android atau Aplikasi APK INCHA POS.',
      };
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          'e7810a06-736b-4f3a-8140-7464607e6012',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '0000fff0-0000-1000-8000-00805f9b34fb',
          '0000ff00-0000-1000-8000-00805f9b34fb',
          '0000fee7-0000-1000-8000-00805f9b34fb',
        ],
      });

      const server = await device.gatt.connect();
      const characteristic = await this.discoverWritableCharacteristic(server);

      if (isLabel) {
        this.labelDevice = device;
        this.labelCharacteristic = characteristic;
        this.isLabelConnected = true;
        this.labelPrinterName = device.name || 'EPPOS Label';
        try { localStorage.setItem('incha_bt_label_id', device.id); } catch {}
      } else {
        this.receiptDevice = device;
        this.receiptCharacteristic = characteristic;
        this.isReceiptConnected = true;
        this.receiptPrinterName = device.name || 'Printer Struk';
        try { localStorage.setItem('incha_bt_receipt_id', device.id); } catch {}
      }

      const msg = `Terhubung Web: ${device.name || targetTitle}`;
      this.notify(msg, true);
      return { success: true, message: msg };
    } catch (err: any) {
      return { success: false, message: err.message || 'Gagal koneksi Bluetooth.' };
    }
  }

  async tryAutoConnectOnLoad(): Promise<boolean> {
    if (isNativeAndroidApp()) {
      try {
        const status = await NativePrinter.isConnected();
        if (status.receiptConnected) {
          this.isReceiptConnected = true;
          this.receiptPrinterName = status.receiptName || 'Printer Kasir';
        } else {
          const savedReceiptAddr = localStorage.getItem('incha_native_bt_receipt_address') || localStorage.getItem('incha_native_bt_address');
          if (savedReceiptAddr) {
            try {
              const res = await NativePrinter.connect({ address: savedReceiptAddr, target: 'receipt' });
              this.isReceiptConnected = true;
              this.receiptPrinterName = res.name || 'Printer Kasir';
            } catch (e) {}
          }
        }

        if (status.labelConnected) {
          this.isLabelConnected = true;
          this.labelPrinterName = status.labelName || 'EPPOS Cup Label';
        } else {
          const savedLabelAddr = localStorage.getItem('incha_native_bt_label_address');
          if (savedLabelAddr) {
            try {
              const res = await NativePrinter.connect({ address: savedLabelAddr, target: 'label' });
              this.isLabelConnected = true;
              this.labelPrinterName = res.name || 'EPPOS Cup Label';
            } catch (e) {}
          }
        }

        this.notify(this.name, this.connected);
        return this.connected;
      } catch (e) {
        console.warn('[BT AutoConnect] Error:', e);
      }
    }
    return false;
  }

  // Buka Laci Kas
  async openCashDrawer(): Promise<{ success: boolean; message: string }> {
    if (isNativeAndroidApp()) {
      try {
        let binary = '';
        for (let i = 0; i < ESC_POS.OPEN_CASH_DRAWER.length; i++) {
          binary += String.fromCharCode(ESC_POS.OPEN_CASH_DRAWER[i]);
        }
        const savedReceiptAddr =
          localStorage.getItem('incha_native_bt_receipt_address') ||
          localStorage.getItem('incha_native_bt_address') ||
          undefined;
        await NativePrinter.printBytes({
          base64: btoa(binary),
          target: 'receipt',
          address: savedReceiptAddr,
        });
        return { success: true, message: 'Perintah buka laci kasir terkirim.' };
      } catch (e: any) {
        return { success: false, message: e.message || 'Gagal buka laci.' };
      }
    }
    return { success: false, message: 'Fitur buka laci kas aktif di aplikasi Android.' };
  }

  // Cetak Struk Kasir (Printer Struk)
  async printReceipt(
    transaction: SalesTransaction,
    openDrawerIfCash: boolean = true
  ): Promise<{ success: boolean; receiptText: string; error?: string }> {
    const receiptText = generateReceiptText(transaction);

    if (isNativeAndroidApp()) {
      try {
        const encoder = new TextEncoder();
        const textBytes = Array.from(encoder.encode(receiptText + '\n\n\x1B\x6D'));
        const shouldOpenDrawer = openDrawerIfCash && transaction.paymentMethod === 'cash';

        const commands = [
          ...ESC_POS.INIT,
          ...ESC_POS.ALIGN_LEFT,
          ...textBytes,
          ...(shouldOpenDrawer ? ESC_POS.OPEN_CASH_DRAWER : []),
        ];

        let binary = '';
        for (let i = 0; i < commands.length; i++) {
          binary += String.fromCharCode(commands[i]);
        }

        const savedReceiptAddr =
          localStorage.getItem('incha_native_bt_receipt_address') ||
          localStorage.getItem('incha_native_bt_address') ||
          undefined;

        const res = await NativePrinter.printBytes({
          base64: btoa(binary),
          target: 'receipt',
          address: savedReceiptAddr,
        });
        return { success: res.success, receiptText };
      } catch (err: any) {
        console.warn('[BT Print Receipt] Gagal:', err);
        return { success: false, receiptText, error: err.message };
      }
    }

    // Web Bluetooth fallback
    if (this.isReceiptConnected && this.receiptCharacteristic) {
      try {
        const encoder = new TextEncoder();
        const textBytes = Array.from(encoder.encode(receiptText + '\n\n\n\n'));
        const shouldOpenDrawer = openDrawerIfCash && transaction.paymentMethod === 'cash';
        const commands = [
          ...ESC_POS.INIT,
          ...ESC_POS.ALIGN_LEFT,
          ...textBytes,
          ...(shouldOpenDrawer ? ESC_POS.OPEN_CASH_DRAWER : []),
          ...ESC_POS.CUT_PAPER,
        ];
        await this.sendWebCommand(commands, this.receiptCharacteristic);
        return { success: true, receiptText };
      } catch (err: any) {
        return { success: false, receiptText, error: err.message };
      }
    }

    return { success: false, receiptText };
  }

  // Cetak Stiker Cup ke Printer EPPOS (Dicetak per cup)
  async printCupLabels(
    transaction: SalesTransaction
  ): Promise<{ success: boolean; printedCups: number; totalCups: number; message: string }> {
    const queueNo = extractQueueNumber(transaction.invoiceNumber);
    const dateObj = new Date(transaction.timestamp || Date.now());
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes} WIB`;

    // Hitung total cup
    let totalCups = 0;
    for (const it of transaction.items) {
      totalCups += it.quantity || 1;
    }

    if (totalCups === 0) {
      return { success: false, printedCups: 0, totalCups: 0, message: 'Tidak ada item minuman.' };
    }

    let printedCount = 0;
    let currentCup = 0;

    // Cetak 1 stiker per cup
    for (const item of transaction.items) {
      const qty = item.quantity || 1;
      for (let q = 0; q < qty; q++) {
        currentCup++;
        const labelBytes = generateCupLabelBytes(
          item.productName,
          queueNo,
          timeStr,
          currentCup,
          totalCups
        );

        if (isNativeAndroidApp()) {
          try {
            let binary = '';
            for (let i = 0; i < labelBytes.length; i++) {
              binary += String.fromCharCode(labelBytes[i]);
            }
            const savedLabelAddr = localStorage.getItem('incha_native_bt_label_address') || undefined;
            await NativePrinter.printBytes({
              base64: btoa(binary),
              target: 'label',
              address: savedLabelAddr,
            });
            printedCount++;
          } catch (err: any) {
            console.warn('[BT Label Print Error]:', err);
            // Jika printer label gagal/terputus
            return {
              success: false,
              printedCups: printedCount,
              totalCups,
              message: `Gagal cetak stiker cup ke-${printedCount + 1}: ${err.message}`,
            };
          }
        } else if (this.isLabelConnected && this.labelCharacteristic) {
          try {
            await this.sendWebCommand(labelBytes, this.labelCharacteristic);
            printedCount++;
          } catch (err: any) {
            return {
              success: false,
              printedCups: printedCount,
              totalCups,
              message: `Gagal cetak stiker cup: ${err.message}`,
            };
          }
        }

        // Beri jeda 300ms antar stiker agar printer EPPOS sempat mencetak dan siap sobek
        if (currentCup < totalCups) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    }

    return {
      success: printedCount === totalCups,
      printedCups: printedCount,
      totalCups,
      message: `Berhasil mencetak ${printedCount} stiker cup ke printer EPPOS.`,
    };
  }

  // Cetak Keduanya Sekaligus (1 Tombol Selesai Transaksi -> Struk + Stiker Cup)
  async printDual(
    transaction: SalesTransaction,
    options: { receipt?: boolean; label?: boolean } = { receipt: true, label: true }
  ): Promise<{ receiptSuccess: boolean; labelSuccess: boolean; message: string }> {
    let receiptSuccess = false;
    let labelSuccess = false;
    const messages: string[] = [];

    // 1. Cetak Struk Kasir
    if (options.receipt !== false) {
      const resReceipt = await this.printReceipt(transaction, true);
      receiptSuccess = resReceipt.success;
      if (resReceipt.success) {
        messages.push('Struk kasir tercetak');
      } else if (resReceipt.error) {
        messages.push(`Struk: ${resReceipt.error}`);
      }
    }

    // Beri jeda 450ms antar printer agar stack Bluetooth beralih dengan stabil
    await new Promise((r) => setTimeout(r, 450));

    // 2. Cetak Stiker Cup (EPPOS)
    if (options.label !== false) {
      const resLabel = await this.printCupLabels(transaction);
      labelSuccess = resLabel.success;
      if (resLabel.success) {
        messages.push(`${resLabel.printedCups} stiker cup tercetak`);
      } else {
        messages.push(resLabel.message);
      }
    }

    return {
      receiptSuccess,
      labelSuccess,
      message: messages.join(' & '),
    };
  }

  // Tes Cetak Stiker Cup EPPOS (1 Lembar Stiker Sampel)
  async printTestCupLabel(): Promise<{ success: boolean; message: string }> {
    const testBytes = generateCupLabelBytes('PEACH JASMINE MILK TEA', '#014', '14:35 WIB', 1, 1);

    if (isNativeAndroidApp()) {
      try {
        let binary = '';
        for (let i = 0; i < testBytes.length; i++) {
          binary += String.fromCharCode(testBytes[i]);
        }
        const savedLabelAddr = localStorage.getItem('incha_native_bt_label_address') || undefined;
        const res = await NativePrinter.printBytes({
          base64: btoa(binary),
          target: 'label',
          address: savedLabelAddr,
        });
        return {
          success: res.success,
          message: 'Tes cetak stiker cup berhasil dikirim ke printer EPPOS!',
        };
      } catch (e: any) {
        return {
          success: false,
          message: e.message || 'Gagal tes cetak stiker cup EPPOS.',
        };
      }
    }

    if (this.isLabelConnected && this.labelCharacteristic) {
      try {
        await this.sendWebCommand(testBytes, this.labelCharacteristic);
        return { success: true, message: 'Tes cetak stiker cup berhasil.' };
      } catch (e: any) {
        return { success: false, message: e.message || 'Gagal cetak web.' };
      }
    }

    return {
      success: false,
      message: 'Printer Stiker Cup (EPPOS) belum tersambung.',
    };
  }

  // Tes Cetak Struk Kasir
  async printTest(): Promise<{ success: boolean; message: string }> {
    if (isNativeAndroidApp()) {
      try {
        const encoder = new TextEncoder();
        const testText = 'INCHA MILK TEA\nOutlet Karang Tengah\nTes Cetak Struk Kasir OK!\n\n\n\x1B\x6D';
        const commands = [
          ...ESC_POS.INIT,
          ...ESC_POS.ALIGN_CENTER,
          ...Array.from(encoder.encode(testText)),
        ];

        let binary = '';
        for (let i = 0; i < commands.length; i++) {
          binary += String.fromCharCode(commands[i]);
        }

        const savedReceiptAddr =
          localStorage.getItem('incha_native_bt_receipt_address') ||
          localStorage.getItem('incha_native_bt_address') ||
          undefined;

        const res = await NativePrinter.printBytes({
          base64: btoa(binary),
          target: 'receipt',
          address: savedReceiptAddr,
        });
        return {
          success: res.success,
          message: 'Tes cetak struk kasir berhasil!',
        };
      } catch (e: any) {
        return {
          success: false,
          message: e.message || 'Gagal tes cetak struk kasir.',
        };
      }
    }
    return { success: false, message: 'Printer Struk Kasir belum terhubung.' };
  }

  private async sendWebCommand(bytes: number[], characteristic: any): Promise<void> {
    const buffer = new Uint8Array(bytes);
    const CHUNK_SIZE = 48;
    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      const chunk = buffer.slice(i, i + CHUNK_SIZE);
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
  }

  private async discoverWritableCharacteristic(server: any): Promise<any> {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          return char;
        }
      }
    }
    return null;
  }
}

export const bluetoothPrinter = new BluetoothPrinterService();

/**
 * Format Data Byte Stiker Cup (Super Compact 4-5 Baris untuk Kertas Stiker EPPOS 30mm)
 *
 * ┌──────────────────────────────┐
 * │          INCHA TEA           │
 * │ #014              14:35 WIB  │
 * ├──────────────────────────────┤
 * │   PEACH JASMINE MILK TEA     │
 * ├──────────────────────────────┤
 * │     Have a Good Day! ✨      │
 * └──────────────────────────────┘
 */
export function generateCupLabelBytes(
  productName: string,
  queueNo: string,
  timeStr: string,
  cupIndex?: number,
  totalCups?: number
): number[] {
  const LINE_WIDTH = 30; // 30 karakter sangat pas dan aman di kertas 58mm / 30mm
  const divider = '-'.repeat(LINE_WIDTH);

  const queueText =
    totalCups && totalCups > 1 && cupIndex
      ? `${queueNo} (${cupIndex}/${totalCups})`
      : queueNo;

  const spaceCount = Math.max(1, LINE_WIDTH - queueText.length - timeStr.length);
  const queueLine = queueText + ' '.repeat(spaceCount) + timeStr;

  const encoder = new TextEncoder();
  const bytes: number[] = [
    // 1. Reset Printer & Inisialisasi
    ...ESC_POS.INIT,

    // 2. Header: INCHA TEA (Bold Tengah)
    ...ESC_POS.ALIGN_CENTER,
    ...ESC_POS.BOLD_ON,
    ...Array.from(encoder.encode('INCHA TEA\n')),
    ...ESC_POS.BOLD_OFF,

    // 3. Queue & Jam (Kiri & Kanan Rata)
    ...ESC_POS.ALIGN_LEFT,
    ...Array.from(encoder.encode(queueLine + '\n')),

    // 4. Pembatas Garis
    ...Array.from(encoder.encode(divider + '\n')),

    // 5. Nama Minuman (Huruf BOLD, Double Height, Jelas di Tengah)
    ...ESC_POS.ALIGN_CENTER,
    ...ESC_POS.BOLD_ON,
    ...ESC_POS.DOUBLE_HEIGHT,
    ...Array.from(encoder.encode(productName.trim().toUpperCase() + '\n')),
    ...ESC_POS.NORMAL,
    ...ESC_POS.BOLD_OFF,

    // 6. Pembatas Garis
    ...ESC_POS.ALIGN_LEFT,
    ...Array.from(encoder.encode(divider + '\n')),

    // 7. Penutup Ramah Pelanggan
    ...ESC_POS.ALIGN_CENTER,
    ...ESC_POS.BOLD_ON,
    ...Array.from(encoder.encode('Have a Good Day! *\n')),
    ...ESC_POS.BOLD_OFF,

    // 8. 3x Line Feed untuk memajukan kertas melewati gigi sobek printer EPPOS (~12mm)
    0x0A,
    0x0A,
    0x0A,
  ];

  return bytes;
}

/**
 * Format struk kasir teks monospaced 32 karakter (kertas 58mm)
 */
export function generateReceiptText(transaction: SalesTransaction): string {
  const LINE_WIDTH = 32;
  const divider = '-'.repeat(LINE_WIDTH);
  const doubleDivider = '='.repeat(LINE_WIDTH);

  const pad = (left: string, right: string) => {
    const spaceCount = LINE_WIDTH - left.length - right.length;
    return left + ' '.repeat(Math.max(1, spaceCount)) + right;
  };

  const center = (text: string) => {
    const spaceCount = Math.max(0, LINE_WIDTH - text.length);
    const leftPad = Math.floor(spaceCount / 2);
    return ' '.repeat(leftPad) + text;
  };

  const queueNo = extractQueueNumber(transaction.invoiceNumber);
  const lines: string[] = [];

  lines.push(center('INCHA MILK TEA'));
  lines.push(center('Karang Tengah, Tangerang'));
  lines.push(doubleDivider);
  lines.push(pad(`No: ${transaction.invoiceNumber}`, `Antrian: ${queueNo}`));
  lines.push(pad(`Wkt: ${formatDateWIB(transaction.timestamp)}`, ''));
  lines.push(pad(`Kasir: ${transaction.cashierName}`, `[${transaction.channel.toUpperCase()}]`));
  lines.push(divider);

  // Items
  for (const item of transaction.items) {
    lines.push(item.productName);
    const itemSub = formatRupiah(item.subtotal);
    const itemDetail = `  ${item.quantity}x @${formatRupiah(item.unitPrice)}`;
    lines.push(pad(itemDetail, itemSub));
    if (item.discountAmount > 0) {
      lines.push(pad(`  Diskon Menu`, `-${formatRupiah(item.discountAmount)}`));
    }
  }

  lines.push(divider);
  if (transaction.totalDiscount > 0) {
    lines.push(pad('Subtotal:', formatRupiah(transaction.totalGross)));
    lines.push(pad('Diskon:', `-${formatRupiah(transaction.totalDiscount)}`));
  }
  lines.push(pad('TOTAL:', formatRupiah(transaction.totalNet)));

  if (transaction.paymentMethod === 'cash') {
    if (transaction.cashReceived !== undefined) {
      lines.push(pad('Tunai:', formatRupiah(transaction.cashReceived)));
      lines.push(pad('Kembali:', formatRupiah(transaction.cashChange || 0)));
    }
  } else if (transaction.paymentMethod === 'qris') {
    lines.push(pad('Bayar:', 'QRIS (LUNAS)'));
  }

  lines.push(divider);
  lines.push(center('Terima Kasih'));
  lines.push(center('@incha.karangtengah'));

  return lines.join('\n');
}

/**
 * Kirim langsung struk ke aplikasi RawBT Print Service di Android (jika terinstall)
 */
export function printViaRawBT(transaction: SalesTransaction): boolean {
  try {
    const text = generateReceiptText(transaction) + '\n\n\x1B\x6D';
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    window.location.href = `intent:base64,${base64}#Intent;action=ru.a402d.rawbtprinter.action.PRINT_RAWBT;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
    return true;
  } catch (err) {
    console.warn('[RawBT] Gagal mengirim struk via RawBT:', err);
    return false;
  }
}

export function printTestViaRawBT(): boolean {
  const dummyTx: SalesTransaction = {
    id: 'test-rawbt',
    invoiceNumber: 'TEST-RAWBT-01',
    timestamp: new Date().toISOString(),
    cashierName: 'Kasir Toko',
    cashierId: 'kasir-01',
    channel: 'direct',
    paymentMethod: 'cash',
    items: [
      {
        productId: 'p1',
        productName: 'Peach Jasmine Milk Tea (L)',
        quantity: 1,
        unitPrice: 24000,
        discountAmount: 0,
        subtotal: 24000,
        hppPerUnit: 9200,
      },
    ],
    totalGross: 24000,
    totalDiscount: 0,
    totalNet: 24000,
    totalHpp: 9200,
    cashReceived: 50000,
    cashChange: 26000,
    syncStatus: 'terkirim',
    isVoided: false,
  };
  return printViaRawBT(dummyTx);
}
