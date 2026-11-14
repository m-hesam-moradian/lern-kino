/**
 * LernKino Media Types
 * Strict, future-ready interfaces for static video streaming catalog supporting Series & Movies.
 */

export interface SubtitleAvailability {
  /** Relative or absolute URL to German .srt dubtitle */
  de: string | null;
  /** Relative or absolute URL to English .srt subtitle */
  en: string | null;
}

export interface EpisodeMeta {
  title?: string;
  description?: string;
  videoUrl?: string;
  videoFile?: string;
  duration?: number;
  durationSeconds?: number;
}

export interface Episode {
  /** Unique episode identifier, e.g. "s01e01" */
  id: string;
  /** Parent series slug, e.g. "friends" */
  seriesSlug: string;
  /** Numerical season index (1-based) */
  seasonNumber: number;
  /** Numerical episode index (1-based) */
  episodeNumber: number;
  /** Display title for the episode */
  title: string;
  /** Optional synopsis or description */
  description?: string;
  /** Relative path to local video or external URL, or null if missing */
  videoSrc: string | null;
  /** True if video is loaded from external URL */
  isExternalVideo: boolean;
  /** Relative path to thumbnail image or null if missing */
  thumbnailSrc: string | null;
  /** Subtitle availability for German and English */
  subtitles: SubtitleAvailability;
  /** Optional duration in seconds */
  durationSeconds?: number;
}

export interface Season {
  /** Numerical season index (1-based) */
  seasonNumber: number;
  /** Display title, e.g. "Season 1" */
  title: string;
  /** List of sorted episodes for this season */
  episodes: Episode[];
}

export interface SeriesMeta {
  title: string;
  description?: string;
  language?: string;
  genres?: string[];
  featured?: boolean;
  poster?: string;
  backdrop?: string;
  videoBaseUrl?: string;
}

export interface Series {
  /** Unique slug for routing, e.g. "friends" */
  slug: string;
  /** Display title */
  title: string;
  /** Series synopsis */
  description?: string;
  /** Learning target language (e.g. "de") */
  language?: string;
  /** List of genre tags */
  genres: string[];
  /** Whether highlighted in the hero banner */
  featured: boolean;
  /** Poster image URL/path */
  posterSrc: string | null;
  /** Backdrop landscape banner URL/path */
  backdropSrc: string | null;
  /** Optional external video base CDN URL */
  videoBaseUrl?: string;
  /** Total season count */
  totalSeasons: number;
  /** Total episode count */
  totalEpisodes: number;
  /** Nested seasons and episodes */
  seasons: Season[];
}

export interface MovieMeta {
  title: string;
  description?: string;
  language?: string;
  genres?: string[];
  featured?: boolean;
  poster?: string;
  backdrop?: string;
  videoUrl?: string;
  videoFile?: string;
  duration?: number;
  durationSeconds?: number;
  releaseYear?: number;
}

export interface Movie {
  /** Unique slug for routing, e.g. "good-bye-lenin" */
  slug: string;
  /** Display title */
  title: string;
  /** Synopsis */
  description?: string;
  /** Target language (e.g. "de") */
  language?: string;
  /** Genres */
  genres: string[];
  /** Whether highlighted in hero or suggestions */
  featured: boolean;
  /** Poster image path/URL */
  posterSrc: string | null;
  /** Backdrop banner image */
  backdropSrc: string | null;
  /** Video source path or external URL */
  videoSrc: string | null;
  /** True if external URL */
  isExternalVideo: boolean;
  /** Subtitle tracks */
  subtitles: SubtitleAvailability;
  /** Duration in seconds */
  durationSeconds?: number;
  /** Release year */
  releaseYear?: number;
}

export interface MediaCatalog {
  /** ISO timestamp when catalog was indexed */
  generatedAt: string;
  /** Total number of discovered series */
  totalSeries: number;
  /** Total number of discovered movies */
  totalMovies: number;
  /** Total number of discovered episodes across all series */
  totalEpisodes: number;
  /** Hierarchical series list */
  series: Series[];
  /** Movies list */
  movies: Movie[];

  // Legacy compatibility fields
  totalSeasons?: number;
  seasons?: Season[];
}
