# 📊 Ghost Budget — Database Architecture

## Overview

База данных построена на **Supabase (PostgreSQL)** с использованием принципов:
- **Double Entry Bookkeeping** (упрощённая двойная запись)
- **Event Sourcing** (транзакции как лог событий)
- **Row Level Security** (изоляция данных пользователей)

---

## 🏗️ Database Schema

### Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   profiles  │     │  accounts   │     │ categories  │
│─────────────│     │─────────────│     │─────────────│
│ id (PK)     │◄────│ user_id(FK) │     │ user_id(FK) │
│ telegram_id │     │ name        │     │ name        │
│ display_name│     │ type        │     │ type        │
│ settings    │     │ balance     │     │ icon        │
│ created_at  │     │ icon        │     │ is_frequent │
└─────────────┘     │ credit_limit│     └──────┬──────┘
                    │ is_hidden   │            │
                    │ sort_order  │            │
                    └──────┬──────┘            │
                           │                   │
                    ┌──────┴───────────────────┴──────┐
                    │         transactions            │
                    │─────────────────────────────────│
                    │ id (PK)                         │
                    │ user_id (FK → profiles)         │
                    │ date                            │
                    │ type (expense|income|transfer)  │
                    │ amount                          │
                    │ category_id (FK → categories)   │
                    │ account_id (FK → accounts)      │
                    │ from_account_id (FK → accounts) │
                    │ to_account_id (FK → accounts)   │
                    │ note                            │
                    │ is_debt                         │
                    │ debt_direction                  │
                    │ debt_counterparty               │
                    │ created_at                      │
                    └─────────────────────────────────┘
```

---

## 📋 Table Definitions

### 1. profiles

Профили пользователей, связанные с `auth.users`.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id BIGINT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}',
  default_account_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Settings schema example:
-- {
--   "currency": "KZT",
--   "timezone": "Asia/Almaty",
--   "notifications": true,
--   "weeklyReport": true
-- }
```

### 2. accounts

Счета пользователя (кошельки, долги, кредиты).

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'savings', 'receivable', 'liability')),
  icon TEXT DEFAULT '💳',
  balance NUMERIC DEFAULT 0,
  credit_limit NUMERIC,
  is_hidden BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_accounts_type ON accounts(type);
```

**Account Types:**

| Type | Описание | Примеры | Баланс |
|------|----------|---------|--------|
| `asset` | Ликвидные активы | Kaspi, Наличные | Положительный |
| `savings` | Накопления | Депозит, Инвестиции | Положительный |
| `receivable` | Дебиторка (мне должны) | Долг Айбека | Положительный |
| `liability` | Обязательства (я должен) | Кредит, Ипотека | Отрицательный |

### 3. categories

Категории расходов и доходов.

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  icon TEXT DEFAULT '📦',
  color TEXT DEFAULT '#6366f1',
  is_frequent BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  parent_id UUID REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_categories_type ON categories(type);
```

### 4. transactions

Главная таблица транзакций.

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  
  -- Для простых операций (expense/income)
  account_id UUID REFERENCES accounts(id),
  category_id UUID REFERENCES categories(id),
  
  -- Для переводов
  from_account_id UUID REFERENCES accounts(id),
  to_account_id UUID REFERENCES accounts(id),
  
  -- Долговые операции
  is_debt BOOLEAN DEFAULT false,
  debt_direction TEXT CHECK (
    debt_direction IS NULL OR 
    debt_direction IN ('lent', 'borrowed', 'return', 'payment', 'forgive')
  ),
  debt_counterparty TEXT,
  expected_return_date DATE,
  related_account_id UUID REFERENCES accounts(id),
  
  -- Метаданные
  note TEXT,
  tags TEXT[],
  is_recurring BOOLEAN DEFAULT false,
  recurring_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_category ON transactions(category_id);
```

---

## 🔒 Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"  
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Accounts policies
CREATE POLICY "Users can manage own accounts"
  ON accounts FOR ALL
  USING (auth.uid() = user_id);

-- Categories policies  
CREATE POLICY "Users can manage own categories"
  ON categories FOR ALL
  USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can manage own transactions"
  ON transactions FOR ALL
  USING (auth.uid() = user_id);
```

---

## 📊 Views & Functions

### Баланс счёта

