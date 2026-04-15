$endpoints = @(
  '/api/health',
  '/api/batches',
  '/api/invoices',
  '/api/schemas',
  '/api/products',
  '/api/products/conflicts',
  '/api/mappings',
  '/api/notifications',
  '/api/notifications/unread-count'
)
foreach ($e in $endpoints) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000$e" -UseBasicParsing -TimeoutSec 5
    $body = $r.Content
    if ($body.Length -gt 120) { $body = $body.Substring(0,120) + '...' }
    Write-Host ("OK  {0,-42} {1}  {2}" -f $e, $r.StatusCode, $body)
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    $msg = $_.Exception.Message
    if ($msg.Length -gt 80) { $msg = $msg.Substring(0,80) }
    Write-Host ("ERR {0,-42} {1}  {2}" -f $e, $code, $msg)
  }
}
