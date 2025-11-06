// Gemini Chat integration module

// Import storage functions - note: this might not work in content script context
// For now, we'll use chrome.storage directly when needed

/**
 * Send content to Gemini chat
 * @param {string} gemUrl - URL of the Gemini gem/chat
 * @param {string} content - Content to send as the first message
 * @param {Function} statusCallback - Callback for status updates
 * @param {string} bookName - Optional book name for renaming conversation
 * @param {string} chapterName - Optional chapter name for renaming conversation
 * @returns {Promise<boolean>} Success status
 */
export async function sendToGeminiChat(gemUrl, content, statusCallback, bookName = null, chapterName = null) {
  if (!gemUrl) {
    statusCallback('Please provide a Gemini gem URL in the Config tab', 'error');
    return false;
  }
  
  if (!content) {
    // Get content from storage
    try {
      const storedContent = await new Promise((resolve) => {
        chrome.storage.local.get(['processedContent'], function(result) {
          resolve(result.processedContent || '');
        });
      });
      
      if (storedContent) {
        content = storedContent;
      } else {
        statusCallback('No content to send. Please run Step 2 first.', 'error');
        return false;
      }
    } catch (error) {
      statusCallback('Could not read content. Please run Step 2 first.', 'error');
      return false;
    }
  }
  
  try {
    statusCallback('Opening Gemini chat...', 'info');
    
    // Open the Gemini chat in a new tab
    const tab = await chrome.tabs.create({ url: gemUrl });
    
    // Wait for the page to load
    statusCallback('Creating Gemini quiz...', 'info');
    await waitForTabReady(tab.id);
    
    // Send message to content script to automate the chat interaction
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'sendToGeminiChat',
        content: content,
        bookName: bookName,
        chapterName: chapterName
      }, function(response) {
        if (chrome.runtime.lastError) {
          statusCallback('Please refresh the Gemini page and try again', 'error');
          resolve(false);
        } else if (response && response.success) {
          const message = response.message || 'Successfully sent content to Gemini chat!';
          statusCallback(message, 'success');
          resolve(true);
        } else {
          statusCallback(response?.error || 'Failed to send content to Gemini', 'error');
          resolve(false);
        }
      });
    });
    
  } catch (error) {
    console.error('Error sending to Gemini chat:', error);
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
          setTimeout(resolve, 1000);
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
 * Rename a Gemini conversation
 * @param {string} conversationName - Name to use for the conversation (format: "📖 Book Name - Chapter Name")
 * @returns {Promise<{success: boolean, error?: string, message?: string}>}
 */
async function renameGeminiConversation(conversationName) {
  try {
    console.log(`Renaming Gemini conversation to: "${conversationName}"...`);
    
    // Import waitForElement from utils if available
    let waitForElement;
    try {
      const utilsModule = await import(chrome.runtime.getURL('notebooklm_utils.js'));
      waitForElement = utilsModule.waitForElement;
    } catch (e) {
      // Fallback waitForElement implementation
      waitForElement = async (selector, timeout = 5000, pollInterval = 250) => {
        return new Promise((resolve) => {
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
            
            if (Date.now() - startTime >= timeout) {
              resolved = true;
              clearInterval(pollIntervalId);
              resolve(null);
            }
          }, pollInterval);
        });
      };
    }
    
    // Wait a moment for the conversation to appear in the list
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 1: Find the conversation list section
    const conversationsList = await waitForElement('conversations-list', 10000, 200);
    if (!conversationsList) {
      throw new Error('Could not find conversations list');
    }
    
    console.log('Found conversations list');
    
    // Step 2: Wait for the first conversation to appear, then wait for its More button
    // First, find the first conversation item
    let firstConversation = await waitForElement('conversations-list div.conversation', 10000, 200);
    
    if (!firstConversation) {
      // Try finding selected conversation
      firstConversation = conversationsList.querySelector('div.conversation.selected');
    }
    
    if (!firstConversation) {
      // Try finding by the specific structure
      const conversationItems = conversationsList.querySelectorAll('div.conversation, div.mat-mdc-tooltip-trigger.conversation');
      if (conversationItems.length > 0) {
        firstConversation = conversationItems[0];
      }
    }
    
    if (!firstConversation) {
      throw new Error('Could not find first conversation item');
    }
    
    console.log('Found first conversation item, waiting for it to fully load...');
    
    // Wait 10 seconds for the first conversation to be fully loaded before trying to rename
    // This ensures we rename the correct (newly created) conversation, not an older one
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // After the delay, re-find the first conversation to ensure we have the correct one
    // (the newly created conversation should now be first in the list)
    let currentFirstConversation = conversationsList.querySelector('div.conversation.selected');
    
    if (!currentFirstConversation) {
      const conversationItems = conversationsList.querySelectorAll('div.conversation, div.mat-mdc-tooltip-trigger.conversation');
      if (conversationItems.length > 0) {
        currentFirstConversation = conversationItems[0];
      }
    }
    
    // Use the re-found conversation, or fall back to the original one
    if (currentFirstConversation) {
      firstConversation = currentFirstConversation;
      console.log('Re-verified first conversation after delay');
    }
    
    console.log('First conversation should be fully loaded, hovering to reveal More button...');
    
    // Step 3: Hover over the conversation to reveal the More button
    // Trigger mouseenter and mouseover events to simulate hover
    const mouseEnterEvent = new MouseEvent('mouseenter', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    const mouseOverEvent = new MouseEvent('mouseover', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    firstConversation.dispatchEvent(mouseEnterEvent);
    firstConversation.dispatchEvent(mouseOverEvent);
    
    // Also try hovering on the parent element
    const parent = firstConversation.parentElement;
    if (parent) {
      parent.dispatchEvent(mouseEnterEvent);
      parent.dispatchEvent(mouseOverEvent);
    }
    
    // Wait a moment for the hover state to trigger
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Step 4: Wait for the More button (conversation-actions-menu-button) to appear after hover
    // Based on the provided selector: button.conversation-actions-menu-button
    // Wait up to 15 seconds for it to appear
    let moreButton = null;
    const maxWaitTime = 15000; // 15 seconds
    const pollInterval = 500; // Check every 500ms
    const startTime = Date.now();
    
    while (!moreButton && (Date.now() - startTime < maxWaitTime)) {
      // Try finding the More button with the correct selector
      // First try the conversation-actions-container, then the button
      const actionsContainer = firstConversation.querySelector('div.conversation-actions-container');
      
      if (actionsContainer) {
        moreButton = actionsContainer.querySelector('button.conversation-actions-menu-button');
      }
      
      // If not found, try finding by data-test-id
      if (!moreButton) {
        moreButton = firstConversation.querySelector('button[data-test-id="actions-menu-button"]');
      }
      
      // If not found, try finding by aria-label
      if (!moreButton) {
        moreButton = firstConversation.querySelector('button[aria-label="Open menu for conversation actions."]');
      }
      
      // If not found, try finding the button class directly
      if (!moreButton) {
        moreButton = firstConversation.querySelector('button.conversation-actions-menu-button');
      }
      
      // If not found, try finding by mat-icon with data-test-id
      if (!moreButton) {
        const icon = firstConversation.querySelector('mat-icon[data-test-id="actions-menu-icon"]');
        if (icon) {
          moreButton = icon.closest('button');
        }
      }
      
      // If still not found, try finding the conversation-actions-container and then button
      if (!moreButton) {
        const container = conversationsList.querySelector('div.conversation-actions-container');
        if (container) {
          moreButton = container.querySelector('button');
        }
      }
      
      // If found, break out of the loop
      if (moreButton) {
        break;
      }
      
      // If not found yet and we're still waiting, maintain hover
      if (Date.now() - startTime < maxWaitTime) {
        firstConversation.dispatchEvent(mouseOverEvent);
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    if (!moreButton) {
      throw new Error('Could not find More button (conversation-actions-menu-button) in first conversation after hovering and waiting 15 seconds');
    }
    
    console.log('Found More button, clicking...');
    moreButton.click();
    
    // Wait for the menu to appear
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Step 3: Find and click the "Rename" button in the menu
    // Wait for the menu to fully appear
    await new Promise(resolve => setTimeout(resolve, 300));
    
    let renameButton = null;
    
    // Search for button with "Rename" text in the overlay/menu
    const overlayButtons = document.querySelectorAll('div.cdk-overlay-container button, mat-menu button, button[role="menuitem"]');
    for (let btn of overlayButtons) {
      const text = btn.textContent.trim();
      if (text.toLowerCase() === 'rename') {
        renameButton = btn;
        break;
      }
    }
    
    // If not found in overlay, search all buttons
    if (!renameButton) {
      const buttons = document.querySelectorAll('button, [role="button"]');
      for (let btn of buttons) {
        const text = btn.textContent.trim();
        if (text.toLowerCase() === 'rename' && !btn.disabled) {
          renameButton = btn;
          break;
        }
      }
    }
    
    // Also try in mat-menu-panel if it exists
    if (!renameButton) {
      const menuPanel = document.querySelector('mat-menu-panel');
      if (menuPanel) {
        const menuButtons = menuPanel.querySelectorAll('button');
        for (let btn of menuButtons) {
          const text = btn.textContent.trim();
          if (text.toLowerCase() === 'rename') {
            renameButton = btn;
            break;
          }
        }
      }
    }
    
    if (!renameButton) {
      throw new Error('Could not find "Rename" button');
    }
    
    console.log('Clicking Rename button...');
    renameButton.click();
    
    // Wait for the rename dialog to appear
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 4: Find the text input field (will be automatically focused)
    // Selector: #mat-mdc-dialog-0 > div > div > edit-title-dialog > mat-dialog-content > div > mat-form-field > div.mat-mdc-text-field-wrapper...
    let nameInput = await waitForElement('edit-title-dialog input', 5000, 100);
    
    if (!nameInput) {
      // Try alternative selectors
      nameInput = document.querySelector('#mat-mdc-dialog-0 input, mat-dialog-content input, edit-title-dialog input');
    }
    
    if (!nameInput) {
      // Try finding in mat-form-field
      const formField = document.querySelector('mat-form-field');
      if (formField) {
        nameInput = formField.querySelector('input');
      }
    }
    
    if (!nameInput) {
      throw new Error('Could not find conversation name input field');
    }
    
    console.log('Found name input, setting conversation name...');
    
    // Clear existing content and set new name
    nameInput.focus();
    nameInput.select();
    
    // Set the conversation name
    try {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(nameInput, conversationName);
    } catch (e) {
      nameInput.value = conversationName;
    }
    
    // Trigger input events
    nameInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    nameInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    
    // Set value again to ensure it sticks
    nameInput.value = conversationName;
    nameInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    
    // Wait a moment for the form to update
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Step 5: Find and click the "Rename" button in the dialog
    let confirmRenameButton = null;
    
    // Search for button with "Rename" text in the dialog
    const dialogButtons = document.querySelectorAll('edit-title-dialog button, mat-dialog-actions button, #mat-mdc-dialog-0 button');
    for (let btn of dialogButtons) {
      const text = btn.textContent.trim();
      if (text.toLowerCase() === 'rename' || (text.toLowerCase().includes('rename') && !text.toLowerCase().includes('cancel'))) {
        confirmRenameButton = btn;
        break;
      }
    }
    
    if (!confirmRenameButton) {
      // Try finding submit button or primary button
      confirmRenameButton = document.querySelector('edit-title-dialog button[type="submit"], mat-dialog-actions button[type="submit"]');
    }
    
    if (!confirmRenameButton) {
      // Last resort: find the last button in dialog (usually the action button)
      const buttons = document.querySelectorAll('edit-title-dialog button');
      if (buttons.length > 0) {
        confirmRenameButton = buttons[buttons.length - 1];
      }
    }
    
    if (!confirmRenameButton) {
      throw new Error('Could not find confirm Rename button');
    }
    
    console.log('Clicking confirm Rename button...');
    confirmRenameButton.click();
    
    // Wait for the dialog to close
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('Conversation renamed successfully');
    return { success: true, message: `Successfully renamed conversation to "${conversationName}"` };
    
  } catch (error) {
    console.error('Rename conversation error:', error);
    // Don't fail the whole operation if renaming fails
    return { success: false, error: error.message };
  }
}

/**
 * Select the Gemini model (2.5 Flash)
 * @param {Function} waitForElement - Function to wait for elements
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function selectGeminiModel(waitForElement) {
  try {
    console.log('Selecting Gemini model (2.5 Flash)...');
    
    // Step 1: Find and click the model selector button
    // Based on the recording: div.trailing-actions-wrapper span.mdc-button__label span
    // or button with data-test-id="bard-mode-menu-button"
    let modelSelectorButton = null;
    
    // Try multiple selectors from the recording
    const selectors = [
      'button[data-test-id="bard-mode-menu-button"]',
      'div.trailing-actions-wrapper span.mdc-button__label span',
      'div.trailing-actions-wrapper button span.mdc-button__label span'
    ];
    
    for (const selector of selectors) {
      modelSelectorButton = await waitForElement(selector, 5000, 200);
      if (modelSelectorButton) {
        // If we found a span, get the button parent
        if (modelSelectorButton.tagName === 'SPAN') {
          modelSelectorButton = modelSelectorButton.closest('button') || modelSelectorButton.parentElement?.closest('button');
        }
        if (modelSelectorButton) break;
      }
    }
    
    // Also try finding by text content "2.5 Flash" or similar
    if (!modelSelectorButton) {
      const buttons = document.querySelectorAll('div.trailing-actions-wrapper button, button[data-test-id*="mode"]');
      for (let btn of buttons) {
        const text = btn.textContent.trim();
        if (text.includes('Flash') || text.includes('2.5')) {
          modelSelectorButton = btn;
          break;
        }
      }
    }
    
    if (!modelSelectorButton) {
      throw new Error('Could not find Gemini model selector button');
    }
    
    console.log('Found model selector button, clicking...');
    modelSelectorButton.click();
    
    // Wait for the menu to appear
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 2: Find and click the "2.5 Flash" option
    // Based on the recording: [data-test-id='bard-mode-option-2\\.5flash'] span.mode-desc
    let modelOption = null;
    
    const optionSelectors = [
      '[data-test-id="bard-mode-option-2.5flash"]',
      '[data-test-id="bard-mode-option-2\\.5flash"]',
      'span.mode-desc'
    ];
    
    for (const selector of optionSelectors) {
      modelOption = await waitForElement(selector, 5000, 200);
      if (modelOption) {
        // If we found a span, check if it's within the correct option
        if (modelOption.tagName === 'SPAN') {
          const optionContainer = modelOption.closest('[data-test-id*="2.5flash"]');
          if (optionContainer) {
            modelOption = optionContainer;
          } else {
            // Check if the span contains "2.5 Flash" text
            if (modelOption.textContent.includes('2.5') || modelOption.textContent.includes('Flash')) {
              modelOption = modelOption.closest('button, [role="menuitem"], div[data-test-id*="option"]') || modelOption;
            } else {
              modelOption = null;
            }
          }
        }
        if (modelOption) break;
      }
    }
    
    // Also try finding by text content
    if (!modelOption) {
      const menuItems = document.querySelectorAll('[data-test-id*="option"], button[role="menuitem"], div[role="menuitem"]');
      for (let item of menuItems) {
        const text = item.textContent.trim();
        if (text.includes('2.5 Flash') || (text.includes('2.5') && text.includes('Flash'))) {
          modelOption = item;
          break;
        }
      }
    }
    
    if (!modelOption) {
      throw new Error('Could not find "2.5 Flash" model option');
    }
    
    console.log('Found 2.5 Flash option, clicking...');
    modelOption.click();
    
    // Wait for the menu to close and model to be selected
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('Successfully selected Gemini model (2.5 Flash)');
    return { success: true };
    
  } catch (error) {
    console.error('Error selecting Gemini model:', error);
    // Don't fail the whole operation if model selection fails
    // The user might already have the correct model selected
    console.warn('Model selection failed, continuing anyway:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Handle sending content to Gemini chat (for use in content scripts)
 * @param {string} content - Content to send
 * @param {string} bookName - Optional book name for renaming conversation
 * @param {string} chapterName - Optional chapter name for renaming conversation
 * @returns {Promise<{success: boolean, error?: string, message?: string}>}
 */
export async function handleSendToGeminiChat(content, bookName = null, chapterName = null) {
  try {
    console.log('Starting Gemini chat automation...');
    
    // Import waitForElement from utils if available, or use a simple version
    let waitForElement;
    try {
      const utilsModule = await import(chrome.runtime.getURL('notebooklm_utils.js'));
      waitForElement = utilsModule.waitForElement;
    } catch (e) {
      // Fallback waitForElement implementation
      waitForElement = async (selector, timeout = 5000, pollInterval = 250) => {
        return new Promise((resolve) => {
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
            
            if (Date.now() - startTime >= timeout) {
              resolved = true;
              clearInterval(pollIntervalId);
              resolve(null);
            }
          }, pollInterval);
        });
      };
    }
    
    // Wait for the page to fully load - wait for key elements to appear
    console.log('Waiting for Gemini chat to load...');
    
    // Wait for the input container to be visible and ready
    const inputContainer = await waitForElement('input-container', 10000, 200);
    if (!inputContainer) {
      throw new Error('Could not find Gemini chat input container');
    }
    
    // Wait a bit more for the input area to be fully interactive
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 0: Select the Gemini model (2.5 Flash) before sending content
    await selectGeminiModel(waitForElement);
    
    // Step 1: Find and click the input area
    // Based on the recording: aria/Enter a prompt here or input-container > div p
    let inputArea = await waitForElement('input-container > div p', 5000, 100);
    
    if (!inputArea) {
      // Try alternative selectors
      inputArea = await waitForElement('[aria-label="Enter a prompt here"]', 3000);
    }
    
    if (!inputArea) {
      // Try finding by role
      inputArea = await waitForElement('[role="paragraph"]');
    }
    
    if (!inputArea) {
      // Try finding the rich-textarea container
      inputArea = await waitForElement('rich-textarea div p, rich-textarea p');
    }
    
    if (!inputArea) {
      throw new Error('Could not find Gemini chat input area');
    }
    
    console.log('Found input area, clicking...');
    
    // Wait for the element to be visible and clickable
    await new Promise(resolve => setTimeout(resolve, 500));
    
    inputArea.click();
    
    // Wait a moment for the input to be focused
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 2: Find the rich-textarea element to set the content
    // Use the specific selector provided: rich-textarea within the input-container path
    let contentInput = await waitForElement('rich-textarea', 5000, 100);
    
    // If not found with simple selector, try the full path
    if (!contentInput) {
      contentInput = document.querySelector('input-container rich-textarea');
    }
    
    // Try alternative: find within the input-area-v2
    if (!contentInput) {
      const inputArea = document.querySelector('input-area-v2');
      if (inputArea) {
        contentInput = inputArea.querySelector('rich-textarea');
      }
    }
    
    // Fallback: try finding div.ql-clipboard (from recording)
    if (!contentInput) {
      contentInput = document.querySelector('div.ql-clipboard');
    }
    
    // Last fallback: find any rich-textarea
    if (!contentInput) {
      contentInput = document.querySelector('rich-textarea');
    }
    
    if (!contentInput) {
      throw new Error('Could not find Gemini chat content input (rich-textarea)');
    }
    
    console.log('Found rich-textarea, setting content...');
    
    // Focus the element first
    contentInput.focus();
    
    // Wait a moment after focusing
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // For rich-textarea, we need to find the actual contenteditable div inside it
    let editableDiv = contentInput.querySelector('div[contenteditable="true"]');
    
    if (!editableDiv) {
      // Try finding any div inside rich-textarea
      editableDiv = contentInput.querySelector('div');
    }
    
    if (!editableDiv) {
      // If no inner div, use the rich-textarea itself
      editableDiv = contentInput;
    }
    
    // Clear any existing content first
    editableDiv.innerHTML = '';
    editableDiv.textContent = '';
    
    // Set the content using multiple approaches
    // Method 1: Set textContent (for plain text)
    editableDiv.textContent = content;
    
    // Method 2: Also set innerHTML with line breaks
    editableDiv.innerHTML = content.replace(/\n/g, '<br>');
    
    // Method 3: Try using native value setter if available
    try {
      if ('value' in editableDiv) {
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(editableDiv), 'value')?.set?.call(editableDiv, content);
      }
    } catch (e) {
      // Ignore if not available
    }
    
    // Trigger all necessary events for Angular/React to detect the change
    editableDiv.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    editableDiv.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    editableDiv.dispatchEvent(new Event('keyup', { bubbles: true, cancelable: true }));
    editableDiv.dispatchEvent(new Event('keydown', { bubbles: true, cancelable: true }));
    
    // Also trigger on the rich-textarea element itself
    contentInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    contentInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    
    // Wait a moment for the content to be set and recognized
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify content was set
    if (!editableDiv.textContent && !editableDiv.innerHTML) {
      console.warn('Content may not have been set, trying alternative method...');
      // Try one more time with direct assignment
      editableDiv.innerText = content;
      editableDiv.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Step 3: Find and click the Send button
    // Based on the recording: aria/Send message or div.trailing-actions-wrapper div.mat-mdc-tooltip-trigger mat-icon
    let sendButton = await waitForElement('div.trailing-actions-wrapper div.mat-mdc-tooltip-trigger mat-icon', 5000, 100);
    
    if (!sendButton) {
      // Try alternative selectors
      sendButton = await waitForElement('[aria-label="Send message"]', 3000);
    }
    
    if (!sendButton) {
      // Try finding by role
      sendButton = await waitForElement('[role="image"]');
    }
    
    if (!sendButton) {
      // Try finding button containing the send icon
      const buttons = document.querySelectorAll('div.trailing-actions-wrapper button');
      for (let btn of buttons) {
        const icon = btn.querySelector('mat-icon');
        if (icon) {
          sendButton = btn;
          break;
        }
      }
    }
    
    if (!sendButton) {
      throw new Error('Could not find Send button');
    }
    
    console.log('Clicking Send button...');
    
    // Click the button (might be the icon or its parent button)
    let buttonToClick = sendButton;
    if (sendButton.tagName === 'MAT-ICON') {
      buttonToClick = sendButton.closest('button') || sendButton.parentElement;
    }
    
    buttonToClick.click();
    
    // Wait for the message to be sent
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Successfully sent content to Gemini chat');
    
    // Step 4: Rename the conversation if bookName and chapterName are provided
    if (bookName && chapterName) {
      try {
        const conversationName = `📖 ${bookName} - ${chapterName}`;
        console.log('Renaming conversation after sending...');
        const renameResult = await renameGeminiConversation(conversationName);
        if (renameResult.success) {
          return { success: true, message: `Successfully sent content and renamed conversation to "${conversationName}"` };
        } else {
          // If rename fails, still report success for sending
          console.warn('Message sent successfully but rename failed:', renameResult.error);
          return { success: true, message: `Successfully sent content, but rename failed: ${renameResult.error}` };
        }
      } catch (error) {
        // If rename fails, still report success for sending
        console.warn('Message sent successfully but rename error:', error);
        return { success: true, message: `Successfully sent content, but rename error: ${error.message}` };
      }
    }
    
    return { success: true, message: 'Successfully sent content to Gemini chat' };
    
  } catch (error) {
    console.error('Gemini chat error:', error);
    return { success: false, error: error.message };
  }
}

