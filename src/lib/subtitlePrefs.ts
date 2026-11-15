/**
 * LernKino Subtitle Preferences & Loader Engine
 * Persists user subtitle settings in localStorage and provides robust fetch / file loaders.
 */

import { parseSRT } from '@/lib/srtParser';
import { withBasePath } from '@/lib/paths';
import type {
  SubtitlePreferences,
  CaptionMode,
  CaptionFontSize,
  CaptionEnColor,
  CaptionBgOpacity,
  SubtitleCue,
} from '@/types/subtitles';

export const SUBTITLE_PREFS_STORAGE_KEY = 'lernkino_subtitle_prefs';

export const DEFAULT_SUBTITLE_PREFERENCES: SubtitlePreferences = {
  mode: 'both',
  fontSize: 'md',
  enColor: 'yellow',
  bgOpacity: 'glass',
  offsetSeconds: 0,
  snappyDialogue: true,
};

/**
 * Safely retrieves stored subtitle preferences from localStorage with fallback to defaults.
 */
export function getSubtitlePreferences(): SubtitlePreferences {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SUBTITLE_PREFERENCES };
  }

  try {
    const raw = localStorage.getItem(SUBTITLE_PREFS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SUBTITLE_PREFERENCES };
    }
    const parsed = JSON.parse(raw) as Partial<SubtitlePreferences>;

    const validModes: CaptionMode[] = ['both', 'de', 'en', 'off'];
    const validSizes: CaptionFontSize[] = ['sm', 'md', 'lg', 'xl'];
    const validColors: CaptionEnColor[] = ['yellow', 'cyan', 'white'];
    const validOpacities: CaptionBgOpacity[] = ['glass', 'dark', 'minimal'];

    return {
      mode: validModes.includes(parsed.mode as CaptionMode) ? (parsed.mode as CaptionMode) : DEFAULT_SUBTITLE_PREFERENCES.mode,
      fontSize: validSizes.includes(parsed.fontSize as CaptionFontSize) ? (parsed.fontSize as CaptionFontSize) : DEFAULT_SUBTITLE_PREFERENCES.fontSize,
      enColor: validColors.includes(parsed.enColor as CaptionEnColor) ? (parsed.enColor as CaptionEnColor) : DEFAULT_SUBTITLE_PREFERENCES.enColor,
      bgOpacity: validOpacities.includes(parsed.bgOpacity as CaptionBgOpacity) ? (parsed.bgOpacity as CaptionBgOpacity) : DEFAULT_SUBTITLE_PREFERENCES.bgOpacity,
      offsetSeconds: typeof parsed.offsetSeconds === 'number' && !isNaN(parsed.offsetSeconds) ? parsed.offsetSeconds : 0,
      snappyDialogue: typeof parsed.snappyDialogue === 'boolean' ? parsed.snappyDialogue : DEFAULT_SUBTITLE_PREFERENCES.snappyDialogue,
    };
  } catch (err) {
    console.warn('[LernKino] Failed to read subtitle preferences:', err);
    return { ...DEFAULT_SUBTITLE_PREFERENCES };
  }
}

/**
 * Saves updated preferences to localStorage and returns the merged object.
 */
export function saveSubtitlePreferences(
  updates: Partial<SubtitlePreferences>
): SubtitlePreferences {
  const current = getSubtitlePreferences();
  const merged: SubtitlePreferences = { ...current, ...updates };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SUBTITLE_PREFS_STORAGE_KEY, JSON.stringify(merged));
    } catch (err) {
      console.warn('[LernKino] Failed to save subtitle preferences:', err);
    }
  }

  return merged;
}

/**
 * Fetches an SRT subtitle track from a URL (handling withBasePath, relative paths, and network errors).
 * Returns an array of SubtitleCue objects (empty array on error without throwing).
 */
export async function fetchSubtitleTrack(url: string | null | undefined): Promise<SubtitleCue[]> {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return [];
  }

  try {
    const resolvedUrl = withBasePath(url.trim());
    const res = await fetch(resolvedUrl);

    if (!res.ok) {
      console.warn(`[LernKino] Subtitle track fetch returned status ${res.status}: ${resolvedUrl}`);
      return [];
    }

    const text = await res.text();
    return parseSRT(text);
  } catch (err) {
    console.warn(`[LernKino] Failed to fetch or parse subtitle track from "${url}":`, err);
    return [];
  }
}

/**
 * Loads and parses a local user-selected .srt file from disk.
 */
export async function loadLocalSubtitleFile(file: File): Promise<SubtitleCue[]> {
  if (!file) return [];

  try {
    const text = await file.text();
    return parseSRT(text);
  } catch (err) {
    console.warn('[LernKino] Failed to read local subtitle file:', err);
    return [];
  }
}

/**
 * Visual styling classes for font sizes
 */
export const SUBTITLE_FONT_SIZE_CLASSES: Record<CaptionFontSize, { de: string; en: string }> = {
  sm: {
    de: 'text-sm sm:text-base md:text-lg font-bold',
    en: 'text-xs sm:text-sm md:text-base font-medium',
  },
  md: {
    de: 'text-base sm:text-xl md:text-2xl font-bold tracking-tight',
    en: 'text-xs sm:text-base md:text-lg font-medium',
  },
  lg: {
    de: 'text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight',
    en: 'text-sm sm:text-lg md:text-xl font-medium',
  },
  xl: {
    de: 'text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight',
    en: 'text-base sm:text-xl md:text-2xl font-semibold',
  },
};

/**
 * Visual styling classes for English subtitle color
 */
export const SUBTITLE_EN_COLOR_CLASSES: Record<CaptionEnColor, string> = {
  yellow: 'text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]',
  cyan: 'text-cyan-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]',
  white: 'text-slate-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]',
};

/**
 * Visual styling classes for caption background box
 */
export const SUBTITLE_BG_CLASSES: Record<CaptionBgOpacity, string> = {
  glass: 'bg-black/60 backdrop-blur-md border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)]',
  dark: 'bg-black/85 backdrop-blur-sm border border-black/50 shadow-2xl',
  minimal: 'bg-black/35 backdrop-blur-[2px] border border-transparent shadow-md',
};
