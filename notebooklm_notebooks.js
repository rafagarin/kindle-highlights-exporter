// NotebookLM notebook management module

import { waitForElement, waitForElementToDisappear } from './notebooklm_utils.js';

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
 * Open a NotebookLM notebook by book name
 * @param {string} bookName - Name of the book/notebook to open
 * @returns {Promise<void>}
 */
export async function openNotebookByName(bookName) {
  try {
    console.log(`Opening notebook with name: "${bookName}"...`);
    
    // Wait for the projects page to load
    await waitForElement('project-button, .project-button, welcome-page', 10000, 100);
    
    // Wait a bit more for projects to fully render
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Find all project buttons
    const projectButtons = document.querySelectorAll('project-button');
    
    if (projectButtons.length === 0) {
      throw new Error('No notebooks found on the page');
    }
    
    console.log(`Found ${projectButtons.length} notebook(s)`);
    
    let targetButton = null;
    
    // Look for a project button with matching title
    for (let button of projectButtons) {
      // Find the title element within the project button
      const titleElement = button.querySelector('.project-button-title, [class*="project-button-title"], span[id$="-title"]');
      
      if (titleElement) {
        const titleText = titleElement.textContent.trim();
        console.log(`Checking notebook: "${titleText}"`);
        
        // Check for exact match first
        if (titleText === bookName) {
          targetButton = button;
          console.log(`Found exact match: "${titleText}"`);
          break;
        }
        
        // Check for partial match (case-insensitive)
        if (titleText.toLowerCase().includes(bookName.toLowerCase()) || 
            bookName.toLowerCase().includes(titleText.toLowerCase())) {
          targetButton = button;
          console.log(`Found partial match: "${titleText}"`);
          break;
        }
      }
    }
    
    if (!targetButton) {
      // Fallback: try finding by text content in the entire button
      for (let button of projectButtons) {
        const buttonText = button.textContent || '';
        if (buttonText.includes(bookName)) {
          targetButton = button;
          console.log(`Found by text content: "${buttonText.substring(0, 50)}..."`);
          break;
        }
      }
    }
    
    if (!targetButton) {
      // Notebook doesn't exist, create a new one
      console.log(`Notebook "${bookName}" not found, creating new notebook...`);
      
      // Find the create notebook button (mat-card in the project-buttons-flow)
      let createButton = document.querySelector('div.project-buttons-flow > mat-card');
      
      if (!createButton) {
        // Try alternative selectors
        createButton = document.querySelector('mat-card[role="button"], .project-buttons-flow mat-card, .all-projects-container mat-card');
      }
      
      if (!createButton) {
        throw new Error('Could not find create notebook button');
      }
      
      console.log('Clicking create notebook button...');
      createButton.click();
      
      // Wait for the notebook to be created and the "Add source" modal to appear
      await waitForElement('#mat-mdc-dialog-0, upload-dialog, mat-dialog-container', 10000, 200);
      
      // Wait a moment for the modal to fully load
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Close the "Add source" modal that opens automatically
      console.log('Closing Add source modal...');
      let closeModalButton = document.querySelector('#mat-mdc-dialog-0 > div > div > upload-dialog > div > div.header > span > button');
      
      if (!closeModalButton) {
        // Try alternative selectors for the close button
        const uploadDialog = document.querySelector('upload-dialog');
        if (uploadDialog) {
          closeModalButton = uploadDialog.querySelector('div.header button, div.header span button, button[aria-label*="Close"], button[aria-label*="close"]');
        }
      }
      
      if (!closeModalButton) {
        // Try finding by the dialog container
        const dialogContainer = document.querySelector('#mat-mdc-dialog-0, mat-dialog-container');
        if (dialogContainer) {
          closeModalButton = dialogContainer.querySelector('div.header button, div.header span button, button[aria-label*="Close"]');
        }
      }
      
      if (!closeModalButton) {
        // Fallback: try to find any close button in the dialog
        const buttons = document.querySelectorAll('#mat-mdc-dialog-0 button, upload-dialog button');
        for (let btn of buttons) {
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          if (ariaLabel.includes('close') || ariaLabel === 'close dialog') {
            closeModalButton = btn;
            break;
          }
        }
      }
      
      if (closeModalButton) {
        closeModalButton.click();
        console.log('Closed Add source modal');
        // Wait for modal to close
        await waitForElementToDisappear('#mat-mdc-dialog-0, upload-dialog', 3000);
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.warn('Could not find close button, continuing anyway...');
        // Wait a bit anyway
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Now find the notebook name input field in the header
      console.log('Finding notebook name input...');
      let nameInput = document.querySelector('body > labs-tailwind-root > div > notebook > notebook-header > div > page-header > div > div.title-container.ng-star-inserted > div > editable-project-title > div > input');
      
      if (!nameInput) {
        // Try alternative selectors
        nameInput = document.querySelector('editable-project-title input, .title-container input, notebook-header input[type="text"]');
      }
      
      if (!nameInput) {
        // Try more generic approach
        const editableTitle = document.querySelector('editable-project-title');
        if (editableTitle) {
          nameInput = editableTitle.querySelector('input, div input');
        }
      }
      
      if (!nameInput) {
        // Final fallback: search for input in the notebook header
        const notebookHeader = document.querySelector('notebook-header, page-header');
        if (notebookHeader) {
          const inputs = notebookHeader.querySelectorAll('input');
          for (let input of inputs) {
            if (input.type === 'text' || !input.type) {
              nameInput = input;
              break;
            }
          }
        }
      }
      
      if (!nameInput) {
        throw new Error('Could not find notebook name input field');
      }
      
      console.log('Entering notebook name...');
      nameInput.focus();
      nameInput.select();
      
      // Set the book name as the notebook name
      // Use native setter for Angular forms
      try {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(nameInput, bookName);
      } catch (e) {
        nameInput.value = bookName;
      }
      
      // Trigger input events for Angular forms
      nameInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      
      // Also try setting value again and dispatching
      nameInput.value = bookName;
      nameInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      
      // Wait a moment for the form to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // If value didn't stick, try character by character
      if (nameInput.value !== bookName && bookName.length > 0) {
        nameInput.value = '';
        nameInput.focus();
        for (let i = 0; i < bookName.length; i++) {
          nameInput.value += bookName[i];
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      
      // Trigger blur to save (some editable titles save on blur)
      nameInput.blur();
      
      // Wait a moment for the name to be saved
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Notebook name set successfully');
      
      // Wait for notebook to be ready (ensure the page is fully loaded)
      await waitForElement('section.source-panel, button[aria-label="Add source"], .add-source-button', 10000, 200);
      
      console.log('Notebook created and opened successfully');
      return;
    }
    
    // Notebook exists, open it
    // Find the clickable element within the project button (the mat-card or project-button-box)
    let clickableElement = targetButton.querySelector('mat-card, .project-button-card, .project-button-box, [role="button"]');
    
    if (!clickableElement) {
      // Fallback: click the project button itself
      clickableElement = targetButton;
    }
    
    console.log('Clicking notebook button...');
    clickableElement.click();
    
    // Wait for the notebook page to load (check for URL change or notebook-specific elements)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Wait for notebook-specific elements to appear
    await waitForElement('section.source-panel, button[aria-label="Add source"], .add-source-button', 10000, 200);
    
    console.log('Notebook opened successfully');
    
  } catch (error) {
    console.error('Error opening notebook:', error);
    throw error;
  }
}

/**
 * Scrape notebook names from the NotebookLM projects page
 * Only scrapes notebooks from the user's own projects container
 * @returns {Promise<string[]>} Array of notebook names
 */
export async function scrapeNotebookNames() {
  try {
    console.log('Scraping notebook names from NotebookLM...');
    
    // Wait for the projects page to load
    await waitForElement('project-button, .project-button, welcome-page', 10000, 100);
    
    // Wait a bit more for projects to fully render
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Find the my-projects-container element (only user's own notebooks)
    const myProjectsContainer = document.querySelector('div.my-projects-container');
    
    if (!myProjectsContainer) {
      console.log('Could not find my-projects-container, trying to find project buttons directly in body...');
      // Fallback: if container doesn't exist, return empty (don't scrape suggested notebooks)
      return [];
    }
    
    // Find project buttons only within my-projects-container
    const projectButtons = myProjectsContainer.querySelectorAll('project-button');
    
    if (projectButtons.length === 0) {
      console.log('No notebooks found in my-projects-container');
      return [];
    }
    
    console.log(`Found ${projectButtons.length} notebook(s) in my-projects-container`);
    
    const notebookNames = [];
    
    // Extract notebook names from project buttons
    for (let button of projectButtons) {
      // Find the title element within the project button
      const titleElement = button.querySelector('.project-button-title, [class*="project-button-title"], span[id$="-title"]');
      
      if (titleElement) {
        const titleText = titleElement.textContent.trim();
        if (titleText) {
          notebookNames.push(titleText);
          console.log(`Found notebook: "${titleText}"`);
        }
      } else {
        // Fallback: try to get text from the button itself
        const buttonText = button.textContent?.trim();
        if (buttonText && !buttonText.includes('New notebook') && !buttonText.includes('Create')) {
          notebookNames.push(buttonText);
          console.log(`Found notebook (fallback): "${buttonText}"`);
        }
      }
    }
    
    console.log(`Scraped ${notebookNames.length} notebook names:`, notebookNames);
    return notebookNames;
    
  } catch (error) {
    console.error('Error scraping notebook names:', error);
    throw error;
  }
}

// Export waitForTabReady for use in main notebooklm.js
export { waitForTabReady };

