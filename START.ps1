
$JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot"
$MVN       = "C:\Program Files\apache-maven-3.9.14\bin\mvn.cmd"
$BACKEND   = "C:\FILES\KITCHEN MASTER\backend2"
$FRONTEND  = "C:\FILES\KITCHEN MASTER\web"
$SEP       = "========================================"

Write-Host ""
Write-Host $SEP -ForegroundColor Cyan
Write-Host "   Kitchen Master - Starting Up" -ForegroundColor Cyan
Write-Host $SEP -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill stuck processes
Write-Host "[ 1/4 ] Cleaning up old processes..." -ForegroundColor Yellow
Get-Process -Name "java" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "   Done." -ForegroundColor Green

# Step 2: Get current IP
Write-Host ""
Write-Host "[ 2/4 ] Detecting network IP..." -ForegroundColor Yellow
$IP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -match "^(192\.168|10\.|172\.)" } | Select-Object -First 1).IPAddress
if (-not $IP) { $IP = "localhost" }
Write-Host "   Your IP: $IP" -ForegroundColor Green

# Step 3: Start Backend
Write-Host ""
Write-Host "[ 3/4 ] Starting Backend on port 8080..." -ForegroundColor Yellow
$backendCmd = "cd '$BACKEND'; `$env:JAVA_HOME='$JAVA_HOME'; `$env:Path=`"`$env:JAVA_HOME\bin;`$env:Path`"; & '$MVN' spring-boot:run"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal
Write-Host "   Backend starting in a new window..." -ForegroundColor Green

# Step 4: Start Frontend
Write-Host ""
Write-Host "[ 4/4 ] Starting Web App on port 5173..." -ForegroundColor Yellow
$frontendCmd = "cd '$FRONTEND'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd -WindowStyle Normal
Write-Host "   Web app starting in a new window..." -ForegroundColor Green

# Done
Write-Host ""
Write-Host $SEP -ForegroundColor Cyan
Write-Host "   READY - Open these URLs:" -ForegroundColor Green
Write-Host ""
Write-Host "   On THIS PC:         https://localhost:5173" -ForegroundColor Yellow
Write-Host "   On Phone/Tablet:    https://${IP}:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "   (Wait ~30 seconds for the backend to fully start)" -ForegroundColor Gray
Write-Host $SEP -ForegroundColor Cyan
Write-Host ""
