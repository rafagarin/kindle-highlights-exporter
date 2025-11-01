// Notion API integration module

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE = 'https://api.notion.com/v1';

/**
 * Extract database ID from Notion URL
 * @param {string} url - Notion database URL
 * @returns {string|null} Formatted database ID or null
 */
export function extractNotionDatabaseId(url) {
  // Remove query parameters (everything after ?) to ignore view IDs
  // URL formats:
  // https://www.notion.so/29c9f256cc1080b1a0c4f40ca22e0a41
  // https://www.notion.so/29c9f256cc1080b1a0c4f40ca22e0a41?v=29c9f256cc1080179839000cca879d10
  const urlWithoutQuery = url.split('?')[0];
  
  // Extract database ID from Notion URL
  // Format: https://www.notion.so/workspace/database-title-32charid or similar
  const match = urlWithoutQuery.match(/([a-f0-9]{32})$/);
  if (match) {
    const id = match[1];
    // Format as 8-4-4-4-12
    return `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20,32)}`;
  }
  return null;
}

/**
 * Extract page ID from Notion URL
 * @param {string} url - Notion page URL
 * @returns {string|null} Formatted page ID or null
 */
export function extractNotionPageId(url) {
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

/**
 * Get database data source ID and title property name
 * @param {string} databaseId - Database ID
 * @param {string} authToken - Notion API auth token
 * @returns {Promise<{dataSourceId: string|null, titlePropertyName: string, bookNamePropertyName: string|null, bookNamePropertyType: string|null}>}
 */
export async function getDatabaseDataSourceAndTitleProperty(databaseId, authToken) {
  try {
    // First, fetch the database to get its data sources
    const dbResponse = await fetch(`${NOTION_API_BASE}/databases/${databaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_API_VERSION
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
      const dsResponse = await fetch(`${NOTION_API_BASE}/data_sources/${dataSourceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_API_VERSION
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
    
    // Find the "Book Name" property if it exists
    let bookNamePropertyName = null;
    let bookNamePropertyType = null;
    const bookNameVariants = ['Book Name', 'Book', 'Book Title', 'BookName'];
    for (const [propertyName, property] of Object.entries(properties)) {
      if (bookNameVariants.includes(propertyName)) {
        bookNamePropertyName = propertyName;
        bookNamePropertyType = property.type;
        break;
      }
    }
    
    return { dataSourceId, titlePropertyName, bookNamePropertyName, bookNamePropertyType };
  } catch (error) {
    console.error('Error fetching database/data source:', error);
    throw error;
  }
}

/**
 * Convert markdown content to Notion blocks
 * @param {string} markdown - Markdown content
 * @returns {Array} Array of Notion block objects
 */
export function convertMarkdownToNotionBlocks(markdown) {
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

/**
 * Create a page in Notion database
 * @param {string} databaseId - Database ID
 * @param {string|null} dataSourceId - Data source ID (null if using older API)
 * @param {string} titlePropertyName - Name of the title property
 * @param {string} pageTitle - Title for the new page
 * @param {Array} blocks - Content blocks to add
 * @param {string} authToken - Notion API auth token
 * @param {Function} progressCallback - Optional callback for progress updates
 * @param {string|null} bookNamePropertyName - Name of the "Book Name" property (optional)
 * @param {string|null} bookNamePropertyType - Type of the "Book Name" property (optional)
 * @param {string|null} bookName - Book name value to set (optional)
 * @returns {Promise<string>} Created page ID
 */
export async function createPageInDatabase(
  databaseId,
  dataSourceId,
  titlePropertyName,
  pageTitle,
  blocks,
  authToken,
  progressCallback = null,
  bookNamePropertyName = null,
  bookNamePropertyType = null,
  bookName = null
) {
  // Create the page with title and initial content
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
  
  // Add "Book Name" property if it exists and bookName is provided
  if (bookNamePropertyName && bookName && bookNamePropertyType) {
    // Handle different property types for "Book Name" based on the Notion API
    // Reference: https://developers.notion.com/docs/working-with-databases
    if (bookNamePropertyType === 'rich_text') {
      pageData.properties[bookNamePropertyName] = {
        type: "rich_text",
        rich_text: [{
          type: "text",
          text: { content: bookName }
        }]
      };
    } else if (bookNamePropertyType === 'title') {
      pageData.properties[bookNamePropertyName] = {
        type: "title",
        title: [{
          type: "text",
          text: { content: bookName }
        }]
      };
    } else if (bookNamePropertyType === 'select') {
      // If it's a select property, we'd need to match an option
      // For now, we'll skip it and log a warning
      console.warn(`"Book Name" property is of type "select" and cannot be set automatically`);
    } else {
      // For other property types, log a warning
      console.warn(`"Book Name" property type "${bookNamePropertyType}" is not supported yet`);
    }
  }
  
  // Add children (content blocks) if we have any
  if (blocks.length > 0) {
    // Split blocks into chunks of 100 (Notion API limit for children)
    const chunkSize = 100;
    const firstChunk = blocks.slice(0, chunkSize);
    pageData.children = firstChunk;
  }
  
  // Create the page
  if (progressCallback) {
    progressCallback(`Creating page "${pageTitle}"...`);
  }
  
  const createResponse = await fetch(`${NOTION_API_BASE}/pages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION
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
    await addBlocksToPage(pageId, blocks.slice(100), authToken, progressCallback);
  }
  
  return pageId;
}

/**
 * Add blocks to an existing Notion page in batches
 * @param {string} pageId - Page ID
 * @param {Array} blocks - Blocks to add
 * @param {string} authToken - Notion API auth token
 * @param {Function} progressCallback - Optional callback for progress updates
 */
export async function addBlocksToPage(pageId, blocks, authToken, progressCallback = null) {
  const chunkSize = 100;
  const chunks = [];
  for (let i = 0; i < blocks.length; i += chunkSize) {
    chunks.push(blocks.slice(i, i + chunkSize));
  }
  
  if (progressCallback) {
    progressCallback(`Adding remaining ${blocks.length} blocks in ${chunks.length} batches...`);
  }
  
  // Add remaining blocks in batches
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const response = await fetch(`${NOTION_API_BASE}/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_API_VERSION
      },
      body: JSON.stringify({
        children: chunk
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Notion API error: ${errorData.message || response.statusText}`);
    }
    
    if (progressCallback) {
      progressCallback(`Added batch ${i + 1}/${chunks.length} (${chunk.length} blocks)...`);
    }
    
    // Add a small delay between requests to avoid rate limiting
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

