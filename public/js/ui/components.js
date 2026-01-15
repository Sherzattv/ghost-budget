/**
 * Ghost Budget — UI Components
 * Render functions for accounts, transactions, analytics, obligations
 * 
 * New Architecture:
 * - renderObligations() replaces old renderDebts()
 * - Supports receivable/liability account types
 */

import { $, formatMoney, formatDate } from '../utils.js';
import {
    getAssetAccounts,
    getActiveReceivables,
    getActiveLiabilities,
    getCreditAccount,
    getOwnBalance,
    getCreditBalance,
    getTotalReceivables,
    getTotalLiabilities,
    getNetPosition,
    hasActiveObligations,
    getOverdueObligations,
    getAccounts,
    getCategoriesByType,
    getTransactionType,
    getCounterparties
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

// ─── Obligations (NEW) ───

/**
 * Render obligations section (receivables + liabilities)
 * Replaces old renderDebts()
 */
export function renderObligations() {
    const section = $('#obligations-section');
    const receivablesRow = $('#receivables-row');
    const liabilitiesRow = $('#liabilities-row');
    const receivablesGroup = $('#receivables-group');
    const liabilitiesGroup = $('#liabilities-group');

    if (!section) return;

    const receivables = getActiveReceivables();
    const liabilities = getActiveLiabilities();
    const overdueList = getOverdueObligations();

    // Update summary totals
    const totalReceivablesEl = $('#total-receivables');
    const totalLiabilitiesEl = $('#total-liabilities');

    if (totalReceivablesEl) {
        totalReceivablesEl.textContent = `+${formatMoney(getTotalReceivables())}`;
    }
    if (totalLiabilitiesEl) {
        totalLiabilitiesEl.textContent = `−${formatMoney(getTotalLiabilities())}`;
    }

    // Hide section if no obligations
    if (!hasActiveObligations()) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    // Render receivables (мне должны)
    if (receivablesRow && receivablesGroup) {
        if (receivables.length === 0) {
            receivablesGroup.style.display = 'none';
        } else {
            receivablesGroup.style.display = 'block';
            receivablesRow.innerHTML = receivables.map(acc =>
                renderObligationCard(acc, overdueList)
            ).join('');
        }
    }

    // Render liabilities (я должен)
    if (liabilitiesRow && liabilitiesGroup) {
        if (liabilities.length === 0) {
            liabilitiesGroup.style.display = 'none';
        } else {
            liabilitiesGroup.style.display = 'block';
            liabilitiesRow.innerHTML = liabilities.map(acc =>
                renderObligationCard(acc, overdueList)
            ).join('');
        }
    }
}

/**
 * Render single obligation card
 * @param {Object} account - receivable or liability account
 * @param {Array} overdueList - list of overdue accounts
 * @returns {string} HTML
 */
function renderObligationCard(account, overdueList = []) {
    const isOverdue = overdueList.some(o => o.id === account.id);
    const isReceivable = account.type === 'receivable';

    let statusClass = isReceivable ? 'positive' : 'negative';
    if (isOverdue) statusClass = 'overdue';

    const displayName = account.counterparty || account.name;
    const displayBalance = isReceivable
        ? `+${formatMoney(account.balance)}`
        : `−${formatMoney(Math.abs(account.balance))}`;

    const arrow = isReceivable ? '↑' : '↓';

    let metaInfo = '';
    if (account.expected_return_date) {
        metaInfo = formatDate(account.expected_return_date);
    }
    if (isOverdue) {
        metaInfo += ' <span class="status-overdue">просрочен</span>';
    }
    if (account.obligation_kind && account.obligation_kind !== 'person') {
        const kindLabels = {
            'credit': 'кредит',
            'installment': 'рассрочка',
            'credit_card': 'кредитка'
        };
        metaInfo += ` <span class="obligation-kind">${kindLabels[account.obligation_kind] || account.obligation_kind}</span>`;
    }

    return `
        <div class="obligation-card ${statusClass}" data-id="${account.id}">
            <div class="card-main">
                <div class="card-left">
                    <span class="card-arrow ${isReceivable ? 'up' : 'down'}">${arrow}</span>
                    <span class="card-name">${displayName}</span>
                </div>
                <span class="card-amount">${displayBalance}</span>
            </div>
            ${metaInfo ? `<div class="card-meta">${metaInfo}</div>` : ''}
            <button class="card-action" data-id="${account.id}" data-type="${account.type}" title="Возврат">+</button>
        </div>
    `;
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

        if (t.type === 'transfer' || t.type === 'debt_op') {
            const fromName = t.from_account?.name || t.debt_counterparty || '?';
            const toName = t.to_account?.name || t.debt_counterparty || '?';

            // Determine display based on debt direction
            if (t.is_debt && t.debt_direction) {
                const directionLabels = {
                    'lent': 'дал в долг',
                    'borrowed': 'занял',
                    'return': 'возврат',
                    'payment': 'погашение',
                    'forgive': 'списано',
                    'interest': 'проценты'
                };
                info = `${t.debt_counterparty || fromName} → ${toName}`;
                accountInfo = directionLabels[t.debt_direction] || 'долг';

                // Color based on direction
                if (['lent', 'payment'].includes(t.debt_direction)) {
                    amount = '-' + formatMoney(t.amount);
                    amountClass = 'expense';
                } else if (['borrowed', 'return'].includes(t.debt_direction)) {
                    amount = '+' + formatMoney(t.amount);
                    amountClass = 'income';
                } else {
                    amount = formatMoney(t.amount);
                    amountClass = 'transfer';
                }
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
    const assets = allAccounts.filter(a => a.type === 'asset' || a.type === 'savings');

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
            let label = a.name;
            if (a.type === 'liability') label = `${a.counterparty || a.name} (долг)`;
            if (a.type === 'receivable') label = `${a.counterparty || a.name} (мне должны)`;
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
    const cats = getCategoriesByType(transactionType === 'debt' ? 'expense' : transactionType);
    const datalist = $('#categories-list');
    if (datalist) {
        datalist.innerHTML = cats.map(c => `<option value="${c.name}">`).join('');
    }
}

/**
 * Render counterparties datalist
 */
export function renderCounterpartiesList() {
    const counterparties = getCounterparties();
    const datalist = $('#counterparties-list');
    if (datalist) {
        datalist.innerHTML = counterparties.map(c => `<option value="${c}">`).join('');
    }
}

/**
 * Render accounts list in modal
 */
export function renderAccountsList() {
    const list = $('#accounts-list');
    if (!list) return;

    const allAccounts = getAccounts();

    list.innerHTML = allAccounts.map(account => {
        const typeLabels = {
            'asset': 'актив',
            'savings': 'накопления',
            'receivable': 'мне должны',
            'liability': 'я должен'
        };
        const typeLabel = typeLabels[account.type] || account.type;

        return `
            <div class="account-list-item">
                <div class="account-list-info">
                    <span class="account-name">${account.counterparty || account.name}</span>
                    <span class="account-type-label">${typeLabel}</span>
                </div>
                <div class="account-actions">
                    <span class="account-balance ${account.balance >= 0 ? 'positive' : 'negative'}">
                        ${formatMoney(account.balance)}
                    </span>
                    <button class="btn btn-ghost btn-sm edit-account-btn" data-id="${account.id}" title="Редактировать">✏️</button>
                    <button class="btn btn-ghost btn-sm archive-account-btn" data-id="${account.id}" title="В архив">📦</button>
                    <button class="btn btn-ghost btn-sm btn-danger delete-account-btn" data-id="${account.id}" title="Удалить">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// ─── Render All ───

/**
 * Render all components
 */
export async function renderAll() {
    renderAccounts();
    renderObligations();
    await renderAnalytics();
    await renderTransactions();
    renderAccountOptions();
    renderCategoriesList();
    renderCounterpartiesList();
}
