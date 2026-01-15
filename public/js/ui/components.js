/**
 * Ghost Budget — UI Components
 * Render functions for accounts, transactions, analytics
 */

import { $, formatMoney, formatDate } from '../utils.js';
import { 
    getAssetAccounts, 
    getActiveDebts, 
    getCreditAccount,
    getOwnBalance,
    getCreditBalance,
    getAccounts,
    getCategoriesByType,
    getTransactionType
} from '../state.js';
import { transactions } from '../supabase/index.js';

// ─── Accounts ───

/**
 * Render accounts grid
 */
export function renderAccounts() {
    const grid = $('#accounts-grid');
    if (!grid) return;

    const assets = getAssetAccounts();

    grid.innerHTML = assets.map(account => {
        let subline = '';
        const mainClass = account.balance >= 0 ? 'positive' : 'negative';

        if (account.credit_limit) {
            const debt = account.credit_limit - account.balance;
            if (debt > 0) {
                subline = `<div style="font-size: 0.75rem; color: var(--expense); margin-top: 4px;">Долг банку: ${formatMoney(debt)}</div>`;
            } else {
                subline = `<div style="font-size: 0.75rem; color: var(--income); margin-top: 4px;">Погашено</div>`;
            }
        }

        return `
            <div class="account-card ${account.balance < 0 ? 'debt' : ''}">
                <div class="account-name">${account.name}</div>
                <div class="account-balance ${mainClass}">${formatMoney(account.balance)}</div>
                ${subline}
            </div>
        `;
    }).join('');

    // Update balance totals
    $('#own-balance').textContent = formatMoney(getOwnBalance());
    $('#credit-balance').textContent = formatMoney(getCreditBalance());
}

/**
 * Render debts section
 */
export function renderDebts() {
    const debtsSection = $('#debts-section');
    const owedSection = $('#owed-section');
    const debtsRow = $('#debts-row');

    if (!debtsSection || !debtsRow) return;

    // Regular Debts (My liabilities)
    const myDebts = getActiveDebts();
    let myDebtsHtml = myDebts.map(debt => `
        <div class="debt-item">
            <span class="debt-name">${debt.name}:</span>
            <span class="debt-amount">${formatMoney(Math.abs(debt.balance))}</span>
        </div>
    `).join('');

    // Add Credit Card (My Portion)
    const creditAccount = getCreditAccount();
    if (creditAccount) {
        const debt = creditAccount.credit_limit - creditAccount.balance;
        if (debt > 50) {
            myDebtsHtml += `
                <div class="debt-item">
                    <span class="debt-name">Кредитка:</span>
                    <span class="debt-amount">${formatMoney(debt)}</span>
                </div>
            `;
        }
    }

    // Render My Debts Section
    if (!myDebtsHtml) {
        debtsSection.style.display = 'none';
    } else {
        debtsSection.style.display = 'block';
        debtsRow.innerHTML = myDebtsHtml;
    }

    // Hide owed section for now
    if (owedSection) {
        owedSection.style.display = 'none';
    }
}

// ─── Analytics ───

/**
 * Render expense analytics
 */
export async function renderAnalytics() {
    const container = $('#analytics');
    if (!container) return;

    const period = $('#period-select')?.value || 'month';

    // Calculate date range
    const now = new Date();
    let startDate = null;

    if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    } else if (period === 'week') {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        startDate = weekStart.toISOString().split('T')[0];
    }

    const analytics = await transactions.getExpenseAnalytics({ startDate });

    if (analytics.length === 0) {
        container.innerHTML = '<div class="analytics-empty">Нет расходов за этот период</div>';
        return;
    }

    const maxAmount = analytics[0].total;
    const totalExpenses = analytics.reduce((sum, a) => sum + Number(a.total), 0);

    container.innerHTML = analytics.map(({ category_name, total }) => {
        const percent = Math.round((total / totalExpenses) * 100);
        const barWidth = Math.round((total / maxAmount) * 100);

        return `
            <div class="analytics-item">
                <span class="analytics-category">${category_name}</span>
                <div class="analytics-bar-wrapper">
                    <div class="analytics-bar">
                        <div class="analytics-bar-fill" style="width: ${barWidth}%"></div>
                    </div>
                </div>
                <span class="analytics-amount">${formatMoney(total)}</span>
                <span class="analytics-percent">${percent}%</span>
            </div>
        `;
    }).join('');
}

// ─── Transactions ───

/**
 * Render transactions list
 */
