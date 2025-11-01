// NotebookLM shared utility functions

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - CSS selector for the element
 * @param {number} timeout - Maximum time to wait in ms
 * @param {number} pollInterval - How often to check in ms
 * @returns {Promise<Element|null>} The element when found, or null if timeout
 */
export function waitForElement(selector, timeout = 5000, pollInterval = 250) {
  return new Promise((resolve) => {
    // Check immediately first
    const immediateCheck = document.querySelector(selector);
    if (immediateCheck) {
      resolve(immediateCheck);
      return;
    }
    
    let startTime = Date.now();
    let resolved = false;
    
    const pollIntervalId = setInterval(() => {
      if (resolved) return;
      
      const element = document.querySelector(selector);
      if (element) {
        resolved = true;
        clearInterval(pollIntervalId);
        resolve(element);
        return;
      }
      
      // Check timeout
      if (Date.now() - startTime >= timeout) {
        resolved = true;
        clearInterval(pollIntervalId);
        // Also try MutationObserver as fallback before giving up
        const observer = new MutationObserver(() => {
          const element = document.querySelector(selector);
          if (element) {
            observer.disconnect();
            resolve(element);
          }
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        // Final fallback timeout
        setTimeout(() => {
          observer.disconnect();
          resolve(null);
        }, 1000);
      }
    }, pollInterval);
  });
}

/**
 * Wait for an element to disappear from the DOM
 * @param {string} selector - CSS selector for the element
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<void>}
 */
export function waitForElementToDisappear(selector, timeout = 3000) {
  return new Promise((resolve) => {
    // Check if element exists immediately
    const element = document.querySelector(selector);
    if (!element) {
      resolve();
      return;
    }
    
    let startTime = Date.now();
    const pollIntervalId = setInterval(() => {
      const element = document.querySelector(selector);
      if (!element) {
        clearInterval(pollIntervalId);
        resolve();
        return;
      }
      
      // Check timeout
      if (Date.now() - startTime >= timeout) {
        clearInterval(pollIntervalId);
        // Even if timeout, resolve (element might still be there but we proceed)
        resolve();
      }
    }, 100);
  });
}

