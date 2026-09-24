import fetch from 'node-fetch';
import { isAirlabsError } from './types/flight';

/** AirLabs base URL — always v9, earlier versions are deprecated. */
export const AIRLABS_BASE_URL = 'https://airlabs.co/api/v9';

/** Hard deadline for one AirLabs request (same pattern as weatherTool.ts). */
const FETCH_TIMEOUT_MS = Number(process.env.AIRLABS_FETCH_TIMEOUT_MS ?? 15_000);

/**
 * AirLabs signals its own failures INSIDE an HTTP 200 body, so the status code alone
 * never tells whether the answer is usable. Codes → what the agent should say.
 */
export const AIRLABS_ERROR_MESSAGES: Record<string, string> = {
  unknown_api_key: '🔑 Clé AirLabs invalide — vérifier AIRLABS_API_KEY.',
  expired_api_key: '🔑 Clé AirLabs expirée (une clé free dure 1 mois) — la renouveler.',
  wrong_params: '⚠️ Paramètre de recherche invalide — vérifier le code transmis.',
  not_found: '❌ Aucun résultat pour cette recherche.',
  minute_limit_exceeded: '⏳ AirLabs : 250 requêtes/minute dépassées — réessayer dans une minute.',
  hour_limit_exceeded: '⏳ AirLabs : 2 500 requêtes/heure dépassées — réessayer plus tard.',
  month_limit_exceeded:
    '⏳ Quota mensuel AirLabs épuisé (1 000 req/mois) — attendre le renouvellement.',
  internal_error: '❌ Erreur interne AirLabs — réessayer.',
};

/**
 * Reads the key lazily so a missing variable breaks the call rather than the import
 * (tavilyTool throws at import time, which takes every other tool down with it).
 * Quotes and semicolons survive careless .env edits — strip them.
 */
export function requireAirlabsKey(): string {
  const raw = process.env.AIRLABS_API_KEY;
  if (!raw) throw new Error('AIRLABS_API_KEY is not set');
  return raw.replace(/["';]/g, '').trim();
}

/** Either the parsed body, or a sentence the agent can return to the user as-is. */
export type AirlabsReply<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * One AirLabs GET: deadline, HTTP status and the error-in-HTTP-200 channel resolved
 * into either data or a message. Genuine transport/server faults still throw — a tool
 * that turns a broken API into prose hides outages from the operator.
 */
export async function airlabsGet<T>(
  path: string,
  params: Record<string, string | number>
): Promise<AirlabsReply<T>> {
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .concat(`api_key=${encodeURIComponent(requireAirlabsKey())}`)
    .join('&');

  let response;
  try {
    response = await fetch(`${AIRLABS_BASE_URL}/${path}?${query}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    // node-fetch reports an expired AbortSignal as AbortError, not TimeoutError.
    const expired =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

    if (expired) {
      throw new Error(`AirLabs did not respond within ${FETCH_TIMEOUT_MS} ms.`);
    }

    throw error;
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: AIRLABS_ERROR_MESSAGES.unknown_api_key };
    }
    if (response.status === 404) {
      return { ok: false, message: '❌ Aucune donnée AirLabs pour cette recherche.' };
    }
    throw new Error(`AirLabs API error! status: ${response.status}`);
  }

  const body = (await response.json()) as T;

  if (isAirlabsError(body)) {
    return {
      ok: false,
      message: AIRLABS_ERROR_MESSAGES[body.error.code] ?? `❌ AirLabs : ${body.error.message}`,
    };
  }

  return { ok: true, data: body };
}
