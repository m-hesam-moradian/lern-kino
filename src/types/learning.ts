/**
 * LernKino Language-Learning Types
 * Data models for watch history, Leitner Box spaced repetition, and vocabulary flashcards.
 */

export type LeitnerBoxLevel = 1 | 2 | 3 | 4 | 5;

export interface WatchProgress {
  /** Unique key: `${seriesSlug}-${seasonNumber}-${episodeNumber}` or `movie-${movieSlug}` */
  id: string;
  type: 'episode' | 'movie';
  seriesSlug?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  movieSlug?: string;
  title: string;
  seriesTitle?: string;
  /** Current playback position in seconds */
  currentTime: number;
  /** Total media duration in seconds */
  duration: number;
  /** ISO timestamp of last interaction */
  lastWatchedAt: string;
  /** True if user reached >= 90% completion */
  completed: boolean;
}

export interface VocabReviewAttempt {
  reviewedAt: string; // ISO timestamp
  correct: boolean;
  previousLevel: LeitnerBoxLevel;
  newLevel: LeitnerBoxLevel;
}

export interface SavedVocabCard {
  id: string;
  /** German target word or phrase */
  word: string;
  /** English translation */
  translation: string;
  /** Optional German subtitle context sentence */
  contextSentenceGerman?: string;
  /** Optional English subtitle translation sentence */
  contextSentenceEnglish?: string;
  /** Playback timestamp when saved */
  timestampSeconds?: number;
  mediaSourceTitle?: string;
  seriesSlug?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  movieSlug?: string;
  /** Leitner Box index: 1 (daily) through 5 (mastered) */
  boxLevel: LeitnerBoxLevel;
  /** ISO timestamp when the card should be reviewed next */
  nextReviewAt: string;
  lastReviewedAt?: string;
  reviewHistory: VocabReviewAttempt[];
  notes?: string;
}
