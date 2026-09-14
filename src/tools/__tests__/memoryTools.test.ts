import { AIMessage, type ToolMessage } from '@langchain/core/messages';
import { InMemoryStore, type LangGraphRunnableConfig } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { describe, expect, it } from 'vitest';

import { recallMemoriesTool, saveMemoryTool } from '../memoryTools';

/**
 * The memory tools read the graph's store and the caller identity from the
 * `ToolRuntime` that LangGraph injects (see ToolNode). These tests exercise
 * that real injection path with an in-memory store: no MongoDB, no model.
 */

type RunConfig = { store?: InMemoryStore; userId?: string };

const node = new ToolNode([saveMemoryTool, recallMemoriesTool]);

const NOT_CONFIGURED = 'Long-term memory is not configured (no store attached). Do not retry.';

const runTool = async (
  name: string,
  args: Record<string, unknown>,
  config: RunConfig = {}
): Promise<string> => {
  const toolCall = new AIMessage({
    content: '',
    tool_calls: [{ name, args, id: 'call-1', type: 'tool_call' }],
  });

  const runConfig: LangGraphRunnableConfig = {
    store: config.store,
    configurable: config.userId ? { userId: config.userId } : {},
  };

  const result = await node.invoke({ messages: [toolCall] }, runConfig);

  const message = result.messages[0] as ToolMessage;
  return typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
};

const save = (memory: string, config: RunConfig = {}, topic?: string) =>
  runTool('saveMemory', topic ? { memory, topic } : { memory }, config);

const recall = (config: RunConfig = {}, args: Record<string, unknown> = {}) =>
  runTool('recallMemories', args, config);

describe('memory tools — round trip', () => {
  it('gives a saved memory back to the same user, with its topic and date', async () => {
    const store = new InMemoryStore();

    expect(
      await save('User collects silver coins', { store, userId: 'alice' }, 'preferences')
    ).toBe('Memory saved under "preferences".');

    const recalled = await recall({ store, userId: 'alice' });
    expect(recalled).toContain('User collects silver coins');
    expect(recalled).toContain('[preferences]');
    expect(recalled).toContain(new Date().toISOString().slice(0, 10));
  });

  it('files memories saved without a topic under "general"', async () => {
    const store = new InMemoryStore();

    await save('User lives in Paris', { store, userId: 'alice' });

    expect(await recall({ store, userId: 'alice' })).toContain('[general]');
  });

  it('still recalls when the query carries a semantic search string', async () => {
    const store = new InMemoryStore();

    await save('User collects silver coins', { store, userId: 'alice' });

    const recalled = await recall({ store, userId: 'alice' }, { query: 'what does he collect?' });
    expect(recalled).toContain('silver coins');
    expect(recalled).not.toBe('No memories found for this user.');
  });

  it('reports an empty memory instead of failing when nothing was saved', async () => {
    expect(await recall({ store: new InMemoryStore(), userId: 'alice' })).toBe(
      'No memories found for this user.'
    );
  });
});

describe('memory tools — user isolation', () => {
  it('never exposes one user memories to another', async () => {
    const store = new InMemoryStore();

    await save('User collects silver coins', { store, userId: 'alice' });

    expect(await recall({ store, userId: 'bob' })).toBe('No memories found for this user.');
  });

  it('keeps runs without a userId out of named users memories', async () => {
    const store = new InMemoryStore();

    await save('Anonymous fact', { store });

    expect(await recall({ store, userId: 'alice' })).toBe('No memories found for this user.');
    expect(await recall({ store })).toContain('Anonymous fact');
  });
});

describe('memory tools — no store attached', () => {
  it('tells the model not to retry, on save as well as on recall', async () => {
    expect(await save('User collects silver coins', { userId: 'alice' })).toBe(NOT_CONFIGURED);
    expect(await recall({ userId: 'alice' })).toBe(NOT_CONFIGURED);
  });
});
