import { SalesTransaction } from '../types';
import { formatRupiah, formatDateWIB } from './calculations';

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
  NORMAL: [ESC, 0x21, 0x00],
  LINE_FEED: [0x0A],
  // Standard Cash Drawer Kick Pulse (pin 2, 25 * 2ms = 50ms, 250 * 2ms = 500ms)
  OPEN_CASH_DRAWER: [ESC, 0x70, 0x00, 0x19, 0xFA],
  CUT_PAPER: [GS, 0x56, 0x41, 0x03],
  // ESC/POS DLE EOT 1: Real-time printer status request (digunakan untuk keepalive anti-sleep)
  STATUS_KEEPALIVE: [0x10, 0x04, 0x01],
};

export class BluetoothPrinterService {
  private device: any = null;
  private characteristic: any = null;
  private isConnected: boolean = false;
  private printerName: string = '';
  private heartbeatTimer: any = null;
  private reconnecting: boolean = false;
  private statusListeners: Array<(status: string, connected: boolean) => void> = [];

  get connected(): boolean {
    return this.isConnected && !!this.device?.gatt?.connected;
  }

  get name(): string {
    return this.printerName;
  }

  // Daftarkan listener status untuk sinkronisasi UI
  onStatusChange(listener: (status: string, connected: boolean) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notify(status: string, connected: boolean) {
    this.statusListeners.forEach((l) => l(status, connected));
  }

  // Cek apakah browser mendukung Web Bluetooth (hanya Android Chrome & Desktop Chrome dengan Bluetooth)
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  // Sambungkan ke printer Bluetooth ESC/POS
  async connect(): Promise<{ success: boolean; message: string }> {
    if (!this.isSupported()) {
      return {
        success: false,
        message: 'Web Bluetooth tidak didukung pada browser ini. Gunakan Google Chrome di Android.',
      };
    }

    try {
      // Minta izin perangkat Bluetooth dengan filter service printer umum
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer
          'e7810a06-736b-4f3a-8140-7464607e6012', // ESC/POS Custom
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent (Goojprt/Xprinter)
          '0000ffe0-0000-1000-8000-00805f9b34fb', // Standard Serial / HM-10
          '0000fff0-0000-1000-8000-00805f9b34fb', // Generic Mini Thermal POS
          '0000ff00-0000-1000-8000-00805f9b34fb', // POS-58 / RPP02N
          '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent / Iware
          '000018f1-0000-1000-8000-00805f9b34fb',
          '0000af30-0000-1000-8000-00805f9b34fb',
        ],
      });

      this.device = device;
      this.printerName = device.name || 'Printer Bluetooth ESC/POS';

      // Pasang event listener saat koneksi GATT terputus agar otomatis reconnect
      device.addEventListener('gattserverdisconnected', () => {
        console.warn('[BT] Koneksi Bluetooth terputus dari printer.');
        this.isConnected = false;
        this.characteristic = null;
        this.stopHeartbeat();
        this.notify(`Terputus dari ${this.printerName} (Mencoba sambung ulang...)`, false);
        this.autoReconnect();
      });

      const server = await device.gatt.connect();

      // Cari service & characteristic untuk menulis data
      const success = await this.discoverWritableCharacteristic(server);
      
      // Simpan identitas perangkat agar bisa auto-connect saat refresh tanpa dialog izin
      try {
        if (device.id) {
          localStorage.setItem('incha_bt_device_id', device.id);
          localStorage.setItem('incha_bt_device_name', this.printerName);
        }
      } catch {}

      if (success) {
        this.isConnected = true;
        this.startHeartbeat();
        this.notify(`Terhubung: ${this.printerName}`, true);
        return {
          success: true,
          message: `Terhubung ke ${this.printerName}`,
        };
      }

