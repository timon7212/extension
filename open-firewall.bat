@echo off
chcp 65001 >nul
echo.
echo ==========================================
echo   Открываю порт 3001 в Windows Firewall
echo   (Запустите от имени Администратора!)
echo ==========================================
echo.

netsh advfirewall firewall add rule name="Outreach API Port 3001" dir=in action=allow protocol=TCP localport=3001

echo.
echo  ✅ Правило фаервола добавлено.
echo  Теперь другие устройства в сети смогут подключиться к порту 3001.
echo.
pause
