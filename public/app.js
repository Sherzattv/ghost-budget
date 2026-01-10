/* ═══════════════════════════════════════════════════════════
   Ghost Budget — App Logic
   ═══════════════════════════════════════════════════════════ */

// ─── State ───
let data = null;
let currentTransactionType = 'expense';
let dataLoaded = false;

// ─── DOM Elements ───
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── Storage ───
async function loadDataFromFile() {
  try {
    const response = await fetch('data/budget.json?t=' + Date.now());
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.log('Could not load data.json:', e);
  }
  return null;
}

function loadDataFromLocalStorage() {
  const saved = localStorage.getItem('ghost_budget_data');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved data:', e);
    }
  }
  return null;
}

async function initData() {
  // Try to load from file first (for fresh data from repo)
  const fileData = await loadDataFromFile();
  const localData = loadDataFromLocalStorage();

  if (fileData && localData) {
    // Merge: use file accounts/categories, but keep local transactions if newer
    const fileTime = fileData.lastUpdated || 0;
    const localTime = localData.lastUpdated || 0;

    if (localTime > fileTime) {
      // Local is newer, use local but update accounts from file
      data = localData;
    } else {
      // File is newer or same, use file
      data = fileData;
      saveData(); // Save to localStorage
    }
  } else if (localData) {
    data = localData;
  } else if (fileData) {
    data = fileData;
    saveData();
  } else {
    // No data anywhere, shouldn't happen
    data = { accounts: [], transactions: [], categories: { expense: [], income: [] } };
  }

  dataLoaded = true;
  renderAll();
  $('#input-amount').focus();
}

function saveData() {
  data.lastUpdated = Date.now();
  localStorage.setItem('ghost_budget_data', JSON.stringify(data));
}

// ─── Utilities ───
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatMoney(amount, showSign = false) {
  const absAmount = Math.abs(amount);
  let formatted;

  if (absAmount >= 1000000) {
    formatted = (absAmount / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  } else if (absAmount >= 1000) {
    formatted = absAmount.toLocaleString('ru-RU');
  } else {
    formatted = absAmount.toString();
  }

  const sign = amount < 0 ? '-' : (showSign && amount > 0 ? '+' : '');
  return `${sign}₸${formatted}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function getAccountById(id) {
  return data.accounts.find(a => a.id === id);
}

// ─── Render Functions ───
function renderAccounts() {
  const grid = $('#accounts-grid');
  const assets = data.accounts.filter(a => a.type !== 'debt');

  grid.innerHTML = assets.map(account => {
    let subline = '';
    let mainClass = account.balance >= 0 ? 'positive' : 'negative';

    // Credit Limit Logic
    if (account.limit) {
      const debt = account.limit - account.balance;
      if (debt > 0) {
        subline = `<div style="font-size: 0.75rem; color: var(--expense); margin-top: 4px;">Долг: ${formatMoney(debt)}</div>`;
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

  // Calculate and display total balance
  // Calculate and display balances
  const ownBalance = assets.filter(a => !a.limit).reduce((sum, a) => sum + a.balance, 0);
  const creditBalance = assets.filter(a => a.limit).reduce((sum, a) => sum + a.balance, 0);

  $('#own-balance').textContent = formatMoney(ownBalance);
  $('#credit-balance').textContent = formatMoney(creditBalance);
}

function renderDebts() {
  const row = $('#debts-row');
  // Hide debts with 0 balance (paid off)
  const debts = data.accounts.filter(a => a.type === 'debt' && Math.abs(a.balance) > 0);

  if (debts.length === 0) {
    $('#debts-section').style.display = 'none';
    return;
  }

  $('#debts-section').style.display = 'block';
  row.innerHTML = debts.map(debt => `
    <div class="debt-item">
      <span class="debt-name">${debt.name}:</span>
      <span class="debt-amount">${formatMoney(Math.abs(debt.balance))}</span>
    </div>
  `).join('');
}

function renderAnalytics() {
  const container = $('#analytics');
  const period = $('#period-select').value;

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

function renderTransactions() {
  const container = $('#transactions');
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

      // Если перевод на долговой счёт — это погашение
      if (toAcc?.type === 'debt') {
        info = `${fromAcc?.name || '?'} → ${toAcc?.name || '?'}`;
        amount = '-' + formatMoney(t.amount);
        amountClass = 'expense'; // Красный, т.к. деньги уходят
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
        <button class="transaction-delete" onclick="deleteTransaction('${t.id}')" title="Удалить">×</button>
      </div>
    `;
  }).join('');
}

function renderAccountOptions() {
  const assets = data.accounts.filter(a => a.type !== 'debt');
  const allAccounts = data.accounts;

  const assetOptions = assets.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  const allOptions = allAccounts.map(a => {
    const label = a.type === 'debt' ? `${a.name} (долг)` : a.name;
    return `<option value="${a.id}">${label}</option>`;
  }).join('');

  $('#input-account').innerHTML = assetOptions;
  $('#input-from-account').innerHTML = assetOptions;
  $('#input-to-account').innerHTML = allOptions; // Включаем долги для погашения
}

function renderCategoriesList() {
  const categories = data.categories[currentTransactionType] || [];
  const datalist = $('#categories-list');
  datalist.innerHTML = categories.map(c => `<option value="${c}">`).join('');
}

function renderAccountsList() {
  const list = $('#accounts-list');

  list.innerHTML = data.accounts.map(account => `
    <div class="account-list-item">
      <span class="account-name">${account.name}</span>
      <span class="account-balance ${account.balance >= 0 ? 'positive' : 'negative'}">
        ${formatMoney(account.balance)}
      </span>
      <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteAccount('${account.id}')" title="Удалить">×</button>
    </div>
  `).join('');
}

