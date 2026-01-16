/**
 * Ghost Budget — Accounts Module
 * CRUD operations for accounts
 */

import { supabase } from './client.js';

/**
 * Get all accounts for current user
 * @param {Object} options - { type?, includeHidden? }
 * @returns {Promise<Array>}
 */
export async function getAccounts(options = {}) {
    let query = supabase
        .from('accounts')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (options.type) {
        query = query.eq('type', options.type);
    }

    if (!options.includeHidden) {
        query = query.eq('is_hidden', false);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching accounts:', error);
        return [];
    }
    return data || [];
}

/**
 * Get account by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getAccountById(id) {
    const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching account:', error);
        return null;
    }
    return data;
}

/**
 * Create a new account
 * @param {Object} account - { name, balance?, type, credit_limit?, obligation_kind?, counterparty?, is_hidden? }
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function createAccount({
    name,
    balance = 0,
    type = 'asset',
    credit_limit = null,
    obligation_kind = null,
    counterparty = null,
    is_hidden = false
}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error('Not authenticated') };

    const insertData = {
        user_id: user.id,
        name,
        balance,
        type,
        is_hidden
    };

    // Add optional fields only if provided
    if (credit_limit !== null) insertData.credit_limit = credit_limit;
    if (obligation_kind !== null) insertData.obligation_kind = obligation_kind;
    if (counterparty !== null) insertData.counterparty = counterparty;

    const { data, error } = await supabase
        .from('accounts')
        .insert(insertData)
        .select()
        .single();

    return { data, error };
}

/**
 * Update an account
 * @param {string} id
 * @param {Object} updates - { name?, balance?, type?, credit_limit?, is_hidden?, sort_order? }
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function updateAccount(id, updates) {
    const { data, error } = await supabase
        .from('accounts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    return { data, error };
}

/**
 * Delete an account (only if no transactions)
 * @param {string} id
 * @returns {Promise<{error: Error|null}>}
 */
export async function deleteAccount(id) {
    const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);

    return { error };
}

/**
 * Get count of transactions linked to account
 * @param {string} id
 * @returns {Promise<number>}
 */
export async function getTransactionCount(id) {
    const { count, error } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .or(`account_id.eq.${id},from_account_id.eq.${id},to_account_id.eq.${id}`);

    if (error) {
        console.error('Error counting transactions:', error);
        return 0;
    }
    return count || 0;
}

/**
 * Archive account (hide instead of delete)
 * @param {string} id
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function archiveAccount(id) {
    return updateAccount(id, { is_hidden: true });
}

/**
 * Unarchive account (restore from archive)
 * @param {string} id
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function unarchiveAccount(id) {
    return updateAccount(id, { is_hidden: false });
}

/**
 * Delete account with all related transactions (cascade)
 * @param {string} id
 * @returns {Promise<{error: Error|null}>}
 */
export async function deleteAccountWithTransactions(id) {
    // 1. Delete all related transactions first
    const { error: txError } = await supabase
        .from('transactions')
        .delete()
        .or(`account_id.eq.${id},from_account_id.eq.${id},to_account_id.eq.${id}`);

    if (txError) {
        console.error('Error deleting transactions:', txError);
        return { error: txError };
    }

    // 2. Delete the account
    const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);

    return { error };
}

/**
 * Get credit breakdown for an account
 * Uses database function for calculation
 * @param {string} accountId
 * @returns {Promise<{total: number, my_debt: number, friends_debt: number}|null>}
 */
export async function getCreditBreakdown(accountId) {
    const { data, error } = await supabase
        .rpc('get_credit_breakdown', { account_uuid: accountId });

    if (error) {
        console.error('Error getting credit breakdown:', error);
        return null;
    }
    return data?.[0] || null;
}
