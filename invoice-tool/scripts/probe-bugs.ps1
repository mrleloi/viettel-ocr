$ErrorActionPreference = 'Continue'

function Probe($name, $url, $method = 'GET', $body = $null) {
  Write-Host ("--- {0} {1} {2}" -f $method, $name, $url) -ForegroundColor Cyan
  try {
    if ($body) {
      $r = Invoke-WebRequest -Uri $url -Method $method -UseBasicParsing -Body $body -ContentType 'application/json'
    } else {
      $r = Invoke-WebRequest -Uri $url -Method $method -UseBasicParsing
    }
    Write-Host ("status={0}" -f $r.StatusCode) -ForegroundColor Green
    if ($r.Content.Length -lt 600) { Write-Host $r.Content }
    else { Write-Host (($r.Content).Substring(0, 600) + ' ...') }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      Write-Host ("status={0}" -f [int]$resp.StatusCode) -ForegroundColor Red
      try {
        $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
        Write-Host $sr.ReadToEnd()
      } catch {}
    } else {
      Write-Host ("EX: {0}" -f $_.Exception.Message) -ForegroundColor Red
    }
  }
  Write-Host ""
}

Probe 'list products' 'http://localhost:3000/api/products'
Probe 'list schemas' 'http://localhost:3000/api/schemas'
Probe 'list batches' 'http://localhost:3000/api/batches'
Probe 'product sync' 'http://localhost:3000/api/products/sync' POST '{}'
Probe 'list invoices' 'http://localhost:3000/api/invoices'
