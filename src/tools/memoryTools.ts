import { tool, type ToolRuntime } from '@langchain/core/tools';
import { BaseStore as LangGraphBaseStore } from '@langchain/langgraph';
import { z } from 'zod';

/**
 * Long-term memory tools backed by LangGraph's `BaseStore` (MongoDB Atlas).
 *
 * LangGraph injects the graph's `store` into every tool executed by a
 * `ToolNode` as the second `runtime` argument (`runtime.store`), so these
 * tools need no reference to the store — they only work when the compiled
 * graph was given a `store` (see agentWithTools.ts).
 *
 * Memories are namespaced per user when `config.configurable.userId` is set,
 * otherwise stored under the "default" user.
 */

const memoryNamespace = (runtime: ToolRuntime<unknown, unknown>): string[] => {
  const userId = (runtime.config.configurable as { userId?: string } | undefined)?.userId;
  return ['memories', userId ?? 'default'];
};

const SaveMemorySchema = z.object({
  memory: z
    .string()
    .describe(
      'The durable fact or user preference to remember across conversations, written as a short statement (e.g. "User prefers concise French answers").'
    ),
  topic: z
    .string()
    .optional()
    .describe(
      'Optional topic/category to group the memory under (e.g. "preferences", "project", "health"). Defaults to "general".'
    ),
});

export const saveMemoryTool = tool(
  async (
    { memory, topic }: z.infer<typeof SaveMemorySchema>,
    runtime: ToolRuntime<unknown, unknown>
  ) => {
    if (!runtime.store) {
      return 'Long-term memory is not configured (no store attached). Do not retry.';
    }
    // @langchain/core types ToolRuntime.store with its own KV BaseStore, but
    // the LangGraph ToolNode injects the graph's store (namespace + put/search).
    const store = runtime.store as unknown as LangGraphBaseStore;
    const namespace = [...memoryNamespace(runtime), topic ?? 'general'];
    const key = crypto.randomUUID();
    await store.put(namespace, key, { memory, topic: topic ?? 'general' }, ['memory']);
    return `Memory saved under "${topic ?? 'general'}".`;
  },
  {
    name: 'saveMemory',
    description:
      'Save a durable fact or user preference to long-term memory so it can be recalled in future conversations. Call when the user shares personal information, preferences, or facts worth remembering.',
    schema: SaveMemorySchema,
  }
);

const RecallMemoriesSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      'What the user wants to remember, as a natural-language query. Omit to list the most recent memories.'
    ),
  limit: z.number().optional().describe('Maximum number of memories to return. Defaults to 20.'),
});

export const recallMemoriesTool = tool(
  async (
    { query, limit = 20 }: z.infer<typeof RecallMemoriesSchema>,
    runtime: ToolRuntime<unknown, unknown>
  ) => {
    if (!runtime.store) {
      return 'Long-term memory is not configured (no store attached). Do not retry.';
    }
    const store = runtime.store as unknown as LangGraphBaseStore;
    const namespace = memoryNamespace(runtime);

    let items;
    try {
      // Semantic search when the store was configured with embeddings.
      items = await store.search(namespace, {
        ...(query ? { query } : {}),
        limit,
      });
    } catch {
      // No vector index configured: fall back to an unscoped listing.
      items = await store.search(namespace, { limit });
    }

    if (items.length === 0) {
      return 'No memories found for this user.';
    }
    return items
      .slice()
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((item, i) => {
        const memory = item.value.memory as string;
        const topic = item.value.topic as string | undefined;
        const when = item.updatedAt.toISOString().slice(0, 10);
        return `${i + 1}. [${topic ?? 'general'}] (${when}) ${memory}`;
      })
      .join('\n');
  },
  {
    name: 'recallMemories',
    description:
      'Recall facts and preferences previously saved to long-term memory. Call when the user asks "do you remember", references a past conversation, or when personal context would help answer.',
    schema: RecallMemoriesSchema,
  }
);
