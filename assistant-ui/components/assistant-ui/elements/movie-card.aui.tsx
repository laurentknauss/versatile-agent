'use client';

import { ClapperboardIcon, FilmIcon, TrendingUpIcon } from 'lucide-react';
import type { CSSProperties, FC } from 'react';

import { BorderBeam } from '@/components/assistant-ui/elements/border-beam';
import { cn } from '@/lib/utils';
import { asMessage, asRecord } from '@/lib/tool-result';

/**
 * Résultat d'un outil `tmdbSearch` — rendu pour l'outil du même nom.
 * Payload de `src/tools/movieTool.ts` : trois films au plus, avec titre, titre
 * original, langue, date de sortie (`not announced` possible), note, nombre de
 * votes, popularité, synopsis et URL d'affiche (`null` quand TMDB n'en a pas).
 * Les affiches viennent de `image.tmdb.org`, servi sans clé.
 */

type Movie = {
  tmdbId: number | null;
  title: string | null;
  originalTitle: string | null;
  originalLanguage: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  voteCount: number | null;
  popularity: number | null;
  overview: string | null;
  posterUrl: string | null;
};

type Search = { query: string | null; totalResults: number | null; movies: Movie[] };

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asMovie = (value: unknown): Movie => {
  const movie = (value ?? {}) as Record<string, unknown>;
  return {
    tmdbId: count(movie['tmdbId']),
    title: text(movie['title']),
    originalTitle: text(movie['originalTitle']),
    originalLanguage: text(movie['originalLanguage']),
    releaseDate: text(movie['releaseDate']),
    voteAverage: count(movie['voteAverage']),
    voteCount: count(movie['voteCount']),
    popularity: count(movie['popularity']),
    overview: text(movie['overview']),
    posterUrl: text(movie['posterUrl']),
  };
};

const asSearch = (result: unknown): Search | null => {
  const record = asRecord(result);
  if (!record || !Array.isArray(record['results'])) return null;
  const movies = record['results'].map(asMovie).filter((movie) => movie.title != null);
  if (movies.length === 0) return null;
  return {
    query: text(record['query']),
    totalResults: count(record['totalResults']),
    movies,
  };
};

/** Année de sortie — `not announced` n'en a pas. */
const yearOf = (releaseDate: string | null): number | null => {
  const match = releaseDate?.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
};

/** « sorti il y a 24 ans » — `null` quand la date est inconnue ou à venir. */
const yearsAgo = (releaseDate: string | null): number | null => {
  const year = yearOf(releaseDate);
  if (year == null) return null;
  const parts = releaseDate?.split('-').map(Number) ?? [];
  const now = new Date();
  let elapsed = now.getUTCFullYear() - year;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  if (
    now.getUTCMonth() + 1 < month ||
    (now.getUTCMonth() + 1 === month && now.getUTCDate() < day)
  ) {
    elapsed -= 1;
  }
  return elapsed >= 0 ? elapsed : null;
};

