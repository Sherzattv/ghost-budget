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
    $('#group-account').style.display = (isTransfer || isDebt) ? 'none' : 'block';
    $('#group-from-account').style.display = isTransfer ? 'block' : 'none';
    $('#group-to-account').style.display = isTransfer ? 'block' : 'none';

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
        resetDebtForm();
    }

    renderCategoriesList();
}

/**
 * Reset debt form to initial state
 */
function resetDebtForm() {
    // Clear action selection
    document.querySelectorAll('.debt-action-btn').forEach(btn => btn.classList.remove('active'));
    $('#input-debt-action').value = '';

    // Reset radio
    const personRadio = document.querySelector('input[name="debt-type"][value="person"]');
    if (personRadio) personRadio.checked = true;

    // Reset toggle
    document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.toggle-btn[data-credit-type="credit"]')?.classList.add('active');
}

/**
 * Handle debt action button click (Я дал / Я взял)
 */
export function handleDebtActionClick(action) {
    // Update hidden input
    $('#input-debt-action').value = action;

    // Update button states
    document.querySelectorAll('.debt-action-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.action === action);
    });

    // Show/hide conditional fields based on action
    updateDebtFormFields();
}

/**
 * Update debt form fields based on action and type
 */
export function updateDebtFormFields() {
    const action = $('#input-debt-action')?.value;
    const debtType = document.querySelector('input[name="debt-type"]:checked')?.value || 'person';
    const creditType = document.querySelector('.toggle-btn.active')?.dataset.creditType || 'credit';

    if (!action) {
        // No action selected yet - hide all fields
        $('#group-debt-type').style.display = 'none';
        $('#group-credit-toggle').style.display = 'none';
        $('#group-counterparty').style.display = 'none';
        $('#group-account').style.display = 'none';
        $('#group-monthly-payment').style.display = 'none';
        $('#group-payment-day').style.display = 'none';
        $('#group-interest-rate').style.display = 'none';
        $('#group-return-date').style.display = 'none';
        return;
    }

    // Show account field with appropriate label
    $('#group-account').style.display = 'block';
    const accountLabel = $('#group-account')?.querySelector('.form-label');
    if (accountLabel) {
        accountLabel.textContent = action === 'lend' ? 'Откуда' : 'Куда';
    }

    // Show counterparty field with appropriate label
    $('#group-counterparty').style.display = 'block';
    const counterpartyLabel = $('#label-counterparty');
    if (counterpartyLabel) {
        counterpartyLabel.textContent = action === 'lend' ? 'Кому' : 'У кого';
    }

    // Populate counterparty autocomplete
    renderCounterpartiesList();

    if (action === 'lend') {
        // "Я дал" - simple form, no type selection
        $('#group-debt-type').style.display = 'none';
        $('#group-credit-toggle').style.display = 'none';
        $('#group-monthly-payment').style.display = 'none';
        $('#group-payment-day').style.display = 'none';
        $('#group-interest-rate').style.display = 'none';
        $('#group-return-date').style.display = 'block';
    } else if (action === 'borrow') {
        // "Я взял" - show type selection
        $('#group-debt-type').style.display = 'block';
        $('#group-return-date').style.display = debtType === 'person' ? 'block' : 'none';

        if (debtType === 'person') {
            // Person - simple form
            $('#group-credit-toggle').style.display = 'none';
            $('#group-monthly-payment').style.display = 'none';
            $('#group-payment-day').style.display = 'none';
            $('#group-interest-rate').style.display = 'none';
        } else if (debtType === 'credit') {
            // Credit/Installment - show toggle and fields
            $('#group-credit-toggle').style.display = 'block';
            $('#group-monthly-payment').style.display = 'block';
            $('#group-payment-day').style.display = 'block';
            // Interest rate only for credit, not installment
            $('#group-interest-rate').style.display = creditType === 'credit' ? 'block' : 'none';
        }
    }
}

/**
 * Handle debt type radio change
 */
export function handleDebtTypeChange() {
    updateDebtFormFields();
}

/**
 * Handle credit/installment toggle click
 */
export function handleCreditToggleClick(creditType) {
    // Update toggle states
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.creditType === creditType);
    });

    // Update form fields
    updateDebtFormFields();
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
