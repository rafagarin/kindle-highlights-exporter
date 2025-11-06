// NotebookLM integration module (facade)
// This module provides a unified interface to NotebookLM functionality
// while delegating to specialized modules for notebooks, sources, and flashcards

import { openNotebookByName, waitForTabReady } from './notebooklm_notebooks.js';
import { handleNotebooklmExport } from './notebooklm_sources.js';
import { handleCreateFlashcards, renameFlashcard } from './notebooklm_flashcards.js';
import { loadProcessedContent } from './storage.js';

/**
 * Wait for content script to be ready by sending a ping message
 * @param {number} tabId - Tab ID to check
 * @param {Function} statusCallback - Optional callback for status updates
 * @returns {Promise<void>}
 */
function waitForContentScript(tabId, statusCallback = null) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 30; // Maximum 15 seconds (30 * 500ms)
    
    const checkReady = () => {
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, function(response) {
        if (chrome.runtime.lastError) {
          // Content script not ready yet
          attempts++;
          if (attempts >= maxAttempts) {
            console.warn('Content script not ready after maximum attempts, continuing anyway...');
            resolve(); // Continue anyway, might work
            return;
          }
          // Check again in 500ms
          setTimeout(checkReady, 500);
          return;
        }
        
        // Content script is ready
        if (statusCallback) {
          statusCallback('NotebookLM ready, adding source...', 'info');
        }
        // Give it a moment to fully initialize
        setTimeout(resolve, 500);
      });
    };
    
    // Start checking after a brief delay to give content script time to initialize
    setTimeout(checkReady, 1000);
  });
}

// Re-export functions for use in content scripts
export { openNotebookByName, handleNotebooklmExport, handleCreateFlashcards, renameFlashcard };

/**
 * Export content to NotebookLM
 * @param {string} bookName - Name of the book/notebook to open
 * @param {string} content - Content to export
 * @param {Function} statusCallback - Callback for status updates
 * @param {string} sourceName - Name to use for the source (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function exportToNotebooklm(bookName, content, statusCallback, sourceName = null) {
  if (!bookName) {
    statusCallback('Please provide a book name', 'error');
    return false;
  }
  
  try {
    // Get content from storage
    if (!content) {
      content = await loadProcessedContent();
      
      if (!content) {
        statusCallback('No content found. Please run Step 2 first.', 'error');
        return false;
      }
    }
    
    statusCallback('Opening NotebookLM...', 'info');
    
    // Open the NotebookLM welcome page in a new tab
    const tab = await chrome.tabs.create({ url: 'https://notebooklm.google.com/' });
    
    // Wait for the page to load
    statusCallback('Waiting for NotebookLM to load...', 'info');
    await waitForTabReady(tab.id);
    
    // Wait for content script to be ready
    await waitForContentScript(tab.id, statusCallback);
    
    // Send message to content script to open the notebook and automate the process
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'openNotebookAndExport',
        bookName: bookName,
        content: content,
        sourceName: sourceName
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
 * Create flashcards in NotebookLM
 * @param {Function} statusCallback - Callback for status updates
 * @param {string} sourceName - Optional name of the source to select for flashcards
 * @param {string} chapterName - Optional name to rename the flashcard after creation
 * @returns {Promise<boolean>} Success status
 */
export async function createFlashcards(statusCallback, sourceName = null, chapterName = null) {
  try {
    // Get the current active tab (should be the NotebookLM page)
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab.url.includes('notebooklm.google.com')) {
      statusCallback('Please navigate to your NotebookLM notebook first', 'error');
      return false;
    }
    
    statusCallback('Creating flashcards...', 'info');
    
    // Set up listener for status updates during flashcard generation
    const statusUpdateListener = (message, sender, sendResponse) => {
      if (message.action === 'flashcardStatusUpdate') {
        statusCallback(message.message, 'info');
      }
    };
    chrome.runtime.onMessage.addListener(statusUpdateListener);
    
    // Send message to content script to create flashcards
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(currentTab.id, { 
        action: 'createFlashcards',
        sourceName: sourceName,
        chapterName: chapterName
      }, function(response) {
        // Remove the status update listener when done
        chrome.runtime.onMessage.removeListener(statusUpdateListener);
        
        if (chrome.runtime.lastError) {
          statusCallback('Please refresh the NotebookLM page and try again', 'error');
          resolve(false);
        } else if (response && response.success) {
          const message = response.message || 'Successfully created flashcards!';
          statusCallback(message, 'success');
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

