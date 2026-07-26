Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile("C:\FILES\KITCHEN MASTER\web\src\assets\LOGO.jpeg")
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.DrawImage($src, 0, 0, 256, 256)
$bmp.Save("C:\FILES\KITCHEN MASTER\web\build\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
$src.Dispose()
Write-Host "Created 256x256 icon.png"
