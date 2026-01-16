/**
 * Ghost Budget — Debt Form Handlers
 * Debt operations: lend, borrow, collect, repay
 */

import { $, showLoading, isValidAmount } from '../../utils.js';
import {
    setAccounts,
    getActiveReceivables,
    getActiveLiabilities
} from '../../state.js';
import { accounts, debts } from '../../supabase/index.js';
import {
    renderAll,
    renderCounterpartiesList
} from '../components.js';
import { formatMoney } from '../../utils.js';
import { showValidationError, clearTransactionForm } from './transaction-form.js';

// ─── Debt Operations ───

/**
 * Handle debt operation form submit
 * @param {Event} e - Form submit event
 */
export async function handleDebtOperation(e) {
    e.preventDefault();

    const direction = $('#input-debt-action')?.value;
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
                // Мне вернули — use smart collection
                const closeDebt = $('#input-close-debt')?.checked || false;
                result = await debts.collectDebtSmart({
                    amount,
                    toAccountId: accountId,
                    counterpartyAccountId: counterpartySelectId,
                    closeDebt,
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
                console.error('Unknown debt direction');
                showLoading(false);
                return;
        }

        if (result?.error) {
            console.error('Debt operation error:', result.error.message);
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
    }

    showLoading(false);
}

/**
 * Reset debt form to initial state
 */
export function resetDebtForm() {
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

    // Hide all optional fields first
    $('#group-debt-type').style.display = 'none';
    $('#group-credit-toggle').style.display = 'none';
    $('#group-counterparty').style.display = 'none';
    $('#group-counterparty-select').style.display = 'none';
    $('#group-account').style.display = 'none';
    $('#group-monthly-payment').style.display = 'none';
    $('#group-payment-day').style.display = 'none';
    $('#group-interest-rate').style.display = 'none';
    $('#group-return-date').style.display = 'none';

    if (!action) return;

    // Show account field with appropriate label
    $('#group-account').style.display = 'block';
    const accountLabel = $('#group-account')?.querySelector('.form-label');

    if (action === 'lend') {
        // "Я дал" - counterparty text input, money goes FROM asset
        if (accountLabel) accountLabel.textContent = 'Откуда';
        $('#group-counterparty').style.display = 'block';
        $('#label-counterparty').textContent = 'Кому';
        $('#group-return-date').style.display = 'block';
        renderCounterpartiesList();

    } else if (action === 'borrow') {
        // "Я взял" - show type selection, money goes TO asset
        if (accountLabel) accountLabel.textContent = 'Куда';
        $('#group-debt-type').style.display = 'block';
        $('#group-counterparty').style.display = 'block';
        $('#label-counterparty').textContent = 'У кого';
        $('#group-return-date').style.display = debtType === 'person' ? 'block' : 'none';
        renderCounterpartiesList();

        if (debtType === 'credit') {
            $('#group-credit-toggle').style.display = 'block';
            $('#group-monthly-payment').style.display = 'block';
            $('#group-payment-day').style.display = 'block';
            $('#group-interest-rate').style.display = creditType === 'credit' ? 'block' : 'none';
        }

    } else if (action === 'collect') {
        // "Мне вернули" - select from receivables, money goes TO asset
        if (accountLabel) accountLabel.textContent = 'Куда';
        $('#group-counterparty-select').style.display = 'block';
        $('#label-counterparty-select').textContent = 'Кто вернул';
        populateCounterpartySelect('collect');

        // Setup balance hint on amount change
        setupBalanceHint();

    } else if (action === 'repay') {
        // "Я вернул" - select from liabilities, money goes FROM asset
        if (accountLabel) accountLabel.textContent = 'Откуда';
        $('#group-counterparty-select').style.display = 'block';
        $('#label-counterparty-select').textContent = 'Кому';
        populateCounterpartySelect('repay');
    }
}

/**
 * Populate counterparty select based on action
 * @param {string} action - 'collect' or 'repay'
 */
export function populateCounterpartySelect(action) {
    const select = $('#input-counterparty-select');
    if (!select) return;

    let counterpartyAccounts;

    if (action === 'collect') {
        // Мне вернули - show receivables (мне должны)
        counterpartyAccounts = getActiveReceivables();
    } else if (action === 'repay') {
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

// ─── Balance Hint for Smart Collection ───

// Keep track of listener to avoid duplicates
let balanceHintSetup = false;

/**
 * Setup balance hint that shows over/underpayment info
 */
function setupBalanceHint() {
    if (balanceHintSetup) return;

    const amountInput = $('#input-amount');
    const cpSelect = $('#input-counterparty-select');
    const hintEl = $('#hint-debt-balance');
    const closeDebtGroup = $('#group-close-debt');
    const closeDebtLabel = $('#label-close-debt');
    const closeDebtCheckbox = $('#input-close-debt');

    if (!amountInput || !cpSelect) return;

    const updateHint = () => {
        const amount = parseFloat(amountInput.value) || 0;
        const selectedId = cpSelect.value;

        // Find account from current receivables
        const receivables = getActiveReceivables();
        const account = receivables.find(a => a.id === selectedId);

        if (!account || amount <= 0) {
            if (hintEl) hintEl.textContent = '';
            if (closeDebtGroup) closeDebtGroup.style.display = 'none';
            return;
        }

        const balance = Number(account.balance);
        const diff = amount - balance;

        if (diff > 0) {
            // Overpayment
            if (hintEl) {
                hintEl.textContent = `Больше на ${formatMoney(diff)} → будет доход`;
                hintEl.className = 'hint hint-info';
            }
            if (closeDebtGroup) closeDebtGroup.style.display = 'none';
            // Auto-check, will be handled automatically
            if (closeDebtCheckbox) closeDebtCheckbox.checked = true;

        } else if (diff < 0) {
            // Underpayment
            if (hintEl) {
                hintEl.textContent = `Остаётся ${formatMoney(Math.abs(diff))}`;
                hintEl.className = 'hint hint-warning';
            }
            if (closeDebtGroup) closeDebtGroup.style.display = 'block';
            if (closeDebtLabel) closeDebtLabel.textContent = `Закрыть и простить ${formatMoney(Math.abs(diff))}`;

        } else {
            // Exact match
            if (hintEl) hintEl.textContent = '';
            if (closeDebtGroup) closeDebtGroup.style.display = 'none';
        }
    };

    amountInput.addEventListener('input', updateHint);
    cpSelect.addEventListener('change', updateHint);

    // Initial check
    updateHint();

    balanceHintSetup = true;
}

/**
 * Reset balance hint tracking (called on tab change)
 */
export function resetBalanceHint() {
    balanceHintSetup = false;
    const hintEl = $('#hint-debt-balance');
    const closeDebtGroup = $('#group-close-debt');
    if (hintEl) hintEl.textContent = '';
    if (closeDebtGroup) closeDebtGroup.style.display = 'none';
}
