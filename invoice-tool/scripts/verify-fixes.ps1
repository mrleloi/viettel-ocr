$ErrorActionPreference = 'Continue'

Write-Host "=== /api/notifications (Bug #3 fix) ===" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/notifications' -UseBasicParsing
  Write-Host ("status={0}" -f $r.StatusCode)
  $body = $r.Content | ConvertFrom-Json
  Write-Host ("notifications count={0}" -f $body.notifications.Length)
  Write-Host ("unreadCount={0}" -f $body.unreadCount)
} catch {
  Write-Host "FAIL: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== /api/api/notifications (should now 404) ===" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/api/notifications' -UseBasicParsing
  Write-Host ("UNEXPECTED: status={0}" -f $r.StatusCode) -ForegroundColor Red
} catch {
  Write-Host ("OK: 404 (double-prefix gone)") -ForegroundColor Green
}

Write-Host ""
Write-Host "=== /api/invoices (validation shape regression check) ===" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/invoices' -UseBasicParsing
  Write-Host ("status={0}" -f $r.StatusCode)
  $body = $r.Content | ConvertFrom-Json
  Write-Host ("invoice count={0}" -f $body.Length)
  if ($body.Length -gt 0) {
    $first = $body[0]
    Write-Host ("first invoice id={0} status={1}" -f $first.id, $first.status)
  }
} catch {
  Write-Host "FAIL: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Frontend pages reachable ===" -ForegroundColor Cyan
$pages = @('/', '/upload', '/review', '/schemas', '/products', '/mappings', '/exports', '/diagnostics', '/products/conflicts', '/schemas/new')
foreach ($p in $pages) {
  try {
    $r = Invoke-WebRequest -Uri ("http://localhost:3001{0}" -f $p) -UseBasicParsing
    Write-Host ("  {0} -> {1}" -f $p, $r.StatusCode)
  } catch {
    Write-Host ("  {0} -> FAIL" -f $p) -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "=== Mock product sync (Bug #1 fix) ===" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/products/sync' -Method POST -UseBasicParsing -Body '{}' -ContentType 'application/json'
  Write-Host ("status={0}" -f $r.StatusCode)
  Write-Host $r.Content
} catch {
  Write-Host "FAIL: $_" -ForegroundColor Red
}
