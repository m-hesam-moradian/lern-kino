/**
 * LernKino Leitner Box Spaced-Repetition Engine
 *
 * Implements a 5-box spaced repetition system persisted in localStorage (lernkino_leitner_deck).
 * Automatically calculates review schedules based on memory retention.
 */

import type { SavedVocabCard, LeitnerBoxLevel, VocabReviewAttempt } from '@/types/learning';
import { cleanWord } from '@/lib/dictionary';

export const LEITNER_STORAGE_KEY = 'lernkino_leitner_deck';
export const LEITNER_UPDATED_EVENT = 'lernkino_leitner_updated';

/**
 * Spaced repetition review intervals in days:
 * Box 1: 1 day
 * Box 2: 2 days
 * Box 3: 4 days
 * Box 4: 7 days
 * Box 5: 14 days (Mastered)
 */
export const LEITNER_INTERVALS_DAYS: Record<LeitnerBoxLevel, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 14,
};

function notifyDeckUpdated(deck: SavedVocabCard[]): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(LEITNER_UPDATED_EVENT, { detail: { count: deck.length } }));
    } catch {
      // ignore
    }
  }
}

/**
 * Retrieves the full saved vocab deck from localStorage.
 */
export function getLeitnerDeck(): SavedVocabCard[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(LEITNER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[LernKino] Failed to load Leitner deck:', err);
    return [];
  }
}

/**
 * Persists the entire deck array to localStorage.
 */
function saveLeitnerDeck(deck: SavedVocabCard[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(LEITNER_STORAGE_KEY, JSON.stringify(deck));
    notifyDeckUpdated(deck);
  } catch (err) {
    console.warn('[LernKino] Failed to save Leitner deck:', err);
  }
}

/**
 * Checks whether a word is already in the Leitner deck (case-insensitive normalized).
 */
export function isWordInLeitner(word: string): SavedVocabCard | null {
  const cleaned = cleanWord(word).toLowerCase();
  if (!cleaned) return null;

  const deck = getLeitnerDeck();
  return deck.find((card) => cleanWord(card.word).toLowerCase() === cleaned) || null;
}

export interface AddCardInput {
  word: string;
  translation: string;
  contextSentenceGerman?: string;
  contextSentenceEnglish?: string;
  timestampSeconds?: number;
  mediaSourceTitle?: string;
  seriesSlug?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  movieSlug?: string;
  notes?: string;
}

/**
 * Adds a new card to Box 1, or updates context if the word already exists.
 */
