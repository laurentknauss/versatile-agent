'use client';

import {
  CloudDrizzleIcon,
  CloudFogIcon,
  CloudIcon,
  CloudLightningIcon,
  CloudRainIcon,
  CloudSnowIcon,
  CloudSunIcon,
  DropletsIcon,
  SunIcon,
  WindIcon,
} from 'lucide-react';
import type { ComponentType, CSSProperties, FC } from 'react';

import { asMessage, asRecord } from '@/lib/tool-result';

/**
 * Prévisions d'un outil `openWeatherMap` — rendues pour l'outil du même nom.
 * Payload de `src/tools/weatherTool.ts` : J+1 à J+5, une entrée par jour avec
 * températures agrégées, description dominante en français, vent, humidité,
 * pluie et probabilité de précipitation. Pas de conditions courantes.
 */

type Day = {
  date: string;
  weather: string | null;
  minCelsius: number | null;
  maxCelsius: number | null;
  averageCelsius: number | null;
  feelsLikeCelsius: number | null;
  precipitationProbabilityPercent: number | null;
  rainMm: number | null;
  humidityPercent: number | null;
  windSpeedKmh: number | null;
  windDirection: string | null;
};

type Forecast = { city: string | null; country: string | null; days: Day[] };

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Ambiance animée qui accompagne le ciel (portage CSS de Light Rays + pluie/neige/orage). */
type Ambience = 'clear' | 'cloud' | 'rain' | 'storm' | 'snow' | 'fog';

/**
 * Visuel d'une condition, du plus violent au plus calme : l'ordre compte, un
 * « orage avec pluie » doit tomber sur l'orage avant d'atteindre « pluie ».
 * Les descriptions viennent d'OpenWeatherMap en `lang=fr`.
 * Le 3ᵉ champ est le ciel de la carte, le 4ᵉ l'ambiance qui l'anime.
 */
const VISUALS: ReadonlyArray<[RegExp, ComponentType<{ className?: string }>, string, Ambience]> = [
  [/orage|tonnerre/i, CloudLightningIcon, 'from-violet-600 via-slate-800 to-slate-950', 'storm'],
  [/neige|verglas|gr[eê]le/i, CloudSnowIcon, 'from-sky-400 via-sky-600 to-slate-700', 'snow'],
  [
    /fortes? (averses|pluies)|pluie forte/i,
    CloudRainIcon,
    'from-slate-600 via-sky-700 to-slate-900',
    'rain',
  ],
  [/averses?/i, CloudRainIcon, 'from-slate-500 via-sky-700 to-slate-800', 'rain'],
  [/bruine/i, CloudDrizzleIcon, 'from-slate-500 via-sky-600 to-slate-800', 'rain'],
  [/pluie/i, CloudRainIcon, 'from-slate-600 via-sky-700 to-slate-900', 'rain'],
  [/brouillard|brume/i, CloudFogIcon, 'from-slate-400 via-slate-500 to-slate-700', 'fog'],
  [/couvert/i, CloudIcon, 'from-slate-500 via-slate-600 to-slate-800', 'cloud'],
  [/nuage|nuages/i, CloudSunIcon, 'from-sky-300 via-sky-500 to-slate-600', 'cloud'],
  [/d[eé]gag[eé]|ensoleill|clair/i, SunIcon, 'from-sky-400 via-sky-500 to-indigo-600', 'clear'],
];

const NEUTRAL_SKY = 'from-sky-400 via-sky-500 to-indigo-600';

/** Pastille d'icône : blanc translucide, lisible sur n'importe quel ciel. */
const CHIP = 'bg-white/25 text-white';

const visualFor = (
  description: string | null
): readonly [ComponentType<{ className?: string }>, string, Ambience] => {
  const match = description ? VISUALS.find(([pattern]) => pattern.test(description)) : null;
  return match ? [match[1], match[2], match[3]] : [CloudIcon, NEUTRAL_SKY, 'cloud'];
};

/** Rang de sévérité : l'index dans VISUALS, donc l'orage (0) avant la pluie (5). */
const severityOf = (description: string | null): number => {
  const found = description ? VISUALS.findIndex(([pattern]) => pattern.test(description)) : -1;
  return found === -1 ? VISUALS.length : found;
};

