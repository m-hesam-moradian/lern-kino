import type { WatchProgress } from '@/types/learning';

const STORAGE_KEY = 'lernkino_watch_history';
const COOKIE_KEY = 'lernkino_last_watched';
const COOKIE_MAX_AGE = 2592000; // 30 days in seconds

/**
 * Formats seconds into MM:SS or H:MM:SS string.
 */
export function formatTimestamp(seconds: number | undefined | null): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '00:00';
  }
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

/**
 * SSR-safe helper to read all watch history from localStorage.
 */
export function getWatchHistory(): WatchProgress[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort(
      (a, b) => new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime()
    );
  } catch (err) {
    console.warn('[LernKino] Failed to read watch history from localStorage:', err);
    return [];
  }
}

/**
 * Retrieves watch progress for a specific media item by its ID.
 */
export function getProgressForMedia(id: string): WatchProgress | null {
  const history = getWatchHistory();
  return history.find((item) => item.id === id) || null;
}

/**
 * Helper to write a lightweight snapshot of the latest watched item to cookie.
 */
function writeLastWatchedCookie(progress: WatchProgress): void {
  if (typeof document === 'undefined') return;
  try {
    const snapshot = {
      id: progress.id,
      type: progress.type,
      seriesSlug: progress.seriesSlug,
      seasonNumber: progress.seasonNumber,
      episodeNumber: progress.episodeNumber,
      movieSlug: progress.movieSlug,
      title: progress.title,
      seriesTitle: progress.seriesTitle,
      currentTime: progress.currentTime,
      duration: progress.duration,
      lastWatchedAt: progress.lastWatchedAt,
      completed: progress.completed,
    };
    const encoded = encodeURIComponent(JSON.stringify(snapshot));
    document.cookie = `${COOKIE_KEY}=${encoded}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
  } catch (err) {
    console.warn('[LernKino] Failed to set last watched cookie:', err);
  }
}

/**
 * Helper to read snapshot from cookie if localStorage was cleared.
 */
function readLastWatchedCookie(): WatchProgress | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(new RegExp(`(^|;\\s*)${COOKIE_KEY}=([^;]*)`));
    if (!match) return null;
    const decoded = decodeURIComponent(match[2]);
    return JSON.parse(decoded) as WatchProgress;
  } catch {
    return null;
  }
}

/**
 * Returns the most recent watched item from localStorage (or cookie backup).
 */
export function getLastWatched(): WatchProgress | null {
  const history = getWatchHistory();
  if (history.length > 0) {
    return history[0];
  }
  return readLastWatchedCookie();
}

/**
 * Saves or updates watch progress in localStorage and cookie backup.
 * Automatically marks completed: true if progress reaches >= 95% of duration.
 */
export function saveWatchProgress(progress: WatchProgress): void {
  if (typeof window === 'undefined') return;

  try {
    const isCompleted =
      progress.duration > 0 && progress.currentTime / progress.duration >= 0.95;

    const updatedItem: WatchProgress = {
      ...progress,
      completed: isCompleted,
      lastWatchedAt: new Date().toISOString(),
    };

    const history = getWatchHistory();
    const existingIndex = history.findIndex((h) => h.id === updatedItem.id);

    if (existingIndex >= 0) {
      history.splice(existingIndex, 1);
    }
    history.unshift(updatedItem);

    // Keep up to 100 entries to prevent unbounded growth
    const trimmed = history.slice(0, 100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    writeLastWatchedCookie(updatedItem);
  } catch (err) {
    console.warn('[LernKino] Failed to save watch progress:', err);
  }
}

/**
 * Removes a specific media item from watch history.
 */
export function removeWatchProgress(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getWatchHistory().filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    const last = getLastWatched();
    if (last && last.id === id) {
      if (history.length > 0) {
        writeLastWatchedCookie(history[0]);
      } else if (typeof document !== 'undefined') {
        document.cookie = `${COOKIE_KEY}=; max-age=0; path=/; SameSite=Lax`;
      }
    }
  } catch (err) {
    console.warn('[LernKino] Failed to remove watch progress:', err);
  }
}
