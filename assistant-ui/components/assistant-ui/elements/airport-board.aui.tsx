'use client';

import type { FC } from 'react';

import { asMessage, asRecord } from '@/lib/tool-result';
import { BorderBeam } from '@/components/assistant-ui/elements/border-beam';
import { shortClock } from '@/lib/flight-format';

/**
 * Tableau des mouvements d'un aéroport, rendu pour l'outil `airportBoard`.
 * Le payload est celui d'`src/tools/airportBoardTool.ts` : une ligne = un avion
 * physique, codeshares fusionnés dans `marketingCodes`.
 */

type BoardFlight = {
  iata: string | null;
  airlineIata: string | null;
  marketingCodes: string[];
  counterpartIata: string | null;
  scheduled: string | null;
  estimated: string | null;
  actual: string | null;
  minutesFromNow: number | null;
  delayMinutes: number | null;
  terminal: string | null;
  gate: string | null;
  baggageClaim: string | null;
  airlabsStatus: string | null;
};

type Board = {
  airport: string;
  direction: 'departures' | 'arrivals';
  note: string | null;
  coverage: {
    firstReturnedMovementUtc: string | null;
    lastReturnedMovementUtc: string | null;
    returnedRows: number | null;
    physicalFlights: number | null;
  };
  flightsOnBoard: number | null;
  flights: BoardFlight[];
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asFlight = (value: unknown): BoardFlight => {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    iata: text(row['iata']),
    airlineIata: text(row['airlineIata']),
    marketingCodes: Array.isArray(row['marketingCodes'])
      ? row['marketingCodes'].filter((code): code is string => typeof code === 'string')
      : [],
    counterpartIata: text(row['counterpartIata']),
    scheduled: text(row['scheduled']),
    estimated: text(row['estimated']),
    actual: text(row['actual']),
    minutesFromNow: count(row['minutesFromNow']),
    delayMinutes: count(row['delayMinutes']),
    terminal: text(row['terminal']),
    gate: text(row['gate']),
    baggageClaim: text(row['baggageClaim']),
    airlabsStatus: text(row['airlabsStatus']),
  };
};

const asBoard = (result: unknown): Board | null => {
  const record = asRecord(result);
  if (!record || !Array.isArray(record['flights'])) return null;
  const coverage = (record['coverage'] ?? {}) as Record<string, unknown>;
  return {
    airport: text(record['airport']) ?? '—',
    direction: record['direction'] === 'arrivals' ? 'arrivals' : 'departures',
    note: text(record['note']),
    coverage: {
      firstReturnedMovementUtc: text(coverage['firstReturnedMovementUtc']),
      lastReturnedMovementUtc: text(coverage['lastReturnedMovementUtc']),
      returnedRows: count(coverage['returnedRows']),
      physicalFlights: count(coverage['physicalFlights']),
    },
    flightsOnBoard: count(record['flightsOnBoard']),
    flights: record['flights'].map(asFlight),
  };
};

const relativeLabel = (minutes: number | null): string | null => {
  if (minutes == null) return null;
  if (minutes < -1) return `il y a ${Math.abs(minutes)} min`;
  if (minutes <= 1) return 'maintenant';
  return `dans ${minutes} min`;
};

