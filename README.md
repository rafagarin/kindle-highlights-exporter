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
- `notebooklm.js` - NotebookLM automation facade (orchestrates notebook, source, and flashcard operations)
- `notebooklm_notebooks.js` - NotebookLM notebook management (opening notebooks by name)
- `notebooklm_sources.js` - NotebookLM source export automation
- `notebooklm_flashcards.js` - NotebookLM flashcard creation automation
- `notebooklm_utils.js` - Shared utility functions for NotebookLM DOM automation
- `gemini.js` - Google Gemini API integration for AI-powered highlight processing
- `gemini_chat.js` - Gemini Chat/Gem integration for automated quiz creation
- `storage.js` - Chrome storage operations for saving user data
- `utils.js` - Utility functions for UI status updates

## Setup Instructions

1. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select this folder

2. **Configure API Keys:**
   - **Gemini API Key**: Optional - for AI-powered highlight processing
     - Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **Notion Integration Token**: Required for Notion integration
     - Create an integration at [Notion Integrations](https://www.notion.so/my-integrations)
     - Grant it access to your workspace/database
   - **Gemini Chat/Gem URL**: Required for "Create Gemini quiz" action
     - Copy the URL from your Gemini gem/chat (e.g., `https://gemini.google.com/gem/...`)

3. **Use the extension:**
   - Click the extension icon in the toolbar to open the side panel
   - Follow the steps sequentially:
     1. **Load highlights file** - Select your Kindle highlights HTML file
     2. **Select chapter to process** - Choose a chapter from the dropdown
     3. **Select Actions** - Choose one or more actions to perform:
        - **Process highlights with AI** - Process highlights using Gemini AI (requires Gemini API Key)
        - **Copy notes to Notion** - Copy processed highlights to Notion database (requires Notion Integration Token and Database URL)
        - **Create Gemini quiz** - Send content to Gemini Chat/Gem for quiz creation (requires Gemini Chat URL)
        - **Add source to NotebookLM** - Export content to NotebookLM notebook
        - **Generate flashcards** - Automate flashcard creation in NotebookLM
     - Click "Perform Actions" to execute all selected actions in sequence

