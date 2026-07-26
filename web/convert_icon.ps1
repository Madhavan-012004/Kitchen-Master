Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("public/logo.jpeg")
if (!(Test-Path build)) { New-Item -ItemType Directory -Force -Path build }
$img.Save("build/icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
