# 💰 Ghost Budget — Personal Finance Telegram Bot

## 📋 Overview

**Ghost Budget** — это система учета личных финансов, работающая через Telegram бота. 
Архитектура построена по принципу **Stateless Event-Driven** с использованием inline-кнопок.

### Стек технологий
```
Telegram Bot (Python + aiogram 3.x)
       ↓
  Railway (Hosting + Auto-deploy)
       ↓
  Supabase (PostgreSQL Database)
       ↓
  [Future] Web Dashboard (Next.js)
```

---

## 🧠 Основная концепция

### Философия: «Деньги не исчезают, они перемещаются»

В отличие от простых приложений с двумя кнопками «Приход/Расход», мы используем принцип **Double Entry Bookkeeping** (Двойная запись) в упрощенном виде:

- **Расход** = Деньги уходят из системы навсегда (покупка еды)
- **Доход** = Деньги приходят в систему извне (зарплата)
- **Перевод** = Перемещение денег между счетами (на депозит, другу)

> 💡 **Ключевой хак**: Долг — это тоже Счет. Когда ты даёшь в долг, твой капитал не уменьшается — деньги просто перемещаются из "Kaspi" в "Айбек".

---

## 🤖 UX Telegram Бота

### Stateless подход (Матрешка)
Бот **не хранит состояние диалога** в памяти или БД. Вся информация передается внутри `callback_data` кнопок как JSON.

### User Flow

```
1. Пользователь отправляет ЧИСЛО (сумму): 2000
                    ↓
2. Бот показывает кнопки типа операции:
   [📉 Расход] [📈 Доход]
   [🔄 Перевод] [🤝 Долги]
   [❌ Отмена]
                    ↓
3. После выбора типа → выбор категории/счета
                    ↓  
4. После выбора категории → выбор счёта-источника
                    ↓
5. Сохранение в Supabase → подтверждение
```

---

## 🏗️ Project Structure

```
wallet/
├── README.md                 # This file
├── DATABASE.md               # Database schema docs
├── requirements.txt          # Python dependencies
├── runtime.txt              # Python version for Railway
├── Procfile                 # Railway start command
├── .env.example             # Environment variables template
├── .gitignore
│
├── bot/
│   ├── __init__.py
│   ├── main.py              # Entry point
│   ├── config.py            # Configuration & env vars
│   │
│   ├── handlers/
│   │   ├── __init__.py
│   │   ├── start.py         # /start, /help commands
│   │   ├── transaction.py   # Number input handler
│   │   ├── callbacks.py     # Inline button callbacks
│   │   ├── balance.py       # /balance command
│   │   └── settings.py      # Account/category management
│   │
│   ├── keyboards/
│   │   ├── __init__.py
│   │   ├── inline.py        # Inline keyboard builders
│   │   └── reply.py         # Reply keyboard builders
│   │
│   ├── database/
│   │   ├── __init__.py
│   │   ├── supabase.py      # Supabase client
│   │   ├── models.py        # Pydantic models
│   │   └── queries.py       # Database queries
│   │
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── callback_data.py # Callback data serialization
│   │   └── formatters.py    # Message formatters
│   │
│   └── middlewares/
│       ├── __init__.py
│       └── auth.py          # User auth middleware
│
└── docs/
    └── мой диалог           # Original planning dialogs
```

---

## 🚀 Quick Start

### Local Development

```bash
# Clone repo
git clone https://github.com/your/wallet.git
cd wallet

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Copy env file and fill in values
cp .env.example .env

# Run bot
python -m bot.main
```

### Deploy to Railway

1. Push to `main` branch
2. Railway auto-deploys (connected via GitHub)

---

## 🔐 Environment Variables

```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_anon_key

# Optional
DEBUG=false
LOG_LEVEL=INFO
```

---

## 📱 Bot Commands

| Команда | Описание |
|---------|----------|
| `/start` | Начало работы, регистрация |
| `/help` | Справка по командам |
| `/balance` | Показать балансы всех счетов |
| `/stats` | Аналитика за месяц |
| `/accounts` | Управление счетами |
| `/categories` | Управление категориями |
| `<число>` | Начать ввод транзакции |

---

## 🔄 Callback Data Format

Telegram ограничивает `callback_data` до **64 байт**. Используем сокращённые ключи:

```python
{
    "a": 2000,        # amount
    "t": "exp",       # type: exp|inc|trf|debt
    "c": "uuid",      # category_id
    "s": "uuid",      # source account
    "d": "uuid",      # destination account
    "m": 12345        # message_id to delete
}
```

---

## 🚀 Roadmap

### Phase 1: MVP Bot ✅ (Current)
- [x] Документация и архитектура
- [ ] Создание схемы Supabase
- [ ] Базовая структура Python бота
- [ ] Ввод расходов с категориями
- [ ] Выбор счёта

### Phase 2: Full Bot
- [ ] Доходы
- [ ] Переводы между счетами
- [ ] Долговые операции
- [ ] Просмотр балансов `/balance`

### Phase 3: Analytics
- [ ] Отчёт за период `/stats`
- [ ] AI категоризация
- [ ] Бюджеты и лимиты

### Phase 4: Web Dashboard
- [ ] Next.js веб-интерфейс

---

## � Database

См. [DATABASE.md](./DATABASE.md) для полной схемы.

**Supabase Project**: `cnakcohphvblybhzrobz`

---

*Last updated: 2026-01-26*
