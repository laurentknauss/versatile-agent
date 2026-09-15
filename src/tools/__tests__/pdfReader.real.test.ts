import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { readPdfTool } from '../pdfReader';

/**
 * Intégration sur un vrai deck de société (26 slides, 12 Mo, PowerPoint).
 * L'actif vit dans `fixtures/real/`, ignoré par git (`*.pdf`) : il n'est donc
 * jamais committé, et le test se saute proprement là où il est absent.
 */
const REAL = 'data/skeena-corporate-presentation-february-2026.pdf';

type Result = {
  success: boolean;
  error?: string;
  totalPages?: number;
  text?: string;
  matches?: { page: number; snippet: string }[];
};

const run = async (args: Record<string, unknown>): Promise<Result> =>
  JSON.parse((await readPdfTool.invoke(args as never)) as string) as Result;

describe.skipIf(!existsSync(REAL))('readPdf — deck réel (Skeena, 26 slides)', () => {
  it('extrait le dossier complet, slide par slide', async () => {
    const result = await run({ source: REAL });

    expect(result.success).toBe(true);
    expect(result.totalPages).toBe(26);
    expect(result.text).toContain('TSX: SKE');
    expect(result.text).toContain('--- page 26 ---');
  }, 30_000);

  it('cible une slide précise', async () => {
    const result = await run({ source: REAL, pages: [2] });

    expect(result.success).toBe(true);
    expect(result.text).toContain('Forward Looking Statements');
    expect(result.text).not.toContain('--- page 1 ---');
  }, 30_000);

  it('retrouve un mot-clé avec des numéros de slide valides', async () => {
    const result = await run({ source: REAL, query: 'reserves' });

    expect(result.success).toBe(true);
    expect(result.matches?.length).toBeGreaterThan(0);
    expect(result.matches?.every((match) => match.page >= 1 && match.page <= 26)).toBe(true);
  }, 30_000);
});
