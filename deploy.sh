#!/usr/bin/env bash
set -e

echo "🚀 Инициализация продакшен-сборки AI FinOps Platform..."

if command -v podman &>/dev/null; then
  ENGINE="podman"
elif command -v docker &>/dev/null; then
  ENGINE="docker"
else
  echo "❌ Контейнерный движок (Podman или Docker) не найден."
  exit 1
fi

if [ ! -f .env.prod ]; then
  echo "🔐 Генерируем безопасные ключи в .env.prod..."
  PG_PASS=$(openssl rand -hex 16)
  AUTH_SEC=$(openssl rand -hex 32)
  cat <<EOF >.env.prod
POSTGRES_USER=finops
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=finops_db
BETTER_AUTH_SECRET=${AUTH_SEC}
APP_DOMAIN=localhost
BETTER_AUTH_URL=http://localhost:8080
NEXT_PUBLIC_APP_URL=http://localhost:8080
EOF
  echo "✅ Файл .env.prod создан."
fi

echo "📦 Сборка контейнеров и запуск сервисов через ${ENGINE}..."
$ENGINE compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

echo "🎉 Готово! Приложение запущено на http://localhost:8080"
