# Learning Workflow Extension

A Chrome extension that automates the learning workflow from Kindle highlights to NotebookLM flashcards. This extension streamlines the process of extracting highlights from Kindle books, organizing them in Notion, and creating flashcards in NotebookLM for efficient studying.


## Files Structure

### Core Files
- `manifest.json` - Extension configuration, permissions, and metadata
- `popup.html` - Side panel UI interface
- `popup.js` - Main extension logic and workflow orchestration
- `popup.css` - Side panel styling
- `background.js` - Background service worker for extension lifecycle
- `content.js` - Content script for automating NotebookLM interactions

### Module Files
- `kindle.js` - Kindle HTML parsing, chapter extraction, and highlight processing
- `notion.js` - Notion API integration for database/page creation
- `notebooklm.js` - NotebookLM automation and flashcard creation
- `gemini.js` - Google Gemini API integration for AI-powered highlight processing
- `storage.js` - Chrome storage operations for saving user data
- `utils.js` - Utility functions for UI status updates

## Setup Instructions

1. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select this folder

2. **Configure API Keys (Optional):**
   - **Gemini API Key** (Step 1): Optional - for AI-powered highlight processing
     - Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **Notion Integration Token** (Step 2): Required for Notion integration
     - Create an integration at [Notion Integrations](https://www.notion.so/my-integrations)
     - Grant it access to your workspace/database

3. **Use the extension:**
   - Click the extension icon in the toolbar to open the side panel
   - Follow the steps sequentially:
     1. Load your Kindle highlights HTML file URL and select a chapter
     2. Process highlights (optionally with Gemini AI)
     3. Copy to Notion (requires database URL and integration token)
     4. Export to NotebookLM (opens notebook and adds content)
     5. Create flashcards (automates flashcard creation in NotebookLM)

