// Learning Workflow Extension - Popup Script
document.addEventListener('DOMContentLoaded', function() {
  const content = document.getElementById('content');
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
  
  // Initialize popup
  initializePopup();
  
  function initializePopup() {
    // Set up event listeners
    processKindleBtn.addEventListener('click', handleProcessKindleHighlights);
    copyToNotionBtn.addEventListener('click', handleCopyToNotion);
    exportToNotebooklmBtn.addEventListener('click', handleExportToNotebooklm);
    
    // Load saved URLs if available
    chrome.storage.local.get(['kindleFileUrl', 'notionPageUrl', 'notionAuthToken', 'notebooklmUrl'], function(result) {
      if (result.kindleFileUrl) {
        kindleFileUrlInput.value = result.kindleFileUrl;
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
  
  async function handleProcessKindleHighlights() {
    const url = kindleFileUrlInput.value.trim();
    
    if (!url) {
      showStatus(step1Status, 'Please enter a Kindle highlights file URL', 'error');
      return;
    }
    
    // Save URL for future use
    chrome.storage.local.set({ kindleFileUrl: url });
    
    processKindleBtn.disabled = true;
    showStatus(step1Status, 'Processing highlights...', 'info');
    
    try {
      // Fetch the HTML file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }
      
      const htmlContent = await response.text();
      
      // Parse the HTML and extract highlights
      const processedContent = parseKindleHighlights(htmlContent);
      
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
  
  function parseKindleHighlights(htmlContent) {
    // Create a temporary DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    let processedContent = '';
    let currentSubsection = '';
    
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
        if (sectionTitle) {
          processedContent += `\n## ${sectionTitle}\n\n`;
        }
      } else if (element.classList.contains('noteHeading')) {
        // Process highlight - get the corresponding noteText
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
    const pageUrl = notionPageUrlInput.value.trim();
    const authToken = notionAuthTokenInput.value.trim();
    
    if (!pageUrl) {
      showStatus(step2Status, 'Please enter a Notion page URL', 'error');
      return;
    }
    
    if (!authToken) {
      showStatus(step2Status, 'Please enter a Notion integration token', 'error');
      return;
    }
    
    // Save URLs for future use
    chrome.storage.local.set({ 
      notionPageUrl: pageUrl,
      notionAuthToken: authToken
    });
    
    copyToNotionBtn.disabled = true;
    showStatus(step2Status, 'Copying to Notion...', 'info');
    
    try {
      // Get content from clipboard
      const clipboardContent = await navigator.clipboard.readText();
      
      if (!clipboardContent) {
        showStatus(step2Status, 'No content in clipboard. Please run Step 1 first.', 'error');
        return;
      }
      
      // Extract page ID from Notion URL
      const pageId = extractNotionPageId(pageUrl);
      if (!pageId) {
        showStatus(step2Status, 'Invalid Notion page URL format', 'error');
        return;
      }
      
      // Convert Markdown to Notion blocks
      const blocks = convertMarkdownToNotionBlocks(clipboardContent);
      
      // Split blocks into chunks of 100 (Notion API limit)
      const chunkSize = 100;
      const chunks = [];
      for (let i = 0; i < blocks.length; i += chunkSize) {
        chunks.push(blocks.slice(i, i + chunkSize));
      }
      
      showStatus(step2Status, `Sending ${blocks.length} blocks in ${chunks.length} batches...`, 'info');
      
      // Send blocks in batches
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
        showStatus(step2Status, `Sent batch ${i + 1}/${chunks.length} (${chunk.length} blocks)...`, 'info');
        
        // Add a small delay between requests to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      showStatus(step2Status, `Successfully copied ${blocks.length} blocks to Notion!`, 'success');
      
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
  
  function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status ${type}`;
  }
});
