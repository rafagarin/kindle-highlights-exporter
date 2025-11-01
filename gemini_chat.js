// Gemini Chat integration module

/**
 * Send content to Gemini chat
 * @param {string} gemUrl - URL of the Gemini gem/chat
 * @param {string} content - Content to send as the first message
 * @param {Function} statusCallback - Callback for status updates
 * @returns {Promise<boolean>} Success status
 */
export async function sendToGeminiChat(gemUrl, content, statusCallback) {
  if (!gemUrl) {
    statusCallback('Please provide a Gemini gem URL in the Config tab', 'error');
    return false;
  }
  
  if (!content) {
    // Try to get content from clipboard
    try {
      content = await navigator.clipboard.readText();
      if (!content) {
        statusCallback('No content to send. Please run Step 2 first.', 'error');
        return false;
      }
    } catch (error) {
      statusCallback('Could not read clipboard. Please run Step 2 first.', 'error');
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
        content: content
      }, function(response) {
        if (chrome.runtime.lastError) {
          statusCallback('Please refresh the Gemini page and try again', 'error');
          resolve(false);
        } else if (response && response.success) {
          statusCallback('Successfully sent content to Gemini chat!', 'success');
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
 * Handle sending content to Gemini chat (for use in content scripts)
 * @param {string} content - Content to send
 * @returns {Promise<{success: boolean, error?: string, message?: string}>}
 */
export async function handleSendToGeminiChat(content) {
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
    return { success: true, message: 'Successfully sent content to Gemini chat' };
    
  } catch (error) {
    console.error('Gemini chat error:', error);
    return { success: false, error: error.message };
  }
}

