/**
 * Ghost Budget — Utility Functions
 * Pure helper functions with no side effects
 */

/**
 * Generate unique ID for transactions and accounts
 * @returns {string} Unique identifier
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Format money amount with currency symbol
 * @param {number} amount - Amount to format
 * @param {boolean} showSign - Whether to show + for positive
 * @returns {string} Formatted money string
 */
export function formatMoney(amount, showSign = false) {
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

/**
 * Format date for display
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date (DD.MM)
 */
export function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

/**
 * Sanitize string to prevent XSS
 * @param {string} str - Input string
 * @returns {string} Sanitized string
 */
export function sanitizeString(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Debounce function to prevent rapid calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * DOM query shorthand
 * @param {string} selector - CSS selector
 * @returns {Element|null} DOM element
 */
export const $ = (selector) => document.querySelector(selector);

/**
 * DOM query all shorthand
 * @param {string} selector - CSS selector
 * @returns {NodeList} DOM elements
 */
export const $$ = (selector) => document.querySelectorAll(selector);
