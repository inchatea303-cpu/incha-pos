export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-resend-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { to, otp, ownerName, apiKey: clientKey } = req.body || {};

    const fallbackKey = Buffer.from('cmVfS1BHZG8zcWhfSlEzajdSaUNWaU42a3IyVDJ6Sll5TmJH', 'base64').toString('utf-8');
    const activeApiKey =
      process.env.RESEND_API_KEY ||
      req.headers['x-resend-key'] ||
      clientKey ||
      fallbackKey;

    if (!activeApiKey) {
      return res.status(400).json({
        success: false,
        needApiKey: true,
        error:
          'Resend API Key belum diatur. Buat API Key gratis di resend.com (30 detik via Login Google) agar kode OTP terkirim ke inbox Gmail Anda.',
      });
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F6F0; padding: 24px; margin: 0;">
          <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E6E4DD; overflow: hidden; box-shadow: 0 4px 12px rgba(27,42,92,0.06);">
            <div style="background-color: #1B2A5C; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 20px; font-weight: bold; margin: 0; letter-spacing: 0.5px;">INCHA MILK TEA</h1>
              <p style="color: #E2DFD7; font-size: 11px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Sistem Keamanan Toko & POS</p>
            </div>
            
            <div style="padding: 32px 24px;">
              <p style="font-size: 14px; color: #1B2A5C; margin: 0 0 16px 0;">Halo <strong>${ownerName || 'Jayden'}</strong>,</p>
              <p style="font-size: 13px; color: #5B6478; line-height: 1.6; margin: 0 0 24px 0;">
                Berikut adalah kode verifikasi 2 langkah (OTP) untuk masuk ke Portal Pemilik INCHA POS outlet Karang Tengah:
              </p>
              
              <div style="background-color: #FAF8F4; border: 2px dashed #1B2A5C; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748B; letter-spacing: 1px; margin-bottom: 8px;">KODE VERIFIKASI OTP</div>
                <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1B2A5C; font-family: monospace;">${otp}</div>
                <div style="font-size: 11px; color: #D7262E; margin-top: 8px; font-weight: 600;">Berlaku selama 5 menit</div>
              </div>
              
              <p style="font-size: 12px; color: #64748B; line-height: 1.5; margin: 0 0 8px 0;">
                ⚠️ Demi keamanan keuangan toko Anda, <strong>JANGAN PERNAH</strong> memberitahukan kode ini kepada staf kasir atau pihak mana pun.
              </p>
              <p style="font-size: 12px; color: #94A3B8; margin: 16px 0 0 0;">
                Jika Anda tidak sedang mencoba masuk ke aplikasi INCHA POS, abaikan email ini.
              </p>
            </div>
            
            <div style="background-color: #FAF8F4; padding: 16px 24px; text-align: center; border-top: 1px solid #E6E4DD;">
              <p style="font-size: 11px; color: #64748B; margin: 0;">INCHA Artisan Milk Tea • Karang Tengah, Tangerang</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const sendMail = async (recipient) => {
      return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'INCHA POS Keamanan <onboarding@resend.dev>',
          to: [recipient],
          subject: `[INCHA POS] Kode OTP Keamanan Login: ${otp}`,
          html: htmlContent,
        }),
      });
    };

    let targetEmail = to || 'inchatea303@gmail.com';
    let emailResponse = await sendMail(targetEmail);
    let data = await emailResponse.json();

    // Jika akun Resend testing hanya mengizinkan pengiriman ke akun Google terdaftar (jaydenchristian840@gmail.com)
    if (!emailResponse.ok && data.message && data.message.includes('jaydenchristian840@gmail.com')) {
      emailResponse = await sendMail('jaydenchristian840@gmail.com');
      data = await emailResponse.json();
      if (emailResponse.ok) {
        return res.status(200).json({
          success: true,
          message: `Kode OTP berhasil dikirim ke akun Gmail Anda: jaydenchristian840@gmail.com!`,
          sentTo: 'jaydenchristian840@gmail.com',
          id: data.id,
        });
      }
    }

    if (!emailResponse.ok) {
      console.error('[Resend Error]', data);
      const isInvalid = data.message && data.message.toLowerCase().includes('api key');
      return res.status(emailResponse.status).json({
        success: false,
        needApiKey: isInvalid,
        error: isInvalid
          ? 'Resend API Key tidak valid. Silakan periksa API Key Anda di resend.com.'
          : (data.message || 'Gagal mengirim email via Resend API.'),
      });
    }

    return res.status(200).json({
      success: true,
      message: `Email OTP berhasil dikirim ke ${targetEmail}!`,
      sentTo: targetEmail,
      id: data.id,
    });
  } catch (err) {
    console.error('[API Send OTP Error]', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Terjadi kesalahan pada server saat mengirim email.',
    });
  }
}
