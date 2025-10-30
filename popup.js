// Learning Workflow Extension - Popup Script
document.addEventListener('DOMContentLoaded', function() {
  const content = document.getElementById('content');
  const kindleFileUrlInput = document.getElementById('kindleFileUrl');
  const processKindleBtn = document.getElementById('processKindleBtn');
  const step1Status = document.getElementById('step1Status');
  
  // Initialize popup
  initializePopup();
  
  function initializePopup() {
    // Set up event listeners
    processKindleBtn.addEventListener('click', handleProcessKindleHighlights);
    
    // Load saved URL if available
    chrome.storage.local.get(['kindleFileUrl'], function(result) {
      if (result.kindleFileUrl) {
        kindleFileUrlInput.value = result.kindleFileUrl;
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
  
  function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status ${type}`;
  }
});
