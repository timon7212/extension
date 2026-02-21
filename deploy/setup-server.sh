#!/bin/bash
# =============================================
#  Первоначальная настройка Droplet (Ubuntu 22.04+)
#  Запустить ОДИН РАЗ на новом сервере:
#    curl -sSL https://raw.githubusercontent.com/timon7212/extension/master/deploy/setup-server.sh | bash
# =============================================

set -e

echo ""
echo "========================================"
echo "  🚀 Outreach — Настройка сервера"
echo "========================================"
echo ""

# 1. Обновить систему
echo "📦 Обновляю систему..."
apt-get update -qq && apt-get upgrade -y -qq

# 2. Установить Docker
echo "🐳 Устанавливаю Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# 3. Установить Docker Compose plugin
echo "🐳 Проверяю Docker Compose..."
if ! docker compose version &> /dev/null; then
    apt-get install -y -qq docker-compose-plugin
fi

# 4. Установить Git
echo "📦 Проверяю Git..."
apt-get install -y -qq git

# 5. Клонировать репозиторий
echo "📥 Клонирую проект..."
PROJECT_DIR="/opt/outreach"

if [ -d "$PROJECT_DIR" ]; then
    echo "   Проект уже существует в $PROJECT_DIR"
else
    git clone https://github.com/timon7212/extension.git "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# 6. Создать .env если не существует
if [ ! -f ".env" ]; then
    echo "⚙️  Создаю .env файл..."
    cp env.production.example .env

    # Генерируем случайные пароли
    DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
    JWT_KEY=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)

    sed -i "s/CHANGE_ME_STRONG_PASSWORD_HERE/$DB_PASS/" .env
    sed -i "s/CHANGE_ME_RANDOM_STRING_64_CHARS/$JWT_KEY/" .env

    echo ""
    echo "   ✅ .env создан с безопасными паролями"
    echo "   📝 Проверьте/отредактируйте: nano $PROJECT_DIR/.env"
else
    echo "   .env уже существует, пропускаю"
fi

# 7. Настроить firewall
echo "🔥 Настраиваю firewall..."
ufw allow 22/tcp   >/dev/null 2>&1 || true
ufw allow 80/tcp   >/dev/null 2>&1 || true
ufw allow 443/tcp  >/dev/null 2>&1 || true
echo "y" | ufw enable >/dev/null 2>&1 || true

echo ""
echo "========================================"
echo "  ✅ Сервер настроен!"
echo ""
echo "  Следующие шаги:"
echo "    cd $PROJECT_DIR"
echo "    nano .env                    # проверить настройки"
echo "    docker compose up -d --build # запустить всё"
echo "    docker compose --profile setup run seed  # создать тестовых юзеров"
echo ""
echo "  Полезные команды:"
echo "    docker compose logs -f       # смотреть логи"
echo "    docker compose ps            # статус контейнеров"
echo "    docker compose down          # остановить"
echo "    docker compose up -d --build # пересобрать и запустить"
echo "========================================"
echo ""
