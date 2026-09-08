import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI();

interface AdditionDatasetRow {
  question: string;
  answer: string;
}

const AdditionEvaluationSchema = z.object({
  score: z
    .number()
    .describe("Score de 1 à 10. 10 si le résultat mathématique et le raisonnement sont exacts, 1 si c'est totalement faux."),
  reasoning: z
    .string()
    .describe("Brève explication de la note attribuée."),
});

async function evaluateAdditionResult(
  inputQuestion: string,
  referenceAnswer: string,
  modelOutput: string
) {
  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini-2025-04-14",
    messages: [
      {
        role: "system",
        content:
          "Tu es un évaluateur d'opérations mathématiques et d'additions. " +
          "Compare la réponse générée par l'IA (Model Output) avec la réponse de référence (Reference Answer) " +
          "pour la question donnée. Valide si le résultat calculé est mathématiquement correct et pertinent. " +
          "Donne une note de 1 à 10 et explique brièvement ta décision. Réponds en JSON avec les clés score et reasoning.",
      },
      {
        role: "user",
        content: `Question: ${inputQuestion}\nRéponse de référence: ${referenceAnswer}\nRéponse du modèle: ${modelOutput}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "addition_evaluation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            score: { type: "number", description: "Score de 1 à 10" },
            reasoning: { type: "string", description: "Explication de la note" },
          },
          required: ["score", "reasoning"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error("Empty response from judge");

  const parsed = JSON.parse(content);

  return {
    key: "addition_accuracy",
    score: parsed.score,
    reasoning: parsed.reasoning,
  };
}

function loadGoldenDataset(filePath: string): AdditionDatasetRow[] {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return records as AdditionDatasetRow[];
}

// ---------------------------------------------------------------------------
// Appelle ton vrai agent LangGraph via l'API HTTP
// ---------------------------------------------------------------------------
async function callLangGraphAgent(question: string): Promise<string> {
  // Create a thread and run it
  const createRes = await fetch("http://localhost:2024/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assistant_id: "agent",
      input: {
        messages: [{ role: "user", content: question }],
      },
    }),
  });

  if (!createRes.ok) {
    return `Erreur API: ${createRes.status}`;
  }

  const run = await createRes.json();
  const threadId = run.thread_id;

  if (!threadId) {
    return "Pas de réponse (pas de thread)";
  }

  const startTime = Date.now();
  const timeoutMs = 30000; // 30 secondes max d'attente

  while (Date.now() - startTime < timeoutMs) {
    const stateRes = await fetch(`http://localhost:2024/threads/${threadId}/state?wait=5`, {
      method: "GET",
    });

    if (!stateRes.ok) {
      return `Erreur state: ${stateRes.status}`;
    }

    const state = await stateRes.json();
    const messages = state.values?.messages ?? [];
    const lastMsg = messages[messages.length - 1];

    if (typeof lastMsg === "string") return lastMsg;
    if (lastMsg?.content) return String(lastMsg.content);

    // Attente courte avant de re-poller
    await new Promise((r) => setTimeout(r, 500));
  }

  return "Timeout: Pas de réponse après 30 secondes";
}

// ---------------------------------------------------------------------------
// Exécution de l'évaluation
// ---------------------------------------------------------------------------
async function main() {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const datasetPath = path.join(__dirname, "additionTool_dataset.csv");
  const dataset = loadGoldenDataset(datasetPath);

  console.log(`Dataset chargé : ${dataset.length} exemples trouvés.\n`);

  for (let i = 0; i < dataset.length; i++) {
    const row = dataset[i];

    console.log(`--- Test ${i + 1}/${dataset.length} ---`);
    console.log(`Question  : ${row.question}`);

    // Appel réel à ton agent LangGraph
    const modelOutput = await callLangGraphAgent(row.question);
    console.log(`Généré    : ${modelOutput}`);
    console.log(`Attendu   : ${row.answer}`);

    const evalResult = await evaluateAdditionResult(
      row.question,
      row.answer,
      modelOutput
    );

    console.log(`Score     : ${evalResult.score}/10`);
    console.log(`Raison    : ${evalResult.reasoning}\n`);
  }
}

main().catch(console.error);