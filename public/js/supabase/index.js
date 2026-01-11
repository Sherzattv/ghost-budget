/**
 * Ghost Budget — Supabase Index
 * Re-export all Supabase modules
 */

export { supabase, getCurrentUser, getSession } from './client.js';
export * as auth from './auth.js';
export * as accounts from './accounts.js';
export * as transactions from './transactions.js';
export * as categories from './categories.js';
