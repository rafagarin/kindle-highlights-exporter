// Utility functions module

/**
 * Show status message in UI
 * @param {HTMLElement} element - Status element
 * @param {string} message - Status message
 * @param {string} type - Status type ('success', 'error', 'info')
 */
export function showStatus(element, message, type) {
  element.textContent = message;
  element.className = `status ${type}`;
}

