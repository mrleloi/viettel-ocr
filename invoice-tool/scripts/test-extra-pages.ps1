$pages = @('/schemas/new', '/upload', '/notifications')
foreach ($p in $pages) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:3001$p" -UseBasicParsing -TimeoutSec 30
    Write-Host ("OK  {0,-20} HTTP {1}  {2} bytes" -f $p, $r.StatusCode, $r.Content.Length)
  } catch {
    Write-Host ("ERR {0,-20} HTTP {1}" -f $p, $_.Exception.Response.StatusCode.value__)
  }
}
