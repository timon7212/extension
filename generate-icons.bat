@echo off
echo.
echo  Generating extension icons...
echo.

cd /d "%~dp0extension\icons"

powershell -ExecutionPolicy Bypass -Command ^
  "Add-Type -AssemblyName System.Drawing;" ^
  "$sizes = @(16, 48, 128);" ^
  "foreach ($s in $sizes) {" ^
  "  $bmp = New-Object System.Drawing.Bitmap($s, $s);" ^
  "  $g = [System.Drawing.Graphics]::FromImage($bmp);" ^
  "  $g.SmoothingMode = 'AntiAlias';" ^
  "  $g.Clear([System.Drawing.Color]::FromArgb(10, 102, 194));" ^
  "  $fontSize = [Math]::Max(8, [int]($s * 0.55));" ^
  "  $font = New-Object System.Drawing.Font('Arial', $fontSize, [System.Drawing.FontStyle]::Bold);" ^
  "  $brush = [System.Drawing.Brushes]::White;" ^
  "  $sf = New-Object System.Drawing.StringFormat;" ^
  "  $sf.Alignment = 'Center';" ^
  "  $sf.LineAlignment = 'Center';" ^
  "  $rect = New-Object System.Drawing.RectangleF(0, 0, $s, $s);" ^
  "  $g.DrawString('O', $font, $brush, $rect, $sf);" ^
  "  $g.Dispose();" ^
  "  $bmp.Save(\"$PWD\icon$($s).png\", [System.Drawing.Imaging.ImageFormat]::Png);" ^
  "  $bmp.Dispose();" ^
  "  Write-Host \"  OK: icon$($s).png\";" ^
  "}"

echo.
echo  Done!
echo.
pause
