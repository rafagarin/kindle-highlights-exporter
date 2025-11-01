// NotebookLM flashcard creation module

import { waitForElement } from './notebooklm_utils.js';

/**
 * Wait for flashcard generation to complete by monitoring for "Generating Flashcards..." text
 * @param {Function} statusUpdateCallback - Optional callback for status updates (sends messages to extension)
 * @returns {Promise<void>}
 */
async function waitForFlashcardGeneration(statusUpdateCallback = null) {
  const maxWaitTime = 5 * 60 * 1000; // 5 minutes
  const pollInterval = 1000; // Check every second
  const startTime = Date.now();
  
  console.log('Waiting for flashcards to finish generating...');
  
  if (statusUpdateCallback) {
    statusUpdateCallback('Waiting for flashcards to generate...');
  }
  
  // First, find the studio panel section to scope our search
  let studioPanel = await waitForElement('body > labs-tailwind-root > div > notebook > div > section.studio-panel', 5000, 100);
  if (!studioPanel) {
    studioPanel = await waitForElement('section.studio-panel', 3000, 100);
  }
  
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      // Check if "Generating Flashcards..." text exists in the studio panel section
      let hasGeneratingText = false;
      
      if (studioPanel) {
        // Check text content within the studio panel
        const panelText = studioPanel.textContent || '';
        hasGeneratingText = panelText.includes('Generating Flashcards') || panelText.includes('Generating flashcards');
        
        // Also use TreeWalker to check text nodes within studio panel
        if (!hasGeneratingText) {
          const walker = document.createTreeWalker(
            studioPanel,
            NodeFilter.SHOW_TEXT,
            null
          );
          
          let textNode;
          while (textNode = walker.nextNode()) {
            const text = textNode.textContent.trim();
            if (text.includes('Generating Flashcards') || text.includes('Generating flashcards') || text === 'Generating Flashcards...') {
              hasGeneratingText = true;
              break;
            }
          }
        }
      } else {
        // Fallback: check entire body if studio panel not found
        const bodyText = document.body.textContent || '';
        hasGeneratingText = bodyText.includes('Generating Flashcards') || bodyText.includes('Generating flashcards');
      }
      
      // If we found no generating text, generation is complete
      if (!hasGeneratingText) {
        clearInterval(checkInterval);
        console.log('Flashcards finished generating');
        resolve();
        return;
      }
      
      // Check timeout
      if (Date.now() - startTime >= maxWaitTime) {
        clearInterval(checkInterval);
        console.warn('Timeout waiting for flashcards to generate, proceeding anyway');
        resolve(); // Resolve instead of reject to continue with rename
        return;
      }
      
      // Continue polling...
    }, pollInterval);
    
    // Also check immediately
    setTimeout(() => {
      if (studioPanel) {
        const panelText = studioPanel.textContent || '';
        const hasGeneratingText = panelText.includes('Generating Flashcards') || panelText.includes('Generating flashcards');
        if (!hasGeneratingText) {
          clearInterval(checkInterval);
          resolve();
        }
      } else {
        const bodyText = document.body.textContent || '';
        const hasGeneratingText = bodyText.includes('Generating Flashcards') || bodyText.includes('Generating flashcards');
        if (!hasGeneratingText) {
          clearInterval(checkInterval);
          resolve();
        }
      }
    }, 100);
  });
}

/**
 * Rename a flashcard in NotebookLM
 * @param {string} chapterName - Name to use for the flashcard
 * @returns {Promise<{success: boolean, error?: string, message?: string}>}
 */