/** Ciel de la carte = condition la plus marquante des jours affichés, pas seulement demain. */
const skyOf = (days: Day[]): { surface: string; ambience: Ambience } => {
  const worst = [...days].sort((a, b) => severityOf(a.weather) - severityOf(b.weather))[0];
  const [, surface, ambience] = visualFor(worst?.weather ?? null);
  return { surface, ambience };
};

/** Rais de lumière (Light Rays, Magic UI) — positions fixes, donc identiques serveur et client. */
const RAYS: ReadonlyArray<{
  left: number;
  width: number;
  rotate: number;
  delay: number;
  duration: number;
  opacity: number;
}> = [
  { left: 12, width: 190, rotate: -22, delay: 0, duration: 13, opacity: 0.35 },
  { left: 32, width: 250, rotate: -8, delay: 3.5, duration: 17, opacity: 0.5 },
  { left: 54, width: 210, rotate: 6, delay: 1.5, duration: 15, opacity: 0.4 },
  { left: 74, width: 260, rotate: 18, delay: 5, duration: 19, opacity: 0.45 },
  { left: 90, width: 170, rotate: 30, delay: 7.5, duration: 11, opacity: 0.3 },
];

const SkyAmbience: FC<{ kind: Ambience }> = ({ kind }) => {
  if (kind === 'clear') {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-screen"
      >
        {RAYS.map((ray) => (
          <span
            key={ray.left}
            className="absolute -top-[12%] h-[70vh] origin-top -translate-x-1/2 rounded-full bg-linear-to-b from-white/70 to-transparent blur-2xl motion-safe:animate-light-rays"
            style={
              {
                left: `${ray.left}%`,
                width: ray.width,
                rotate: `${ray.rotate}deg`,
                animationDelay: `${ray.delay}s`,
                '--ray-duration': `${ray.duration}s`,
                '--ray-opacity': ray.opacity,
              } as CSSProperties
            }
          />
        ))}
      </div>
    );
  }

  if (kind === 'rain' || kind === 'storm') {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(102deg,transparent_0_6px,rgba(255,255,255,0.75)_6px_7px)] bg-[length:7px_28px] opacity-20 motion-safe:animate-rain-fall" />
        {kind === 'storm' ? (
          <div className="absolute inset-0 bg-white motion-safe:animate-storm-flash" />
        ) : null}
      </div>
    );
  }

  if (kind === 'snow') {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.9)_1px,transparent_1.7px)] bg-[length:18px_40px] opacity-40 motion-safe:animate-snow-drift" />
      </div>
    );
  }

  // Nuageux et brouillard : le dégradé porte l'ambiance, pas de surcouche animée.
  return null;
};

const asDay = (value: unknown): Day => {
  const day = (value ?? {}) as Record<string, unknown>;
  const temperature = (day['temperature'] ?? {}) as Record<string, unknown>;
  const wind = (day['wind'] ?? {}) as Record<string, unknown>;
  return {
    date: text(day['date']) ?? '',
    weather: text(day['weather']),
    minCelsius: count(temperature['minCelsius']),
    maxCelsius: count(temperature['maxCelsius']),
    averageCelsius: count(temperature['averageCelsius']),
    feelsLikeCelsius: count(temperature['feelsLikeCelsius']),
    precipitationProbabilityPercent: count(day['precipitationProbabilityPercent']),
    rainMm: count(day['rainMm']),
    humidityPercent: count(day['humidityPercent']),
    windSpeedKmh: count(wind['speedKmh']),
    windDirection: text(wind['direction']),
  };
};

const asForecast = (result: unknown): Forecast | null => {
  const record = asRecord(result);
  if (!record || !Array.isArray(record['forecast'])) return null;
  const location = (record['location'] ?? {}) as Record<string, unknown>;
  return {
    city: text(location['city']),
    country: text(location['country']),
    days: record['forecast'].map(asDay),
  };
};

/** « demain » pour la première entrée, puis la date locale courte. */
const dayLabel = (date: string, index: number): string => {
  if (index === 0) return 'demain';
  if (index === 1) return 'après-demain';
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
};

const Metric: FC<{ icon: ComponentType<{ className?: string }>; value: string; title: string }> = ({
  icon: Icon,
  value,
  title,
}) => (
  <span className="inline-flex items-center gap-1 text-[11px] text-white/80" title={title}>
    <Icon className="size-3.5 opacity-70" />
    {value}
  </span>
);

