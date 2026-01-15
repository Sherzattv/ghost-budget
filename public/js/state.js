/**
 * Ghost Budget — State Management
 * Centralized application state
 * 
 * New Architecture:
 * - asset: Реальные деньги (карты, наличные, депозиты)
 * - savings: Накопления и цели
 * - receivable: Мне должны (контрагенты)
 * - liability: Я должен (кредиты, долги)
 */

// ─── Application State ───

/** @type {Object|null} Current authenticated user */
let currentUser = null;

/** @type {string} Current transaction type */
let currentTransactionType = 'expense';

/** @type {Array} Cached accounts list */
let accountsCache = [];

/** @type {Array} Cached categories list */
let categoriesCache = [];

/** @type {Array} Cached counterparties for autocomplete */
let counterpartyCache = [];

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

/**
 * Get cached counterparties for autocomplete
 * @returns {Array}
 */
export function getCounterparties() {
    return counterpartyCache;
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
 * @param {string} type - 'expense', 'income', 'transfer', or 'debt'
 */
export function setTransactionType(type) {
    if (['expense', 'income', 'transfer', 'debt'].includes(type)) {
        currentTransactionType = type;
    }
}

/**
 * Set accounts cache
 * @param {Array} accounts
 */
export function setAccounts(accounts) {
    accountsCache = accounts || [];
    // Auto-update counterparty cache from receivable/liability accounts
    updateCounterpartyCache();
}

/**
 * Add account to cache
 * @param {Object} account
 */
export function addAccount(account) {
    if (account && !accountsCache.find(a => a.id === account.id)) {
        accountsCache.push(account);
        updateCounterpartyCache();
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
    updateCounterpartyCache();
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

/**
 * Update counterparty cache from accounts
 */
function updateCounterpartyCache() {
    counterpartyCache = accountsCache
        .filter(a => a.type === 'receivable' || a.type === 'liability')
        .map(a => a.counterparty || a.name)
        .filter((v, i, arr) => v && arr.indexOf(v) === i); // unique non-empty
}

// ─── Computed State: Account Types ───

/**
 * Get asset accounts (real money, non-hidden)
 * @returns {Array}
 */
export function getAssetAccounts() {
    return accountsCache.filter(a =>
        (a.type === 'asset' || a.type === 'savings') && !a.is_hidden
    );
}

/**
 * Get receivable accounts (мне должны)
 * @returns {Array}
 */
export function getReceivables() {
    return accountsCache.filter(a => a.type === 'receivable');
}

/**
 * Get active receivables (balance > 0)
 * @returns {Array}
 */
export function getActiveReceivables() {
    return accountsCache.filter(a =>
        a.type === 'receivable' && Number(a.balance) > 0.01
    );
}

/**
 * Get liability accounts (я должен)
 * @returns {Array}
 */
export function getLiabilities() {
    return accountsCache.filter(a => a.type === 'liability');
}

/**
 * Get active liabilities (balance < 0)
 * @returns {Array}
 */
export function getActiveLiabilities() {
    return accountsCache.filter(a =>
        a.type === 'liability' && Number(a.balance) < -0.01
    );
}

/**
 * Get savings accounts
 * @returns {Array}
 */
export function getSavingsAccounts() {
    return accountsCache.filter(a => a.type === 'savings' && !a.is_hidden);
}

// ─── Computed State: Balances ───

/**
 * Get total own balance (asset + savings, excluding credit limits)
 * @returns {number}
 */
export function getOwnBalance() {
    return accountsCache
        .filter(a => (a.type === 'asset' || a.type === 'savings') && !a.credit_limit)
        .reduce((sum, a) => sum + Number(a.balance), 0);
}

/**
 * Get total credit balance (accounts with credit_limit)
 * @returns {number}
 */
export function getCreditBalance() {
    return accountsCache
        .filter(a => a.credit_limit)
        .reduce((sum, a) => sum + Number(a.balance), 0);
}

/**
 * Get total receivables (сколько мне должны)
 * @returns {number}
 */
export function getTotalReceivables() {
    return accountsCache
        .filter(a => a.type === 'receivable')
        .reduce((sum, a) => sum + Math.max(0, Number(a.balance)), 0);
}

/**
 * Get total liabilities (сколько я должен)
 * @returns {number}
 */
export function getTotalLiabilities() {
    return accountsCache
        .filter(a => a.type === 'liability')
        .reduce((sum, a) => sum + Math.abs(Math.min(0, Number(a.balance))), 0);
}

/**
 * Get net financial position
 * Formula: (assets + savings + receivables) - liabilities
 * @returns {number}
 */
export function getNetPosition() {
    const assets = accountsCache
        .filter(a => a.type === 'asset' || a.type === 'savings')
        .reduce((sum, a) => sum + Number(a.balance), 0);
    const receivables = getTotalReceivables();
    const liabilities = getTotalLiabilities();

    return assets + receivables - liabilities;
}

/**
 * Get credit account (first one with credit_limit)
 * @returns {Object|undefined}
 */
export function getCreditAccount() {
    return accountsCache.find(a => a.credit_limit && a.type === 'liability');
}

// ─── Computed State: Obligations ───

/**
 * Check if there are any active obligations
 * @returns {boolean}
 */
export function hasActiveObligations() {
    return getActiveReceivables().length > 0 || getActiveLiabilities().length > 0;
}

/**
 * Get overdue obligations
 * @returns {Array}
 */
export function getOverdueObligations() {
    const today = new Date().toISOString().split('T')[0];
    return accountsCache.filter(a =>
        (a.type === 'receivable' || a.type === 'liability') &&
        a.expected_return_date &&
        a.expected_return_date < today &&
        Math.abs(Number(a.balance)) > 0.01
    );
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
    counterpartyCache = [];
}
