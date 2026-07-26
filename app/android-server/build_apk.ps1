$ErrorActionPreference = "Stop"
$WorkingDir = "C:\FILES\Probloom\android-server"
$WebDir = "C:\FILES\Probloom\web"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ProBloom APK - Hermetic Build Process" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Set-Location -Path $WorkingDir
npm install

Set-Location -Path $WebDir
npm run build 

Set-Location -Path $WorkingDir
if (Test-Path "$WorkingDir\www") { Remove-Item -Recurse -Force "$WorkingDir\www" }
New-Item -ItemType Directory -Force -Path "$WorkingDir\www" | Out-Null
Copy-Item -Recurse -Force "$WebDir\dist\*" "$WorkingDir\www\"

if (-not (Test-Path "$WorkingDir\android")) { npx cap add android }
npx cap sync android

$SdkDir = "$env:LOCALAPPDATA\Android\Sdk"
$LocalProps = "$WorkingDir\android\local.properties"
if (Test-Path $SdkDir) { "sdk.dir=$($SdkDir.Replace('\', '\\'))" | Out-File -FilePath $LocalProps -Encoding ASCII -Force }

Set-Location -Path "$WorkingDir\android"
.\gradlew assembleDebug

Set-Location -Path $WorkingDir
$ApkSource = "$WorkingDir\android\app\build\outputs\apk\debug\app-debug.apk"
$ApkDest = "$WorkingDir\ProBloom.apk"
if (Test-Path $ApkSource) { Copy-Item $ApkSource $ApkDest -Force }