/** Un départ est « parti » quand il a un horaire réel ; une annulation est fiable telle quelle. */
const stateOf = (
  flight: BoardFlight,
  direction: Board['direction']
): { label: string; tone: string } => {
  if (flight.airlabsStatus === 'cancelled')
    return { label: 'annulé', tone: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30' };
  if (flight.actual) {
    const tone = 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30';
    return direction === 'arrivals' ? { label: 'posé', tone } : { label: 'parti', tone };
  }
  if (flight.estimated && flight.scheduled && flight.estimated !== flight.scheduled) {
    return { label: 'retardé', tone: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30' };
  }
  return { label: 'prévu', tone: 'bg-slate-800 text-slate-300 ring-1 ring-slate-700' };
};

const Cell: FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <td className={`px-2.5 py-3 align-top ${className ?? ''}`}>{children}</td>
);

export const AirportBoardTable: FC<{ args: unknown; result: unknown }> = ({ args, result }) => {
  const board = asBoard(result);
  const requested = text((args as Record<string, unknown> | null)?.['airport']);

  if (!board) {
    const message = asMessage(result);
    return (
      <div className="my-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-lg shadow-slate-950/40">
        <div className="border-b border-slate-800 px-4 py-2.5 text-sm font-semibold tracking-wide text-amber-300 uppercase">
          Tableau des vols{requested ? ` · ${requested}` : ''}
        </div>
        <p className="px-4 py-3 text-sm text-slate-400">
          {message ?? 'Interrogation des mouvements en cours…'}
        </p>
      </div>
    );
  }

  const isArrivals = board.direction === 'arrivals';
  const window = board.coverage;
  const covered = window.lastReturnedMovementUtc
    ? `jusqu'à ${window.lastReturnedMovementUtc.slice(11, 16)} UTC`
    : 'prochaines heures';

  return (
    <div className="relative my-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-lg shadow-slate-950/40">
      <BorderBeam size={90} duration={9} colorFrom="#fcd34d" colorTo="#f59e0b" />
      <div className="h-0.5 w-full bg-gradient-to-r from-amber-400 via-amber-500/40 to-transparent" />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-800 px-4 py-3">
        <p className="text-sm font-semibold tracking-wide text-amber-300 uppercase">
          {isArrivals ? 'Arrivées' : 'Départs'} · <span className="font-mono">{board.airport}</span>
        </p>
        <p className="text-xs text-slate-400">
          {board.flightsOnBoard ?? board.flights.length} mouvement
          {(board.flightsOnBoard ?? board.flights.length) > 1 ? 's' : ''} · fenêtre AirLabs{' '}
          {covered}
        </p>
      </div>

      {board.note ? (
        <p className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[11px] text-amber-200">
          {board.note}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[19rem] border-collapse text-left text-sm text-slate-200">
          <thead>
            <tr className="text-[10px] tracking-[0.14em] text-amber-200/60 uppercase">
              <th className="px-2.5 py-2.5 font-medium">Heure</th>
              <th className="px-2.5 py-2.5 font-medium">Vol</th>
              <th className="hidden px-2.5 py-2.5 font-medium sm:table-cell">Cie</th>
              <th className="px-2.5 py-2.5 font-medium">{isArrivals ? 'Depuis' : 'Vers'}</th>
              <th className="hidden px-2.5 py-2.5 font-medium sm:table-cell">Retard</th>
              <th className="hidden px-2.5 py-2.5 font-medium md:table-cell">
                {isArrivals ? 'Bagage' : 'Term./Porte'}
              </th>
              <th className="px-2.5 py-2.5 font-medium">État</th>
            </tr>
          </thead>
          <tbody>
            {board.flights.map((flight, index) => {
              const state = stateOf(flight, board.direction);
              const clock = shortClock(flight.actual ?? flight.estimated ?? flight.scheduled);
              const relative = relativeLabel(flight.minutesFromNow);
              const delayed = (flight.delayMinutes ?? 0) > 0;
              const slot = isArrivals
                ? [flight.baggageClaim].filter(Boolean).join(' · ')
                : [flight.terminal, flight.gate].filter(Boolean).join(' · ');

              return (
                <tr
                  key={`${flight.iata ?? 'vol'}-${index}`}
                  className="border-t border-slate-800/70 align-top odd:bg-slate-900/40"
                >
                  <Cell>
                    <span className="font-mono text-[15px] font-semibold text-amber-300">
                      {clock ?? '—'}
                    </span>
                    {relative ? (
                      <span className="mt-0.5 block text-[11px] text-slate-500">{relative}</span>
                    ) : null}
                  </Cell>
                  <Cell>
                    <span className="font-mono font-semibold text-slate-100">
                      {flight.iata ?? '—'}
                    </span>
                    {flight.marketingCodes.length > 0 ? (
                      <span
                        className="ml-1.5 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300"
                        title={`Vendu aussi sous ${flight.marketingCodes.join(', ')}`}
                      >
                        +{flight.marketingCodes.length}
                      </span>
                    ) : null}
                  </Cell>
                  <Cell className="hidden sm:table-cell">
                    <span className="font-mono text-xs text-slate-400">
                      {flight.airlineIata ?? '—'}
                    </span>
                  </Cell>
                  <Cell>
                    <span className="font-mono text-sky-300">{flight.counterpartIata ?? '—'}</span>
                  </Cell>
                  <Cell className="hidden sm:table-cell">
                    {flight.delayMinutes == null ? (
                      <span className="text-slate-600">—</span>
                    ) : delayed ? (
                      <span className="font-medium text-amber-400">+{flight.delayMinutes} min</span>
                    ) : (
                      <span className="text-emerald-400">à l&apos;heure</span>
                    )}
                  </Cell>
                  <Cell className="hidden md:table-cell">
                    <span className="font-mono text-xs text-slate-400">{slot || '—'}</span>
                  </Cell>
                  <Cell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] whitespace-nowrap ${state.tone}`}
                    >
                      {state.label}
                    </span>
                  </Cell>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-slate-800 bg-slate-900/60 px-4 py-3 text-[11px] text-slate-500">
        Heures locales de {board.airport}
        {window.returnedRows != null ? ` · ${window.returnedRows} lignes brutes` : ''}
        {window.physicalFlights != null ? ` pour ${window.physicalFlights} vols` : ''}
        {' · AirLabs plafonne à 100 mouvements et 10 h au-delà de maintenant.'}
      </p>
    </div>
  );
};
