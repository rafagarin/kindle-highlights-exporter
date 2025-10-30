// Learning Workflow Extension - Popup Script
document.addEventListener('DOMContentLoaded', function() {
  const content = document.getElementById('content');
  const kindleFileUrlForChaptersInput = document.getElementById('kindleFileUrlForChapters');
  const loadChaptersBtn = document.getElementById('loadChaptersBtn');
  const chapterSelect = document.getElementById('chapterSelect');
  const chapterSelectionGroup = document.getElementById('chapterSelectionGroup');
  const step0Status = document.getElementById('step0Status');
  const kindleFileUrlInput = document.getElementById('kindleFileUrl');
  const processKindleBtn = document.getElementById('processKindleBtn');
  const step1Status = document.getElementById('step1Status');
  const notionPageUrlInput = document.getElementById('notionPageUrl');
  const notionAuthTokenInput = document.getElementById('notionAuthToken');
  const copyToNotionBtn = document.getElementById('copyToNotionBtn');
  const step2Status = document.getElementById('step2Status');
  const notebooklmUrlInput = document.getElementById('notebooklmUrl');
  const exportToNotebooklmBtn = document.getElementById('exportToNotebooklmBtn');
  const step3Status = document.getElementById('step3Status');
  const createFlashcardsBtn = document.getElementById('createFlashcardsBtn');
  const step4Status = document.getElementById('step4Status');
  
  // Store the full HTML content and chapters list
  let cachedHtmlContent = null;
  let chaptersList = [];
  
  // Initialize popup
  initializePopup();
  
  function initializePopup() {
    // Set up event listeners
    loadChaptersBtn.addEventListener('click', handleLoadChapters);
    chapterSelect.addEventListener('change', handleChapterSelection);
    processKindleBtn.addEventListener('click', handleProcessKindleHighlights);
    copyToNotionBtn.addEventListener('click', handleCopyToNotion);
    exportToNotebooklmBtn.addEventListener('click', handleExportToNotebooklm);
    createFlashcardsBtn.addEventListener('click', handleCreateFlashcards);
    
    // Load saved URLs if available
    chrome.storage.local.get(['kindleFileUrl', 'selectedChapter', 'notionPageUrl', 'notionAuthToken', 'notebooklmUrl'], function(result) {
      if (result.kindleFileUrl) {
        kindleFileUrlForChaptersInput.value = result.kindleFileUrl;
        kindleFileUrlInput.value = result.kindleFileUrl;
      }
      if (result.selectedChapter) {
        // Restore selected chapter if available
        chapterSelect.value = result.selectedChapter;
        if (chapterSelect.value) {
          chapterSelectionGroup.style.display = 'flex';
        }
      }
      if (result.notionPageUrl) {
        notionPageUrlInput.value = result.notionPageUrl;
      }
      if (result.notionAuthToken) {
        notionAuthTokenInput.value = result.notionAuthToken;
      }
      if (result.notebooklmUrl) {
        notebooklmUrlInput.value = result.notebooklmUrl;
      }
    });
  }
  
  async function handleLoadChapters() {
    const url = kindleFileUrlForChaptersInput.value.trim();
    
    if (!url) {
      showStatus(step0Status, 'Please enter a Kindle highlights file URL', 'error');
      return;
    }
    
    // Sync the URL to Step 1 input
    kindleFileUrlInput.value = url;
    
    // Save URL for future use
    chrome.storage.local.set({ kindleFileUrl: url });
    
    loadChaptersBtn.disabled = true;
    showStatus(step0Status, 'Loading chapters...', 'info');
    
    try {
      // Fetch the HTML file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }
      
      const htmlContent = await response.text();
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
      chaptersList.forEach((chapter, index) => {
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
  
  function extractChapters(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    const bodyContainer = doc.querySelector('.bodyContainer');
    if (!bodyContainer) {
      return [];
    }
    
    const chapters = [];
    const children = bodyContainer.children;
    
    for (let i = 0; i < children.length; i++) {
      const element = children[i];
      if (element.classList.contains('sectionHeading')) {
        const chapterName = element.textContent.trim();
        if (chapterName) {
          chapters.push(chapterName);
        }
      }
    }
    
    return chapters;
  }
  
  function handleChapterSelection() {
    const selectedChapter = chapterSelect.value;
    
    if (selectedChapter) {
      // Save the selected chapter
      chrome.storage.local.set({ selectedChapter: selectedChapter });
      showStatus(step0Status, `Chapter "${selectedChapter}" selected`, 'success');
    } else {
      chrome.storage.local.remove('selectedChapter');
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
    
    // Save URL for future use
    chrome.storage.local.set({ kindleFileUrl: url });
    
    processKindleBtn.disabled = true;
    showStatus(step1Status, 'Processing highlights...', 'info');
    
    try {
      // Use cached HTML content if available, otherwise fetch it
      let htmlContent = cachedHtmlContent;
      if (!htmlContent) {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }
        htmlContent = await response.text();
        cachedHtmlContent = htmlContent;
      }
      
      // Parse the HTML and extract highlights for the selected chapter
      const processedContent = parseKindleHighlights(htmlContent, selectedChapter);
      
      if (!processedContent || processedContent.trim() === '') {
        showStatus(step1Status, 'No highlights found for the selected chapter', 'error');
        return;
      }
      
      // Copy to clipboard
      await navigator.clipboard.writeText(processedContent);
      
      showStatus(step1Status, 'Highlights processed and copied to clipboard!', 'success');
      
    } catch (error) {
      console.error('Error processing Kindle highlights:', error);
      showStatus(step1Status, `Error: ${error.message}`, 'error');
    } finally {
      processKindleBtn.disabled = false;
    }
  }
  
  function parseKindleHighlights(htmlContent, selectedChapter = null) {
    // Create a temporary DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    let processedContent = '';
    let currentSubsection = '';
    let isInSelectedChapter = false;
    
    // Get the body container and process all child elements in order
    const bodyContainer = doc.querySelector('.bodyContainer');
    if (!bodyContainer) {
      return 'Error: Could not find body container in HTML';
    }
    
    // Process all child elements in the order they appear
    const children = bodyContainer.children;
    
    for (let i = 0; i < children.length; i++) {
      const element = children[i];
      
      if (element.classList.contains('sectionHeading')) {
        // Process section heading
        const sectionTitle = element.textContent.trim();
        
        // If a chapter is selected, only process highlights from that chapter
        if (selectedChapter) {
          isInSelectedChapter = (sectionTitle === selectedChapter);
          // Add the chapter heading only if it's the selected one
          if (isInSelectedChapter && sectionTitle) {
            processedContent += `\n## ${sectionTitle}\n\n`;
          }
        } else {
          // If no chapter selected, process all (backward compatibility)
          if (sectionTitle) {
            processedContent += `\n## ${sectionTitle}\n\n`;
          }
          isInSelectedChapter = true; // Process all if no selection
        }
      } else if (element.classList.contains('noteHeading') && isInSelectedChapter) {
        // Process highlight - get the corresponding noteText
        // Only process if we're in the selected chapter
        const noteText = children[i + 1];
        
        if (noteText && noteText.classList.contains('noteText')) {
          const headingText = element.textContent.trim();
          const highlightText = noteText.textContent.trim();
          
          if (highlightText) {
            // Extract the subsection from the note heading
            const subsectionMatch = headingText.match(/Highlight\([^)]+\) - (.+?) >/);
            const subsection = subsectionMatch ? subsectionMatch[1].trim() : '';
            
            // Add subsection as heading if it's different from current one
            if (subsection && subsection !== currentSubsection) {
              processedContent += `### ${subsection}\n`;
              currentSubsection = subsection;
            }
            
            // Add only the highlight text
            processedContent += `${highlightText}\n\n`;
          }
          
          // Skip the next element since we've already processed it
          i++;
        }
      }
    }
    
    return processedContent.trim();
  }
  
  async function handleCopyToNotion() {
    const databaseUrl = notionPageUrlInput.value.trim();
    const authToken = notionAuthTokenInput.value.trim();
    
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
    
    // Save URLs for future use
    chrome.storage.local.set({ 
      notionPageUrl: databaseUrl,
      notionAuthToken: authToken
    });
    
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
      showStatus(step2Status, `Creating page "${pageTitle}"...`, 'info');
      
      const pageData = {
        parent: dataSourceId 
          ? { data_source_id: dataSourceId }
          : { database_id: databaseId },
        properties: {
          [titlePropertyName]: {
            type: "title",
            title: [
              {
                type: "text",
                text: {
                  content: pageTitle
                }
              }
            ]
          }
        }
      };
      
      // Add children (content blocks) if we have any
      if (blocks.length > 0) {
        // Split blocks into chunks of 100 (Notion API limit for children)
        const chunkSize = 100;
        const firstChunk = blocks.slice(0, chunkSize);
        pageData.children = firstChunk;
      }
      
      // Create the page
      const createResponse = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify(pageData)
      });
      
      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(`Notion API error: ${errorData.message || createResponse.statusText}`);
      }
      
      const createdPage = await createResponse.json();
      const pageId = createdPage.id;
      
      // If we have more than 100 blocks, add them in batches
      if (blocks.length > 100) {
        const remainingBlocks = blocks.slice(100);
        const chunkSize = 100;
        const chunks = [];
        for (let i = 0; i < remainingBlocks.length; i += chunkSize) {
          chunks.push(remainingBlocks.slice(i, i + chunkSize));
        }
        
        showStatus(step2Status, `Adding remaining ${remainingBlocks.length} blocks in ${chunks.length} batches...`, 'info');
        
        // Add remaining blocks in batches
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
              children: chunk
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Notion API error: ${errorData.message || response.statusText}`);
          }
          
          // Update progress
          showStatus(step2Status, `Added batch ${i + 1}/${chunks.length} (${chunk.length} blocks)...`, 'info');
          
          // Add a small delay between requests to avoid rate limiting
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      showStatus(step2Status, `Successfully created page "${pageTitle}" with ${blocks.length} blocks in Notion!`, 'success');
      
    } catch (error) {
      console.error('Error copying to Notion:', error);
      showStatus(step2Status, `Error: ${error.message}`, 'error');
    } finally {
      copyToNotionBtn.disabled = false;
    }
  }
  
  function extractNotionPageId(url) {
    // Extract page ID from Notion URL
    // Format: https://www.notion.so/workspace/page-title-32charid
    const match = url.match(/([a-f0-9]{32})$/);
    if (match) {
      const id = match[1];
      // Format as 8-4-4-4-12
      return `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20,32)}`;
    }
    return null;
  }
  
  function extractNotionDatabaseId(url) {
    // Extract database ID from Notion URL
    // Format: https://www.notion.so/workspace/database-title-32charid or similar
    // Can use the same extraction logic as page ID
    const match = url.match(/([a-f0-9]{32})$/);
    if (match) {
      const id = match[1];
      // Format as 8-4-4-4-12
      return `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20,32)}`;
    }
    return null;
  }
  
  function extractBookTitle(htmlContent) {
    if (!htmlContent) {
      return null;
    }
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const bookTitleElement = doc.querySelector('.bookTitle');
      
      if (bookTitleElement) {
        return bookTitleElement.textContent.trim();
      }
    } catch (error) {
      console.error('Error extracting book title:', error);
    }
    
    return null;
  }
  
  async function getDatabaseDataSourceAndTitleProperty(databaseId, authToken) {
    try {
      // First, fetch the database to get its data sources
      const dbResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        }
      });
      
      if (!dbResponse.ok) {
        const errorData = await dbResponse.json();
        throw new Error(`Could not fetch database: ${errorData.message || dbResponse.statusText}`);
      }
      
      const database = await dbResponse.json();
      
      let dataSourceId = null;
      let properties = null;
      
      // Check if database has data_sources array (newer API structure)
      // Note: Some API versions may not include data_sources, in which case
      // properties are directly on the database object
      if (database.data_sources && Array.isArray(database.data_sources) && database.data_sources.length > 0) {
        // New API structure: database has data_sources array
        dataSourceId = database.data_sources[0].id;
      
        // Now fetch the data source to get its properties
        const dsResponse = await fetch(`https://api.notion.com/v1/data_sources/${dataSourceId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          }
        });
        
        if (dsResponse.ok) {
          const dataSource = await dsResponse.json();
          properties = dataSource.properties || {};
        } else {
          // If we can't fetch the data source, try using database properties
          properties = database.properties || {};
        }
      } else {
        // Older API structure: database properties are directly on the database object
        // For older API, we use database_id directly as parent (not data_source_id)
        properties = database.properties || {};
      }
      
      if (!properties || Object.keys(properties).length === 0) {
        throw new Error('Could not find database properties');
      }
      
      // Find the property with type "title"
      let titlePropertyName = 'Name'; // default fallback
      for (const [propertyName, property] of Object.entries(properties)) {
        if (property.type === 'title') {
          titlePropertyName = propertyName;
          break;
        }
      }
      
      return { dataSourceId, titlePropertyName };
    } catch (error) {
      console.error('Error fetching database/data source:', error);
      throw error;
    }
  }
  
  function convertMarkdownToNotionBlocks(markdown) {
    const lines = markdown.split('\n');
    const blocks = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('## ')) {
        // Heading 2
        blocks.push({
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [{
              type: "text",
              text: { content: line.substring(3) }
            }]
          }
        });
      } else if (line.startsWith('### ')) {
        // Heading 3
        blocks.push({
          object: "block",
          type: "heading_3",
          heading_3: {
            rich_text: [{
              type: "text",
              text: { content: line.substring(4) }
            }]
          }
        });
      } else if (line.length > 0) {
        // Regular paragraph
        blocks.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{
              type: "text",
              text: { content: line }
            }]
          }
        });
      }
    }
    
    return blocks;
  }
  
  async function handleExportToNotebooklm() {
    const url = notebooklmUrlInput.value.trim();
    
    if (!url) {
      showStatus(step3Status, 'Please enter a NotebookLM notebook URL', 'error');
      return;
    }
    
    // Save URL for future use
    chrome.storage.local.set({ notebooklmUrl: url });
    
    exportToNotebooklmBtn.disabled = true;
    showStatus(step3Status, 'Opening NotebookLM...', 'info');
    
    try {
      // Get content from clipboard
      const clipboardContent = await navigator.clipboard.readText();
      
      if (!clipboardContent) {
        showStatus(step3Status, 'No content in clipboard. Please run Step 1 first.', 'error');
        return;
      }
      
      // Open the NotebookLM page in a new tab
      const tab = await chrome.tabs.create({ url: url });
      
      // Wait for the page to load
      showStatus(step3Status, 'Waiting for NotebookLM to load...', 'info');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Send message to content script to automate the process
      chrome.tabs.sendMessage(tab.id, { 
        action: 'exportToNotebooklm',
        content: clipboardContent
      }, function(response) {
        if (chrome.runtime.lastError) {
          showStatus(step3Status, 'Please refresh the NotebookLM page and try again', 'error');
        } else if (response && response.success) {
          showStatus(step3Status, 'Successfully exported to NotebookLM!', 'success');
        } else {
          showStatus(step3Status, response?.error || 'Failed to export to NotebookLM', 'error');
        }
      });
      
    } catch (error) {
      console.error('Error exporting to NotebookLM:', error);
      showStatus(step3Status, `Error: ${error.message}`, 'error');
    } finally {
      exportToNotebooklmBtn.disabled = false;
    }
  }
  
  async function handleCreateFlashcards() {
    createFlashcardsBtn.disabled = true;
    showStatus(step4Status, 'Creating flashcards...', 'info');
    
    try {
      // Get the current active tab (should be the NotebookLM page)
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab.url.includes('notebooklm.google.com')) {
        showStatus(step4Status, 'Please navigate to your NotebookLM notebook first', 'error');
        return;
      }
      
      // Send message to content script to create flashcards
      chrome.tabs.sendMessage(currentTab.id, { 
        action: 'createFlashcards'
      }, function(response) {
        if (chrome.runtime.lastError) {
          showStatus(step4Status, 'Please refresh the NotebookLM page and try again', 'error');
        } else if (response && response.success) {
          showStatus(step4Status, 'Successfully created flashcards!', 'success');
        } else {
          showStatus(step4Status, response?.error || 'Failed to create flashcards', 'error');
        }
      });
      
    } catch (error) {
      console.error('Error creating flashcards:', error);
      showStatus(step4Status, `Error: ${error.message}`, 'error');
    } finally {
      createFlashcardsBtn.disabled = false;
    }
  }
  
  function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status ${type}`;
  }
});
