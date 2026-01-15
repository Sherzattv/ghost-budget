-- ============================================
-- 002_expense_analytics_rpc.sql
-- Ghost Budget - RPC Function for Analytics
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- FUNCTION: Get expense analytics by category
-- Optimized server-side grouping instead of client-side
-- ============================================
CREATE OR REPLACE FUNCTION public.get_expense_analytics(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL
)
RETURNS TABLE(
    category_name TEXT,
    total NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(c.name, 'Другое') AS category_name,
        SUM(t.amount) AS total
    FROM public.transactions t
    LEFT JOIN public.categories c ON t.category_id = c.id
    WHERE t.user_id = auth.uid()
      AND t.type = 'expense'
      AND (start_date IS NULL OR t.date >= start_date)
      AND (end_date IS NULL OR t.date <= end_date)
    GROUP BY c.name
    ORDER BY total DESC;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_expense_analytics(DATE, DATE) TO authenticated;

-- ============================================
-- FUNCTION: Get income analytics by category
-- Bonus: same optimization for income
-- ============================================
CREATE OR REPLACE FUNCTION public.get_income_analytics(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL
)
RETURNS TABLE(
    category_name TEXT,
    total NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(c.name, 'Другое') AS category_name,
        SUM(t.amount) AS total
    FROM public.transactions t
    LEFT JOIN public.categories c ON t.category_id = c.id
    WHERE t.user_id = auth.uid()
      AND t.type = 'income'
      AND (start_date IS NULL OR t.date >= start_date)
      AND (end_date IS NULL OR t.date <= end_date)
    GROUP BY c.name
    ORDER BY total DESC;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_income_analytics(DATE, DATE) TO authenticated;

-- ============================================
-- FUNCTION: Get period summary (totals)
-- Useful for dashboard widgets
-- ============================================
CREATE OR REPLACE FUNCTION public.get_period_summary(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL
)
RETURNS TABLE(
    total_income NUMERIC,
    total_expense NUMERIC,
    net_balance NUMERIC,
    transaction_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS total_expense,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) AS net_balance,
        COUNT(*) AS transaction_count
    FROM public.transactions t
    WHERE t.user_id = auth.uid()
      AND t.type IN ('income', 'expense')
      AND (start_date IS NULL OR t.date >= start_date)
      AND (end_date IS NULL OR t.date <= end_date);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_period_summary(DATE, DATE) TO authenticated;
