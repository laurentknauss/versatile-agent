import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { MongoDBStore } from '@langchain/langgraph-checkpoint-mongodb';
import { createAgent } from 'langchain';
// ⚠️ Modération de contenu désactivée le 2026-09-24 (crédits OpenAI épuisés) — le hook
// appelait omni-moderation-latest à CHAQUE appel modèle, donc une clé OpenAI sans crédit
// faisait échouer tout run en 401 avant la moindre réponse. Voir le bloc plus bas.
// import { createMiddleware, type BuiltInState, AIMessage } from 'langchain';
// import OpenAI from 'openai'; // important pour la moderation beforeHook avec omni-moderation-latest
import { ALL_TOOLS_LIST } from './tools/tools';

const SYSTEM_PROMPT = `
GENERAL BEHAVIOR:
- You are a helpful assistant with access to tools and web research capabilities.
- LANGUE — Réponds UNIQUEMENT en français, dès le premier mot du premier message, y compris
  la phrase courte qui annonce un appel d'outil (« Je vérifie… », « Je regarde… »).
  Aucun mot anglais : ni préambule anglais, ni ligne de statut en anglais, ni terme anglais
  isolé dans une réponse par ailleurs française.
- Ton : respectueux, professionnel, concis.
- Generative UI : quatre outils affichent déjà leur propre carte à l'écran (openWeatherMap —
  météo, flightTracker — vol, airportBoard — aéroport, tmdbSearch — cinéma). Quand l'un d'eux
  répond, le texte ne récapitule RIEN de ce que la carte montre déjà : au plus une phrase de
  commentaire, ou une précision absente de la carte.
- Answer directly when the user's intent is clear.
- If the request is ambiguous, ask for clarification.
- Never invent facts, tool results, prices, dates, or account information.
- Treat tool output as the source of truth for factual and numerical information.

TOOL OUTPUT RULES:
1. Interpret structured tool output before answering.
2. Preserve relevant numerical values, dates, percentages, and units — sauf quand une carte
   Generative UI affiche déjà ces valeurs : dans ce cas, ne les répète pas.
3. Do not expose raw tool output unless explicitly requested.
4. Present information naturally and clearly in French.
5. For prices or rates, provide the current value first, then explain further if useful or requested.
6. Four tools already render their own card in the interface (Generative UI): openWeatherMap
   (weather), flightTracker (flight), airportBoard (airport board) and tmdbSearch (movie).
   When one of them has answered, do NOT repeat the values its card already displays
   (temperatures, precipitation, altitude, speed, terminals, times, rating, release date…):
   add at most one short sentence of commentary, or an information the card does not show.

WEATHER:
- For weather-related requests, use the weather tool first.
- If the weather tool cannot provide the required information, use Tavily as a fallback and clearly indicate that the data may be less accurate or current.
- If neither source can provide the information, do not guess; explain that you cannot reliably answer.

WEB RESEARCH:
- For questions requiring current or web-based information, use Tavily.
- Do not fabricate information when web research is unavailable or inconclusive.
- Distinguish clearly between reliable information and fallback results.

CRYPTOCURRENCY AND FINANCIAL INFORMATION:
- For cryptocurrency or financial market data, use the CoinGecko tool first when applicable.
- If the required information is unavailable from CoinGecko, use Tavily as a fallback and indicate that the fallback data may be less reliable or current.
- Never invent financial data.

STRIPE:
- For questions about the user's Stripe account, use the Stripe tools exclusively.
- Do not answer with general knowledge when actual account data is required.
- If the Stripe tools cannot provide the requested information, do not guess.

LONG-TERM MEMORY:
- Use saveMemory when the user shares durable personal information, preferences, goals, or facts that would be useful in future conversations.
- Use recallMemories when the user asks whether you remember something, refers to a previous conversation, or when relevant personal context would materially improve the answer.
- Only information returned by recallMemories may be treated as remembered information.
- Never invent memories.
- Do not save temporary or irrelevant conversational details.
- Do not expose the internal memory mechanism unless the user asks about it.

PDF DOCUMENTS:
- A message may contain a line like "[document importé : data/uploads/xxx.pdf]": that is a PDF the user just uploaded from the chat interface. Call readPdf with that exact path as "source" immediately, without asking for a path or a URL.
- Use readPdf to read a PDF from an http(s) URL or a local file path; local paths must sit in an allowed directory.
- Pass "pages" when the user names pages, and "query" to locate a keyword instead of pulling the whole text.
- Mention the page number when the answer depends on where something appears in the document.
- If the text comes back truncated or a path is refused, say so plainly and suggest how to narrow the request.

RESEARCH:
- Use the available specialized tools whenever they are appropriate.
- Prefer specialized tools over general web research when a specialized source exists.
- When research is necessary, gather enough information to answer accurately, but remain concise.

ERROR HANDLING:
- If a tool fails or cannot provide reliable information, briefly explain the limitation.
- Never fabricate a result to compensate for a tool failure.
- Do not expose internal stack traces or implementation details unless explicitly requested.
`;

