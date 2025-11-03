// Chrome storage operations module

/**
 * Load all saved data from Chrome storage
 * @returns {Promise<Object>} Saved data object
 */
export function loadSavedData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      'kindleFileUrl',
      'selectedChapter',
      'selectedNotebook',
      'notebooksList',
      'notionPageUrl',
      'notionAuthToken',
      'notebooklmUrl',
      'geminiApiKey',
      'geminiChatUrl',
      'kindleFileContent',
      'kindleFileName',
      'actionProcessHighlights',
      'actionCopyToNotion',
      'actionAddToNotebooklm',
      'actionGenerateFlashcards',
      'actionCreateGeminiQuiz'
    ], function(result) {
      resolve(result);
    });
  });
}

/**
 * Save Kindle file URL
 * @param {string} url - Kindle highlights file URL
 */
export function saveKindleUrl(url) {
  chrome.storage.local.set({ kindleFileUrl: url });
}

/**
 * Save selected chapter
 * @param {string} chapter - Chapter name
 */
export function saveSelectedChapter(chapter) {
  if (chapter) {
    chrome.storage.local.set({ selectedChapter: chapter });
  } else {
    chrome.storage.local.remove('selectedChapter');
  }
}

/**
 * Save Notion configuration
 * @param {string} pageUrl - Notion page/database URL
 * @param {string} authToken - Notion API auth token
 */
export function saveNotionConfig(pageUrl, authToken) {
  chrome.storage.local.set({ 
    notionPageUrl: pageUrl,
    notionAuthToken: authToken
  });
}

/**
 * Save NotebookLM URL
 * @param {string} url - NotebookLM notebook URL
 */
export function saveNotebooklmUrl(url) {
  chrome.storage.local.set({ notebooklmUrl: url });
}

/**
 * Save Gemini API key
 * @param {string} apiKey - Gemini API key
 */
export function saveGeminiApiKey(apiKey) {
  chrome.storage.local.set({ geminiApiKey: apiKey });
}

/**
 * Save Gemini Chat/Gem URL
 * @param {string} url - Gemini chat/gem URL
 */
export function saveGeminiChatUrl(url) {
  chrome.storage.local.set({ geminiChatUrl: url });
}

/**
 * Save Kindle file content and filename
 * @param {string} fileName - File name
 * @param {string} fileContent - File content
 */
export function saveKindleFile(fileName, fileContent) {
  // Try to save, but handle quota errors gracefully
  chrome.storage.local.set({ 
    kindleFileName: fileName,
    kindleFileContent: fileContent
  }, function() {
    if (chrome.runtime.lastError) {
      console.warn('Could not save file content to storage:', chrome.runtime.lastError);
      // Still save the filename at least
      chrome.storage.local.set({ kindleFileName: fileName });
    }
  });
}

/**
 * Save action checkbox state
 * @param {string} actionName - Action name (e.g., 'actionProcessHighlights')
 * @param {boolean} checked - Checked state
 */
export function saveActionState(actionName, checked) {
  chrome.storage.local.set({ [actionName]: checked });
}

/**
 * Load all action checkbox states
 * @returns {Promise<Object>} Object with action states
 */
export function loadActionStates() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      'actionProcessHighlights',
      'actionCopyToNotion',
      'actionAddToNotebooklm',
      'actionGenerateFlashcards'
    ], function(result) {
      resolve(result);
    });
  });
}

/**
 * Save list of NotebookLM notebooks
 * @param {string[]} notebooks - Array of notebook names
 */
export function saveNotebooksList(notebooks) {
  chrome.storage.local.set({ notebooksList: notebooks });
}

/**
 * Load list of NotebookLM notebooks
 * @returns {Promise<string[]>} Array of notebook names
 */
export function loadNotebooksList() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['notebooksList'], function(result) {
      resolve(result.notebooksList || []);
    });
  });
}

/**
 * Save selected notebook name
 * @param {string} notebook - Notebook name
 */
export function saveSelectedNotebook(notebook) {
  if (notebook) {
    chrome.storage.local.set({ selectedNotebook: notebook });
  } else {
    chrome.storage.local.remove('selectedNotebook');
  }
}

