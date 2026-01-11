/**
 * Ghost Budget — Main Application
 * Entry point with auth, state, and UI logic
 */

// ─── Imports ───
import { supabase, auth, accounts, transactions, categories } from './supabase/index.js';
import { DEFAULT_CURRENCY } from './config.js';

// ─── State ───
let currentUser = null;
let currentTransactionType = 'expense';
let accountsCache = [];
let categoriesCache = [];

// ─── DOM Helpers ───
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── Utilities ───
function formatMoney(amount, showSign = false) {
    const absAmount = Math.abs(Number(amount) || 0);
    let formatted;

    if (absAmount >= 1000000) {
        formatted = (absAmount / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    } else if (absAmount >= 1000) {
        formatted = absAmount.toLocaleString('ru-RU');
    } else {
        formatted = absAmount.toString();
    }

    const sign = amount < 0 ? '-' : (showSign && amount > 0 ? '+' : '');
    return `${sign}${DEFAULT_CURRENCY}${formatted}`;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function showLoading(show = true) {
    const overlay = $('#loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function showError(elementId, message) {
    const el = $(`#${elementId}`);
    if (el) {
        el.textContent = message;
        el.style.display = message ? 'block' : 'none';
    }
}

// ─── Auth Flow ───
async function checkAuth() {
    showLoading(true);
    const session = await auth.getSession();

    if (session?.user) {
        currentUser = session.user;
        await ensureProfile(); // Ensure profile exists for legacy users
        showApp();
        await loadData();
    } else {
        showAuthScreen();
    }
    showLoading(false);
}

// Ensure profile exists (for users created before migration)
async function ensureProfile() {
    if (!currentUser) return;

    const profile = await auth.getProfile();
    if (!profile) {
        // Profile doesn't exist — create it
        const { supabase } = await import('./supabase/client.js');
        await supabase.from('profiles').insert({
            id: currentUser.id,
            display_name: currentUser.email
        }).single();
        console.log('Created profile for legacy user:', currentUser.email);
    }
}

function showAuthScreen() {
    $('#auth-screen').style.display = 'flex';
    $('#app-layout').style.display = 'none';
    $('#fab-add').style.display = 'none'; // Hide FAB on auth screen
}

function showApp() {
    $('#auth-screen').style.display = 'none';
    $('#app-layout').style.display = 'grid';

    // Update user email in header
    if (currentUser?.email) {
        $('#user-email').textContent = currentUser.email.split('@')[0];
    }
}

// ─── Data Loading ───
async function loadData() {
    showLoading(true);
    try {
        // Load accounts and categories in parallel
        const [accs, cats] = await Promise.all([
            accounts.getAccounts({ includeHidden: true }),
            categories.getCategories()
        ]);

        accountsCache = accs;
        categoriesCache = cats;

        await renderAll();
    } catch (error) {
        console.error('Error loading data:', error);
    }
    showLoading(false);
}

// ─── Render Functions ───
async function renderAll() {
    renderAccounts();
    renderDebts();
    await renderAnalytics();
    await renderTransactions();
    renderAccountOptions();
    renderCategoriesList();
}

function renderAccounts() {
    const grid = $('#accounts-grid');
    const assets = accountsCache.filter(a => a.type !== 'debt' && !a.is_hidden);

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

    // Calculate totals
    const ownBalance = assets.filter(a => !a.credit_limit).reduce((sum, a) => sum + Number(a.balance), 0);
    const creditBalance = assets.filter(a => a.credit_limit).reduce((sum, a) => sum + Number(a.balance), 0);

    $('#own-balance').textContent = formatMoney(ownBalance);
    $('#credit-balance').textContent = formatMoney(creditBalance);
}

function renderDebts() {
    const debtsSection = $('#debts-section');
    const owedSection = $('#owed-section');
    const debtsRow = $('#debts-row');
    const owedRow = $('#owed-row');

    // Regular Debts (My liabilities)
    const myDebts = accountsCache.filter(a => a.type === 'debt' && Math.abs(a.balance) > 0);
    let myDebtsHtml = myDebts.map(debt => `
        <div class="debt-item">
            <span class="debt-name">${debt.name}:</span>
            <span class="debt-amount">${formatMoney(Math.abs(debt.balance))}</span>
        </div>
    `).join('');

    // Add Credit Card (My Portion)
    const creditAccount = accountsCache.find(a => a.credit_limit && a.type === 'asset');
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

    // Hide owed section for now (can be enhanced later)
    owedSection.style.display = 'none';
}

async function renderAnalytics() {
    const container = $('#analytics');
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
    const totalExpenses = analytics.reduce((sum, a) => sum + a.total, 0);

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

async function renderTransactions() {
    const container = $('#transactions');
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

function renderAccountOptions() {
    const assets = accountsCache.filter(a => a.type !== 'debt');
    const allAccounts = accountsCache;

    const assetOptions = assets.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    const allOptions = allAccounts.map(a => {
        const label = a.type === 'debt' ? `${a.name} (долг)` : a.name;
        return `<option value="${a.id}">${label}</option>`;
    }).join('');

    const accountSelect = $('#input-account');
    const fromSelect = $('#input-from-account');
    const toSelect = $('#input-to-account');

    if (accountSelect) accountSelect.innerHTML = assetOptions;
    if (fromSelect) fromSelect.innerHTML = assetOptions;
    if (toSelect) toSelect.innerHTML = allOptions;
}

function renderCategoriesList() {
    const cats = categoriesCache.filter(c => c.type === currentTransactionType);
    const datalist = $('#categories-list');
    if (datalist) {
        datalist.innerHTML = cats.map(c => `<option value="${c.name}">`).join('');
    }
}

function renderAccountsList() {
    const list = $('#accounts-list');
    if (!list) return;

    list.innerHTML = accountsCache.map(account => `
        <div class="account-list-item">
            <span class="account-name">${account.name}</span>
            <span class="account-balance ${account.balance >= 0 ? 'positive' : 'negative'}">
                ${formatMoney(account.balance)}
            </span>
            <button class="btn btn-ghost btn-sm btn-danger delete-account-btn" data-id="${account.id}" title="Удалить">×</button>
        </div>
    `).join('');
}

// ─── Actions ───
async function handleAddTransaction(e) {
    e.preventDefault();

    const amount = parseFloat($('#input-amount').value);
    const categoryName = $('#input-category')?.value?.trim();
    const accountId = $('#input-account')?.value;
    const fromAccountId = $('#input-from-account')?.value;
    const toAccountId = $('#input-to-account')?.value;
    const note = $('#input-note')?.value?.trim();

    if (!amount || amount <= 0) {
        $('#input-amount').focus();
        return;
    }

    showLoading(true);

    try {
        let category_id = null;

        // Get or create category for expense/income
        if (currentTransactionType !== 'transfer' && categoryName) {
            const category = await categories.getOrCreateCategory(categoryName, currentTransactionType);
            category_id = category?.id;

            // Update cache
            if (category && !categoriesCache.find(c => c.id === category.id)) {
                categoriesCache.push(category);
            }
        }

        const { data, error } = await transactions.createTransaction({
            type: currentTransactionType,
            amount,
            category_id,
            account_id: currentTransactionType !== 'transfer' ? accountId : null,
            from_account_id: currentTransactionType === 'transfer' ? fromAccountId : null,
            to_account_id: currentTransactionType === 'transfer' ? toAccountId : null,
            note
        });

        if (error) {
            alert(error.message);
            showLoading(false);
            return;
        }

        // Reload accounts to get updated balances
        accountsCache = await accounts.getAccounts({ includeHidden: true });

        clearForm();
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

async function handleDeleteTransaction(id) {
    if (!confirm('Удалить транзакцию?')) return;

    showLoading(true);

    const { error } = await transactions.deleteTransaction(id);

    if (error) {
        alert(error.message);
    } else {
        // Reload accounts
        accountsCache = await accounts.getAccounts({ includeHidden: true });
        await renderAll();
    }

    showLoading(false);
}

async function handleAddAccount(e) {
    e.preventDefault();

    const name = $('#new-account-name')?.value?.trim();
    const balance = parseFloat($('#new-account-balance')?.value) || 0;
    const type = $('#new-account-type')?.value || 'asset';

    if (!name) {
        $('#new-account-name')?.focus();
        return;
    }

    showLoading(true);

    const { data, error } = await accounts.createAccount({ name, balance, type });

    if (error) {
        alert(error.message);
    } else {
        // Update cache
        accountsCache.push(data);

        // Reset form
        $('#new-account-name').value = '';
        $('#new-account-balance').value = '0';

        renderAccountsList();
        renderAccountOptions();
        renderAccounts();
    }

    showLoading(false);
}

async function handleDeleteAccount(id) {
    if (!confirm('Удалить счёт?')) return;

    showLoading(true);

    const { error } = await accounts.deleteAccount(id);

    if (error) {
        alert(error.message);
    } else {
        // Update cache
        accountsCache = accountsCache.filter(a => a.id !== id);
        renderAccountsList();
        renderAccountOptions();
        renderAccounts();
    }

    showLoading(false);
}

function clearForm() {
    $('#input-amount').value = '';
    $('#input-category').value = '';
    $('#input-note').value = '';
    $('#input-amount')?.focus();
}

function updateTransactionForm() {
    const isTransfer = currentTransactionType === 'transfer';

    $('#group-category').style.display = isTransfer ? 'none' : 'block';
    $('#group-account').style.display = isTransfer ? 'none' : 'block';
    $('#group-from-account').style.display = isTransfer ? 'block' : 'none';
    $('#group-to-account').style.display = isTransfer ? 'block' : 'none';

    renderCategoriesList();
}

// ─── Modal Functions ───
function openModal(modalId) {
    const modal = $(`#${modalId}`);
    modal?.classList.add('active');
    setTimeout(() => modal?.querySelector('input')?.focus(), 100);
}

function closeModal(modalId) {
    $(`#${modalId}`)?.classList.remove('active');
}

// ─── Event Listeners ───
function setupEventListeners() {
    // Auth tabs
    $$('#auth-tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('#auth-tabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const isLogin = tab.dataset.tab === 'login';
            $('#login-form').style.display = isLogin ? 'block' : 'none';
            $('#register-form').style.display = isLogin ? 'none' : 'block';
        });
    });

    // Login form
    $('#login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading(true);
        showError('login-error', '');

        const email = $('#login-email').value;
        const password = $('#login-password').value;

        const { user, error } = await auth.signIn(email, password);

        if (error) {
            showError('login-error', error.message);
        } else {
            currentUser = user;
            showApp();
            await loadData();
        }
        showLoading(false);
    });

    // Register form
    $('#register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading(true);
        showError('register-error', '');

        const email = $('#register-email').value;
        const password = $('#register-password').value;

        const { user, error } = await auth.signUp(email, password);

        if (error) {
            showError('register-error', error.message);
        } else {
            showError('register-error', '');
            alert('Проверь email для подтверждения регистрации');
        }
        showLoading(false);
    });

    // Logout
    $('#btn-logout')?.addEventListener('click', async () => {
        showLoading(true);
        await auth.signOut();
        currentUser = null;
        showAuthScreen();
        showLoading(false);
    });

    // User dropdown
    $('#user-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        $('#user-dropdown')?.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        $('#user-dropdown')?.classList.remove('active');
    });

    // Transaction tabs
    $$('#transaction-tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('#transaction-tabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTransactionType = tab.dataset.type;
            updateTransactionForm();
        });
    });

    // Transaction form
    $('#transaction-form')?.addEventListener('submit', handleAddTransaction);

    // Transaction delete (event delegation)
    $('#transactions')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('transaction-delete')) {
            handleDeleteTransaction(e.target.dataset.id);
        }
    });

    // Manage accounts
    $('#btn-manage-accounts')?.addEventListener('click', () => {
        renderAccountsList();
        openModal('modal-accounts');
    });

    $('#modal-accounts-close')?.addEventListener('click', () => closeModal('modal-accounts'));

    // Add account form
    $('#add-account-form')?.addEventListener('submit', handleAddAccount);

    // Delete account (event delegation)
    $('#accounts-list')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-account-btn')) {
            handleDeleteAccount(e.target.dataset.id);
        }
    });

    // Modal overlay click
    $$('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    // Period select
    $('#period-select')?.addEventListener('change', renderAnalytics);

    // FAB
    $('#fab-add')?.addEventListener('click', () => {
        $('.side-panel')?.classList.add('open');
        setTimeout(() => $('#input-amount')?.focus(), 300);
    });

    // Panel close
    $('#panel-close')?.addEventListener('click', () => {
        $('.side-panel')?.classList.remove('open');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            $$('.modal-overlay.active').forEach(m => m.classList.remove('active'));
            $('.side-panel')?.classList.remove('open');
            $('#user-dropdown')?.classList.remove('active');
        }
    });

    // Auth state change listener
    auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            currentUser = session.user;
            showApp();
            loadData();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            showAuthScreen();
        }
    });
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkAuth();
});
