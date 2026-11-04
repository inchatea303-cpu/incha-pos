import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SalesTransaction, SyncStatus } from '../types';

interface InchaPOSDB extends DBSchema {
  offline_transactions: {
    key: string;
    value: SalesTransaction;
    indexes: { 'by-sync': string };
  };
}

const DB_NAME = 'incha_pos_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<InchaPOSDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<InchaPOSDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('offline_transactions')) {
          const store = db.createObjectStore('offline_transactions', {
            keyPath: 'id',
          });
          store.createIndex('by-sync', 'syncStatus');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveTransactionToIndexedDB(tx: SalesTransaction): Promise<void> {
  const db = await getDB();
  await db.put('offline_transactions', tx);
}

export async function getAllOfflineTransactions(): Promise<SalesTransaction[]> {
  const db = await getDB();
  return db.getAll('offline_transactions');
}

export async function getPendingOfflineTransactions(): Promise<SalesTransaction[]> {
  const db = await getDB();
  const all = await db.getAll('offline_transactions');
  return all.filter((tx) => tx.syncStatus === 'lokal' || tx.syncStatus === 'gagal');
}

export async function updateTransactionSyncStatus(
  id: string,
  syncStatus: SyncStatus
): Promise<void> {
  const db = await getDB();
  const tx = await db.get('offline_transactions', id);
  if (tx) {
    tx.syncStatus = syncStatus;
    await db.put('offline_transactions', tx);
  }
}

export async function removeTransactionFromIndexedDB(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('offline_transactions', id);
}

export async function syncOfflineQueue(
  sendToServer: (tx: SalesTransaction) => Promise<boolean>
): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingOfflineTransactions();
  let synced = 0;
  let failed = 0;

  for (const tx of pending) {
    try {
      const ok = await sendToServer(tx);
      if (ok) {
        await updateTransactionSyncStatus(tx.id, 'terkirim');
        synced++;
      } else {
        await updateTransactionSyncStatus(tx.id, 'gagal');
        failed++;
      }
    } catch (e) {
      await updateTransactionSyncStatus(tx.id, 'gagal');
      failed++;
    }
  }

  return { synced, failed };
}
