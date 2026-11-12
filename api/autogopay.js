export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const DEFAULT_KEY = 'agp_ef64a0883a18b3278bac8349ea5032f6bb07fbd47e31f58a88ccfd296d7b228b';
  const apiKey = req.headers['x-api-key'] || req.query.apiKey || DEFAULT_KEY;
  const endpoint = req.query.endpoint || 'shopeepay/transactions';

  try {
    const targetUrl = `https://v1-gateway.autogopay.site/${endpoint}`;
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal menghubungi AutoGoPay Gateway',
    });
  }
}
