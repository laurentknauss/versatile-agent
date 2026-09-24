'use client';

import type { FC } from 'react';

import { asMessage, asRecord } from '@/lib/tool-result';
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
    return { label: 'annulé', tone: 'bg-rose-100 text-rose-700' };
  if (flight.actual) {
    return direction === 'arrivals'
      ? { label: 'posé', tone: 'bg-emerald-100 text-emerald-800' }
      : { label: 'parti', tone: 'bg-emerald-100 text-emerald-800' };
  }
  if (flight.estimated && flight.scheduled && flight.estimated !== flight.scheduled) {
    return { label: 'retardé', tone: 'bg-amber-100 text-amber-800' };
  }
  return { label: 'prévu', tone: 'bg-slate-100 text-slate-600' };
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
      <div className="my-2 overflow-hidden rounded-2xl border border-black/10 bg-white text-slate-900 shadow-sm">
        <div className="border-b border-black/10 px-4 py-2.5 text-sm font-semibold text-slate-900">
          Tableau des vols{requested ? ` · ${requested}` : ''}
        </div>
        <p className="px-4 py-3 text-sm text-slate-600">
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
    <div className="my-2 overflow-hidden rounded-2xl border border-black/10 bg-white text-slate-900 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-black/10 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">
          {isArrivals ? 'Arrivées' : 'Départs'} · <span className="font-mono">{board.airport}</span>
        </p>
        <p className="text-xs text-slate-500">
          {board.flightsOnBoard ?? board.flights.length} mouvement
          {(board.flightsOnBoard ?? board.flights.length) > 1 ? 's' : ''} · fenêtre AirLabs{' '}
          {covered}
        </p>
      </div>

      {board.note ? (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] text-amber-900">
          {board.note}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[19rem] border-collapse text-left text-sm text-slate-800">
          <thead>
            <tr className="text-[11px] tracking-wide text-slate-500 uppercase">
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
                  className="border-t border-black/5 align-top odd:bg-slate-50"
                >
                  <Cell>
                    <span className="font-mono text-[15px] font-semibold text-slate-900">
                      {clock ?? '—'}
                    </span>
                    {relative ? (
                      <span className="mt-0.5 block text-[11px] text-slate-400">{relative}</span>
                    ) : null}
                  </Cell>
                  <Cell>
                    <span className="font-semibold text-slate-900">{flight.iata ?? '—'}</span>
                    {flight.marketingCodes.length > 0 ? (
                      <span
                        className="ml-1.5 rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] text-slate-600"
                        title={`Vendu aussi sous ${flight.marketingCodes.join(', ')}`}
                      >
                        +{flight.marketingCodes.length}
                      </span>
                    ) : null}
                  </Cell>
                  <Cell className="hidden sm:table-cell">
                    <span className="font-mono text-xs text-slate-500">
                      {flight.airlineIata ?? '—'}
                    </span>
                  </Cell>
                  <Cell>
                    <span className="font-mono text-slate-700">
                      {flight.counterpartIata ?? '—'}
                    </span>
                  </Cell>
                  <Cell className="hidden sm:table-cell">
                    {flight.delayMinutes == null ? (
                      <span className="text-slate-400">—</span>
                    ) : delayed ? (
                      <span className="font-medium text-amber-700">+{flight.delayMinutes} min</span>
                    ) : (
                      <span className="text-emerald-700">à l&apos;heure</span>
                    )}
                  </Cell>
                  <Cell className="hidden md:table-cell">
                    <span className="font-mono text-xs text-slate-500">{slot || '—'}</span>
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

      <p className="border-t border-black/10 bg-slate-50 px-4 py-3 text-[11px] text-slate-500">
        Heures locales de {board.airport}
        {window.returnedRows != null ? ` · ${window.returnedRows} lignes brutes` : ''}
        {window.physicalFlights != null ? ` pour ${window.physicalFlights} vols` : ''}
        {' · AirLabs plafonne à 100 mouvements et 10 h au-delà de maintenant.'}
      </p>
    </div>
  );
};
