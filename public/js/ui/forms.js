/**
 * Ghost Budget — Form Handlers
 * Transaction and account form logic with validation
 * 
 * New Architecture:
 * - handleDebtOperation() for debt tab
 * - updateTransactionForm() handles debt fields visibility
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
    getAccountById,
    getActiveReceivables,
    getActiveLiabilities
} from '../state.js';
import { accounts, transactions, categories, debts } from '../supabase/index.js';
import {
    renderAll,
    renderAccounts,
    renderObligations,
    renderAccountsList,
    renderAccountOptions,
    renderCategoriesList,
    renderCounterpartiesList,
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

    const currentType = getTransactionType();

    // Delegate to debt handler if type is 'debt'
    if (currentType === 'debt') {
        return handleDebtOperation(e);
    }

    const amount = parseFloat($('#input-amount').value);
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
 * Handle debt operation form submit
 * @param {Event} e - Form submit event
 */
async function handleDebtOperation(e) {
    e.preventDefault();

    const direction = $('#input-debt-direction')?.value;
    const amount = parseFloat($('#input-amount')?.value);
    const counterparty = $('#input-counterparty')?.value?.trim();
    const counterpartySelectId = $('#input-counterparty-select')?.value;
    const accountId = $('#input-account')?.value;
    const returnDate = $('#input-return-date')?.value || null;
    const note = $('#input-note')?.value?.trim();

    // Validation
    if (!isValidAmount(amount)) {
        showValidationError('#input-amount', 'Введите корректную сумму');
        return;
    }

    // For lend/borrow - need counterparty name
    // For collect/repay - need counterparty selection
    const needsCounterpartyName = ['lend', 'borrow'].includes(direction);
    const needsCounterpartySelect = ['collect', 'repay'].includes(direction);

    if (needsCounterpartyName && !counterparty) {
        showValidationError('#input-counterparty', 'Укажи контрагента');
        return;
    }

    if (needsCounterpartySelect && !counterpartySelectId) {
        showValidationError('#input-counterparty-select', 'Выбери контрагента');
        return;
    }

    if (!accountId) {
        showValidationError('#input-account', 'Выбери счёт');
        return;
    }

    showLoading(true);

    try {
        let result;

        switch (direction) {
            case 'lend':
                // Я дал в долг
                result = await debts.lend({
                    amount,
                    fromAccountId: accountId,
                    counterparty,
                    expectedReturnDate: returnDate,
                    note
                });
                break;

            case 'collect':
                // Мне вернули
                result = await debts.collectDebt({
                    amount,
                    toAccountId: accountId,
                    counterpartyAccountId: counterpartySelectId,
                    note
                });
                break;

            case 'borrow':
                // Я взял в долг
                result = await debts.borrow({
                    amount,
                    toAccountId: accountId,
                    counterparty,
                    expectedReturnDate: returnDate,
                    note
                });
                break;

            case 'repay':
                // Я вернул
                result = await debts.repayDebt({
                    amount,
                    fromAccountId: accountId,
                    counterpartyAccountId: counterpartySelectId,
                    note
                });
                break;

            default:
                alert('Неизвестное направление операции');
                showLoading(false);
                return;
        }

        if (result?.error) {
            alert(result.error.message);
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
        console.error('Error with debt operation:', error);
        alert('Ошибка при выполнении операции');
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
    $('#group-account').style.display = isTransfer ? 'none' : 'block';
    $('#group-from-account').style.display = isTransfer ? 'block' : 'none';
    $('#group-to-account').style.display = isTransfer ? 'block' : 'none';

    // Debt fields
    $('#group-debt-direction').style.display = isDebt ? 'block' : 'none';
    $('#group-counterparty').style.display = 'none';
    $('#group-counterparty-select').style.display = 'none';
    $('#group-return-date').style.display = 'none';

    if (isDebt) {
        updateDebtFormFields();
    }

    renderCategoriesList();
}

/**
 * Update debt form fields based on direction
 */
export function updateDebtFormFields() {
    const direction = $('#input-debt-direction')?.value;

    // lend/borrow: show counterparty input field
    // collect/repay: show counterparty select dropdown
    const needsCounterpartyName = ['lend', 'borrow'].includes(direction);
    const needsCounterpartySelect = ['collect', 'repay'].includes(direction);

    $('#group-counterparty').style.display = needsCounterpartyName ? 'block' : 'none';
    $('#group-counterparty-select').style.display = needsCounterpartySelect ? 'block' : 'none';
    $('#group-return-date').style.display = needsCounterpartyName ? 'block' : 'none';

    // Update account label
    const accountLabel = $('#group-account')?.querySelector('.form-label');
    if (accountLabel) {
        if (['lend', 'repay'].includes(direction)) {
            accountLabel.textContent = 'Откуда';
        } else {
            accountLabel.textContent = 'Куда';
        }
    }

    // Populate counterparty select for collect/repay
    if (needsCounterpartySelect) {
        populateCounterpartySelect(direction);
    }
}

/**
 * Populate counterparty select based on direction
 * @param {string} direction - 'collect' or 'repay'
 */
function populateCounterpartySelect(direction) {
    const select = $('#input-counterparty-select');
    if (!select) return;

    let counterpartyAccounts;

    if (direction === 'collect') {
        // Мне вернули - show receivables (мне должны)
        counterpartyAccounts = getActiveReceivables();
    } else if (direction === 'repay') {
        // Я вернул - show liabilities (я должен)
        counterpartyAccounts = getActiveLiabilities();
    } else {
        counterpartyAccounts = [];
    }

    if (counterpartyAccounts.length === 0) {
        select.innerHTML = '<option value="">Нет активных долгов</option>';
    } else {
        select.innerHTML = counterpartyAccounts.map(acc => {
            const name = acc.counterparty || acc.name;
            const balance = formatMoney(Math.abs(acc.balance));
            return `<option value="${acc.id}">${name} (${balance})</option>`;
        }).join('');
    }
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
    $('#modify-account-name').value = account.counterparty || account.name;
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
            `Изменить баланс "${oldAccount.counterparty || oldAccount.name}"?\n\n` +
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

    // If it's a receivable/liability, update counterparty too
    if (['receivable', 'liability'].includes(type)) {
        updates.counterparty = name;
    }

    const { data, error } = await accounts.updateAccount(id, updates);

    if (error) {
        alert(error.message);
    } else {
        updateAccountInCache(id, data);

        closeModal('modal-modify-account');
        renderAccountsList();
        renderAccountOptions();
        renderAccounts();
        renderObligations();
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
