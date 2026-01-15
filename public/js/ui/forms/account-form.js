/**
 * Ghost Budget — Account Form Handlers
 * Account creation, modification, deletion, and archiving
 */

import { $, showLoading, isValidAmount } from '../../utils.js';
import {
    getAccountById,
    addAccount,
    updateAccountInCache,
    removeAccount
} from '../../state.js';
import { accounts } from '../../supabase/index.js';
import {
    renderAccounts,
    renderAccountsList,
    renderAccountOptions,
    renderObligations
} from '../components.js';
import { closeModal, openModal } from '../modals.js';
import { showValidationError } from './transaction-form.js';

// ─── Account Form ───

/**
 * Handle add account form submit
 * @param {Event} e - Form submit event
 */
export async function handleAddAccount(e) {
    e.preventDefault();

    const name = $('#new-account-name')?.value?.trim();
    const inputBalance = parseFloat($('#new-account-balance')?.value) || 0;
    const selectedType = $('#new-account-type')?.value || 'asset';
    const creditLimitInput = parseFloat($('#new-account-limit')?.value) || 0;

    console.log('[handleAddAccount] selectedType:', selectedType, 'creditLimitInput:', creditLimitInput);

    // Validation
    if (!name) {
        showValidationError('#new-account-name', 'Введите название');
        return;
    }

    // Build account data based on selected type
    let accountData = { name, is_hidden: false };

    switch (selectedType) {
        case 'asset':
            accountData.type = 'asset';
            accountData.balance = inputBalance;
            break;

        case 'savings':
            accountData.type = 'savings';
            accountData.balance = inputBalance;
            break;

        case 'credit_card':
            // Кредитка = asset с credit_limit
            // Validate credit limit
            if (!creditLimitInput || creditLimitInput <= 0) {
                showValidationError('#new-account-limit', 'Укажите кредитный лимит');
                return;
            }

            accountData.type = 'asset';
            accountData.credit_limit = creditLimitInput;
            // Баланс = доступные средства (по умолчанию = лимит, можно изменить)
            accountData.balance = inputBalance !== 0 ? inputBalance : creditLimitInput;
            break;

        default:
            console.error('Unknown account type:', selectedType);
            return;
    }

    showLoading(true);

    const { data, error } = await accounts.createAccount(accountData);

    if (error) {
        console.error('Add account error:', error.message);
        showLoading(false);
        return;
    }

    // Success - update cache and UI
    addAccount(data);

    // Reset form
    $('#new-account-name').value = '';
    $('#new-account-balance').value = '0';
    $('#new-account-limit').value = '';
    $('#new-account-type').value = 'asset';
    $('#group-new-credit-limit').style.display = 'none';

    // Close modal and re-render
    closeModal('modal-accounts');
    renderAccountOptions();
    renderAccounts();

    showLoading(false);
}

/**
 * Handle delete account - check for transactions first
 * @param {string} id - Account ID
 */
export async function handleDeleteAccount(id) {
    showLoading(true);

    const txCount = await accounts.getTransactionCount(id);

    if (txCount > 0) {
        // Есть транзакции — показываем модалку с предупреждением
        const countEl = document.getElementById('delete-tx-count');
        const modal = document.getElementById('modal-confirm-delete');

        if (countEl) countEl.textContent = txCount;
        if (modal) modal.dataset.accountId = id;

        showLoading(false);
        openModal('modal-confirm-delete');
    } else {
        // Нет транзакций — сразу удаляем
        const { error } = await accounts.deleteAccount(id);

        if (error) {
            console.error('Delete account error:', error.message);
        } else {
            removeAccount(id);
            renderAccountsList();
            renderAccountOptions();
            renderAccounts();
        }

        showLoading(false);
    }
}

/**
 * Handle archive account (hide instead of delete)
 * @param {string} id - Account ID
 */
export async function handleArchiveAccount(id) {
    showLoading(true);

    const { error } = await accounts.archiveAccount(id);

    if (error) {
        console.error('Archive account error:', error.message);
    } else {
        removeAccount(id);
        renderAccountsList();
        renderAccountOptions();
        renderAccounts();
        closeModal('modal-confirm-delete');
    }

    showLoading(false);
}

/**
 * Handle confirm delete with cascade
 * @param {string} id - Account ID
 */
export async function handleConfirmDelete(id) {
    showLoading(true);

    const { error } = await accounts.deleteAccountWithTransactions(id);

    if (error) {
        console.error('Cascade delete error:', error.message);
    } else {
        removeAccount(id);
        renderAccountsList();
        renderAccountOptions();
        renderAccounts();
        closeModal('modal-confirm-delete');
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

    // Basic fields
    $('#modify-account-id').value = account.id;
    $('#modify-account-name').value = account.counterparty || account.name;
    $('#modify-account-balance').value = account.balance;
    $('#modify-account-type').value = account.type;

    // Type-specific fields
    $('#modify-account-limit').value = account.credit_limit || '';
    $('#modify-account-counterparty').value = account.counterparty || '';
    $('#modify-account-return-date').value = account.expected_return_date || '';

    // Show/hide fields based on type
    updateModifyFormVisibility(account.type, !!account.credit_limit);

    closeModal('modal-accounts');
    openModal('modal-modify-account');
}

/**
 * Update modify form field visibility based on account type
 * @param {string} type - Account type
 * @param {boolean} hasCreditLimit - Whether account has credit limit
 */
export function updateModifyFormVisibility(type, hasCreditLimit = false) {
    const creditLimitGroup = $('#modify-group-credit-limit');
    const counterpartyGroup = $('#modify-group-counterparty');
    const returnDateGroup = $('#modify-group-return-date');


    // Reset all
    if (creditLimitGroup) creditLimitGroup.style.display = 'none';
    if (counterpartyGroup) counterpartyGroup.style.display = 'none';
    if (returnDateGroup) returnDateGroup.style.display = 'none';

    // Show based on type
    if (type === 'asset' && hasCreditLimit) {
        // Credit card (asset with credit_limit)
        if (creditLimitGroup) creditLimitGroup.style.display = 'block';
    } else if (type === 'receivable' || type === 'liability') {
        // Debts
        if (counterpartyGroup) counterpartyGroup.style.display = 'block';
        if (returnDateGroup) returnDateGroup.style.display = 'block';
    }
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

    // Confirm balance change (skip for now)
    // const oldAccount = getAccountById(id);
    // Balance change happens without confirmation

    showLoading(true);

    const updates = {
        name,
        balance,
        type,
        credit_limit: isNaN(limit) ? null : limit
    };

    // Type-specific fields
    if (['receivable', 'liability'].includes(type)) {
        const counterparty = $('#modify-account-counterparty')?.value?.trim();
        const returnDate = $('#modify-account-return-date')?.value;

        updates.counterparty = counterparty || name;
        if (returnDate) {
            updates.expected_return_date = returnDate;
        }
    }

    const { data, error } = await accounts.updateAccount(id, updates);

    if (error) {
        console.error('Update account error:', error.message);
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
