# Ghost Budget

Персональный трекер бюджета с облачным хранением.

## ✨ Особенности

- 💰 Учёт счетов, расходов, доходов и долгов
- ☁️ **Supabase** — облачное хранение данных
- 🔐 **Авторизация** — email/password
- 📊 Аналитика расходов по категориям
- 🔄 Переводы между счетами
- 📱 PWA — устанавливается как приложение

## 🏗 Структура

```
ghost-budget/
├── public/                 # Frontend
│   ├── index.html          # SPA entry point
│   ├── style.css           # Стили
│   ├── js/
│   │   ├── main.js         # Главный модуль
│   │   ├── config.js       # Supabase credentials
│   │   └── supabase/       # API Layer
│   │       ├── client.js   # Supabase Client
│   │       ├── auth.js     # Авторизация
│   │       ├── accounts.js
│   │       ├── transactions.js
│   │       └── categories.js
│   ├── sw.js               # Service Worker
│   └── manifest.json       # PWA manifest
├── supabase/
│   └── migrations/         # SQL схема
│       └── 001_initial_schema.sql
└── package.json
```

## 🚀 Запуск

```bash
# Локально
npm run dev

# Или
npx serve public -l 3000
```

## ⚙️ Настройка Supabase

1. Создай проект на [supabase.com](https://supabase.com)
2. Скопируй URL и anon key в `public/js/config.js`
3. Запусти SQL из `supabase/migrations/001_initial_schema.sql`

## 🌍 Деплой

Проект развёрнут на Railway:
https://ghost-budget-production.up.railway.app

## 📜 Лицензия

MIT
