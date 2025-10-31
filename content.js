// Learning Workflow Extension - Content Script
console.log('Learning Workflow Extension content script loaded on:', window.location.href);

// Load notebooklm.js module dynamically
let notebooklmModule = null;
let moduleLoadPromise = null;

async function loadNotebooklmModule() {
  if (!moduleLoadPromise) {
    moduleLoadPromise = (async () => {
      try {
        const moduleUrl = chrome.runtime.getURL('notebooklm.js');
        notebooklmModule = await import(moduleUrl);
        return notebooklmModule;
      } catch (error) {
        console.error('Failed to load notebooklm module:', error);
        moduleLoadPromise = null; // Reset so we can retry
        throw error;
      }
    })();
  }
  return moduleLoadPromise;
}

// Preload the module when content script initializes
loadNotebooklmModule().catch(err => {
  console.warn('Failed to preload notebooklm module:', err);
});

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Content script received message:', request);
  
  // Return true immediately to keep message channel open for async operations
  let responseSent = false;
  
  const safeSendResponse = (result) => {
    if (!responseSent) {
      responseSent = true;
      try {
        sendResponse(result);
      } catch (error) {
        console.error('Error sending response:', error);
      }
    }
  };
  
  if (request.action === 'exportToNotebooklm') {
    loadNotebooklmModule()
      .then(module => {
        return module.handleNotebooklmExport(request.content, request.sourceName);
      })
      .then(result => {
        safeSendResponse(result);
      })
      .catch(error => {
        console.error('Error in exportToNotebooklm:', error);
        safeSendResponse({success: false, error: error.message});
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'createFlashcards') {
    loadNotebooklmModule()
      .then(module => {
        return module.handleCreateFlashcards();
      })
      .then(result => {
        safeSendResponse(result);
      })
      .catch(error => {
        console.error('Error in createFlashcards:', error);
        safeSendResponse({success: false, error: error.message});
      });
    return true; // Keep message channel open for async response
  }
  
  safeSendResponse({status: 'ready'});
  return false;
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
