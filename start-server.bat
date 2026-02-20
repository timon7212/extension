@echo off
chcp 65001 >nul
echo.
echo ==========================================
echo   Outreach Management System — Запуск
echo ==========================================
echo.

:: Показать IP адрес
echo  Ваши IP адреса в сети:
echo  ---------------------------------
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    echo   %%a
)
echo  ---------------------------------
echo.
echo  Сотрудник должен ввести в расширении:
echo    http://^<ВАШ_IP^>:3001
echo.
echo ==========================================
echo.

cd /d "%~dp0backend"

:: Проверить node_modules
if not exist "node_modules" (
    echo  📦 Устанавливаю зависимости...
    call npm install
    echo.
)

:: Проверить .env
if not exist ".env" (
    echo  ⚙️  Создаю .env файл из шаблона...
    copy env.example .env >nul
    echo  ⚠️  ОТРЕДАКТИРУЙТЕ backend\.env — укажите DATABASE_URL и JWT_SECRET!
    echo.
    pause
)

echo  🚀 Запускаю сервер...
echo.
call npm run dev
