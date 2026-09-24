import { coinGeckoMarketTool, coinGeckoPriceTool } from './geckoTool';
import { openWeatherMapTool } from './weatherTool';
import { ALL_STRIPE_TOOLS } from './stripeTool';
import { randomNumberTool } from './randomNumberTool';
import { currentTimeTool } from './currentTimeTool';
import { tavilySearchTool } from './tavilyTool';
import { tmdbSearchTool } from './movieTool';
import { recallMemoriesTool, saveMemoryTool } from './memoryTools';
import { readPdfTool } from './pdfReader';
import { flightTrackerTool } from './flightTool';
import { airportBoardTool } from './airportBoardTool';
import { aviationLookupTool } from './aviationLookupTool';

export const ALL_TOOLS_LIST = [
  openWeatherMapTool,
  coinGeckoPriceTool,
  coinGeckoMarketTool,
  flightTrackerTool,
  airportBoardTool,
  aviationLookupTool,
  randomNumberTool,
  tmdbSearchTool,
  currentTimeTool,
  tavilySearchTool,
  readPdfTool,
  ...ALL_STRIPE_TOOLS,
  // Long-term memory tools: the agent always gets a store (local MongoDB in dev,
  // remote MongoDB Atlas in production — see agentWithTools.ts).
  saveMemoryTool,
  recallMemoriesTool,
];
