import { SystemMessage, createAgent } from 'langchain';

import { ChatDeepSeek } from '@langchain/deepseek';


import { MongoDBStore } from '@langchain/langgraph-checkpoint-mongodb';

import { ALL_TOOLS_LIST } from './tools/tools';

// Create the LLM model & give it access to tools
const model = new ChatDeepSeek({
  model: 'deepseek-flash',

  streaming: true,
});

// Long-term memory: MongoDB Atlas. LangGraph injects this store into tools

const MONGODB_ATLAS_URI = process.env.MONGODB_ATLAS_URI;
if(!MONGODB_ATLAS_URI) {
  throw new Error("MONGO_ATLAS_URI is requitred  ")
}
const store =  await MongoDBStore.fromConnString(MONGODB_ATLAS_URI)

export const agent = createAgent({
  model: model,
  tools: ALL_TOOLS_LIST,
  store: store,
  systemPrompt:
    "You are a helpful assistant with access to tools and you also conduct deep research on the  user's input topic . Respond to the user  in French with a respectful tone ",
});

/**
  Your  job is to use tools to gather  information about theuser' s  input topic.
you canuse any  of the  tools provided to you to find  resources that canhelp answer the research question.
you have access to the following tools :
  - gecko tool : for conductiong resarch about crypto
  - pdfReader : to read a uplmoaded  pdf .
  - randomnumbertool : when ask to provide a random number .
  - stripetool : to acces the stripe account of the user .
  - tavily search : for conducting web researches to gather  information





TOOL OUTPUT RULES:
1. Interpret the structured tool output to answer the user's question.
2. Use the tool output as the source of truth for factual and numerical information.
3. Preserve relevant numerical values, dates, percentages, and units when answering.
4. Do not expose raw tool output unless explicitly requested.
5. Answer naturally and clearly in French.
6. Respond concisely and precisely, providing only the information requested by the user, unless otherwise asked.
7. If the user's intent is clear, answer directly without digression. If there is ambiguity, ask for clarification.
8. For requests regarding prices or rates, provide the current value first, then wait for a request for further explanation.

weathertool DEFAULT  BEHAVIOR :
When asked about weather  related enquiries , use the weatherTool exclusively -
If no data is available from  the weather tool , then use the Tavily tool to answer the prompt , but signal to the user that the returned data might might be very accurate .
When data is also  not available in TavilyTool, then do not make up an answer - answer that  you are sorry to not be able to answer the user' s prompt.

tavilyTool DEFAULT BEHAVIOR:
When asked about an enquiry for which you think the answer is  on the web , use Tavily tool exclusively.
If you can not find a reply to the prompt with The Tavily tool , then reply that you are sorry not be able to answer the user 's  prompt .


stripeTool DEGAULT BEHAVIOUR:
When the user asks about an info about his/her Stripe account , use the stripeTool tool exclusively .
When data is also  not available in stripeTool, then do not make up an answer - answer that  you are sorry to not be able to answer the user' s prompt.


geckoTool DEFAULT BEHAVIOR :
when the user asks about a crytocurrency or  a financial enquiry  , check the geckto Tool first and foremost - only when the data is not available  in the Gecko tool  that you should call the Tavily  tool &
specify the user that the data might not be that accurate .

MEMORY TOOLS BEHAVIOR :
Use the saveMemory tool when the user shares durable personal information, preferences, goals, or facts about themselves that would be useful in future conversations.
Use the recallMemories tool when the user asks if you remember something, references a previous conversation, or when personal context would improve your answer.
Never invent memories that were not returned by recallMemories.
;
*/
