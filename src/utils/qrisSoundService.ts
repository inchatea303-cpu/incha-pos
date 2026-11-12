/**
 * QRIS Sound & Payment Gateway Notifier (AutoGoPay Integration)
 * Menghubungkan AutoGoPay (ShopeePay / GoPay QRIS) ke tablet INCHA POS
 * Mengeluarkan suara notifikasi & lonceng secara otomatis saat ada uang masuk
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';

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

// Shared AudioContext dengan auto-resume untuk Android/Tablet
let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch (e) {
    return null;
  }
}

// Global unlock listener pada interaksi pertama layar tablet
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    getAudioContext();
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.resume();
      } catch {}
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('pointerdown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
}

// Nada lonceng digital merdu (3-tone chime: C5 -> E5 -> G5)
export function playPaymentChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [
      { freq: 523.25, start: now, dur: 0.35, gain: 0.3 },
      { freq: 659.25, start: now + 0.12, dur: 0.38, gain: 0.35 },
      { freq: 783.99, start: now + 0.24, dur: 0.65, gain: 0.4 },
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

function fallbackSpeechSynthesis(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find((v) => v.lang.toLowerCase().includes('id'));
    if (idVoice) {
      utterance.voice = idVoice;
    }
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('[Fallback TTS error]:', e);
  }
}

// Ucapkan suara manusia asli bahasa Indonesia (Natural Human Voice MP3)
export function speakPaymentVoice(amount: number): void {
  // 1. Bunyikan nada lonceng
  playPaymentChime();

  const nominalText = terbilangRupiah(amount);
  const fullText = `Pembayaran ShopeePay QRIS sebesar ${nominalText} telah diterima`;

  if (typeof window === 'undefined') return;

  // 2. Putar suara manusia wanita bahasa Indonesia yang jernih via Google Audio Stream
  setTimeout(() => {
    try {
      const isLocal = window.location.hostname === 'localhost';
      const proxyBase = isLocal ? '' : 'https://incha-pos.vercel.app';
      const ttsUrl = `${proxyBase}/api/tts?text=${encodeURIComponent(fullText)}`;

      const audio = new Audio(ttsUrl);
      audio.volume = 1.0;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[Natural Voice Error, trying direct Google TTS]:', err);
          const directUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encodeURIComponent(fullText)}`;
          const directAudio = new Audio(directUrl);
          directAudio.volume = 1.0;
          directAudio.play().catch(() => {
            fallbackSpeechSynthesis(fullText);
          });
        });
      }
    } catch (e) {
      console.warn('[Natural Voice Exception]:', e);
      fallbackSpeechSynthesis(fullText);
    }
  }, 400);
}

// Universal fetch: Mengatasi CORS browser via Vercel proxy atau CapacitorHttp di Android
async function fetchAutoGoPay(endpoint: string, apiKey: string): Promise<any> {
  // 1. Android Native Capacitor: Menggunakan CapacitorHttp (bebas hambatan CORS)
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.get({
        url: `https://v1-gateway.autogopay.site/${endpoint}`,
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
        },
      });
      return res.data;
    } catch (e) {
      console.warn('[CapacitorHttp] Fallback to web proxy:', e);
    }
  }

  // 2. Web / Browser: Menggunakan serverless proxy Vercel untuk melewati CORS
  try {
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const proxyBase = isLocal ? '' : 'https://incha-pos.vercel.app';
    const proxyUrl = `${proxyBase}/api/autogopay?endpoint=${encodeURIComponent(endpoint)}&apiKey=${encodeURIComponent(apiKey)}`;

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn('[Proxy Fetch] Proxy error, attempting direct fetch:', e);
  }

  // 3. Direct fetch fallback
  const directRes = await fetch(`https://v1-gateway.autogopay.site/${endpoint}`, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'Accept': 'application/json',
    },
  });
  return await directRes.json();
}

class QrisSoundService {
  private pollingTimer: any = null;
  private isPolling = false;
  private seenOrderSns = new Set<string>();
  private hasSeeded = false;
  private listeners: Array<(tx: AutoGoPayTransaction) => void> = [];
  private lastKnownTransactions: AutoGoPayTransaction[] = [];

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

  getLastTransactions(): AutoGoPayTransaction[] {
    return this.lastKnownTransactions;
  }

  private loadSeenTransactions() {
    try {
      const stored = localStorage.getItem('incha_autogopay_seen_sns');
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr) && arr.length > 0) {
          this.seenOrderSns = new Set(arr);
          this.hasSeeded = true;
        }
      }
    } catch (e) {
      this.seenOrderSns = new Set();
    }
  }

  private saveSeenTransactions() {
    try {
      const arr = Array.from(this.seenOrderSns).slice(-150);
      localStorage.setItem('incha_autogopay_seen_sns', JSON.stringify(arr));
    } catch {}
  }

  onPaymentReceived(listener: (tx: AutoGoPayTransaction) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  startMonitoring(intervalMs: number = 4000) {
    if (this.pollingTimer) return;

    // Cek langsung saat monitoring dimulai
    this.checkTransactions();

    this.pollingTimer = setInterval(() => {
      this.checkTransactions();
    }, intervalMs);
  }

  stopMonitoring() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  // Cek mutasi ke AutoGoPay
  async checkTransactions(): Promise<AutoGoPayTransaction[]> {
    if (this.isPolling) return this.lastKnownTransactions;
    this.isPolling = true;

    try {
      const apiKey = this.getApiKey();
      const json = await fetchAutoGoPay('shopeepay/transactions', apiKey);

      if (!json || !json.success || !json.data || !Array.isArray(json.data.transactions)) {
        return this.lastKnownTransactions;
      }

      const list: AutoGoPayTransaction[] = json.data.transactions;
      this.lastKnownTransactions = list;

      // Jika benar-benar pertama kali membuka app (seen set kosong), tandai riwayat lama
      const isFirstSeed = !this.hasSeeded && this.seenOrderSns.size === 0;

      for (const tx of list) {
        if (!tx.order_sn) continue;

        if (this.seenOrderSns.has(tx.order_sn)) {
          continue;
        }

        // Tandai sebagai sudah dilihat
        this.seenOrderSns.add(tx.order_sn);
        this.saveSeenTransactions();

        // Jika bukan cold startup dan merupakan uang masuk: BUNYIKAN SUARA!
        if (!isFirstSeed && tx.is_money_in && tx.amount > 0) {
          if (this.isSoundEnabled()) {
            speakPaymentVoice(tx.amount);
          }
          this.listeners.forEach((l) => l(tx));
        }
      }

      this.hasSeeded = true;
      return list;
    } catch (e: any) {
      console.warn('[AutoGoPay Poller] Error:', e.message);
      return this.lastKnownTransactions;
    } finally {
      this.isPolling = false;
    }
  }

  async checkStatus(): Promise<{ connected: boolean; storeId?: string; message?: string }> {
    try {
      const apiKey = this.getApiKey();
      const json = await fetchAutoGoPay('shopeepay/status', apiKey);
      if (json && json.success && json.data) {
        return {
          connected: json.data.connected === true,
          storeId: json.data.store_id || '24079601',
          message: json.message,
        };
      }
      return { connected: false, message: json?.message };
    } catch (err: any) {
      return { connected: false, message: err.message };
    }
  }

  // Tes manual bunyi notifikasi suara
  testNotification(amount: number = 24000) {
    speakPaymentVoice(amount);
  }

  // Bunyikan transaksi mutasi terakhir yang tercatat
  speakLatestTransaction(): boolean {
    const latest = this.lastKnownTransactions.find((tx) => tx.is_money_in && tx.amount > 0);
    if (latest) {
      speakPaymentVoice(latest.amount);
      return true;
    }
    return false;
  }
}

export const qrisSoundService = new QrisSoundService();
