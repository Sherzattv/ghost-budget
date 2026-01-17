/**
 * Ghost Budget — Form Handlers (Barrel File)
 * Re-exports all form modules for backwards compatibility
 * 
 * Modules:
 * - transaction-form.js: Transaction CRUD operations
 * - debt-form.js: Debt operations (lend, borrow, collect, repay)
 * - account-form.js: Account management
 */

// Transaction form handlers
export {
    handleAddTransaction,
    handleDeleteTransaction,
    handleCascadeDelete,
    clearTransactionForm,
    updateTransactionForm,
    handleTransactionTypeChange,
    showValidationError
} from './forms/transaction-form.js';

// Debt form handlers
export {
    handleDebtOperation,
    handleDebtActionClick,
    handleDebtTypeChange,
    handleCreditToggleClick,
    updateDebtFormFields,
    resetDebtForm,
    populateCounterpartySelect
} from './forms/debt-form.js';

// Account form handlers
export {
    handleAddAccount,
    handleDeleteAccount,
    handleArchiveAccount,
    handleConfirmDelete,
    handleModifyAccount,
    handleSaveAccountChanges,
    updateModifyFormVisibility
} from './forms/account-form.js';

// Edit transaction form handlers
export {
    handleEditTransaction,
    handleSaveTransactionEdit,
    handleCancelEdit
} from './forms/edit-transaction-form.js';
