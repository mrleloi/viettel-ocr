$ErrorActionPreference = 'Continue'

Write-Host "=== Step 1: create schema ===" -ForegroundColor Cyan
$ts = (Get-Date -Format 'HHmmssff')
$body = @{
  name = ('Test Schema ' + $ts)
  nccName = ('Test NCC ' + $ts)
  nccTaxId = ('9' + $ts + '0').Substring(0, 10)
  description = 'auto'
} | ConvertTo-Json
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/schemas' -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing
  Write-Host ("status={0}" -f $r.StatusCode)
  Write-Host ("body={0}" -f $r.Content)
  $schema = $r.Content | ConvertFrom-Json
  Write-Host ("schemaId={0}" -f $schema.id) -ForegroundColor Green
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
    Write-Host ("status={0} body={1}" -f [int]$resp.StatusCode, $sr.ReadToEnd()) -ForegroundColor Red
  } else { Write-Host ("EX: " + $_.Exception.Message) -ForegroundColor Red }
  exit 1
}

Write-Host ""
Write-Host "=== Step 2: upload PDF to /preview ===" -ForegroundColor Cyan
$pdfPath = 'C:\htdocs\viettel-ocr\files\1_002_K26TDH_80321_8198.pdf'

# Build multipart manually
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"
$enc = [System.Text.Encoding]::GetEncoding('iso-8859-1')
$pdf = [System.IO.File]::ReadAllBytes($pdfPath)
$pdfStr = $enc.GetString($pdf)

$body = @(
  "--$boundary",
  'Content-Disposition: form-data; name="file"; filename="test.pdf"',
  'Content-Type: application/pdf',
  '',
  $pdfStr,
  "--$boundary--",
  ''
) -join $LF

try {
  $r = Invoke-WebRequest -Uri ("http://localhost:3000/api/schemas/{0}/preview" -f $schema.id) -Method POST -Body $body -ContentType "multipart/form-data; boundary=$boundary" -UseBasicParsing
  Write-Host ("status={0}" -f $r.StatusCode) -ForegroundColor Green
  if ($r.Content.Length -lt 800) { Write-Host $r.Content }
  else { Write-Host (($r.Content).Substring(0, 800) + ' ...') }
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    Write-Host ("status={0}" -f [int]$resp.StatusCode) -ForegroundColor Red
    try {
      $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
      Write-Host $sr.ReadToEnd()
    } catch {}
  } else { Write-Host ("EX: " + $_.Exception.Message) -ForegroundColor Red }
}
