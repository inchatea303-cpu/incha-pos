import { SalesTransaction, Expense } from '../types';
import { formatDateWIB, getDateStrWIB } from './calculations';

export interface BackupDataPayload {
  version: string;
  exportedAt: string;
  outlet: string;
  totalTransactions: number;
  totalRevenue: number;
  transactions: SalesTransaction[];
  expenses?: Expense[];
}

/**
 * Unduh seluruh database transaksi penjualan dalam format JSON cadangan (Backup)
 */
export function downloadJsonBackup(
  transactions: SalesTransaction[],
  expenses: Expense[] = []
): void {
  const now = new Date();
  const dateStr = getDateStrWIB(now).replace(/-/g, '');
  const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
  const filename = `backup-incha-karang-tengah-${dateStr}-${timeStr}.json`;

  const validTxs = transactions.filter((t) => !t.isVoided);
  const totalRevenue = validTxs.reduce((sum, t) => sum + t.totalNet, 0);

  const payload: BackupDataPayload = {
    version: '1.0',
    exportedAt: now.toISOString(),
    outlet: 'INCHA Artisan Milk Tea - Karang Tengah',
    totalTransactions: transactions.length,
    totalRevenue,
    transactions,
    expenses,
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  triggerBrowserDownload(blob, filename);
}

/**
 * Ekspor laporan rekap transaksi ke file CSV / Excel spreadsheet
 */
export function downloadSalesCsv(transactions: SalesTransaction[]): void {
  const now = new Date();
  const dateStr = getDateStrWIB(now);
  const filename = `laporan-penjualan-incha-${dateStr}.csv`;

  // Baris Header CSV
  const headers = [
    'No. Invoice',
    'Waktu Transaksi (WIB)',
    'Metode Bayar',
    'Channel',
    'Daftar Menu & Varian',
    'Total Cup',
    'Total Omzet (Rp)',
    'Kasir',
    'Status Transaksi',
    'Alasan Void (Jika Batal)',
  ];

  const rows = transactions.map((tx) => {
    const totalCup = tx.items.reduce((s, it) => s + it.quantity, 0);
    const menuSummary = tx.items
      .map((it) => `${it.productName} (${it.quantity}x)`)
      .join('; ');
    const waktu = formatDateWIB(tx.timestamp);
    const status = tx.isVoided ? 'DIBATALKAN (VOID)' : 'BERHASIL';
    const voidReason = tx.voidReason ? `"${tx.voidReason.replace(/"/g, '""')}"` : '-';

    return [
      `"${tx.invoiceNumber}"`,
      `"${waktu}"`,
      `"${tx.paymentMethod.toUpperCase()}"`,
      `"${tx.channel.toUpperCase()}"`,
      `"${menuSummary.replace(/"/g, '""')}"`,
      totalCup,
      tx.totalNet,
      `"${tx.cashierName || 'Kasir'}"`,
      `"${status}"`,
      voidReason,
    ].join(',');
  });

  // Tambahkan UTF-8 BOM (\uFEFF) agar Microsoft Excel membuka huruf Indonesia tanpa karakter rusak
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBrowserDownload(blob, filename);
}

/**
 * Helper untuk memicu unduhan file di browser / webview
 */
function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Baca dan validasi file cadangan JSON untuk pemulihan (Restore)
 */
export function parseBackupFile(
  jsonText: string
): { success: boolean; transactions: SalesTransaction[]; message: string } {
  try {
    const data = JSON.parse(jsonText);
    if (!data) {
      return { success: false, transactions: [], message: 'File backup kosong atau rusak.' };
    }

    let txList: SalesTransaction[] = [];
    if (Array.isArray(data)) {
      txList = data;
    } else if (data.transactions && Array.isArray(data.transactions)) {
      txList = data.transactions;
    } else {
      return {
        success: false,
        transactions: [],
        message: 'Format file tidak valid. Tidak ditemukan data transaksi di dalamnya.',
      };
    }

    // Validasi field minimum transaksi
    const validList = txList.filter(
      (tx) => tx && typeof tx.id === 'string' && typeof tx.totalNet === 'number'
    );

    if (validList.length === 0 && txList.length > 0) {
      return {
        success: false,
        transactions: [],
        message: 'Struktur transaksi di dalam file tidak sesuai standar POS INCHA.',
      };
    }

    return {
      success: true,
      transactions: validList,
      message: `Berhasil membaca ${validList.length} data transaksi dari file backup.`,
    };
  } catch (err: any) {
    return {
      success: false,
      transactions: [],
      message: `Gagal membaca file: ${err?.message || 'Format JSON tidak valid'}`,
    };
  }
}
