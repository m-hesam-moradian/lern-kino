import type { MediaCatalog, Series, Movie, Season, Episode } from '@/types/media';
import rawCatalog from '@/data/catalog.json';

/**
 * Strongly-typed access to the generated media catalog.
 */
export const catalog: MediaCatalog = rawCatalog as unknown as MediaCatalog;

/**
 * Returns the entire catalog manifest.
 */
export function getCatalog(): MediaCatalog {
  return catalog;
}

/**
 * Returns all series in the catalog.
 */
export function getAllSeries(): Series[] {
  return catalog.series || [];
}

/**
 * Finds a series by its unique slug (e.g. "friends").
 */
export function getSeriesBySlug(slug: string): Series | undefined {
  const normalized = slug.toLowerCase();
  return catalog.series?.find((s) => s.slug.toLowerCase() === normalized);
}

/**
 * Finds a specific episode across a series by series slug, season number, and episode number.
 */
export function getEpisode(seriesSlug: string, seasonNumber: number, episodeNumber: number): Episode | undefined {
  const series = getSeriesBySlug(seriesSlug);
  if (!series) return undefined;
  const season = series.seasons.find((s) => s.seasonNumber === seasonNumber);
  return season?.episodes.find((e) => e.episodeNumber === episodeNumber);
}

/**
 * Returns all movies in the catalog.
 */
export function getAllMovies(): Movie[] {
  return catalog.movies || [];
}

/**
 * Finds a movie by its unique slug (e.g. "good-bye-lenin").
 */
export function getMovieBySlug(slug: string): Movie | undefined {
  const normalized = slug.toLowerCase();
  return catalog.movies?.find((m) => m.slug.toLowerCase() === normalized);
}

/**
 * Returns all featured series and movies for showcase carousels / hero banners.
 */
export function getFeaturedItems(): { series: Series[]; movies: Movie[] } {
  const allSeries = getAllSeries();
  const allMovies = getAllMovies();

  const featuredSeries = allSeries.filter((s) => s.featured);
  const featuredMovies = allMovies.filter((m) => m.featured);

  return {
    series: featuredSeries.length > 0 ? featuredSeries : allSeries.slice(0, 1),
    movies: featuredMovies.length > 0 ? featuredMovies : allMovies.slice(0, 1),
  };
}

// ── Legacy Compatibility Helpers ─────────────────────────────────────────────

export function getSeasons(): Season[] {
  if (catalog.series && catalog.series.length > 0) {
    return catalog.series[0].seasons || [];
  }
  return catalog.seasons || [];
}

export function getSeason(seasonNumber: number): Season | undefined {
  return getSeasons().find((s) => s.seasonNumber === seasonNumber);
}

export function getAllEpisodes(): Episode[] {
  return getAllSeries().flatMap((s) => s.seasons.flatMap((season) => season.episodes));
}
