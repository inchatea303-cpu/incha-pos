// Layanan pengiriman email OTP nyata ke inchatea303@gmail.com via Resend / Serverless API

const RESEND_KEY_STORAGE = 'incha_resend_api_key';
export const BUILTIN_RESEND_KEY = typeof window !== 'undefined' ? atob('cmVfS1BHZG8zcWhfSlEzajdSaUNWaU42a3IyVDJ6Sll5TmJH') : '';

export function getStoredResendApiKey(): string {
  try {
    const saved = localStorage.getItem(RESEND_KEY_STORAGE);
    return saved || BUILTIN_RESEND_KEY;
  } catch {
    return BUILTIN_RESEND_KEY;
  }
}

export function setStoredResendApiKey(key: string): void {
  try {
    if (!key) {
      localStorage.removeItem(RESEND_KEY_STORAGE);
    } else {
      localStorage.setItem(RESEND_KEY_STORAGE, key.trim());
    }
  } catch (err) {
    console.error('Gagal menyimpan API key:', err);
  }
}

export interface SendOtpResult {
  success: boolean;
  message?: string;
  error?: string;
  needApiKey?: boolean;
}

export async function sendRealOtpEmail(
  toEmail: string,
  otpCode: string,
  ownerName: string = 'Jayden'
): Promise<SendOtpResult> {
  const localApiKey = getStoredResendApiKey();
  const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '';
  const proxyBase = isLocal ? '' : 'https://incha-pos.vercel.app';

  try {
    // 1. Coba panggil serverless function /api/send-otp
    const response = await fetch(`${proxyBase}/api/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-resend-key': localApiKey,
      },
      body: JSON.stringify({
        to: toEmail,
        otp: otpCode,
        ownerName,
        apiKey: localApiKey,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return {
        success: true,
        message: data.message || `Kode OTP berhasil dikirim ke ${toEmail}`,
      };
    }

    const isInvalidKey =
      data.needApiKey ||
      (data.error && data.error.toLowerCase().includes('api key'));

    if (isInvalidKey) {
      return {
        success: false,
        needApiKey: true,
        error:
          'API Key Resend tidak valid atau kedaluwarsa. Silakan masukkan API Key Resend baru dari resend.com agar email masuk ke inbox Gmail.',
      };
    }

    return {
      success: false,
      error: data.error || 'Gagal mengirim email OTP.',
    };
  } catch (err: any) {
    // Fallback jika fetch /api/send-otp gagal (misal di localhost tanpa vercel dev)
    // Coba langsung tembak Resend API dari client jika API key tersedia di localStorage
    if (localApiKey) {
      try {
        const directRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'INCHA POS Keamanan <onboarding@resend.dev>',
            to: [toEmail],
            subject: `[INCHA POS] Kode OTP Keamanan Login: ${otpCode}`,
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e2dfd7; border-radius: 16px;">
                <h2 style="color: #1B2A5C; margin: 0 0 12px 0;">INCHA Milk Tea</h2>
                <p style="color: #5B6478; font-size: 14px;">Halo <strong>${ownerName}</strong>,</p>
                <p style="color: #1B2A5C; font-size: 14px;">Kode OTP verifikasi masuk ke portal kasir:</p>
                <div style="background: #FAF8F4; border: 2px dashed #1B2A5C; padding: 18px; text-align: center; border-radius: 12px; margin: 20px 0;">
                  <span style="font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #1B2A5C; font-family: monospace;">${otpCode}</span>
                </div>
                <p style="color: #D7262E; font-size: 12px; font-weight: 600;">Berlaku 5 menit. Jangan berikan kepada siapa pun.</p>
              </div>
            `,
          }),
        });

        let directData = await directRes.json();
        if (directRes.ok) {
          return {
            success: true,
            message: `Email OTP asli terkirim ke inbox ${toEmail}!`,
          };
        }

        // Jika testing sandbox hanya mengizinkan pengiriman ke akun Google terdaftar
        if (directData.message && directData.message.includes('jaydenchristian840@gmail.com')) {
          const retryRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${localApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'INCHA POS Keamanan <onboarding@resend.dev>',
              to: ['jaydenchristian840@gmail.com'],
              subject: `[INCHA POS] Kode OTP Keamanan Login: ${otpCode}`,
              html: `
                <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e2dfd7; border-radius: 16px;">
                  <h2 style="color: #1B2A5C; margin: 0 0 12px 0;">INCHA Milk Tea</h2>
                  <p style="color: #5B6478; font-size: 14px;">Halo <strong>${ownerName}</strong>,</p>
                  <p style="color: #1B2A5C; font-size: 14px;">Kode OTP verifikasi masuk ke portal kasir:</p>
                  <div style="background: #FAF8F4; border: 2px dashed #1B2A5C; padding: 18px; text-align: center; border-radius: 12px; margin: 20px 0;">
                    <span style="font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #1B2A5C; font-family: monospace;">${otpCode}</span>
                  </div>
                  <p style="color: #D7262E; font-size: 12px; font-weight: 600;">Berlaku 5 menit. Jangan berikan kepada siapa pun.</p>
                </div>
              `,
            }),
          });
          const retryData = await retryRes.json();
          if (retryRes.ok) {
            return {
              success: true,
              message: `Email OTP asli terkirim ke inbox Gmail Anda: jaydenchristian840@gmail.com!`,
            };
          }
        }

        return {
          success: false,
          error: directData.message || 'Gagal mengirim email via Resend.',
        };
      } catch (clientErr: any) {
        return {
          success: false,
          error: clientErr.message || 'Koneksi ke layanan email gagal.',
        };
      }
    }

    return {
      success: false,
      needApiKey: true,
      error: 'Resend API Key diperlukan untuk mengirim email riil ke inbox Gmail Anda.',
    };
  }
}
