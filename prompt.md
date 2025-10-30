# Context

This is my learning workflow:

1. Read and highlight on **Kindle.**
2. Copy highlights to **Notion.**
3. Clean the notes using Notion AI.
4. Export them to **NotebookLM** or **Gemini.**
5. Create flashcards in NotebookLM, or a quiz in Gemini for more creative testing.

# Task

I want to build a chrome extension that will help me automate each of these steps, by reading info from and interacting with each service's website.

This is how the extension should handle each step.

### Read and highlight on **Kindle**

This step will always be manual, as it’s part of my learning.

### Export highlights

The Kindle desktop app has an option to export highlights as an .html file. I will create this file and point to it using the `KINDLE_HIGHLIGHTS_FILE_URL` param.

The script must then scrape the file to keep only the content, removing the HTML. If necessary, the result can have minimal Markdown formatting such as headings.

### Process Highlights

The script must then use the Gemini AI API to reorder the highlights into personal notes that are easier to read. I usually use a prompt like this:

> This text contains a list of highlights I copied from a Kindle book. Please parse this content in order to make it more readable. The result should properly formatted, in complete sentences and paragraphs, and with headings when necessary. The actual content (information that the text provides) should remain the same.


### Import highlights to **Notion**

The notes content will be pasted directly onto Notion using the Notion API. I will provide the URL of the correct Notion page in the `NOTION_PAGE_URL` param, along with the authorization token in `NOTION_AUTH_TOKEN`.

### Import notes onto **NotebookLM**

The script must then copy the notes, and add them as a source in NotebookLM. I will provide a link to the correct notebook in the `NOTEBOOKLM_NOTEBOOK_URL` param.

### Create flashcards in **NotebookLM**

Finally, the script must ask NotebookLM to generate flashcards based on the content.
