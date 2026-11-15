/**
 * LernKino Sentence Practice Engine
 *
 * Persists user-saved whole sentences in localStorage (lernkino_saved_sentences)
 * and generates dynamic multi-choice practice exercises:
 *  - Make Sentence (Word Scramble / Tile Rebuilder)
 *  - English -> German Translation Quiz
 *  - German -> English Meaning Quiz
 *  - Empty Word (Cloze Deletion / Fill in the blank)
 *  - Audio Listening Comprehension
 */

import type {
  SavedSentence,
  ClozeExercise,
  ScrambleExercise,
  ChoiceExercise,
} from '@/types/sentences';

export const SENTENCES_STORAGE_KEY = 'lernkino_saved_sentences';
export const SENTENCES_UPDATED_EVENT = 'lernkino_sentences_updated';

// Common German filler/distractor words for Cloze tests when few sentences exist
const FALLBACK_GERMAN_WORDS = [
  'immer', 'nicht', 'schon', 'wieder', 'können', 'müssen', 'wollen', 'sollen',
  'machen', 'gehen', 'sehen', 'sagen', 'kommen', 'wissen', 'glauben', 'denken',
  'wirklich', 'vielleicht', 'zusammen', 'einfach', 'gerade', 'überhaupt', 'natürlich',
];

function notifySentencesUpdated(sentences: SavedSentence[]): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(SENTENCES_UPDATED_EVENT, { detail: { count: sentences.length } })
      );
    } catch {
      // ignore
    }
  }
}

/**
 * Retrieves the full saved sentences array from localStorage.
 */
export function getSavedSentences(): SavedSentence[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(SENTENCES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[LernKino] Failed to load saved sentences:', err);
    return [];
  }
}

/**
 * Persists the entire sentences array to localStorage.
 */
function persistSentences(sentences: SavedSentence[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SENTENCES_STORAGE_KEY, JSON.stringify(sentences));
    notifySentencesUpdated(sentences);
  } catch (err) {
    console.warn('[LernKino] Failed to save sentences:', err);
  }
}

/**
 * Normalizes text for comparison (strips punctuation and excess whitespace).
 */
export function normalizeSentenceKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether a given German sentence is already saved.
 */
export function isSentenceSaved(germanText: string): boolean {
  const key = normalizeSentenceKey(germanText);
  if (!key) return false;
  const list = getSavedSentences();
  return list.some((s) => normalizeSentenceKey(s.german) === key);
}

export interface SaveSentenceInput {
  german: string;
  english: string;
  timestampSeconds?: number;
  mediaSourceTitle?: string;
  seriesSlug?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  movieSlug?: string;
  notes?: string;
}

/**
 * Saves a new whole sentence or updates its metadata if already present.
 */
