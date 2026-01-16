-- ============================================
-- 004_add_update_trigger.sql
-- Add UPDATE support to balance trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- ─── INSERT ───
    IF TG_OP = 'INSERT' THEN
        IF NEW.type IN ('transfer', 'debt_op') THEN
            IF NEW.from_account_id IS NOT NULL THEN
                UPDATE accounts SET balance = balance - NEW.amount, updated_at = NOW() WHERE id = NEW.from_account_id;
            END IF;
            IF NEW.to_account_id IS NOT NULL THEN
                UPDATE accounts SET balance = balance + NEW.amount, updated_at = NOW() WHERE id = NEW.to_account_id;
            END IF;
        ELSIF NEW.type = 'expense' THEN
            UPDATE accounts SET balance = balance - NEW.amount, updated_at = NOW() WHERE id = NEW.account_id;
        ELSIF NEW.type = 'income' THEN
            UPDATE accounts SET balance = balance + NEW.amount, updated_at = NOW() WHERE id = NEW.account_id;
        END IF;
        
    -- ─── UPDATE (amount changed) ───
    ELSIF TG_OP = 'UPDATE' AND OLD.amount IS DISTINCT FROM NEW.amount THEN
        -- Rollback OLD amount
        IF OLD.type IN ('transfer', 'debt_op') THEN
            IF OLD.from_account_id IS NOT NULL THEN
                UPDATE accounts SET balance = balance + OLD.amount, updated_at = NOW() WHERE id = OLD.from_account_id;
            END IF;
            IF OLD.to_account_id IS NOT NULL THEN
                UPDATE accounts SET balance = balance - OLD.amount, updated_at = NOW() WHERE id = OLD.to_account_id;
            END IF;
        ELSIF OLD.type = 'expense' THEN
            UPDATE accounts SET balance = balance + OLD.amount, updated_at = NOW() WHERE id = OLD.account_id;
        ELSIF OLD.type = 'income' THEN
            UPDATE accounts SET balance = balance - OLD.amount, updated_at = NOW() WHERE id = OLD.account_id;
        END IF;
        
        -- Apply NEW amount
        IF NEW.type IN ('transfer', 'debt_op') THEN
            IF NEW.from_account_id IS NOT NULL THEN
                UPDATE accounts SET balance = balance - NEW.amount, updated_at = NOW() WHERE id = NEW.from_account_id;
            END IF;
            IF NEW.to_account_id IS NOT NULL THEN
                UPDATE accounts SET balance = balance + NEW.amount, updated_at = NOW() WHERE id = NEW.to_account_id;
            END IF;
        ELSIF NEW.type = 'expense' THEN
            UPDATE accounts SET balance = balance - NEW.amount, updated_at = NOW() WHERE id = NEW.account_id;
        ELSIF NEW.type = 'income' THEN
            UPDATE accounts SET balance = balance + NEW.amount, updated_at = NOW() WHERE id = NEW.account_id;
        END IF;
        
    -- ─── DELETE ───
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.type IN ('transfer', 'debt_op') THEN
            IF OLD.from_account_id IS NOT NULL THEN
                UPDATE accounts SET balance = balance + OLD.amount, updated_at = NOW() WHERE id = OLD.from_account_id;
            END IF;
            IF OLD.to_account_id IS NOT NULL THEN
                UPDATE accounts SET balance = balance - OLD.amount, updated_at = NOW() WHERE id = OLD.to_account_id;
            END IF;
        ELSIF OLD.type = 'expense' THEN
            UPDATE accounts SET balance = balance + OLD.amount, updated_at = NOW() WHERE id = OLD.account_id;
        ELSIF OLD.type = 'income' THEN
            UPDATE accounts SET balance = balance - OLD.amount, updated_at = NOW() WHERE id = OLD.account_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger with UPDATE support
DROP TRIGGER IF EXISTS trigger_update_balance ON transactions;
CREATE TRIGGER trigger_update_balance
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_account_balance();
