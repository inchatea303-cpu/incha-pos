@echo off
title Push INCHA POS ke GitHub
cd /d "%~dp0"
echo ========================================================
echo          PUSH KODE INCHA POS KE GITHUB
echo ========================================================
echo.
git push -u origin main
echo.
pause
