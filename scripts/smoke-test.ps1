# ============================================================
# smoke-test.ps1
# Starts the backend server and verifies it boots successfully.
# Exits 0 if server starts, 1 if it fails.
# Used by quality gates and session completion checks.
# ============================================================
param(
    [int]$TimeoutSeconds = 30,
    [int]$Port = 3000
)

$ErrorActionPreference = "Continue"
$root = "c:\htdocs\viettel-ocr"
$backendDir = "$root\invoice-tool\packages\backend"

Write-Host "[SMOKE TEST] Backend Smoke Test - starting server..." -ForegroundColor Cyan

# Kill any existing process on the port
$existingPid = (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
if ($existingPid) {
    Write-Host "  Killing existing process on port $Port (PID $existingPid)..." -ForegroundColor Yellow
    Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Start server in background using cmd.exe (npx is a .ps1 script, can't use Start-Process directly)
$logFile = "$root\invoice-tool\packages\backend\data\smoke-test.log"
$errFile = "$root\invoice-tool\packages\backend\data\smoke-test-err.log"
$process = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c cd /d `"$backendDir`" && npx ts-node -r tsconfig-paths/register src/main.ts" `
    -RedirectStandardOutput $logFile `
    -RedirectStandardError $errFile `
    -PassThru `
    -WindowStyle Hidden

Write-Host "  Server PID: $($process.Id)" -ForegroundColor Gray

# Wait for "successfully started" in output
$elapsed = 0
$success = $false
$interval = 2

while ($elapsed -lt $TimeoutSeconds) {
    Start-Sleep -Seconds $interval
    $elapsed += $interval

    # Check if process died
    if ($process.HasExited) {
        Write-Host "  FAIL: Server exited prematurely (code $($process.ExitCode))" -ForegroundColor Red
        
        # Show error output
        if (Test-Path $errFile) {
            $errContent = Get-Content $errFile -Raw -ErrorAction SilentlyContinue
            if ($errContent) {
                Write-Host "  Error output:" -ForegroundColor Red
                $errLines = $errContent -split "`n" | Where-Object { $_ -match "ERROR|Error|SQLITE" } | Select-Object -First 5
                foreach ($line in $errLines) {
                    Write-Host "    $($line.Trim())" -ForegroundColor DarkRed
                }
            }
        }
        if (Test-Path $logFile) {
            $logContent = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
            if ($logContent) {
                $errLines = $logContent -split "`n" | Where-Object { $_ -match "ERROR|Error|SQLITE|Exception" } | Select-Object -First 5
                foreach ($line in $errLines) {
                    Write-Host "    $($line.Trim())" -ForegroundColor DarkRed
                }
            }
        }
        break
    }

    # Check log for success message
    if (Test-Path $logFile) {
        $logContent = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
        if ($logContent -and $logContent -match "Nest application successfully started") {
            $success = $true
            Write-Host "  OK: Server started successfully (${elapsed}s)" -ForegroundColor Green
            break
        }
        # Check for DI error in stdout (NestJS logs errors to stdout)
        if ($logContent -and $logContent -match "ExceptionHandler") {
            Write-Host "  FAIL: NestJS error detected" -ForegroundColor Red
            $errLines = $logContent -split "`n" | Where-Object { $_ -match "ERROR|resolve|Exception" } | Select-Object -First 3
            foreach ($line in $errLines) {
                Write-Host "    $($line.Trim())" -ForegroundColor DarkRed
            }
            break
        }
    }
    
    Write-Host "  Waiting... (${elapsed}s / ${TimeoutSeconds}s)" -ForegroundColor Gray
}

# Cleanup: kill the server process tree
if (-not $process.HasExited) {
    # Kill process tree (cmd.exe spawns node child)
    $childProcesses = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $process.Id } -ErrorAction SilentlyContinue
    foreach ($child in $childProcesses) {
        Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    Write-Host "  Server stopped." -ForegroundColor Gray
}

# Clean up log files
Remove-Item $logFile -Force -ErrorAction SilentlyContinue
Remove-Item $errFile -Force -ErrorAction SilentlyContinue

if ($success) {
    Write-Host "[PASS] Smoke test PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[FAIL] Smoke test FAILED" -ForegroundColor Red
    exit 1
}
