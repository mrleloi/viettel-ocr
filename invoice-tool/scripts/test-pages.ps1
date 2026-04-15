$pages = @(
  '/',
  '/upload',
  '/batches',
  '/review',
  '/schemas',
  '/mappings',
  '/products',
  '/exports',
  '/diagnostics'
)
foreach ($p in $pages) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:3001$p" -UseBasicParsing -TimeoutSec 30
    $hasError = ($r.Content -match 'Application error' -or $r.Content -match 'Error: ' -or $r.Content -match 'Cannot read' -or $r.Content -match 'undefined is not')
    $marker = if ($hasError) { 'ERR-IN-HTML' } else { 'OK' }
    Write-Host ("{0,-12} {1,-20} HTTP {2}  {3} bytes" -f $marker, $p, $r.StatusCode, $r.Content.Length)
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host ("{0,-12} {1,-20} HTTP {2}  {3}" -f 'ERR', $p, $code, $_.Exception.Message)
  }
}
