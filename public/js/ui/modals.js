/**
 * Ghost Budget — Modal Functions
 * Open, close, and manage modal dialogs
 */

import { $ } from '../utils.js';

/**
 * Open modal by ID
 * @param {string} modalId - Modal element ID
 */
export function openModal(modalId) {
    const modal = $(`#${modalId}`);
    if (modal) {
        modal.classList.add('active');
        // Focus first input after animation
        setTimeout(() => {
            const firstInput = modal.querySelector('input');
            if (firstInput) firstInput.focus();
        }, 100);
    }
}

/**
 * Close modal by ID
 * @param {string} modalId - Modal element ID
 */
export function closeModal(modalId) {
    const modal = $(`#${modalId}`);
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Close all active modals
 */
export function closeAllModals() {
    const modals = document.querySelectorAll('.modal-overlay.active');
    modals.forEach(modal => modal.classList.remove('active'));
}

/**
 * Setup modal overlay click handlers
 * Closes modal when clicking outside modal content
 */
export function setupModalOverlays() {
    const overlays = document.querySelectorAll('.modal-overlay');
    overlays.forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });
}

/**
 * Setup keyboard shortcuts for modals
 * - Escape: Close all modals
 */
export function setupModalKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
            // Also close side panel
            $('.side-panel')?.classList.remove('open');
            // Close user dropdown
            $('#user-dropdown')?.classList.remove('active');
        }
    });
}
