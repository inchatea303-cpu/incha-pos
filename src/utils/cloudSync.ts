import { SalesTransaction } from '../types';

const SYNC_CLOUD_ID = 'ff808181a09d98f701a1b3ff4ce158b7';
const SYNC_ENDPOINT = `https://api.restful-api.dev/objects/${SYNC_CLOUD_ID}`;

export interface CloudPayload {
  transactions: SalesTransaction[];
  lastUpdated: string;
}

/**
 * Kirim transaksi lokal ke cloud agar laptop & HP pemilik bisa membaca data yang sama
 */
export async function pushTransactionsToCloud(
  transactions: SalesTransaction[]
): Promise<boolean> {
  try {
    const res = await fetch(SYNC_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'incha-karang-tengah-sync',
        data: {
          transactions,
          lastUpdated: new Date().toISOString(),
        },
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[CloudSync] Gagal push transaksi ke cloud:', err);
    return false;
  }
}

/**
 * Tarik data transaksi terbaru dari cloud (untuk sinkronisasi Tablet -> HP / Laptop)
 */
export async function fetchTransactionsFromCloud(): Promise<SalesTransaction[] | null> {
  try {
    const res = await fetch(SYNC_ENDPOINT, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.data && Array.isArray(json.data.transactions)) {
      return json.data.transactions;
    }
    return null;
  } catch (err) {
    console.warn('[CloudSync] Gagal fetch transaksi dari cloud:', err);
    return null;
  }
}

/**
 * Reset data transaksi di cloud ke nol
 */
export async function resetCloudTransactions(): Promise<boolean> {
  try {
    const res = await fetch(SYNC_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'incha-karang-tengah-sync',
        data: {
          transactions: [],
          lastUpdated: new Date().toISOString(),
        },
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[CloudSync] Gagal reset cloud transactions:', err);
    return false;
  }
}
