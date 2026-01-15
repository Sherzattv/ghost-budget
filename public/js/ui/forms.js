/**
 * Ghost Budget — Form Handlers
 * Transaction and account form logic with validation
 */

import { $, showLoading, isValidAmount } from '../utils.js';
import { 
    getTransactionType, 
    setTransactionType,
    getAccounts,
    setAccounts,
    addAccount,
    updateAccountInCache,
    removeAccount,
    addCategory,
    getAccountById
} from '../state.js';
import { accounts, transactions, categories } from '../supabase/index.js';
import { 
    renderAll, 
    renderAccounts, 
    renderDebts,
    renderAccountsList, 
    renderAccountOptions, 
    renderCategoriesList,
    updateTransferSelects
} from './components.js';
import { closeModal, openModal } from './modals.js';
import { formatMoney } from '../utils.js';

// ─── Transaction Form ───

/**
 * Handle add transaction form submit
 * @param {Event} e - Form submit event
 */
export async function handleAddTransaction(e) {
    e.preventDefault();

    const amount = parseFloat($('#input-amount').value);
    const categoryName = $('#input-category')?.value?.trim();
    const accountId = $('#input-account')?.value;
    const fromAccountId = $('#input-from-account')?.value;
    const toAccountId = $('#input-to-account')?.value;
    const note = $('#input-note')?.value?.trim();
    const currentType = getTransactionType();

    // Validation
    if (!isValidAmount(amount)) {
        showValidationError('#input-amount', 'Введите корректную сумму');
        return;
    }

    // Validate transfer: accounts must be different
    if (currentType === 'transfer' && fromAccountId === toAccountId) {
        alert('Нельзя переводить на тот же счёт');
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
            alert(error.message);
            showLoading(false);
            return;
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
        alert('Ошибка при добавлении транзакции');
    }

    showLoading(false);
}

/**
 * Handle delete transaction
 * @param {string} id - Transaction ID
 */
export async function handleDeleteTransaction(id) {
    if (!confirm('Удалить транзакцию?')) return;

    showLoading(true);

    const { error } = await transactions.deleteTransaction(id);

    if (error) {
        alert(error.message);
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
    $('#input-amount')?.focus();
}

/**
 * Update transaction form visibility based on type
 */
export function updateTransactionForm() {
    const isTransfer = getTransactionType() === 'transfer';

    $('#group-category').style.display = isTransfer ? 'none' : 'block';
    $('#group-account').style.display = isTransfer ? 'none' : 'block';
    $('#group-from-account').style.display = isTransfer ? 'block' : 'none';
    $('#group-to-account').style.display = isTransfer ? 'block' : 'none';

    renderCategoriesList();
}

// ─── Account Forms ───

/**
 * Handle add account form submit
 * @param {Event} e - Form submit event
 */
export async function handleAddAccount(e) {
    e.preventDefault();

    const name = $('#new-account-name')?.value?.trim();
    const balance = parseFloat($('#new-account-balance')?.value) || 0;
    const type = $('#new-account-type')?.value || 'asset';

    // Validation
    if (!name) {
        showValidationError('#new-account-name', 'Введите название');
        return;
    }

    showLoading(true);

    const { data, error } = await accounts.createAccount({ name, balance, type });

    if (error) {
        alert(error.message);
    } else {
        addAccount(data);

        // Reset form
        $('#new-account-name').value = '';
        $('#new-account-balance').value = '0';

        renderAccountsList();
        renderAccountOptions();
        renderAccounts();
    }

    showLoading(false);
}

/**
 * Handle delete account
 * @param {string} id - Account ID
 */
export async function handleDeleteAccount(id) {
    if (!confirm('Удалить счёт?')) return;

    showLoading(true);

    const { error } = await accounts.deleteAccount(id);

    if (error) {
        alert(error.message);
    } else {
        removeAccount(id);
        renderAccountsList();
        renderAccountOptions();
        renderAccounts();
    }

    showLoading(false);
}

/**
 * Handle edit account - open modify modal
 * @param {string} id - Account ID
 */
export function handleModifyAccount(id) {
    const account = getAccountById(id);
    if (!account) return;

    $('#modify-account-id').value = account.id;
    $('#modify-account-name').value = account.name;
    $('#modify-account-balance').value = account.balance;
    $('#modify-account-type').value = account.type;
    $('#modify-account-limit').value = account.credit_limit || '';

    closeModal('modal-accounts');
    openModal('modal-modify-account');
}

/**
 * Handle save account changes
 * @param {Event} e - Form submit event
 */
export async function handleSaveAccountChanges(e) {
    e.preventDefault();

    const id = $('#modify-account-id').value;
    const name = $('#modify-account-name').value?.trim();
    const balanceRaw = $('#modify-account-balance').value;
    const balance = parseFloat(balanceRaw);
    const type = $('#modify-account-type').value;
    const limit = parseFloat($('#modify-account-limit').value);

    // Validation
    if (!name) {
        showValidationError('#modify-account-name', 'Введите название счёта');
        return;
    }

    if (balanceRaw === '' || isNaN(balance)) {
        showValidationError('#modify-account-balance', 'Введите корректный баланс');
        return;
    }

    // Confirm balance change
    const oldAccount = getAccountById(id);
    if (oldAccount && Math.abs(balance - oldAccount.balance) > 0.01) {
        const confirmed = confirm(
            `Изменить баланс "${oldAccount.name}"?\n\n` +
            `Было: ${formatMoney(oldAccount.balance)}\n` +
            `Станет: ${formatMoney(balance)}\n\n` +
            `Разница: ${formatMoney(balance - oldAccount.balance, true)}`
        );
        if (!confirmed) return;
    }

    showLoading(true);

    const updates = {
        name,
        balance,
        type,
        credit_limit: isNaN(limit) ? null : limit
    };

    const { data, error } = await accounts.updateAccount(id, updates);

    if (error) {
        alert(error.message);
    } else {
        updateAccountInCache(id, data);

        closeModal('modal-modify-account');
        renderAccountsList();
        renderAccountOptions();
        renderAccounts();
        renderDebts();
    }

    showLoading(false);
}

// ─── Validation Helpers ───

/**
 * Show validation error on input
 * @param {string} selector - Input selector
 * @param {string} message - Error message
 */
function showValidationError(selector, message) {
    const input = $(selector);
    if (input) {
        input.focus();
        // Could add visual error state here
    }
    if (message) {
        alert(message);
    }
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