export async function renameFlashcard(chapterName) {
  try {
    console.log(`Renaming flashcard to: "${chapterName}"...`);
    
    if (!chapterName) {
      console.warn('No chapter name provided, skipping rename');
      return { success: true, message: 'Skipped rename (no chapter name)' };
    }
    
    // Step 1: Find the flashcards section (studio panel) using the specific selector
    let studioPanel = await waitForElement('body > labs-tailwind-root > div > notebook > div > section.studio-panel', 5000, 100);
    if (!studioPanel) {
      // Fallback to simpler selector
      studioPanel = await waitForElement('section.studio-panel', 3000, 100);
      if (!studioPanel) {
        throw new Error('Could not find flashcards section (studio panel)');
      }
    }
    
    // Wait a moment for flashcards to fully render
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 2: Find the first flashcard item (newly created one) - scoped to studio panel
    let firstFlashcard = studioPanel.querySelector('artifact-library-item:nth-of-type(1)');
    
    if (!firstFlashcard) {
      // Fallback: try finding all artifact-library-item elements
      const allFlashcards = studioPanel.querySelectorAll('artifact-library-item');
      if (allFlashcards.length === 0) {
        throw new Error('No flashcards found in the artifact library');
      }
      firstFlashcard = allFlashcards[0];
    }
    
    console.log('Found first flashcard item');
    
    // Step 3: Find and click the More button - ensure it's scoped to the studio panel section
    // First, try to find within the first flashcard and the studio panel to avoid finding other More buttons
    let moreButton = firstFlashcard.querySelector('span.mdc-button__label mat-icon');
    
    if (!moreButton) {
      // Try alternative selectors within the flashcard
      moreButton = firstFlashcard.querySelector('button mat-icon, mat-icon');
    }
    
    if (!moreButton) {
      // Try finding by looking for any button in the flashcard item
      const buttons = firstFlashcard.querySelectorAll('button');
      for (let btn of buttons) {
        const icon = btn.querySelector('mat-icon');
        if (icon) {
          // Verify the button is within the studio panel section
          if (studioPanel.contains(btn)) {
            moreButton = icon;
            break;
          }
        }
      }
    }
    
    // Final verification: make sure the more button is within the studio panel
    if (moreButton && !studioPanel.contains(moreButton)) {
      moreButton = null;
    }
    
    if (!moreButton) {
      throw new Error('Could not find More button on flashcard in studio panel section');
    }
    
    // Click the button (might be the icon or its parent button)
    let buttonToClick = moreButton;
    if (moreButton.tagName === 'MAT-ICON') {
      buttonToClick = moreButton.closest('button') || moreButton.parentElement;
    }
    
    console.log('Clicking More button...');
    buttonToClick.click();
    
    // Wait for the menu to appear
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Step 4: Find and click the "Rename" button
    // Based on the recording, try button.cdk-focused first
    let renameButton = document.querySelector('button.cdk-focused');
    
    // If not found, try finding by text content
    if (!renameButton) {
      const buttons = document.querySelectorAll('div.cdk-overlay-container button, mat-menu button');
      for (let btn of buttons) {
        const text = btn.textContent.trim();
        if (text.toLowerCase() === 'rename' || text.toLowerCase().includes('rename')) {
          renameButton = btn;
          break;
        }
      }
    }
    
    // If still not found, try finding by the span inside button
    if (!renameButton) {
      const span = document.querySelector('button.cdk-focused > span');
      if (span) {
        renameButton = span.closest('button');
      }
    }
    
    // Try finding by aria-label
    if (!renameButton) {
      const buttons = document.querySelectorAll('div.cdk-overlay-container button');
      for (let btn of buttons) {
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (ariaLabel.includes('rename')) {
          renameButton = btn;
          break;
        }
      }
    }
    
    if (!renameButton) {
      throw new Error('Could not find "Rename" button in menu');
    }
    
    console.log('Clicking Rename button...');
    renameButton.click();
    
    // Wait for the rename input to appear
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Step 5: Find the text input and set the chapter name
    // Scoped to studio panel to avoid finding inputs in other sections
    let nameInput = studioPanel.querySelector('input');
    
    if (!nameInput) {
      // Try finding in the first flashcard item
      nameInput = firstFlashcard.querySelector('input');
    }
    
    if (!nameInput) {
      // Try finding by role within studio panel
      nameInput = studioPanel.querySelector('input[role="textbox"]');
    }
    
    if (!nameInput) {
      // Fallback: search within studio panel
      nameInput = studioPanel.querySelector('input[type="text"], input');
    }
    
    // Final check: make sure input is within studio panel
    if (nameInput && !studioPanel.contains(nameInput)) {
      nameInput = null;
    }
    
    if (!nameInput) {
      throw new Error('Could not find flashcard name input field');
    }
    
    console.log('Focusing and updating flashcard name input...');
    nameInput.focus();
    
    // Select all existing text (like Cmd+A)
    nameInput.select();
    
    // Set the chapter name as the flashcard name
    // Use native setter for Angular forms
    try {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(nameInput, chapterName);
    } catch (e) {
      nameInput.value = chapterName;
    }
    
    // Trigger input events for Angular forms
    nameInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    nameInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    
    // Also try setting value again and dispatching
    nameInput.value = chapterName;
    nameInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    
    // Wait a moment for the form to update
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Step 6: Press Enter to save
    console.log('Pressing Enter to save...');
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    nameInput.dispatchEvent(enterEvent);
    
    // Also dispatch keyup
    const enterEventUp = new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    nameInput.dispatchEvent(enterEventUp);
    
    // Wait for the rename to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('Flashcard renamed successfully');
    return { success: true, message: `Successfully renamed flashcard to "${chapterName}"` };
    
  } catch (error) {
    console.error('Rename flashcard error:', error);
    // Don't fail the whole operation if renaming fails
    return { success: false, error: error.message };
  }
}

/**
 * Handle creating flashcards in NotebookLM
 * @param {string} sourceName - Optional name of the source to select for flashcards
 * @param {string} chapterName - Optional name to rename the flashcard after creation
 * @param {Function} statusUpdateCallback - Optional callback for status updates
 * @returns {Promise<{success: boolean, error?: string, message?: string}>}
 */
export async function handleCreateFlashcards(sourceName = null, chapterName = null, statusUpdateCallback = null) {
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
    // First wait a short time for the "Generating Flashcards..." text to appear
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Then wait for generation to complete
    await waitForFlashcardGeneration(statusUpdateCallback);
    
    // Step 3: Rename the flashcard if chapterName is provided
    if (chapterName) {
      try {
        console.log('Renaming flashcard after creation...');
        const renameResult = await renameFlashcard(chapterName);
        if (renameResult.success) {
          return { success: true, message: `Successfully created and renamed flashcards to "${chapterName}"` };
        } else {
          // If rename fails, still report success for creation but note the rename failure
          console.warn('Flashcard creation succeeded but rename failed:', renameResult.error);
          return { success: true, message: `Successfully created flashcards, but rename failed: ${renameResult.error}` };
        }
      } catch (error) {
        // If rename fails, still report success for creation
        console.warn('Flashcard creation succeeded but rename error:', error);
        return { success: true, message: `Successfully created flashcards, but rename error: ${error.message}` };
      }
    }
    
    return { success: true, message: 'Successfully created flashcards' };
    
  } catch (error) {
    console.error('Create flashcards error:', error);
    return { success: false, error: error.message };
  }
}

