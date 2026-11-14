/**
 * LernKino Zero-Dependency SRT Subtitle Parser
 *
 * Robust, client-side WebVTT / SRT parser designed for:
 * - Windows / Unix line endings (\r\n -> \n)
 * - UTF-8 Byte Order Mark (\uFEFF) removal
 * - German special characters (ä, ö, ü, ß) & Unicode accents
 * - Both comma (,) and dot (.) millisecond separators (00:01:23,456 and 00:01:23.456)
 * - HTML formatting tag stripping while preserving multi-line breaks (\n)
 * - Word & punctuation tokenization for interactive vocabulary lookups (Step 5)
 * - Sub-millisecond binary search cue lookup (findActiveCues)
 */

import type { SubtitleCue } from '@/types/subtitles';

/**
 * Strips UTF-8 Byte Order Mark (\uFEFF) if present.
 */
export function stripBOM(str: string): string {
  if (str.charCodeAt(0) === 0xfeff) {
    return str.slice(1);
  }
  return str;
}

/**
 * Parses timestamp string into seconds (float).
 * Supports:
 *   "00:01:23,456" -> 83.456
 *   "00:01:23.456" -> 83.456
 *   "01:23,456"    -> 83.456
 */
export function parseTimestamp(timeStr: string): number {
  const clean = timeStr.trim().replace(',', '.');
  const parts = clean.split(':');

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  }

  return parseFloat(clean) || 0;
}

/**
 * Strips inline HTML tags (<i>, <b>, <u>, <font color="...">, etc.)
 * while unescaping common HTML entities and preserving newlines.
 */
export function cleanSubtitleText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '') // remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
    .trim();
}

/**
 * Determines whether a given token is a speakable/lookupable word.
 * Matches German words with umlauts (ä, ö, ü, ß), numbers, and internal hyphens/apostrophes (e.g. "geht's", "Wiedersehen").
 */
export function isWordToken(token: string): boolean {
  if (!token) return false;
  return /^[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*$/u.test(token);
}

/**
 * Tokenizes text preserving exact layout:
 * Words, whitespace, and punctuation are separate tokens.
 * Invariant: tokens.join('') === text
 */
export function tokenizeSubtitleText(text: string): string[] {
  if (!text) return [];
  // Match word sequences (with internal apostrophes/hyphens), whitespace sequences, or individual punctuation/symbols
  const tokenRegex = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*|\s+|[^\s\p{L}\p{N}]+/gu;
  const matches = text.match(tokenRegex);
  return matches && matches.length > 0 ? matches : [text];
}

/**
 * Parses raw SRT string content into a sorted array of SubtitleCue objects.
 */
export function parseSRT(rawSrt: string): SubtitleCue[] {
  if (!rawSrt || typeof rawSrt !== 'string') {
    return [];
  }

  // 1. Strip BOM and normalize line breaks
  const normalized = stripBOM(rawSrt).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Split into cue blocks (blocks separated by two or more newlines)
  const rawBlocks = normalized.split(/\n\s*\n+/);
  const cues: SubtitleCue[] = [];

  let fallbackIndex = 1;

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Skip WebVTT header if present
    if (trimmed.startsWith('WEBVTT') || trimmed.startsWith('NOTE')) continue;

    const lines = trimmed.split('\n');
    let timeLineIdx = -1;

    // Find the line with the timestamp arrow '-->'
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx === -1) continue;

    const timeLine = lines[timeLineIdx];
    const timeMatch = timeLine.match(/(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})/);

    if (!timeMatch) continue;

    const startTime = parseTimestamp(timeMatch[1]);
    const endTime = parseTimestamp(timeMatch[2]);

    // Optional cue index from preceding line
    let index = fallbackIndex;
    if (timeLineIdx > 0) {
      const parsedIdx = parseInt(lines[timeLineIdx - 1].trim(), 10);
      if (!isNaN(parsedIdx)) {
        index = parsedIdx;
      }
    }
    fallbackIndex++;

    // Text lines are everything following the timestamp line
    const textLines = lines.slice(timeLineIdx + 1);
    const rawText = textLines.join('\n').trim();
    const cleanText = cleanSubtitleText(rawText);

    if (!cleanText) continue;

    const tokens = tokenizeSubtitleText(cleanText);

    cues.push({
      index,
      startTime,
      endTime,
      rawText,
      text: cleanText,
      tokens,
    });
  }

  // Sort by startTime to ensure binary search validity
  cues.sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);

  return cues;
}

/**
 * Sub-millisecond binary search to find all currently active cues at currentTime.
 * Handles simultaneous overlapping cues (e.g. multiple speakers or music cues).
 */
export function findActiveCues(cues: SubtitleCue[], currentTime: number): SubtitleCue[] {
  if (!cues || cues.length === 0) return [];

  // Binary search for the first cue whose endTime >= currentTime
  let low = 0;
  let high = cues.length - 1;
  let firstCandidate = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].endTime >= currentTime) {
      firstCandidate = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  if (firstCandidate === -1) return [];

  const active: SubtitleCue[] = [];

  for (let i = firstCandidate; i < cues.length; i++) {
    const cue = cues[i];
    // Early exit if startTime is well past currentTime
    if (cue.startTime > currentTime + 1.0) {
      break;
    }
    if (cue.startTime <= currentTime && cue.endTime >= currentTime) {
      active.push(cue);
    }
  }

  return active;
}

/**
 * Finds the active cue, or the most recent past cue for the "R" (Repeat Current/Last Line) shortcut.
 * If we are > 0.6s into an active cue, repeats that cue.
 * If at the very beginning of an active cue (< 0.6s), jumps to the previous cue.
 * If between cues, jumps to the previous cue.
 */
export function findCurrentOrPreviousCue(cues: SubtitleCue[], currentTime: number): SubtitleCue | null {
  if (!cues || cues.length === 0) return null;

  const active = findActiveCues(cues, currentTime);

  if (active.length > 0) {
    const current = active[0];
    if (currentTime - current.startTime > 0.6) {
      return current;
    }
    const idx = cues.findIndex((c) => c.index === current.index);
    if (idx > 0) {
      return cues[idx - 1];
    }
    return current;
  }

  // Find the closest cue before currentTime
  let low = 0;
  let high = cues.length - 1;
  let candidate: SubtitleCue | null = null;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].startTime <= currentTime) {
      candidate = cues[mid];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return candidate || cues[0] || null;
}