      this.isConnected = true;
      this.startHeartbeat();
      this.notify(`Terhubung: ${this.printerName} (Mode Standar)`, true);
      return {
        success: true,
        message: `Terhubung ke ${this.printerName} (Mode Standar)`,
      };
    } catch (error: any) {
      this.isConnected = false;
      this.notify(error.message || 'Gagal tersambung ke printer.', false);
      return {
        success: false,
        message: error.message || 'Gagal menyambungkan ke printer Bluetooth.',
      };
    }
  }

  // Coba sambung otomatis di latar belakang saat halaman dimuat/refresh (tanpa popup izin)
  async tryAutoConnectOnLoad(): Promise<boolean> {
    if (!this.isSupported() || this.isConnected) return false;

    try {
      const bluetooth = (navigator as any).bluetooth;
      if (!bluetooth || typeof bluetooth.getDevices !== 'function') {
        return false;
      }

      const devices: any[] = await bluetooth.getDevices();
      if (!devices || devices.length === 0) return false;

      const savedId = localStorage.getItem('incha_bt_device_id');
      const targetDevice = savedId
        ? devices.find((d) => d.id === savedId) || devices[0]
        : devices[0];

      if (!targetDevice) return false;

      console.log('[BT] Auto-connect on load menemukan printer:', targetDevice.name);
      this.device = targetDevice;
      this.printerName = targetDevice.name || 'Printer Bluetooth ESC/POS';

      targetDevice.addEventListener('gattserverdisconnected', () => {
        console.warn('[BT] Koneksi Bluetooth terputus dari printer.');
        this.isConnected = false;
        this.characteristic = null;
        this.stopHeartbeat();
        this.notify(`Terputus dari ${this.printerName} (Mencoba sambung ulang...)`, false);
        this.autoReconnect();
      });

      const server = await targetDevice.gatt.connect();
      const success = await this.discoverWritableCharacteristic(server);
      if (success) {
        this.isConnected = true;
        this.startHeartbeat();
        this.notify(`Terhubung otomatis: ${this.printerName}`, true);
        return true;
      }
    } catch (e) {
      console.warn('[BT] Auto-connect on load belum berhasil:', e);
    }
    return false;
  }

  // Cari characteristic yang bisa ditulis
  private async discoverWritableCharacteristic(server: any): Promise<boolean> {
    try {
      const services = await server.getPrimaryServices();
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              this.characteristic = char;
              return true;
            }
          }
        } catch {
          continue;
        }
      }
      return false;
    } catch (e) {
      console.warn('[BT] Gagal mendeteksi characteristic:', e);
      return false;
    }
  }

  // Sambung ulang otomatis di latar belakang tanpa meminta dialog izin ulang
  private async autoReconnect(retries: number = 3): Promise<boolean> {
    if (this.reconnecting || !this.device?.gatt) return false;
    this.reconnecting = true;

    for (let i = 1; i <= retries; i++) {
      try {
        console.log(`[BT] Mencoba auto-reconnect ke ${this.printerName} (Percobaan ${i}/${retries})...`);
        const server = await this.device.gatt.connect();
        const found = await this.discoverWritableCharacteristic(server);
        if (found) {
          this.isConnected = true;
          this.reconnecting = false;
          this.startHeartbeat();
          this.notify(`Terhubung kembali ke ${this.printerName}`, true);
          return true;
        }
      } catch (err) {
        console.warn(`[BT] Auto-reconnect percobaan ${i} gagal:`, err);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    this.reconnecting = false;
    this.notify(`Gagal tersambung kembali. Nyalakan printer dan klik Hubungkan.`, false);
    return false;
  }

  // Pastikan koneksi aktif sebelum mengirim data (silent re-connection)
  async ensureConnected(): Promise<boolean> {
    if (this.isConnected && this.characteristic && this.device?.gatt?.connected) {
      return true;
    }
    if (this.device?.gatt) {
      console.log('[BT] Koneksi idle/terputus, menyambungkan ulang sebelum cetak...');
      return await this.autoReconnect(2);
    }
    return false;
  }

  // Heartbeat keep-alive (setiap 25 detik mengirim pulse status ringan tanpa mencetak kertas)
  // Mencegah chipset Bluetooth dan printer masuk ke mode deep sleep / sleep timer
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(async () => {
      if (this.device?.gatt?.connected && this.characteristic) {
        try {
          // ESC/POS DLE EOT 1 - Perintah ringan cek status printer (tidak keluar kertas / tidak bunyi)
          const ping = new Uint8Array(ESC_POS.STATUS_KEEPALIVE);
          if (this.characteristic.properties.writeWithoutResponse) {
            await this.characteristic.writeValueWithoutResponse(ping);
          } else {
            await this.characteristic.writeValue(ping);
          }
        } catch (e) {
          console.warn('[BT] Heartbeat ping gagal, koneksi mungkin terputus:', e);
          this.isConnected = false;
          this.stopHeartbeat();
          this.autoReconnect();
        }
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Kirim data byte ke printer dengan throttling agar buffer printer tidak overflow
  async sendCommand(bytes: number[]): Promise<boolean> {
    // Pastikan koneksi aktif dulu sebelum kirim (auto-reconnect jika sempat terputus)
    const isReady = await this.ensureConnected();
    if (!isReady || !this.characteristic) {
      console.warn('Printer tidak terhubung, perintah dicatat secara virtual.');
      return false;
    }

    try {
      const buffer = new Uint8Array(bytes);
      // Chunk ukuran 48 byte dengan jeda 35ms untuk mencegah buffer UART printer 58mm meluap
      const CHUNK_SIZE = 48;
      for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
        const chunk = buffer.slice(i, i + CHUNK_SIZE);
        if (this.characteristic.properties.writeWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }
        // Delay kecil agar mikrokontroler printer sempat mencetak dan mengosongkan buffer RX
        await new Promise((resolve) => setTimeout(resolve, 35));
      }
      return true;
    } catch (err) {
      console.error('Gagal mengirim data ke printer:', err);
      // Jika terjadi error saat transfer, tandai koneksi dan coba pulihkan
      this.isConnected = false;
      this.autoReconnect(1);
      return false;
    }
  }

  // Buka Laci Kas (Cash Drawer Pulse)
  async openCashDrawer(): Promise<{ success: boolean; message: string }> {
    const success = await this.sendCommand(ESC_POS.OPEN_CASH_DRAWER);
    return {
      success,
      message: success
        ? 'Perintah buka laci uang kasir terkirim.'
        : 'Printer Bluetooth belum terhubung.',
    };
  }

  // Cetak Struk Transaksi Standar 58mm
  async printReceipt(
    transaction: SalesTransaction,
    openDrawerIfCash: boolean = true
  ): Promise<{ success: boolean; receiptText: string }> {
    // 1. Susun representasi teks struk (32 karakter per baris untuk kertas 58mm)
    const receiptText = generateReceiptText(transaction);

    // 2. Pastikan koneksi Bluetooth tersambung
    const isReady = await this.ensureConnected();
    if (isReady && this.characteristic) {
      const encoder = new TextEncoder();
      const textBytes = Array.from(encoder.encode(receiptText + '\n\n\n\n'));

      // Laci kas HANYA terbuka jika pembayaran TUNAI (QRIS tidak buka laci)
      const shouldOpenDrawer = openDrawerIfCash && transaction.paymentMethod === 'cash';

      const commands = [
        ...ESC_POS.INIT,
        ...ESC_POS.ALIGN_LEFT,
        ...textBytes,
        ...(shouldOpenDrawer ? ESC_POS.OPEN_CASH_DRAWER : []),
        ...ESC_POS.CUT_PAPER,
      ];

      const success = await this.sendCommand(commands);
      return { success, receiptText };
    }

    // Jika Bluetooth belum dipasangkan, tetap kirim representasi teks agar kasir dapat melihat preview
    return { success: false, receiptText };
  }

  // Tes Printer
  async printTest(): Promise<{ success: boolean; message: string }> {
    const isReady = await this.ensureConnected();
    if (!isReady || !this.characteristic) {
      return {
        success: false,
        message: 'Printer belum terhubung. Sambungkan printer Bluetooth terlebih dahulu.',
      };
    }

    const encoder = new TextEncoder();
    const testBytes = [
      ...ESC_POS.INIT,
      ...ESC_POS.ALIGN_CENTER,
      ...ESC_POS.BOLD_ON,
      ...Array.from(encoder.encode('INCHA TES PRINTER ESC/POS\n')),
      ...ESC_POS.BOLD_OFF,
      ...Array.from(encoder.encode('Printer Bluetooth OK\n')),
      ...Array.from(encoder.encode('Outlet: Karang Tengah, Tangerang\n')),
      ...Array.from(encoder.encode(formatDateWIB(new Date()) + '\n\n\n\n')),
      ...ESC_POS.CUT_PAPER,
    ];

    const success = await this.sendCommand(testBytes);
    return {
      success,
      message: success
        ? 'Tes cetak berhasil dikirim ke printer.'
        : 'Gagal mengirim data tes cetak ke printer.',
    };
  }
}

export const bluetoothPrinter = new BluetoothPrinterService();

/**
 * Format struk teks monospaced 32 karakter (kertas 58mm)
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

  const lines: string[] = [];

  lines.push(center('INCHA MILK TEA'));
  lines.push(center('Karang Tengah, Tangerang'));
  lines.push(doubleDivider);
  lines.push(pad(`No: ${transaction.invoiceNumber}`, ''));
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
  lines.push(pad('Subtotal:', formatRupiah(transaction.totalGross)));
  if (transaction.totalDiscount > 0) {
    lines.push(pad('Total Diskon:', `-${formatRupiah(transaction.totalDiscount)}`));
  }
  lines.push(pad('TOTAL:', formatRupiah(transaction.totalNet)));
  lines.push(pad('Metode Bayar:', transaction.paymentMethod.toUpperCase()));

  if (transaction.paymentMethod === 'cash') {
    if (transaction.cashReceived !== undefined) {
      lines.push(pad('Tunai Diterima:', formatRupiah(transaction.cashReceived)));
      lines.push(pad('Kembalian:', formatRupiah(transaction.cashChange || 0)));
    }
  } else if (transaction.paymentMethod === 'qris') {
    lines.push(pad('Status Pembayaran:', 'LUNAS (QRIS)'));
  }

  lines.push(divider);
  lines.push(center('Terima Kasih Atas Kunjungan'));
  lines.push(center('IG: @incha.karangtengah'));
  lines.push(center('Simpan Struk Sebagai Bukti'));

  return lines.join('\n');
}

/**
 * Kirim langsung struk ke aplikasi RawBT Print Service di Android (jika terinstall)
 * RawBT menjaga koneksi Bluetooth printer secara permanen di background OS Android.
 */
export function printViaRawBT(transaction: SalesTransaction): boolean {
  try {
    const text = generateReceiptText(transaction) + '\n\n\n\n\x1B\x6D';
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    window.location.href = `rawbt:base64,${base64}`;
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
