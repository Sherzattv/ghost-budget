/**
 * Form Controller
 * Manages form state, visibility logic, and dynamic updates
 */

import { FORM_FIELDS, FIELD_LABELS } from './form-config.js';
import { populators, populateSelect } from './field-populators.js';
import { renderCounterpartiesList, renderCategoriesList } from '../components.js';

class FormController {
    constructor() {
        this.state = {
            type: 'expense',        // expense | income | transfer | debt
            debtAction: null,       // lend | borrow | collect | repay
            debtType: 'person',     // person | credit
            creditType: 'credit'    // credit | installment
        };

        // Bind methods
        this.render = this.render.bind(this);
        this.renderDynamicFields = this.renderDynamicFields.bind(this);
    }

    /**
     * Update state and trigger render
     * @param {Object} updates - Partial state updates
     */
    setState(updates) {
        Object.assign(this.state, updates);
        this.render();
    }

    /**
     * Get current form data for dynamic conditions
     */
    getFormData() {
        return {
            amount: document.getElementById('input-amount')?.value,
            counterpartySelectId: document.getElementById('input-counterparty-select')?.value,
            isSplit: document.getElementById('input-split-expense')?.checked
        };
    }

    /**
     * Main render method
     */
    render() {
        this.updateDom();       // Sync state to hidden inputs
        this.updateActiveState(); // Update active classes on buttons
        this.updateVisibility();
        this.updateLabels();
        this.populateFields();
        this.renderDynamicFields(); // Check dynamic fields immediately
    }

    /**
     * Sync state values to DOM hidden inputs and native inputs
     */
    updateDom() {
        const { debtAction, debtType, creditType } = this.state;

        // Hidden input for debt action
        const actionInput = document.getElementById('input-debt-action');
        if (actionInput && debtAction) {
            actionInput.value = debtAction;
        }

        // Sync debt type radio buttons
        const radio = document.querySelector(`input[name="debt-type"][value="${debtType}"]`);
        if (radio) radio.checked = true;
    }

    /**
     * Update active CSS classes on buttons
     */
    updateActiveState() {
        const { debtAction, debtType, creditType } = this.state;

        // Debt Action Buttons
        document.querySelectorAll('.debt-action-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.action === debtAction);
        });

        // Credit Toggle Buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.creditType === creditType);
        });
    }

    /**
     * Update field visibility based on config
     */
    updateVisibility() {
        Object.entries(FORM_FIELDS).forEach(([groupId, config]) => {
            const el = document.getElementById(groupId);
            if (!el) return;

            // Skip dynamic check here, mostly static rules first or strict types
            // Dynamic/Condition checks happen in isFieldVisible
            const visible = this.isFieldVisible(groupId, config);
            el.style.display = visible ? 'block' : 'none';
        });
    }

    /**
     * Check if a field should be visible
     */
    isFieldVisible(groupId, config) {
        const { type, debtAction, debtType, creditType } = this.state;
        const formData = this.getFormData();

        // 1. Always visible
        if (config.always) return true;

        // 2. Type check
        if (config.types && !config.types.includes(type)) return false;

        // 3. Debt specific checks
        if (type === 'debt') {
            if (config.debtActions && !config.debtActions.includes(debtAction)) return false;

            // If config specifies a required debtType, check matches current state
            if (config.debtType && config.debtType !== debtType) return false;

            // If config specifies a required creditType, check matches current state
            if (config.creditType && config.creditType !== creditType) return false;
        }

        // 4. Dynamic condition
        if (config.condition) {
            return config.condition(this.state, formData);
        }

        return true;
    }

    /**
     * Update labels based on context
     */
    updateLabels() {
        Object.keys(FIELD_LABELS).forEach(groupId => {
            const labelsRules = FIELD_LABELS[groupId];
            const el = document.getElementById(groupId);
            if (!el || el.style.display === 'none') return;

            const labelEl = el.querySelector('.form-label');
            if (!labelEl) return;

            const { type, debtAction } = this.state;

            // Determine key: either debtAction (if debt) or type
            const key = type === 'debt' ? debtAction : type;

            if (labelsRules[key]) {
                labelEl.textContent = labelsRules[key];
            }
        });
    }

    /**
     * Populate select fields using pure populators
     */
    populateFields() {
        const { type, debtAction } = this.state;

        // Populate accounts
        // We only populate if the field is theoretically visible/active for this type
        // Note: Actual DOM visibility is handled by updateVisibility

        if (['expense', 'income'].includes(type)) {
            populateSelect('input-account', populators['input-account']());
            renderCategoriesList(); // Populate category autocomplete
        }

        if (type === 'transfer') {
            populateSelect('input-from-account', populators['input-from-account']());
            // To-account is dependent on from-account, handled by event listener mostly, 
            // but we can initialize it here
            const fromId = document.getElementById('input-from-account')?.value;
            populateSelect('input-to-account', populators['input-to-account'](fromId));
        }

        if (type === 'debt') {
            populateSelect('input-debt-account', populators['input-debt-account']());

            // Populate counterparty autocomplete for lend/borrow
            if (['lend', 'borrow'].includes(debtAction)) {
                renderCounterpartiesList();
            }

            if (['collect', 'repay'].includes(debtAction)) {
                populateSelect('input-counterparty-select', populators['input-counterparty-select'](debtAction));
            }
        }
    }

    /**
     * Re-check only dynamic fields (lightweight render)
     * Called on input changes (amount, checkboxes)
     */
    renderDynamicFields() {
        Object.entries(FORM_FIELDS).forEach(([groupId, config]) => {
            if (!config.condition) return; // Only re-check fields with conditions

            const el = document.getElementById(groupId);
            if (!el) return;

            const visible = this.isFieldVisible(groupId, config);
            el.style.display = visible ? 'block' : 'none';
        });
    }

    // ─── Public API ───

    setType(type) {
        // Reset specific states when switching main type
        this.setState({
            type,
            debtAction: type === 'debt' ? null : null // Reset debt action if leaving debt, or keep null if entering
        });

        // If entering debt, maybe default to something? Or wait for user?
        // Current UX waits for user to click 2x2 grid.
    }

    setDebtAction(action) {
        this.setState({ debtAction: action });
    }

    setDebtType(debtType) {
        this.setState({ debtType });
    }

    setCreditType(creditType) {
        this.setState({ creditType });
    }

    toggleSplit(isSplit) {
        // Just trigger render as isSplit is read from DOM in getFormData
        this.renderDynamicFields();
    }
}

export const formController = new FormController();
