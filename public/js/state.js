/**
 * Ghost Budget — State Management
 * Centralized state with getters and setters
 */

import { saveData } from './storage.js';

/**
 * Application state
 * @type {{data: Object|null, currentTransactionType: string, dataLoaded: boolean}}
 */
const state = {
    data: null,
    currentTransactionType: 'expense',
    dataLoaded: false,
    _listeners: []
};

/**
 * Get current data
 * @returns {Object|null}
 */
export function getData() {
    return state.data;
}

/**
 * Set data and save to storage
 * @param {Object} newData - New data object
 * @param {boolean} persist - Whether to save to storage
 */
export function setData(newData, persist = true) {
    state.data = newData;
    if (persist) {
        saveData(newData);
    }
    notifyListeners();
}

/**
 * Update data partially and save
 * @param {Function} updater - Function that modifies data
 */
export function updateData(updater) {
    if (state.data) {
        updater(state.data);
        saveData(state.data);
        notifyListeners();
    }
}

/**
 * Get current transaction type
 * @returns {string}
 */
export function getTransactionType() {
    return state.currentTransactionType;
}

/**
 * Set current transaction type
 * @param {string} type - 'expense', 'income', or 'transfer'
 */
export function setTransactionType(type) {
    state.currentTransactionType = type;
    notifyListeners();
}

/**
 * Check if data is loaded
 * @returns {boolean}
 */
export function isDataLoaded() {
    return state.dataLoaded;
}

/**
 * Mark data as loaded
 */
export function markDataLoaded() {
    state.dataLoaded = true;
}

/**
 * Get account by ID
 * @param {string} id - Account ID
 * @returns {Object|undefined}
 */
export function getAccountById(id) {
    return state.data?.accounts?.find(a => a.id === id);
}

/**
 * Get all accounts of a specific type
 * @param {string} type - Account type ('asset', 'savings', 'debt')
 * @returns {Array}
 */
export function getAccountsByType(type) {
    return state.data?.accounts?.filter(a => a.type === type) || [];
}

/**
 * Get all non-debt accounts (for dropdowns)
 * @returns {Array}
 */
export function getAssetAccounts() {
    return state.data?.accounts?.filter(a => a.type !== 'debt') || [];
}

/**
 * Get all accounts
 * @returns {Array}
 */
export function getAllAccounts() {
    return state.data?.accounts || [];
}

/**
 * Get transactions, optionally filtered
 * @param {Object} options - Filter options
 * @returns {Array}
 */
export function getTransactions(options = {}) {
    let transactions = state.data?.transactions || [];

    if (options.type) {
        transactions = transactions.filter(t => t.type === options.type);
    }

    if (options.accountId) {
        transactions = transactions.filter(t =>
            t.accountId === options.accountId ||
            t.fromAccountId === options.accountId ||
            t.toAccountId === options.accountId
        );
    }

    if (options.limit) {
        transactions = transactions.slice(-options.limit);
    }

    if (options.reverse) {
        transactions = [...transactions].reverse();
    }

    return transactions;
}

/**
 * Get categories for a transaction type
 * @param {string} type - 'expense' or 'income'
 * @returns {Array}
 */
export function getCategories(type) {
    return state.data?.categories?.[type] || [];
}

/**
 * Add a new category
 * @param {string} type - 'expense' or 'income'
 * @param {string} category - Category name
 */
export function addCategory(type, category) {
    if (state.data?.categories?.[type] && !state.data.categories[type].includes(category)) {
        state.data.categories[type].push(category);
    }
}

/**
 * Subscribe to state changes
 * @param {Function} listener - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribe(listener) {
    state._listeners.push(listener);
    return () => {
        state._listeners = state._listeners.filter(l => l !== listener);
    };
}

/**
 * Notify all listeners of state change
 */
function notifyListeners() {
    state._listeners.forEach(listener => listener(state));
}
