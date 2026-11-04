@echo off
title Deploy INCHA POS ke Vercel (Online)
cd /d "%~dp0"
echo ========================================================
echo       MENG-ONLINE-KAN APLIKASI KASIR INCHA KE VERCEL
echo ========================================================
echo.
echo Langkah ini akan mengunggah aplikasi ke Cloud Vercel.
echo Jika browser terbuka, silakan klik 'Verify' / Konfirmasi Login.
echo.
echo Untuk semua pertanyaan di bawah, cukup tekan ENTER (default).
echo.
npx vercel --prod
pause
