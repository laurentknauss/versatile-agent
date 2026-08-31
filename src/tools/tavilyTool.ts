import { tool } from '@langchain/core/tools';
import { TavilySearch } from '@langchain/tavily';
import { z } from 'zod';

const apiKey = process.env.TAVILY_API_KEY;

if (!apiKey) {
  throw new Error("TAVILY_API_KEY is not defined. Please set it in your environment variables.");
}

const tavily = new TavilySearch({
  tavilyApiKey: apiKey,
  maxResults: 3,
});

const tavilyFunc = async ({ query }: { query: string }) => {
  return await tavily.invoke({ query });
};

export const tavilySearchTool = tool(tavilyFunc, {
  name: "tavilySearch",
  description: "Recherche web via Tavily",
  schema: z.object({
    query: z.string().describe("Texte de recherche"),
  }),
});