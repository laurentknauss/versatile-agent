import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type NextRequest, NextResponse } from 'next/server';

// Route statique : elle a la priorité sur le proxy catch-all `api/[..._path]`.
export const runtime = 'nodejs';

// Le graphe LangGraph tourne depuis la racine du monorepo (voir langgraph.json),
// c'est donc SA racine de travail qui définit les chemins autorisés par readPdf.
// On écrit un cran au-dessus de assistant-ui/ : ./data/uploads/ est à la fois
// dans le cwd du backend et déjà couvert par le `*.pdf` du .gitignore.
const MONOREPO_ROOT = path.resolve(process.cwd(), '..');
const UPLOAD_DIR = process.env.PDF_UPLOAD_DIR ?? path.join(MONOREPO_ROOT, 'data', 'uploads');

// Même valeur par défaut que PDF_MAX_BYTES côté agent (src/tools/pdfReader.ts).
const MAX_BYTES = Number(process.env.PDF_MAX_BYTES ?? 26214400);

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

function safeFileName(name: string): string {
  const cleaned = name
    .replace(/\.pdf$/i, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60);
  return `${cleaned || 'document'}.pdf`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (typeof file !== 'object' || file === null || !('arrayBuffer' in file)) {
      return NextResponse.json(
        { error: 'Aucun fichier reçu (champ "file" attendu).' },
        { status: 400 }
      );
    }

    const upload = file as { name: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };

    if (upload.size > MAX_BYTES) {
      const limit = (MAX_BYTES / 1048576).toFixed(1);
      return NextResponse.json(
        {
          error: `PDF trop volumineux : ${(upload.size / 1048576).toFixed(1)} Mo (limite ${limit} Mo).`,
        },
        { status: 413 }
      );
    }

    const bytes = new Uint8Array(await upload.arrayBuffer());
    const isPdf = PDF_MAGIC.every((byte, index) => bytes[index] === byte);

    if (!isPdf) {
      return NextResponse.json({ error: "Le fichier importé n'est pas un PDF." }, { status: 415 });
    }

    const storedName = `${Date.now().toString(36)}-${safeFileName(upload.name)}`;
    const absolutePath = path.join(UPLOAD_DIR, storedName);

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(absolutePath, bytes);

    return NextResponse.json({
      path: path.relative(MONOREPO_ROOT, absolutePath),
      name: upload.name,
      size: upload.size,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json({ error: `Import impossible : ${message}` }, { status: 500 });
  }
}
