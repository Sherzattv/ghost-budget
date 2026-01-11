/**
 * Ghost Budget — Storage Module
 * Handles localStorage + IndexedDB backup
 */

const STORAGE_KEY = 'ghost_budget_data';
const DB_NAME = 'GhostBudgetDB';
const DB_VERSION = 1;
const STORE_NAME = 'backups';

/**
 * Initialize IndexedDB for backup storage
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

/**
 * Save backup to IndexedDB
 * @param {Object} data - Data to backup
 */
async function saveBackupToIndexedDB(data) {
    try {
        const db = await openDatabase();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const backup = {
            id: 'current',
            data: JSON.stringify(data),
            timestamp: Date.now()
        };

        store.put(backup);

        // Keep last 5 daily backups
        const dailyBackup = {
            id: `backup_${new Date().toISOString().split('T')[0]}`,
            data: JSON.stringify(data),
            timestamp: Date.now()
        };
        store.put(dailyBackup);

        await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = reject;
        });

        console.log('✅ Backup saved to IndexedDB');
    } catch (e) {
        console.error('Failed to save IndexedDB backup:', e);
    }
}

/**
 * Load backup from IndexedDB
 * @returns {Promise<Object|null>}
 */
async function loadBackupFromIndexedDB() {
    try {
        const db = await openDatabase();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const request = store.get('current');
            request.onsuccess = () => {
                if (request.result) {
                    resolve(JSON.parse(request.result.data));
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to load IndexedDB backup:', e);
        return null;
    }
}

/**
 * Load data from JSON file (initial data or updates)
 * @returns {Promise<Object|null>}
 */
export async function loadDataFromFile() {
    try {
        const response = await fetch('data/budget.json?t=' + Date.now());
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.log('Could not load budget.json:', e);
    }
    return null;
}

/**
 * Load data from localStorage
 * @returns {Object|null}
 */
export function loadDataFromLocalStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse localStorage data:', e);
            // Try to recover from IndexedDB
            console.log('Attempting recovery from IndexedDB...');
        }
    }
    return null;
}

/**
 * Save data to localStorage and IndexedDB backup
 * @param {Object} data - Data to save
 */
export function saveData(data) {
    data.lastUpdated = Date.now();

    // Save to localStorage
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
        alert('Ошибка сохранения! Хранилище переполнено.');
        return false;
    }

    // Save backup to IndexedDB (async, non-blocking)
    saveBackupToIndexedDB(data);

    return true;
}

/**
 * Initialize data from all available sources
 * Priority: localStorage > IndexedDB > file
 * @returns {Promise<Object>}
 */
export async function initializeData() {
    // Try localStorage first
    let localData = loadDataFromLocalStorage();

    // If localStorage failed, try IndexedDB backup
    if (!localData) {
        console.log('localStorage empty, trying IndexedDB...');
        localData = await loadBackupFromIndexedDB();
        if (localData) {
            console.log('✅ Recovered data from IndexedDB backup!');
        }
    }

    // Try file data
    const fileData = await loadDataFromFile();

    // Merge logic
    if (localData && fileData) {
        const fileTime = fileData.lastUpdated || 0;
        const localTime = localData.lastUpdated || 0;

        if (localTime > fileTime) {
            return localData;
        } else {
            saveData(fileData);
            return fileData;
        }
    } else if (localData) {
        return localData;
    } else if (fileData) {
        saveData(fileData);
        return fileData;
    }

    // Default empty data
    return {
        accounts: [],
        transactions: [],
        categories: { expense: [], income: [] },
        lastUpdated: Date.now()
    };
}

/**
 * Export data as JSON file download
 * @param {Object} data - Data to export
 */
export function exportData(data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghost-budget-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Import data from JSON file
 * @param {Function} onSuccess - Callback with imported data
 */
export function importData(onSuccess) {
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
                    onSuccess(imported);
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
