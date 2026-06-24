# Downloads the Play Store upload keystore from the old saritha-farming Expo project,
# then writes credentials.json for local EAS production builds.
#
# Prerequisites:
#   - You can log in to the OLD Expo account (saritha-farming), not cropvibe-farming.
#   - Run from mobile/:  powershell -ExecutionPolicy Bypass -File scripts/import-playstore-keystore.ps1
#
# After this script completes:
#   npm run build:android:prod

$ErrorActionPreference = "Stop"
$MobileRoot = Split-Path -Parent $PSScriptRoot
$AppJsonPath = Join-Path $MobileRoot "app.json"
$KeystoreDir = Join-Path $MobileRoot "android\keystores"
$KeystorePath = Join-Path $KeystoreDir "playstore-upload.jks"
$CredentialsPath = Join-Path $MobileRoot "credentials.json"
$BackupPath = Join-Path $MobileRoot "app.json.bak-saritha-import"

function Invoke-Eas {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = & eas @Args 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  if ($code -ne 0) { throw "eas $($Args -join ' ') failed (exit $code): $output" }
  return ($output | Out-String)
}

$OldOwner = "saritha-farming"
$OldProjectId = "b0f1e9b2-87d3-45e5-8925-7d531ca96ebe"
$NewOwner = "cropvibe-farming"
$NewProjectId = "d7965c57-28e1-45c1-b0dc-1220030a389f"

Write-Host ""
Write-Host "=== Import Play Store keystore from saritha-farming ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Step 1: Log in to the OLD Expo account (saritha-farming)."
Write-Host "        Use the email/password for saritha-farming, NOT info@cropvibe.com."
Write-Host ""
Invoke-Eas logout | Out-Null
Invoke-Eas login | Out-Null
Write-Host ""
$whoami = Invoke-Eas whoami
Write-Host $whoami
if ($whoami -notmatch "saritha-farming") {
  Write-Host "ERROR: saritha-farming is not in your logged-in accounts." -ForegroundColor Red
  Write-Host "       Log in with the account that built the first Play Store AAB."
  exit 1
}

if (-not (Test-Path $BackupPath)) {
  Copy-Item $AppJsonPath $BackupPath
}

$app = Get-Content $AppJsonPath -Raw | ConvertFrom-Json
$app.expo.owner = $OldOwner
if (-not $app.expo.extra) { $app.expo | Add-Member -NotePropertyName extra -NotePropertyValue (@{}) }
if (-not $app.expo.extra.eas) { $app.expo.extra | Add-Member -NotePropertyName eas -NotePropertyValue (@{}) }
$app.expo.extra.eas.projectId = $OldProjectId
$app | ConvertTo-Json -Depth 20 | Set-Content $AppJsonPath

Write-Host ""
Write-Host "Step 2: Download credentials from saritha-farming/agrovibes."
Write-Host "        In the interactive menu choose:"
Write-Host "          Android -> production ->"
Write-Host "          Credentials.json: Upload/Download ->"
Write-Host "          Download credentials from EAS to credentials.json"
Write-Host ""
Set-Location $MobileRoot
Write-Host "Running: eas credentials -p android" -ForegroundColor Yellow
Write-Host "Interactive: production -> Download existing keystore -> Y" -ForegroundColor Yellow
Invoke-Eas credentials -p android | Out-Null

if (-not (Test-Path $CredentialsPath)) {
  Write-Host "ERROR: credentials.json was not created." -ForegroundColor Red
  Copy-Item $BackupPath $AppJsonPath -Force
  exit 1
}

$creds = Get-Content $CredentialsPath -Raw | ConvertFrom-Json
$srcKeystore = Join-Path $MobileRoot ($creds.android.keystore.keystorePath -replace "/", "\")
if (-not (Test-Path $srcKeystore)) {
  Write-Host "ERROR: Keystore not found at $($creds.android.keystore.keystorePath)" -ForegroundColor Red
  Copy-Item $BackupPath $AppJsonPath -Force
  exit 1
}

New-Item -ItemType Directory -Force -Path $KeystoreDir | Out-Null
Copy-Item $srcKeystore $KeystorePath -Force
$creds.android.keystore.keystorePath = "android/keystores/playstore-upload.jks"
$creds | ConvertTo-Json -Depth 10 | Set-Content $CredentialsPath

Write-Host ""
Write-Host "Keystore saved to: $KeystorePath" -ForegroundColor Green

Write-Host ""
Write-Host "Step 3: Switch back to cropvibe-farming project."
Invoke-Eas logout | Out-Null
Invoke-Eas login | Out-Null
$app = Get-Content $BackupPath -Raw | ConvertFrom-Json
$app.expo.owner = $NewOwner
$app.expo.extra.eas.projectId = $NewProjectId
$app | ConvertTo-Json -Depth 20 | Set-Content $AppJsonPath

Write-Host ""
Write-Host "Done. Production builds use credentialsSource=local in eas.json." -ForegroundColor Green
Write-Host "Run: npm run build:android:prod"
Write-Host ""
