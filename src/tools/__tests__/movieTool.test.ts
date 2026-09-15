import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmdbSearchTool } from '../movieTool';

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('node-fetch', () => ({
  default: mockFetch,
}));

/** v3 API key shape (32 hex chars) — the one used by .env. */
const V3_KEY = '0123456789abcdef0123456789abcdef';
/** v4 read access token shape (JWT). */
const V4_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.fake.token';

const BLADE_RUNNER = {
  adult: false,
  backdrop_path: '/backdrop.jpg',
  genre_ids: [878, 18],
  id: 78,
  original_language: 'en',
  original_title: 'Blade Runner',
  overview: '2019, Los Angeles. Un ancien Blade Runner reprend du service.',
  popularity: 21.4616,
  poster_path: '/poster.jpg',
  release_date: '1982-06-25',
  title: 'Blade Runner',
  video: false,
  vote_average: 7.936,
  vote_count: 15392,
};

type MovieSearchPayload = {
  type: string;
  query: string;
  page: number;
  totalResults: number;
  results: Array<{
    tmdbId: number;
    title: string;
    originalTitle: string;
    originalLanguage: string;
    releaseDate: string;
    voteAverage: number;
    voteCount: number;
    popularity: number;
    overview: string;
    posterUrl: string | null;
  }>;
};

/** Fails loudly when the tool answered with a message instead of a payload. */
function asPayload(result: unknown): MovieSearchPayload {
  if (typeof result !== 'object' || result === null || !('results' in result)) {
    throw new Error(`expected a movie_search payload, received: ${String(result)}`);
  }

  return result as MovieSearchPayload;
}

const okResponse = (results: unknown[], total = results.length) => ({
  ok: true,
  json: async () => ({ page: 1, results, total_pages: 1, total_results: total }),
});

const errorResponse = (status: number, body: string) => ({
  ok: false,
  status,
  statusText: 'Error',
  text: async () => body,
});

const firstCall = () => mockFetch.mock.calls[0] as [string, { headers: Record<string, string> }];

