$ErrorActionPreference = 'Continue'

# Reproduce the upload bug — autoCreateSchemaOnNewPattern as string 'true'
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$pdf = [System.IO.File]::ReadAllBytes('C:\htdocs\viettel-ocr\files\1_002_K26TDH_80321_8198.pdf')
$pdfB64 = [System.Convert]::ToBase64String($pdf)
$encoding = [System.Text.Encoding]::GetEncoding('iso-8859-1')

$bodyLines = @(
  "--$boundary",
  'Content-Disposition: form-data; name="files"; filename="test.pdf"',
  'Content-Type: application/pdf',
  '',
  $encoding.GetString($pdf),
  "--$boundary",
  'Content-Disposition: form-data; name="uploadMode"',
  '',
  'single_ncc',
  "--$boundary",
  'Content-Disposition: form-data; name="onDuplicate"',
  '',
  'process_anyway',
  "--$boundary",
  'Content-Disposition: form-data; name="autoCreateSchemaOnNewPattern"',
  '',
  'true',
  "--$boundary--",
  ''
) -join $LF

Write-Host "=== Reproducing upload bug ===" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/batches' -Method POST -UseBasicParsing -Body $bodyLines -ContentType "multipart/form-data; boundary=$boundary"
  Write-Host ("status={0}" -f $r.StatusCode) -ForegroundColor Green
  Write-Host $r.Content
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    Write-Host ("status={0}" -f [int]$resp.StatusCode) -ForegroundColor Red
    try {
      $stream = $resp.GetResponseStream()
      $sr = New-Object System.IO.StreamReader($stream)
      $body = $sr.ReadToEnd()
      Write-Host $body
    } catch { Write-Host ("could not read body: " + $_.Exception.Message) }
  } else {
    Write-Host ("EX: " + $_.Exception.Message) -ForegroundColor Red
  }
}
