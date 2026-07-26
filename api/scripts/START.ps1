$SCRIPT_DIR = $PSScriptRoot
$BACKEND   = (Resolve-Path "$SCRIPT_DIR\..").Path
$FRONTEND  = (Resolve-Path "$SCRIPT_DIR\..\..\web").Path
$SEP       = "========================================"

Write-Host ""
Write-Host $SEP -ForegroundColor Cyan
Write-Host "   ProBloom - Starting Up" -ForegroundColor Cyan
Write-Host $SEP -ForegroundColor Cyan
Write-Host ""

# Step 0: Smart Environment Discovery (Portable)
Write-Host "[ 0/4 ] Discovering Environment..." -ForegroundColor Yellow

# Java Discovery
if (-not $env:JAVA_HOME) {
    $javaPath = Get-ChildItem "C:\Program Files\Eclipse Adoptium", "C:\Program Files\Java" -Filter "jdk*" -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if ($javaPath) {
        $env:JAVA_HOME = $javaPath.FullName
        $env:Path = "$env:JAVA_HOME\bin;$env:Path"
        Write-Host "   Auto-discovered JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Green
    } else {
        Write-Host "   JAVA_HOME not set. Assuming java is already in PATH." -ForegroundColor Gray
    }
} else {
    Write-Host "   Using existing JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Green
}

# Maven Discovery
$MVN = "mvn"
if (-not (Get-Command "mvn" -ErrorAction SilentlyContinue)) {
    $mvnPath = Get-ChildItem "C:\Program Files", "C:\Program Files (x86)" -Filter "apache-maven-*" -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if ($mvnPath) {
        $MVN = "$($mvnPath.FullName)\bin\mvn.cmd"
        Write-Host "   Auto-discovered Maven: $MVN" -ForegroundColor Green
    } else {
        Write-Host "   Maven 'mvn' command not found in PATH." -ForegroundColor Red
    }
} else {
    Write-Host "   Maven found in PATH." -ForegroundColor Green
}

# Step 1: Kill stuck processes
Write-Host ""
Write-Host "[ 1/4 ] Cleaning up old processes..." -ForegroundColor Yellow
Get-Process -Name "java" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "   Done." -ForegroundColor Green

# Step 2: Get current IP
Write-Host ""
Write-Host "[ 2/4 ] Detecting network IP..." -ForegroundColor Yellow
$IP = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -match "^(192\.168|10\.|172\.)" } | Select-Object -First 1).IPAddress
if (-not $IP) { $IP = "localhost" }
Write-Host "   Your IP: $IP" -ForegroundColor Green

# Step 3: Start Backend
Write-Host ""
Write-Host "[ 3/4 ] Starting Backend on port 8080..." -ForegroundColor Yellow
$backendCmd = "cd '$BACKEND'; & '$MVN' spring-boot:run -Dspring-boot.run.jvmArguments='-Dspring.devtools.restart.enabled=false'"
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
