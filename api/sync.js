const STORE_KEY = 'incha_pos_cloud_v1';

function getUpstashConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return { url: url.replace(/\/+$/, ''), token };
  }
  return null;
}

function getFirebaseConfig() {
  const url = process.env.FIREBASE_DATABASE_URL;
  if (!url) return null;
  const cleanUrl = url.replace(/\/+$/, '');
  const secret = process.env.FIREBASE_DATABASE_SECRET || '';
  return { url: cleanUrl, secret };
}

function getSupabaseConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    return { url: url.replace(/\/+$/, ''), key };
  }
  return null;
}

async function readCloudPayload() {
  const upstash = getUpstashConfig();
  if (upstash) {
    const res = await fetch(upstash.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upstash.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['GET', STORE_KEY]),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Upstash GET gagal (${res.status}): ${txt}`);
    }
    const json = await res.json();
    if (!json || !json.result) {
      return { provider: 'Upstash Redis', data: { transactions: [], lastUpdated: null } };
    }
    const parsed = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
    return {
      provider: 'Upstash Redis',
      data: {
        transactions: Array.isArray(parsed?.transactions) ? parsed.transactions : [],
        lastUpdated: parsed?.lastUpdated || null,
      },
    };
  }

  const firebase = getFirebaseConfig();
  if (firebase) {
    const authQ = firebase.secret ? `?auth=${encodeURIComponent(firebase.secret)}` : '';
    const res = await fetch(`${firebase.url}/${STORE_KEY}.json${authQ}`);
    if (!res.ok) {
      throw new Error(`Firebase GET gagal (${res.status})`);
    }
    const parsed = await res.json();
    return {
      provider: 'Firebase Realtime DB',
      data: {
        transactions: Array.isArray(parsed?.transactions) ? parsed.transactions : [],
        lastUpdated: parsed?.lastUpdated || null,
      },
    };
  }

  const supa = getSupabaseConfig();
  if (supa) {
    const res = await fetch(
      `${supa.url}/rest/v1/incha_kv_store?id=eq.${STORE_KEY}&select=payload`,
      {
        headers: {
          apikey: supa.key,
          Authorization: `Bearer ${supa.key}`,
        },
      }
    );
    if (!res.ok) {
      throw new Error(`Supabase GET gagal (${res.status})`);
    }
    const rows = await res.json();
    const parsed = rows?.[0]?.payload;
    return {
      provider: 'Supabase',
      data: {
        transactions: Array.isArray(parsed?.transactions) ? parsed.transactions : [],
        lastUpdated: parsed?.lastUpdated || null,
      },
    };
  }

  return null;
}

async function writeCloudPayload(payload) {
  const upstash = getUpstashConfig();
  if (upstash) {
    const res = await fetch(upstash.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upstash.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', STORE_KEY, JSON.stringify(payload)]),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Upstash SET gagal (${res.status}): ${txt}`);
    }
    return 'Upstash Redis';
  }

  const firebase = getFirebaseConfig();
  if (firebase) {
    const authQ = firebase.secret ? `?auth=${encodeURIComponent(firebase.secret)}` : '';
    const res = await fetch(`${firebase.url}/${STORE_KEY}.json${authQ}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Firebase PUT gagal (${res.status})`);
    }
    return 'Firebase Realtime DB';
  }

  const supa = getSupabaseConfig();
  if (supa) {
    const res = await fetch(`${supa.url}/rest/v1/incha_kv_store`, {
      method: 'POST',
      headers: {
        apikey: supa.key,
        Authorization: `Bearer ${supa.key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ id: STORE_KEY, payload }),
    });
    if (!res.ok) {
      throw new Error(`Supabase UPSERT gagal (${res.status})`);
    }
    return 'Supabase';
  }

  return null;
}

// Merge cerdas: Transaksi lama tidak pernah terhapus oleh client lain & anti-void
function mergeTransactions(existingList, incomingList) {
  const txMap = new Map();

  for (const tx of existingList || []) {
    if (tx && tx.id) {
      txMap.set(tx.id, {
        ...tx,
        isVoided: false, // Kebijakan anti-void: transaksi sah tidak bisa di-void oleh kasir
        syncStatus: 'terkirim',
      });
    }
  }

  for (const tx of incomingList || []) {
    if (tx && tx.id) {
      const existing = txMap.get(tx.id);
      if (!existing) {
        txMap.set(tx.id, {
          ...tx,
          isVoided: false,
          syncStatus: 'terkirim',
        });
      }
    }
  }

  return Array.from(txMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const existingResult = await readCloudPayload();
    if (!existingResult) {
      return res.status(503).json({
        success: false,
        configured: false,
        error:
          'Database Cloud (Upstash Redis) belum dipasang di Vercel Storage. Hubungkan Upstash Redis di Vercel Dashboard -> Storage lalu Redeploy.',
      });
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        configured: true,
        provider: existingResult.provider,
        transactions: existingResult.data.transactions,
        count: existingResult.data.transactions.length,
        lastUpdated: existingResult.data.lastUpdated,
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const action = body.action || 'merge';

      if (action === 'reset') {
        const expectedPw = process.env.OWNER_RESET_PASSWORD || 'Jayden134?';
        if (body.ownerPassword !== expectedPw) {
          return res.status(403).json({
            success: false,
            configured: true,
            error: 'Password pemilik tidak valid untuk reset data cloud.',
          });
        }

        const now = new Date().toISOString();
        const provider = await writeCloudPayload({
          transactions: [],
          lastUpdated: now,
        });
        return res.status(200).json({
          success: true,
          configured: true,
          provider,
          transactions: [],
          count: 0,
          lastUpdated: now,
        });
      }

      const incomingTxs = Array.isArray(body.transactions)
        ? body.transactions
        : body.transaction
        ? [body.transaction]
        : [];

      const merged = mergeTransactions(existingResult.data.transactions, incomingTxs);
      const now = new Date().toISOString();
      const provider = await writeCloudPayload({
        transactions: merged,
        lastUpdated: now,
      });

      return res.status(200).json({
        success: true,
        configured: true,
        provider,
        transactions: merged,
        count: merged.length,
        lastUpdated: now,
      });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (error) {
    console.error('[api/sync] Error:', error);
    return res.status(500).json({
      success: false,
      configured: true,
      error: error.message || 'Gagal memproses sinkronisasi cloud.',
    });
  }
}