export async function renderTransactions() {
    const container = $('#transactions');
    if (!container) return;

    const recent = await transactions.getTransactions({ limit: 50 });

    if (recent.length === 0) {
        container.innerHTML = '<div class="transactions-empty">Нет записей. Добавь первую через панель справа.</div>';
        return;
    }

    container.innerHTML = recent.map(t => {
        let info, amount, amountClass, accountInfo;

        if (t.type === 'transfer') {
            const fromName = t.from_account?.name || '?';
            const toName = t.to_account?.name || '?';

            if (t.to_account?.type === 'debt') {
                info = `${fromName} → ${toName}`;
                amount = '-' + formatMoney(t.amount);
                amountClass = 'expense';
                accountInfo = 'погашение';
            } else {
                info = `${fromName} → ${toName}`;
                amount = formatMoney(t.amount);
                amountClass = 'transfer';
                accountInfo = 'перевод';
            }
        } else {
            info = t.category?.name || 'Без категории';
            amount = (t.type === 'expense' ? '-' : '+') + formatMoney(t.amount);
            amountClass = t.type;
            accountInfo = t.account?.name || '?';
        }

        return `
            <div class="transaction" data-id="${t.id}">
                <span class="transaction-date">${formatDate(t.date)}</span>
                <div class="transaction-info">
                    <span class="transaction-category">${info}</span>
                    ${t.note ? `<span class="transaction-note">${t.note}</span>` : ''}
                </div>
                <span class="transaction-account">${accountInfo}</span>
                <span class="transaction-amount ${amountClass}">${amount}</span>
                <button class="transaction-delete" data-id="${t.id}" title="Удалить">×</button>
            </div>
        `;
    }).join('');
}

// ─── Form Selects ───

/**
 * Render account options in select dropdowns
 */
export function renderAccountOptions() {
    const allAccounts = getAccounts();
    const assets = allAccounts.filter(a => a.type !== 'debt');

    const assetOptions = assets.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

    const accountSelect = $('#input-account');
    const fromSelect = $('#input-from-account');

    if (accountSelect) accountSelect.innerHTML = assetOptions;
    if (fromSelect) {
        fromSelect.innerHTML = assetOptions;
        updateTransferSelects();
    }
}

/**
 * Update transfer "to" select with mutual exclusion
 */
export function updateTransferSelects() {
    const fromSelect = $('#input-from-account');
    const toSelect = $('#input-to-account');
    if (!fromSelect || !toSelect) return;

    const selectedFromId = fromSelect.value;
    const selectedToId = toSelect.value;
    const allAccounts = getAccounts();

    // Build "to" options excluding the selected "from" account
    const toOptions = allAccounts
        .filter(a => a.id !== selectedFromId)
        .map(a => {
            const label = a.type === 'debt' ? `${a.name} (долг)` : a.name;
            return `<option value="${a.id}">${label}</option>`;
        })
        .join('');

    toSelect.innerHTML = toOptions;

    // Try to preserve previous "to" selection if still valid
    if (selectedToId && selectedToId !== selectedFromId) {
        toSelect.value = selectedToId;
    }
}

/**
 * Render categories datalist
 */
export function renderCategoriesList() {
    const transactionType = getTransactionType();
    const cats = getCategoriesByType(transactionType);
    const datalist = $('#categories-list');
    if (datalist) {
        datalist.innerHTML = cats.map(c => `<option value="${c.name}">`).join('');
    }
}

/**
 * Render accounts list in modal
 */
export function renderAccountsList() {
    const list = $('#accounts-list');
    if (!list) return;

    const allAccounts = getAccounts();

    list.innerHTML = allAccounts.map(account => `
        <div class="account-list-item">
            <span class="account-name">${account.name}</span>
            <div class="account-actions">
                <span class="account-balance ${account.balance >= 0 ? 'positive' : 'negative'}">
                    ${formatMoney(account.balance)}
                </span>
                <button class="btn btn-ghost btn-sm edit-account-btn" data-id="${account.id}" title="Редактировать">✎</button>
                <button class="btn btn-ghost btn-sm btn-danger delete-account-btn" data-id="${account.id}" title="Удалить">×</button>
            </div>
        </div>
    `).join('');
}

// ─── Render All ───

/**
 * Render all components
 */
export async function renderAll() {
    renderAccounts();
    renderDebts();
    await renderAnalytics();
    await renderTransactions();
    renderAccountOptions();
    renderCategoriesList();
}
