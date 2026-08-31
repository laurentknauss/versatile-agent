

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import pdf from 'pdf-parse';
import fetch from 'node-fetch';
import * as fs from 'fs/promises';

// Defining the schema for the tool's input arguments using zod
const pdfInputSchema = z.object({
  source: z.string().describe("The local file path or the URL of the PDF document"),
  pages: z.array(z.number()).optional().describe("An optional array of page numbers to extract text from"),
  query: z.string().optional().describe("An optional keyword or phrase to search for within the PDF content"),
  contextWindow: z.number().optional().describe("The number of characters before and after a keyword match to include for context")
});

/**
 * An asynchronous function that reads a PDF from a URL (directly) or a local path,
 * extracts text content, and returns it as a string. If a query is provided,
 * it searches the content and returns relevant snippets with context.
 * 
 * @param {string} source - The URL or file path of the PDF
 * @param {number[]} [pages] - Optional array of page numbers to process 
 * @param {string} [query] - Optional keyword or phrases to search for 
 * @param {number} [contextWindow] - Optional number of characters for context 
 * @returns {Promise<string>} - A promise resolving to a JSON string with the extracted text or search results
 */
async function readPDFContent({ source, pages, query, contextWindow = 200 }: z.infer<typeof pdfInputSchema>): Promise<string> {
  try {
    let pdfBuffer: Buffer; // This variable will hold the binary content 

    // Step 1: Obtain the PDF's binary content (buffer) 
    // Check if the 'source' is a URL (starts with 'http') or a local file path
    if (source.startsWith('http')) {
      // Scenario A: PDF is located at an external URL
      const response = await fetch(source); // Use node-fetch to make an HTTP GET request to the URL
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF from URL: ${response.statusText}`);
      }
      // Get the response body as a standard JS ArrayBuffer (raw binary data)  
      const arrayBuffer = await response.arrayBuffer();
      // Convert the arrayBuffer into a Node.js buffer, which 'pdf-parse' expects
      pdfBuffer = Buffer.from(arrayBuffer);
    } else {
      // Scenario B: PDF is a local file on the backend server
      // Since this code runs on a Node.js backend, 'fs.readFile()' can safely access local files
      pdfBuffer = await fs.readFile(source); // Read the local file content into a Node.js buffer
    }

    // Step 2: Configure PDF parsing options 
    const options = {
      // 'max' tells pdf-parse the last page to consider
      // If specific pages are requested, it is the maximum page number among them, 0 meaning process all 
      max: pages ? Math.max(...pages) : 0,
      // Fixed: pagerender (not pageRender)
      pagerender: pages ? (pageData: any) => {
        if (pages.includes(pageData.meta.num)) {
          return pageData.getTextContent(); // Get the text content for the specified page
        }
        return "";
      } : undefined,
    };

    // Step 3: Parse the PDF content
    const data = await pdf(pdfBuffer, options);
    const fullText = data.text.trim();

    // Step 4: Perform keyword search (if a query is provided)
    if (query) {
      // Scenario A: Search query was provided 
      const searchResults: { page?: number; snippet: string; }[] = []; // Array to store all found snippets
      // Create a case-insensitive, global regular expression for the query 
      const regex = new RegExp(query, 'gi');
      let match;

      // Fixed: Proper null check for match
      while ((match = regex.exec(fullText)) !== null) {
        // Calculate the start and end indices for the snippet to include context
        // 'contextWindow' characters before and after the match
        const startIndex = Math.max(0, match.index - contextWindow);
        const endIndex = Math.min(fullText.length, match.index + match[0].length + contextWindow);
        let snippet = fullText.substring(startIndex, endIndex); // Extract the snippet

        // (Optional) Highlight the matched keyword in the snippet using Markdown bold syntax
        // This makes the result easier to read for humans or interpret by an LLM
        snippet = snippet.replace(new RegExp(query, 'gi'), (matched) => `**${matched}**`);

        searchResults.push({ snippet }); // Add the extracted snippet to the results array
        // NOTE: 'page' is undefined here because determining the precise page number from 'fullText'
        // (which is a concatenated string) for each snippet is not straightforward with this setup
        // A more advanced approach would involve parsing page-by-page and tracking offsets
      }

      // Return Search Results
      if (searchResults.length > 0) {
        return JSON.stringify({
          success: true, // Indicate successful operation
          results: searchResults, // The array of snippets found
          totalPages: data.numpages, // Total pages in the PDF
          message: `Found ${searchResults.length} occurrences for "${query}". Note: Page numbers are not precise for snippets from the full document text.`,
        });
      } else {
        return JSON.stringify({
          success: true, // Indicate successful operation (no error, just no matches)
          results: [], // Empty array as no matches were found
          totalPages: data.numpages,
          message: `No occurrences found for "${query}".`,
        });
      }
    } else {
      // Scenario B: No search 'query' was provided
      // Return Full Text
      return JSON.stringify({
        success: true,
        text: fullText, // Return the entire extracted text of the PDF
        totalPages: data.numpages,
      });
    }
  } catch (error) {
    // Error Handling
    // If any part of the process fails (fetching, reading, parsing), catch the error
    console.error("Failed to read or process PDF:", error); // Log the error for debugging
    return JSON.stringify({
      success: false, // Indicate failure
      error: (error as Error).message || "The PDF could not be read. It may be corrupt or the path/URL is incorrect.", // Return a user-friendly error message
    });
  }
}

// LangChain Tool Export
export const readPdfTool = tool(
  readPDFContent, // The function to be executed when the tool is called
  {
    name: "read_pdf", // The name the AI agent will use to refer to this tool
    description: "Reads and extracts text from a PDF document specified by a URL or local file path. Can target specific pages or search for keywords within the document, returning relevant snippets with context.", // A detailed description for the AI agent to understand the tool's capabilities
    schema: pdfInputSchema, // The Zod schema defining the tool's input arguments
  }
);