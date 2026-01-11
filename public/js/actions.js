/**
 * Ghost Budget — Actions Module
 * Business logic for transactions and accounts
 */

import { generateId, sanitizeString } from './utils.js';
import {
    getData,
    updateData,
    getAccountById,
    addCategory
} from './state.js';

/**
 * Validation errors
 */
export class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.field = field;
    }
}

/**
 * Validate transaction data
 * @param {Object} params - Transaction parameters
 * @throws {ValidationError}
 */
function validateTransaction(params) {
    const { type, amount, category, accountId, fromAccountId, toAccountId } = params;

    if (!amount || amount <= 0 || isNaN(amount)) {
        throw new ValidationError('Сумма должна быть больше 0', 'amount');
    }

    if (amount > 100000000) {
        throw new ValidationError('Слишком большая сумма', 'amount');
    }

    if (type === 'transfer') {
        if (!fromAccountId || !toAccountId) {
            throw new ValidationError('Выбери счета для перевода', 'account');
        }
        if (fromAccountId === toAccountId) {
            throw new ValidationError('Выбери разные счета', 'account');
        }
        const fromAcc = getAccountById(fromAccountId);
        const toAcc = getAccountById(toAccountId);
        if (!fromAcc || !toAcc) {
            throw new ValidationError('Счёт не найден', 'account');
        }
    } else {
        if (!category || category.trim() === '') {
            throw new ValidationError('Введи категорию', 'category');
        }
        if (category.length > 50) {
            throw new ValidationError('Категория слишком длинная', 'category');
        }
        if (!accountId) {
            throw new ValidationError('Выбери счёт', 'account');
        }
        const account = getAccountById(accountId);
        if (!account) {
            throw new ValidationError('Счёт не найден', 'account');
        }
    }
}

/**
 * Add a new transaction
 * @param {Object} params - Transaction parameters
 * @returns {Object} Created transaction
 * @throws {ValidationError}
 */
export function addTransaction({ type, amount, category, accountId, fromAccountId, toAccountId, note }) {
    // Validate
    validateTransaction({ type, amount, category, accountId, fromAccountId, toAccountId });

    const transaction = {
        id: generateId(),
        date: new Date().toISOString().split('T')[0],
        type,
        amount: Math.abs(amount),
        note: sanitizeString(note) || ''
    };

    updateData((data) => {
        if (type === 'transfer') {
            transaction.fromAccountId = fromAccountId;
            transaction.toAccountId = toAccountId;

            // Update balances
            const fromAccount = data.accounts.find(a => a.id === fromAccountId);
            const toAccount = data.accounts.find(a => a.id === toAccountId);
            if (fromAccount) fromAccount.balance -= amount;
            if (toAccount) toAccount.balance += amount;
        } else {
            transaction.category = sanitizeString(category);
            transaction.accountId = accountId;

            // Update balance
            const account = data.accounts.find(a => a.id === accountId);
            if (account) {
                if (type === 'expense') {
                    account.balance -= amount;
                } else {
                    account.balance += amount;
                }
            }

            // Add new category if needed
            addCategory(type, category);
        }

        data.transactions.push(transaction);
    });

    return transaction;
}

/**
 * Delete a transaction with balance rollback
 * @param {string} id - Transaction ID
 * @returns {boolean} Success
 */
export function deleteTransaction(id) {
    const data = getData();
    const index = data.transactions.findIndex(t => t.id === id);

    if (index === -1) {
        return false;
    }

    updateData((data) => {
        const t = data.transactions[index];

        // Reverse the balance change
        if (t.type === 'transfer') {
            const fromAccount = data.accounts.find(a => a.id === t.fromAccountId);
            const toAccount = data.accounts.find(a => a.id === t.toAccountId);
            if (fromAccount) fromAccount.balance += t.amount;
            if (toAccount) toAccount.balance -= t.amount;
        } else {
            const account = data.accounts.find(a => a.id === t.accountId);
            if (account) {
                if (t.type === 'expense') {
                    account.balance += t.amount;
                } else {
                    account.balance -= t.amount;
                }
            }
        }

        data.transactions.splice(index, 1);
    });

    return true;
}

/**
 * Validate account data
 * @param {Object} params - Account parameters
 * @throws {ValidationError}
 */
function validateAccount({ name, balance }) {
    if (!name || name.trim() === '') {
        throw new ValidationError('Введи название счёта', 'name');
    }

    if (name.length > 30) {
        throw new ValidationError('Название слишком длинное', 'name');
    }

    if (isNaN(balance)) {
        throw new ValidationError('Неверный баланс', 'balance');
    }
}

/**
 * Add a new account
 * @param {Object} params - Account parameters
 * @returns {Object} Created account
 * @throws {ValidationError}
 */
export function addAccount({ name, balance, type }) {
    validateAccount({ name, balance });

    const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + generateId().slice(0, 4);

    const account = {
        id,
        name: sanitizeString(name),
        balance: parseFloat(balance) || 0,
        type: type || 'asset'
    };

    updateData((data) => {
        data.accounts.push(account);
    });

    return account;
}

/**
 * Delete an account
 * @param {string} id - Account ID
 * @returns {boolean} Success
 * @throws {ValidationError}
 */
export function deleteAccount(id) {
    const data = getData();

    // Check for transactions
    const hasTransactions = data.transactions.some(t =>
        t.accountId === id || t.fromAccountId === id || t.toAccountId === id
    );

    if (hasTransactions) {
        throw new ValidationError('Нельзя удалить счёт с транзакциями', 'account');
    }

    updateData((data) => {
        data.accounts = data.accounts.filter(a => a.id !== id);
    });

    return true;
}

/**
 * Calculate credit card debt breakdown
 * @param {Object} account - Credit account
 * @returns {Object|null} Breakdown with total, my, friends
 */
export function calculateCreditBreakdown(account) {
    if (!account.limit) return null;

    const debt = account.limit - account.balance;
    if (debt <= 0) return { total: 0, my: 0, friends: 0 };

    const data = getData();

    if (account.id === 'credit') {
        const friendsExpenses = data.transactions
            .filter(t => t.accountId === account.id && t.type === 'expense' && t.category === '!Реклама Друзья')
            .reduce((sum, t) => sum + t.amount, 0);

        const friendsReturns = data.transactions
            .filter(t => t.accountId === account.id && t.type === 'income' && t.category === 'Возврат Друзья')
            .reduce((sum, t) => sum + t.amount, 0);

        const friendsDebt = friendsExpenses - friendsReturns;
        return {
            total: debt,
            my: debt - friendsDebt,
            friends: friendsDebt
        };
    }

    return { total: debt, my: debt, friends: 0 };
}
