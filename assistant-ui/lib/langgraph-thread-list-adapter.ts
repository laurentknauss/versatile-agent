import type { Client } from '@langchain/langgraph-sdk';
import type { RemoteThreadListAdapter, ThreadMessage } from '@assistant-ui/react';
import { createAssistantStream, type AssistantStream } from 'assistant-stream';

/**
 * Structural match of `RemoteThreadMetadata` from @assistant-ui/core (not
 * re-exported by @assistant-ui/react). The adapter contract only needs the
 * shape, so we keep the type local.
 */
type LangGraphThreadMetadata = {
  readonly status: 'regular' | 'archived';
  readonly remoteId: string;
  readonly externalId?: string | undefined;
  readonly title?: string | undefined;
  readonly lastMessageAt?: Date | undefined;
  readonly custom?: Record<string, unknown> | undefined;
};

/**
 * Backs the assistant-ui thread list with LangGraph `client.threads.*`
 * endpoints (search / create / get / update / delete), so pre-existing
 * LangGraph thread ids appear in the sidebar and can be switched between
 * without assistant-cloud.
 *
 * Thread titles are read from `metadata.title` when present and otherwise
 * generated locally from the first user message (no LLM call). Renaming and
 * auto-titling persist into `metadata.title` on a best-effort basis.
 *
 * Threads that were created but never written to are left out of the list and
 * swept once they are older than an hour: the sidebar only ever shows
 * conversations holding at least one message.
 */

type LangGraphMetadata = Record<string, unknown> & {
  title?: string;
};

const toMetadata = (thread: {
  thread_id: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown> | null;
}): LangGraphThreadMetadata => ({
  status: 'regular',
  remoteId: thread.thread_id,
  externalId: thread.thread_id,
  title: (thread.metadata as LangGraphMetadata | undefined)?.title,
  lastMessageAt: thread.updated_at ? new Date(thread.updated_at) : undefined,
  custom: {
    createdAt: thread.created_at ?? undefined,
    updatedAt: thread.updated_at ?? undefined,
  },
});

const cleanTitle = (raw: string): string => {
  const singleLine = raw.replace(/\s+/g, ' ').trim();
  return singleLine.length > 60 ? `${singleLine.slice(0, 57).trimEnd()}…` : singleLine;
};

const firstUserText = (messages: readonly ThreadMessage[]): string => {
  const userMessage = messages.find((message) => message.role === 'user');
  if (!userMessage) return '';
  const { content } = userMessage;
  if (typeof content === 'string') return content;
  return (content as Array<{ type?: string; text?: string }>)
    .map((part) => (part.type === 'text' ? (part.text ?? '') : ''))
    .join(' ')
    .trim();
};

/**
 * `client.threads.getState` renvoie les messages au format LangChain
 * (`type: 'human'`) et non au format assistant-ui (`role: 'user'`) : relire un
 * thread depuis l'API demande donc son propre extracteur.
 */
const firstLangChainUserText = (messages: readonly unknown[]): string => {
  const userMessage = messages.find(
    (message): message is { type?: string; content?: unknown } =>
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: string }).type === 'human'
  );
  const content = userMessage?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part: unknown) =>
      typeof part === 'object' && part !== null && (part as { type?: string }).type === 'text'
        ? String((part as { text?: unknown }).text ?? '')
        : ''
    )
    .join(' ')
    .trim();
};

export const createLangGraphThreadListAdapter = (client: Client): RemoteThreadListAdapter => {
  /** Read current metadata and merge a title into it before persisting. */
  const persistTitle = async (remoteId: string, title: string) => {
    try {
      const thread = await client.threads.get(remoteId);
      const metadata = { ...(thread.metadata ?? {}), title };
      await client.threads.update(remoteId, { metadata });
    } catch {
      // Title persistence is best-effort: some LangGraph backends reject
      // metadata updates. The list still shows the locally generated title.
    }
  };

  /**
   * Message count + first question of a thread, in the single `getState` call
   * the list already needs. A thread written to by anything other than this UI
   * (a script, another client) keeps an empty `metadata.title`, so its state is
   * the only place its question exists.
   */
  const readState = async (remoteId: string): Promise<{ messages: number; question: string }> => {
    try {
      const state = await client.threads.getState<{ messages?: readonly unknown[] }>(remoteId);
      const messages = state.values?.['messages'] ?? [];
      return { messages: messages.length, question: firstLangChainUserText(messages) };
    } catch {
      // Unreadable state: never treat it as empty, an error must not delete.
      return { messages: 1, question: '' };
    }
  };

  /** Empty shells older than this are dropped instead of resurrected. */
  const EMPTY_THREAD_TTL_MS = 60 * 60 * 1000;

  const formatFallbackTitle = (createdAt: string | undefined): string =>
    createdAt
      ? `Conversation du ${new Date(createdAt).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : 'Conversation';

  const list = async () => {
    try {
      const threads = await client.threads.search({ limit: 100 });
      const now = Date.now();
      const resolved = await Promise.all(
        threads.map(async (thread) => {
          const metadata = toMetadata(thread);
          // A persisted title means the thread was used: show it as is.
          if (metadata.title) return metadata;

          const state = await readState(thread.thread_id);
          if (state.messages > 0) {
            // A persisted title only comes from this UI's `generateTitle`.
            // Without one, the thread's own first question beats a dated label
            // that every thread created in the same minute would share.
            return {
              ...metadata,
              title: cleanTitle(state.question) || formatFallbackTitle(thread.created_at),
            };
          }

          // Empty shell: hide it, and sweep it away once it is old enough
          // that it cannot be the conversation currently being started.
          const createdAt = thread.created_at ? new Date(thread.created_at).getTime() : now;
          if (now - createdAt > EMPTY_THREAD_TTL_MS) {
            void client.threads.delete(thread.thread_id).catch(() => {});
          }
          return null;
        })
      );
      return {
        threads: resolved.filter((thread): thread is LangGraphThreadMetadata => thread !== null),
      };
    } catch {
      // Backend unreachable (dev server down): keep the UI usable with an
      // empty list instead of failing the thread-list mount.
      return { threads: [] };
    }
  };

  return {
    list,

    async rename(remoteId, newTitle) {
      await persistTitle(remoteId, cleanTitle(newTitle));
    },

    // LangGraph has no archive concept; thread list entries stay "regular".
    async archive() {},
    async unarchive() {},

    async delete(remoteId) {
      await client.threads.delete(remoteId);
    },

    async initialize() {
      const thread = await client.threads.create();
      return { remoteId: thread.thread_id, externalId: thread.thread_id };
    },

    async fetch(threadId) {
      const thread = await client.threads.get(threadId);
      return toMetadata(thread);
    },

    async generateTitle(
      remoteId: string,
      messages: readonly ThreadMessage[]
    ): Promise<AssistantStream> {
      return createAssistantStream(async (controller) => {
        const text = cleanTitle(firstUserText(messages));
        const title = text || `Conversation ${new Date().toLocaleString('fr-FR')}`;
        controller.appendText(title);
        await persistTitle(remoteId, title);
      });
    },
  };
};
