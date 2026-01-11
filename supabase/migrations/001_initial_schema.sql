-- ============================================
-- 001_initial_schema.sql
-- Ghost Budget - Supabase Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ACCOUNTS
-- ============================================
CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    balance NUMERIC(15,2) NOT NULL DEFAULT 0,
    type TEXT NOT NULL CHECK (type IN ('asset', 'savings', 'debt')),
    credit_limit NUMERIC(15,2),
    is_hidden BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX idx_accounts_type ON public.accounts(user_id, type);

-- ============================================
-- CATEGORIES
-- ============================================
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name, type)
);

CREATE INDEX idx_categories_user_id ON public.categories(user_id);
CREATE INDEX idx_categories_type ON public.categories(user_id, type);

-- ============================================
-- TRANSACTIONS
-- ============================================
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    from_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_date ON public.transactions(user_id, date DESC);
CREATE INDEX idx_transactions_type ON public.transactions(user_id, type);
CREATE INDEX idx_transactions_account ON public.transactions(account_id);
CREATE INDEX idx_transactions_category ON public.transactions(category_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: users see only their own
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Accounts: full access to own
CREATE POLICY "Users can manage own accounts"
    ON public.accounts FOR ALL
    USING (auth.uid() = user_id);

-- Categories: full access to own
CREATE POLICY "Users can manage own categories"
    ON public.categories FOR ALL
    USING (auth.uid() = user_id);

-- Transactions: full access to own
CREATE POLICY "Users can manage own transactions"
    ON public.transactions FOR ALL
    USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS: Update balance on transaction
-- ============================================
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.type = 'transfer' THEN
            UPDATE public.accounts SET balance = balance - NEW.amount, updated_at = NOW()
            WHERE id = NEW.from_account_id;
            UPDATE public.accounts SET balance = balance + NEW.amount, updated_at = NOW()
            WHERE id = NEW.to_account_id;
        ELSIF NEW.type = 'expense' THEN
            UPDATE public.accounts SET balance = balance - NEW.amount, updated_at = NOW()
            WHERE id = NEW.account_id;
        ELSIF NEW.type = 'income' THEN
            UPDATE public.accounts SET balance = balance + NEW.amount, updated_at = NOW()
            WHERE id = NEW.account_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- Rollback on delete
        IF OLD.type = 'transfer' THEN
            UPDATE public.accounts SET balance = balance + OLD.amount, updated_at = NOW()
            WHERE id = OLD.from_account_id;
            UPDATE public.accounts SET balance = balance - OLD.amount, updated_at = NOW()
            WHERE id = OLD.to_account_id;
        ELSIF OLD.type = 'expense' THEN
            UPDATE public.accounts SET balance = balance + OLD.amount, updated_at = NOW()
            WHERE id = OLD.account_id;
        ELSIF OLD.type = 'income' THEN
            UPDATE public.accounts SET balance = balance - OLD.amount, updated_at = NOW()
            WHERE id = OLD.account_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_balance
    AFTER INSERT OR DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();

-- ============================================
-- HELPER: Get credit breakdown
-- ============================================
CREATE OR REPLACE FUNCTION public.get_credit_breakdown(account_uuid UUID)
RETURNS TABLE(total NUMERIC, my_debt NUMERIC, friends_debt NUMERIC) AS $$
DECLARE
    acc RECORD;
    friends_expenses NUMERIC;
    friends_returns NUMERIC;
    total_debt NUMERIC;
BEGIN
    SELECT * INTO acc FROM public.accounts WHERE id = account_uuid;
    
    IF acc.credit_limit IS NULL THEN
        RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
        RETURN;
    END IF;
    
    total_debt := acc.credit_limit - acc.balance;
    IF total_debt <= 0 THEN
        RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
        RETURN;
    END IF;
    
    -- Calculate friends debt from transactions with special category
    SELECT COALESCE(SUM(t.amount), 0) INTO friends_expenses
    FROM public.transactions t
    JOIN public.categories c ON t.category_id = c.id
    WHERE t.account_id = account_uuid 
      AND t.type = 'expense' 
      AND c.name = '!Реклама Друзья';
    
    SELECT COALESCE(SUM(t.amount), 0) INTO friends_returns
    FROM public.transactions t
    JOIN public.categories c ON t.category_id = c.id
    WHERE t.account_id = account_uuid 
      AND t.type = 'income' 
      AND c.name = 'Возврат Друзья';
    
    friends_debt := friends_expenses - friends_returns;
    
    RETURN QUERY SELECT 
        total_debt,
        total_debt - GREATEST(friends_debt, 0),
        GREATEST(friends_debt, 0);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
