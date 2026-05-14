# ProBloom Kitchen Master — Production Build Script
# This script builds the full-stack app into a single Windows .exe installer.

Write-Host "`n[1/5] Building Backend JAR..." -ForegroundColor Cyan
Set-Location "backend2"
mvn clean package -DskipTests
if ($LASTEXITCODE -ne 0) { Write-Error "Backend build failed"; exit 1 }
Set-Location ".."

Write-Host "`n[2/5] Building Frontend..." -ForegroundColor Cyan
Set-Location "web"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend build failed"; exit 1 }

Write-Host "`n[3/5] Checking JRE..." -ForegroundColor Cyan
if (-not (Test-Path "jre")) {
    Write-Host "WARNING: 'web/jre' folder not found." -ForegroundColor Yellow
    Write-Host "Please ensure a Windows x64 JRE (Java 17) is located in 'web/jre/' for bundling." -ForegroundColor Yellow
    Write-Host "You can download one from Adoptium (Temurin 17 JRE x64 MSI/ZIP)." -ForegroundColor Yellow
    
    $choice = Read-Host "Proceed without bundling JRE? (y/n)"
    if ($choice -ne "y") { exit 1 }
}

Write-Host "`n[4/5] Packaging with Electron Builder..." -ForegroundColor Cyan
npx electron-builder --win
if ($LASTEXITCODE -ne 0) { Write-Error "Packaging failed"; exit 1 }

Write-Host "`n[5/5] Success!" -ForegroundColor Green
Write-Host "Installer is ready in: web\dist-electron\" -ForegroundColor Green
Get-ChildItem "dist-electron\*.exe" | Select-Object Name, Length
Set-Location ".."
