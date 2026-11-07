import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService, MAX_FAILED_ATTEMPTS } from './authService';
import { OwnerAccount, UserRole } from '../types';

describe('Langkah 1: Pengujian Otentikasi Pemilik, Penguncian Akun, dan RLS', () => {
  let auth: AuthService;
  const fixedNow = new Date('2026-11-04T10:00:00.000Z');

  beforeEach(() => {
    auth = new AuthService();
  });

  describe('1. Verifikasi Dua Akun Pemilik & Larangan Pendaftaran Baru', () => {
    it('Sistem hanya memiliki tepat dua akun pemilik terdaftar', () => {
      const accounts = auth.getAccounts();
      expect(accounts.length).toBe(2);
      expect(accounts.map((a) => a.email)).toEqual([
        'inchatea303@gmail.com',
        'owner2@incha.id',
      ]);
    });

    it('Karyawan tidak memiliki akun untuk login ke website pemilik', () => {
      const accounts = auth.getAccounts();
      const nonOwners = accounts.filter((a) => a.role !== 'pemilik');
      expect(nonOwners.length).toBe(0);
    });
  });

  describe('2. Pengujian Login dan Penanganan Kesalahan', () => {
    it('Login berhasil dengan kredensial pemilik yang benar (Jayden)', () => {
      const res = auth.login('inchatea303@gmail.com', 'Incha2026!', fixedNow);
      expect(res.success).toBe(true);
      expect(res.owner?.name).toBe('Jayden');
      expect(res.owner?.failedAttempts).toBe(0);
    });

    it('Login gagal dengan email yang tidak terdaftar menghasilkan pesan error standar', () => {
      const res = auth.login('hacker@unknown.com', 'randomPass', fixedNow);
      expect(res.success).toBe(false);
      expect(res.error).toBe('Email atau password salah.');
    });

    it('Login gagal dengan password salah mencatat kenaikan jumlah percobaan gagal', () => {
      const res1 = auth.login('inchatea303@gmail.com', 'wrongPassword', fixedNow);
      expect(res1.success).toBe(false);
      expect(res1.error).toBe('Email atau password salah.');

      const accounts = auth.getAccounts();
      const acc = accounts.find((a) => a.email === 'inchatea303@gmail.com');
      expect(acc?.failedAttempts).toBe(1);
    });
  });

  describe('3. Pengujian Penguncian Akun Setelah 5 Kali Gagal (Brute Force Protection)', () => {
    it('Akun terkunci otomatis setelah 5 kali berturut-turut memasukkan password salah', () => {
      // 4x gagal pertama
      for (let i = 1; i <= 4; i++) {
        const res = auth.login('inchatea303@gmail.com', `wrong-${i}`, fixedNow);
        expect(res.success).toBe(false);
        expect(res.error).toBe('Email atau password salah.');
        expect(res.isLocked).toBeFalsy();
      }

      // Percobaan ke-5: harus langsung mengunci akun
      const res5 = auth.login('inchatea303@gmail.com', 'wrong-5', fixedNow);
      expect(res5.success).toBe(false);
      expect(res5.isLocked).toBe(true);
      expect(res5.error).toBe(
        'Akun dikunci sementara. Coba lagi dalam 15 menit.'
      );

      // Percobaan ke-6 (bahkan dengan password yang benar) tetap diblokir selama durasi 15 menit
      const attemptWhileLocked = auth.login(
        'inchatea303@gmail.com',
        'Incha2026!',
        new Date(fixedNow.getTime() + 5 * 60 * 1000) // 5 menit kemudian
      );
      expect(attemptWhileLocked.success).toBe(false);
      expect(attemptWhileLocked.isLocked).toBe(true);
      expect(attemptWhileLocked.error).toBe(
        'Akun dikunci sementara. Coba lagi dalam 15 menit.'
      );
    });

    it('Akun otomatis terbuka kembali setelah jeda 15 menit terlewati', () => {
      // Kunci akun dengan 5x salah
      for (let i = 1; i <= 5; i++) {
        auth.login('inchatea303@gmail.com', 'wrong', fixedNow);
      }

      // Coba login setelah 15 menit 1 detik (901.000 ms)
      const after15Minutes = new Date(fixedNow.getTime() + 15 * 60 * 1000 + 1000);
      const res = auth.login('inchatea303@gmail.com', 'Incha2026!', after15Minutes);

      expect(res.success).toBe(true);
      expect(res.owner?.failedAttempts).toBe(0);
      expect(res.owner?.lockedUntil).toBeNull();
    });
  });

  describe('4. Pengujian Kedaluwarsa Sesi (12 Jam Inactivity Timeout)', () => {
    it('Sesi tetap valid jika waktu tidak aktif masih di bawah 12 jam', () => {
      const lastActive = '2026-11-04T08:00:00.000Z';
      const checkTime = new Date('2026-11-04T18:00:00.000Z'); // 10 jam kemudian

      const session = auth.checkSession(lastActive, checkTime);
      expect(session.isValid).toBe(true);
    });

    it('Sesi berakhir dan mewajibkan masuk kembali jika melebihi 12 jam tidak aktif', () => {
      const lastActive = '2026-11-04T08:00:00.000Z';
      const checkTime = new Date('2026-11-04T20:30:00.000Z'); // 12 jam 30 menit kemudian

      const session = auth.checkSession(lastActive, checkTime);
      expect(session.isValid).toBe(false);
      expect(session.message).toBe('Sesi berakhir, silakan masuk lagi.');
    });
  });

  describe('5. Pengujian Fitur Lupa Password', () => {
    it('Mengirim tautan reset jika email terdaftar sebagai akun pemilik', () => {
      const res = auth.requestPasswordReset('owner1@incha.id');
      expect(res.success).toBe(true);
      expect(res.message).toBe(
        'Tautan pemulihan password telah dikirim ke email terdaftar.'
      );
    });

    it('Menolak permintaan lupa password untuk email yang tidak terdaftar', () => {
      const res = auth.requestPasswordReset('bukan.pemilik@gmail.com');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Email tidak terdaftar sebagai pemilik.');
    });
  });

  describe('6. Penegakan Row Level Security (RLS) - Akses Karyawan Ditolak Mutlak', () => {
    it('Akses web dashboard ditolak total untuk role karyawan', () => {
      const employeeAccess = auth.enforceWebAccess('karyawan');
      expect(employeeAccess.allowed).toBe(false);
      expect(employeeAccess.message).toContain(
        'Akses ditolak: Karyawan tidak memiliki izin'
      );
    });

    it('Akses web dashboard diizinkan untuk role pemilik', () => {
      const ownerAccess = auth.enforceWebAccess('pemilik');
      expect(ownerAccess.allowed).toBe(true);
    });
  });

  describe('7. Pengujian 2FA / Login dengan OTP ke Email Pemilik', () => {
    it('Membuat kode OTP 6 digit yang valid saat kredensial benar', () => {
      const otpRes = auth.requestLoginOtp('inchatea303@gmail.com', 'Incha2026!', fixedNow);
      expect(otpRes.success).toBe(true);
      expect(otpRes.otp).toBeDefined();
      expect(otpRes.otp?.length).toBe(6);
    });

    it('Verifikasi berhasil saat memasukkan kode OTP yang cocok', () => {
      const otpRes = auth.requestLoginOtp('inchatea303@gmail.com', 'Incha2026!', fixedNow);
      const verifyRes = auth.verifyLoginOtp('inchatea303@gmail.com', otpRes.otp!, fixedNow);
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.owner?.name).toBe('Jayden');
      expect(verifyRes.owner?.email).toBe('inchatea303@gmail.com');
    });

    it('Menolak kode OTP yang salah dan membatasi percobaan', () => {
      auth.requestLoginOtp('inchatea303@gmail.com', 'Incha2026!', fixedNow);
      const wrong1 = auth.verifyLoginOtp('inchatea303@gmail.com', '000000', fixedNow);
      expect(wrong1.success).toBe(false);
      expect(wrong1.error).toContain('Percobaan 1/3');
    });
  });
});
