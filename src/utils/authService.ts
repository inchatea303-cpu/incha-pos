import { OwnerAccount, UserRole } from '../types';
import { INITIAL_OWNER_ACCOUNTS } from '../database/seedData';

export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 menit
export const SESSION_INACTIVITY_LIMIT_MS = 12 * 60 * 60 * 1000; // 12 jam
export const MAX_FAILED_ATTEMPTS = 5;

export interface LoginResult {
  success: boolean;
  error?: string;
  isLocked?: boolean;
  owner?: OwnerAccount;
}

export class AuthService {
  private accounts: OwnerAccount[];

  constructor(initialAccounts: OwnerAccount[] = INITIAL_OWNER_ACCOUNTS) {
    this.accounts = initialAccounts.map((acc) => ({ ...acc }));
  }

  getAccounts(): OwnerAccount[] {
    return this.accounts;
  }

  // Login handler dengan aturan ketat: 5x gagal -> kunci 15 menit
  login(
    email: string,
    password: string,
    now: Date = new Date()
  ): LoginResult {
    const trimmedEmail = email.trim().toLowerCase();
    const account = this.accounts.find(
      (acc) => acc.email.toLowerCase() === trimmedEmail
    );

    if (!account) {
      return {
        success: false,
        error: 'Email atau password salah.',
      };
    }

    // Cek apakah akun sedang dalam periode terkunci
    if (account.lockedUntil) {
      const lockedUntilTime = new Date(account.lockedUntil).getTime();
      if (now.getTime() < lockedUntilTime) {
        return {
          success: false,
          error: 'Akun dikunci sementara. Coba lagi dalam 15 menit.',
          isLocked: true,
        };
      } else {
        // Durasi kunci 15 menit telah terlewati, otomatis buka kunci
        account.lockedUntil = null;
        account.failedAttempts = 0;
      }
    }

    // Verifikasi password
    if (account.passwordHash !== password) {
      account.failedAttempts += 1;

      if (account.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        account.lockedUntil = new Date(
          now.getTime() + LOCKOUT_DURATION_MS
        ).toISOString();
        return {
          success: false,
          error: 'Akun dikunci sementara. Coba lagi dalam 15 menit.',
          isLocked: true,
        };
      }

      return {
        success: false,
        error: 'Email atau password salah.',
      };
    }

    // Password benar: reset percobaan gagal dan update waktu aktif
    account.failedAttempts = 0;
    account.lockedUntil = null;
    account.lastActiveAt = now.toISOString();

    return {
      success: true,
      owner: { ...account },
    };
  }

  // Pengecekan sesi: Kedaluwarsa jika tidak aktif lebih dari 12 jam
  checkSession(
    lastActiveAtStr: string,
    now: Date = new Date()
  ): { isValid: boolean; message?: string } {
    const lastActive = new Date(lastActiveAtStr).getTime();
    const diffMs = now.getTime() - lastActive;

    if (diffMs > SESSION_INACTIVITY_LIMIT_MS) {
      return {
        isValid: false,
        message: 'Sesi berakhir, silakan masuk lagi.',
      };
    }

    return { isValid: true };
  }

  // Lupa Password: hanya kirim ke email terdaftar pemilik
  requestPasswordReset(
    email: string
  ): { success: boolean; message: string } {
    const trimmed = email.trim().toLowerCase();
    const exists = this.accounts.some(
      (acc) => acc.email.toLowerCase() === trimmed
    );

    if (!exists) {
      return {
        success: false,
        message: 'Email tidak terdaftar sebagai pemilik.',
      };
    }

    return {
      success: true,
      message: 'Tautan pemulihan password telah dikirim ke email terdaftar.',
    };
  }

  // Ganti password akun pemilik yang sedang login
  changePassword(
    ownerId: string,
    oldPass: string,
    newPass: string
  ): { success: boolean; message: string } {
    const acc = this.accounts.find((a) => a.id === ownerId);
    if (!acc) {
      return { success: false, message: 'Akun tidak ditemukan.' };
    }

    if (acc.passwordHash !== oldPass) {
      return { success: false, message: 'Password saat ini salah.' };
    }

    if (!newPass || newPass.length < 6) {
      return {
        success: false,
        message: 'Password baru minimal harus 6 karakter.',
      };
    }

    acc.passwordHash = newPass;
    return { success: true, message: 'Password berhasil diubah.' };
  }

  // Enforce RLS akses web dashboard: Karyawan ditolak mutlak
  enforceWebAccess(role: UserRole): { allowed: boolean; message?: string } {
    if (role !== 'pemilik') {
      return {
        allowed: false,
        message:
          'Akses ditolak: Karyawan tidak memiliki izin mengakses website pemilik.',
      };
    }
    return { allowed: true };
  }
}

export const authService = new AuthService();
