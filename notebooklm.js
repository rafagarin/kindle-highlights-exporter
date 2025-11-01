// NotebookLM integration module (facade)
// This module provides a unified interface to NotebookLM functionality
// while delegating to specialized modules for notebooks, sources, and flashcards

import { openNotebookByName, waitForTabReady } from './notebooklm_notebooks.js';
import { handleNotebooklmExport } from './notebooklm_sources.js';
import { handleCreateFlashcards } from './notebooklm_flashcards.js';

// Re-export functions for use in content scripts
export { openNotebookByName, handleNotebooklmExport, handleCreateFlashcards };

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
    // Get content from clipboard
    if (!content) {
      const clipboardContent = await navigator.clipboard.readText();
      if (!clipboardContent) {
        statusCallback('No content in clipboard. Please run Step 2 first.', 'error');
        return false;
      }
      content = clipboardContent;
    }
    
    statusCallback('Opening NotebookLM...', 'info');
    
    // Open the NotebookLM welcome page in a new tab
    const tab = await chrome.tabs.create({ url: 'https://notebooklm.google.com/' });
    
    // Wait for the page to load
    statusCallback('Adding source to NotebookLM...', 'info');
    await waitForTabReady(tab.id);
    
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
 * @returns {Promise<boolean>} Success status
 */
export async function createFlashcards(statusCallback, sourceName = null) {
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
        action: 'createFlashcards',
        sourceName: sourceName
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

