/**
 * QRIS Sound & Payment Gateway Notifier (AutoGoPay Integration)
 * Menghubungkan AutoGoPay (ShopeePay / GoPay QRIS) ke tablet INCHA POS
 * Mengeluarkan suara notifikasi & lonceng secara otomatis saat ada uang masuk
 */

export interface AutoGoPayTransaction {
  order_sn: string;
  title: string;
  amount: number;
  is_money_in: boolean;
  date: string;
  status: number;
  router_id?: number;
}

export function terbilangRupiah(nominal: number): string {
  if (nominal <= 0) return 'nol rupiah';
  const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

  function convert(n: number): string {
    if (n < 12) return satuan[n];
    if (n < 20) return convert(n - 10) + ' belas';
    if (n < 100) return convert(Math.floor(n / 10)) + ' puluh ' + (n % 10 !== 0 ? ' ' + convert(n % 10) : '');
    if (n < 200) return 'seratus ' + (n - 100 !== 0 ? convert(n - 100) : '');
    if (n < 1000) return convert(Math.floor(n / 100)) + ' ratus ' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
    if (n < 2000) return 'seribu ' + (n - 1000 !== 0 ? convert(n - 1000) : '');
    if (n < 1000000) return convert(Math.floor(n / 1000)) + ' ribu ' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 1000000000) return convert(Math.floor(n / 1000000)) + ' juta ' + (n % 1000000 !== 0 ? ' ' + convert(n % 1000000) : '');
    return n.toString();
  }

  const hasil = convert(Math.floor(nominal)).replace(/\s+/g, ' ').trim();
  return `${hasil} rupiah`;
}

// Nada lonceng digital merdu (3-tone chime: C5 -> E5 -> G5)
export function playPaymentChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const notes = [
      { freq: 523.25, start: now, dur: 0.35, gain: 0.25 },
      { freq: 659.25, start: now + 0.12, dur: 0.38, gain: 0.3 },
      { freq: 783.99, start: now + 0.24, dur: 0.65, gain: 0.35 },
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, n.start);
      g.gain.setValueAtTime(n.gain, n.start);
      g.gain.exponentialRampToValueAtTime(0.0001, n.start + n.dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(n.start);
      osc.stop(n.start + n.dur);
    });
  } catch (e) {
    console.warn('[QRIS Chime] WebAudio error:', e);
  }
}

// Ucapkan suara Text-to-Speech bahasa Indonesia
export function speakPaymentVoice(amount: number): void {
  playPaymentChime();

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  setTimeout(() => {
    try {
      window.speechSynthesis.cancel();
      const text = `Pembayaran ShopeePay QRIS sebesar ${terbilangRupiah(amount)} telah diterima.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 1.0;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find((v) => v.lang.toLowerCase().startsWith('id'));
      if (idVoice) {
        utterance.voice = idVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[QRIS TTS] Speech error:', e);
    }
  }, 450);
}

class QrisSoundService {
  private pollingTimer: any = null;
  private isPolling = false;
  private seenOrderSns = new Set<string>();
  private listeners: Array<(tx: AutoGoPayTransaction) => void> = [];

  // Default credentials provided by user
  private readonly DEFAULT_BASE_URL = 'https://v1-gateway.autogopay.site';
  private readonly DEFAULT_API_KEY = 'agp_ef64a0883a18b3278bac8349ea5032f6bb07fbd47e31f58a88ccfd296d7b228b';

  constructor() {
    this.loadSeenTransactions();
  }

  getBaseUrl(): string {
    return localStorage.getItem('incha_autogopay_base_url') || this.DEFAULT_BASE_URL;
  }

  setBaseUrl(url: string) {
    localStorage.setItem('incha_autogopay_base_url', url);
  }

  getApiKey(): string {
    return localStorage.getItem('incha_autogopay_api_key') || this.DEFAULT_API_KEY;
  }

  setApiKey(key: string) {
    localStorage.setItem('incha_autogopay_api_key', key);
  }

  isSoundEnabled(): boolean {
    const val = localStorage.getItem('incha_autogopay_sound_enabled');
    return val === null ? true : val === 'true';
  }

  setSoundEnabled(enabled: boolean) {
    localStorage.setItem('incha_autogopay_sound_enabled', enabled ? 'true' : 'false');
  }

  private loadSeenTransactions() {
    try {
      const stored = localStorage.getItem('incha_autogopay_seen_sns');
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          this.seenOrderSns = new Set(arr);
        }
      }
    } catch (e) {
      this.seenOrderSns = new Set();
    }
  }

  private saveSeenTransactions() {
    try {
      const arr = Array.from(this.seenOrderSns).slice(-100); // keep last 100
      localStorage.setItem('incha_autogopay_seen_sns', JSON.stringify(arr));
    } catch {}
  }

  onPaymentReceived(listener: (tx: AutoGoPayTransaction) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // Mulai memantau mutasi secara realtime
  startMonitoring(intervalMs: number = 5000) {
    if (this.pollingTimer) return;

    // Pertama kali panggil untuk seed transaksi yang sudah ada (agar tidak membunyikan transaksi lama)
    this.checkTransactions(true);

    this.pollingTimer = setInterval(() => {
      this.checkTransactions(false);
    }, intervalMs);
  }

  stopMonitoring() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  // Cek mutasi ke AutoGoPay
  async checkTransactions(isInitialSeed: boolean = false): Promise<AutoGoPayTransaction[]> {
    if (this.isPolling) return [];
    this.isPolling = true;

    try {
      const baseUrl = this.getBaseUrl();
      const apiKey = this.getApiKey();

      const response = await fetch(`${baseUrl}/shopeepay/transactions`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`AutoGoPay HTTP ${response.status}`);
      }

      const json = await response.json();
      if (!json.success || !json.data || !Array.isArray(json.data.transactions)) {
        return [];
      }

      const list: AutoGoPayTransaction[] = json.data.transactions;
      const newTransactions: AutoGoPayTransaction[] = [];

      for (const tx of list) {
        if (!tx.order_sn) continue;

        if (this.seenOrderSns.has(tx.order_sn)) {
          continue;
        }

        // Simpan sebagai sudah dilihat
        this.seenOrderSns.add(tx.order_sn);
        this.saveSeenTransactions();

        // Jika bukan inisialisasi awal dan uang masuk, trigger notifikasi suara!
        if (!isInitialSeed && tx.is_money_in && tx.amount > 0) {
          newTransactions.push(tx);
          if (this.isSoundEnabled()) {
            speakPaymentVoice(tx.amount);
          }
          this.listeners.forEach((l) => l(tx));
        }
      }

      return list;
    } catch (e: any) {
      console.warn('[AutoGoPay Poller] Error:', e.message);
      return [];
    } finally {
      this.isPolling = false;
    }
  }

  // Cek status koneksi ShopeePay di AutoGoPay
  async checkStatus(): Promise<{ connected: boolean; storeId?: string; message?: string }> {
    try {
      const baseUrl = this.getBaseUrl();
      const apiKey = this.getApiKey();

      const res = await fetch(`${baseUrl}/shopeepay/status`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
        },
      });

      const json = await res.json();
      if (json.success && json.data) {
        return {
          connected: json.data.connected === true,
          storeId: json.data.store_id || '24079601',
          message: json.message,
        };
      }
      return { connected: false, message: json.message };
    } catch (err: any) {
      return { connected: false, message: err.message };
    }
  }

  // Tes manual bunyi notifikasi suara
  testNotification(amount: number = 24000) {
    speakPaymentVoice(amount);
  }
}

export const qrisSoundService = new QrisSoundService();
