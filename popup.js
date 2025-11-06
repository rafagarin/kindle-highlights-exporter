// Learning Workflow Extension - Main Popup Script
import { extractChapters, extractBookTitle, parseKindleHighlights, fetchKindleHtml } from './kindle.js';
import { extractNotionDatabaseId, getDatabaseDataSourceAndTitleProperty, convertMarkdownToNotionBlocks, createPageInDatabase } from './notion.js';
import { exportToNotebooklm, createFlashcards } from './notebooklm.js';
import { processHighlightsWithGemini } from './gemini.js';
import { sendToGeminiChat } from './gemini_chat.js';
import { showStatus } from './utils.js';
import { loadSavedData, saveKindleUrl, saveSelectedChapter, saveNotionConfig, saveNotebooklmUrl, saveGeminiApiKey, saveGeminiChatUrl, saveKindleFile, saveActionState, loadActionStates, saveNotebooksList, loadNotebooksList, saveSelectedNotebook, saveProcessedContent, loadProcessedContent } from './storage.js';

document.addEventListener('DOMContentLoaded', function() {
  // DOM element references
  const chapterSelect = document.getElementById('chapterSelect');
  const chapterSelectionGroup = document.getElementById('chapterSelectionGroup');
  const step0Status = document.getElementById('step0Status');
  const kindleFileInput = document.getElementById('kindleFileInput');
  const selectedFileName = document.getElementById('selectedFileName');
  const step1Status = document.getElementById('step1Status');
  const step2Status = document.getElementById('step2Status');
  const performActionsBtn = document.getElementById('performActionsBtn');
  
  // Notebook selection elements
  const notebookSelect = document.getElementById('notebookSelect');
  const customNotebookGroup = document.getElementById('customNotebookGroup');
  const customNotebookInput = document.getElementById('customNotebookInput');
  const refetchNotebooksBtn = document.getElementById('refetchNotebooksBtn');
  const step2NotebookStatus = document.getElementById('step2NotebookStatus');
  
  // Action checkboxes
  const actionProcessHighlights = document.getElementById('actionProcessHighlights');
  const actionCopyToNotion = document.getElementById('actionCopyToNotion');
  const actionAddToNotebooklm = document.getElementById('actionAddToNotebooklm');
  const actionGenerateFlashcards = document.getElementById('actionGenerateFlashcards');
  const actionCreateGeminiQuiz = document.getElementById('actionCreateGeminiQuiz');
  
  // Config tab elements
  const configGeminiApiKeyInput = document.getElementById('configGeminiApiKey');
  const configNotionAuthTokenInput = document.getElementById('configNotionAuthToken');
  const configNotionDatabaseUrlInput = document.getElementById('configNotionDatabaseUrl');
  const configGeminiChatUrlInput = document.getElementById('configGeminiChatUrl');
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  const configStatus = document.getElementById('configStatus');
  
  // Tab elements
  const tabButtons = document.querySelectorAll('.tab-btn');
  const stepsTab = document.getElementById('stepsTab');
  const configTab = document.getElementById('configTab');
  
  // Store the full HTML content and chapters list
  let cachedHtmlContent = null;
  let chaptersList = [];
  let selectedNotebookName = null;
  
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
    chapterSelect.addEventListener('change', handleChapterSelection);
    kindleFileInput.addEventListener('change', handleFileSelection);
    performActionsBtn.addEventListener('click', handlePerformActions);
    saveConfigBtn.addEventListener('click', handleSaveConfig);
    notebookSelect.addEventListener('change', handleNotebookSelection);
    refetchNotebooksBtn.addEventListener('click', handleRefetchNotebooks);
    customNotebookInput.addEventListener('input', handleCustomNotebookInput);
    
    // Set up checkbox listeners to save state
    actionProcessHighlights.addEventListener('change', () => {
      saveActionState('actionProcessHighlights', actionProcessHighlights.checked);
    });
    actionCopyToNotion.addEventListener('change', () => {
      saveActionState('actionCopyToNotion', actionCopyToNotion.checked);
    });
    actionAddToNotebooklm.addEventListener('change', () => {
      saveActionState('actionAddToNotebooklm', actionAddToNotebooklm.checked);
    });
    actionGenerateFlashcards.addEventListener('change', () => {
      saveActionState('actionGenerateFlashcards', actionGenerateFlashcards.checked);
    });
    actionCreateGeminiQuiz.addEventListener('change', () => {
      saveActionState('actionCreateGeminiQuiz', actionCreateGeminiQuiz.checked);
    });
    
    // Load saved data
    loadSavedData().then(result => {
      if (result.kindleFileName && result.kindleFileContent) {
        selectedFileName.innerHTML = `✓ Loaded: <strong>${result.kindleFileName}</strong> <span class="file-status-note">(from previous session)</span>`;
        selectedFileName.style.display = 'block';
        selectedFileName.classList.add('file-loaded');
      } else if (result.kindleFileName) {
        selectedFileName.innerHTML = `Selected: <strong>${result.kindleFileName}</strong>`;
        selectedFileName.style.display = 'block';
      }
      if (result.kindleFileContent) {
        cachedHtmlContent = result.kindleFileContent;
        // Extract chapters from cached content
        if (cachedHtmlContent) {
          const chapters = extractChapters(cachedHtmlContent);
          if (chapters.length > 0) {
            chaptersList = chapters;
            chapterSelect.innerHTML = '<option value="">-- Select a chapter --</option>';
            chapters.forEach((chapter) => {
              const option = document.createElement('option');
              option.value = chapter;
              option.textContent = chapter;
              chapterSelect.appendChild(option);
            });
            
            // Restore saved chapter selection if it exists in the chapters
            if (result.selectedChapter && chapters.includes(result.selectedChapter)) {
              chapterSelect.value = result.selectedChapter;
              chapterSelectionGroup.style.display = 'flex';
            } else if (result.selectedChapter) {
              // Saved chapter doesn't exist in this file, clear it
              saveSelectedChapter('');
            }
          }
        }
      }
      if (result.notionPageUrl) {
        configNotionDatabaseUrlInput.value = result.notionPageUrl;
      }
      if (result.geminiApiKey) {
        configGeminiApiKeyInput.value = result.geminiApiKey;
      }
      if (result.geminiChatUrl) {
        configGeminiChatUrlInput.value = result.geminiChatUrl;
      }
      if (result.notionAuthToken) {
        configNotionAuthTokenInput.value = result.notionAuthToken;
      }
      
      // Load saved checkbox states
      if (result.actionProcessHighlights !== undefined) {
        actionProcessHighlights.checked = result.actionProcessHighlights;
      }
      if (result.actionCopyToNotion !== undefined) {
        actionCopyToNotion.checked = result.actionCopyToNotion;
      }
      if (result.actionAddToNotebooklm !== undefined) {
        actionAddToNotebooklm.checked = result.actionAddToNotebooklm;
      }
      if (result.actionGenerateFlashcards !== undefined) {
        actionGenerateFlashcards.checked = result.actionGenerateFlashcards;
      }
      if (result.actionCreateGeminiQuiz !== undefined) {
        actionCreateGeminiQuiz.checked = result.actionCreateGeminiQuiz;
      }
      
      // Load notebooks list and populate dropdown
      loadNotebooksList().then(notebooks => {
        populateNotebooksDropdown(notebooks);
        
        // Restore saved notebook selection if it exists
        if (result.selectedNotebook) {
          if (notebooks.includes(result.selectedNotebook)) {
            notebookSelect.value = result.selectedNotebook;
            selectedNotebookName = result.selectedNotebook;
          } else if (result.selectedNotebook) {
            // Notebook not in list, show custom input
            notebookSelect.value = '__CUSTOM__';
            customNotebookGroup.style.display = 'flex';
            customNotebookInput.value = result.selectedNotebook;
            selectedNotebookName = result.selectedNotebook;
          }
        }
      });
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
    const geminiChatUrl = configGeminiChatUrlInput.value.trim();
    const notionAuthToken = configNotionAuthTokenInput.value.trim();
    const notionDatabaseUrl = configNotionDatabaseUrlInput.value.trim();
    
    saveConfigBtn.disabled = true;
    showStatus(configStatus, 'Saving configuration...', 'info');
    
    try {
      if (geminiApiKey) {
        saveGeminiApiKey(geminiApiKey);
      } else {
        chrome.storage.local.remove('geminiApiKey');
      }
      
      if (geminiChatUrl) {
        saveGeminiChatUrl(geminiChatUrl);
      } else {
        chrome.storage.local.remove('geminiChatUrl');
      }
      
      if (notionAuthToken && notionDatabaseUrl) {
        saveNotionConfig(notionDatabaseUrl, notionAuthToken);
      } else {
        if (notionAuthToken) {
          chrome.storage.local.set({ notionAuthToken: notionAuthToken });
        } else {
          chrome.storage.local.remove('notionAuthToken');
        }
        if (notionDatabaseUrl) {
          chrome.storage.local.set({ notionPageUrl: notionDatabaseUrl });
        } else {
          chrome.storage.local.remove('notionPageUrl');
        }
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
  
  function handleChapterSelection() {
    const selectedChapter = chapterSelect.value;
    saveSelectedChapter(selectedChapter);
    
    if (selectedChapter) {
      showStatus(step1Status, `Chapter "${selectedChapter}" selected`, 'success');
    } else {
      showStatus(step1Status, '', '');
    }
  }
  
  async function handleFileSelection(event) {
    const file = event.target.files[0];
    if (!file) {
      selectedFileName.textContent = '';
      selectedFileName.style.display = 'none';
      cachedHtmlContent = null;
      chaptersList = [];
      chapterSelect.innerHTML = '<option value="">-- Select a chapter --</option>';
      chapterSelectionGroup.style.display = 'none';
      return;
    }
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
      showStatus(step0Status, 'Please select an HTML file', 'error');
      kindleFileInput.value = '';
      return;
    }
    
    selectedFileName.innerHTML = `✓ Selected: <strong>${file.name}</strong>`;
    selectedFileName.style.display = 'block';
    selectedFileName.classList.remove('file-loaded');
    
    // Read file content
    try {
      showStatus(step0Status, 'Loading file...', 'info');
      const fileContent = await readFileAsText(file);
      cachedHtmlContent = fileContent;
      
      // Save to storage
      saveKindleFile(file.name, fileContent);
      
      // Extract chapters and populate the dropdown in Step 2
      const chapters = extractChapters(fileContent);
      chaptersList = chapters;
      
      // Save currently selected chapter before repopulating
      const previouslySelectedChapter = chapterSelect.value;
      
      if (chapters.length > 0) {
        chapterSelect.innerHTML = '<option value="">-- Select a chapter --</option>';
        chapters.forEach((chapter) => {
          const option = document.createElement('option');
          option.value = chapter;
          option.textContent = chapter;
          chapterSelect.appendChild(option);
        });
        
        // Restore previous selection if it exists in the new chapters
        if (previouslySelectedChapter && chapters.includes(previouslySelectedChapter)) {
          chapterSelect.value = previouslySelectedChapter;
          saveSelectedChapter(previouslySelectedChapter);
        } else {
          // Clear selection if previous chapter doesn't exist in new file
          chapterSelect.value = '';
          saveSelectedChapter('');
        }
        
        chapterSelectionGroup.style.display = 'flex';
        
        if (previouslySelectedChapter && chapters.includes(previouslySelectedChapter)) {
          showStatus(step0Status, `File loaded! Found ${chapters.length} chapter(s). Previous selection preserved.`, 'success');
        } else {
          showStatus(step0Status, `File loaded! Found ${chapters.length} chapter(s). Select a chapter in Step 2.`, 'success');
        }
      } else {
        chapterSelect.value = '';
        saveSelectedChapter('');
        showStatus(step0Status, 'File loaded, but no chapters found', 'error');
        chapterSelectionGroup.style.display = 'none';
      }
      
      // Clear status after 3 seconds
      setTimeout(() => {
        showStatus(step0Status, '', '');
      }, 3000);
      
    } catch (error) {
      console.error('Error reading file:', error);
      showStatus(step0Status, `Error reading file: ${error.message}`, 'error');
      kindleFileInput.value = '';
      selectedFileName.textContent = '';
      selectedFileName.style.display = 'none';
      chapterSelectionGroup.style.display = 'none';
    }
  }
  
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
  
  async function processKindleHighlights(showStatusCallback) {
    // Check if a file is selected or if we have cached content
    if (!cachedHtmlContent && kindleFileInput.files.length === 0) {
      showStatusCallback('Please select a Kindle highlights file first', 'error');
      throw new Error('No file selected');
    }
    
    // Check if a chapter is selected
    const selectedChapter = chapterSelect.value;
    if (!selectedChapter) {
      showStatusCallback('Please select a chapter first', 'error');
      throw new Error('No chapter selected');
    }
    
    showStatusCallback('Processing highlights...', 'info');
    
    // Get HTML content from cached content or read from file input
    let htmlContent = cachedHtmlContent;
    if (!htmlContent && kindleFileInput.files.length > 0) {
      const file = kindleFileInput.files[0];
      htmlContent = await readFileAsText(file);
      cachedHtmlContent = htmlContent;
      saveKindleFile(file.name, htmlContent);
    }
    
    if (!htmlContent) {
      showStatusCallback('No file content available', 'error');
      throw new Error('No file content available');
    }
    
    // Parse the HTML and extract highlights for the selected chapter
    let processedContent = parseKindleHighlights(htmlContent, selectedChapter);
    
    if (!processedContent || processedContent.trim() === '') {
      showStatusCallback('No highlights found for the selected chapter', 'error');
      throw new Error('No highlights found');
    }
    
    // Process with Gemini API if API key is provided
    const geminiApiKey = configGeminiApiKeyInput.value.trim();
    if (geminiApiKey) {
      saveGeminiApiKey(geminiApiKey);
      showStatusCallback('Processing highlights with Gemini AI...', 'info');
      
      try {
        // Progress callback to show which section is being processed
        const progressCallback = (sectionName, current, total) => {
          showStatusCallback(`Processing section "${sectionName}" (${current}/${total})...`, 'info');
        };
        
        processedContent = await processHighlightsWithGemini(processedContent, geminiApiKey, progressCallback);
        showStatusCallback('Highlights processed with Gemini AI!', 'success');
      } catch (error) {
        console.error('Error processing with Gemini:', error);
        showStatusCallback(`Gemini API error: ${error.message}. Using original highlights.`, 'error');
        // Continue with original content if Gemini fails
      }
    }
    
    // Save to storage
    saveProcessedContent(processedContent);
    
    if (geminiApiKey) {
      showStatusCallback('Highlights processed with AI!', 'success');
    } else {
      showStatusCallback('Highlights processed!', 'success');
    }
    
    return processedContent;
  }
  
  async function copyToNotion(showStatusCallback) {
    const databaseUrl = configNotionDatabaseUrlInput.value.trim();
    const authToken = configNotionAuthTokenInput.value.trim();
    
    if (!databaseUrl) {
      showStatusCallback('Please enter a Notion database URL in the Config tab', 'error');
      throw new Error('Notion database URL required');
    }
    
    if (!authToken) {
      showStatusCallback('Please enter a Notion integration token in the Config tab', 'error');
      throw new Error('Notion auth token required');
    }
    
    // Check if a chapter is selected
    const selectedChapter = chapterSelect.value;
    if (!selectedChapter) {
      showStatusCallback('Please select a chapter first in Step 2', 'error');
      throw new Error('No chapter selected');
    }
    
    saveNotionConfig(databaseUrl, authToken);
    
    showStatusCallback('Creating page in Notion...', 'info');
    
    // Get content from storage
    const content = await loadProcessedContent();
    
    if (!content) {
      showStatusCallback('No content found. Process highlights first.', 'error');
      throw new Error('No content found');
    }
    
    // Extract database ID from Notion URL
    const databaseId = extractNotionDatabaseId(databaseUrl);
    if (!databaseId) {
      showStatusCallback('Invalid Notion database URL format', 'error');
      throw new Error('Invalid Notion database URL');
    }
    
    // Get book title from cached HTML
    const bookTitle = extractBookTitle(cachedHtmlContent);
    if (!bookTitle) {
      showStatusCallback('Could not extract book title. Please reload file in Step 1.', 'error');
      throw new Error('Could not extract book title');
    }
    
    // Create page title: "Chapter Name"
    const pageTitle = selectedChapter;
    
    // Fetch database to get data source and find the title property name
    showStatusCallback('Fetching database schema...', 'info');
    const { dataSourceId, titlePropertyName, bookNamePropertyName, bookNamePropertyType } = await getDatabaseDataSourceAndTitleProperty(databaseId, authToken);
    
    // Convert Markdown to Notion blocks
    const blocks = convertMarkdownToNotionBlocks(content);
    
    // Create the page with title and content
    const progressCallback = (message) => showStatusCallback(message, 'info');
    const pageId = await createPageInDatabase(
      databaseId,
      dataSourceId,
      titlePropertyName,
      pageTitle,
      blocks,
      authToken,
      progressCallback,
      bookNamePropertyName,
      bookNamePropertyType,
      bookTitle
    );
    
    // Convert page ID (UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) to Notion URL format
    // Notion page URLs use the ID without dashes: https://www.notion.so/[32-char-id]
    const pageIdWithoutDashes = pageId.replace(/-/g, '');
    const pageUrl = `https://www.notion.so/${pageIdWithoutDashes}`;
    
    // Open the newly created page in a new tab
    chrome.tabs.create({ url: pageUrl });
    
    showStatusCallback(`Successfully created page "${pageTitle}" with ${blocks.length} blocks in Notion!`, 'success');
  }
  
  function populateNotebooksDropdown(notebooks) {
    notebookSelect.innerHTML = '<option value="">-- Select a notebook --</option>';
    
    // Add all notebooks
    notebooks.forEach(notebook => {
      const option = document.createElement('option');
      option.value = notebook;
      option.textContent = notebook;
      notebookSelect.appendChild(option);
    });
    
    // Add "Other (add notebook)" option
    const otherOption = document.createElement('option');
    otherOption.value = '__CUSTOM__';
    otherOption.textContent = 'Other (add notebook)';
    notebookSelect.appendChild(otherOption);
  }
  
  function handleNotebookSelection() {
    const selectedValue = notebookSelect.value;
    
    if (selectedValue === '__CUSTOM__') {
      // Show custom input
      customNotebookGroup.style.display = 'flex';
      selectedNotebookName = customNotebookInput.value.trim() || null;
      if (selectedNotebookName) {
        saveSelectedNotebook(selectedNotebookName);
        showStatus(step2NotebookStatus, `Using custom notebook: "${selectedNotebookName}"`, 'info');
      } else {
        saveSelectedNotebook('');
        showStatus(step2NotebookStatus, 'Enter notebook name', 'info');
      }
    } else if (selectedValue) {
      // Hide custom input and use selected notebook
      customNotebookGroup.style.display = 'none';
      customNotebookInput.value = '';
      selectedNotebookName = selectedValue;
      saveSelectedNotebook(selectedValue);
      showStatus(step2NotebookStatus, `Selected: "${selectedValue}"`, 'success');
    } else {
      // No selection
      customNotebookGroup.style.display = 'none';
      customNotebookInput.value = '';
      selectedNotebookName = null;
      saveSelectedNotebook('');
      showStatus(step2NotebookStatus, '', '');
    }
  }
  
  function handleCustomNotebookInput() {
    const customName = customNotebookInput.value.trim();
    if (customName && notebookSelect.value === '__CUSTOM__') {
      selectedNotebookName = customName;
      saveSelectedNotebook(customName);
      showStatus(step2NotebookStatus, `Using custom notebook: "${customName}"`, 'info');
    } else if (!customName && notebookSelect.value === '__CUSTOM__') {
      selectedNotebookName = null;
      saveSelectedNotebook('');
      showStatus(step2NotebookStatus, 'Enter notebook name', 'info');
    }
  }
  
  async function handleRefetchNotebooks(event) {
    event.preventDefault(); // Prevent default link behavior
    refetchNotebooksBtn.style.pointerEvents = 'none'; // Disable link temporarily
    showStatus(step2NotebookStatus, 'Opening NotebookLM to fetch notebooks...', 'info');
    
    try {
      // Open NotebookLM in a new tab
      const tab = await chrome.tabs.create({ url: 'https://notebooklm.google.com/' });
      
      // Wait for the page to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Send message to content script to scrape notebook names
      chrome.tabs.sendMessage(tab.id, { 
        action: 'scrapeNotebookNames'
      }, async function(response) {
        if (chrome.runtime.lastError) {
          showStatus(step2NotebookStatus, 'Error: Could not scrape notebooks. Please ensure NotebookLM page is loaded.', 'error');
          refetchNotebooksBtn.style.pointerEvents = 'auto';
          return;
        }
        
        if (response && response.success && response.notebooks) {
          // Save notebooks list
          saveNotebooksList(response.notebooks);
          
          // Update dropdown
          populateNotebooksDropdown(response.notebooks);
          
          // Restore selection if it exists in the new list
          if (selectedNotebookName && response.notebooks.includes(selectedNotebookName)) {
            notebookSelect.value = selectedNotebookName;
          } else if (selectedNotebookName && notebookSelect.value === '__CUSTOM__') {
            // Keep custom selection
          } else {
            notebookSelect.value = '';
            selectedNotebookName = null;
          }
          
          showStatus(step2NotebookStatus, `Found ${response.notebooks.length} notebook(s)!`, 'success');
          
          // Clear status after 3 seconds
          setTimeout(() => {
            showStatus(step2NotebookStatus, '', '');
          }, 3000);
        } else {
          showStatus(step2NotebookStatus, response?.error || 'Failed to scrape notebooks', 'error');
        }
        
        refetchNotebooksBtn.style.pointerEvents = 'auto';
      });
      
    } catch (error) {
      console.error('Error refetching notebooks:', error);
      showStatus(step2NotebookStatus, `Error: ${error.message}`, 'error');
      refetchNotebooksBtn.style.pointerEvents = 'auto';
    }
  }
  
  async function addSourceToNotebooklm(showStatusCallback) {
    // Check if notebook is selected
    if (!selectedNotebookName) {
      // If custom input has value, use it
      const customName = customNotebookInput.value.trim();
      if (customName) {
        selectedNotebookName = customName;
        saveSelectedNotebook(customName);
      } else {
        showStatusCallback('Please select a notebook in Step 3', 'error');
        throw new Error('No notebook selected');
      }
    }
    
    // Get the selected chapter name and book title for renaming the source
    const selectedChapter = chapterSelect.value;
    
    // Get book title from cached HTML
    let sourceName = null;
    if (selectedChapter) {
      if (cachedHtmlContent) {
        const bookTitle = extractBookTitle(cachedHtmlContent);
        if (bookTitle) {
          // Format as "Chapter Name (Book Name)"
          sourceName = `${selectedChapter} (${bookTitle})`;
        } else {
          // Fallback to just chapter name if book title not found
          sourceName = selectedChapter;
        }
      } else {
        // Fallback to just chapter name if no cached content
        sourceName = selectedChapter;
      }
    }
    
    await exportToNotebooklm(selectedNotebookName, null, showStatusCallback, sourceName);
  }
  
  async function generateFlashcards(showStatusCallback) {
    // Get the selected chapter name and format it to match the renamed source
    // Source is named as "Chapter Name (Book Name)", so we need to match that format
    const selectedChapter = chapterSelect.value;
    
    // Format source name to match the renamed source: "Chapter Name (Book Name)"
    let sourceName = null;
    if (selectedChapter) {
      if (cachedHtmlContent) {
        const bookTitle = extractBookTitle(cachedHtmlContent);
        if (bookTitle) {
          // Format as "Chapter Name (Book Name)" to match the renamed source
          sourceName = `${selectedChapter} (${bookTitle})`;
        } else {
          // Fallback to just chapter name if book title not found
          sourceName = selectedChapter;
        }
      } else {
        // Fallback to just chapter name if no cached content
        sourceName = selectedChapter;
      }
    }
    
    const chapterName = selectedChapter || null; // Use chapter name for renaming the flashcard
    
    await createFlashcards(showStatusCallback, sourceName, chapterName);
  }
  
  async function createGeminiQuiz(showStatusCallback) {
    // Check if we have cached HTML content
    if (!cachedHtmlContent) {
      showStatusCallback('Please load a Kindle highlights file first in Step 1', 'error');
      throw new Error('No file loaded');
    }
    
    // Get book title from cached HTML
    const bookTitle = extractBookTitle(cachedHtmlContent);
    if (!bookTitle) {
      showStatusCallback('Could not extract book title. Please reload file in Step 1.', 'error');
      throw new Error('Could not extract book title');
    }
    
    // Get the selected chapter name
    const selectedChapter = chapterSelect.value;
    if (!selectedChapter) {
      showStatusCallback('Please select a chapter first in Step 2', 'error');
      throw new Error('No chapter selected');
    }
    
    // Get the Gemini chat URL from config
    const geminiChatUrl = configGeminiChatUrlInput.value.trim();
    
    if (!geminiChatUrl) {
      showStatusCallback('Please enter a Gemini Chat/Gem URL in the Config tab', 'error');
      throw new Error('Gemini Chat URL required');
    }
    
    saveGeminiChatUrl(geminiChatUrl);
    
    // Get content from storage
    const content = await loadProcessedContent();
    
    if (!content) {
      showStatusCallback('No content found. Please run Step 2 first.', 'error');
      throw new Error('No content found');
    }
    
    await sendToGeminiChat(geminiChatUrl, content, showStatusCallback, bookTitle, selectedChapter);
  }
  
  async function handlePerformActions() {
    // Check if at least one action is selected
    if (!actionProcessHighlights.checked && 
        !actionCopyToNotion.checked && 
        !actionAddToNotebooklm.checked && 
        !actionGenerateFlashcards.checked &&
        !actionCreateGeminiQuiz.checked) {
      showStatus(step2Status, 'Please select at least one action', 'error');
      return;
    }
    
    // Check if a chapter is selected
    const selectedChapter = chapterSelect.value;
    if (!selectedChapter) {
      showStatus(step2Status, 'Please select a chapter first in Step 2', 'error');
      return;
    }
    
    // Check if notebook is selected for NotebookLM actions
    if (actionAddToNotebooklm.checked || actionGenerateFlashcards.checked) {
      // Get notebook name (from dropdown or custom input)
      let notebookName = selectedNotebookName;
      if (!notebookName && notebookSelect.value === '__CUSTOM__') {
        notebookName = customNotebookInput.value.trim();
      }
      
      if (!notebookName) {
        showStatus(step2Status, 'Please select a notebook in Step 3', 'error');
        return;
      }
      
      // Save it if it's from custom input
      if (!selectedNotebookName && notebookName) {
        selectedNotebookName = notebookName;
        saveSelectedNotebook(notebookName);
      }
    }
    
    performActionsBtn.disabled = true;
    
    try {
      // Execute actions in sequence
      const statusCallback = (message, type) => showStatus(step2Status, message, type);
      
      // 1. Process highlights (if selected)
      if (actionProcessHighlights.checked) {
        try {
          await processKindleHighlights(statusCallback);
        } catch (error) {
          console.error('Error processing highlights:', error);
          showStatus(step2Status, `Error processing highlights: ${error.message}`, 'error');
          // Continue with other actions if this fails?
          // For now, we'll stop if processing fails since other actions depend on it
          if (actionCopyToNotion.checked) {
            throw error; // Stop if Copy to Notion depends on processed highlights
          }
        }
      }
      
      // 2. Copy to Notion (if selected)
      if (actionCopyToNotion.checked) {
        try {
          await copyToNotion(statusCallback);
        } catch (error) {
          console.error('Error copying to Notion:', error);
          showStatus(step2Status, `Error copying to Notion: ${error.message}`, 'error');
          // Continue with other actions
        }
      }
      
      // 3. Create Gemini quiz (if selected)
      if (actionCreateGeminiQuiz.checked) {
        try {
          await createGeminiQuiz(statusCallback);
        } catch (error) {
          console.error('Error creating Gemini quiz:', error);
          showStatus(step2Status, `Error creating Gemini quiz: ${error.message}`, 'error');
        }
      }
      
      // 4. Add source to NotebookLM (if selected)
      if (actionAddToNotebooklm.checked) {
        try {
          await addSourceToNotebooklm(statusCallback);
        } catch (error) {
          console.error('Error adding source to NotebookLM:', error);
          showStatus(step2Status, `Error adding source to NotebookLM: ${error.message}`, 'error');
          // Continue with other actions
        }
      }
      
      // 5. Generate flashcards (if selected)
      if (actionGenerateFlashcards.checked) {
        try {
          await generateFlashcards(statusCallback);
        } catch (error) {
          console.error('Error generating flashcards:', error);
          showStatus(step2Status, `Error generating flashcards: ${error.message}`, 'error');
        }
      }
      
      // Show final success message if we got here
      const selectedActions = [];
      if (actionProcessHighlights.checked) selectedActions.push('Process highlights');
      if (actionCopyToNotion.checked) selectedActions.push('Copy to Notion');
      if (actionCreateGeminiQuiz.checked) selectedActions.push('Create Gemini quiz');
      if (actionAddToNotebooklm.checked) selectedActions.push('Add source to NotebookLM');
      if (actionGenerateFlashcards.checked) selectedActions.push('Generate flashcards');
      
      showStatus(step2Status, `Completed: ${selectedActions.join(', ')}`, 'success');
      
    } catch (error) {
      console.error('Error performing actions:', error);
      showStatus(step2Status, `Error: ${error.message}`, 'error');
    } finally {
      performActionsBtn.disabled = false;
    }
  }
});
