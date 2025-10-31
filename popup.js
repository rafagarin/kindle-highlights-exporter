// Learning Workflow Extension - Main Popup Script
import { extractChapters, extractBookTitle, parseKindleHighlights, fetchKindleHtml } from './kindle.js';
import { extractNotionDatabaseId, getDatabaseDataSourceAndTitleProperty, convertMarkdownToNotionBlocks, createPageInDatabase } from './notion.js';
import { exportToNotebooklm, createFlashcards } from './notebooklm.js';
import { processHighlightsWithGemini } from './gemini.js';
import { showStatus } from './utils.js';
import { loadSavedData, saveKindleUrl, saveSelectedChapter, saveNotionConfig, saveNotebooklmUrl, saveGeminiApiKey } from './storage.js';

document.addEventListener('DOMContentLoaded', function() {
  // DOM element references
  const kindleFileUrlForChaptersInput = document.getElementById('kindleFileUrlForChapters');
  const loadChaptersBtn = document.getElementById('loadChaptersBtn');
  const chapterSelect = document.getElementById('chapterSelect');
  const chapterSelectionGroup = document.getElementById('chapterSelectionGroup');
  const step0Status = document.getElementById('step0Status');
  const kindleFileUrlInput = document.getElementById('kindleFileUrl');
  const processKindleBtn = document.getElementById('processKindleBtn');
  const step1Status = document.getElementById('step1Status');
  const notionPageUrlInput = document.getElementById('notionPageUrl');
  const copyToNotionBtn = document.getElementById('copyToNotionBtn');
  const step2Status = document.getElementById('step2Status');
  const notebooklmUrlInput = document.getElementById('notebooklmUrl');
  const exportToNotebooklmBtn = document.getElementById('exportToNotebooklmBtn');
  const step3Status = document.getElementById('step3Status');
  const createFlashcardsBtn = document.getElementById('createFlashcardsBtn');
  const step4Status = document.getElementById('step4Status');
  
  // Config tab elements
  const configGeminiApiKeyInput = document.getElementById('configGeminiApiKey');
  const configNotionAuthTokenInput = document.getElementById('configNotionAuthToken');
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  const configStatus = document.getElementById('configStatus');
  
  // Tab elements
  const tabButtons = document.querySelectorAll('.tab-btn');
  const stepsTab = document.getElementById('stepsTab');
  const configTab = document.getElementById('configTab');
  
  // Store the full HTML content and chapters list
  let cachedHtmlContent = null;
  let chaptersList = [];
  
  // Initialize popup
  initializePopup();
  
  function initializePopup() {
    // Set up tab switching
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });
    
    // Set up event listeners
    loadChaptersBtn.addEventListener('click', handleLoadChapters);
    chapterSelect.addEventListener('change', handleChapterSelection);
    processKindleBtn.addEventListener('click', handleProcessKindleHighlights);
    copyToNotionBtn.addEventListener('click', handleCopyToNotion);
    exportToNotebooklmBtn.addEventListener('click', handleExportToNotebooklm);
    createFlashcardsBtn.addEventListener('click', handleCreateFlashcards);
    saveConfigBtn.addEventListener('click', handleSaveConfig);
    
    // Load saved data
    loadSavedData().then(result => {
      if (result.kindleFileUrl) {
        kindleFileUrlForChaptersInput.value = result.kindleFileUrl;
        kindleFileUrlInput.value = result.kindleFileUrl;
      }
      if (result.selectedChapter) {
        chapterSelect.value = result.selectedChapter;
        if (chapterSelect.value) {
          chapterSelectionGroup.style.display = 'flex';
        }
      }
      if (result.notionPageUrl) {
        notionPageUrlInput.value = result.notionPageUrl;
      }
      if (result.notebooklmUrl) {
        notebooklmUrlInput.value = result.notebooklmUrl;
      }
      if (result.geminiApiKey) {
        configGeminiApiKeyInput.value = result.geminiApiKey;
      }
      if (result.notionAuthToken) {
        configNotionAuthTokenInput.value = result.notionAuthToken;
      }
    });
  }
  
  function switchTab(tabName) {
    // Update tab buttons
    tabButtons.forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // Update tab content
    if (tabName === 'steps') {
      stepsTab.classList.add('active');
      configTab.classList.remove('active');
    } else if (tabName === 'config') {
      configTab.classList.add('active');
      stepsTab.classList.remove('active');
    }
  }
  
  async function handleSaveConfig() {
    const geminiApiKey = configGeminiApiKeyInput.value.trim();
    const notionAuthToken = configNotionAuthTokenInput.value.trim();
    
    saveConfigBtn.disabled = true;
    showStatus(configStatus, 'Saving configuration...', 'info');
    
    try {
      if (geminiApiKey) {
        saveGeminiApiKey(geminiApiKey);
      } else {
        chrome.storage.local.remove('geminiApiKey');
      }
      
      if (notionAuthToken) {
        const currentNotionUrl = notionPageUrlInput.value.trim();
        if (currentNotionUrl) {
          saveNotionConfig(currentNotionUrl, notionAuthToken);
        } else {
          chrome.storage.local.set({ notionAuthToken: notionAuthToken });
        }
      } else {
        chrome.storage.local.remove('notionAuthToken');
      }
      
      showStatus(configStatus, 'Configuration saved successfully!', 'success');
      
      // Clear status after 2 seconds
      setTimeout(() => {
        showStatus(configStatus, '', '');
      }, 2000);
      
    } catch (error) {
      console.error('Error saving config:', error);
      showStatus(configStatus, `Error: ${error.message}`, 'error');
    } finally {
      saveConfigBtn.disabled = false;
    }
  }
  
  async function handleLoadChapters() {
    const url = kindleFileUrlForChaptersInput.value.trim();
    
    if (!url) {
      showStatus(step0Status, 'Please enter a Kindle highlights file URL', 'error');
      return;
    }
    
    // Sync the URL to Step 1 input
    kindleFileUrlInput.value = url;
    saveKindleUrl(url);
    
    loadChaptersBtn.disabled = true;
    showStatus(step0Status, 'Loading chapters...', 'info');
    
    try {
      // Fetch the HTML file
      const htmlContent = await fetchKindleHtml(url);
      cachedHtmlContent = htmlContent;
      
      // Extract chapters from the HTML
      chaptersList = extractChapters(htmlContent);
      
      if (chaptersList.length === 0) {
        showStatus(step0Status, 'No chapters found in the file', 'error');
        chapterSelectionGroup.style.display = 'none';
        return;
      }
      
      // Populate the dropdown
      chapterSelect.innerHTML = '<option value="">-- Select a chapter --</option>';
      chaptersList.forEach((chapter) => {
        const option = document.createElement('option');
        option.value = chapter;
        option.textContent = chapter;
        chapterSelect.appendChild(option);
      });
      
      // Show the chapter selection dropdown
      chapterSelectionGroup.style.display = 'flex';
      
      showStatus(step0Status, `Found ${chaptersList.length} chapter(s)`, 'success');
      
    } catch (error) {
      console.error('Error loading chapters:', error);
      showStatus(step0Status, `Error: ${error.message}`, 'error');
      chapterSelectionGroup.style.display = 'none';
    } finally {
      loadChaptersBtn.disabled = false;
    }
  }
  
  function handleChapterSelection() {
    const selectedChapter = chapterSelect.value;
    saveSelectedChapter(selectedChapter);
    
    if (selectedChapter) {
      showStatus(step0Status, `Chapter "${selectedChapter}" selected`, 'success');
    } else {
      showStatus(step0Status, '', '');
    }
  }
  
  async function handleProcessKindleHighlights() {
    const url = kindleFileUrlInput.value.trim();
    
    if (!url) {
      showStatus(step1Status, 'Please enter a Kindle highlights file URL', 'error');
      return;
    }
    
    // Check if a chapter is selected
    const selectedChapter = chapterSelect.value;
    if (!selectedChapter) {
      showStatus(step1Status, 'Please select a chapter first in Step 0', 'error');
      return;
    }
    
    saveKindleUrl(url);
    
    processKindleBtn.disabled = true;
    showStatus(step1Status, 'Processing highlights...', 'info');
    
    try {
      // Use cached HTML content if available, otherwise fetch it
      let htmlContent = cachedHtmlContent;
      if (!htmlContent) {
        htmlContent = await fetchKindleHtml(url);
        cachedHtmlContent = htmlContent;
      }
      
      // Parse the HTML and extract highlights for the selected chapter
      let processedContent = parseKindleHighlights(htmlContent, selectedChapter);
      
      if (!processedContent || processedContent.trim() === '') {
        showStatus(step1Status, 'No highlights found for the selected chapter', 'error');
        return;
      }
      
      // Process with Gemini API if API key is provided
      const geminiApiKey = configGeminiApiKeyInput.value.trim();
      if (geminiApiKey) {
        saveGeminiApiKey(geminiApiKey);
        showStatus(step1Status, 'Processing highlights with Gemini AI...', 'info');
        
        try {
          processedContent = await processHighlightsWithGemini(processedContent, geminiApiKey);
          showStatus(step1Status, 'Highlights processed with Gemini AI!', 'success');
        } catch (error) {
          console.error('Error processing with Gemini:', error);
          showStatus(step1Status, `Gemini API error: ${error.message}. Using original highlights.`, 'error');
          // Continue with original content if Gemini fails
        }
      }
      
      // Copy to clipboard
      await navigator.clipboard.writeText(processedContent);
      
      if (geminiApiKey) {
        showStatus(step1Status, 'Highlights processed with AI and copied to clipboard!', 'success');
      } else {
        showStatus(step1Status, 'Highlights processed and copied to clipboard!', 'success');
      }
      
    } catch (error) {
      console.error('Error processing Kindle highlights:', error);
      showStatus(step1Status, `Error: ${error.message}`, 'error');
    } finally {
      processKindleBtn.disabled = false;
    }
  }
  
  async function handleCopyToNotion() {
    const databaseUrl = notionPageUrlInput.value.trim();
    const authToken = configNotionAuthTokenInput.value.trim();
    
    if (!databaseUrl) {
      showStatus(step2Status, 'Please enter a Notion database/data source URL', 'error');
      return;
    }
    
    if (!authToken) {
      showStatus(step2Status, 'Please enter a Notion integration token', 'error');
      return;
    }
    
    // Check if a chapter is selected
    const selectedChapter = chapterSelect.value;
    if (!selectedChapter) {
      showStatus(step2Status, 'Please select a chapter first in Step 0', 'error');
      return;
    }
    
    saveNotionConfig(databaseUrl, authToken);
    
    copyToNotionBtn.disabled = true;
    showStatus(step2Status, 'Creating page in Notion...', 'info');
    
    try {
      // Get content from clipboard
      const clipboardContent = await navigator.clipboard.readText();
      
      if (!clipboardContent) {
        showStatus(step2Status, 'No content in clipboard. Please run Step 1 first.', 'error');
        return;
      }
      
      // Extract database ID from Notion URL
      const databaseId = extractNotionDatabaseId(databaseUrl);
      if (!databaseId) {
        showStatus(step2Status, 'Invalid Notion database URL format', 'error');
        return;
      }
      
      // Get book title from cached HTML
      const bookTitle = extractBookTitle(cachedHtmlContent);
      if (!bookTitle) {
        showStatus(step2Status, 'Could not extract book title. Please reload chapters in Step 0.', 'error');
        return;
      }
      
      // Create page title: "Book Name - Chapter Name"
      const pageTitle = `${bookTitle} - ${selectedChapter}`;
      
      // Fetch database to get data source and find the title property name
      showStatus(step2Status, 'Fetching database schema...', 'info');
      const { dataSourceId, titlePropertyName } = await getDatabaseDataSourceAndTitleProperty(databaseId, authToken);
      
      // Convert Markdown to Notion blocks
      const blocks = convertMarkdownToNotionBlocks(clipboardContent);
      
      // Create the page with title and content
      const progressCallback = (message) => showStatus(step2Status, message, 'info');
      await createPageInDatabase(
        databaseId,
        dataSourceId,
        titlePropertyName,
        pageTitle,
        blocks,
        authToken,
        progressCallback
      );
      
      showStatus(step2Status, `Successfully created page "${pageTitle}" with ${blocks.length} blocks in Notion!`, 'success');
      
    } catch (error) {
      console.error('Error copying to Notion:', error);
      showStatus(step2Status, `Error: ${error.message}`, 'error');
    } finally {
      copyToNotionBtn.disabled = false;
    }
  }
  
  async function handleExportToNotebooklm() {
    const url = notebooklmUrlInput.value.trim();
    saveNotebooklmUrl(url);
    
    exportToNotebooklmBtn.disabled = true;
    
    try {
      const success = await exportToNotebooklm(url, null, (message, type) => {
        showStatus(step3Status, message, type);
      });
    } finally {
      exportToNotebooklmBtn.disabled = false;
    }
  }
  
  async function handleCreateFlashcards() {
    createFlashcardsBtn.disabled = true;
    
    try {
      await createFlashcards((message, type) => {
        showStatus(step4Status, message, type);
      });
    } finally {
      createFlashcardsBtn.disabled = false;
    }
  }
});
