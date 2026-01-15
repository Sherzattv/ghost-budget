/**
 * Ghost Budget — Main Application
 * Entry point with auth flow and event listeners
 * 
 * Architecture:
 * - state.js      → Application state management
 * - utils.js      → Helper functions
 * - ui/           → UI components and handlers
 * - supabase/     → API layer
 */

// ─── Imports ───
import { auth, accounts, categories } from './supabase/index.js';
import { $, $$, showLoading, showError } from './utils.js';
import {
    setUser, getUser, setAccounts, setCategories,
    setTransactionType, resetState
} from './state.js';
import {
    renderAll, renderAccountsList, renderAnalytics,
    updateTransferSelects
} from './ui/components.js';
import {
    handleAddTransaction, handleDeleteTransaction,
    handleAddAccount, handleDeleteAccount,
    handleModifyAccount, handleSaveAccountChanges,
    handleTransactionTypeChange, updateTransactionForm,
    updateDebtFormFields
} from './ui/forms.js';
import {
    openModal, closeModal,
    setupModalOverlays, setupModalKeyboard
} from './ui/modals.js';

// ─── Auth Flow ───

/**
 * Check authentication status and show appropriate screen
 */
async function checkAuth() {
    showLoading(true);
    const session = await auth.getSession();

    if (session?.user) {
        setUser(session.user);
        await ensureProfile();
        showApp();
        await loadData();
    } else {
        showAuthScreen();
    }
    showLoading(false);
}

/**
 * Ensure profile exists for legacy users
 */
async function ensureProfile() {
    const user = getUser();
    if (!user) return;

    const profile = await auth.getProfile();
    if (!profile) {
        const { supabase } = await import('./supabase/client.js');
        await supabase.from('profiles').insert({
            id: user.id,
            display_name: user.email
        }).single();
        console.log('Created profile for legacy user:', user.email);
    }
}

/**
 * Show authentication screen
 */
function showAuthScreen() {
    $('#auth-screen').style.display = 'flex';
    $('#app-layout').style.display = 'none';
    $('#fab-add').style.display = 'none';
}

/**
 * Show main application
 */
function showApp() {
    $('#auth-screen').style.display = 'none';
    $('#app-layout').style.display = 'grid';

    const user = getUser();
    if (user?.email) {
        $('#user-email').textContent = user.email.split('@')[0];
    }
}

// ─── Data Loading ───

/**
 * Load all application data
 */
async function loadData() {
    showLoading(true);
    try {
        const [accs, cats] = await Promise.all([
            accounts.getAccounts({ includeHidden: true }),
            categories.getCategories()
        ]);

        setAccounts(accs);
        setCategories(cats);

        await renderAll();
    } catch (error) {
        console.error('Error loading data:', error);
    }
    showLoading(false);
}

// ─── Event Listeners ───

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // ─── Auth ───

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
            setUser(user);
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
        resetState();
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

    // ─── Transactions ───

    // Transaction tabs
    $$('#transaction-tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('#transaction-tabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            handleTransactionTypeChange(tab.dataset.type);
        });
    });

    // Transaction form
    $('#transaction-form')?.addEventListener('submit', handleAddTransaction);

    // Transfer account mutual exclusion
    $('#input-from-account')?.addEventListener('change', updateTransferSelects);

    // Debt direction change
    $('#input-debt-direction')?.addEventListener('change', updateDebtFormFields);

    // Transaction delete (event delegation)
    $('#transactions')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('transaction-delete')) {
            handleDeleteTransaction(e.target.dataset.id);
        }
    });

    // ─── Accounts ───

    // Manage accounts button
    $('#btn-manage-accounts')?.addEventListener('click', () => {
        renderAccountsList();
        openModal('modal-accounts');
    });

    $('#modal-accounts-close')?.addEventListener('click', () => closeModal('modal-accounts'));

    // Add account form
    $('#add-account-form')?.addEventListener('submit', handleAddAccount);

    // Account actions (event delegation)
    $('#accounts-list')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-account-btn')) {
            handleDeleteAccount(e.target.dataset.id);
        } else if (e.target.classList.contains('edit-account-btn')) {
            handleModifyAccount(e.target.dataset.id);
        }
    });

    // Modify account
    $('#modify-account-form')?.addEventListener('submit', handleSaveAccountChanges);
    $('#modal-modify-account-close')?.addEventListener('click', () => closeModal('modal-modify-account'));

    // ─── UI ───

    // Period select
    $('#period-select')?.addEventListener('change', renderAnalytics);

    // FAB (mobile)
    $('#fab-add')?.addEventListener('click', () => {
        $('.side-panel')?.classList.add('open');
        setTimeout(() => $('#input-amount')?.focus(), 300);
    });

    // Panel close
    $('#panel-close')?.addEventListener('click', () => {
        $('.side-panel')?.classList.remove('open');
    });

    // Modal overlays and keyboard
    setupModalOverlays();
    setupModalKeyboard();

    // ─── Auth State Listener ───
    auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            setUser(session.user);
            showApp();
            loadData();
        } else if (event === 'SIGNED_OUT') {
            resetState();
            showAuthScreen();
        }
    });
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkAuth();
});
