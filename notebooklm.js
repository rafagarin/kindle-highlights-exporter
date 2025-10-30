// NotebookLM integration module

/**
 * Export content to NotebookLM
 * @param {string} url - NotebookLM notebook URL
 * @param {string} content - Content to export
 * @param {Function} statusCallback - Callback for status updates
 * @returns {Promise<boolean>} Success status
 */
export async function exportToNotebooklm(url, content, statusCallback) {
  if (!url) {
    statusCallback('Please enter a NotebookLM notebook URL', 'error');
    return false;
  }
  
  try {
    // Get content from clipboard
    if (!content) {
      const clipboardContent = await navigator.clipboard.readText();
      if (!clipboardContent) {
        statusCallback('No content in clipboard. Please run Step 1 first.', 'error');
        return false;
      }
      content = clipboardContent;
    }
    
    statusCallback('Opening NotebookLM...', 'info');
    
    // Open the NotebookLM page in a new tab
    const tab = await chrome.tabs.create({ url: url });
    
    // Wait for the page to load - check if page is ready instead of fixed timeout
    statusCallback('Waiting for NotebookLM to load...', 'info');
    await waitForTabReady(tab.id);
    
    // Send message to content script to automate the process
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'exportToNotebooklm',
        content: content
      }, function(response) {
        if (chrome.runtime.lastError) {
          statusCallback('Please refresh the NotebookLM page and try again', 'error');
          resolve(false);
        } else if (response && response.success) {
          statusCallback('Successfully exported to NotebookLM!', 'success');
          resolve(true);
        } else {
          statusCallback(response?.error || 'Failed to export to NotebookLM', 'error');
          resolve(false);
        }
      });
    });
    
  } catch (error) {
    console.error('Error exporting to NotebookLM:', error);
    statusCallback(`Error: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Wait for a tab to be ready (loaded and interactive)
 * @param {number} tabId - Tab ID to wait for
 * @returns {Promise<void>}
 */
function waitForTabReady(tabId) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 20; // Maximum 10 seconds (20 * 500ms)
    
    const checkReady = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        // Check if tab is complete and ready
        if (tab.status === 'complete') {
          // Give it a small moment for dynamic content to load
          setTimeout(resolve, 500);
          return;
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          // Timeout - but continue anyway, page might still be loading
          resolve();
          return;
        }
        
        // Check again in 500ms
        setTimeout(checkReady, 500);
      });
    };
    
    checkReady();
  });
}

/**
 * Create flashcards in NotebookLM
 * @param {Function} statusCallback - Callback for status updates
 * @returns {Promise<boolean>} Success status
 */
export async function createFlashcards(statusCallback) {
  try {
    // Get the current active tab (should be the NotebookLM page)
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab.url.includes('notebooklm.google.com')) {
      statusCallback('Please navigate to your NotebookLM notebook first', 'error');
      return false;
    }
    
    statusCallback('Creating flashcards...', 'info');
    
    // Send message to content script to create flashcards
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(currentTab.id, { 
        action: 'createFlashcards'
      }, function(response) {
        if (chrome.runtime.lastError) {
          statusCallback('Please refresh the NotebookLM page and try again', 'error');
          resolve(false);
        } else if (response && response.success) {
          statusCallback('Successfully created flashcards!', 'success');
          resolve(true);
        } else {
          statusCallback(response?.error || 'Failed to create flashcards', 'error');
          resolve(false);
        }
      });
    });
    
  } catch (error) {
    console.error('Error creating flashcards:', error);
    statusCallback(`Error: ${error.message}`, 'error');
    return false;
  }
}

