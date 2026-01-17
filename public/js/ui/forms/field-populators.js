/**
 * Field Populators
 * Pure functions to generate options for select fields
 */

import { getAccounts, getActiveReceivables, getActiveLiabilities } from '../../state.js';
import { formatMoney } from '../../utils.js';

export const populators = {
    /**
     * Standard account select (assets + savings)
     */
    'input-account': () => {
        const accounts = getAccounts() || [];
        // Filter for assets and savings
        const validAccounts = accounts.filter(a => ['asset', 'savings'].includes(a.type));

        return validAccounts.map(a => ({
            value: a.id,
            label: `${a.name} (${formatMoney(a.balance)})`
        }));
    },

    /**
     * Debt account select (same as account, mainly assets)
     */
    'input-debt-account': () => {
        const accounts = getAccounts() || [];
        // Filter for assets and savings
        const validAccounts = accounts.filter(a => ['asset', 'savings'].includes(a.type));

        return validAccounts.map(a => ({
            value: a.id,
            label: `${a.name} (${formatMoney(a.balance)})`
        }));
    },

    /**
     * Counterparty select for Debt operations (Receivables/Liabilities)
     * @param {string} action - 'collect' or 'repay'
     */
    'input-counterparty-select': (action) => {
        let list = [];
        if (action === 'collect') {
            list = getActiveReceivables();
        } else if (action === 'repay') {
            list = getActiveLiabilities();
        }

        return list.map(a => ({
            value: a.id,
            label: `${a.counterparty || a.name} (${formatMoney(Math.abs(a.balance))})`
        }));
    },

    /**
     * Transfer FROM account
     */
    'input-from-account': () => {
        const accounts = getAccounts() || [];
        // Exclude receivables/liabilities typically, but user might transfer from anywhere?
        // Usually transfers are between assets/savings
        const validAccounts = accounts.filter(a => ['asset', 'savings'].includes(a.type));

        return validAccounts.map(a => ({
            value: a.id,
            label: `${a.name} (${formatMoney(a.balance)})`
        }));
    },

    /**
     * Transfer TO account
     * @param {string} excludeId - ID to exclude (from account)
     */
    'input-to-account': (excludeId) => {
        const accounts = getAccounts() || [];
        // Can transfer to asset, savings, maybe liability (paying off credit card via transfer)?
        // For now limit to assets/savings for simplicity unless specified otherwise
        const validAccounts = accounts.filter(a =>
            ['asset', 'savings', 'liability'].includes(a.type) && a.id !== excludeId
        );

        return validAccounts.map(a => ({
            value: a.id,
            label: `${a.name} (${formatMoney(a.balance)})`
        }));
    }
};

/**
 * Helper to apply options to a select element
 * @param {string} selectId 
 * @param {Array<{value:string, label:string}>} options 
 */
export function populateSelect(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const currentValue = select.value;

    select.innerHTML = options
        .map(o => `<option value="${o.value}">${o.label}</option>`)
        .join('');

    // Restore selection if possible, otherwise select first or empty
    if (currentValue && options.some(o => o.value === currentValue)) {
        select.value = currentValue;
    } else if (options.length > 0) {
        select.value = options[0].value;
    }
}
