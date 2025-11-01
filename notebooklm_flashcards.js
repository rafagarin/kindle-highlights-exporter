// NotebookLM flashcard creation module

import { waitForElement } from './notebooklm_utils.js';

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

