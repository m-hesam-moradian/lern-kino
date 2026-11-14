/**
 * LernKino Subtitle & Caption Types
 * Models for SRT cues, dual subtitle rendering, and user preferences.
 */

export interface SubtitleCue {
  /** 1-based cue index from the SRT file */
  index: number;
  /** Start time in seconds (floating point) */
  startTime: number;
  /** End time in seconds (floating point) */
  endTime: number;
  /** Original subtitle text preserving formatting tags */
  rawText: string;
  /** Cleaned text without formatting tags (preserves line breaks) */
  text: string;
  /** Tokenized words, punctuation, and whitespace for interactive lookup */
  tokens: string[];
}

export type CaptionMode = 'both' | 'de' | 'en' | 'off';
export type CaptionFontSize = 'sm' | 'md' | 'lg' | 'xl';
export type CaptionEnColor = 'yellow' | 'cyan' | 'white';
export type CaptionBgOpacity = 'glass' | 'dark' | 'minimal';

export interface SubtitlePreferences {
  /** Active caption mode */
  mode: CaptionMode;
  /** Text sizing */
  fontSize: CaptionFontSize;
  /** English subtitle color */
  enColor: CaptionEnColor;
  /** Background box styling */
  bgOpacity: CaptionBgOpacity;
  /** Global audio/subtitle sync offset in seconds (e.g. -0.2s or +0.3s) */
  offsetSeconds: number;
}

export interface SubtitleTrackState {
  cues: SubtitleCue[];
  loaded: boolean;
  error: string | null;
  sourceUrl: string | null;
  fileName?: string | null;
}
