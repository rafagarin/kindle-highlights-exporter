// NotebookLM integration module

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
    statusCallback('Waiting for NotebookLM to load...', 'info');
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

// ============================================================================
// DOM Automation Functions (for use in content scripts)
// ============================================================================

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
      throw new Error(`Could not find notebook with name: "${bookName}"`);
    }
    
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
 * Handle NotebookLM export automation
 * @param {string} content - Content to export
 * @param {string} sourceName - Optional name for the source
 * @returns {Promise<{success: boolean, error?: string, message?: string}>}
 */
export async function handleNotebooklmExport(content, sourceName = null) {
  try {
    console.log('Starting NotebookLM export automation...');
    
    // Step 0: Check for existing source with the same name and remove it if found
    if (sourceName) {
      try {
        console.log(`Checking for existing source with name: "${sourceName}"`);
        
        // Wait for the sources list to be visible
        const sourcesSection = await waitForElement('section.source-panel', 5000, 100);
        
        if (sourcesSection) {
          // Wait a moment for sources to fully load
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Find all source items - try multiple selectors
          let sourceItems = sourcesSection.querySelectorAll('[class*="source-item"], [class*="source"], .source, article, [role="article"]');
          
          // If no items found with those selectors, try finding all list items or divs that might contain sources
          if (sourceItems.length === 0) {
            sourceItems = sourcesSection.querySelectorAll('li, div[class*="item"], div[class*="card"]');
          }
          
          let matchingSource = null;
          
          // Look for a source with matching name
          for (let sourceItem of sourceItems) {
            // Skip if this item is too small (probably not a source item)
            const rect = sourceItem.getBoundingClientRect();
            if (rect.height < 30 || rect.width < 100) {
              continue;
            }
            
            // Try to find the source name - could be in various places
            const sourceText = sourceItem.textContent || '';
            const sourceTitle = sourceItem.querySelector('.source-title, [class*="title"], .source-name, h3, h4, [class*="heading"]');
            
            // Check if the source name matches (exact match preferred, but also check if it's included)
            let nameToCheck = '';
            if (sourceTitle) {
              nameToCheck = sourceTitle.textContent.trim();
            } else {
              // Try to extract just the first line or main text
              const lines = sourceText.split('\n').filter(line => line.trim());
              nameToCheck = lines[0] ? lines[0].trim() : sourceText.trim();
            }
            
            // Exact match is preferred
            if (nameToCheck === sourceName) {
              matchingSource = sourceItem;
              console.log(`Found existing source with exact name match: "${nameToCheck}"`);
              break;
            }
            
            // Also check if the name is included (for cases where there might be extra text)
            if (nameToCheck && (nameToCheck.includes(sourceName) || sourceName.includes(nameToCheck))) {
              // Make sure it's not a false positive by checking if it's the main text
              const normalizedName = nameToCheck.toLowerCase().replace(/\s+/g, ' ');
              const normalizedSourceName = sourceName.toLowerCase().replace(/\s+/g, ' ');
              if (normalizedName.includes(normalizedSourceName) || normalizedSourceName.includes(normalizedName)) {
                matchingSource = sourceItem;
                console.log(`Found existing source with name containing match: "${nameToCheck}"`);
                break;
              }
            }
          }
          
          // Alternative: search by walking the DOM if structured search didn't work
          if (!matchingSource) {
            const allText = sourcesSection.textContent || '';
            if (allText.includes(sourceName)) {
              // Try to find the source item container that contains this exact text
              const walker = document.createTreeWalker(
                sourcesSection,
                NodeFilter.SHOW_TEXT,
                null
              );
              
              let textNode;
              while (textNode = walker.nextNode()) {
                if (textNode.textContent && textNode.textContent.trim() === sourceName) {
                  // Find the containing source item
                  let parent = textNode.parentElement;
                  while (parent && parent !== sourcesSection) {
                    const rect = parent.getBoundingClientRect();
                    // Check if this looks like a source item container
                    if (rect.height > 30 && rect.width > 100) {
                      matchingSource = parent;
                      console.log(`Found existing source by text node walker: "${sourceName}"`);
                      break;
                    }
                    parent = parent.parentElement;
                  }
                  if (matchingSource) break;
                }
              }
            }
          }
          
          if (matchingSource) {
            console.log('Found existing source, removing it...');
            
            // Find the More button for this specific source
            let moreButton = matchingSource.querySelector('mat-icon.source-item-more-menu-icon, button[aria-label="More"]');
            
            if (!moreButton) {
              // Try alternative selectors within the source item
              moreButton = matchingSource.querySelector('button[aria-label*="More"], mat-icon[aria-label*="More"]');
            }
            
            if (!moreButton) {
              // Try finding by icon or button near the source name
              const icons = matchingSource.querySelectorAll('mat-icon, button');
              for (let icon of icons) {
                const ariaLabel = icon.getAttribute('aria-label') || '';
                if (ariaLabel.toLowerCase().includes('more') || ariaLabel.toLowerCase().includes('menu')) {
                  moreButton = icon;
                  break;
                }
              }
            }
            
            if (moreButton) {
              // Find the button element (might be the icon's parent)
              let buttonToClick = moreButton;
              if (moreButton.tagName === 'MAT-ICON') {
                buttonToClick = moreButton.closest('button') || moreButton.parentElement;
              }
              
              console.log('Clicking more menu button for existing source...');
              buttonToClick.click();
              
              // Wait for the menu to appear
              await new Promise(resolve => setTimeout(resolve, 300));
              
              // Find and click "Remove source" button
              let removeButton = document.querySelector('button[aria-label="Remove source"]');
              
              if (!removeButton) {
                // Try alternative selectors - search all buttons in the overlay
                const buttons = document.querySelectorAll('div.cdk-overlay-container button, mat-menu button');
                for (let btn of buttons) {
                  const text = btn.textContent.trim().toLowerCase();
                  if ((text.includes('remove') || text.includes('delete')) && 
                      (text.includes('source') || text === 'remove' || text === 'delete')) {
                    removeButton = btn;
                    break;
                  }
                }
              }
              
              // Also try by the structure
              if (!removeButton) {
                const overlayButtons = document.querySelectorAll('div.cdk-overlay-container div.ng-star-inserted > button');
                for (let btn of overlayButtons) {
                  const text = btn.textContent.trim().toLowerCase();
                  if (text.includes('remove') || text.includes('delete')) {
                    removeButton = btn;
                    break;
                  }
                }
              }
              
              if (!removeButton) {
                console.warn('Could not find "Remove source" button');
              } else {
                console.log('Clicking Remove source button...');
                removeButton.click();
                
                // Wait for confirmation dialog if it appears
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Check if there's a confirmation dialog
                // Look for confirmation buttons in any dialog that appeared
                const buttons = document.querySelectorAll('div.cdk-overlay-container button, mat-dialog-container button');
                let confirmButton = null;
                for (let btn of buttons) {
                  const text = btn.textContent.trim().toLowerCase();
                  const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                  if (((text.includes('remove') || text.includes('delete')) || 
                       (ariaLabel.includes('remove') || ariaLabel.includes('delete'))) && 
                      !text.includes('cancel') && 
                      !ariaLabel.includes('cancel')) {
                    confirmButton = btn;
                    break;
                  }
                }
                
                if (confirmButton) {
                  console.log('Clicking confirmation button...');
                  confirmButton.click();
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                // Wait for the source to be removed
                await new Promise(resolve => setTimeout(resolve, 500));
                console.log('Existing source removed successfully');
              }
            } else {
              console.warn('Could not find More button for existing source');
            }
          } else {
            console.log(`No existing source found with name: "${sourceName}"`);
          }
        } else {
          console.log('Sources section not found, proceeding with new source');
        }
      } catch (error) {
        // Don't fail the whole operation if checking/removing existing source fails
        console.warn('Error checking/removing existing source:', error);
      }
    }
    
    // Step 1: Find and click the "Add source" button
    const addSourceButton = await waitForElement('button[aria-label="Add source"], .add-source-button', 10000);
    if (!addSourceButton) {
      throw new Error('Could not find "Add source" button');
    }
    
    console.log('Clicking Add source button...');
    addSourceButton.click();
    
    // Wait for the modal/dialog to appear - use adaptive wait
    await waitForElement('.cdk-overlay-container, mat-dialog-container', 3000, 100);
    
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
    
    // Wait for the textarea to appear - check immediately and poll
    await waitForElement('textarea', 3000, 100);
    
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
    
    // Wait a moment for the form to update - reduced wait time
    await new Promise(resolve => setTimeout(resolve, 300));
    
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
    
    // Wait for the operation to complete - reduced wait, check for completion
    // Wait for either success indicator or modal to start closing
    await Promise.race([
      waitForElement('[aria-label*="success"], .success-indicator', 2000, 100).catch(() => null),
      new Promise(resolve => setTimeout(resolve, 1000))
    ]);
    
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
      // Wait briefly for modal to close, but don't block too long
      await new Promise(resolve => setTimeout(resolve, 300));
    } else {
      console.log('Could not find close button, but continuing...');
    }
    
    // Step 6: Rename the source if sourceName is provided
    if (sourceName) {
      try {
        console.log('Renaming source to:', sourceName);
        
        // Wait for the sources modal to fully close first
        await waitForElementToDisappear('.cdk-overlay-container mat-dialog-container, .cdk-overlay-container .sources-dialog', 3000);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Wait for the sources list to be visible and interactive
        const sourcesSection = await waitForElement('section.source-panel', 5000, 100);
        
        if (!sourcesSection) {
          console.warn('Could not find sources section');
        } else {
          // Wait a bit more for the source to fully appear in the list
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Find the most recently added source (should be the last one in the list)
          // Look for the three dots menu button - scoped to the sources section
          let moreButtons = sourcesSection.querySelectorAll('mat-icon.source-item-more-menu-icon, button[aria-label="More"]');
          
          // If not found, wait and try again with polling
          if (moreButtons.length === 0) {
            console.log('More buttons not found yet, waiting and polling...');
            let attempts = 0;
            while (moreButtons.length === 0 && attempts < 10) {
              await new Promise(resolve => setTimeout(resolve, 300));
              moreButtons = sourcesSection.querySelectorAll('mat-icon.source-item-more-menu-icon, button[aria-label="More"]');
              attempts++;
            }
          }
          
          if (moreButtons.length === 0) {
            console.warn('Could not find any source more buttons in sources section after waiting');
          } else {
            // Get the last (most recent) source's more button
            const lastMoreButton = moreButtons[moreButtons.length - 1];
            
            // Find the button element (might be the icon's parent)
            let buttonToClick = lastMoreButton;
            if (lastMoreButton.tagName === 'MAT-ICON') {
              buttonToClick = lastMoreButton.closest('button') || lastMoreButton.parentElement;
            }
            
            console.log('Clicking more menu button...');
            buttonToClick.click();
            
            // Wait for the menu to appear
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Find and click "Rename source" button
            // Try finding by aria label first
            let renameButton = document.querySelector('button[aria-label="Rename source"]');
            
            if (!renameButton) {
              // Try alternative selectors - search all buttons in the overlay
              const buttons = document.querySelectorAll('div.cdk-overlay-container button, mat-menu button');
              for (let btn of buttons) {
                const text = btn.textContent.trim().toLowerCase();
                if (text.includes('rename') || text === 'rename source') {
                  renameButton = btn;
                  break;
                }
              }
            }
            
            // Also try by the structure from the recording (div.cdk-overlay-container div.ng-star-inserted > button)
            if (!renameButton) {
              const overlayButtons = document.querySelectorAll('div.cdk-overlay-container div.ng-star-inserted > button');
              for (let btn of overlayButtons) {
                if (btn.textContent.trim().toLowerCase().includes('rename')) {
                  renameButton = btn;
                  break;
                }
              }
            }
            
            if (!renameButton) {
              console.warn('Could not find "Rename source" button');
            } else {
              console.log('Clicking Rename source button...');
              renameButton.click();
              
              // Wait for the rename dialog to appear
              await waitForElement('.edit-source-dialog, mat-dialog-container', 3000, 100);
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Find the specific form element first
              let editForm = document.querySelector('#mat-mdc-dialog-1 > div > div > edit-source-dialog > div > form');
              
              if (!editForm) {
                // Fallback: try alternative selectors for the form
                const editDialog = document.querySelector('.edit-source-dialog, mat-dialog-container');
                if (editDialog) {
                  editForm = editDialog.querySelector('form');
                }
              }
              
              let nameInput = null;
              
              if (!editForm) {
                console.warn('Could not find edit source form, trying global search');
                // Fallback: search globally but prefer formcontrolname="title"
                nameInput = document.querySelector('div.edit-source-dialog input[formcontrolname="title"], mat-dialog-container input[formcontrolname="title"]');
              } else {
                // Find and focus the source name input within the form
                nameInput = editForm.querySelector('#mat-input-1, input[formcontrolname="title"], input.title-input');
                
                if (!nameInput) {
                  // Try alternative selectors within the form
                  nameInput = editForm.querySelector('input[type="text"], input.mat-mdc-input-element');
                }
              }
              
              // Final fallback if still not found
              if (!nameInput) {
                console.warn('Could not find input in form, trying global search as final fallback');
                nameInput = document.querySelector('div.edit-source-dialog input, mat-dialog-container input');
              }
              
              if (!nameInput) {
                console.warn('Could not find source name input');
              } else {
                console.log('Focusing and updating source name input...');
                
                // Focus and select all text
                nameInput.focus();
                
                // Select all existing text
                nameInput.select();
                
                // For Angular forms, we need to properly set the value
                // Try the native setter first (for Angular reactive forms)
                try {
                  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                  nativeInputValueSetter.call(nameInput, sourceName);
                } catch (e) {
                  // Fallback: just set the value normally
                  nameInput.value = sourceName;
                }
                
                // Trigger multiple events to ensure Angular recognizes the change
                // First, dispatch input event with the new value
                nameInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                
                // Also trigger change event
                nameInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                
                // One more time to ensure the value is set (sometimes needed for Angular reactive forms)
                nameInput.value = sourceName;
                nameInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                
                // Wait a brief moment, then verify the value was set
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // If value didn't stick, try one more approach: type it character by character
                if (nameInput.value !== sourceName && sourceName.length > 0) {
                  nameInput.value = '';
                  nameInput.focus();
                  // Simulate typing - this often works better with Angular forms
                  for (let i = 0; i < sourceName.length; i++) {
                    nameInput.value += sourceName[i];
                    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
                  }
                }
                
                // Wait a moment for the form to update
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Find and click the Save/Submit button
                // First try to find by the touch target span (most specific selector)
                let saveButton = document.querySelector('span.mat-mdc-button-touch-target');
                
                if (saveButton) {
                  // Find the parent button with submit-button class
                  saveButton = saveButton.closest('button.submit-button');
                }
                
                // If not found, try the specific path (dialog ID might be dynamic, so try pattern)
                if (!saveButton) {
                  // Try pattern with any dialog ID
                  const dialogPattern = document.querySelector('[id^="mat-mdc-dialog-"]');
                  if (dialogPattern) {
                    const dialogId = dialogPattern.id;
                    saveButton = document.querySelector(`${dialogId} > div > div > edit-source-dialog > div > form > mat-dialog-actions > button.submit-button`);
                  }
                }
                
                // Try within the form we already found
                if (!saveButton && editForm) {
                  // Search within the form for the submit button
                  saveButton = editForm.querySelector('button.submit-button, button[type="submit"], mat-dialog-actions button.submit-button');
                  
                  // Also try to find by the touch target span within the form
                  if (!saveButton) {
                    const touchTarget = editForm.querySelector('span.mat-mdc-button-touch-target');
                    if (touchTarget) {
                      saveButton = touchTarget.closest('button.submit-button') || touchTarget.closest('button[type="submit"]');
                    }
                  }
                }
                
                // Fallback: try global selectors with wait
                if (!saveButton) {
                  saveButton = await waitForElement('button.submit-button, button[type="submit"]', 2000, 100);
                }
                
                // Additional fallback: try finding by text content
                if (!saveButton) {
                  const buttons = document.querySelectorAll('div.cdk-overlay-container button, mat-dialog-actions button');
                  for (let btn of buttons) {
                    const btnText = btn.textContent.trim().toLowerCase();
                    if ((btnText.includes('save') && !btnText.includes('cancel')) || 
                        btn.classList.contains('submit-button')) {
                      saveButton = btn;
                      break;
                    }
                  }
                }
                
                if (!saveButton) {
                  console.warn('Could not find Save button');
                } else {
                  console.log('Clicking Save button...');
                  saveButton.click();
                  
                  // Wait for the dialog to close
                  await new Promise(resolve => setTimeout(resolve, 500));
                  console.log('Source renamed successfully');
                }
              }
            }
          }
        }
      } catch (error) {
        // Don't fail the whole operation if renaming fails
        console.warn('Error renaming source:', error);
      }
    }
    
    return { success: true, message: 'Successfully exported to NotebookLM' };
    
  } catch (error) {
    console.error('NotebookLM export error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle creating flashcards in NotebookLM
 * @param {string} sourceName - Optional name of the source to select for flashcards
 * @returns {Promise<{success: boolean, error?: string, message?: string}>}
 */
export async function handleCreateFlashcards(sourceName = null) {
  try {
    console.log('Starting create flashcards automation...');
    
    // Step 1: Select only the specified source (uncheck all others)
    if (sourceName) {
      try {
        console.log(`Selecting only source: "${sourceName}" for flashcards...`);
        
        // Wait for the sources list to be visible
        const sourcesSection = await waitForElement('section.source-panel', 5000, 100);
        
        if (sourcesSection) {
          // Find all checkboxes in the sources section
          const allCheckboxes = sourcesSection.querySelectorAll('input[type="checkbox"].mdc-checkbox__native-control');
          
          console.log(`Found ${allCheckboxes.length} source checkbox(es)`);
          
          // Uncheck all checkboxes first
          for (let checkbox of allCheckboxes) {
            if (checkbox.checked) {
              checkbox.click();
              await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between clicks
            }
          }
          
          // Now find and check only the checkbox for the specified source
          let targetCheckbox = null;
          
          // Method 1: Find by aria-label (the checkbox aria-label contains the source name)
          for (let checkbox of allCheckboxes) {
            const ariaLabel = checkbox.getAttribute('aria-label') || '';
            if (ariaLabel.trim() === sourceName || ariaLabel.includes(sourceName)) {
              targetCheckbox = checkbox;
              console.log(`Found target checkbox by aria-label: "${ariaLabel}"`);
              break;
            }
          }
          
          // Method 2: Find by finding the source container first, then its checkbox
          if (!targetCheckbox) {
            const sourceContainers = sourcesSection.querySelectorAll('.single-source-container, [class*="source-container"]');
            for (let container of sourceContainers) {
              // Find the source title in this container
              const sourceTitle = container.querySelector('.source-title, [class*="title"], [aria-label="Source title"]');
              if (sourceTitle) {
                const titleText = sourceTitle.textContent.trim();
                if (titleText === sourceName || titleText.includes(sourceName)) {
                  // Find the checkbox within this container
                  targetCheckbox = container.querySelector('input[type="checkbox"].mdc-checkbox__native-control');
                  if (targetCheckbox) {
                    console.log(`Found target checkbox by container title: "${titleText}"`);
                    break;
                  }
                }
              }
            }
          }
          
          // Method 3: Find the most recently added source (last in the list) if exact match fails
          if (!targetCheckbox && allCheckboxes.length > 0) {
            targetCheckbox = allCheckboxes[allCheckboxes.length - 1];
            console.log('Using most recently added source (last checkbox in list)');
          }
          
          if (targetCheckbox) {
            if (!targetCheckbox.checked) {
              targetCheckbox.click();
              await new Promise(resolve => setTimeout(resolve, 200));
              console.log('Selected target source checkbox');
            } else {
              console.log('Target source checkbox was already checked');
            }
          } else {
            console.warn(`Could not find checkbox for source: "${sourceName}", proceeding with all sources`);
          }
        } else {
          console.warn('Sources section not found, proceeding without source selection');
        }
      } catch (error) {
        // Don't fail the whole operation if source selection fails
        console.warn('Error selecting source for flashcards:', error);
      }
    } else {
      console.log('No source name provided, all selected sources will be used');
    }
    
    // Step 2: Find and click the "Create flashcards" button
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

