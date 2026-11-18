import { describe, it, expect } from 'vitest';
import { getSyncApiUrl, pushTransactionsToCloud, fetchTransactionsFromCloud } from './cloudSync';
import { SalesTransaction } from '../types';

describe('Cloud Sync & Endpoint Resolution', () => {
  it('selalu menggunakan endpoint Vercel resmi ketika tidak berada di domain vercel.app', () => {
    const url = getSyncApiUrl();
    expect(url).toBe('https://incha-pos.vercel.app/api/sync');
  });

  it('tidak menandai transaksi berhasil saat server cloud belum dikonfigurasi (503)', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          success: false,
          configured: false,
          error: 'Database Cloud (Upstash Redis) belum dipasang di Vercel Storage.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    const sampleTx: SalesTransaction = {
      id: 'tx-test-1',
      invoiceNumber: 'INV-20261118-0001',
      timestamp: '2026-11-18T15:00:00.000Z',
      cashierId: 'kasir-outlet',
      cashierName: 'Kasir Toko',
      channel: 'direct',
      paymentMethod: 'cash',
      items: [],
      totalGross: 15000,
      totalDiscount: 0,
      totalNet: 15000,
      totalHpp: 6000,
      syncStatus: 'lokal',
      isVoided: false,
    };

    const res = await pushTransactionsToCloud([sampleTx]);
    expect(res.ok).toBe(false);
    expect(res.configured).toBe(false);
    expect(res.error).toContain('Upstash Redis');

    globalThis.fetch = originalFetch;
  });

  it('mengembalikan transaksi cloud dengan benar saat HTTP 200 OK', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          success: true,
          configured: true,
          provider: 'Upstash Redis',
          transactions: [
            {
              id: 'tx-cloud-1',
              invoiceNumber: 'INV-20261118-0002',
              timestamp: '2026-11-18T15:10:00.000Z',
              cashierId: 'kasir-outlet',
              cashierName: 'Kasir Toko',
              channel: 'direct',
              paymentMethod: 'qris',
              items: [],
              totalGross: 20000,
              totalDiscount: 0,
              totalNet: 20000,
              totalHpp: 8000,
              syncStatus: 'terkirim',
              isVoided: false,
            },
          ],
          lastUpdated: '2026-11-18T15:10:01.000Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    const res = await fetchTransactionsFromCloud();
    expect(res.ok).toBe(true);
    expect(res.configured).toBe(true);
    expect(res.provider).toBe('Upstash Redis');
    expect(res.transactions?.length).toBe(1);
    expect(res.transactions?.[0].id).toBe('tx-cloud-1');

    globalThis.fetch = originalFetch;
  });
});