```sql
CREATE OR REPLACE FUNCTION get_account_balance(account_uuid UUID)
RETURNS NUMERIC AS $$
DECLARE
  income_sum NUMERIC;
  expense_sum NUMERIC;
  transfer_in NUMERIC;
  transfer_out NUMERIC;
BEGIN
  -- Доходы на этот счёт
  SELECT COALESCE(SUM(amount), 0) INTO income_sum
  FROM transactions
  WHERE account_id = account_uuid AND type = 'income';
  
  -- Расходы с этого счёта
  SELECT COALESCE(SUM(amount), 0) INTO expense_sum
  FROM transactions
  WHERE account_id = account_uuid AND type = 'expense';
  
  -- Переводы НА этот счёт
  SELECT COALESCE(SUM(amount), 0) INTO transfer_in
  FROM transactions
  WHERE to_account_id = account_uuid AND type = 'transfer';
  
  -- Переводы С этого счёта
  SELECT COALESCE(SUM(amount), 0) INTO transfer_out
  FROM transactions
  WHERE from_account_id = account_uuid AND type = 'transfer';

  RETURN income_sum - expense_sum + transfer_in - transfer_out;
END;
$$ LANGUAGE plpgsql;
```

### Сводка расходов по категориям

```sql
CREATE OR REPLACE VIEW expense_summary AS
SELECT 
  t.user_id,
  c.name as category_name,
  c.icon as category_icon,
  DATE_TRUNC('month', t.date) as month,
  SUM(t.amount) as total
FROM transactions t
JOIN categories c ON t.category_id = c.id
WHERE t.type = 'expense'
GROUP BY t.user_id, c.name, c.icon, DATE_TRUNC('month', t.date);
```

### Баланс по группам счетов

```sql
CREATE OR REPLACE VIEW balance_summary AS
SELECT 
  user_id,
  type,
  SUM(balance) as total_balance
FROM accounts
WHERE is_hidden = false
GROUP BY user_id, type;
```

---

## 🔄 Triggers

### Автообновление updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_accounts_updated
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_transactions_updated
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Пересчёт баланса при транзакции

```sql
CREATE OR REPLACE FUNCTION recalculate_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Обновляем баланс затронутых счетов
  IF NEW.account_id IS NOT NULL THEN
    UPDATE accounts 
    SET balance = get_account_balance(NEW.account_id)
    WHERE id = NEW.account_id;
  END IF;
  
  IF NEW.from_account_id IS NOT NULL THEN
    UPDATE accounts 
    SET balance = get_account_balance(NEW.from_account_id)
    WHERE id = NEW.from_account_id;
  END IF;
  
  IF NEW.to_account_id IS NOT NULL THEN
    UPDATE accounts 
    SET balance = get_account_balance(NEW.to_account_id)
    WHERE id = NEW.to_account_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_recalculate_balance
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION recalculate_account_balance();
```

---

## 📦 Default Data (Seed)

### Начальные категории

```sql
-- Расходы
INSERT INTO categories (user_id, name, type, icon, is_frequent, sort_order) VALUES
  (USER_ID, 'Продукты', 'expense', '🛒', true, 1),
  (USER_ID, 'Кафе и рестораны', 'expense', '🍔', true, 2),
  (USER_ID, 'Транспорт', 'expense', '🚕', true, 3),
  (USER_ID, 'Дом и быт', 'expense', '🏠', false, 4),
  (USER_ID, 'Здоровье', 'expense', '💊', false, 5),
  (USER_ID, 'Развлечения', 'expense', '🎮', false, 6),
  (USER_ID, 'Одежда', 'expense', '👕', false, 7),
  (USER_ID, 'Подписки', 'expense', '📱', false, 8),
  (USER_ID, 'Благотворительность', 'expense', '🤲', false, 9);

-- Доходы  
INSERT INTO categories (user_id, name, type, icon, is_frequent, sort_order) VALUES
  (USER_ID, 'Зарплата', 'income', '💰', true, 1),
  (USER_ID, 'Фриланс', 'income', '💻', true, 2),
  (USER_ID, 'Инвестиции', 'income', '📈', false, 3),
  (USER_ID, 'Подарки', 'income', '🎁', false, 4);
```

### Начальные счета

```sql
INSERT INTO accounts (user_id, name, type, icon, sort_order) VALUES
  (USER_ID, 'Kaspi Gold', 'asset', '💳', 1),
  (USER_ID, 'Наличные', 'asset', '💵', 2),
  (USER_ID, 'Halyk Bank', 'asset', '🏦', 3),
  (USER_ID, 'Depozit', 'savings', '🏧', 4);
```

---

## 🔗 Supabase Project

- **Project ID**: `cnakcohphvblybhzrobz`
- **Region**: `ap-northeast-1`
- **Database Host**: `db.cnakcohphvblybhzrobz.supabase.co`

---

*Last updated: 2026-01-26*