/** « 5 juin 1998 » — midi UTC pour qu'aucun fuseau ne décale la date. */
const fullDate = (releaseDate: string | null): string | null => {
  if (!releaseDate || yearOf(releaseDate) == null) return null;
  const parsed = new Date(`${releaseDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const LANGUAGES: Record<string, string> = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
  de: 'allemand',
  it: 'italien',
  ja: 'japonais',
  ko: 'coréen',
  zh: 'chinois',
  ru: 'russe',
  pt: 'portugais',
  sv: 'suédois',
  da: 'danois',
  hi: 'hindi',
  ar: 'arabe',
};

type Era = { label: string; text: string; badge: string; from: string; to: string };

/**
 * Accent par époque : la surface reste la salle obscure, mais la couleur du
 * cadre, du badge et de la comète suit la date de sortie — un film de 1962 et
 * un film de 2019 ne se ressemblent pas.
 */
const ERAS: ReadonlyArray<[number, Era]> = [
  [
    1970,
    {
      label: 'classique',
      text: 'text-amber-200',
      badge: 'bg-amber-400/15 ring-amber-400/30',
      from: '#fcd34d',
      to: '#b45309',
    },
  ],
  [
    1990,
    {
      label: 'argentique',
      text: 'text-orange-200',
      badge: 'bg-orange-400/15 ring-orange-400/30',
      from: '#fdba74',
      to: '#c2410c',
    },
  ],
  [
    2010,
    {
      label: 'moderne',
      text: 'text-cyan-200',
      badge: 'bg-cyan-400/15 ring-cyan-400/30',
      from: '#67e8f9',
      to: '#0e7490',
    },
  ],
  [
    Number.POSITIVE_INFINITY,
    {
      label: 'numérique',
      text: 'text-violet-200',
      badge: 'bg-violet-400/15 ring-violet-400/30',
      from: '#c4b5fd',
      to: '#6d28d9',
    },
  ],
];

const eraOf = (year: number | null): Era => {
  const fallback = ERAS[ERAS.length - 1][1];
  if (year == null) return fallback;
  return ERAS.find(([limit]) => year < limit)?.[1] ?? fallback;
};

/** Teinte stable dérivée de l'identifiant TMDB : le repli ne change jamais d'un rendu à l'autre. */
const hueOf = (tmdbId: number | null, title: string): number => {
  const seed = tmdbId ?? [...title].reduce((sum, char) => sum + char.codePointAt(0)!, 0);
  return (seed * 47) % 360;
};

const INITIALS_STOPWORDS = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'the', 'a', 'an', 'of']);

const initialsOf = (title: string): string =>
  title
    .split(/[\s:,'’-]+/)
    .filter((word) => word.length > 1 && !INITIALS_STOPWORDS.has(word.toLowerCase()))
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

const Poster: FC<{ movie: Movie; className: string }> = ({ movie, className }) => {
  const title = movie.title ?? '—';
  if (!movie.posterUrl) {
    const hue = hueOf(movie.tmdbId, title);
    return (
      <div
        role="img"
        aria-label={`Affiche indisponible pour ${title}`}
        className={cn(
          'flex items-center justify-center rounded-lg ring-1 ring-white/15',
          className
        )}
        style={
          {
            backgroundImage: `linear-gradient(165deg, hsl(${hue} 45% 30%), hsl(${(hue + 42) % 360} 55% 12%))`,
          } as CSSProperties
        }
      >
        <span className="font-mono text-lg font-semibold text-white/70">
          {initialsOf(title) || <FilmIcon className="size-5" />}
        </span>
      </div>
    );
  }
  return (
    // `<img>` volontaire : affiche servie par un CDN public, aucun `remotePatterns` à configurer.
    <img
      src={movie.posterUrl}
      alt={`Affiche de ${title}`}
      loading="lazy"
      className={cn('rounded-lg object-cover ring-1 ring-white/15', className)}
    />
  );
};

/** Anneau de note : la couleur dit le score, l'anneau dit la part de 10. */
const RatingRing: FC<{ score: number; votes: number | null }> = ({ score, votes }) => {
  const percent = Math.min(100, Math.max(0, (score / 10) * 100));
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const tone =
    score >= 8 ? 'stroke-emerald-400' : score >= 6.5 ? 'stroke-amber-400' : 'stroke-rose-400';

  return (
    <div className="flex items-center gap-2">
      <svg
        viewBox="0 0 40 40"
        className="size-10 shrink-0 -rotate-90"
        role="img"
        aria-label={`Note ${score.toFixed(1)} sur 10`}
      >
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          strokeWidth="3"
          className="stroke-white/10"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          className={tone}
        />
      </svg>
      <div>
        <p className="font-mono text-sm text-white">
          {score.toFixed(1)}
          <span className="text-slate-500"> / 10</span>
        </p>
        <p className="text-[10px] text-slate-500">
          {votes != null ? `${votes.toLocaleString('fr-FR')} votes` : 'note TMDB'}
        </p>
      </div>
    </div>
  );
};

const Chip: FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span
    className={cn(
      'rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-slate-300 ring-1 ring-white/10',
      className
    )}
  >
    {children}
  </span>
);

const Featured: FC<{ movie: Movie }> = ({ movie }) => {
  const year = yearOf(movie.releaseDate);
  const era = eraOf(year);
  const elapsed = yearsAgo(movie.releaseDate);
  const date = fullDate(movie.releaseDate);
  const language = movie.originalLanguage
    ? (LANGUAGES[movie.originalLanguage.toLowerCase()] ?? movie.originalLanguage)
    : null;

  return (
    <div className="relative grid gap-3 px-4 py-4 sm:grid-cols-[8.25rem_1fr]">
      <Poster movie={movie} className="h-[12.4rem] w-[8.25rem]" />

      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={cn('font-mono text-3xl font-semibold', era.text)}>
            {year ?? 'date inconnue'}
          </span>
          {elapsed != null ? (
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] ring-1', era.badge)}>
              sorti il y a {elapsed} an{elapsed > 1 ? 's' : ''}
            </span>
          ) : (
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] ring-1', era.badge)}>
              sortie non annoncée
            </span>
          )}
          <span className="text-[11px] text-slate-500">{era.label}</span>
        </p>

        <h3 className="mt-1.5 text-base leading-snug font-semibold text-white">
          {movie.title ?? '—'}
        </h3>
        {movie.originalTitle && movie.originalTitle !== movie.title ? (
          <p className="text-xs text-slate-400 italic">{movie.originalTitle}</p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          {movie.voteAverage != null ? (
            <RatingRing score={movie.voteAverage} votes={movie.voteCount} />
          ) : null}
          {movie.popularity != null ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
              <TrendingUpIcon className="size-3.5 opacity-70" />
              popularité {movie.popularity.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {date ? <Chip>{date}</Chip> : null}
          {language ? <Chip>{language}</Chip> : null}
          {movie.tmdbId != null ? <Chip>TMDB #{movie.tmdbId}</Chip> : null}
        </div>

        {movie.overview ? (
          <p
            className="mt-2 line-clamp-4 text-xs leading-relaxed text-slate-300"
            title={movie.overview}
          >
            {movie.overview}
          </p>
        ) : null}
      </div>
    </div>
  );
};

const AlsoInResults: FC<{ movies: Movie[] }> = ({ movies }) => (
  <div className="flex flex-wrap gap-3 border-t border-white/10 px-4 py-3">
    {movies.map((movie) => {
      const year = yearOf(movie.releaseDate);
      return (
        <div key={movie.tmdbId ?? movie.title} className="flex w-40 items-center gap-2">
          <Poster movie={movie} className="h-[3.4rem] w-[2.25rem]" />
          <div className="min-w-0">
            <p
              className="truncate text-[11px] font-medium text-slate-200"
              title={movie.title ?? ''}
            >
              {movie.title}
            </p>
            <p className="font-mono text-[10px] text-slate-500">{year ?? '—'}</p>
          </div>
        </div>
      );
    })}
  </div>
);

export const MovieCard: FC<{ args: unknown; result: unknown }> = ({ args, result }) => {
  const search = asSearch(result);
  const requested = text((args as Record<string, unknown> | null)?.['query']);

  if (!search) {
    const message = asMessage(result);
    return (
      <div className="relative my-2 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-950 via-indigo-950 to-slate-950 text-slate-100 shadow-lg">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <ClapperboardIcon className="size-4 text-slate-400" />
          <p className="text-sm font-semibold text-white">
            Cinéma{requested ? ` · ${requested}` : ''}
          </p>
        </div>
        <p className="px-4 py-3 text-sm text-slate-300">
          {message ?? 'Recherche dans le catalogue…'}
        </p>
      </div>
    );
  }

  const [featured, ...others] = search.movies;
  const era = eraOf(yearOf(featured.releaseDate));
  const label = search.query ?? requested;

  return (
    <div className="relative my-2 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-950 via-indigo-950 to-slate-950 text-slate-100 shadow-lg">
      {/* Salle obscure : un halo de projecteur tombe du haut du cadre. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[140%] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(199,210,254,0.16),transparent)] blur-2xl"
      />
      <BorderBeam size={70} duration={8} colorFrom={era.from} colorTo={era.to} />

      <div className="relative flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-white/10 px-4 py-2.5">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <ClapperboardIcon className="size-4 text-slate-400" />
          Cinéma{label ? ` · ${label}` : ''}
        </p>
        <p className="text-xs text-slate-500">
          {search.totalResults != null
            ? search.totalResults > search.movies.length
              ? `${search.movies.length} affichés sur ${search.totalResults.toLocaleString('fr-FR')} trouvés`
              : `${search.movies.length} résultat(s) chez TMDB`
            : 'TMDB'}
        </p>
      </div>

      <Featured movie={featured} />
      {others.length > 0 ? <AlsoInResults movies={others} /> : null}

      <p className="border-t border-white/10 bg-black/30 px-4 py-2.5 text-[11px] text-slate-500">
        Données et affiches TMDB — images servies par image.tmdb.org, note sur 10.
      </p>
    </div>
  );
};
