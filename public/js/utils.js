/**
 * Ghost Budget — Utility Functions
 * Common helpers used across the application
 */

import { DEFAULT_CURRENCY } from './config.js';

// ─── DOM Helpers ───

/**
 * Query selector shorthand
 * @param {string} selector - CSS selector
 * @returns {Element|null}
 */
export const $ = (selector) => document.querySelector(selector);

/**
 * Query selector all shorthand
 * @param {string} selector - CSS selector
 * @returns {NodeListOf<Element>}
 */
export const $$ = (selector) => document.querySelectorAll(selector);

// ─── Formatting ───

/**
 * Format money amount with currency symbol
 * @param {number} amount - Amount to format
 * @param {boolean} showSign - Whether to show + for positive amounts
 * @returns {string} Formatted money string
 */
export function formatMoney(amount, showSign = false) {
    const absAmount = Math.abs(Number(amount) || 0);
    let formatted;

    if (absAmount >= 1000000) {
        formatted = (absAmount / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    } else if (absAmount >= 1000) {
        formatted = absAmount.toLocaleString('ru-RU');
    } else {
        formatted = absAmount.toString();
    }

    const sign = amount < 0 ? '-' : (showSign && amount > 0 ? '+' : '');
    return `${sign}${DEFAULT_CURRENCY}${formatted}`;
}

/**
 * Format date string to short format (DD.MM)
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date
 */
export function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

/**
 * Format date string to full format (DD.MM.YYYY)
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date
 */
export function formatDateFull(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── UI Helpers ───

/**
 * Show or hide loading overlay
 * @param {boolean} show - Whether to show loading
 */
export function showLoading(show = true) {
    const overlay = $('#loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

/**
 * Show error message in element
 * @param {string} elementId - ID of error element
 * @param {string} message - Error message (empty to hide)
 */
export function showError(elementId, message) {
    const el = $(`#${elementId}`);
    if (el) {
        el.textContent = message;
        el.style.display = message ? 'block' : 'none';
    }
}

// ─── Date Helpers ───

/**
 * Get start of current month
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
export function getMonthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

/**
 * Get start of current week (Sunday)
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
export function getWeekStart() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    return weekStart.toISOString().split('T')[0];
}

/**
 * Get today's date
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
export function getToday() {
    return new Date().toISOString().split('T')[0];
}

// ─── Validation Helpers ───

/**
 * Check if value is a valid positive number
 * @param {any} value - Value to check
 * @returns {boolean}
 */
export function isValidAmount(value) {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
}

/**
 * Check if string is not empty
 * @param {string} value - Value to check
 * @returns {boolean}
 */
export function isNotEmpty(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

// ─── Calculator Helper ───

/**
 * Evaluate simple math expression (supports +, -, *, /)
 * Returns the calculated result or the original value if not a valid expression
 * @param {string} expression - Math expression like "850-128" or "100+50*2"
 * @returns {number|null} - Calculated result or null if invalid
 */
export function evaluateExpression(expression) {
    if (!expression || typeof expression !== 'string') return null;

    // Clean the input: remove spaces, replace comma with dot
    const cleaned = expression.trim().replace(/\s/g, '').replace(',', '.');

    // If it's just a number, return it
    if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
        return parseFloat(cleaned);
    }

    // Check if it looks like a math expression (contains operators)
    if (!/^[\d+\-*/().]+$/.test(cleaned)) {
        return null; // Contains invalid characters
    }

    // Safety: don't evaluate if it has suspicious patterns
    if (/[a-zA-Z_$]/.test(cleaned)) {
        return null;
    }

    try {
        // Use Function constructor (safer than eval, no access to scope)
        const result = new Function('return ' + cleaned)();

        // Validate result
        if (typeof result === 'number' && isFinite(result) && result >= 0) {
            // Round to 2 decimal places
            return Math.round(result * 100) / 100;
        }
        return null;
    } catch {
        return null;
    }
}
