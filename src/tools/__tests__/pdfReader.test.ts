import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile } from 'fs/promises';
import { readPdfTool } from '../pdfReader';

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock('node-fetch', () => ({ default: mockFetch }));

/** Fixture PDF reelle : 2 pages, sans accents (police base14). */
const FIXTURE = 'src/tools/__tests__/fixtures/sample.pdf';

type Result = {
  success: boolean;
  error?: string;
  text?: string;
  totalPages?: number;
  message?: string;
  matches?: { page: number; snippet: string }[];
};

const run = async (args: Record<string, unknown>): Promise<Result> =>
  JSON.parse(await readPdfTool.invoke(args as never));

const okResponse = (body: Buffer) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: { get: () => String(body.byteLength) },
  arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
});

beforeEach(() => {
  mockFetch.mockReset();
});

describe('readPdf — extraction', () => {
  it('extrait le texte des deux pages avec un marqueur par page', async () => {
    const result = await run({ source: FIXTURE });

    expect(result.success).toBe(true);
    expect(result.totalPages).toBe(2);
    expect(result.text).toContain('--- page 1 ---');
    expect(result.text).toContain('ALPHA report');
    expect(result.text).toContain('--- page 2 ---');
    expect(result.text).toContain('BETA annex');
  });

  it('ne renvoie que les pages demandées', async () => {
    const result = await run({ source: FIXTURE, pages: [2] });

    expect(result.success).toBe(true);
    expect(result.text).toContain('BETA annex');
    expect(result.text).not.toContain('ALPHA report');
    expect(result.text).not.toContain('--- page 1 ---');
  });

  it('refuse une page hors du document', async () => {
    const result = await run({ source: FIXTURE, pages: [9] });

    expect(result.success).toBe(false);
    expect(result.error).toContain('the document has 2 page(s)');
  });
});

describe('readPdf — recherche par mot-clé', () => {
  it('renvoie des extraits avec leur numéro de page, insensible à la casse', async () => {
    const result = await run({ source: FIXTURE, query: 'alpha' });

    expect(result.success).toBe(true);
    expect(result.matches).toHaveLength(2);
    expect(result.matches?.map((match) => match.page)).toEqual([1, 2]);
    expect(result.matches?.[0].snippet).toContain('ALPHA report');
    expect(result.matches?.[1].snippet).toContain('lowercase alpha');
  });

  it('signale l’absence d’occurrence sans échouer', async () => {
    const result = await run({ source: FIXTURE, query: 'introuvable' });

    expect(result.success).toBe(true);
    expect(result.matches).toEqual([]);
    expect(result.message).toContain('No occurrence');
  });

  it('traite une parenthèse comme un littéral (pas d’expression régulière invalide)', async () => {
    const result = await run({ source: FIXTURE, query: '(' });

    expect(result.success).toBe(true);
    expect(result.matches).toEqual([]);
  });

  it('traite « a* » comme un littéral et se termine', async () => {
    const result = await run({ source: FIXTURE, query: 'a*' });

    expect(result.success).toBe(true);
    expect(result.matches).toEqual([]);
  });
});

describe('readPdf — garde-fous', () => {
  it('refuse un chemin hors des racines autorisées', async () => {
    const result = await run({ source: '/etc/hostname' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Local path not allowed');
  });

  it('refuse un fichier local absent', async () => {
    const result = await run({ source: 'src/tools/__tests__/fixtures/absent.pdf' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('File not found');
  });

  it('refuse un fichier qui n’est pas un PDF', async () => {
    const result = await run({ source: 'package.json' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not a PDF');
  });
});

describe('readPdf — sources distantes', () => {
  it('extrait un PDF servi par une URL', async () => {
    const body = await readFile(FIXTURE);
    mockFetch.mockResolvedValue(okResponse(body));

    const result = await run({ source: 'https://example.com/sample.pdf' });

    expect(result.success).toBe(true);
    expect(result.totalPages).toBe(2);
    expect(result.text).toContain('ALPHA report');
  });

  it('remonte une erreur HTTP', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => null },
    });

    const result = await run({ source: 'https://example.com/absent.pdf' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('HTTP 404');
  });

  it('refuse une réponse qui n’est pas un PDF', async () => {
    mockFetch.mockResolvedValue(okResponse(Buffer.from('<html>erreur</html>')));

    const result = await run({ source: 'https://example.com/page.html' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not a PDF');
  });
});

describe('readPdf — contrat de l’outil', () => {
  it('porte le nom attendu par le modèle', () => {
    expect(readPdfTool.name).toBe('readPdf');
  });

  it('rejette une source vide et une page nulle', () => {
    expect(readPdfTool.schema.safeParse({ source: '' }).success).toBe(false);
    expect(readPdfTool.schema.safeParse({ source: FIXTURE, pages: [0] }).success).toBe(false);
  });
});
