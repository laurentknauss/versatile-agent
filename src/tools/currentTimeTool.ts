import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const currentTimeFunc = async () => {
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

export const currentTimeTool = tool(currentTimeFunc, {
  name: 'currentTime',
  description: 'Returns the current local time in HH:MM:SS format.',
  schema: z.object({}),
});
