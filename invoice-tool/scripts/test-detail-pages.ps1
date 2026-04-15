$urls = @(
  'http://localhost:3001/batches/30779a37-2a9f-4fd2-923a-a8c494c45d32',
  'http://localhost:3001/batches/6cc0deb3-b7c6-40b5-a652-4d167cd0a756',
  'http://localhost:3001/review/ffc44337-0394-433d-ab62-4a321b44a8bc'
)
foreach ($u in $urls) {
  try {
    $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 30
    Write-Host ("OK  HTTP {0}  {1,6} bytes  {2}" -f $r.StatusCode, $r.Content.Length, $u)
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host ("ERR HTTP {0}  {1}" -f $code, $u)
  }
}
