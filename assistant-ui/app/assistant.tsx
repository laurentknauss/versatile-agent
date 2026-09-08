"use client";

import { useMemo } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  unstable_createLangGraphStream,
  useLangGraphRuntime,
  type LangChainMessage,
} from "@assistant-ui/react-langgraph";
import { ChatGPT } from "@/components/examples/chatgpt";
import { createClient } from "@/lib/chatApi";
import { createLangGraphThreadListAdapter } from "@/lib/langgraph-thread-list-adapter";

const ASSISTANT_ID = process.env["NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID"]!;

export function Assistant() {
  const client = useMemo(() => createClient(), []);
  const stream = useMemo(
    () =>
      unstable_createLangGraphStream({
        client,
        assistantId: ASSISTANT_ID,
      }),
    [client],
  );
  const threadListAdapter = useMemo(
    () => createLangGraphThreadListAdapter(client),
    [client],
  );

  const runtime = useLangGraphRuntime({
    unstable_allowCancellation: true,
    stream,
    create: async () => {
      const { thread_id } = await client.threads.create();
      return { externalId: thread_id };
    },
    load: async (externalId) => {
      const state = await client.threads.getState<{
        messages: LangChainMessage[];
      }>(externalId);
      return {
        messages: state.values.messages,
      };
    },
    // Owns the sidebar thread list: list/create/delete/title all go through
    // the LangGraph client (the `create` and `delete` options above are
    // ignored while this adapter is set).
    unstable_threadListAdapter: threadListAdapter,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatGPT />
    </AssistantRuntimeProvider>
  );
}