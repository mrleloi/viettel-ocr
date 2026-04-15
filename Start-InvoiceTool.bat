@echo off
REM ============================================================
REM  Viettel Invoice Tool - One-click launcher for Windows
REM  Double-click this file to start the app.
REM ============================================================

chcp 65001 >nul
title Viettel Invoice Tool
cd /d "%~dp0invoice-tool"

echo.
echo ============================================================
echo   VIETTEL INVOICE TOOL - Khoi dong ung dung
echo ============================================================
echo.

REM --- Check Node.js ---
where node >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Node.js.
    echo       Vui long cai dat Node.js 20 tro len tu: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo [OK] Node.js %NODE_VERSION%

REM --- Check config.env; run setup if missing ---
if not exist "config.env" (
    echo.
    echo [!] Chua cau hinh. Dang chay setup lan dau...
    echo     Viec nay co the mat vai phut.
    echo.
    call npm run setup
    if errorlevel 1 (
        echo.
        echo [LOI] Setup that bai. Vui long xem thong bao o tren.
        pause
        exit /b 1
    )
)

REM --- Check node_modules; install if missing ---
if not exist "node_modules" (
    echo.
    echo [!] Chua cai dependencies. Dang cai dat...
    call npm install
    if errorlevel 1 (
        echo.
        echo [LOI] npm install that bai.
        pause
        exit /b 1
    )
)

echo.
echo ============================================================
echo   Dang khoi dong cac dich vu...
echo   - Backend:  http://localhost:8889
echo   - Frontend: http://localhost:8888
echo   - Mock API: http://localhost:8887
echo.
echo   Trinh duyet se tu mo sau khoang 20 giay.
echo   De dung ung dung: nhan Ctrl+C hoac dong cua so nay.
echo ============================================================
echo.

REM --- Open browser in background after 20s (gives frontend time to compile) ---
start "" /b cmd /c "timeout /t 20 /nobreak >nul && start http://localhost:8888"

REM --- Launch app (blocks this window until Ctrl+C) ---
call npm start

echo.
echo ============================================================
echo   Ung dung da dung.
echo ============================================================
pause