export function saveSentence(input: SaveSentenceInput): SavedSentence {
  const list = getSavedSentences();
  const cleanDe = input.german.replace(/\s+/g, ' ').trim();
  const cleanEn = input.english.replace(/\s+/g, ' ').trim();
  const key = normalizeSentenceKey(cleanDe);

  const existingIdx = list.findIndex((s) => normalizeSentenceKey(s.german) === key);

  if (existingIdx >= 0) {
    const existing = list[existingIdx];
    const updated: SavedSentence = {
      ...existing,
      english: cleanEn || existing.english,
      timestampSeconds: input.timestampSeconds ?? existing.timestampSeconds,
      mediaSourceTitle: input.mediaSourceTitle || existing.mediaSourceTitle,
      seriesSlug: input.seriesSlug || existing.seriesSlug,
      seasonNumber: input.seasonNumber ?? existing.seasonNumber,
      episodeNumber: input.episodeNumber ?? existing.episodeNumber,
      movieSlug: input.movieSlug || existing.movieSlug,
      notes: input.notes ?? existing.notes,
    };
    list[existingIdx] = updated;
    persistSentences(list);
    return updated;
  }

  const newSentence: SavedSentence = {
    id: `sent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    german: cleanDe,
    english: cleanEn,
    timestampSeconds: input.timestampSeconds,
    mediaSourceTitle: input.mediaSourceTitle,
    seriesSlug: input.seriesSlug,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
    movieSlug: input.movieSlug,
    savedAt: new Date().toISOString(),
    timesPracticed: 0,
    timesCorrect: 0,
    mastered: false,
    notes: input.notes,
  };

  list.unshift(newSentence);
  persistSentences(list);
  return newSentence;
}

/**
 * Deletes a sentence by its unique ID.
 */
export function deleteSentence(id: string): void {
  const list = getSavedSentences();
  const filtered = list.filter((s) => s.id !== id);
  if (filtered.length !== list.length) {
    persistSentences(filtered);
  }
}

/**
 * Updates an existing sentence's properties.
 */
export function updateSentence(id: string, updates: Partial<SavedSentence>): void {
  const list = getSavedSentences();
  const idx = list.findIndex((s) => s.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates };
    persistSentences(list);
  }
}

/**
 * Records a practice attempt outcome for a sentence.
 */
export function recordSentencePracticeResult(id: string, correct: boolean): void {
  const list = getSavedSentences();
  const idx = list.findIndex((s) => s.id === id);
  if (idx >= 0) {
    const s = list[idx];
    const newTimesPracticed = (s.timesPracticed || 0) + 1;
    const newTimesCorrect = (s.timesCorrect || 0) + (correct ? 1 : 0);
    const mastered = newTimesCorrect >= 3 && newTimesCorrect / newTimesPracticed >= 0.75;

    list[idx] = {
      ...s,
      timesPracticed: newTimesPracticed,
      timesCorrect: newTimesCorrect,
      mastered,
      lastPracticedAt: new Date().toISOString(),
    };
    persistSentences(list);
  }
}

/**
 * Exports all saved sentences to a formatted JSON string for backup.
 */
export function exportSentencesJson(): string {
  const list = getSavedSentences();
  return JSON.stringify(list, null, 2);
}

/**
 * Imports sentences from a JSON string, merging with existing records without duplicates.
 */
export function importSentencesJson(jsonStr: string): number {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return 0;

    let addedCount = 0;
    const list = getSavedSentences();

    for (const item of parsed) {
      if (item && typeof item.german === 'string' && item.german.trim()) {
        const key = normalizeSentenceKey(item.german);
        const exists = list.some((s) => normalizeSentenceKey(s.german) === key);
        if (!exists) {
          list.push({
            id: item.id || `sent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            german: item.german.trim(),
            english: item.english ? item.english.trim() : '',
            timestampSeconds: item.timestampSeconds,
            mediaSourceTitle: item.mediaSourceTitle,
            seriesSlug: item.seriesSlug,
            seasonNumber: item.seasonNumber,
            episodeNumber: item.episodeNumber,
            movieSlug: item.movieSlug,
            savedAt: item.savedAt || new Date().toISOString(),
            timesPracticed: item.timesPracticed || 0,
            timesCorrect: item.timesCorrect || 0,
            mastered: !!item.mastered,
            notes: item.notes,
          });
          addedCount++;
        }
      }
    }

    if (addedCount > 0) {
      persistSentences(list);
    }
    return addedCount;
  } catch (err) {
    console.warn('[LernKino] Failed to import sentences JSON:', err);
    return 0;
  }
}

// ── Dynamic Exercise Generators ─────────────────────────────────────────────

/**
 * Tokenizes sentence into clean word tokens for tile scramble.
 */
export function tokenizeSentenceWords(text: string): string[] {
  // Matches words with internal hyphens or apostrophes
  const matches = text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
  return matches || text.split(/\s+/).filter(Boolean);
}

/**
 * Shuffles an array randomly using Fisher-Yates.
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generates a "Make Sentence" (Word Scramble) exercise.
 */
export function generateScrambleExercise(sentence: SavedSentence): ScrambleExercise {
  const words = tokenizeSentenceWords(sentence.german);
  let shuffled = shuffleArray(words);

  // Avoid giving already solved order if multiple words exist
  if (words.length > 2 && shuffled.every((w, idx) => w === words[idx])) {
    shuffled = [...words].reverse();
  }

  return {
    correctWords: words,
    shuffledWords: shuffled,
  };
}

