# After downloading keystore from saritha-farming via `eas credentials`,
# run this to create credentials.json and switch back to cropvibe-farming.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/finalize-playstore-keystore.ps1 `
#     -KeystorePath "D:\Agrovibes\mobile\@saritha-farming__agrovibes.jks" `
#     -KeystorePassword "..." -KeyAlias "6fd4e5956732165014a6b7ee33cfe17c" -KeyPassword "..."

param(
  [Parameter(Mandatory = $true)][string]$KeystorePath,
  [Parameter(Mandatory = $true)][string]$KeystorePassword,
  [Parameter(Mandatory = $true)][string]$KeyAlias,
  [Parameter(Mandatory = $true)][string]$KeyPassword
)

$ErrorActionPreference = "Stop"
$MobileRoot = Split-Path -Parent $PSScriptRoot
$DestKeystore = Join-Path $MobileRoot "android\keystores\playstore-upload.jks"
$CredentialsPath = Join-Path $MobileRoot "credentials.json"
$AppJsonPath = Join-Path $MobileRoot "app.json"
$BackupPath = Join-Path $MobileRoot "app.json.bak-cropvibe"

if (-not (Test-Path $KeystorePath)) {
  throw "Keystore not found: $KeystorePath"
}

New-Item -ItemType Directory -Force -Path (Split-Path $DestKeystore) | Out-Null
Copy-Item $KeystorePath $DestKeystore -Force

@{
  android = @{
    keystore = @{
      keystorePath = "android/keystores/playstore-upload.jks"
      keystorePassword = $KeystorePassword
      keyAlias = $KeyAlias
      keyPassword = $KeyPassword
    }
  }
} | ConvertTo-Json -Depth 10 | Set-Content $CredentialsPath

if (-not (Test-Path $BackupPath)) {
  $app = Get-Content $AppJsonPath -Raw | ConvertFrom-Json
  $app.expo.owner = "cropvibe-farming"
  $app.expo.extra.eas.projectId = "d7965c57-28e1-45c1-b0dc-1220030a389f"
  $app | ConvertTo-Json -Depth 20 | Set-Content $BackupPath
}

Copy-Item $BackupPath $AppJsonPath -Force

Write-Host ""
Write-Host "credentials.json created." -ForegroundColor Green
Write-Host "Keystore: $DestKeystore" -ForegroundColor Green
Write-Host "app.json restored to cropvibe-farming." -ForegroundColor Green
Write-Host ""
Write-Host "Next: eas login as cropvibe, then npm run build:android:prod"
