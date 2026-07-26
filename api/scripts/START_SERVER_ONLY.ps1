$JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot"
$MVN = "C:\Program Files\apache-maven-3.9.14\bin\mvn.cmd"
$BACKEND = "C:\FILES\ProBloom\api"
$SEP = "========================================"

Write-Host ""
Write-Host $SEP -ForegroundColor Cyan
Write-Host "   ProBloom - Starting Android Server" -ForegroundColor Cyan
Write-Host $SEP -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill stuck processes
Write-Host "[ 1/3 ] Cleaning up old processes..." -ForegroundColor Yellow
Get-Process -Name "java" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "   Done." -ForegroundColor Green

# Step 2: Get current IP
Write-Host ""
Write-Host "[ 2/3 ] Detecting network IP..." -ForegroundColor Yellow
$IP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -match "^(192\.168|10\.|172\.)" } | Select-Object -First 1).IPAddress
if (-not $IP) { $IP = "localhost" }
Write-Host "   Your Server IP: $IP" -ForegroundColor Green
Write-Host "   (Enter this IP address inside your Android tablet!)" -ForegroundColor Yellow

# Step 3: Start Backend
Write-Host ""
Write-Host "[ 3/3 ] Starting Backend Database & API..." -ForegroundColor Yellow
$backendCmd = "cd '$BACKEND'; `$env:JAVA_HOME='$JAVA_HOME'; `$env:Path=`"`$env:JAVA_HOME\bin;`$env:Path`"; & '$MVN' spring-boot:run -Dspring-boot.run.jvmArguments='-Dspring.devtools.restart.enabled=false'"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal
Write-Host "   Backend starting in a new window..." -ForegroundColor Green

# Done
Write-Host ""
Write-Host $SEP -ForegroundColor Cyan
Write-Host "   READY - Server is running!" -ForegroundColor Green
Write-Host ""
Write-Host "   1. Ensure the tablet is on the same Wi-Fi as this PC."
Write-Host "   2. Open the ProBloom APK on your Android device."
Write-Host "   3. Click the ⚙️ icon on the login screen."
Write-Host "   4. Enter this exact IP: $IP"
Write-Host ""
Write-Host $SEP -ForegroundColor Cyan
Write-Host ""
