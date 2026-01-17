/**
 * Form Configuration
 * Single source of truth for field visibility and labels
 */

import { getAccountById } from '../../state.js';

export const FORM_FIELDS = {
    // Note: Amount and Note fields are always visible (no ID needed, handled by CSS)

    // ─── Transaction Type Specific ───
    'group-category': { types: ['expense', 'income'] },
    'group-account': { types: ['expense', 'income'] },
    'group-from-account': { types: ['transfer'] },
    'group-to-account': { types: ['transfer'] },
    'group-split-expense': { types: ['expense'] },
    'group-split-details': { types: ['expense'], condition: (state, formData) => !!formData.isSplit },

    // ─── Debt Fields ───
    'group-debt-action': { types: ['debt'] },

    // Debt Account (Lend/Borrow -> specific label, Collect/Repay -> specific label)
    'group-debt-account': { types: ['debt'], debtActions: ['lend', 'borrow', 'collect', 'repay'] },

    // Counterparty Name (Lend/Borrow)
    'group-counterparty': { types: ['debt'], debtActions: ['lend', 'borrow'] },

    // Counterparty Select (Collect/Repay)
    'group-counterparty-select': { types: ['debt'], debtActions: ['collect', 'repay'] },

    // Debt Type (Borrow only - user needs to say who they borrowed from)
    'group-debt-type': { types: ['debt'], debtActions: ['borrow'] },

    // Credit Fields (Borrow + Credit Type)
    'group-credit-toggle': { types: ['debt'], debtActions: ['borrow'], debtType: 'credit' },
    'group-monthly-payment': { types: ['debt'], debtActions: ['borrow'], debtType: 'credit' },
    'group-payment-day': { types: ['debt'], debtActions: ['borrow'], debtType: 'credit' },
    'group-interest-rate': { types: ['debt'], debtActions: ['borrow'], debtType: 'credit', creditType: 'credit' },

    // Return Date (Lend OR Borrow+Person)
    'group-return-date': {
        types: ['debt'],
        condition: (state) => {
            if (state.debtAction === 'lend') return true;
            if (state.debtAction === 'borrow' && state.debtType === 'person') return true;
            return false;
        }
    },

    // Smart Collection Checkbox (Collect/Repay + UNDERPAYMENT only)
    'group-close-debt': {
        types: ['debt'],
        debtActions: ['collect', 'repay'],
        condition: (state, formData) => {
            const amount = parseFloat(formData.amount) || 0;
            const selectedDebtId = formData.counterpartySelectId;
            if (!selectedDebtId || amount <= 0) return false;

            const debt = getAccountById(selectedDebtId);
            if (!debt) return false;

            const balance = Math.abs(debt.balance);
            // Show checkbox ONLY on underpayment (amount < balance)
            // On overpayment, the excess becomes income automatically
            return amount < balance - 0.01;
        }
    }
};

export const FIELD_LABELS = {
    'group-account': {
        expense: 'Счёт (откуда)',
        income: 'Счёт (куда)'
    },
    'group-debt-account': {
        lend: 'Откуда',   // Я дал -> деньги ушли со счета
        borrow: 'Куда',   // Я взял -> деньги пришли на счет
        collect: 'Куда',  // Мне вернули -> деньги пришли на счет
        repay: 'Откуда'   // Я вернул -> деньги ушли со счета
    },
    'group-counterparty': {
        lend: 'Кому',
        borrow: 'У кого'
    },
    'group-counterparty-select': {
        collect: 'Кто вернул',
        repay: 'Кому'
    }
};
