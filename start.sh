#!/bin/bash
# Ghost Budget — запуск локального сервера
cd "$(dirname "$0")"
echo "🚀 Запускаю Ghost Budget..."
echo "📍 Открой в браузере: http://localhost:3000"
echo ""
npx -y serve -p 3000
