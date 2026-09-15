import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import fetch from 'node-fetch';
import { readFile, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { resolve, sep } from 'path';
import { getDocumentProxy } from 'unpdf';

// ---------------------------------------------------------------------------
// Garde-fous (surchargeables par variables d'environnement)
// ---------------------------------------------------------------------------

/** Racines autorisées pour les lectures locales (séparées par ':'). Défaut : cwd + /tmp. */
const ALLOWED_ROOTS = (process.env.PDF_ALLOWED_DIRS ?? `${process.cwd()}:${tmpdir()}`)
  .split(':')
  .map((dir) => dir.trim())
  .filter(Boolean)
  .map((dir) => resolve(dir));

/** Taille maximale acceptée, fichier local comme téléchargement. */
const MAX_BYTES = Number(process.env.PDF_MAX_BYTES ?? 25 * 1024 * 1024);

/** Délai maximal de téléchargement d'un PDF distant. */
const FETCH_TIMEOUT_MS = Number(process.env.PDF_FETCH_TIMEOUT_MS ?? 15_000);

/** Budget de caractères rendus au modèle pour le texte intégral. */
const MAX_CHARS = Number(process.env.PDF_MAX_CHARS ?? 40_000);

/** Nombre maximal d'extraits renvoyés pour une recherche par mot-clé. */
const MAX_MATCHES = 20;

/** Contexte par défaut autour d'une occurrence, en caractères. */
const DEFAULT_CONTEXT_WINDOW = 120;

/** Erreur destinée à l'utilisateur : son message est renvoyé tel quel. */
class PdfToolError extends Error {}

// ---------------------------------------------------------------------------
// Schéma des arguments
// ---------------------------------------------------------------------------

const pdfInputSchema = z.object({
  source: z
    .string()
    .min(1)
    .describe('URL http(s) du PDF, ou chemin local (relatif ou absolu) du fichier'),
  pages: z
    .array(z.number().int().min(1))
    .optional()
    .describe('Pages à extraire (numérotation à partir de 1). Omettre pour tout le document'),
  query: z
    .string()
    .optional()
    .describe(
      'Mot-clé à rechercher : renvoie des extraits avec contexte au lieu du texte intégral'
    ),
  contextWindow: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      `Caractères de contexte autour de chaque occurrence (défaut ${DEFAULT_CONTEXT_WINDOW})`
    ),
});

type PdfInput = z.infer<typeof pdfInputSchema>;

type PageText = { page: number; text: string };

// ---------------------------------------------------------------------------
// Chargement de la source
// ---------------------------------------------------------------------------

const isUrl = (source: string): boolean => /^https?:\/\//i.test(source);

const formatBytes = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;

async function loadFromUrl(source: string): Promise<Uint8Array> {
  const response = await fetch(source, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new PdfToolError(`Failed to fetch PDF: HTTP ${response.status} ${response.statusText}`);
  }

  const announced = Number(response.headers.get('content-length') ?? 0);
  if (announced > MAX_BYTES) {
    throw new PdfToolError(
      `PDF too large: ${formatBytes(announced)} (limit ${formatBytes(MAX_BYTES)})`
    );
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    throw new PdfToolError(
      `PDF too large: ${formatBytes(buffer.byteLength)} (limit ${formatBytes(MAX_BYTES)})`
    );
  }

  return new Uint8Array(buffer);
}

async function loadFromFile(source: string): Promise<Uint8Array> {
  const absolute = resolve(source);
  const allowed = ALLOWED_ROOTS.some(
    (root) => absolute === root || absolute.startsWith(root + sep)
  );

  if (!allowed) {
    throw new PdfToolError(
      `Local path not allowed: "${source}". Allowed roots: ${ALLOWED_ROOTS.join(', ')} ` +
        '(extend with the PDF_ALLOWED_DIRS environment variable).'
    );
  }

  const info = await stat(absolute).catch(() => {
    throw new PdfToolError(`File not found: ${absolute}`);
  });

  if (!info.isFile()) {
    throw new PdfToolError(`Not a file: ${absolute}`);
  }

  if (info.size > MAX_BYTES) {
    throw new PdfToolError(
      `PDF too large: ${formatBytes(info.size)} (limit ${formatBytes(MAX_BYTES)})`
    );
  }

  return new Uint8Array(await readFile(absolute));
}

function assertLooksLikePdf(bytes: Uint8Array): void {
  const header = Buffer.from(bytes.subarray(0, 5)).toString('latin1');
  if (header !== '%PDF-') {
    throw new PdfToolError('Source is not a PDF (missing "%PDF-" header).');
  }
}

// ---------------------------------------------------------------------------
// Extraction du texte
// ---------------------------------------------------------------------------

