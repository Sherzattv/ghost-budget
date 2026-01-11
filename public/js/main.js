/**
 * Ghost Budget — Main Entry Point
 * Initialization and event handling with delegation
 */

import { $, $$ } from './utils.js';
import { initializeData, exportData, importData } from './storage.js';
import { setData, getData, markDataLoaded, setTransactionType, getTransactionType } from './state.js';
import { addTransaction, deleteTransaction, addAccount, deleteAccount, ValidationError } from './actions.js';
import { renderAll, renderCategoriesList, renderAccountsList, renderAnalytics } from './render.js';

// ─── Modal Handling ───
function openModal(modalId) {
    const modal = $(`#${modalId}`);
    modal.classList.add('active');

    setTimeout(() => {
        const firstInput = modal.querySelector('input');
        if (firstInput) firstInput.focus();
    }, 100);
}

function closeModal(modalId) {
    const modal = $(`#${modalId}`);
    modal.classList.remove('active');
}

function updateTransactionForm() {
    const isTransfer = getTransactionType() === 'transfer';

    $('#group-category').style.display = isTransfer ? 'none' : 'block';
    $('#group-account').style.display = isTransfer ? 'none' : 'block';
    $('#group-from-account').style.display = isTransfer ? 'block' : 'none';
    $('#group-to-account').style.display = isTransfer ? 'block' : 'none';

    renderCategoriesList();
}

function clearForm() {
    $('#input-amount').value = '';
    $('#input-category').value = '';
    $('#input-note').value = '';
    $('#input-amount').focus();
}

function closeSidePanelOnMobile() {
    if (window.innerWidth <= 900) {
        $('.side-panel').classList.remove('open');
    }
}

// ─── Server Status Check ───
async function checkServerStatus() {
    const indicator = $('#server-status');
    try {
        const response = await fetch('/manifest.json?t=' + Date.now(), { method: 'HEAD' });
        if (response.ok) {
            indicator.classList.remove('offline');
            indicator.classList.add('online');
            indicator.title = 'Сервер работает (Online)';
        } else {
            throw new Error('Not 200');
        }
    } catch (e) {
        indicator.classList.remove('online');
        indicator.classList.add('offline');
        indicator.title = 'Сервер отключен (Offline). Изменения сохраняются только в браузере.';
    }
}

// ─── Event Delegation Handlers ───

/**
 * Handle delete transaction with confirmation
 * @param {string} id - Transaction ID
 */
function handleDeleteTransaction(id) {
    if (confirm('Удалить эту транзакцию? Это действие нельзя отменить.')) {
        try {
            deleteTransaction(id);
            renderAll();
        } catch (e) {
            alert(e.message);
        }
    }
}

/**
 * Handle delete account with confirmation
 * @param {string} id - Account ID
 */
function handleDeleteAccount(id) {
    if (confirm('Удалить этот счёт? Это действие нельзя отменить.')) {
        try {
            deleteAccount(id);
            renderAll();
            renderAccountsList();
        } catch (e) {
            if (e instanceof ValidationError) {
                alert(e.message);
            } else {
                alert('Ошибка при удалении счёта');
            }
        }
    }
}

/**
 * Setup event delegation for dynamic elements
 */
function setupEventDelegation() {
    // Transactions container - delete buttons
    $('#transactions').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('[data-action="delete-transaction"]');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            handleDeleteTransaction(id);
        }
    });

    // Accounts list in modal - delete buttons
    $('#accounts-list').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('[data-action="delete-account"]');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            handleDeleteAccount(id);
        }
    });
}

// ─── Form Handlers ───

function handleTransactionSubmit(e) {
    e.preventDefault();

    const type = getTransactionType();
    const amount = parseFloat($('#input-amount').value);
    const category = $('#input-category').value.trim();
    const accountId = $('#input-account').value;
    const fromAccountId = $('#input-from-account').value;
    const toAccountId = $('#input-to-account').value;
    const note = $('#input-note').value.trim();

    try {
        addTransaction({ type, amount, category, accountId, fromAccountId, toAccountId, note });
        clearForm();
        renderAll();
        closeSidePanelOnMobile();
    } catch (e) {
        if (e instanceof ValidationError) {
            alert(e.message);
            const field = $(`#input-${e.field}`);
            if (field) field.focus();
        } else {
            console.error('Transaction error:', e);
            alert('Ошибка при добавлении транзакции');
        }
    }
}

function handleAddAccountSubmit(e) {
    e.preventDefault();

    const name = $('#new-account-name').value.trim();
    const balance = $('#new-account-balance').value;
    const type = $('#new-account-type').value;

    try {
        addAccount({ name, balance, type });

        // Reset form
        $('#new-account-name').value = '';
        $('#new-account-balance').value = '0';

        renderAll();
        renderAccountsList();
    } catch (e) {
        if (e instanceof ValidationError) {
            alert(e.message);
            const field = $(`#new-account-${e.field}`);
            if (field) field.focus();
        } else {
            alert('Ошибка при добавлении счёта');
        }
    }
}

// ─── Initialization ───

async function init() {
    // Load data
    const data = await initializeData();
    setData(data, false);
    markDataLoaded();

    // Initial render
    renderAll();

    // Focus amount input
    $('#input-amount').focus();

    // Setup event delegation for dynamic elements
    setupEventDelegation();

    // ─── Static Event Listeners ───

    // Manage accounts button
    $('#btn-manage-accounts').addEventListener('click', () => {
        renderAccountsList();
        openModal('modal-accounts');
    });

    // Close modals
    $('#modal-accounts-close').addEventListener('click', () => closeModal('modal-accounts'));

    // Close modal on overlay click
    $$('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Transaction type tabs
    $$('#transaction-tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('#transaction-tabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            setTransactionType(tab.dataset.type);
            updateTransactionForm();
        });
    });

    // Transaction form submit
    $('#transaction-form').addEventListener('submit', handleTransactionSubmit);

    // Add account form
    $('#add-account-form').addEventListener('submit', handleAddAccountSubmit);

    // Period select
    $('#period-select').addEventListener('change', renderAnalytics);

    // Export / Import
    $('#btn-export').addEventListener('click', () => exportData(getData()));

    $('#btn-import').addEventListener('click', () => {
        importData((imported) => {
            setData(imported);
            renderAll();
            alert('Данные импортированы');
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            $$('.modal-overlay.active').forEach(m => m.classList.remove('active'));
            $('.side-panel').classList.remove('open');
        }
    });

    // Mobile: FAB button opens side panel
    const fabBtn = $('#fab-add');
    const sidePanel = $('.side-panel');
    const panelClose = $('#panel-close');

    if (fabBtn) {
        fabBtn.addEventListener('click', () => {
            sidePanel.classList.add('open');
            setTimeout(() => $('#input-amount').focus(), 300);
        });
    }

    if (panelClose) {
        panelClose.addEventListener('click', () => {
            sidePanel.classList.remove('open');
        });
    }

    // Server status check
    checkServerStatus();
    setInterval(checkServerStatus, 5000);
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
