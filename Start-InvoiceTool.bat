@echo off
REM ============================================================
REM  Viettel Invoice Tool - One-click launcher for Windows
REM  Uses goto-style flow to survive paths with spaces/parens.
REM ============================================================

chcp 65001 >nul
title Viettel Invoice Tool
setlocal enableextensions

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "APP_DIR=%ROOT%\invoice-tool"
set "BUNDLED_NODE=%ROOT%\tools\node-v22"

echo.
echo ============================================================
echo   VIETTEL INVOICE TOOL - Khoi dong ung dung
echo ============================================================
echo.
echo [INFO] ROOT = %ROOT%
echo [INFO] APP_DIR = %APP_DIR%
echo.

if not exist "%APP_DIR%" goto errAppDir
cd /d "%APP_DIR%"

REM --- Pick Node runtime: bundled first, system second ---
if exist "%BUNDLED_NODE%\node.exe" goto useBundled
goto useSystem

:useBundled
set "PATH=%BUNDLED_NODE%;%PATH%"
echo [OK] Dang dung Node bundled: %BUNDLED_NODE%
goto nodeReady

:useSystem
where node >nul 2>&1
if errorlevel 1 goto errNoNode
echo [!] Khong tim thay Node bundled. Dung Node he thong.
goto nodeReady

:nodeReady
for /f "tokens=*" %%v in ('node -v') do set "NODE_VERSION=%%v"
echo [OK] Node.js %NODE_VERSION%

echo %NODE_VERSION% | findstr /b /c:"v22" >nul
if errorlevel 1 goto warnWrongNode
goto checkConfig

:warnWrongNode
echo.
echo [CANH BAO] Khong phai Node v22. Native module co the loi.
echo            Giai nen Node v22 portable vao: %BUNDLED_NODE%\
echo.

:checkConfig
if exist "config.env" goto checkNodeModules
echo.
echo [!] Chua co config.env. Dang chay setup lan dau...
call npm run setup
if errorlevel 1 goto errSetup

:checkNodeModules
if exist "node_modules" goto launch
echo.
echo [!] Chua co node_modules. Dang npm install...
call npm install
if errorlevel 1 goto errInstall

:launch
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

start "" /b cmd /c "timeout /t 20 /nobreak >nul && start http://localhost:8888"
call npm start

echo.
echo ============================================================
echo   Ung dung da dung.
echo ============================================================
pause
goto end

:errAppDir
echo [LOI] Khong tim thay thu muc: %APP_DIR%
echo       Kiem tra xem file .bat co nam o thu muc goc du an khong.
pause
goto end

:errNoNode
echo [LOI] Khong tim thay Node.js.
echo.
echo       Cach fix:
echo       1. Tai Node v22 portable: https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip
echo       2. Giai nen, doi ten folder thanh: node-v22
echo       3. Dat folder do vao: %ROOT%\tools\node-v22\
echo       4. Kiem tra co file: %BUNDLED_NODE%\node.exe
echo.
pause
goto end

:errSetup
echo.
echo [LOI] npm run setup that bai. Xem thong bao loi o tren.
pause
goto end

:errInstall
echo.
echo [LOI] npm install that bai. Xem thong bao loi o tren.
pause
goto end

:end
endlocal
