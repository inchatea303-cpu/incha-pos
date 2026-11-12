import { describe, it, expect } from 'vitest';
import { terbilangRupiah } from './qrisSoundService';

describe('terbilangRupiah', () => {
  it('converts single digit and zero correctly', () => {
    expect(terbilangRupiah(0)).toBe('nol rupiah');
    expect(terbilangRupiah(5)).toBe('lima rupiah');
    expect(terbilangRupiah(11)).toBe('sebelas rupiah');
  });

  it('converts tens and hundreds', () => {
    expect(terbilangRupiah(25)).toBe('dua puluh lima rupiah');
    expect(terbilangRupiah(100)).toBe('seratus rupiah');
    expect(terbilangRupiah(150)).toBe('seratus lima puluh rupiah');
  });

  it('converts thousands and beverage price points', () => {
    expect(terbilangRupiah(1000)).toBe('seribu rupiah');
    expect(terbilangRupiah(8000)).toBe('delapan ribu rupiah');
    expect(terbilangRupiah(15000)).toBe('lima belas ribu rupiah');
    expect(terbilangRupiah(24000)).toBe('dua puluh empat ribu rupiah');
    expect(terbilangRupiah(50000)).toBe('lima puluh ribu rupiah');
  });

  it('converts millions and above', () => {
    expect(terbilangRupiah(1000000)).toBe('satu juta rupiah');
    expect(terbilangRupiah(1250000)).toBe('satu juta dua ratus lima puluh ribu rupiah');
  });
});
