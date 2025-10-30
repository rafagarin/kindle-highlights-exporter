// Learning Workflow Extension - Content Script
console.log('Learning Workflow Extension content script loaded on:', window.location.href);

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Content script received message:', request);
  
  if (request.action === 'exportToNotebooklm') {
    handleNotebooklmExport(request.content)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'createFlashcards') {
    handleCreateFlashcards()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true; // Keep message channel open for async response
  }
  
  sendResponse({status: 'ready'});
});

// Initialize content script when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  console.log('Learning Workflow Extension content script initialized on:', document.title);
}

async function handleNotebooklmExport(content) {
  try {
    console.log('Starting NotebookLM export automation...');
    
    // Step 1: Find and click the "Add source" button
    const addSourceButton = await waitForElement('button[aria-label="Add source"], .add-source-button', 10000);
    if (!addSourceButton) {
      throw new Error('Could not find "Add source" button');
    }
    
    console.log('Clicking Add source button...');
    addSourceButton.click();
    
    // Wait for the modal/dialog to appear
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Find and click the "Copied text" chip
    // Based on the recorded output, try multiple selectors
    let copiedTextChip = await waitForElement('div:nth-of-type(3) span.mdc-evolution-chip__text-label > span:nth-of-type(1)', 3000);
    
    if (!copiedTextChip) {
      // Try alternative selectors from the recording
      copiedTextChip = await waitForElement('#mat-mdc-chip-11', 2000);
    }
    
    if (!copiedTextChip) {
      // Fallback: search all chips for "Copied text"
      const chips = document.querySelectorAll('mat-chip');
      let foundChip = null;
      for (let chip of chips) {
        if (chip.textContent.includes('Copied text')) {
          foundChip = chip;
          break;
        }
      }
      if (!foundChip) {
        throw new Error('Could not find "Copied text" chip');
      }
      foundChip.click();
    } else {
      copiedTextChip.click();
    }
    
    console.log('Clicked Copied text chip...');
    
    // Wait for the textarea to appear
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Find and focus the textarea
    // Based on the recording, use the specific ID selector
    let textarea = await waitForElement('#mat-input-1', 5000);
    
    if (!textarea) {
      // Try alternative selectors
      textarea = await waitForElement('textarea[formcontrolname="text"], textarea.mat-mdc-input-element', 3000);
    }
    
    if (!textarea) {
      throw new Error('Could not find textarea');
    }
    
    console.log('Focusing textarea...');
    textarea.focus();
    
    // Clear any existing content and paste the new content
    textarea.value = '';
    textarea.value = content;
    
    // Trigger input event to ensure the form recognizes the change
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Wait a moment for the form to update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 4: Find and click the "Insert" button
    // Based on the recording, use the specific selector
    let insertButton = await waitForElement('div.cdk-overlay-container form span.mat-mdc-button-touch-target', 5000);
    
    if (!insertButton) {
      // Try alternative selectors
      insertButton = await waitForElement('button[type="submit"]', 3000);
    }
    
    if (!insertButton) {
      // Fallback: search all buttons for "Insert"
      const buttons = document.querySelectorAll('button');
      let foundButton = null;
      for (let button of buttons) {
        if (button.textContent.includes('Insert')) {
          foundButton = button;
          break;
        }
      }
      if (!foundButton) {
        throw new Error('Could not find "Insert" button');
      }
      foundButton.click();
    } else {
      insertButton.click();
    }
    
    console.log('Clicked Insert button...');
    
    // Wait for the operation to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 5: Close the sources modal
    console.log('Closing sources modal...');
    let closeButton = await waitForElement('div > div.header mat-icon', 3000);
    
    if (!closeButton) {
      // Try alternative selectors from the recording
      closeButton = await waitForElement('[aria-label="Close dialog"]', 2000);
    }
    
    if (!closeButton) {
      // Fallback: search for close icon
      const closeIcons = document.querySelectorAll('mat-icon');
      let foundIcon = null;
      for (let icon of closeIcons) {
        if (icon.textContent.includes('close') || icon.getAttribute('aria-label') === 'Close dialog') {
          foundIcon = icon;
          break;
        }
      }
      if (foundIcon) {
        closeButton = foundIcon;
      }
    }
    
    if (closeButton) {
      closeButton.click();
      console.log('Closed sources modal...');
    } else {
      console.log('Could not find close button, but continuing...');
    }
    
    // Wait for modal to close
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return { success: true, message: 'Successfully exported to NotebookLM' };
    
  } catch (error) {
    console.error('NotebookLM export error:', error);
    return { success: false, error: error.message };
  }
}

async function handleCreateFlashcards() {
  try {
    console.log('Starting create flashcards automation...');
    
    // Find and click the "Create flashcards" button
    // Based on the recording, try multiple selectors
    let createFlashcardsButton = await waitForElement('basic-create-artifact-button:nth-of-type(5) span.slim-container > span > span', 5000);
    
    if (!createFlashcardsButton) {
      // Try alternative selectors from the recording
      createFlashcardsButton = await waitForElement('basic-create-artifact-button:nth-of-type(5)', 3000);
    }
    
    if (!createFlashcardsButton) {
      // Fallback: search for buttons with "flashcard" or similar text
      const buttons = document.querySelectorAll('basic-create-artifact-button');
      let foundButton = null;
      for (let button of buttons) {
        const text = button.textContent.toLowerCase();
        if (text.includes('flashcard') || text.includes('create') || text.includes('study')) {
          foundButton = button;
          break;
        }
      }
      if (!foundButton) {
        throw new Error('Could not find "Create flashcards" button');
      }
      foundButton.click();
    } else {
      createFlashcardsButton.click();
    }
    
    console.log('Clicked Create flashcards button...');
    
    // Wait for the flashcards to be generated
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return { success: true, message: 'Successfully created flashcards' };
    
  } catch (error) {
    console.error('Create flashcards error:', error);
    return { success: false, error: error.message };
  }
}

function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}
