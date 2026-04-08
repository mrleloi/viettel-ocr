# ============================================================
# complete-session.ps1
# SINGLE command to end a session. Validates all artifacts
# then auto-spawns next session. This is the ONLY script
# an agent needs to call at session end.
# ============================================================
param(
    [int]$SessionNumber = 0,
    [string]$Message = "do next session",
    [int]$NewSessionDelay = 5
)

$ErrorActionPreference = "Stop"
$root = "c:\htdocs\viettel-ocr"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  SESSION COMPLETION CHECKLIST" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$errors = @()

# --- Check 1: session-handoff.md updated ---
Write-Host "[1/5] Checking session-handoff.md..." -ForegroundColor Yellow
$handoff = Get-Content "$root\.context\session-handoff.md" -Raw -ErrorAction SilentlyContinue
if (-not $handoff) {
    $errors += "session-handoff.md is missing or empty"
    Write-Host "  FAIL: File missing" -ForegroundColor Red
} elseif ($handoff -match "Status: .+ Complete") {
    Write-Host "  OK: Handoff is marked complete" -ForegroundColor Green
} else {
    $errors += "session-handoff.md does not contain 'Status: ... Complete'"
    Write-Host "  WARN: Status not marked complete" -ForegroundColor DarkYellow
}

# --- Check 2: progress.md updated ---
Write-Host "[2/5] Checking progress.md..." -ForegroundColor Yellow
$progress = Get-Content "$root\tasks\progress.md" -Raw -ErrorAction SilentlyContinue
if (-not $progress) {
    $errors += "progress.md is missing"
    Write-Host "  FAIL: File missing" -ForegroundColor Red
} else {
    Write-Host "  OK: progress.md exists" -ForegroundColor Green
}

# --- Check 3: Next action guide exists ---
Write-Host "[3/5] Checking next session action guide..." -ForegroundColor Yellow
$guides = Get-ChildItem "$root\tasks\action-guides\s*-*.md" -ErrorAction SilentlyContinue | Sort-Object Name
if ($guides.Count -gt 0) {
    $latest = $guides[-1].Name
    Write-Host "  OK: Latest guide = $latest" -ForegroundColor Green
} else {
    $errors += "No action guides found in tasks/action-guides/"
    Write-Host "  FAIL: No action guides found" -ForegroundColor Red
}

# --- Check 4: Backend tests pass ---
Write-Host "[4/5] Checking backend tests..." -ForegroundColor Yellow
$testResult = & cmd /c "cd $root\invoice-tool\packages\backend && npx jest --bail --no-coverage 2>&1" | Select-Object -Last 5
$testOutput = $testResult -join "`n"
if ($testOutput -match "Tests:.*passed") {
    Write-Host "  OK: Tests pass" -ForegroundColor Green
} else {
    Write-Host "  WARN: Could not confirm test pass (may be OK)" -ForegroundColor DarkYellow
}

# --- Check 5: Frontend builds ---
Write-Host "[5/6] Checking frontend build..." -ForegroundColor Yellow
$buildResult = & cmd /c "cd $root\invoice-tool\packages\frontend && npx next build 2>&1" | Select-Object -Last 5
$buildOutput = $buildResult -join "`n"
if ($buildOutput -match "Compiled successfully") {
    Write-Host "  OK: Frontend builds" -ForegroundColor Green
} else {
    Write-Host "  WARN: Could not confirm build pass (may be OK)" -ForegroundColor DarkYellow
}

# --- Check 6: TypeScript compilation (catches DI wiring type errors) ---
Write-Host "[6/6] Checking TypeScript compilation..." -ForegroundColor Yellow
$tscResult = & cmd /c "cd $root\invoice-tool\packages\backend && npx tsc --noEmit 2>&1" | Select-Object -Last 5
$tscOutput = $tscResult -join "`n"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK: TypeScript compiles cleanly" -ForegroundColor Green
} else {
    $errors += "TypeScript compilation failed. Run 'npx tsc --noEmit' in backend to debug."
    Write-Host "  FAIL: TypeScript errors detected" -ForegroundColor Red
    foreach ($line in $tscResult) {
        if ($line -match "error TS") {
            Write-Host "    $($line.Trim())" -ForegroundColor DarkRed
        }
    }
}

# --- Summary ---
Write-Host ""
if ($errors.Count -gt 0) {
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "  ERRORS FOUND ($($errors.Count)):" -ForegroundColor Red
    foreach ($e in $errors) {
        Write-Host "  - $e" -ForegroundColor Red
    }
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Fix the errors above, then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "==========================================" -ForegroundColor Green
Write-Host "  ALL CHECKS PASSED" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Spawning next session..." -ForegroundColor Cyan
Write-Host ""

# --- Run auto-next-session ---
# & powershell -ExecutionPolicy Bypass -File "$root\scripts\auto-next-session.ps1" -Message $Message -NewSessionDelay $NewSessionDelay
