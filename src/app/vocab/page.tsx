'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  getLeitnerDeck,
  getDueCards,
  getBoxCounts,
  reviewLeitnerCard,
  deleteLeitnerCard,
  updateLeitnerCard,
  exportLeitnerJson,
  importLeitnerJson,
  addCardToLeitner,
  LEITNER_INTERVALS_DAYS,
  LEITNER_UPDATED_EVENT,
} from '@/lib/leitner';
import { speakGermanWord } from '@/lib/dictionary';
import type { SavedVocabCard, LeitnerBoxLevel } from '@/types/learning';
import {
  Sparkles,
  Layers,
  RotateCcw,
  Check,
  X,
  Volume2,
  Trash2,
  Edit2,
  Save,
  Download,
  Upload,
  Search,
  ArrowRight,
  Play,
  Film,
  Trophy,
  Calendar,
  HelpCircle,
} from 'lucide-react';

export default function VocabPage() {
  const [deck, setDeck] = useState<SavedVocabCard[]>([]);
  const [mounted, setMounted] = useState<boolean>(false);
  const [activeBoxFilter, setActiveBoxFilter] = useState<'all' | LeitnerBoxLevel>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Flashcard Study Session state
  const [isStudying, setIsStudying] = useState<boolean>(false);
  const [studyCards, setStudyCards] = useState<SavedVocabCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showContextHint, setShowContextHint] = useState<boolean>(false);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [sessionResults, setSessionResults] = useState<{ remembered: number; forgotten: number }>({
    remembered: 0,
    forgotten: 0,
  });

  // Inline editing state for cards in manager
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editTranslation, setEditTranslation] = useState<string>('');

  // Toast / feedback message
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Hidden file input for JSON import
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  }, []);

  const refreshDeck = useCallback(() => {
    try {
      const all = getLeitnerDeck();
      setDeck(all);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshDeck();
    setMounted(true);

    const handleUpdated = () => refreshDeck();
    window.addEventListener(LEITNER_UPDATED_EVENT, handleUpdated);
    window.addEventListener('storage', handleUpdated);

    return () => {
      window.removeEventListener(LEITNER_UPDATED_EVENT, handleUpdated);
      window.removeEventListener('storage', handleUpdated);
    };
  }, [refreshDeck]);

  const boxCounts = useMemo(() => getBoxCounts(deck), [deck]);
  const dueCards = useMemo(() => getDueCards(deck), [deck]);

  // Filtered cards list for the management section
  const filteredCards = useMemo(() => {
    let result = deck;
    if (activeBoxFilter !== 'all') {
      result = result.filter((c) => c.boxLevel === activeBoxFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.word.toLowerCase().includes(q) ||
          c.translation.toLowerCase().includes(q) ||
          (c.contextSentenceGerman && c.contextSentenceGerman.toLowerCase().includes(q))
      );
    }
    return result;
  }, [deck, activeBoxFilter, searchQuery]);

  // ── Study Session Controls ──────────────────────────────────────────────────
  const startStudySession = (cardsToReview: SavedVocabCard[]) => {
    if (cardsToReview.length === 0) return;
    setStudyCards(cardsToReview);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowContextHint(false);
    setSessionCompleted(false);
    setSessionResults({ remembered: 0, forgotten: 0 });
    setIsStudying(true);
  };

  const handleStudyResponse = useCallback(
    (remembered: boolean) => {
      const card = studyCards[currentCardIndex];
      if (!card) return;

      // Review in engine
      reviewLeitnerCard(card.id, remembered);

      // Track results
      setSessionResults((prev) => ({
        remembered: remembered ? prev.remembered + 1 : prev.remembered,
        forgotten: !remembered ? prev.forgotten + 1 : prev.forgotten,
      }));

      if (currentCardIndex + 1 < studyCards.length) {
        setCurrentCardIndex((prev) => prev + 1);
        setIsFlipped(false);
        setShowContextHint(false);
      } else {
        setSessionCompleted(true);
      }

      refreshDeck();
    },
    [studyCards, currentCardIndex, refreshDeck]
  );

  // Keyboard navigation during study session
  useEffect(() => {
    if (!isStudying || sessionCompleted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const tag = document.activeElement?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === '1') {
        e.preventDefault();
        handleStudyResponse(false);
      } else if (e.key === '2') {
        e.preventDefault();
        handleStudyResponse(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStudying, sessionCompleted, handleStudyResponse]);

  // ── Backup Export / Import Handlers ──────────────────────────────────────────
  const handleExport = () => {
    const jsonStr = exportLeitnerJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lernkino-vocab-deck-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Vocabulary deck exported successfully!');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importLeitnerJson(content);
      if (res.success) {
        showToast(`Imported ${res.count} cards successfully!`);
        refreshDeck();
      } else {
        showToast(`Import failed: ${res.error || 'Invalid file'}`);
      }
    };
    reader.readAsText(file);
  };

  // Quick Seed for demonstration if deck is empty
  const handleSeedSamples = () => {
    addCardToLeitner({
      word: 'arbeiten',
      translation: 'to work',
      contextSentenceGerman: 'Wir arbeiten zusammen, sonst nichts.',
      contextSentenceEnglish: 'We work together, nothing else.',
      mediaSourceTitle: 'Friends S01E01',
    });
    addCardToLeitner({
      word: 'zusammen',
      translation: 'together',
      contextSentenceGerman: 'Wir arbeiten zusammen, sonst nichts.',
      contextSentenceEnglish: 'We work together, nothing else.',
      mediaSourceTitle: 'Friends S01E01',
    });
    addCardToLeitner({
      word: 'schrecklich',
      translation: 'terrible, awful',
      contextSentenceGerman: 'Es wär schrecklich, wenn sie dasselbe durchmacht.',
      contextSentenceEnglish: 'It would be terrible if she went through the same thing.',
      mediaSourceTitle: 'Friends S01E01',
    });
    showToast('Seeded 3 sample cards from Friends S01E01!');
    refreshDeck();
  };

  if (!mounted) {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-64 rounded-3xl bg-white/5 animate-pulse" />
      </main>
    );
  }

  const currentStudyCard = studyCards[currentCardIndex];

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

      {/* ── Status Toast ────────────────────────────────────────────── */}
      {statusMessage && (
        <div className="fixed top-24 right-6 z-50 px-4 py-2.5 rounded-2xl bg-cyan-500 text-slate-950 font-semibold text-xs shadow-[0_0_25px_rgba(0,255,255,0.4)] animate-in fade-in slide-in-from-top-2 duration-200">
          {statusMessage}
        </div>
      )}

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 border-b border-slate-300/40 dark:border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
            Spaced Repetition
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
            Leitner Vocab Deck
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Save difficult German dialogue from series & movies into 5 spaced repetition boxes to master long-term vocabulary effortlessly.
          </p>
        </div>

        {/* Action Controls: Start Review or Seed */}
        <div className="flex flex-wrap items-center gap-2.5">
          {deck.length === 0 ? (
            <button
              onClick={handleSeedSamples}
              className="px-4 py-2 rounded-xl text-xs font-bold glass-pill text-cyan-700 dark:text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/15 transition-all"
            >
              Seed Sample Cards
            </button>
          ) : (
            <button
              onClick={() => startStudySession(dueCards.length > 0 ? dueCards : deck)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(0,255,255,0.4)] flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {dueCards.length > 0
                  ? `Review Due Cards (${dueCards.length})`
                  : `Practice All Cards (${deck.length})`}
              </span>
            </button>
          )}

          <Link
            href="/watch?type=episode&series=friends-german-dub&s=1&e=1"
            className="px-4 py-2.5 rounded-xl text-xs font-semibold glass-pill text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white flex items-center gap-1.5 transition-all"
          >
            <Film className="w-3.5 h-3.5 text-cyan-500" />
            Stream Friends
          </Link>
        </div>
      </div>

      {/* ── 1. The 5-Box Leitner Overview Row ────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold uppercase tracking-wider font-mono">Box Distribution & Intervals</span>
          <span>{deck.length} Total Saved Words</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {([1, 2, 3, 4, 5] as LeitnerBoxLevel[]).map((boxNum) => {
            const count = boxCounts[boxNum] || 0;
            const interval = LEITNER_INTERVALS_DAYS[boxNum];
            const isSelected = activeBoxFilter === boxNum;

            return (
              <div
                key={boxNum}
                onClick={() => setActiveBoxFilter(isSelected ? 'all' : boxNum)}
                className={`glass-card rounded-2xl p-4 cursor-pointer transition-all border ${
                  isSelected
                    ? 'border-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.25)] scale-[1.02]'
                    : 'border-slate-300/40 dark:border-white/10 hover:border-cyan-500/30'
                }`}
              >
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
                  <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                    Box {boxNum}
                  </span>
                  <span className="text-[11px] font-mono">
                    {boxNum === 5 ? '14d (Mastered)' : `${interval}d`}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {count}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {count === 1 ? 'card' : 'cards'}
                  </span>
                </div>

                <div className="mt-2 w-full h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all"
                    style={{
                      width: `${deck.length > 0 ? (count / deck.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 2. Flashcard Study Session (Interactive Mode) ─────────────── */}
      {isStudying && (
        <section className="glass-card rounded-3xl p-6 sm:p-10 border border-cyan-500/40 shadow-[0_12px_40px_rgba(0,0,0,0.5)] space-y-6 animate-in fade-in duration-300">
          {!sessionCompleted && currentStudyCard ? (
            <div className="space-y-6 max-w-xl mx-auto">
              {/* Study Header & Progress */}
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-bold">
                  <Layers className="w-4 h-4" /> Card {currentCardIndex + 1} of {studyCards.length}
                </span>

                <button
                  onClick={() => setIsStudying(false)}
                  className="hover:text-white transition-colors"
                >
                  Exit Session ✕
                </button>
              </div>

              {/* Progress Scrubber */}
              <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentCardIndex + 1) / studyCards.length) * 100}%`,
                  }}
                />
              </div>

              {/* 3D Flashcard Container */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="relative min-h-[260px] rounded-3xl p-8 border border-white/20 bg-gradient-to-br from-white/10 via-zinc-900/60 to-black/80 backdrop-blur-xl shadow-2xl flex flex-col justify-between cursor-pointer transition-all select-none hover:border-cyan-400/50 group"
              >
                {/* Card Top Pill */}
                <div className="flex items-center justify-between text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                    Box {currentStudyCard.boxLevel}
                  </span>
                  <span className="text-[11px] text-slate-400 group-hover:text-cyan-300 transition-colors">
                    Click or press Space to flip ↺
                  </span>
                </div>

                {/* Card Content (Front vs Back) */}
                <div className="py-6 text-center space-y-3">
                  {!isFlipped ? (
                    <>
                      <div className="flex items-center justify-center gap-3">
                        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                          {currentStudyCard.word}
                        </h2>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            speakGermanWord(currentStudyCard.word);
                          }}
                          className="p-2 rounded-xl bg-white/10 hover:bg-cyan-500 hover:text-slate-950 text-cyan-400 transition-all"
                          title="Listen to pronunciation"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>

                      {showContextHint && currentStudyCard.contextSentenceGerman && (
                        <p className="text-xs text-slate-400 italic pt-2 max-w-md mx-auto">
                          &ldquo;{currentStudyCard.contextSentenceGerman}&rdquo;
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl sm:text-3xl font-black text-cyan-400 tracking-tight">
                        {currentStudyCard.translation}
                      </h2>

                      {currentStudyCard.contextSentenceGerman && (
                        <div className="pt-2 text-xs space-y-1 text-slate-300 max-w-md mx-auto text-left bg-black/40 p-3 rounded-xl border border-white/10">
                          <p className="font-semibold text-white">
                            &ldquo;{currentStudyCard.contextSentenceGerman}&rdquo;
                          </p>
                          {currentStudyCard.contextSentenceEnglish && (
                            <p className="text-yellow-300/90 font-normal">
                              {currentStudyCard.contextSentenceEnglish}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Card Footer Hint Toggle */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowContextHint(!showContextHint);
                    }}
                    className="hover:text-cyan-400 transition-colors flex items-center gap-1"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    {showContextHint ? 'Hide Sentence Hint' : 'Show Sentence Hint'}
                  </button>

                  <span className="text-[10px] font-mono">
                    {currentStudyCard.mediaSourceTitle || 'LernKino'}
                  </span>
                </div>
              </div>

              {/* Study Action Buttons */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => handleStudyResponse(false)}
                  className="py-3.5 rounded-2xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                  title="Shortcut: Press '1'"
                >
                  <X className="w-4 h-4" />
                  Forgot (Reset to Box 1) [1]
                </button>

                <button
                  onClick={() => handleStudyResponse(true)}
                  className="py-3.5 rounded-2xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(0,255,255,0.4)] flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
                  title="Shortcut: Press '2'"
                >
                  <Check className="w-4 h-4" />
                  Remembered (Next Box →) [2]
                </button>
              </div>
            </div>
          ) : (
            /* Session Completed Celebration Screen */
            <div className="text-center py-8 space-y-6 max-w-md mx-auto animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-3xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(0,255,255,0.3)]">
                <Trophy className="w-8 h-8 text-cyan-400" />
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl font-black text-white">Study Session Complete!</h3>
                <p className="text-xs text-slate-400">
                  Great job reviewing your German vocabulary. Your card schedules have been updated.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 text-xs">
                <div>
                  <span className="text-slate-400 block">Remembered</span>
                  <span className="text-xl font-bold text-emerald-400">
                    {sessionResults.remembered}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Forgot (Reset)</span>
                  <span className="text-xl font-bold text-rose-400">
                    {sessionResults.forgotten}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsStudying(false)}
                className="px-6 py-3 rounded-2xl text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.4)] transition-all"
              >
                Back to Vocabulary Manager
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── 3. All Saved Words Manager Section ──────────────────────── */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Vocabulary Manager
            </h2>
            <span className="text-xs font-mono text-slate-400">
              ({filteredCards.length} of {deck.length})
            </span>
          </div>

          {/* Search Bar & Backup Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search words..."
                className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-200/60 dark:bg-white/5 border border-slate-300/40 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-all w-44"
              />
            </div>

            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold glass-pill text-slate-700 dark:text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
              title="Export deck to JSON"
            >
              <Download className="w-3.5 h-3.5 text-cyan-500" /> Export JSON
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold glass-pill text-slate-700 dark:text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
              title="Import JSON backup"
            >
              <Upload className="w-3.5 h-3.5 text-yellow-500" /> Import JSON
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-300/40 dark:border-white/10">
          {(['all', 1, 2, 3, 4, 5] as const).map((filter) => {
            const count = filter === 'all' ? deck.length : boxCounts[filter];
            const isSelected = activeBoxFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setActiveBoxFilter(filter)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(0,255,255,0.3)]'
                    : 'glass-pill text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {filter === 'all' ? 'All Words' : `Box ${filter}`} ({count})
              </button>
            );
          })}
        </div>

        {/* Saved Cards Grid / List */}
        {filteredCards.length === 0 ? (
          <div className="glass-card rounded-3xl p-10 text-center border border-slate-300/40 dark:border-white/10 space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {deck.length === 0
                ? 'Your vocabulary deck is empty. Click any German word in the video subtitles while watching Friends to add it here.'
                : 'No vocabulary cards match the current search or box filter.'}
            </p>
            {deck.length === 0 && (
              <button
                onClick={handleSeedSamples}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500 hover:text-slate-950 transition-all"
              >
                Load 3 Sample Cards
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCards.map((card) => {
              const isDue = new Date(card.nextReviewAt).getTime() <= Date.now();
              const isEditing = editingCardId === card.id;

              return (
                <div
                  key={card.id}
                  className="glass-card rounded-2xl p-5 border border-slate-300/40 dark:border-white/10 flex flex-col justify-between gap-3 group transition-all"
                >
                  <div className="space-y-2">
                    {/* Top Row: Word & Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">
                          {card.word}
                        </h3>
                        <button
                          onClick={() => speakGermanWord(card.word)}
                          className="p-1 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
                          title="Pronounce word"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            isDue
                              ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(0,255,255,0.2)]'
                              : 'bg-white/5 text-slate-400 border-white/10'
                          }`}
                        >
                          {isDue ? 'Due Today' : `Box ${card.boxLevel}`}
                        </span>

                        <button
                          onClick={() => deleteLeitnerCard(card.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete card"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Translation row with edit capability */}
                    <div>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editTranslation}
                            onChange={(e) => setEditTranslation(e.target.value)}
                            className="flex-1 px-3 py-1 rounded-lg text-xs bg-black/60 border border-cyan-400 text-white focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              updateLeitnerCard(card.id, { translation: editTranslation });
                              setEditingCardId(null);
                            }}
                            className="p-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                          <span>{card.translation}</span>
                          <button
                            onClick={() => {
                              setEditingCardId(card.id);
                              setEditTranslation(card.translation);
                            }}
                            className="text-slate-400 hover:text-white p-1"
                            title="Edit translation"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Context sentence */}
                    {card.contextSentenceGerman && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed italic bg-slate-200/50 dark:bg-white/5 p-2.5 rounded-xl border border-slate-300/30 dark:border-white/5">
                        &ldquo;{card.contextSentenceGerman}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Card bottom metadata */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-300/30 dark:border-white/5">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3" />
                      Box {card.boxLevel} ({LEITNER_INTERVALS_DAYS[card.boxLevel]}d)
                    </span>
                    <span className="font-mono truncate max-w-[140px]">
                      {card.mediaSourceTitle || 'Friends'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </main>
  );
}
