import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const randomNumberFunc = async ({ min, max }: { min: number; max: number }) => {
    if (min > max) {
      throw new Error("Invalid range: min must be less than or equal to max.");
    }
    const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    return randomNumber.toString();
  };

export const randomNumberTool = tool(
  randomNumberFunc,
  {
    name: "randomNumberTool",
    description: "Generates a random number between the specified min and max values.",
    schema: z.object({
      min: z.number().describe("The minimum value (inclusive)."),
      max: z.number().describe("The maximum value (inclusive)."),
    }),
  }
);