export function addCardToLeitner(input: AddCardInput): SavedVocabCard {
  const deck = getLeitnerDeck();
  const cleanedTarget = cleanWord(input.word);
  const normalizedTarget = cleanedTarget.toLowerCase();

  const existingIdx = deck.findIndex(
    (c) => cleanWord(c.word).toLowerCase() === normalizedTarget
  );

  const now = new Date();

  if (existingIdx !== -1) {
    // Update existing card with fresh context if provided
    const existing = deck[existingIdx];
    const updated: SavedVocabCard = {
      ...existing,
      translation: input.translation || existing.translation,
      contextSentenceGerman: input.contextSentenceGerman || existing.contextSentenceGerman,
      contextSentenceEnglish: input.contextSentenceEnglish || existing.contextSentenceEnglish,
      notes: input.notes || existing.notes,
    };
    deck[existingIdx] = updated;
    saveLeitnerDeck(deck);
    return updated;
  }

  // Calculate next review (due immediately for Box 1)
  const nextReviewAt = now.toISOString();

  const newCard: SavedVocabCard = {
    id: `vocab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    word: cleanedTarget,
    translation: input.translation.trim(),
    contextSentenceGerman: input.contextSentenceGerman?.trim(),
    contextSentenceEnglish: input.contextSentenceEnglish?.trim(),
    timestampSeconds: input.timestampSeconds,
    mediaSourceTitle: input.mediaSourceTitle,
    seriesSlug: input.seriesSlug,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
    movieSlug: input.movieSlug,
    boxLevel: 1,
    nextReviewAt,
    reviewHistory: [],
    notes: input.notes,
  };

  deck.unshift(newCard);
  saveLeitnerDeck(deck);
  return newCard;
}

/**
 * Records a review attempt:
 * - If remembered: promotes card to (box + 1) up to 5, schedules next review.
 * - If forgotten: demotes card back to Box 1 (1 day).
 */
export function reviewLeitnerCard(id: string, remembered: boolean): SavedVocabCard[] {
  const deck = getLeitnerDeck();
  const cardIndex = deck.findIndex((c) => c.id === id);
  if (cardIndex === -1) return deck;

  const card = deck[cardIndex];
  const previousLevel = card.boxLevel;
  const newLevel: LeitnerBoxLevel = remembered
    ? (Math.min(5, previousLevel + 1) as LeitnerBoxLevel)
    : 1;

  const now = Date.now();
  const intervalDays = LEITNER_INTERVALS_DAYS[newLevel];
  const nextReviewTime = new Date(now + intervalDays * 24 * 60 * 60 * 1000);

  const attempt: VocabReviewAttempt = {
    reviewedAt: new Date(now).toISOString(),
    correct: remembered,
    previousLevel,
    newLevel,
  };

  const updatedCard: SavedVocabCard = {
    ...card,
    boxLevel: newLevel,
    nextReviewAt: nextReviewTime.toISOString(),
    lastReviewedAt: new Date(now).toISOString(),
    reviewHistory: [...(card.reviewHistory || []), attempt],
  };

  deck[cardIndex] = updatedCard;
  saveLeitnerDeck(deck);
  return deck;
}

/**
 * Returns cards that are currently due for review (nextReviewAt <= now).
 */
export function getDueCards(deckParam?: SavedVocabCard[]): SavedVocabCard[] {
  const deck = deckParam || getLeitnerDeck();
  const now = Date.now();
  return deck.filter((card) => {
    if (!card.nextReviewAt) return true;
    return new Date(card.nextReviewAt).getTime() <= now;
  });
}

/**
 * Returns count of cards in each of the 5 Leitner boxes.
 */
export function getBoxCounts(deckParam?: SavedVocabCard[]): Record<LeitnerBoxLevel, number> {
  const deck = deckParam || getLeitnerDeck();
  const counts: Record<LeitnerBoxLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const card of deck) {
    if (counts[card.boxLevel] !== undefined) {
      counts[card.boxLevel]++;
    } else {
      counts[1]++;
    }
  }

  return counts;
}

/**
 * Deletes a card from the deck.
 */
export function deleteLeitnerCard(id: string): void {
  const deck = getLeitnerDeck();
  const filtered = deck.filter((c) => c.id !== id);
  saveLeitnerDeck(filtered);
}

/**
 * Updates an existing card's properties (e.g. customized translation or notes).
 */
export function updateLeitnerCard(id: string, updates: Partial<SavedVocabCard>): SavedVocabCard | null {
  const deck = getLeitnerDeck();
  const idx = deck.findIndex((c) => c.id === id);
  if (idx === -1) return null;

  const updated = { ...deck[idx], ...updates };
  deck[idx] = updated;
  saveLeitnerDeck(deck);
  return updated;
}

/**
 * Exports the entire Leitner deck as a formatted JSON string for backup.
 */
export function exportLeitnerJson(): string {
  const deck = getLeitnerDeck();
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      totalCards: deck.length,
      cards: deck,
    },
    null,
    2
  );
}

/**
 * Imports a JSON string into the user's Leitner deck with duplicate merging.
 */
export function importLeitnerJson(jsonString: string): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    const incomingCards: SavedVocabCard[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.cards)
      ? parsed.cards
      : [];

    if (incomingCards.length === 0) {
      return { success: false, count: 0, error: 'No valid cards found in JSON' };
    }

    const currentDeck = getLeitnerDeck();
    let importedCount = 0;

    for (const card of incomingCards) {
      if (!card.word || !card.translation) continue;

      const norm = cleanWord(card.word).toLowerCase();
      const existingIdx = currentDeck.findIndex(
        (c) => cleanWord(c.word).toLowerCase() === norm
      );

      if (existingIdx !== -1) {
        currentDeck[existingIdx] = { ...currentDeck[existingIdx], ...card };
      } else {
        currentDeck.push({
          ...card,
          id: card.id || `vocab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          boxLevel: card.boxLevel && card.boxLevel >= 1 && card.boxLevel <= 5 ? card.boxLevel : 1,
          nextReviewAt: card.nextReviewAt || new Date().toISOString(),
          reviewHistory: Array.isArray(card.reviewHistory) ? card.reviewHistory : [],
        });
        importedCount++;
      }
    }

    saveLeitnerDeck(currentDeck);
    return { success: true, count: importedCount };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, count: 0, error: errorMsg };
  }
}
