$ErrorActionPreference = "Stop"

$pythonDir = "C:\FILES\KITCHEN MASTER\web\python"
$zipUrl = "https://www.python.org/ftp/python/3.12.3/python-3.12.3-embed-amd64.zip"
$zipFile = "python-3.12.3-embed-amd64.zip"

Write-Host "Creating python directory at $pythonDir"
if (Test-Path $pythonDir) {
    Remove-Item -Recurse -Force $pythonDir
}
New-Item -ItemType Directory -Force -Path $pythonDir | Out-Null

Write-Host "Downloading Python embedded..."
Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile

Write-Host "Extracting Python..."
Expand-Archive -Path $zipFile -DestinationPath $pythonDir -Force

Write-Host "Cleaning up zip file..."
Remove-Item $zipFile

Write-Host "Modifying python312._pth to enable site-packages..."
$pthFile = Join-Path $pythonDir "python312._pth"
$pthContent = Get-Content $pthFile
$pthContent = $pthContent -replace "#import site", "import site"
Set-Content -Path $pthFile -Value $pthContent

Write-Host "Downloading get-pip.py..."
$pipFile = Join-Path $pythonDir "get-pip.py"
Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $pipFile

Write-Host "Installing pip..."
$pythonExe = Join-Path $pythonDir "python.exe"
& $pythonExe $pipFile

Write-Host "Installing required packages from requirements.txt..."
$reqFile = "C:\FILES\KITCHEN MASTER\backend2\Invoice_Extraction_Project\requirements.txt"
$pipExe = Join-Path $pythonDir "Scripts\pip.exe"
& $pipExe install -r $reqFile

Write-Host "Python Bundling Complete!"
