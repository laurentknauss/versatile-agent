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
import type { ComponentType, FC } from 'react';

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

const count = (value: unknown): number | null => (typeof value === 'number' ? value : null);

/**
 * Visuel d'une condition, du plus violent au plus calme : l'ordre compte, un
 * « orage avec pluie » doit tomber sur l'orage avant d'atteindre « pluie ».
 * Les descriptions viennent d'OpenWeatherMap en `lang=fr`.
 */
const VISUALS: ReadonlyArray<[RegExp, ComponentType<{ className?: string }>, string]> = [
  [/orage|tonnerre/i, CloudLightningIcon, 'bg-violet-500/25 text-violet-100'],
  [/neige|verglas|gr[eê]le/i, CloudSnowIcon, 'bg-sky-100/25 text-sky-50'],
  [/fortes? (averses|pluies)|pluie forte/i, CloudRainIcon, 'bg-sky-600/40 text-sky-50'],
  [/averses?/i, CloudRainIcon, 'bg-sky-500/30 text-sky-50'],
  [/bruine/i, CloudDrizzleIcon, 'bg-sky-400/25 text-sky-50'],
  [/pluie/i, CloudRainIcon, 'bg-sky-500/30 text-sky-50'],
  [/brouillard|brume/i, CloudFogIcon, 'bg-slate-400/25 text-slate-50'],
  [/couvert/i, CloudIcon, 'bg-slate-500/30 text-slate-50'],
  [/nuage|nuages/i, CloudSunIcon, 'bg-slate-300/20 text-white'],
  [/d[eé]gag[eé]|ensoleill|clair/i, SunIcon, 'bg-amber-400/25 text-amber-100'],
];

const visualFor = (
  description: string | null
): readonly [ComponentType<{ className?: string }>, string] => {
  const match = description ? VISUALS.find(([pattern]) => pattern.test(description)) : null;
  return match ? [match[1], match[2]] : [CloudIcon, 'bg-white/15 text-white/80'];
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
  <span className="inline-flex items-center gap-1 text-[11px] text-white/70" title={title}>
    <Icon className="size-3.5 opacity-80" />
    {value}
  </span>
);

export const WeatherForecastStrip: FC<{ args: unknown; result: unknown }> = ({ args, result }) => {
  const forecast = asForecast(result);
  const requestedCity = text((args as Record<string, unknown> | null)?.['city']);

  if (!forecast) {
    const message = asMessage(result);
    return (
      <div className="my-2 overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <CloudSunIcon className="size-4 text-white/70" />
          <p className="text-sm font-semibold text-white/90">
            Prévisions{requestedCity ? ` · ${requestedCity}` : ''}
          </p>
        </div>
        <p className="px-4 py-3 text-sm text-white/80">{message ?? 'Chargement des prévisions…'}</p>
      </div>
    );
  }

  const place = [forecast.city ?? requestedCity, forecast.country].filter(Boolean).join(' · ');

  return (
    <div className="my-2 overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-white/10 px-4 py-2.5">
        <p className="flex items-center gap-2 text-sm font-semibold text-white/90">
          <CloudSunIcon className="size-4 text-white/70" />
          Prévisions · {place || '—'}
        </p>
        <p className="text-xs text-white/65">à partir de demain · {forecast.days.length} jour(s)</p>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))]">
        {forecast.days.map((day, index) => {
          const [Visual, tone] = visualFor(day.weather);
          const rainy = (day.precipitationProbabilityPercent ?? 0) >= 40;
          return (
            <div
              key={day.date || index}
              className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 px-2 py-3 text-center"
            >
              <p className="text-[11px] font-medium text-white/75">{dayLabel(day.date, index)}</p>
              <span className={`flex size-11 items-center justify-center rounded-full ${tone}`}>
                <Visual className="size-6" />
              </span>
              <p className="min-h-[2rem] text-[11px] leading-tight text-white/80 capitalize">
                {day.weather ?? '—'}
              </p>
              <p className="font-mono text-sm">
                <span className="font-semibold">{day.maxCelsius ?? '—'}°</span>
                <span className="text-white/60"> / {day.minCelsius ?? '—'}°</span>
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
                <span className="rounded-full bg-sky-500/25 px-2 py-0.5 text-[10px] text-sky-50">
                  averses probables
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="border-t border-white/10 px-4 py-2 text-[11px] text-white/55">
        Moyennes agrégées sur les tranches de 3 h d&apos;OpenWeatherMap — aujourd&apos;hui est
        exclu.
        {forecast.days[0]?.feelsLikeCelsius != null
          ? ` Ressenti demain : ${forecast.days[0].feelsLikeCelsius}°.`
          : ''}
      </p>
    </div>
  );
};
