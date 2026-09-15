/**
 * TMDB API TypeScript Interfaces
 */

// =============================================================================
// SEARCH INTERFACES
// =============================================================================

export interface MovieSearchResult {
  adult: boolean;
  backdrop_path: string | null; // Relative path — build the URL from the configuration base_url + a size
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string | null; // Relative path — build the URL from the configuration base_url + a size
  release_date: string; // Empty string when the date is not announced yet
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

export interface MovieSearchResponse {
  page: number;
  results: MovieSearchResult[];
  total_pages: number;
  total_results: number;
}

// =============================================================================
// MOVIE DETAILS INTERFACES
// =============================================================================

export interface MovieGenre {
  id: number;
  name: string;
}

export interface MovieCollection {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
}

export interface ProductionCompany {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

export interface ProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface SpokenLanguage {
  english_name: string;
  iso_639_1: string;
  name: string;
}

export interface MovieDetails {
  adult: boolean;
  backdrop_path: string | null;
  belongs_to_collection: MovieCollection | null;
  budget: number;
  genres: MovieGenre[];
  homepage: string | null;
  id: number;
  imdb_id: string | null;
  origin_country: string[];
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string | null;
  production_companies: ProductionCompany[];
  production_countries: ProductionCountry[];
  release_date: string;
  revenue: number;
  runtime: number | null; // 0 or null while the movie is unreleased
  spoken_languages: SpokenLanguage[];
  status: string; // 'Released', 'Post Production', 'Planned', ...
  tagline: string | null;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

// =============================================================================
// CREDITS INTERFACES
// =============================================================================

export interface CastMember {
  adult: boolean;
  gender: number;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
  cast_id: number;
  character: string;
  credit_id: string;
  order: number;
}

export interface CrewMember {
  adult: boolean;
  gender: number;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
  credit_id: string;
  department: string; // 'Directing', 'Writing', 'Production', 'Sound', ...
  job: string; // 'Director', 'Screenplay', 'Producer', ...
}

export interface MovieCredits {
  id: number;
  cast: CastMember[];
  crew: CrewMember[];
}

// Response of /movie/{movie_id}?append_to_response=credits
export type MovieDetailsWithCredits = MovieDetails & { credits?: MovieCredits };

// =============================================================================
// IMAGE CONFIGURATION INTERFACES
// =============================================================================

export interface ImageConfiguration {
  base_url: string; // http://image.tmdb.org/t/p/
  secure_base_url: string; // https://image.tmdb.org/t/p/
  backdrop_sizes: BackdropSize[];
  logo_sizes: string[];
  poster_sizes: PosterSize[];
  profile_sizes: ProfileSize[];
  still_sizes: string[];
}

export interface ApiConfiguration {
  images: ImageConfiguration;
  change_keys: string[];
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type PosterSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original';

export type BackdropSize = 'w300' | 'w780' | 'w1280' | 'original';

export type ProfileSize = 'w45' | 'w185' | 'h632' | 'original';

// =============================================================================
// ERROR TYPES
// =============================================================================

export interface TmdbError {
  success: false;
  status_code: number; // 7 = invalid API key, 25 = invalid query, 34 = resource not found
  status_message: string;
}

// =============================================================================
// FUNCTION PARAMETER TYPES
// =============================================================================

export interface GetMovieSearchParams {
  query: string;
  year?: number;
  language?: string;
  page?: number;
}

export interface GetMovieDetailsParams {
  movieId: number;
  language?: string;
  appendCredits?: boolean;
}
