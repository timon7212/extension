@echo off
chcp 65001 >nul
echo.
echo ==========================================
echo   Упаковка расширения для сотрудника
echo ==========================================
echo.

:: Создаём ZIP
cd /d "%~dp0"

if exist "outreach-extension.zip" del "outreach-extension.zip"

echo  📦 Создаю outreach-extension.zip...

powershell -Command "Compress-Archive -Path '%~dp0extension\*' -DestinationPath '%~dp0outreach-extension.zip' -Force"

echo.
echo  ✅ Файл создан: outreach-extension.zip
echo.
echo  Инструкция для сотрудника:
echo  ---------------------------
echo  1. Распаковать ZIP в любую папку
echo  2. Открыть Chrome → chrome://extensions
echo  3. Включить "Developer mode" (переключатель справа сверху)
echo  4. Нажать "Load unpacked" → выбрать распакованную папку
echo  5. Кликнуть на иконку расширения в Chrome
echo  6. Ввести адрес сервера: http://^<IP_АДМИНА^>:3001
echo  7. Проверить подключение
echo  8. Ввести логин/пароль
echo  9. Готово! Зайти на LinkedIn профиль — сайдбар появится.
echo.
pause
