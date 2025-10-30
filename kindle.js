// Kindle highlights processing module

/**
 * Extract chapter names from Kindle HTML content
 * @param {string} htmlContent - The HTML content from Kindle export
 * @returns {string[]} Array of chapter names
 */
export function extractChapters(htmlContent) {
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

/**
 * Extract book title from Kindle HTML content
 * @param {string} htmlContent - The HTML content from Kindle export
 * @returns {string|null} Book title or null if not found
 */
export function extractBookTitle(htmlContent) {
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

/**
 * Parse Kindle highlights from HTML content for a specific chapter
 * @param {string} htmlContent - The HTML content from Kindle export
 * @param {string|null} selectedChapter - The chapter to process, or null for all chapters
 * @returns {string} Processed markdown content
 */
export function parseKindleHighlights(htmlContent, selectedChapter = null) {
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

/**
 * Fetch and cache Kindle HTML content
 * @param {string} url - URL to the Kindle highlights HTML file
 * @returns {Promise<string>} The HTML content
 */
export async function fetchKindleHtml(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }
  return await response.text();
}

