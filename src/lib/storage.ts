// ── Types ──────────────────────────────────────────────────────────────────

export interface TrackState {
  de: boolean;
  en: boolean;
  bilingual: boolean;
}

export interface EpisodeProgress {
  currentTime: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
}

export interface PlaybackState {
  lastActive: {
    seasonId: string;
    seasonTitle: string;
    episodeId: string;
    episodeTitle: string;
    videoUrl: string;
    currentTime: number;
    duration: number;
    updatedAt: string;
    activeTracks: TrackState;
  } | null;
  episodeProgress: Record<string, EpisodeProgress>;
}

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'subsync_playback_state';
const COOKIE_KEY = 'subsync_resume';

// ── Defaults ───────────────────────────────────────────────────────────────

function defaultState(): PlaybackState {
  return { lastActive: null, episodeProgress: {} };
}

// ── SSR guard ──────────────────────────────────────────────────────────────

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// ── Core storage ───────────────────────────────────────────────────────────

/**
 * Load playback state from localStorage. Returns the default state on any
 * error (including SSR where localStorage is unavailable).
 */
export function loadPlaybackState(): PlaybackState {
  if (!isBrowser()) return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PlaybackState>;
    return {
      lastActive: parsed.lastActive ?? null,
      episodeProgress: parsed.episodeProgress ?? {},
    };
  } catch {
    return defaultState();
  }
}

/**
 * Persist playback state to localStorage and update the resume cookie with
 * the serialised `lastActive` value only.
 */
export function savePlaybackState(state: PlaybackState): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded or private-browsing restriction — ignore
  }

  // Keep a lightweight cookie so the server can decide whether to show a
  // "resume watching" prompt before hydration.
  const cookieValue = state.lastActive ? JSON.stringify(state.lastActive) : '';
  setCookie(COOKIE_KEY, cookieValue, 365);
}

// ── Convenience mutators ───────────────────────────────────────────────────

/**
 * Update the progress record for a single episode and persist.
 * Marks the episode as completed when playback is ≥ 90 % of duration.
 */
export function updateEpisodeProgress(
  episodeId: string,
  currentTime: number,
  duration: number
): void {
  const state = loadPlaybackState();
  const completed = duration > 0 && currentTime / duration > 0.9;
  state.episodeProgress[episodeId] = {
    currentTime,
    duration,
    completed,
    updatedAt: new Date().toISOString(),
  };
  savePlaybackState(state);
}

/**
 * Replace `lastActive` with the supplied value and persist.
 */
export function updateLastActive(active: PlaybackState['lastActive']): void {
  const state = loadPlaybackState();
  state.lastActive = active;
  savePlaybackState(state);
}

/**
 * Clear `lastActive` (e.g. user dismisses the resume prompt) and persist.
 */
export function clearLastActive(): void {
  const state = loadPlaybackState();
  state.lastActive = null;
  savePlaybackState(state);
}

// ── Cookie helper ──────────────────────────────────────────────────────────

/**
 * Write a cookie. No-ops on the server.
 */
export function setCookie(key: string, value: string, days: number): void {
  if (!isBrowser()) return;
  try {
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    document.cookie =
      `${encodeURIComponent(key)}=${encodeURIComponent(value)}` +
      `; expires=${expires.toUTCString()}` +
      `; path=/`;
  } catch {
    // Some environments (e.g. sandboxed iframes) disallow cookie access.
  }
}

// ── Formatting ─────────────────────────────────────────────────────────────

/**
 * Format a duration in seconds as "M:SS" or "H:MM:SS" for values ≥ 1 hour.
 *
 * Examples:
 *   formatTime(63)    → "1:03"
 *   formatTime(303)   → "5:03"
 *   formatTime(3725)  → "1:02:05"
 */
export function formatTime(seconds: number): string {
  const totalSec = Math.max(0, Math.floor(seconds));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const ss = String(s).padStart(2, '0');

  if (h > 0) {
    const mm = String(m).padStart(2, '0');
    return `${h}:${mm}:${ss}`;
  }
  // No leading zero on minutes for the common "M:SS" format
  return `${m}:${ss}`;
}
