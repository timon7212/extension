@echo off
chcp 65001 >nul
echo.
echo  Генерирую простые иконки для расширения...
echo.

cd /d "%~dp0extension\icons"

:: Создаём простые PNG через PowerShell (белый круг на синем фоне с буквой O)
powershell -Command ^
  "Add-Type -AssemblyName System.Drawing; ^
   $sizes = @(16, 48, 128); ^
   foreach ($s in $sizes) { ^
     $bmp = New-Object System.Drawing.Bitmap($s, $s); ^
     $g = [System.Drawing.Graphics]::FromImage($bmp); ^
     $g.SmoothingMode = 'AntiAlias'; ^
     $g.Clear([System.Drawing.Color]::FromArgb(10, 102, 194)); ^
     $fontSize = [Math]::Max(8, [int]($s * 0.55)); ^
     $font = New-Object System.Drawing.Font('Arial', $fontSize, [System.Drawing.FontStyle]::Bold); ^
     $brush = [System.Drawing.Brushes]::White; ^
     $sf = New-Object System.Drawing.StringFormat; ^
     $sf.Alignment = 'Center'; ^
     $sf.LineAlignment = 'Center'; ^
     $rect = New-Object System.Drawing.RectangleF(0, 0, $s, $s); ^
     $g.DrawString('O', $font, $brush, $rect, $sf); ^
     $g.Dispose(); ^
     $bmp.Save(\"icon${s}.png\", [System.Drawing.Imaging.ImageFormat]::Png); ^
     $bmp.Dispose(); ^
     Write-Host \"  ✅ icon${s}.png\"; ^
   }"

echo.
echo  Готово!
echo.
pause
