-- ============================================
-- 003_new_architecture.sql
-- Ghost Budget - New Architecture Migration
-- Applied: 2026-01-15
-- ============================================

-- 1. Удаляем старую таблицу debts
DROP TABLE IF EXISTS public.debts CASCADE;

-- 2. Очищаем данные (оставляем profiles и categories)
DELETE FROM public.transactions;
DELETE FROM public.accounts;

-- 3. Добавляем debt_op в transactions.type
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
  CHECK (type IN ('expense', 'income', 'transfer', 'debt_op'));

-- 4. Добавляем expected_return_date в accounts если нету
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS expected_return_date DATE;

-- 5. Обновляем триггер для поддержки debt_op
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.type IN ('transfer', 'debt_op') THEN
            IF NEW.from_account_id IS NOT NULL THEN
                UPDATE public.accounts 
                SET balance = balance - NEW.amount, updated_at = NOW()
                WHERE id = NEW.from_account_id;
            END IF;
            IF NEW.to_account_id IS NOT NULL THEN
                UPDATE public.accounts 
                SET balance = balance + NEW.amount, updated_at = NOW()
                WHERE id = NEW.to_account_id;
            END IF;
        ELSIF NEW.type = 'expense' THEN
            UPDATE public.accounts 
            SET balance = balance - NEW.amount, updated_at = NOW()
            WHERE id = NEW.account_id;
        ELSIF NEW.type = 'income' THEN
            UPDATE public.accounts 
            SET balance = balance + NEW.amount, updated_at = NOW()
            WHERE id = NEW.account_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.type IN ('transfer', 'debt_op') THEN
            IF OLD.from_account_id IS NOT NULL THEN
                UPDATE public.accounts 
                SET balance = balance + OLD.amount, updated_at = NOW()
                WHERE id = OLD.from_account_id;
            END IF;
            IF OLD.to_account_id IS NOT NULL THEN
                UPDATE public.accounts 
                SET balance = balance - OLD.amount, updated_at = NOW()
                WHERE id = OLD.to_account_id;
            END IF;
        ELSIF OLD.type = 'expense' THEN
            UPDATE public.accounts 
            SET balance = balance + OLD.amount, updated_at = NOW()
            WHERE id = OLD.account_id;
        ELSIF OLD.type = 'income' THEN
            UPDATE public.accounts 
            SET balance = balance - OLD.amount, updated_at = NOW()
            WHERE id = OLD.account_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