/*
 * ⚠️ MODÉRATION DE CONTENU DÉSACTIVÉE — 2026-09-24 (crédits OpenAI épuisés).
 * Ce hook appelait `omni-moderation-latest` à CHAQUE appel modèle : avec une clé OpenAI
 * invalide ou sans crédit, le run mourait en 401 avant la moindre réponse, d'où un
 * chatbot qui ne réagissait plus du tout. À décommenter (avec les imports associés
 * ci-dessus et la ligne `middleware:` en bas du fichier) quand la modération revient.
 *
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const moderationMiddleware = createMiddleware({
  name: 'OpenAIModeration',

  beforeModel: {
    hook: async (state: BuiltInState) => {
      const lastMessage = state.messages.at(-1);

      const input = typeof lastMessage?.content === 'string' ? lastMessage.content : '';

      if (!input) return;

      const moderation = await openai.moderations.create({
        model: 'omni-moderation-latest',
        input,
      });

      if (moderation.results[0]?.flagged) {
        // Refus conversationnel : le run se termine proprement avec un message
        // assistant visible dans le fil (au lieu d'une erreur de run brute).
        return {
          messages: [
            new AIMessage(
              'Désolé, votre demande a été bloquée par la politique de modération de contenu.'
            ),
          ],
          jumpTo: 'end',
        };
      }
    },
    canJumpTo: ['end'],
  },
});
*/

// Model registry — switch provider at launch with CHAT_MODEL (default: deepseek).
// CHAT_MODEL=kimi pnpm dev  →  run on Kimi (Moonshot, OpenAI-compatible API)
const MODEL_REGISTRY = {
  deepseek: () => new ChatDeepSeek({ model: 'deepseek-flash', streaming: true }),
  kimi: () =>
    new ChatOpenAI({
      // ⚠️ nom de modèle à confirmer chez Moonshot
      model: 'kimi-k3',
      apiKey: process.env.MOONSHOT_API_KEY,
      configuration: { baseURL: 'https://api.moonshot.ai/v1' },
      streaming: true,
    }),
} satisfies Record<string, () => BaseChatModel>;

type ModelKey = keyof typeof MODEL_REGISTRY;

const modelKey = (process.env.CHAT_MODEL ?? 'deepseek') as ModelKey;
if (!(modelKey in MODEL_REGISTRY)) {
  throw new Error(
    `Unknown CHAT_MODEL "${modelKey}" — expected: ${Object.keys(MODEL_REGISTRY).join(', ')}`
  );
}

const model = MODEL_REGISTRY[modelKey]();

// Long-term memory store (LangGraph BaseStore).
//
// LOCAL (développement) — MongoDB dans Docker avec volume persistant :
//   docker run -d --name mongo-local -p 27017:27017 \
//     -v mongo-local-data:/data/db --restart unless-stopped mongo:7
// La base et les index sont créés automatiquement par fromConnString().
//
// PRODUCTION — un cluster MongoDB Atlas **remote** est obligatoire (le graphe ne
// doit pas dépendre d'une base qui n'existe que sur la machine de dev).
// Renseigner MONGODB_ATLAS_URI, puis réactiver le bloc ci-dessous :
//
// const MONGODB_ATLAS_URI = process.env.MONGODB_ATLAS_URI;
// if (!MONGODB_ATLAS_URI) {
//   throw new Error('MONGODB_ATLAS_URI is required');
// }
// const store = await MongoDBStore.fromConnString(applyMongoTimeouts(MONGODB_ATLAS_URI), { dbName: 'langgraph' });

// Délais du driver. `fromConnString()` fait un `new MongoClient(connString)` **sans
// options** : la chaîne de connexion est le seul levier. Défauts du driver :
// selection/connect 30 s, et `socketTimeoutMS: 0` — une socket figée ne lâche jamais.
const MONGODB_TIMEOUT_MS = Number(process.env.MONGODB_TIMEOUT_MS ?? 5_000);
const MONGODB_SOCKET_TIMEOUT_MS = Number(process.env.MONGODB_SOCKET_TIMEOUT_MS ?? 20_000);

/**
 * Ajoute les délais manquants à une chaîne de connexion.
 * Le driver refuse un doublon (`URI option "x" cannot appear more than once`) :
 * une valeur déjà présente dans l'URI gagne et n'est pas réécrite.
 */
function applyMongoTimeouts(uri: string): string {
  const missing = (
    [
      ['serverSelectionTimeoutMS', MONGODB_TIMEOUT_MS],
      ['connectTimeoutMS', MONGODB_TIMEOUT_MS],
      ['socketTimeoutMS', MONGODB_SOCKET_TIMEOUT_MS],
    ] as const
  )
    .filter(([option]) => !uri.includes(`${option}=`))
    .map(([option, value]) => `${option}=${value}`)
    .join('&');

  if (!missing) return uri;

  return `${uri}${uri.includes('?') ? '&' : '?'}${missing}`;
}

const MONGODB_LOCAL_URI = applyMongoTimeouts(
  process.env.MONGODB_LOCAL_URI ?? 'mongodb://127.0.0.1:27017/?directConnection=true'
);

const store = await MongoDBStore.fromConnString(MONGODB_LOCAL_URI, { dbName: 'langgraph' });

export const agent = createAgent({
  model,
  tools: ALL_TOOLS_LIST,
  store,
  systemPrompt: SYSTEM_PROMPT,
  // middleware: [moderationMiddleware], // désactivé avec la modération de contenu (voir plus haut)
});
