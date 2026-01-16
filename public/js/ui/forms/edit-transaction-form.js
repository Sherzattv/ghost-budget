/**
 * Ghost Budget — Edit Transaction Form
 * Handles transaction editing with optimistic locking
 */

import { $, showLoading, isValidAmount } from '../../utils.js';
import { setAccounts, addCategory } from '../../state.js';
import { accounts, transactions, categories } from '../../supabase/index.js';
import { renderAll, renderCategoriesList } from '../components.js';
import { openModal, closeModal } from '../modals.js';

// Cache for loaded transaction
let editingTransaction = null;

/**
 * Open edit modal and populate with transaction data
 * @param {string} id - Transaction ID
 */
export async function handleEditTransaction(id) {
    showLoading(true);

    const tx = await transactions.getTransactionById(id);

    if (!tx) {
        console.error('Transaction not found:', id);
        showLoading(false);
        return;
    }

    // Don't allow editing debt transactions
    if (tx.is_debt) {
        console.warn('Cannot edit debt transactions');
        showLoading(false);
        return;
    }

    // Cache for optimistic locking
    editingTransaction = tx;

    // Populate form
    $('#edit-tx-id').value = tx.id;
    $('#edit-tx-type').value = tx.type;
    $('#edit-tx-created-at').value = tx.created_at;
    $('#edit-tx-amount').value = tx.amount;
    $('#edit-tx-date').value = tx.date;
    $('#edit-tx-note').value = tx.note || '';

    // Category field: only for expense/income
    const categoryGroup = $('#group-edit-category');
    if (tx.type === 'transfer') {
        categoryGroup.style.display = 'none';
        $('#edit-tx-category').value = '';
    } else {
        categoryGroup.style.display = 'block';
        $('#edit-tx-category').value = tx.category?.name || '';

        // Populate categories datalist for this type
        renderCategoriesList();
    }

    showLoading(false);
    openModal('modal-edit-transaction');

    // Focus amount
    $('#edit-tx-amount').focus();
    $('#edit-tx-amount').select();
}

/**
 * Handle save button click
 * @param {Event} e - Form submit event
 */
export async function handleSaveTransactionEdit(e) {
    e.preventDefault();

    const id = $('#edit-tx-id').value;
    const type = $('#edit-tx-type').value;
    const createdAt = $('#edit-tx-created-at').value;
    const amount = parseFloat($('#edit-tx-amount').value);
    const date = $('#edit-tx-date').value;
    const categoryName = $('#edit-tx-category').value?.trim();
    const note = $('#edit-tx-note').value?.trim();

    // Validation
    if (!isValidAmount(amount)) {
        $('#edit-tx-amount').focus();
        return;
    }

    if (!date) {
        $('#edit-tx-date').focus();
        return;
    }

    showLoading(true);

    try {
        let category_id = null;

        // Get or create category for expense/income
        if (type !== 'transfer' && categoryName) {
            const category = await categories.getOrCreateCategory(categoryName, type);
            category_id = category?.id;

            if (category) {
                addCategory(category);
            }
        }

        const updates = {
            amount,
            date,
            category_id,
            note: note || null
        };

        const { data, error } = await transactions.updateTransaction(
            id,
            updates,
            createdAt // Optimistic lock
        );

        if (error) {
            console.error('Update error:', error.message);
            alert(error.message);
            showLoading(false);
            return;
        }

        // Reload accounts to reflect balance changes
        const updatedAccounts = await accounts.getAccounts({ includeHidden: true });
        setAccounts(updatedAccounts);

        closeModal('modal-edit-transaction');
        await renderAll();

        // Clear cache
        editingTransaction = null;

    } catch (error) {
        console.error('Error updating transaction:', error);
    }

    showLoading(false);
}

/**
 * Close edit modal and reset state
 */
export function handleCancelEdit() {
    closeModal('modal-edit-transaction');
    editingTransaction = null;
}
