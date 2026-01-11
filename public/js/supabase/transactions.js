/**
 * Ghost Budget — Transactions Module
 * CRUD operations for transactions
 */

import { supabase } from './client.js';

/**
 * Get transactions with optional filters
 * @param {Object} options - { type?, accountId?, categoryId?, limit?, offset?, startDate?, endDate? }
 * @returns {Promise<Array>}
 */
export async function getTransactions(options = {}) {
    let query = supabase
        .from('transactions')
        .select(`
            *,
            category:categories(id, name, type, icon, color),
            account:accounts!account_id(id, name, type),
            from_account:accounts!from_account_id(id, name, type),
            to_account:accounts!to_account_id(id, name, type)
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

    if (options.type) {
        query = query.eq('type', options.type);
    }

    if (options.accountId) {
        query = query.or(`account_id.eq.${options.accountId},from_account_id.eq.${options.accountId},to_account_id.eq.${options.accountId}`);
    }

    if (options.categoryId) {
        query = query.eq('category_id', options.categoryId);
    }

    if (options.startDate) {
        query = query.gte('date', options.startDate);
    }

    if (options.endDate) {
        query = query.lte('date', options.endDate);
    }

    if (options.limit) {
        query = query.limit(options.limit);
    }

    if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching transactions:', error);
        return [];
    }
    return data || [];
}

/**
 * Get transaction by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getTransactionById(id) {
    const { data, error } = await supabase
        .from('transactions')
        .select(`
            *,
            category:categories(id, name),
            account:accounts!account_id(id, name),
            from_account:accounts!from_account_id(id, name),
            to_account:accounts!to_account_id(id, name)
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching transaction:', error);
        return null;
    }
    return data;
}

/**
 * Create a new transaction
 * Balance update is handled by database trigger
 * @param {Object} transaction - { type, amount, date?, category_id?, account_id?, from_account_id?, to_account_id?, note? }
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function createTransaction({ type, amount, date, category_id, account_id, from_account_id, to_account_id, note }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error('Not authenticated') };

    // Validation
    if (!amount || amount <= 0) {
        return { data: null, error: new Error('Сумма должна быть больше 0') };
    }

    if (type === 'transfer') {
        if (!from_account_id || !to_account_id) {
            return { data: null, error: new Error('Выбери счета для перевода') };
        }
        if (from_account_id === to_account_id) {
            return { data: null, error: new Error('Выбери разные счета') };
        }
    } else {
        if (!account_id) {
            return { data: null, error: new Error('Выбери счёт') };
        }
    }

    const { data, error } = await supabase
        .from('transactions')
        .insert({
            user_id: user.id,
            type,
            amount,
            date: date || new Date().toISOString().split('T')[0],
            category_id: type !== 'transfer' ? category_id : null,
            account_id: type !== 'transfer' ? account_id : null,
            from_account_id: type === 'transfer' ? from_account_id : null,
            to_account_id: type === 'transfer' ? to_account_id : null,
            note: note || null
        })
        .select()
        .single();

    return { data, error };
}

/**
 * Delete a transaction
 * Balance rollback is handled by database trigger
 * @param {string} id
 * @returns {Promise<{error: Error|null}>}
 */
export async function deleteTransaction(id) {
    const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

    return { error };
}

/**
 * Get expense analytics grouped by category
 * @param {Object} options - { startDate?, endDate? }
 * @returns {Promise<Array<{category_name: string, total: number}>>}
 */
export async function getExpenseAnalytics(options = {}) {
    let query = supabase
        .from('transactions')
        .select(`
            amount,
            category:categories(name)
        `)
        .eq('type', 'expense');

    if (options.startDate) {
        query = query.gte('date', options.startDate);
    }

    if (options.endDate) {
        query = query.lte('date', options.endDate);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching analytics:', error);
        return [];
    }

    // Group by category manually (could be optimized with RPC function)
    const grouped = {};
    (data || []).forEach(t => {
        const categoryName = t.category?.name || 'Другое';
        grouped[categoryName] = (grouped[categoryName] || 0) + Number(t.amount);
    });

    return Object.entries(grouped)
        .map(([category_name, total]) => ({ category_name, total }))
        .sort((a, b) => b.total - a.total);
}
