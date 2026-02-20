@echo off
chcp 65001 >nul
echo.
echo ==========================================
echo   Outreach — Настройка базы данных
echo ==========================================
echo.

set /p PGUSER="  PostgreSQL пользователь (default: postgres): " || set PGUSER=postgres
if "%PGUSER%"=="" set PGUSER=postgres

set /p PGPASSWORD="  PostgreSQL пароль: "

echo.
echo  1. Создаю базу данных 'outreach'...
psql -U %PGUSER% -c "CREATE DATABASE outreach;" 2>nul
echo.

echo  2. Применяю схему...
psql -U %PGUSER% -d outreach -f "%~dp0database\schema.sql"
echo.

echo  3. Запускаю seed (создание пользователей)...
cd /d "%~dp0backend"

if not exist ".env" (
    copy env.example .env >nul
)

:: Обновить DATABASE_URL в .env
powershell -Command "(Get-Content .env) -replace 'postgresql://postgres:postgres@localhost:5432/outreach', 'postgresql://%PGUSER%:%PGPASSWORD%@localhost:5432/outreach' | Set-Content .env"

call npm install
call npm run seed

echo.
echo ==========================================
echo   ✅ База данных готова!
echo ==========================================
echo.
pause
