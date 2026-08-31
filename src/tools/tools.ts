import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import { coinGeckoMarketTool, coinGeckoPriceTool } from './geckoTool';
import { openWeatherMapTool } from './weatherTool';
import { ALL_STRIPE_TOOLS } from './stripeTool';
import { randomNumberTool } from './randomNumberTool';
import { tavilySearchTool } from './tavilyTool';

const additionFunc = async ({ a, b }: { a: number; b: number }) => {
  return (a + b).toString();
};

export const additionTool = tool(additionFunc, {
  name: "additionTool",
  description: "Adds two numbers together.",
  schema: z.object({
    a: z.number().describe("The first number to add."),
    b: z.number().describe("The second number to add."),
  }),
});

const currentTimeFunc = async () => {
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

export const currentTimeTool = tool(currentTimeFunc, {
  name: "currentTime",
  description: "Returns the current local time in HH:MM:SS format.",
  schema: z.object({}),
});

export const ALL_TOOLS_LIST = [
  openWeatherMapTool,
  coinGeckoPriceTool,
  coinGeckoMarketTool,
  additionTool,
  randomNumberTool,
  currentTimeTool,
  tavilySearchTool,
  ...ALL_STRIPE_TOOLS,
];