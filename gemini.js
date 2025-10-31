// Gemini API integration module

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Process highlights using Gemini API to make them more readable
 * @param {string} highlightsText - The raw highlights text to process
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<string>} Processed and formatted text
 */
export async function processHighlightsWithGemini(highlightsText, apiKey) {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  if (!highlightsText || highlightsText.trim() === '') {
    throw new Error('Highlights text is required');
  }

  const prompt = `I will give you a text that contains a list of highlights I copied from a Kindle book. Please parse this content in order to make it more readable. The result should be properly formatted, in complete sentences and paragraphs, and with headings when necessary. Don't make too many changes, the actual content (information that the text provides) should remain the same. Respond only with the formatted text. Here is the original text:\n\n${highlightsText}`;

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

