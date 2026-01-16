/**
 * Ghost Budget — Transaction Form Handlers
 * Transaction creation, deletion, and form state management
 */

import { $, showLoading, isValidAmount } from '../../utils.js';
import {
    getTransactionType,
    setTransactionType,
    setAccounts,
    addCategory
} from '../../state.js';
import { accounts, transactions, categories, debts } from '../../supabase/index.js';
import {
    renderAll,
    renderCategoriesList
} from '../components.js';

// Import debt handler for delegation
import { handleDebtOperation } from './debt-form.js';

// ─── Transaction Form ───

/**
 * Handle add transaction form submit
 * @param {Event} e - Form submit event
 */
export async function handleAddTransaction(e) {
    e.preventDefault();

    const currentType = getTransactionType();

    // Delegate to debt handler if type is 'debt'
    if (currentType === 'debt') {
        return handleDebtOperation(e);
    }

    const amount = parseFloat($('#input-amount').value);

    // Check if split expense with friends
    const splitEnabled = $('#input-split-expense')?.checked;
    const splitWho = $('#input-split-who')?.value?.trim();
    const splitAmount = parseFloat($('#input-split-amount')?.value) || 0;
    const categoryName = $('#input-category')?.value?.trim();
    const accountId = $('#input-account')?.value;
    const fromAccountId = $('#input-from-account')?.value;
    const toAccountId = $('#input-to-account')?.value;
    const note = $('#input-note')?.value?.trim();

    // Validation
    if (!isValidAmount(amount)) {
        showValidationError('#input-amount', 'Введите корректную сумму');
        return;
    }

    // Validate transfer: accounts must be different
    if (currentType === 'transfer' && fromAccountId === toAccountId) {
        console.error('Попытка перевода на тот же счёт');
        $('#input-to-account').focus();
        return;
    }

    showLoading(true);

    try {
        let category_id = null;

        // Get or create category for expense/income
        if (currentType !== 'transfer' && categoryName) {
            const category = await categories.getOrCreateCategory(categoryName, currentType);
            category_id = category?.id;

            // Update cache
            if (category) {
                addCategory(category);
            }
        }

        let result;

        // Handle split expense: expense + debt in one operation
        if (currentType === 'expense' && splitEnabled && splitWho && splitAmount > 0) {
            result = await debts.createExpenseWithDebt({
                expenseAmount: amount,
                accountId,
                categoryId: category_id,
                debtAmount: splitAmount,
                counterparty: splitWho,
                note
            });

            if (result.error) {
                console.error('Split expense error:', result.error.message);
                showLoading(false);
                return;
            }
        } else {
            // Normal transaction
            const { data, error } = await transactions.createTransaction({
                type: currentType,
                amount,
                category_id,
                account_id: currentType !== 'transfer' ? accountId : null,
                from_account_id: currentType === 'transfer' ? fromAccountId : null,
                to_account_id: currentType === 'transfer' ? toAccountId : null,
                note
            });

            if (error) {
                console.error('Transaction error:', error.message);
                showLoading(false);
                return;
            }
            result = { data };
        }

        // Reload accounts to get updated balances
        const updatedAccounts = await accounts.getAccounts({ includeHidden: true });
        setAccounts(updatedAccounts);

        clearTransactionForm();
        await renderAll();

        // Close panel on mobile
        if (window.innerWidth <= 900) {
            $('.side-panel')?.classList.remove('open');
        }
    } catch (error) {
        console.error('Error adding transaction:', error);
    }

    showLoading(false);
}

/**
 * Handle delete transaction
 * @param {string} id - Transaction ID
 */
export async function handleDeleteTransaction(id) {
    showLoading(true);

    const { error } = await transactions.deleteTransaction(id);

    if (error) {
        console.error('Delete transaction error:', error.message);
    } else {
        // Reload accounts
        const updatedAccounts = await accounts.getAccounts({ includeHidden: true });
        setAccounts(updatedAccounts);
        await renderAll();
    }

    showLoading(false);
}

/**
 * Clear transaction form
 */
export function clearTransactionForm() {
    $('#input-amount').value = '';
    $('#input-category').value = '';
    $('#input-note').value = '';
    $('#input-counterparty').value = '';
    $('#input-return-date').value = '';
    $('#input-amount')?.focus();
}

/**
 * Update transaction form visibility based on type
 */
export function updateTransactionForm() {
    const currentType = getTransactionType();
    const isTransfer = currentType === 'transfer';
    const isDebt = currentType === 'debt';

    // Standard fields
    $('#group-category').style.display = (isTransfer || isDebt) ? 'none' : 'block';
    $('#group-account').style.display = (isTransfer || isDebt) ? 'none' : 'block';
    $('#group-from-account').style.display = isTransfer ? 'block' : 'none';
    $('#group-to-account').style.display = isTransfer ? 'block' : 'none';

    // Split expense checkbox (only for expense)
    $('#group-split-expense').style.display = currentType === 'expense' ? 'block' : 'none';
    $('#group-split-details').style.display = 'none';
    if ($('#input-split-expense')) $('#input-split-expense').checked = false;

    // Debt fields - show action buttons only
    $('#group-debt-action').style.display = isDebt ? 'block' : 'none';
    $('#group-debt-type').style.display = 'none';
    $('#group-credit-toggle').style.display = 'none';
    $('#group-counterparty').style.display = 'none';
    $('#group-monthly-payment').style.display = 'none';
    $('#group-payment-day').style.display = 'none';
    $('#group-interest-rate').style.display = 'none';
    $('#group-return-date').style.display = 'none';

    // Reset debt action selection
    if (isDebt) {
        // Import dynamically to avoid circular dependency
        import('./debt-form.js').then(({ resetDebtForm }) => {
            resetDebtForm();
        });
    }

    renderCategoriesList();
}

// ─── Tab Handlers ───

/**
 * Handle transaction type tab change
 * @param {string} type - Transaction type
 */
export function handleTransactionTypeChange(type) {
    setTransactionType(type);
    updateTransactionForm();
}

// ─── Validation Helpers ───

/**
 * Show validation error on input
 * @param {string} selector - Input selector
 * @param {string} message - Error message
 */
export function showValidationError(selector, message) {
    const input = $(selector);
    if (input) {
        input.focus();
        // Could add visual error state here
    }
    if (message) {
        console.warn('Validation:', message);
    }
}
