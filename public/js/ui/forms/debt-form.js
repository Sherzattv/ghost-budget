/**
 * Ghost Budget — Debt Form Handlers
 * Debt operations: lend, borrow, collect, repay
 */

import { $, showLoading, isValidAmount } from '../../utils.js';
import {
    setAccounts,
    getAccounts,
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

/**
 * Populate debt account select with asset/savings accounts
 */
function populateDebtAccountSelect() {
    const select = $('#input-debt-account');
    if (!select) return;

    const allAccounts = getAccounts();
    // Only show assets and savings (not debts)
    const assetAccounts = allAccounts.filter(a =>
        ['asset', 'savings'].includes(a.type)
    );

    select.innerHTML = assetAccounts
        .map(a => `<option value="${a.id}">${a.name}</option>`)
        .join('');
}

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
    const accountId = $('#input-debt-account')?.value;
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
        showValidationError('#input-debt-account', 'Выбери счёт');
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
        resetBalanceHint();
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
 * Handle debt action button click (Я дал / Я взял)
 */
// Import FormController
import { formController } from './form-controller.js';

/**
 * Handle debt action button click (Я дал / Я взял)
 */
export function handleDebtActionClick(action) {
    formController.setDebtAction(action);
}

/**
 * Handle debt type radio change
 */
export function handleDebtTypeChange() {
    const debtType = document.querySelector('input[name="debt-type"]:checked')?.value || 'person';
    formController.setDebtType(debtType);
}

/**
 * Handle credit/installment toggle click
 */
export function handleCreditToggleClick(creditType) {
    formController.setCreditType(creditType);
}

// Deprecated functions kept for compatibility during transition if needed, 
// but should be removed from exports once main.js is updated.
export function resetDebtForm() {
    formController.setDebtAction(null);
    formController.setDebtType('person');
    formController.setCreditType('credit');

    const inputs = [
        'input-debt-action', 'input-amount', 'input-counterparty',
        'input-monthly-payment', 'input-payment-day',
        'input-interest-rate', 'input-return-date', 'input-note'
    ];

    inputs.forEach(id => {
        const el = $(`#${id}`);
        if (el) el.value = '';
    });
}

/**
 * Update balance hint text (called on input/change)
 */
export function updateBalanceHint() {
    const amountInput = $('#input-amount');
    const cpSelect = $('#input-counterparty-select');
    const hintEl = $('#hint-debt-balance');
    const closeDebtLabel = $('#label-close-debt');

    // Visibility of group-close-debt is handled by FormController (condition)
    // Here we only update the TEXT content of the hint

    if (!amountInput || !cpSelect || !hintEl) return;

    const amount = parseFloat(amountInput.value) || 0;
    const selectedId = cpSelect.value;

    // Find account from current receivables/liabilities
    // We need both because action might be collect or repay
    const receivables = getActiveReceivables();
    const liabilities = getActiveLiabilities();
    const account = [...receivables, ...liabilities].find(a => a.id === selectedId);

    if (!account || amount <= 0) {
        hintEl.textContent = '';
        return;
    }

    const balance = Math.abs(Number(account.balance));
    const diff = amount - balance;

    if (diff > 0.01) {
        // Overpayment - checkbox doesn't make sense here
        hintEl.textContent = `Больше на ${formatMoney(diff)} → будет доход`;
        hintEl.className = 'hint hint-info';

        // Reset checkbox label since it's not relevant for overpayment
        if (closeDebtLabel) {
            closeDebtLabel.textContent = 'Закрыть долг полностью';
        }

    } else if (diff < -0.01) {
        // Underpayment
        hintEl.textContent = `Остаётся ${formatMoney(Math.abs(diff))}`;
        hintEl.className = 'hint hint-warning';

        if (closeDebtLabel) {
            closeDebtLabel.textContent = `Закрыть и простить ${formatMoney(Math.abs(diff))}`;
        }
    } else {
        // Exact match - hide hint completely
        hintEl.textContent = '';
        hintEl.className = 'hint';  // Reset to base class (no background)
        if (closeDebtLabel) {
            closeDebtLabel.textContent = 'Закрыть долг полностью';
        }
    }
}

/**
 * Reset balance hint tracking (called on tab change)
 */
export function resetBalanceHint() {
    const hintEl = $('#hint-debt-balance');
    if (hintEl) {
        hintEl.textContent = '';
        hintEl.className = 'hint';  // Reset to base class (no background)
    }
}
