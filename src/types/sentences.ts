/**
 * LernKino Sentence Practice & Interactive Learning Types
 * Models for saved whole sentences and multi-choice practice modes.
 */

export type SentencePracticeMode =
  | 'make-sentence'        // Word Scramble / Sentence Builder
  | 'translate-en-to-de'  // English -> German Translation Quiz
  | 'translate-de-to-en'  // German -> English Meaning Quiz
  | 'cloze'                // Empty Word (Fill-in-the-blank)
  | 'listen';              // Audio Listening Comprehension

export interface SavedSentence {
  id: string;
  /** Clean German sentence */
  german: string;
  /** English translation sentence */
  english: string;
  /** Playback timestamp in seconds */
  timestampSeconds?: number;
  mediaSourceTitle?: string;
  seriesSlug?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  movieSlug?: string;
  /** ISO timestamp when saved */
  savedAt: string;
  lastPracticedAt?: string;
  timesPracticed: number;
  timesCorrect: number;
  mastered?: boolean;
  notes?: string;
}

export interface ClozeExercise {
  sentenceWithBlank: string;
  missingWord: string;
  options: string[];
}

export interface ScrambleExercise {
  shuffledWords: string[];
  correctWords: string[];
}

export interface ChoiceExercise {
  prompt: string;
  correctAnswer: string;
  options: string[];
}
