'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  lookupGermanWord,
  speakGermanWord,
  cleanWord,
  type DictionaryEntry,
} from '@/lib/dictionary';
import {
  addCardToLeitner,
  isWordInLeitner,
  LEITNER_INTERVALS_DAYS,
} from '@/lib/leitner';
import type { SavedVocabCard } from '@/types/learning';
import {
  Volume2,
  X,
  Sparkles,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Play,
  Edit2,
  Save,
  Layers,
} from 'lucide-react';

export interface WordDictionaryModalProps {
  word: string;
  germanSentence?: string;
  englishSentence?: string;
  timestampSeconds?: number;
  seriesSlug?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  movieSlug?: string;
  mediaSourceTitle?: string;
  onClose: (shouldResume?: boolean) => void;
  wasPlayingBeforeOpen?: boolean;
}

export default function WordDictionaryModal({
  word,
  germanSentence,
  englishSentence,
  timestampSeconds,
  seriesSlug,
  seasonNumber,
  episodeNumber,
  movieSlug,
  mediaSourceTitle,
  onClose,
  wasPlayingBeforeOpen = false,
}: WordDictionaryModalProps) {
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [savedCard, setSavedCard] = useState<SavedVocabCard | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [customTranslation, setCustomTranslation] = useState<string>('');
  const [isEditingTranslation, setIsEditingTranslation] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [showExpanded, setShowExpanded] = useState<boolean>(false);
  const [autoResume, setAutoResume] = useState<boolean>(wasPlayingBeforeOpen);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const cleaned = cleanWord(word);

  // ── 1. Fetch Dictionary Info & Check Leitner Status ───────────────────────────
  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const existingCard = isWordInLeitner(word);
    if (existingCard) {
      setSavedCard(existingCard);
      setIsSaved(true);
      setCustomTranslation(existingCard.translation);
      if (existingCard.notes) setNotes(existingCard.notes);
    } else {
      setSavedCard(null);
      setIsSaved(false);
    }

    lookupGermanWord(word).then((result) => {
      if (active) {
        setEntry(result);
        if (!existingCard) {
          setCustomTranslation(result.translation);
        }
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [word]);

  // ── 2. Keyboard Listener (Escape to close) ──────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose(autoResume);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, autoResume]);

  // ── 3. Audio Pronunciation Handler ──────────────────────────────────────────
  const handleSpeak = useCallback(() => {
    if (!cleaned) return;
    setIsSpeaking(true);
    speakGermanWord(cleaned);
    setTimeout(() => setIsSpeaking(false), 800);
  }, [cleaned]);

  // ── 4. Add to Leitner Deck ──────────────────────────────────────────────────
  const handleSaveToLeitner = () => {
    const finalTranslation = customTranslation.trim() || entry?.translation || cleaned;

    const card = addCardToLeitner({
      word: cleaned,
      translation: finalTranslation,
      contextSentenceGerman: germanSentence,
      contextSentenceEnglish: englishSentence,
      timestampSeconds,
      seriesSlug,
      seasonNumber,
      episodeNumber,
      movieSlug,
      mediaSourceTitle,
      notes: notes.trim() || undefined,
    });

    setSavedCard(card);
    setIsSaved(true);
  };

  // Helper to highlight the target word inside the German context sentence
  const renderHighlightedContext = (sentence: string, target: string) => {
    if (!sentence || !target) return sentence;
    const regex = new RegExp(`(\\b${target}\\b)`, 'gi');
    const parts = sentence.split(regex);

    return parts.map((part, i) =>
      part.toLowerCase() === target.toLowerCase() ? (
        <span key={i} className="text-cyan-400 font-bold underline decoration-cyan-400/50 decoration-2">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div
      className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-6 overflow-y-auto"
      onClick={() => onClose(autoResume)}
    >
      <div
        className="relative w-full max-w-lg max-h-[94vh] flex flex-col rounded-2xl sm:rounded-3xl glass-card bg-zinc-950/95 border border-cyan-500/40 p-4 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.9)] space-y-3.5 sm:space-y-5 animate-in fade-in zoom-in-95 duration-200 select-text overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Header Bar ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 sm:pb-4">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                German Vocabulary
              </span>
              {entry?.partOfSpeech && (
                <span className="text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                  {entry.partOfSpeech}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight truncate">
                {cleaned}
              </h2>

              <button
                onClick={handleSpeak}
                className={`p-1.5 sm:p-2 rounded-xl border transition-all shrink-0 ${
                  isSpeaking
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 scale-105'
                    : 'bg-white/5 border-white/10 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/40'
                }`}
                title="Pronounce word (de-DE)"
                aria-label="Pronounce German word"
              >
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          <button
            onClick={() => onClose(autoResume)}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="Close dictionary (Esc)"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* ── Primary Translation Box ─────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
              English Meaning
            </label>
            {!isLoading && (
              <button
                onClick={() => setIsEditingTranslation(!isEditingTranslation)}
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
              >
                {isEditingTranslation ? (
                  <>
                    <Save className="w-3 h-3" /> Done
                  </>
                ) : (
                  <>
                    <Edit2 className="w-3 h-3" /> Edit
                  </>
                )}
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="h-12 w-full rounded-2xl bg-white/5 animate-pulse flex items-center px-4 border border-white/10">
              <span className="text-xs text-slate-500">Searching dictionaries…</span>
            </div>
          ) : isEditingTranslation ? (
            <input
              type="text"
              value={customTranslation}
              onChange={(e) => setCustomTranslation(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-black/60 border border-cyan-500/40 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
              placeholder="Enter custom translation…"
              autoFocus
            />
          ) : (
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-base font-semibold text-white">
              {customTranslation || entry?.translation || 'No direct translation found.'}
            </div>
          )}

          {/* Quick-Select Synonym / Alternative Meaning Pills */}
          {!isLoading && entry?.synonyms && entry.synonyms.length > 1 && (
            <div className="pt-1 space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Suggested Meanings (Click to select)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {entry.synonyms.slice(0, 6).map((syn, idx) => {
                  const currentSelected = (customTranslation || entry.translation || '').toLowerCase();
                  const isSelected = currentSelected === syn.toLowerCase();
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCustomTranslation(syn)}
                      className={`px-2.5 py-1 rounded-xl text-xs transition-all ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(0,255,255,0.4)] scale-105'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 hover:border-cyan-500/40'
                      }`}
                    >
                      {syn}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Subtitle Context Dialogue ───────────────────────────────── */}
        {(germanSentence || englishSentence) && (
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1.5 text-xs">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
              Subtitle Context
            </span>
            {germanSentence && (
              <p className="text-slate-200 leading-relaxed font-medium">
                {renderHighlightedContext(germanSentence, cleaned)}
              </p>
            )}
            {englishSentence && (
              <p className="text-yellow-300/90 leading-relaxed font-normal">
                {englishSentence}
              </p>
            )}
          </div>
        )}

        {/* ── Leitner Spaced-Repetition Action ────────────────────────── */}
        <div className="pt-1">
          {isSaved && savedCard ? (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Saved in Leitner Box {savedCard.boxLevel}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  (Interval: {LEITNER_INTERVALS_DAYS[savedCard.boxLevel]}d)
                </span>
              </div>
              <Link
                href="/vocab"
                className="text-xs font-bold text-cyan-400 hover:underline flex items-center gap-1"
                onClick={() => onClose(false)}
              >
                Go to Deck <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            <button
              onClick={handleSaveToLeitner}
              disabled={isLoading}
              className="w-full py-3 rounded-2xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_25px_rgba(0,255,255,0.4)] hover:shadow-[0_0_35px_rgba(0,255,255,0.6)] flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              Save Word to Leitner Box 1
            </button>
          )}
        </div>

        {/* ── Expanded Definitions & External Resources ───────────────── */}
        <div className="pt-2 border-t border-white/10 space-y-3">
          <button
            onClick={() => setShowExpanded(!showExpanded)}
            className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              Expanded Dictionary & References
            </span>
            {showExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showExpanded && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Categorized Meanings by Part of Speech */}
              {entry?.meaningGroups && entry.meaningGroups.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    Grammatical Categories
                  </span>
                  <div className="space-y-2">
                    {entry.meaningGroups.map((mg, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs space-y-1">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 inline-block uppercase">
                          {mg.partOfSpeech}
                        </span>
                        <p className="text-slate-200 text-xs pl-0.5 pt-0.5">
                          {mg.meanings.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bilingual Example Sentences */}
              {entry?.examplePairs && entry.examplePairs.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    Example Sentences
                  </span>
                  <div className="space-y-2">
                    {entry.examplePairs.slice(0, 3).map((pair, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs space-y-1">
                        <p className="text-white font-medium">🇩🇪 {pair.german}</p>
                        <p className="text-yellow-300/90 font-normal">🇬🇧 {pair.english}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Definitions */}
              {(!entry?.meaningGroups || entry.meaningGroups.length === 0) &&
                entry?.definitions &&
                entry.definitions.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Definitions & Synonyms
                    </span>
                    <ul className="text-xs text-slate-300 space-y-1 pl-4 list-disc marker:text-cyan-400">
                      {entry.definitions.map((def, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {def}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* External Study Links */}
              <div className="pt-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
                  External Dictionaries
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`https://dict.leo.org/german-english/${encodeURIComponent(cleaned)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl glass-pill text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 flex items-center gap-1 transition-all"
                  >
                    Leo.org <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`https://www.dict.cc/?s=${encodeURIComponent(cleaned)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl glass-pill text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 flex items-center gap-1 transition-all"
                  >
                    dict.cc <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`https://de.wiktionary.org/wiki/${encodeURIComponent(cleaned)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl glass-pill text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 flex items-center gap-1 transition-all"
                  >
                    Wiktionary <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`https://www.duden.de/suchen/dudenonline/${encodeURIComponent(cleaned)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl glass-pill text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 flex items-center gap-1 transition-all"
                  >
                    Duden <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`https://www.deepl.com/translator#de/en/${encodeURIComponent(cleaned)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl glass-pill text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 flex items-center gap-1 transition-all"
                  >
                    DeepL <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer Controls: Resume Toggle & Close ─────────────────── */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200">
            <input
              type="checkbox"
              checked={autoResume}
              onChange={(e) => setAutoResume(e.target.checked)}
              className="rounded accent-cyan-400 cursor-pointer"
            />
            <span>Resume video on close</span>
          </label>

          <button
            onClick={() => onClose(autoResume)}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-1.5 transition-all"
          >
            {autoResume ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" /> Resume
              </>
            ) : (
              'Close'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
