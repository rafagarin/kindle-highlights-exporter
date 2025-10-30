// Learning Workflow Extension - Background Script
chrome.runtime.onInstalled.addListener(function(details) {
  console.log('Learning Workflow Extension installed:', details);
  
  // Initialize extension storage
  chrome.storage.local.set({
    extensionData: {
      installDate: new Date().toISOString(),
      version: '1.0.0'
    }
  });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request);
  
  // TODO: Add learning workflow message handling
  sendResponse({status: 'ready'});
});
