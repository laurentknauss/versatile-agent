'use client';

import { PlaneIcon } from 'lucide-react';
import type { FC } from 'react';

import { asMessage, asRecord } from '@/lib/tool-result';
import { shortClock } from '@/lib/flight-format';

/**
 * Carte d'un vol suivi — rendue pour l'outil `flightTracker`.
 * Payload de `src/tools/flightTool.ts` : identité, statut, escales, position
 * ADS-B (absente quand l'appareil est au sol) et fiche appareil.
 */

type Point = {
  iata: string | null;
  airport: string | null;
  city: string | null;
  terminal: string | null;
  gate: string | null;
  baggageClaim: string | null;
  scheduled: string | null;
  estimated: string | null;
  actual: string | null;
  delay: string | null;
};

type Flight = {
  iata: string | null;
  number: string | null;
  airline: string | null;
  airlineIata: string | null;
  codeshare: string | null;
  statusLabel: string | null;
  statusCode: string | null;
  progressPercent: number | null;
  durationMinutes: number | null;
  departure: Point;
  arrival: Point;
  position: {
    latitude: number | null;
    longitude: number | null;
    altitudeMeters: number | null;
    headingDegrees: number | null;
    speedKmh: number | null;
    verticalSpeedMs: number | null;
    signalAgeSeconds: number | null;
    stale: boolean;
  } | null;
  aircraft: { model: string | null; registration: string | null; engine: string | null };
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asPoint = (value: unknown): Point => {
  const point = (value ?? {}) as Record<string, unknown>;
  return {
    iata: text(point['iata']),
    airport: text(point['airport']),
    city: text(point['city']),
    terminal: text(point['terminal']),
    gate: text(point['gate']),
    baggageClaim: text(point['baggageClaim']),
    scheduled: text(point['scheduled']),
    estimated: text(point['estimated']),
    actual: text(point['actual']),
    delay: text(point['delay']),
  };
};

const asFlight = (result: unknown): Flight | null => {
  const record = asRecord(result);
  if (!record) return null;
  const flight = (record['flight'] ?? {}) as Record<string, unknown>;
  const status = (record['status'] ?? {}) as Record<string, unknown>;
  const codeshare = (flight['codeshare'] ?? null) as Record<string, unknown> | null;
  const position = record['position']
    ? ((record['position'] ?? {}) as Record<string, unknown>)
    : null;
  const aircraft = (record['aircraft'] ?? {}) as Record<string, unknown>;

  return {
    iata: text(flight['iata']),
    number: text(flight['number']),
    airline: text(flight['airline']),
    airlineIata: text(flight['airlineIata']),
    codeshare: text(codeshare?.['iata']),
    statusLabel: text(status['label']),
    statusCode: text(status['code']),
    progressPercent: count(status['progressPercent']),
    durationMinutes: count(status['durationMinutes']),
    departure: asPoint(record['departure']),
    arrival: asPoint(record['arrival']),
    position: position
      ? {
          latitude: count(position['latitude']),
          longitude: count(position['longitude']),
          altitudeMeters: count(position['altitudeMeters']),
          headingDegrees: count(position['headingDegrees']),
          speedKmh: count(position['speedKmh']),
          verticalSpeedMs: count(position['verticalSpeedMs']),
          signalAgeSeconds: count(position['signalAgeSeconds']),
          stale: position['stale'] === true,
        }
      : null,
    aircraft: {
      model: text(aircraft['model']),
      registration: text(aircraft['registration']),
      engine: text(aircraft['engine']),
    },
  };
};

const hours = (minutes: number | null): string | null =>
  minutes == null ? null : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;

const STATUS_TONES: Record<string, string> = {
  'en-route': 'bg-sky-500/25 text-sky-50',
  scheduled: 'bg-white/15 text-white/85',
  landed: 'bg-emerald-500/25 text-emerald-50',
};

const Leg: FC<{ label: string; point: Point; align: 'left' | 'right' }> = ({
  label,
  point,
  align,
}) => {
  // L'heure affichée est la plus fiable disponible ; l'estimation n'est montrée
  // que si elle en diffère visuellement (AirLabs renvoie « 07:20 » en prévu et
  // « 07:15 » en réel/estimé, ce qui donnait un « est. » redondant).
  const shown = shortClock(point.actual ?? point.scheduled);
  const estimate = shortClock(point.estimated);

  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <p className="text-[11px] tracking-wide text-white/55 uppercase">{label}</p>
      <p className="font-mono text-xl font-semibold">{point.iata ?? '—'}</p>
      <p className="truncate text-xs text-white/70">{point.city ?? point.airport ?? ''}</p>
      <p className="mt-1 font-mono text-sm">
        {shown ?? '—'}
        {estimate && estimate !== shown ? (
          <span className="ml-1 text-white/60">est. {estimate}</span>
        ) : null}
      </p>
      {point.delay ? (
        <p
          className={`text-[11px] ${point.delay === "à l'heure" ? 'text-emerald-200' : 'text-amber-200'}`}
        >
          {point.delay}
        </p>
      ) : null}
      {point.terminal || point.gate || point.baggageClaim ? (
        <p className="font-mono text-[11px] text-white/60">
          {[
            point.terminal ? `term. ${point.terminal}` : null,
            point.gate ? `porte ${point.gate}` : null,
            point.baggageClaim ? `bagage ${point.baggageClaim}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
    </div>
  );
};

const Stat: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg bg-white/5 px-2.5 py-1.5">
    <p className="text-[10px] tracking-wide text-white/50 uppercase">{label}</p>
    <p className="font-mono text-sm">{value}</p>
  </div>
);

export const FlightTrackerCard: FC<{ args: unknown; result: unknown }> = ({ args, result }) => {
  const flight = asFlight(result);
  const requested = text((args as Record<string, unknown> | null)?.['flightIata']);

  if (!flight) {
    const message = asMessage(result);
    return (
      <div className="my-2 overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <PlaneIcon className="size-4 text-white/70" />
          <p className="text-sm font-semibold text-white/90">
            Vol {requested ? <span className="font-mono">{requested}</span> : 'en cours'}
          </p>
        </div>
        <p className="px-4 py-3 text-sm text-white/80">
          {message ?? 'Interrogation de la position en cours…'}
        </p>
      </div>
    );
  }

  const { position } = flight;
  const progress = flight.progressPercent;
  const tone = STATUS_TONES[flight.statusCode ?? ''] ?? 'bg-white/15 text-white/85';

  return (
    <div className="my-2 overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <PlaneIcon className="size-4 text-white/70" />
          <p className="font-mono text-base font-semibold">{flight.iata ?? requested ?? '—'}</p>
          <p className="text-sm text-white/80">
            {flight.airline ?? flight.airlineIata ?? ''}
            {flight.number ? <span className="text-white/55"> · vol {flight.number}</span> : null}
          </p>
          {flight.codeshare ? (
            <span className="rounded-full bg-white/15 px-1.5 py-0.5 font-mono text-[10px] text-white/75">
              aussi {flight.codeshare}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] ${tone}`}>
            {flight.statusLabel ?? flight.statusCode ?? 'statut inconnu'}
          </span>
          {flight.durationMinutes != null ? (
            <span className="text-[11px] text-white/60">
              vol de {hours(flight.durationMinutes)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 px-4 py-3">
        <Leg label="Départ" point={flight.departure} align="left" />
        <div className="self-center text-center">
          <p className="text-white/40">→</p>
          {hours(flight.durationMinutes) ? (
            <p className="text-[10px] text-white/50">{hours(flight.durationMinutes)}</p>
          ) : null}
        </div>
        <Leg label="Arrivée" point={flight.arrival} align="right" />
      </div>

      {progress != null ? (
        <div className="px-4 pb-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-sky-300/80"
              style={{ width: `${Math.min(100, Math.max(0, progress))} %` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-white/60">{progress} % du trajet parcouru</p>
        </div>
      ) : null}

      {position ? (
        <div className="border-t border-white/10 px-4 py-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="Position"
              value={`${position.latitude?.toFixed(3) ?? '—'}, ${position.longitude?.toFixed(3) ?? '—'}`}
            />
            <Stat
              label="Altitude"
              value={position.altitudeMeters != null ? `${position.altitudeMeters} m` : '—'}
            />
            <Stat
              label="Vitesse"
              value={position.speedKmh != null ? `${position.speedKmh} km/h` : '—'}
            />
            <Stat
              label="Cap"
              value={position.headingDegrees != null ? `${position.headingDegrees}°` : '—'}
            />
          </div>
          <p className="mt-2 text-[11px] text-white/55">
            {position.signalAgeSeconds != null
              ? `Dernier signal ADS-B il y a ${position.signalAgeSeconds} s`
              : 'Signal ADS-B horodaté'}
            {position.verticalSpeedMs != null
              ? ` · ${position.verticalSpeedMs > 0 ? 'montée' : 'descente'} ${Math.abs(position.verticalSpeedMs)} m/s`
              : ''}
            {position.stale ? (
              <span className="ml-1 rounded-full bg-amber-500/25 px-1.5 py-0.5 text-amber-50">
                position ancienne
              </span>
            ) : null}
          </p>
        </div>
      ) : (
        <p className="border-t border-white/10 px-4 py-2.5 text-[11px] text-white/55">
          Aucune position ADS-B : l&apos;appareil est au sol (ou ne diffuse pas).
        </p>
      )}

      {flight.aircraft.model || flight.aircraft.registration || flight.aircraft.engine ? (
        <p className="border-t border-white/10 px-4 py-2 text-[11px] text-white/55">
          {[flight.aircraft.model, flight.aircraft.registration, flight.aircraft.engine]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
    </div>
  );
};
