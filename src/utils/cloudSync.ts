import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { SalesTransaction } from '../types';

const REMOTE_SYNC_URL = 'https://incha-pos.vercel.app/api/sync';

export interface CloudSyncResult {
  ok: boolean;
  configured: boolean;
  provider?: string;
  transactions: SalesTransaction[] | null;
  lastUpdated?: string | null;
  error?: string;
}

export function getSyncApiUrl(): string {
  if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
    const host = window.location.hostname;
    if (host.endsWith('vercel.app') || host.endsWith('inchatea.com')) {
      return '/api/sync';
    }
  }
  return REMOTE_SYNC_URL;
}

async function requestSyncApi(
  method: 'GET' | 'POST',
  bodyObj?: Record<string, any>
): Promise<{ status: number; data: any }> {
  const url = getSyncApiUrl();

  // Di Android APK native, gunakan CapacitorHttp agar bebas hambatan WebView CORS
  if (Capacitor.isNativePlatform()) {
    try {
      const res =
        method === 'GET'
          ? await CapacitorHttp.get({
              url,
              headers: {
                Accept: 'application/json',
                'Cache-Control': 'no-cache',
              },
              connectTimeout: 10000,
              readTimeout: 10000,
            })
          : await CapacitorHttp.post({
              url,
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              data: bodyObj || {},
              connectTimeout: 10000,
              readTimeout: 10000,
            });

      const parsedData =
        typeof res.data === 'string' ? JSON.parse(res.data || '{}') : res.data;
      return { status: res.status, data: parsedData };
    } catch (nativeErr) {
      console.warn('[CloudSync] CapacitorHttp gagal, beralih ke fetch standar:', nativeErr);
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Cache-Control': 'no-store',
    },
    ...(method === 'POST' ? { body: JSON.stringify(bodyObj || {}) } : {}),
  });

  let parsed: any = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  return { status: response.status, data: parsed };
}

/**
 * Kirim dan gabungkan (merge) transaksi ke Cloud Server Vercel
 * Aman dari data ganda & tidak menimpa transaksi perangkat lain
 */
export async function pushTransactionsToCloud(
  transactions: SalesTransaction[]
): Promise<CloudSyncResult> {
  try {
    const { status, data } = await requestSyncApi('POST', {
      action: 'merge',
      transactions,
    });

    if (status === 200 && data?.success) {
      return {
        ok: true,
        configured: true,
        provider: data.provider,
        transactions: Array.isArray(data.transactions) ? data.transactions : transactions,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    }

    const configured = data?.configured !== false;
    return {
      ok: false,
      configured,
      transactions: null,
      error: data?.error || `HTTP ${status}: Gagal mengirim data ke Cloud.`,
    };
  } catch (err: any) {
    return {
      ok: false,
      configured: true,
      transactions: null,
      error: err?.message || 'Koneksi jaringan ke server Vercel terputus.',
    };
  }
}

/**
 * Tarik daftar transaksi terbaru dari Cloud Vercel (Tablet Kasir -> Website Vercel Owner)
 */
export async function fetchTransactionsFromCloud(): Promise<CloudSyncResult> {
  try {
    const { status, data } = await requestSyncApi('GET');

    if (status === 200 && data?.success && Array.isArray(data.transactions)) {
      return {
        ok: true,
        configured: true,
        provider: data.provider,
        transactions: data.transactions,
        lastUpdated: data.lastUpdated || null,
      };
    }

    const configured = data?.configured !== false;
    return {
      ok: false,
      configured,
      transactions: null,
      error: data?.error || `HTTP ${status}: Gagal mengambil data dari Cloud.`,
    };
  } catch (err: any) {
    return {
      ok: false,
      configured: true,
      transactions: null,
      error: err?.message || 'Koneksi jaringan ke server Vercel terputus.',
    };
  }
}

/**
 * Reset data transaksi di Cloud (khusus Pemilik)
 */
export async function resetCloudTransactions(
  ownerPassword: string = 'Jayden134?'
): Promise<boolean> {
  try {
    const { status, data } = await requestSyncApi('POST', {
      action: 'reset',
      ownerPassword,
    });
    return status === 200 && Boolean(data?.success);
  } catch (err) {
    console.warn('[CloudSync] Gagal reset cloud transactions:', err);
    return false;
  }
}