export const WeatherForecastStrip: FC<{ args: unknown; result: unknown }> = ({ args, result }) => {
  const forecast = asForecast(result);
  const requestedCity = text((args as Record<string, unknown> | null)?.['city']);

  if (!forecast) {
    const message = asMessage(result);
    return (
      <div
        className={`relative my-2 overflow-hidden rounded-2xl border border-white/20 bg-linear-to-br text-white shadow-lg ${NEUTRAL_SKY}`}
      >
        <SkyAmbience kind="cloud" />
        <div className="relative flex items-center gap-2 border-b border-white/15 px-4 py-2.5">
          <CloudSunIcon className="size-4 text-white/70" />
          <p className="text-sm font-semibold">
            Prévisions{requestedCity ? ` · ${requestedCity}` : ''}
          </p>
        </div>
        <p className="relative px-4 py-3 text-sm text-white/85">
          {message ?? 'Chargement des prévisions…'}
        </p>
      </div>
    );
  }

  const place = [forecast.city ?? requestedCity, forecast.country].filter(Boolean).join(' · ');
  const { surface, ambience } = skyOf(forecast.days);

  return (
    <div
      className={`relative my-2 overflow-hidden rounded-2xl border border-white/20 bg-linear-to-br text-white shadow-lg ${surface}`}
    >
      <SkyAmbience kind={ambience} />
      <div className="relative flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-white/15 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <CloudSunIcon className="size-4 text-white/70" />
          Prévisions · {place || '—'}
        </p>
        <p className="text-xs text-white/70">à partir de demain · {forecast.days.length} jour(s)</p>
      </div>

      <div className="relative grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))]">
        {forecast.days.map((day, index) => {
          const [Visual] = visualFor(day.weather);
          const rainy = (day.precipitationProbabilityPercent ?? 0) >= 40;
          return (
            <div
              key={day.date || index}
              className="flex flex-col items-center gap-1.5 rounded-xl bg-white/15 px-2 py-3 text-center ring-1 ring-white/25 ring-inset backdrop-blur-[2px]"
            >
              <p className="text-[11px] font-medium text-white/80">{dayLabel(day.date, index)}</p>
              <span className={`flex size-11 items-center justify-center rounded-full ${CHIP}`}>
                <Visual className="size-6" />
              </span>
              <p className="min-h-[2rem] text-[11px] leading-tight text-white/90 capitalize">
                {day.weather ?? '—'}
              </p>
              <p className="font-mono text-sm">
                <span className="font-semibold">{day.maxCelsius ?? '—'}°</span>
                <span className="text-white/70"> / {day.minCelsius ?? '—'}°</span>
              </p>
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
                <Metric
                  icon={DropletsIcon}
                  title="Probabilité de précipitation"
                  value={`${day.precipitationProbabilityPercent ?? 0} %`}
                />
                {day.rainMm != null && day.rainMm > 0 ? (
                  <Metric
                    icon={CloudRainIcon}
                    title="Pluie max sur 3 h"
                    value={`${day.rainMm} mm`}
                  />
                ) : null}
                {day.windSpeedKmh != null ? (
                  <Metric
                    icon={WindIcon}
                    title={`Vent ${day.windDirection ?? ''}`}
                    value={`${day.windDirection ? `${day.windDirection} ` : ''}${day.windSpeedKmh} km/h`}
                  />
                ) : null}
                {day.humidityPercent != null ? (
                  <Metric
                    icon={DropletsIcon}
                    title="Humidité moyenne"
                    value={`${day.humidityPercent} %`}
                  />
                ) : null}
              </div>
              {rainy ? (
                <span className="rounded-full bg-sky-950/40 px-2 py-0.5 text-[10px] text-sky-100 ring-1 ring-white/20">
                  averses probables
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="relative border-t border-white/15 bg-black/25 px-4 py-3 text-[11px] text-white/70">
        Moyennes agrégées sur les tranches de 3 h d&apos;OpenWeatherMap — aujourd&apos;hui est
        exclu.
        {forecast.days[0]?.feelsLikeCelsius != null
          ? ` Ressenti demain : ${forecast.days[0].feelsLikeCelsius}°.`
          : ''}
      </p>
    </div>
  );
};