/**
 * Generates an "Empty Word" (Cloze Deletion / Fill in the blank) exercise.
 */
export function generateClozeExercise(
  sentence: SavedSentence,
  allSentences: SavedSentence[]
): ClozeExercise {
  const words = tokenizeSentenceWords(sentence.german);

  // Find candidate words with length >= 3 to mask
  const candidateIndices = words
    .map((w, idx) => ({ word: w, idx }))
    .filter((item) => item.word.length >= 3 && !/^\d+$/.test(item.word));

  const target =
    candidateIndices.length > 0
      ? candidateIndices[Math.floor(Math.random() * candidateIndices.length)]
      : { word: words[0] || 'Wort', idx: 0 };

  const missingWord = target.word;

  // Replace missing word in the sentence with a blank
  // Use regex with word boundary to replace just that occurrence
  const regex = new RegExp(`\\b${escapeRegExp(missingWord)}\\b`, 'i');
  const sentenceWithBlank = sentence.german.replace(regex, '_________');

  // Collect potential distractor words from other sentences
  const distractorPool = new Set<string>();
  for (const s of allSentences) {
    if (s.id === sentence.id) continue;
    for (const w of tokenizeSentenceWords(s.german)) {
      if (
        w.length >= 3 &&
        w.toLowerCase() !== missingWord.toLowerCase() &&
        Math.abs(w.length - missingWord.length) <= 4
      ) {
        distractorPool.add(w);
      }
    }
  }

  // Add fallback words if pool is too small
  for (const fw of FALLBACK_GERMAN_WORDS) {
    if (fw.toLowerCase() !== missingWord.toLowerCase()) {
      distractorPool.add(fw);
    }
  }

  const shuffledDistractors = shuffleArray(Array.from(distractorPool));
  const chosenDistractors = shuffledDistractors.slice(0, 3);
  const options = shuffleArray([missingWord, ...chosenDistractors]);

  return {
    sentenceWithBlank,
    missingWord,
    options,
  };
}

/**
 * Generates a Multiple-Choice Translation exercise (English -> German or German -> English).
 */
export function generateChoiceExercise(
  sentence: SavedSentence,
  allSentences: SavedSentence[],
  direction: 'en-to-de' | 'de-to-en'
): ChoiceExercise {
  const isEnToDe = direction === 'en-to-de';
  const prompt = isEnToDe ? sentence.english : sentence.german;
  const correctAnswer = isEnToDe ? sentence.german : sentence.english;

  // Collect distractor options from other sentences
  const distractorPool = allSentences
    .filter((s) => s.id !== sentence.id)
    .map((s) => (isEnToDe ? s.german : s.english))
    .filter((ans) => Boolean(ans && ans.trim() && ans !== correctAnswer));

  const shuffledPool = shuffleArray(distractorPool);
  const chosenDistractors = shuffledPool.slice(0, 3);

  // Fallbacks if user has fewer than 4 sentences saved
  const genericGermanFallbacks = [
    'Wir arbeiten zusammen, sonst nichts.',
    'Irgendwas muss doch an ihm faul sein.',
    'Es ist kein Rendezvous, versteht ihr?',
    'Für uns Frauen ist das genau so wichtig.',
  ];
  const genericEnglishFallbacks = [
    'We work together, nothing else.',
    'There must be something wrong with him.',
    "It's not a date, you know?",
    'For us women that is just as important.',
  ];

  const genericPool = isEnToDe ? genericGermanFallbacks : genericEnglishFallbacks;
  for (const g of genericPool) {
    if (chosenDistractors.length < 3 && g !== correctAnswer && !chosenDistractors.includes(g)) {
      chosenDistractors.push(g);
    }
  }

  const options = shuffleArray([correctAnswer, ...chosenDistractors]);

  return {
    prompt,
    correctAnswer,
    options,
  };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
