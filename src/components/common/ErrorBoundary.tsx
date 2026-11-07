import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught React Error:', error, errorInfo);
  }

  private handleResetCache = async () => {
    try {
      // Bersihkan service worker dan cache browser
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          await caches.delete(key);
        }
      }
      // Bersihkan cache app_mode jika ada konflik
      localStorage.removeItem('incha_app_mode');
    } catch (e) {
      console.warn('Gagal membersihkan cache:', e);
    }
    // Muat ulang dari server (bypass cache)
    window.location.href = window.location.origin;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF8F4] flex flex-col items-center justify-center p-6 font-sans select-none text-[#1B2A5C]">
          <div className="w-full max-w-md bg-white rounded-xl border border-[#E6E9F2] p-8 text-center space-y-4 shadow-none">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1B2A5C] text-white font-bold text-xl mb-1">
              IN
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-[#1B2A5C]">
              Pembaruan Sistem INCHA
            </h1>
            <p className="text-xs text-[#5B6478] leading-relaxed">
              Aplikasi telah diperbarui dengan versi terbaru. Silakan klik tombol di bawah untuk memuat ulang antarmuka yang bersih.
            </p>

            {this.state.error && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-left text-[11px] text-[#D7262E] font-mono overflow-auto max-h-24">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <button
              type="button"
              onClick={this.handleResetCache}
              className="w-full h-11 bg-[#1B2A5C] hover:bg-[#243775] text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-all duration-150"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Segarkan Antarmuka Sekarang</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
