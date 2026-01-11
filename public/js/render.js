/**
 * Ghost Budget — Render Module
 * All UI rendering functions
 */

import { formatMoney, formatDate, $ } from './utils.js';
import {
    getData,
    getAccountById,
    getTransactionType,
    getCategories,
    getAssetAccounts,
    getAllAccounts
} from './state.js';
import { calculateCreditBreakdown } from './actions.js';

/**
 * Render all account cards in the grid
 */
export function renderAccounts() {
    const grid = $('#accounts-grid');
    const data = getData();
    if (!data) return;

    const assets = data.accounts.filter(a => a.type !== 'debt' && !a.isHidden);

    grid.innerHTML = assets.map(account => {
        let subline = '';
        let mainClass = account.balance >= 0 ? 'positive' : 'negative';

        if (account.limit) {
            const breakdown = calculateCreditBreakdown(account);
            if (breakdown && breakdown.total > 0) {
                subline = `<div style="font-size: 0.75rem; color: var(--expense); margin-top: 4px;">Долг банку: ${formatMoney(breakdown.total)}</div>`;
            } else {
                subline = `<div style="font-size: 0.75rem; color: var(--income); margin-top: 4px;">Погашено</div>`;
            }
        }

        return `
    <div class="account-card ${account.balance < 0 ? 'debt' : ''}">
      <div class="account-name">${account.name}</div>
      <div class="account-balance ${mainClass}">
        ${formatMoney(account.balance)}
      </div>
      ${subline}
    </div>
  `}).join('');

    // Calculate and display balances
    const ownBalance = assets.filter(a => !a.limit).reduce((sum, a) => sum + a.balance, 0);
    const creditBalance = assets.filter(a => a.limit).reduce((sum, a) => sum + a.balance, 0);

    $('#own-balance').textContent = formatMoney(ownBalance);
    $('#credit-balance').textContent = formatMoney(creditBalance);
}

/**
 * Render debts sections (my debts + owed to me)
 */
export function renderDebts() {
    const debtsSection = $('#debts-section');
    const owedSection = $('#owed-section');
    const debtsRow = $('#debts-row');
    const owedRow = $('#owed-row');
    const data = getData();

    if (!data) return;

    // 1. Regular Debts (My liabilities)
    const myDebts = data.accounts.filter(a => a.type === 'debt' && Math.abs(a.balance) > 0);
    let myDebtsHtml = myDebts.map(debt => `
    <div class="debt-item">
      <span class="debt-name">${debt.name}:</span>
      <span class="debt-amount">${formatMoney(Math.abs(debt.balance))}</span>
    </div>
  `).join('');

    // 2. Add Credit Card (My Portion)
    const creditAccount = data.accounts.find(a => a.id === 'credit');
    let friendsDebtVal = 0;

    if (creditAccount) {
        const breakdown = calculateCreditBreakdown(creditAccount);
        if (breakdown && breakdown.my > 50) {
            myDebtsHtml += `
        <div class="debt-item">
          <span class="debt-name">Кредитка (Мои):</span>
          <span class="debt-amount">${formatMoney(breakdown.my)}</span>
        </div>
      `;
        }
        if (breakdown) friendsDebtVal = breakdown.friends;
    }

    // 3. Render My Debts Section
    if (!myDebtsHtml) {
        debtsSection.style.display = 'none';
    } else {
        debtsSection.style.display = 'block';
        debtsRow.innerHTML = myDebtsHtml;
    }

    // 4. Render Owed TO Me Section
    if (friendsDebtVal > 50) {
        owedSection.style.display = 'block';
        owedRow.innerHTML = `
      <div class="debt-item">
        <span class="debt-name">Друзья (Реклама):</span>
        <span class="debt-amount" style="color: var(--income);">${formatMoney(friendsDebtVal)}</span>
      </div>
    `;
    } else {
        owedSection.style.display = 'none';
    }
}

/**
 * Render analytics (expense breakdown by category)
 */