describe('tmdbSearchTool', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubEnv('TMDB_API_KEY', V3_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Tool metadata', () => {
    it('should exist and be defined', () => {
      expect(tmdbSearchTool).toBeDefined();
    });

    it('should have the correct name', () => {
      expect(tmdbSearchTool.name).toBe('tmdbSearch');
    });

    it('should have a description mentioning TMDB', () => {
      expect(tmdbSearchTool.description).toContain('TMDB');
    });

    it('should have a schema with required query', () => {
      expect(tmdbSearchTool.schema.shape).toHaveProperty('query');
    });
  });

  describe('Schema validation', () => {
    it('should accept a query string', () => {
      expect(tmdbSearchTool.schema.safeParse({ query: 'Blade Runner' }).success).toBe(true);
    });

    it('should reject a missing query', () => {
      expect(tmdbSearchTool.schema.safeParse({}).success).toBe(false);
    });

    it('should reject a non-string query', () => {
      expect(tmdbSearchTool.schema.safeParse({ query: 42 }).success).toBe(false);
    });
  });

  describe('With mocked fetch', () => {
    it('should return a structured movie_search payload', async () => {
      mockFetch.mockResolvedValue(okResponse([BLADE_RUNNER]));

      const result = asPayload(await tmdbSearchTool.invoke({ query: 'Blade Runner' }));

      expect(result.type).toBe('movie_search');
      expect(result.query).toBe('Blade Runner');
      expect(result.page).toBe(1);
      expect(result.totalResults).toBe(1);
      expect(result.results).toHaveLength(1);

      const [movie] = result.results;
      expect(movie.tmdbId).toBe(78);
      expect(movie.title).toBe('Blade Runner');
      expect(movie.originalTitle).toBe('Blade Runner');
      expect(movie.originalLanguage).toBe('en');
      expect(movie.releaseDate).toBe('1982-06-25');
      expect(movie.voteAverage).toBe(7.936);
      expect(movie.voteCount).toBe(15392);
      expect(movie.popularity).toBe(21.4616);
      expect(movie.overview).toContain('Blade Runner');
      expect(movie.posterUrl).toBe('https://image.tmdb.org/t/p/w500/poster.jpg');
    });

    it('should label an unannounced release date', async () => {
      mockFetch.mockResolvedValue(okResponse([{ ...BLADE_RUNNER, release_date: '' }]));

      const result = asPayload(await tmdbSearchTool.invoke({ query: 'Untitled' }));

      expect(result.results[0].releaseDate).toBe('not announced');
    });

    it('should return a null posterUrl when TMDB has no poster', async () => {
      mockFetch.mockResolvedValue(okResponse([{ ...BLADE_RUNNER, poster_path: null }]));

      const result = asPayload(await tmdbSearchTool.invoke({ query: 'Obscure film' }));

      expect(result.results[0].posterUrl).toBeNull();
    });

    it('should truncate the results to 3 while reporting the true total', async () => {
      const many = Array.from({ length: 5 }, (_, i) => ({ ...BLADE_RUNNER, id: i + 1 }));
      mockFetch.mockResolvedValue(okResponse(many, 15));

      const result = asPayload(await tmdbSearchTool.invoke({ query: 'Dune' }));

      expect(result.results).toHaveLength(3);
      expect(result.totalResults).toBe(15);
      expect(result.results.map((movie) => movie.tmdbId)).toEqual([1, 2, 3]);
    });

    it('should return a message instead of a payload when nothing matches', async () => {
      mockFetch.mockResolvedValue(okResponse([]));

      const result = await tmdbSearchTool.invoke({ query: 'zzzzzqqqqxyz' });

      expect(typeof result).toBe('string');
      expect(String(result)).toContain('No movie found');
      expect(String(result)).toContain('zzzzzqqqqxyz');
    });

    it('should send the v3 key as a query parameter with the search options', async () => {
      mockFetch.mockResolvedValue(okResponse([BLADE_RUNNER]));

      await tmdbSearchTool.invoke({ query: 'Blade Runner' });

      const [url, init] = firstCall();
      const params = new URL(url).searchParams;
      expect(url).toContain('https://api.themoviedb.org/3/search/movie');
      expect(params.get('query')).toBe('Blade Runner');
      expect(params.get('language')).toBe('fr-FR');
      expect(params.get('include_adult')).toBe('false');
      expect(params.get('page')).toBe('1');
      expect(params.get('api_key')).toBe(V3_KEY);
      expect(init.headers.Accept).toBe('application/json');
    });

    it('should send a v4 token as a bearer header instead of a query parameter', async () => {
      vi.stubEnv('TMDB_API_KEY', V4_TOKEN);
      mockFetch.mockResolvedValue(okResponse([BLADE_RUNNER]));

      await tmdbSearchTool.invoke({ query: 'Dune' });

      const [url, init] = firstCall();
      expect(new URL(url).searchParams.has('api_key')).toBe(false);
      expect(init.headers.Authorization).toBe(`Bearer ${V4_TOKEN}`);
    });

    it('should tell the user which variable to set when the key is missing', async () => {
      vi.stubEnv('TMDB_API_KEY', '');

      const result = await tmdbSearchTool.invoke({ query: 'Dune' });

      expect(String(result)).toContain('TMDB_API_KEY');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should explain an invalid key on 401 instead of failing the turn', async () => {
      mockFetch.mockResolvedValue(
        errorResponse(401, '{"success":false,"status_code":7,"status_message":"Invalid API key"}')
      );

      const result = await tmdbSearchTool.invoke({ query: 'Dune' });

      expect(String(result)).toContain('Invalid API key');
      expect(String(result)).toContain('v3 API key or v4 read access token');
    });

    it('should surface the TMDB status message on a server error', async () => {
      mockFetch.mockResolvedValue(
        errorResponse(500, '{"success":false,"status_code":11,"status_message":"Internal error"}')
      );

      await expect(tmdbSearchTool.invoke({ query: 'Dune' })).rejects.toThrow('Internal error');
    });

    it('should fall back to the HTTP status when the error body is not JSON', async () => {
      mockFetch.mockResolvedValue(errorResponse(503, '<html>Service unavailable</html>'));

      await expect(tmdbSearchTool.invoke({ query: 'Dune' })).rejects.toThrow(
        'TMDB API error! status: 503'
      );
    });

    it('should report a deadline breach instead of an opaque abort', async () => {
      const aborted = new Error('The operation was aborted.');
      aborted.name = 'AbortError';
      mockFetch.mockRejectedValue(aborted);

      await expect(tmdbSearchTool.invoke({ query: 'Dune' })).rejects.toThrow(
        /TMDB did not respond within \d+ ms\./
      );
    });

    it('should also map a TimeoutError to the deadline message', async () => {
      const timedOut = new Error('The operation was aborted due to timeout');
      timedOut.name = 'TimeoutError';
      mockFetch.mockRejectedValue(timedOut);

      await expect(tmdbSearchTool.invoke({ query: 'Dune' })).rejects.toThrow(
        /TMDB did not respond within \d+ ms\./
      );
    });

    it('should rethrow a network error unchanged', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNRESET'));

      await expect(tmdbSearchTool.invoke({ query: 'Dune' })).rejects.toThrow('ECONNRESET');
    });
  });
});
