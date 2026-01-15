/**
 * Ghost Budget — Debts Module
 * Unified system for debts, credits, and obligations
 * 
 * Operations:
 * - lend: Я дал в долг
 * - borrow: Я взял в долг
 * - collectDebt: Мне вернули
 * - repayDebt: Я вернул
 * - forgiveDebt: Простить долг
 */

import { supabase } from './client.js';

// ─── Helper: Find or Create Counterparty Account ───

/**
 * Find existing counterparty account or create new one
 * @param {string} counterparty - Counterparty name
 * @param {string} type - 'receivable' or 'liability'
 * @param {Object} options - { expectedReturnDate?, obligationKind? }
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function findOrCreateCounterparty(counterparty, type, options = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error('Not authenticated') };

    // Try to find existing
    const { data: existing, error: findError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', type)
        .eq('counterparty', counterparty)
        .maybeSingle();

    if (findError) {
        console.error('Error finding counterparty:', findError);
        return { data: null, error: findError };
    }

    if (existing) {
        return { data: existing, error: null };
    }

    // Create new counterparty account
    const { data: created, error: createError } = await supabase
        .from('accounts')
        .insert({
            user_id: user.id,
            name: counterparty,
            type,
            balance: 0,
            counterparty,
            obligation_kind: options.obligationKind || 'person',
            expected_return_date: options.expectedReturnDate || null,
            status: 'active'
        })
        .select()
        .single();

    return { data: created, error: createError };
}

// ─── Debt Operations ───

/**
 * Create "Я дал в долг" operation
 * Money leaves my account → counterparty (receivable) balance increases
 * @param {Object} params
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function lend({ amount, fromAccountId, counterparty, expectedReturnDate, note }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error('Not authenticated') };

    if (!amount || amount <= 0) {
        return { data: null, error: new Error('Сумма должна быть больше 0') };
    }
    if (!counterparty?.trim()) {
        return { data: null, error: new Error('Укажи кому даёшь в долг') };
    }
    if (!fromAccountId) {
        return { data: null, error: new Error('Выбери счёт списания') };
    }

    // Find or create counterparty account
    const { data: counterpartyAccount, error: cpError } = await findOrCreateCounterparty(
        counterparty.trim(),
        'receivable',
        { expectedReturnDate }
    );

    if (cpError || !counterpartyAccount) {
        return { data: null, error: cpError || new Error('Не удалось создать контрагента') };
    }

    // Create debt_op transaction: from my account → to counterparty
    const { data, error } = await supabase
        .from('transactions')
        .insert({
            user_id: user.id,
            type: 'debt_op',
            amount,
            date: new Date().toISOString().split('T')[0],
            from_account_id: fromAccountId,
            to_account_id: counterpartyAccount.id,
            is_debt: true,
            debt_direction: 'lent',
            debt_counterparty: counterparty.trim(),
            expected_return_date: expectedReturnDate || null,
            related_account_id: counterpartyAccount.id,
            note: note || `Дал в долг: ${counterparty}`
        })
        .select()
        .single();

    return { data, error };
}

/**
 * Create "Мне вернули" operation
 * Money comes to my account ← counterparty (receivable) balance decreases
 * @param {Object} params
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function collectDebt({ amount, toAccountId, counterpartyAccountId, note }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error('Not authenticated') };

    if (!amount || amount <= 0) {
        return { data: null, error: new Error('Сумма должна быть больше 0') };
    }
    if (!toAccountId) {
        return { data: null, error: new Error('Выбери счёт поступления') };
    }
    if (!counterpartyAccountId) {
        return { data: null, error: new Error('Выбери кто возвращает') };
    }

    // Get counterparty info for note
    const { data: cpAccount } = await supabase
        .from('accounts')
        .select('counterparty, name')
        .eq('id', counterpartyAccountId)
        .single();

    const counterparty = cpAccount?.counterparty || cpAccount?.name || 'Unknown';

    // Create debt_op transaction: from counterparty → to my account
    const { data, error } = await supabase
        .from('transactions')
        .insert({
            user_id: user.id,
            type: 'debt_op',
            amount,
            date: new Date().toISOString().split('T')[0],
            from_account_id: counterpartyAccountId,
            to_account_id: toAccountId,
            is_debt: true,
            debt_direction: 'return',
            debt_counterparty: counterparty,
            related_account_id: counterpartyAccountId,
            note: note || `Возврат от: ${counterparty}`
        })
        .select()
        .single();

    return { data, error };
}

/**
 * Create "Я взял в долг" operation
 * Money comes to my account ← counterparty (liability) balance decreases (negative)
 * @param {Object} params
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function borrow({ amount, toAccountId, counterparty, expectedReturnDate, obligationKind, note }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error('Not authenticated') };

    if (!amount || amount <= 0) {
        return { data: null, error: new Error('Сумма должна быть больше 0') };
    }
    if (!counterparty?.trim()) {
        return { data: null, error: new Error('Укажи у кого занял') };
    }
    if (!toAccountId) {
        return { data: null, error: new Error('Выбери счёт поступления') };
    }

    // Find or create counterparty account (liability)
    const { data: counterpartyAccount, error: cpError } = await findOrCreateCounterparty(
        counterparty.trim(),
        'liability',
        { expectedReturnDate, obligationKind: obligationKind || 'person' }
    );

    if (cpError || !counterpartyAccount) {
        return { data: null, error: cpError || new Error('Не удалось создать контрагента') };
    }

    // Create debt_op transaction: from counterparty (liability) → to my account
    const { data, error } = await supabase
        .from('transactions')
        .insert({
            user_id: user.id,
            type: 'debt_op',
            amount,
            date: new Date().toISOString().split('T')[0],
            from_account_id: counterpartyAccount.id,
            to_account_id: toAccountId,
            is_debt: true,
            debt_direction: 'borrowed',
            debt_counterparty: counterparty.trim(),
            expected_return_date: expectedReturnDate || null,
            related_account_id: counterpartyAccount.id,
            note: note || `Занял у: ${counterparty}`
        })
        .select()
        .single();

    return { data, error };
}

/**
 * Create "Я вернул долг" operation
 * Money leaves my account → counterparty (liability) balance increases (towards 0)
 * @param {Object} params
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function repayDebt({ amount, fromAccountId, counterpartyAccountId, note }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error('Not authenticated') };

    if (!amount || amount <= 0) {
        return { data: null, error: new Error('Сумма должна быть больше 0') };
    }
    if (!fromAccountId) {
        return { data: null, error: new Error('Выбери счёт списания') };
    }
    if (!counterpartyAccountId) {
        return { data: null, error: new Error('Выбери кому возвращаешь') };
    }

    // Get counterparty info for note
    const { data: cpAccount } = await supabase
        .from('accounts')
        .select('counterparty, name')
        .eq('id', counterpartyAccountId)
        .single();

    const counterparty = cpAccount?.counterparty || cpAccount?.name || 'Unknown';

    // Create debt_op transaction: from my account → to counterparty (liability)
    const { data, error } = await supabase
        .from('transactions')
        .insert({
            user_id: user.id,
            type: 'debt_op',
            amount,
            date: new Date().toISOString().split('T')[0],
            from_account_id: fromAccountId,
            to_account_id: counterpartyAccountId,
            is_debt: true,
            debt_direction: 'payment',
            debt_counterparty: counterparty,
            related_account_id: counterpartyAccountId,
            note: note || `Вернул: ${counterparty}`
        })
        .select()
        .single();

    return { data, error };
}

/**
 * Forgive a debt (mark as expense and close)
 * Creates expense for the remaining balance
 * @param {Object} params
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function forgiveDebt({ counterpartyAccountId, categoryId, note }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error('Not authenticated') };

    if (!counterpartyAccountId) {
        return { data: null, error: new Error('Выбери кого простить') };
    }

    // Get counterparty account and remaining balance
    const { data: cpAccount, error: fetchError } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', counterpartyAccountId)
        .single();

    if (fetchError || !cpAccount) {
        return { data: null, error: fetchError || new Error('Контрагент не найден') };
    }

    const remainingAmount = Math.abs(Number(cpAccount.balance));
    if (remainingAmount < 0.01) {
        return { data: null, error: new Error('Долг уже погашен') };
    }

    const counterparty = cpAccount.counterparty || cpAccount.name;

    // Create expense transaction (debt is forgiven = money lost)
    const { data, error } = await supabase
        .from('transactions')
        .insert({
            user_id: user.id,
            type: 'expense',
            amount: remainingAmount,
            date: new Date().toISOString().split('T')[0],
            account_id: counterpartyAccountId,
            category_id: categoryId || null,
            is_debt: true,
            debt_direction: 'forgive',
            debt_counterparty: counterparty,
            related_account_id: counterpartyAccountId,
            note: note || `Списал долг: ${counterparty}`
        })
        .select()
        .single();

    if (!error) {
        // Update account status to closed
        await supabase
            .from('accounts')
            .update({ status: 'closed', balance: 0 })
            .eq('id', counterpartyAccountId);
    }

    return { data, error };
}

// ─── Queries ───

/**
 * Get debt history for a counterparty
 * @param {string} counterpartyAccountId
 * @returns {Promise<Array>}
 */
export async function getDebtHistory(counterpartyAccountId) {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('related_account_id', counterpartyAccountId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching debt history:', error);
        return [];
    }
    return data || [];
}

/**
 * Get all unique counterparties
 * @returns {Promise<Array<string>>}
 */
export async function getUniqueCounterparties() {
    const { data, error } = await supabase
        .from('accounts')
        .select('counterparty')
        .in('type', ['receivable', 'liability'])
        .not('counterparty', 'is', null);

    if (error) {
        console.error('Error fetching counterparties:', error);
        return [];
    }

    // Return unique counterparty names
    return [...new Set(data?.map(a => a.counterparty).filter(Boolean))];
}
