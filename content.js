// Learning Workflow Extension - Content Script
console.log('Learning Workflow Extension content script loaded on:', window.location.href);

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Content script received message:', request);
  
  // TODO: Add learning workflow content script functionality
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
  // TODO: Add initialization code for learning workflow
}
