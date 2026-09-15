'use client';

import type { AttachmentAdapter, CompleteAttachment, PendingAttachment } from '@assistant-ui/react';

type UploadResponse = { path?: string; error?: string };

/**
 * Câble la feature « upload » du composer sur l'outil `readPdf` du backend.
 *
 * Un fichier déposé dans le navigateur n'est qu'un blob : le graphe LangGraph
 * lit, lui, un fichier sur SON disque. `send()` fait donc le pont — POST vers
 * /api/upload, qui écrit le PDF dans ./data/uploads/ (dans le cwd du backend,
 * donc dans une racine autorisée par readPdf) — puis publie le chemin obtenu
 * dans le contenu du message, sous forme de part **texte**.
 *
 * Part texte et non part `file` : le modèle est texte-only, et le sérialiseur
 * LangChain ne sait pas transmettre un fichier binaire à ce type de modèle.
 * Le modèle voit donc `[document importé : data/uploads/<fichier>.pdf]` et
 * appelle readPdf avec ce chemin (règle explicite dans le prompt système).
 */
export class PdfAttachmentAdapter implements AttachmentAdapter {
  accept = 'application/pdf';

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    return {
      id: crypto.randomUUID(),
      type: 'document',
      name: file.name,
      contentType: file.type || 'application/pdf',
      file,
      status: { type: 'requires-action', reason: 'composer-send' },
    };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    const body = new FormData();
    body.append('file', attachment.file, attachment.name);

    const response = await fetch('/api/upload', { method: 'POST', body });
    const payload = (await response.json().catch(() => ({}))) as UploadResponse;

    if (!response.ok || !payload.path) {
      throw new Error(payload.error ?? `Import du PDF impossible (HTTP ${response.status}).`);
    }

    return {
      ...attachment,
      status: { type: 'complete' },
      content: [{ type: 'text', text: `[document importé : ${payload.path}]` }],
    };
  }

  async remove(): Promise<void> {}
}

export const pdfAttachmentAdapter = new PdfAttachmentAdapter();
