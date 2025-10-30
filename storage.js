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
      'notionPageUrl',
      'notionAuthToken',
      'notebooklmUrl'
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