function renderAll() {
  renderAccounts();
  renderDebts();
  renderAnalytics();
  renderTransactions();
  renderAccountOptions();
  renderCategoriesList();
}

// ─── Actions ───
function addTransaction(type, amount, category, accountId, fromAccountId, toAccountId, note) {
  const transaction = {
    id: generateId(),
    date: new Date().toISOString().split('T')[0],
    type,
    amount: Math.abs(amount),
    note: note || ''
  };

  if (type === 'transfer') {
    transaction.fromAccountId = fromAccountId;
    transaction.toAccountId = toAccountId;

    // Update account balances
    const fromAccount = getAccountById(fromAccountId);
    const toAccount = getAccountById(toAccountId);
    if (fromAccount) fromAccount.balance -= amount;
    if (toAccount) toAccount.balance += amount;
  } else {
    transaction.category = category;
    transaction.accountId = accountId;

    // Update account balance
    const account = getAccountById(accountId);
    if (account) {
      if (type === 'expense') {
        account.balance -= amount;
      } else {
        account.balance += amount;
      }
    }

    // Add new category if doesn't exist
    if (category && !data.categories[type].includes(category)) {
      data.categories[type].push(category);
    }
  }

  data.transactions.push(transaction);
  saveData();
  renderAll();
}

function deleteTransaction(id) {
  const index = data.transactions.findIndex(t => t.id === id);
  if (index === -1) return;

  const t = data.transactions[index];

  // Reverse the balance change
  if (t.type === 'transfer') {
    const fromAccount = getAccountById(t.fromAccountId);
    const toAccount = getAccountById(t.toAccountId);
    if (fromAccount) fromAccount.balance += t.amount;
    if (toAccount) toAccount.balance -= t.amount;
  } else {
    const account = getAccountById(t.accountId);
    if (account) {
      if (t.type === 'expense') {
        account.balance += t.amount;
      } else {
        account.balance -= t.amount;
      }
    }
  }

  data.transactions.splice(index, 1);
  saveData();
  renderAll();
}

function addAccount(name, balance, type) {
  const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + generateId().slice(0, 4);

  data.accounts.push({
    id,
    name,
    balance: parseFloat(balance) || 0,
    type
  });

  saveData();
  renderAll();
  renderAccountsList();
}

function deleteAccount(id) {
  // Don't allow deleting if there are transactions with this account
  const hasTransactions = data.transactions.some(t =>
    t.accountId === id || t.fromAccountId === id || t.toAccountId === id
  );

  if (hasTransactions) {
    alert('Нельзя удалить счёт с транзакциями');
    return;
  }

  data.accounts = data.accounts.filter(a => a.id !== id);
  saveData();
  renderAll();
  renderAccountsList();
}

// ─── Export / Import ───
function exportData() {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ghost-budget-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.accounts && imported.transactions) {
          data = imported;
          saveData();
          renderAll();
          alert('Данные импортированы');
        } else {
          alert('Неверный формат файла');
        }
      } catch (err) {
        alert('Ошибка при чтении файла');
      }
    };
    reader.readAsText(file);
  };

  input.click();
}

// ─── Modal Handling ───
function openModal(modalId) {
  const modal = $(`#${modalId}`);
  modal.classList.add('active');

  // Focus first input
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
  const isTransfer = currentTransactionType === 'transfer';

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

// ─── Event Listeners ───
document.addEventListener('DOMContentLoaded', () => {
  // Load data from file, then render
  initData();

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
      currentTransactionType = tab.dataset.type;
      updateTransactionForm();
    });
  });

  // Transaction form submit
  $('#transaction-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const amount = parseFloat($('#input-amount').value);
    const category = $('#input-category').value.trim();
    const accountId = $('#input-account').value;
    const fromAccountId = $('#input-from-account').value;
    const toAccountId = $('#input-to-account').value;
    const note = $('#input-note').value.trim();

    if (!amount || amount <= 0) {
      $('#input-amount').focus();
      return;
    }

    if (currentTransactionType === 'transfer') {
      if (fromAccountId === toAccountId) {
        alert('Выбери разные счета');
        return;
      }
      addTransaction('transfer', amount, null, null, fromAccountId, toAccountId, note);
    } else {
      if (!category) {
        $('#input-category').focus();
        return;
      }
      addTransaction(currentTransactionType, amount, category, accountId, null, null, note);
    }

    clearForm();

    // Close panel on mobile after adding
    if (window.innerWidth <= 900) {
      $('.side-panel').classList.remove('open');
    }
  });

  // Add account form
  $('#add-account-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const name = $('#new-account-name').value.trim();
    const balance = $('#new-account-balance').value;
    const type = $('#new-account-type').value;

    if (!name) {
      $('#new-account-name').focus();
      return;
    }

    addAccount(name, balance, type);

    // Reset form
    $('#new-account-name').value = '';
    $('#new-account-balance').value = '0';
  });

  // Period select
  $('#period-select').addEventListener('change', renderAnalytics);

  // Export / Import
  $('#btn-export').addEventListener('click', exportData);
  $('#btn-import').addEventListener('click', importData);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape - close modals and side panel
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

  // Close panel after adding transaction on mobile
  const originalClearForm = clearForm;
  window.clearFormMobile = function () {
    originalClearForm();
    if (window.innerWidth <= 900) {
      sidePanel.classList.remove('open');
    }
  };
});

// ─── Server Status ───
async function checkServerStatus() {
  const indicator = $('#server-status');
  try {
    // Try to fetch a tiny file or HEAD request with cache bursting
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

// Check status every 5 seconds
setInterval(checkServerStatus, 5000);
// Check immediately on load
checkServerStatus();

// Make functions available globally for inline onclick handlers
window.deleteTransaction = deleteTransaction;
window.deleteAccount = deleteAccount;
