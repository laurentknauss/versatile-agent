import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { airlabsGet } from './airlabsClient';
import type {
  AirlabsSchedule,
  AirlabsScheduleResponse,
  AirportBoardFlight,
  AirportBoardResult,
} from './types/flight';

/**
 * A movement older than this is no longer "the board" — AirLabs returns a window
 * around now, so a short grace keeps just-departed flights visible without burying
 * the answer in history.
 */
const PAST_GRACE_SECONDS = 15 * 60;

export const airportBoardTool = tool(
  async ({
    airport,
    direction,
    withinHours,
    limit,
  }: {
    airport: string;
    direction: 'departures' | 'arrivals';
    withinHours?: number;
    limit?: number;
  }): Promise<string | AirportBoardResult> => {
    const code = airport.trim().toUpperCase();
    const isArrivals = direction === 'arrivals';

    const reply = await airlabsGet<AirlabsScheduleResponse>('schedules', {
      [isArrivals ? 'arr_iata' : 'dep_iata']: code,
    });
    if (!reply.ok) return reply.message;

    const rows = reply.data.response ?? [];
    if (rows.length === 0) {
      return `❌ Aucun mouvement pour l'aéroport « ${code} ». Vérifier le code IATA (3 lettres, ex. CDG).`;
    }

    // ⚠️ AirLabs emits one row per MARKETING number: a single CDG→HAJ flight shows up
    // as A51338 (operator, cs_flight_iata = null), AF1338, AM5746, UU8338, DL8370,
    // KE6371 — every codeshare row points at the operator. Group on the physical
    // flight, otherwise 100 rows are really ~15 flights repeated six times.
    const groups = new Map<string, AirlabsSchedule[]>();
    for (const row of rows) {
      const key = row.cs_flight_iata ?? row.flight_iata ?? 'unknown';
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const horizonSeconds = withinHours ? nowSeconds + withinHours * 3600 : Number.POSITIVE_INFINITY;

    const movements = [...groups.values()].map((group) => {
      // The only row without a codeshare pointer is the one actually flown.
      const operator = group.find((row) => !row.cs_flight_iata) ?? group[0];
      return {
        operator,
        marketingCodes: group
          .filter((row) => row !== operator)
          .map((row) => row.flight_iata)
          .filter((number): number is string => number != null),
        time: (isArrivals ? operator.arr_time_ts : operator.dep_time_ts) ?? null,
      };
    });

    const upcoming = movements
      .filter(
        (movement) =>
          movement.time != null &&
          movement.time >= nowSeconds - PAST_GRACE_SECONDS &&
          movement.time <= horizonSeconds
      )
      .sort((a, b) => (a.time ?? 0) - (b.time ?? 0));

    // ⚠️ Measured 2026-09-24: on a hub the 100-row free window can be exhausted
    // BEFORE now (CDG returned 05:10→07:00 UTC while it was 08:05 UTC), so every
    // returned movement is already gone. Refusing the board would hide one that
    // does exist: fall back to the movements closest to now and flag the window.
    const windowIsUpcoming = upcoming.length > 0;
    const nearest = windowIsUpcoming
      ? upcoming.slice(0, limit ?? 15)
      : movements
          .filter((movement) => movement.time != null && movement.time <= horizonSeconds)
          .sort(
            (a, b) => Math.abs((a.time ?? 0) - nowSeconds) - Math.abs((b.time ?? 0) - nowSeconds)
          )
          .slice(0, limit ?? 15)
          .sort((a, b) => (a.time ?? 0) - (b.time ?? 0));

    const returnedTimes = rows
      .map((row) => (isArrivals ? row.arr_time_ts : row.dep_time_ts) ?? null)
      .filter((time): time is number => time != null)
      .sort((a, b) => a - b);

    if (nearest.length === 0) {
      const lastMovement = returnedTimes.at(-1);
      return `❌ Aucun ${isArrivals ? 'arrivée' : 'départ'} pour ${code} dans la fenêtre demandée${
        withinHours ? ` (${withinHours} h)` : ''
      }. AirLabs ne couvre que ${lastMovement ? `jusqu'au ${new Date(lastMovement * 1000).toISOString()}` : 'les prochaines heures'} (10 h maximum) : élargir la fenêtre ou vérifier l'heure.`;
    }

    const shown = nearest;

    const flights: AirportBoardFlight[] = shown.map(({ operator, marketingCodes, time }) => ({
      iata: operator.flight_iata ?? null,
      airlineIata: operator.airline_iata ?? null,
      airlineIcao: operator.airline_icao ?? null,
      marketingCodes,
      counterpartIata: (isArrivals ? operator.dep_iata : operator.arr_iata) ?? null,
      counterpartIcao: (isArrivals ? operator.dep_icao : operator.arr_icao) ?? null,
      scheduled: (isArrivals ? operator.arr_time : operator.dep_time) ?? null,
      estimated: (isArrivals ? operator.arr_estimated : operator.dep_estimated) ?? null,
      actual: (isArrivals ? operator.arr_actual : operator.dep_actual) ?? null,
      scheduledTs: time,
      // Negative once the movement has happened — the board keeps it for a few minutes.
      minutesFromNow: time != null ? Math.round((time - nowSeconds) / 60) : null,
      delayMinutes: (isArrivals ? operator.arr_delayed : operator.dep_delayed) ?? null,
      terminal: (isArrivals ? operator.arr_terminal : operator.dep_terminal) ?? null,
      gate: (isArrivals ? operator.arr_gate : operator.dep_gate) ?? null,
      baggageClaim: isArrivals ? (operator.arr_baggage ?? null) : null,
      airlabsStatus: operator.status ?? null,
    }));

    return {
      airport: code,
      direction,
      observedAtUtc: new Date(nowSeconds * 1000).toISOString(),
      windowIsUpcoming,
      note: windowIsUpcoming
        ? null
        : `AirLabs n'a renvoyé pour ${code} que des mouvements déjà passés (fenêtre ${returnedTimes[0] ? new Date(returnedTimes[0] * 1000).toISOString().slice(11, 16) : '?'}→${returnedTimes.at(-1) ? new Date(returnedTimes.at(-1)! * 1000).toISOString().slice(11, 16) : '?'} UTC) : voici les plus proches de maintenant, pas des départs à venir.`,
      coverage: {
        firstReturnedMovementUtc: returnedTimes[0]
          ? new Date(returnedTimes[0] * 1000).toISOString()
          : null,
        lastReturnedMovementUtc: returnedTimes.at(-1)
          ? new Date(returnedTimes.at(-1)! * 1000).toISOString()
          : null,
        returnedRows: rows.length,
        physicalFlights: movements.length,
      },
      flightsOnBoard: shown.length,
      shown: flights.length,
      flights,
    };
  },
  {
    name: 'airportBoard',
    description:
      'Departures or arrivals board for one airport: the next movements with flight number, airline, counterpart airport, scheduled/estimated/actual times, delay, terminal, gate and baggage claim, in local airport time plus a UNIX timestamp. Codeshares are merged into the flight actually operated (its own number plus the marketing codes it is sold under). Coverage is limited: AirLabs returns at most 100 movements, never more than 10 hours ahead, and on a busy hub those 100 rows can all sit before now — the result then carries windowIsUpcoming=false, a note to repeat to the user, and the movements closest to now instead of upcoming ones. Use aviationLookup first when the user gives a city name instead of an IATA code.',
    schema: z.object({
      airport: z
        .string()
        .regex(/^[A-Za-z]{3}$/)
        .describe("IATA airport code, three letters, e.g. 'CDG' (Paris) or 'TFS' (Tenerife)."),
      direction: z
        .enum(['departures', 'arrivals'])
        .default('departures')
        .describe('Board to read: departures from this airport, or arrivals into it.'),
      withinHours: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .describe(
          'Only movements within the next N hours (1-10). Omit to keep everything AirLabs returned.'
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(15)
        .describe('Maximum number of movements to return (1-50).'),
    }),
  }
);
