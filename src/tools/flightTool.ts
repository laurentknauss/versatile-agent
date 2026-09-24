import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import fetch from 'node-fetch';
import { AirlabsFlightInfoResponse, FlightTrackerResult, isAirlabsError } from './types/flight';

/** AirLabs base URL — always v9, earlier versions are deprecated. */
const AIRLABS_BASE_URL = 'https://airlabs.co/api/v9';

/** Hard deadline for an AirLabs request (same pattern as weatherTool.ts). */
const FETCH_TIMEOUT_MS = Number(process.env.AIRLABS_FETCH_TIMEOUT_MS ?? 15_000);

/**
 * IATA flight number. ⚠️ The prefix is NOT always two letters — real payloads
 * contain U24573, B0101, 9C8528, W61732, G37000, V72764…
 */
const FLIGHT_IATA_RE = /^[A-Z0-9]{2}\d{1,4}$/i;

/** Past this age, the ADS-B position is stale — the aircraft signal stopped. */
const STALE_SIGNAL_MS = 5 * 60_000;

/** AirLabs error codes → actionable message (they arrive with HTTP 200). */
const AIRLABS_ERROR_MESSAGES: Record<string, string> = {
  unknown_api_key: '🔑 Clé AirLabs invalide — vérifier AIRLABS_API_KEY.',
  expired_api_key: '🔑 Clé AirLabs expirée (une clé free dure 1 mois) — la renouveler.',
  wrong_params: '⚠️ Paramètre de recherche invalide — vérifier le numéro de vol.',
  not_found: '❌ Aucun vol trouvé pour cette recherche.',
  minute_limit_exceeded: '⏳ AirLabs : 250 requêtes/minute dépassées — réessayer dans une minute.',
  hour_limit_exceeded: '⏳ AirLabs : 2 500 requêtes/heure dépassées — réessayer plus tard.',
  month_limit_exceeded:
    '⏳ Quota mensuel AirLabs épuisé (1 000 req/mois) — attendre le renouvellement.',
  internal_error: '❌ Erreur interne AirLabs — réessayer.',
};

/** AirLabs statuses → French label. Unknown values fall back to the raw code. */
const FLIGHT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'prévu',
  'en-route': 'en vol',
  landed: 'atterri',
};

/**
 * AirLabs call with a hard deadline.
 * node-fetch reports an expired AbortSignal as AbortError, not TimeoutError.
 */
async function fetchAirlabs(url: string) {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (error) {
    const expired =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

    if (expired) {
      throw new Error(`AirLabs did not respond within ${FETCH_TIMEOUT_MS} ms.`);
    }

    throw error;
  }
}

export const flightTrackerTool = tool(
  async ({ flightIata }: { flightIata: string }): Promise<string | FlightTrackerResult> => {
    let apiKey = process.env.AIRLABS_API_KEY;
    if (!apiKey) {
      throw new Error('AIRLABS_API_KEY is not set');
    }
    apiKey = apiKey.replace(/["';]/g, '').trim();

    const url = `${AIRLABS_BASE_URL}/flight?flight_iata=${encodeURIComponent(flightIata)}&api_key=${apiKey}`;

    const response = await fetchAirlabs(url);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return '🔑 AirLabs a refusé la clé API — vérifier AIRLABS_API_KEY.';
      }
      throw new Error(`AirLabs API error! status: ${response.status}`);
    }

    // AirLabs signals failures inside an HTTP 200 body.
    const data = (await response.json()) as AirlabsFlightInfoResponse;

    if (isAirlabsError(data)) {
      return AIRLABS_ERROR_MESSAGES[data.error.code] ?? `❌ AirLabs : ${data.error.message}`;
    }

    const info = data.response;
    if (!info || Object.keys(info).length === 0) {
      return `❌ Aucun vol « ${flightIata} » trouvé dans le flux AirLabs. Le numéro est peut-être erroné, ou le vol n'est pas prévu/actif aujourd'hui (l'API ne couvre que le temps réel, pas les dates passées ni futures).`;
    }

    const ageSeconds = info.updated ? Math.round(Date.now() / 1000 - info.updated) : null;

    return {
      flight: {
        iata: info.flight_iata ?? null,
        icao: info.flight_icao ?? null,
        number: info.flight_number ?? null,
        airline: info.airline_name ?? null,
        airlineIata: info.airline_iata ?? null,
        codeshare: info.cs_flight_iata
          ? {
              iata: info.cs_flight_iata,
              number: info.cs_flight_number ?? null,
              airlineIata: info.cs_airline_iata ?? null,
            }
          : null,
      },
      status: {
        code: info.status ?? null,
        label: FLIGHT_STATUS_LABELS[info.status ?? ''] ?? info.status ?? null,
        progressPercent: info.percent ?? null,
        durationMinutes: info.duration ?? null,
      },
      departure: {
        iata: info.dep_iata ?? null,
        airport: info.dep_name ?? null,
        city: info.dep_city ?? null,
        country: info.dep_country ?? null,
        terminal: info.dep_terminal ?? null,
        gate: info.dep_gate ?? null,
        scheduled: info.dep_time ?? null,
        estimated: info.dep_estimated ?? null,
        actual: info.dep_actual ?? null,
        delayMinutes: info.dep_delayed ?? null,
        delay:
          info.dep_delayed == null
            ? null
            : info.dep_delayed > 0
              ? `+${info.dep_delayed} min`
              : "à l'heure",
      },
      arrival: {
        iata: info.arr_iata ?? null,
        airport: info.arr_name ?? null,
        city: info.arr_city ?? null,
        country: info.arr_country ?? null,
        terminal: info.arr_terminal ?? null,
        gate: info.arr_gate ?? null,
        baggageClaim: info.arr_baggage ?? null,
        scheduled: info.arr_time ?? null,
        estimated: info.arr_estimated ?? null,
        actual: info.arr_actual ?? null,
        delayMinutes: info.arr_delayed ?? null,
        delay:
          info.arr_delayed == null
            ? null
            : info.arr_delayed > 0
              ? `+${info.arr_delayed} min`
              : "à l'heure",
      },
      // Absent when the aircraft is on the ground (no ADS-B position to report).
      position:
        info.lat != null && info.lng != null
          ? {
              latitude: info.lat,
              longitude: info.lng,
              altitudeMeters: info.alt ?? null,
              headingDegrees: info.dir ?? null,
              speedKmh: info.speed ?? null,
              verticalSpeedMs: info.v_speed ?? null,
              signalAgeSeconds: ageSeconds,
              stale: ageSeconds != null && ageSeconds * 1000 > STALE_SIGNAL_MS,
            }
          : null,
      aircraft: {
        type: info.aircraft_icao ?? null,
        model: info.model ?? null,
        manufacturer: info.manufacturer ?? null,
        registration: info.reg_number ?? null,
        hex: info.hex ?? null,
        builtYear: info.built ?? null,
        ageYears: info.age ?? null,
        engine: info.engine ?? null,
      },
    };
  },
  {
    name: 'flightTracker',
    description:
      'Tracks one flight in real time by its IATA number: status, scheduled/estimated/actual times, delays, terminal, gate, baggage claim, live position, and aircraft details. Real-time and same-day only — cannot search future flights, historical dates, or ticket prices.',
    schema: z.object({
      flightIata: z
        .string()
        .regex(FLIGHT_IATA_RE)
        .describe(
          "IATA flight number, e.g. 'AF6' or 'U24573' — two alphanumeric characters followed by 1-4 digits."
        ),
    }),
  }
);
