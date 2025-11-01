// Gemini API integration module

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Process a single section of highlights using Gemini API
 * @param {string} sectionContent - The highlights text for a single section
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<string>} Processed and formatted text
 */
async function processSingleSection(sectionContent, apiKey) {
  if (!sectionContent || sectionContent.trim() === '') {
    return '';
  }

  const prompt = `I will give you a text that contains a list of highlights I copied from a Kindle book. Please parse this content in order to make it more readable. The result should be properly formatted, in complete sentences and paragraphs, and with headings when necessary. Don't make too many changes, the actual content (information that the text provides) should remain the same. Respond only with the formatted text. Here is the original text:\n\n${sectionContent}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      thinkingConfig: {
        thinkingBudget: 0
      }
    }
  };

  const response = await fetch(`${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`Gemini API error: ${errorData.message || errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();

  // Extract the generated text from the response
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
    const generatedText = data.candidates[0].content.parts
      .map(part => part.text)
      .join('');
    
    return generatedText.trim();
  }

  throw new Error('Invalid response format from Gemini API');
}

/**
 * Process highlights using Gemini API to make them more readable
 * Processes each section separately (sections are identified by ### headings)
 * @param {string} highlightsText - The raw highlights text to process
 * @param {string} apiKey - Gemini API key
 * @param {Function} progressCallback - Optional callback to report progress (sectionName, current, total)
 * @returns {Promise<string>} Processed and formatted text
 */
export async function processHighlightsWithGemini(highlightsText, apiKey, progressCallback = null) {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  if (!highlightsText || highlightsText.trim() === '') {
    throw new Error('Highlights text is required');
  }

  // Split content by sections (marked with ### headings)
  // Also preserve chapter heading (## heading) if present
  const sections = [];
  const lines = highlightsText.split('\n');
  let currentSection = { title: null, content: [] };
  let chapterHeading = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for chapter heading (## heading)
    if (line.match(/^##\s+.+$/)) {
      chapterHeading = line;
      continue;
    }
    
    // Check for section heading (### heading)
    if (line.match(/^###\s+.+$/)) {
      // Save previous section if it has content
      if (currentSection.title !== null || currentSection.content.length > 0) {
        sections.push({
          title: currentSection.title,
          content: currentSection.content.join('\n').trim()
        });
      }
      // Start new section
      currentSection = {
        title: line.replace(/^###\s+/, ''),
        content: []
      };
    } else {
      // Add line to current section content
      currentSection.content.push(line);
    }
  }

  // Don't forget the last section
  if (currentSection.title !== null || currentSection.content.length > 0) {
    sections.push({
      title: currentSection.title,
      content: currentSection.content.join('\n').trim()
    });
  }

  // If no sections found, treat entire content as a single section
  if (sections.length === 0) {
    sections.push({
      title: null,
      content: highlightsText.trim()
    });
  }

  // Process each section separately
  const processedSections = [];
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    if (progressCallback) {
      const sectionName = section.title || 'Introduction';
      progressCallback(sectionName, i + 1, sections.length);
    }
    
    if (section.content) {
      try {
        const processedContent = await processSingleSection(section.content, apiKey);
        processedSections.push({
          title: section.title,
          content: processedContent
        });
      } catch (error) {
        console.error(`Error processing section "${section.title || 'unknown'}":`, error);
        // If a section fails, use the original content
        processedSections.push({
          title: section.title,
          content: section.content
        });
      }
    }
  }

  // Combine processed sections back together
  let result = '';
  
  // Add chapter heading if present
  if (chapterHeading) {
    result += chapterHeading + '\n\n';
  }
  
  // Add processed sections
  for (const section of processedSections) {
    if (section.title) {
      result += `### ${section.title}\n\n`;
    }
    if (section.content) {
      result += section.content + '\n\n';
    }
  }

  return result.trim();
}

