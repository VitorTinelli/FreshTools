param()

$root = Split-Path -Parent $PSScriptRoot
$canonical = Join-Path $root "Chromium\vocaroo-upload.js"
$firefox = Join-Path $root "Firefox\vocaroo-upload.js"

if (-not (Test-Path -LiteralPath $canonical) -or -not (Test-Path -LiteralPath $firefox)) {
  throw "Os módulos Vocaroo não foram encontrados."
}

$difference = Compare-Object `
  (Get-Content -LiteralPath $canonical -Raw) `
  (Get-Content -LiteralPath $firefox -Raw)

if ($difference) {
  throw "Chromium/vocaroo-upload.js e Firefox/vocaroo-upload.js divergem. Atualize os dois juntos."
}

Write-Output "Módulos Vocaroo sincronizados."
