/**
 * Ghost Budget — State Management
 * Centralized application state
 */

// ─── Application State ───

/** @type {Object|null} Current authenticated user */
let currentUser = null;

/** @type {string} Current transaction type (expense, income, transfer) */
let currentTransactionType = 'expense';

/** @type {Array} Cached accounts list */
let accountsCache = [];

/** @type {Array} Cached categories list */
let categoriesCache = [];

// ─── State Getters ───

/**
 * Get current user
 * @returns {Object|null}
 */
export function getUser() {
    return currentUser;
}

/**
 * Get current transaction type
 * @returns {string}
 */
export function getTransactionType() {
    return currentTransactionType;
}

/**
 * Get all cached accounts
 * @returns {Array}
 */
export function getAccounts() {
    return accountsCache;
}

/**
 * Get cached account by ID
 * @param {string} id - Account ID
 * @returns {Object|undefined}
 */
export function getAccountById(id) {
    return accountsCache.find(a => a.id === id);
}

/**
 * Get all cached categories
 * @returns {Array}
 */
export function getCategories() {
    return categoriesCache;
}

/**
 * Get categories by type
 * @param {string} type - 'expense' or 'income'
 * @returns {Array}
 */
export function getCategoriesByType(type) {
    return categoriesCache.filter(c => c.type === type);
}

// ─── State Setters ───

/**
 * Set current user
 * @param {Object|null} user
 */
export function setUser(user) {
    currentUser = user;
}

/**
 * Set current transaction type
 * @param {string} type - 'expense', 'income', or 'transfer'
 */
export function setTransactionType(type) {
    if (['expense', 'income', 'transfer'].includes(type)) {
        currentTransactionType = type;
    }
}

/**
 * Set accounts cache
 * @param {Array} accounts
 */
export function setAccounts(accounts) {
    accountsCache = accounts || [];
}

/**
 * Add account to cache
 * @param {Object} account
 */
export function addAccount(account) {
    if (account && !accountsCache.find(a => a.id === account.id)) {
        accountsCache.push(account);
    }
}

/**
 * Update account in cache
 * @param {string} id - Account ID
 * @param {Object} updates - Updated account data
 */
export function updateAccountInCache(id, updates) {
    const index = accountsCache.findIndex(a => a.id === id);
    if (index !== -1) {
        accountsCache[index] = { ...accountsCache[index], ...updates };
    }
}

/**
 * Remove account from cache
 * @param {string} id - Account ID
 */
export function removeAccount(id) {
    accountsCache = accountsCache.filter(a => a.id !== id);
}

/**
 * Set categories cache
 * @param {Array} categories
 */
export function setCategories(categories) {
    categoriesCache = categories || [];
}

/**
 * Add category to cache
 * @param {Object} category
 */
export function addCategory(category) {
    if (category && !categoriesCache.find(c => c.id === category.id)) {
        categoriesCache.push(category);
    }
}

// ─── Computed State ───

/**
 * Get asset accounts (non-debt, non-hidden)
 * @returns {Array}
 */
export function getAssetAccounts() {
    return accountsCache.filter(a => a.type !== 'debt' && !a.is_hidden);
}

/**
 * Get debt accounts
 * @returns {Array}
 */
export function getDebtAccounts() {
    return accountsCache.filter(a => a.type === 'debt');
}

/**
 * Get accounts with active debts
 * @returns {Array}
 */
export function getActiveDebts() {
    return accountsCache.filter(a => a.type === 'debt' && Math.abs(a.balance) > 0);
}

/**
 * Get total own balance (non-credit accounts)
 * @returns {number}
 */
export function getOwnBalance() {
    return getAssetAccounts()
        .filter(a => !a.credit_limit)
        .reduce((sum, a) => sum + Number(a.balance), 0);
}

/**
 * Get total credit balance
 * @returns {number}
 */
export function getCreditBalance() {
    return getAssetAccounts()
        .filter(a => a.credit_limit)
        .reduce((sum, a) => sum + Number(a.balance), 0);
}

/**
 * Get credit account (first one with credit_limit)
 * @returns {Object|undefined}
 */
export function getCreditAccount() {
    return accountsCache.find(a => a.credit_limit && a.type === 'asset');
}

// ─── Reset State ───

/**
 * Reset all state (for logout)
 */
export function resetState() {
    currentUser = null;
    currentTransactionType = 'expense';
    accountsCache = [];
    categoriesCache = [];
}
