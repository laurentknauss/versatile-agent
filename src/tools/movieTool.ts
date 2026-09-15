import { tool } from '@langchain/core/tools';
import fetch from 'node-fetch';
import { z } from 'zod';
import { MovieSearchResponse, TmdbError } from './types/movie';

// =============================================================================
// TMDB API CONFIGURATION
// =============================================================================

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const DEFAULT_LANGUAGE = 'fr-FR';
const MAX_RESULTS = 3;

/** Hard deadline for a TMDB request. */
const FETCH_TIMEOUT_MS = Number(process.env.TMDB_FETCH_TIMEOUT_MS ?? 15_000);

function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  // v4 read access tokens (JWT) go in the Authorization header
  if (apiKey.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return headers;
}

function buildSearchUrl(apiKey: string, query: string): string {
  const params = new URLSearchParams({
    query,
    language: DEFAULT_LANGUAGE,
    include_adult: 'false',
    page: '1',
  });

  // v3 API keys (32 hex chars) go in the query string
  if (!apiKey.startsWith('eyJ')) {
    params.append('api_key', apiKey);
  }

  return `${TMDB_BASE_URL}/search/movie?${params.toString()}`;
}

/**
 * TMDB call with a hard deadline.
 * node-fetch reports an expired AbortSignal as AbortError, not TimeoutError.
 */
async function fetchTmdb(url: string, headers: Record<string, string>) {
  try {
    return await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (error) {
    const expired =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

    if (expired) {
      throw new Error(`TMDB did not respond within ${FETCH_TIMEOUT_MS} ms.`);
    }

    throw error;
  }
}

// =============================================================================
// TMDB TOOL
// =============================================================================

const tmdbSearchFunc = async ({ query }: { query: string }) => {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return `❌ TMDB_API_KEY is not set. Add it to your environment variables to use the TMDB search tool.`;
  }

  const url = buildSearchUrl(apiKey, query);
  const response = await fetchTmdb(url, buildHeaders(apiKey));

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`TMDB API Error: ${response.status} ${response.statusText}`, errorBody);

    let message = `TMDB API error! status: ${response.status}`;
    try {
      const err = JSON.parse(errorBody) as TmdbError;
      if (err.status_message) {
        message = `TMDB API error ${err.status_code}: ${err.status_message}`;
      }
    } catch {
      // Non-JSON error body — keep the HTTP status message.
    }

    if (response.status === 401) {
      return `❌ ${message}. Check that TMDB_API_KEY is a valid v3 API key or v4 read access token.`;
    }

    throw new Error(message);
  }

  const data = (await response.json()) as MovieSearchResponse;
  const results = data.results.slice(0, MAX_RESULTS);

  if (results.length === 0) {
    return `❌ No movie found for "${query}". Try a different title or keywords.`;
  }

  return {
    type: 'movie_search',
    query,
    page: data.page,
    totalResults: data.total_results,
    results: results.map((movie) => ({
      tmdbId: movie.id,
      title: movie.title,
      originalTitle: movie.original_title,
      originalLanguage: movie.original_language,
      releaseDate: movie.release_date || 'not announced',
      voteAverage: movie.vote_average,
      voteCount: movie.vote_count,
      popularity: movie.popularity,
      overview: movie.overview,
      posterUrl: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : null,
    })),
  };
};

export const tmdbSearchTool = tool(tmdbSearchFunc, {
  name: 'tmdbSearch',
  description:
    'Search the TMDB (The Movie Database) movie catalogue by title or keywords. Returns the matching movies with release date, rating, overview and poster URL.',
  schema: z.object({
    query: z.string().describe("Search text — movie title or keywords (e.g. 'Blade Runner')"),
  }),
});
