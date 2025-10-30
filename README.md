# Chrome Extension Boilerplate

A generic, empty Chrome extension boilerplate ready for development.

## Files Structure

- `manifest.json` - Extension configuration and permissions
- `popup.html` - Extension popup interface
- `popup.js` - Popup functionality
- `popup.css` - Popup styling
- `background.js` - Background service worker
- `content.js` - Content script for web pages

## Setup Instructions

1. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select this folder

2. **Test the extension:**
   - Click the extension icon in the toolbar
   - The popup should open with a "Click Me" button
   - Click the button to see a notification on the current page

## Features Included

- Basic popup interface with HTML, CSS, and JavaScript
- Background service worker for extension lifecycle management
- Content script that runs on all web pages
- Message passing between popup, background, and content scripts
- Chrome storage API integration
- Tab management functionality

## Development

- Modify `popup.html` and `popup.css` to customize the popup interface
- Add functionality in `popup.js` for popup interactions
- Use `background.js` for extension-wide logic and API calls
- Use `content.js` to interact with web page content
- Update `manifest.json` to add permissions or change configuration

## Permissions

Currently includes:
- `activeTab` - Access to the currently active tab
- `storage` - Access to Chrome storage API

Add more permissions in `manifest.json` as needed for your extension's functionality.
