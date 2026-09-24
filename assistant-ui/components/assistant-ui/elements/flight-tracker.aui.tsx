'use client';

import { PlaneIcon } from 'lucide-react';
import type { FC } from 'react';

import { asMessage, asRecord } from '@/lib/tool-result';
import { BorderBeam } from '@/components/assistant-ui/elements/border-beam';
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
  'en-route': 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30',
  scheduled: 'bg-slate-800 text-slate-300 ring-1 ring-slate-700',
  landed: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
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
      <p className="text-[11px] tracking-wide text-sky-200/70 uppercase">{label}</p>
      <p className="font-mono text-xl font-semibold text-white">{point.iata ?? '—'}</p>
      <p className="truncate text-xs text-slate-400">{point.city ?? point.airport ?? ''}</p>
      <p className="mt-1 font-mono text-sm text-cyan-300">
        {shown ?? '—'}
        {estimate && estimate !== shown ? (
          <span className="ml-1 text-slate-500">est. {estimate}</span>
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
        <p className="font-mono text-[11px] text-slate-500">
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
  <div className="rounded-lg bg-slate-900/80 px-2.5 py-1.5 ring-1 ring-slate-800">
    <p className="text-[10px] tracking-wide text-slate-500 uppercase">{label}</p>
    <p className="font-mono text-sm text-sky-200">{value}</p>
  </div>
);

/** Anneau de progression (portage CSS de l'« Animated Circular Progress Bar » de Magic UI). */
const ProgressRing: FC<{ value: number }> = ({ value }) => {
  const percent = Math.min(100, Math.max(0, value));
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg
      viewBox="0 0 44 44"
      className="size-11 -rotate-90 drop-shadow-[0_0_6px_rgba(56,189,248,0.45)]"
      role="img"
      aria-label={`${percent} % du trajet parcouru`}
    >
      <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="3" className="stroke-slate-800" />
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent / 100)}
        className="stroke-sky-400 transition-[stroke-dashoffset] duration-1000 ease-out"
      />
    </svg>
  );
};

export const FlightTrackerCard: FC<{ args: unknown; result: unknown }> = ({ args, result }) => {
  const flight = asFlight(result);
  const requested = text((args as Record<string, unknown> | null)?.['flightIata']);

  if (!flight) {
    const message = asMessage(result);
    return (
      <div className="relative my-2 overflow-hidden rounded-2xl border border-sky-900/70 bg-slate-950 bg-[radial-gradient(120%_100%_at_100%_0%,rgba(56,189,248,0.16),transparent_55%)] text-slate-100 shadow-lg shadow-sky-950/40">
        <div className="flex items-center gap-2 border-b border-sky-900/60 px-4 py-2.5">
          <PlaneIcon className="size-4 text-sky-400" />
          <p className="text-sm font-semibold text-white">
            Vol{' '}
            {requested ? <span className="font-mono text-sky-300">{requested}</span> : 'en cours'}
          </p>
        </div>
        <p className="px-4 py-3 text-sm text-slate-400">
          {message ?? 'Interrogation de la position en cours…'}
        </p>
      </div>
    );
  }

  const { position } = flight;
  const progress = flight.progressPercent;
  const tone = STATUS_TONES[flight.statusCode ?? ''] ?? 'bg-slate-800 text-slate-300';

  return (
    <div className="relative my-2 overflow-hidden rounded-2xl border border-sky-900/70 bg-slate-950 bg-[radial-gradient(120%_100%_at_100%_0%,rgba(56,189,248,0.16),transparent_55%)] text-slate-100 shadow-lg shadow-sky-950/40">
      <BorderBeam size={80} duration={7} colorFrom="#7dd3fc" colorTo="#0ea5e9" />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-sky-900/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <PlaneIcon className="size-4 text-sky-400" />
          <p className="font-mono text-base font-semibold text-sky-300">
            {flight.iata ?? requested ?? '—'}
          </p>
          <p className="text-sm text-slate-300">
            {flight.airline ?? flight.airlineIata ?? ''}
            {flight.number ? <span className="text-slate-500"> · vol {flight.number}</span> : null}
          </p>
          {flight.codeshare ? (
            <span className="rounded-full bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
              aussi {flight.codeshare}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] ${tone}`}>
            {flight.statusLabel ?? flight.statusCode ?? 'statut inconnu'}
          </span>
          {flight.durationMinutes != null ? (
            <span className="text-[11px] text-slate-400">
              vol de {hours(flight.durationMinutes)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 px-4 py-3">
        <Leg label="Départ" point={flight.departure} align="left" />
        <div className="relative flex w-16 flex-col items-center gap-1 self-center pt-4 sm:w-24">
          <div className="relative h-px w-full border-t border-dashed border-sky-800">
            <span className="absolute -top-1 size-1.5 rounded-full bg-sky-300 shadow-[0_0_8px_2px_rgba(56,189,248,0.6)] motion-safe:animate-route-beam" />
          </div>
          {hours(flight.durationMinutes) ? (
            <p className="font-mono text-[10px] text-sky-300">{hours(flight.durationMinutes)}</p>
          ) : null}
        </div>
        <Leg label="Arrivée" point={flight.arrival} align="right" />
      </div>

      {progress != null ? (
        <div className="flex items-center gap-3 border-t border-sky-900/60 px-4 py-3">
          <ProgressRing value={progress} />
          <div>
            <p className="text-[10px] tracking-wide text-slate-500 uppercase">Trajet parcouru</p>
            <p className="font-mono text-sm text-sky-200">{progress} %</p>
          </div>
        </div>
      ) : null}

      {position ? (
        <div className="border-t border-sky-900/60 px-4 py-3">
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
          <p className="mt-2 text-[11px] text-slate-500">
            {position.signalAgeSeconds != null
              ? `Dernier signal ADS-B il y a ${position.signalAgeSeconds} s`
              : 'Signal ADS-B horodaté'}
            {position.verticalSpeedMs != null
              ? ` · ${position.verticalSpeedMs > 0 ? 'montée' : 'descente'} ${Math.abs(position.verticalSpeedMs)} m/s`
              : ''}
            {position.stale ? (
              <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-300 ring-1 ring-amber-500/30">
                position ancienne
              </span>
            ) : null}
          </p>
        </div>
      ) : (
        <p className="border-t border-sky-900/60 px-4 py-2.5 text-[11px] text-slate-500">
          Aucune position ADS-B : l&apos;appareil est au sol (ou ne diffuse pas).
        </p>
      )}

      {flight.aircraft.model || flight.aircraft.registration || flight.aircraft.engine ? (
        <p className="border-t border-sky-900/60 bg-slate-900/40 px-4 py-2.5 text-[11px] text-slate-400">
          {[flight.aircraft.model, flight.aircraft.registration, flight.aircraft.engine]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
    </div>
  );
};
