@echo off
title INCHA POS - Server Lokal
cd /d "%~dp0"
echo ========================================================
echo   MENJALANKAN SERVER APLIKASI KASIR INCHA
echo ========================================================
echo.
echo Buka alamat Network yang muncul di Google Chrome HP Android
echo Pastikan HP dan Laptop terhubung ke WiFi yang sama.
echo.
npm run dev -- --host
pause