async function extractPages(
  bytes: Uint8Array,
  requested?: number[]
): Promise<{ totalPages: number; pages: PageText[] }> {
  // unpdf (pdf.js) transfère puis détache le buffer qu'on lui confie :
  // on repart d'une copie fraîche à chaque document ouvert.
  const document = await getDocumentProxy(new Uint8Array(bytes));

  try {
    const totalPages = document.numPages;
    const wanted = requested?.length
      ? [...new Set(requested)].filter((page) => page <= totalPages).sort((a, b) => a - b)
      : Array.from({ length: totalPages }, (_, index) => index + 1);

    if (wanted.length === 0) {
      throw new PdfToolError(
        `No valid page in [${requested?.join(', ')}]: the document has ${totalPages} page(s).`
      );
    }

    const pages: PageText[] = [];
    for (const page of wanted) {
      const content = await (await document.getPage(page)).getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pages.push({ page, text });
    }

    return { totalPages, pages };
  } finally {
    // `PDFDocumentProxy` n'expose pas destroy() : c'est le loadingTask qui libère
    // le document et son worker.
    await document.loadingTask.destroy();
  }
}

const REGEX_META = /[.*+?^${}()|[\]\\]/g;

const escapeRegex = (value: string): string => value.replace(REGEX_META, '\\$&');

function searchPages(
  pages: PageText[],
  query: string,
  contextWindow: number
): { matches: { page: number; snippet: string }[]; total: number } {
  // `query` vient du modèle : il est échappé, ce qui interdit toute expression
  // régulière inattendue (parenthèse orpheline, `a*` qui boucle).
  const pattern = new RegExp(escapeRegex(query), 'gi');
  const matches: { page: number; snippet: string }[] = [];
  let total = 0;

  for (const { page, text } of pages) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match !== null) {
      total += 1;
      if (matches.length < MAX_MATCHES) {
        const start = Math.max(0, match.index - contextWindow);
        const end = Math.min(text.length, match.index + match[0].length + contextWindow);
        matches.push({
          page,
          snippet: `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`,
        });
      }
      match = pattern.exec(text);
    }
  }

  return { matches, total };
}

function clampText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_CHARS), truncated: true };
}

// ---------------------------------------------------------------------------
// Fonction exécutée par l'outil
// ---------------------------------------------------------------------------

async function readPdfContent({ source, pages, query, contextWindow }: PdfInput): Promise<string> {
  try {
    const bytes = isUrl(source) ? await loadFromUrl(source) : await loadFromFile(source);
    assertLooksLikePdf(bytes);

    const extracted = await extractPages(bytes, pages);
    const base = { source, totalPages: extracted.totalPages };

    const keyword = query?.trim();
    if (keyword) {
      const { matches, total } = searchPages(
        extracted.pages,
        keyword,
        contextWindow ?? DEFAULT_CONTEXT_WINDOW
      );

      if (total === 0) {
        return JSON.stringify({
          success: true,
          ...base,
          message: `No occurrence of "${keyword}" (searched ${extracted.pages.length} page(s)).`,
          matches: [],
        });
      }

      const capped = total > matches.length ? ` (first ${matches.length} shown)` : '';
      return JSON.stringify({
        success: true,
        ...base,
        message: `${total} occurrence(s) of "${keyword}"${capped}.`,
        matches,
      });
    }

    const text = extracted.pages
      .map(({ page, text: pageText }) => `--- page ${page} ---\n${pageText}`)
      .join('\n\n');
    const clamped = clampText(text);

    return JSON.stringify({
      success: true,
      ...base,
      text: clamped.text,
      ...(clamped.truncated
        ? {
            truncated: true,
            note: `Text truncated at ${MAX_CHARS} characters (document has ${text.length}). Use "pages" or "query" to read the remainder.`,
          }
        : {}),
    });
  } catch (error) {
    // node-fetch remonte l'expiration du signal comme AbortError, pas TimeoutError.
    const expired =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

    const message =
      error instanceof PdfToolError
        ? error.message
        : expired
          ? `Timed out after ${FETCH_TIMEOUT_MS} ms while fetching "${source}".`
          : error instanceof Error
            ? error.message
            : String(error);

    return JSON.stringify({ success: false, error: message });
  }
}

// ---------------------------------------------------------------------------
// Export LangChain
// ---------------------------------------------------------------------------

export const readPdfTool = tool(readPdfContent, {
  name: 'readPdf',
  description:
    'Reads text from a PDF given an http(s) URL or a local file path (local reads are restricted ' +
    'to allowed directories). Optionally targets specific pages, or searches a keyword and returns ' +
    'snippets with their page number and surrounding context.',
  schema: pdfInputSchema,
});