export function renderAnalytics() {
    const container = $('#analytics');
    const period = $('#period-select').value;
    const data = getData();

    if (!data) return;

    // Filter transactions by period
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    let filteredTransactions = data.transactions.filter(t => t.type === 'expense');

    if (period === 'month') {
        filteredTransactions = filteredTransactions.filter(t => new Date(t.date) >= startOfMonth);
    } else if (period === 'week') {
        filteredTransactions = filteredTransactions.filter(t => new Date(t.date) >= startOfWeek);
    }

    // Group by category
    const categoryTotals = {};
    filteredTransactions.forEach(t => {
        const cat = t.category || 'Другое';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
    });

    const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1]);

    if (sortedCategories.length === 0) {
        container.innerHTML = '<div class="analytics-empty">Нет расходов за этот период</div>';
        return;
    }

    const maxAmount = sortedCategories[0][1];
    const totalExpenses = sortedCategories.reduce((sum, [, amount]) => sum + amount, 0);

    container.innerHTML = sortedCategories.map(([category, amount]) => {
        const percent = Math.round((amount / totalExpenses) * 100);
        const barWidth = Math.round((amount / maxAmount) * 100);

        return `
      <div class="analytics-item">
        <span class="analytics-category">${category}</span>
        <div class="analytics-bar-wrapper">
          <div class="analytics-bar">
            <div class="analytics-bar-fill" style="width: ${barWidth}%"></div>
          </div>
        </div>
        <span class="analytics-amount">${formatMoney(amount)}</span>
        <span class="analytics-percent">${percent}%</span>
      </div>
    `;
    }).join('');
}

/**
 * Render transactions list
 * Uses data attributes instead of inline onclick
 */
export function renderTransactions() {
    const container = $('#transactions');
    const data = getData();

    if (!data) return;

    const recent = data.transactions.slice(-50).reverse();

    if (recent.length === 0) {
        container.innerHTML = '<div class="transactions-empty">Нет записей. Добавь первую через панель справа.</div>';
        return;
    }

    container.innerHTML = recent.map(t => {
        let info, amount, amountClass, accountInfo;

        if (t.type === 'transfer') {
            const fromAcc = getAccountById(t.fromAccountId);
            const toAcc = getAccountById(t.toAccountId);

            if (toAcc?.type === 'debt') {
                info = `${fromAcc?.name || '?'} → ${toAcc?.name || '?'}`;
                amount = '-' + formatMoney(t.amount);
                amountClass = 'expense';
                accountInfo = 'погашение';
            } else {
                info = `${fromAcc?.name || '?'} → ${toAcc?.name || '?'}`;
                amount = formatMoney(t.amount);
                amountClass = 'transfer';
                accountInfo = 'перевод';
            }
        } else {
            const account = getAccountById(t.accountId);
            info = t.category || 'Без категории';
            amount = (t.type === 'expense' ? '-' : '+') + formatMoney(t.amount);
            amountClass = t.type;
            accountInfo = account?.name || '?';
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
        <button class="transaction-delete" data-action="delete-transaction" data-id="${t.id}" title="Удалить">×</button>
      </div>
    `;
    }).join('');
}

/**
 * Render account options for dropdowns
 */
export function renderAccountOptions() {
    const assets = getAssetAccounts();
    const allAccounts = getAllAccounts();

    const assetOptions = assets.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    const allOptions = allAccounts.map(a => {
        const label = a.type === 'debt' ? `${a.name} (долг)` : a.name;
        return `<option value="${a.id}">${label}</option>`;
    }).join('');

    $('#input-account').innerHTML = assetOptions;
    $('#input-from-account').innerHTML = assetOptions;
    $('#input-to-account').innerHTML = allOptions;
}

/**
 * Render categories datalist
 */
export function renderCategoriesList() {
    const type = getTransactionType();
    const categories = getCategories(type);
    const datalist = $('#categories-list');
    datalist.innerHTML = categories.map(c => `<option value="${c}">`).join('');
}

/**
 * Render accounts list in modal
 * Uses data attributes instead of inline onclick
 */
export function renderAccountsList() {
    const list = $('#accounts-list');
    const data = getData();

    if (!data) return;

    list.innerHTML = data.accounts.map(account => `
    <div class="account-list-item" data-id="${account.id}">
      <span class="account-name">${account.name}</span>
      <span class="account-balance ${account.balance >= 0 ? 'positive' : 'negative'}">
        ${formatMoney(account.balance)}
      </span>
      <button class="btn btn-ghost btn-sm btn-danger" data-action="delete-account" data-id="${account.id}" title="Удалить">×</button>
    </div>
  `).join('');
}

/**
 * Render everything
 */
export function renderAll() {
    renderAccounts();
    renderDebts();
    renderAnalytics();
    renderTransactions();
    renderAccountOptions();
    renderCategoriesList();
}
