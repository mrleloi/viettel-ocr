# ============================================================
# auto-next-session.ps1
# Automatically opens a new Antigravity session and prompts it
# Uses Ctrl+Shift+L to open a new session directly
# ============================================================
param(
    [string]$Message = "do next session",
    [int]$NewSessionDelay = 5,  # seconds to wait after opening new session
    [int]$TypeDelay = 500        # ms to wait after typing
)

# --- Win32 API for window management ---
Add-Type @"
using System;
using System.Runtime.InteropServices;

public class WinAPI {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    public const int SW_RESTORE = 9;
    public const int SW_SHOW = 5;
}
"@

Add-Type -AssemblyName System.Windows.Forms

Write-Host "=== Antigravity Auto Next Session ===" -ForegroundColor Cyan
Write-Host "Message: $Message"
Write-Host "Shortcut: Ctrl+Shift+L (new session)"
Write-Host ""

# --- Step 1: Find Antigravity window ---
Write-Host "[1/4] Finding Antigravity window..." -ForegroundColor Yellow
$proc = Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
    Select-Object -First 1

if (-not $proc) {
    Write-Host "ERROR: Antigravity window not found! Is the app running?" -ForegroundColor Red
    exit 1
}

Write-Host "  Found: PID=$($proc.Id) Title='$($proc.MainWindowTitle)'" -ForegroundColor Green
$hwnd = $proc.MainWindowHandle

# --- Step 2: Focus Antigravity window ---
Write-Host "[2/4] Focusing Antigravity window..." -ForegroundColor Yellow
[WinAPI]::ShowWindow($hwnd, 9) | Out-Null   # Restore if minimized
Start-Sleep -Milliseconds 300
[WinAPI]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 500

# Verify focus
$fg = [WinAPI]::GetForegroundWindow()
if ($fg -ne $hwnd) {
    Write-Host "  WARNING: Window may not be focused. Retrying..." -ForegroundColor DarkYellow
    [WinAPI]::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 500
}
Write-Host "  Window focused." -ForegroundColor Green

# --- Step 3: Open new session with Ctrl+Shift+L ---
Write-Host "[3/4] Opening new session (Ctrl+Shift+L)..." -ForegroundColor Yellow
[System.Windows.Forms.SendKeys]::SendWait("^+l")
Write-Host "  Waiting ${NewSessionDelay}s for session to initialize..." -ForegroundColor DarkGray
Start-Sleep -Seconds $NewSessionDelay

# --- Step 4: Type the message and submit ---
Write-Host "[4/4] Typing message and submitting..." -ForegroundColor Yellow

# Type the message character by character for reliability
foreach ($char in $Message.ToCharArray()) {
    # SendKeys special chars need escaping: + ^ % ~ { } [ ] ( )
    $escaped = switch ($char) {
        '+' { '{+}' }
        '^' { '{^}' }
        '%' { '{%}' }
        '~' { '{~}' }
        '(' { '{(}' }
        ')' { '{)}' }
        '{' { '{{}' }
        '}' { '{}}' }
        '[' { '{[}' }
        ']' { '{]}' }
        default { $char.ToString() }
    }
    [System.Windows.Forms.SendKeys]::SendWait($escaped)
    Start-Sleep -Milliseconds 30
}

Start-Sleep -Milliseconds $TypeDelay

# Press Enter to submit
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

Write-Host ""
Write-Host "=== Done! New session created and prompted. ===" -ForegroundColor Green
Write-Host "Message sent: '$Message'" -ForegroundColor Cyan
