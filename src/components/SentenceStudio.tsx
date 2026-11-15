'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  getSavedSentences,
  saveSentence,
  deleteSentence,
  updateSentence,
  recordSentencePracticeResult,
  exportSentencesJson,
  importSentencesJson,
  tokenizeSentenceWords,
  generateScrambleExercise,
  generateClozeExercise,
  generateChoiceExercise,
  SENTENCES_UPDATED_EVENT,
} from '@/lib/sentences';
import { speakGermanWord } from '@/lib/dictionary';
import type {
  SavedSentence,
  SentencePracticeMode,
  ClozeExercise,
  ScrambleExercise,
  ChoiceExercise,
} from '@/types/sentences';
import {
  Sparkles,
  BookOpen,
  Volume2,
  Trash2,
  Search,
  Check,
  X,
  RotateCcw,
  Play,
  Film,
  Trophy,
  Download,
  Upload,
  Plus,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Shuffle,
  Headphones,
  Edit3,
} from 'lucide-react';

interface SentenceStudioProps {
  onNotify?: (msg: string) => void;
}

export default function SentenceStudio({ onNotify }: SentenceStudioProps) {
  const [sentences, setSentences] = useState<SavedSentence[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddingSentence, setIsAddingSentence] = useState<boolean>(false);
  const [newGerman, setNewGerman] = useState<string>('');
  const [newEnglish, setNewEnglish] = useState<string>('');

  // ── Practice Session State ────────────────────────────────────────────────
  const [isPracticing, setIsPracticing] = useState<boolean>(false);
  const [practiceMode, setPracticeMode] = useState<SentencePracticeMode | 'mixed'>('mixed');
  const [practiceQueue, setPracticeQueue] = useState<SavedSentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [sessionScore, setSessionScore] = useState<{ correct: number; total: number }>({
    correct: 0,
    total: 0,
  });

  // Current Exercise State
  const [activeExerciseMode, setActiveExerciseMode] = useState<SentencePracticeMode>('make-sentence');
  const [scrambleState, setScrambleState] = useState<{
    correctWords: string[];
    availableWords: { id: string; word: string }[];
    chosenWords: { id: string; word: string }[];
  } | null>(null);

  const [clozeState, setClozeState] = useState<ClozeExercise | null>(null);
  const [choiceState, setChoiceState] = useState<ChoiceExercise | null>(null);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState<boolean>(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean>(false);
  const [showListenAnswer, setShowListenAnswer] = useState<boolean>(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const refreshSentences = useCallback(() => {
    try {
      const all = getSavedSentences();
      setSentences(all);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshSentences();
    window.addEventListener(SENTENCES_UPDATED_EVENT, refreshSentences);
    window.addEventListener('storage', refreshSentences);
    return () => {
      window.removeEventListener(SENTENCES_UPDATED_EVENT, refreshSentences);
      window.removeEventListener('storage', refreshSentences);
    };
  }, [refreshSentences]);

  const stats = useMemo(() => {
    const total = sentences.length;
    const mastered = sentences.filter((s) => s.mastered).length;
    const totalPracticed = sentences.reduce((acc, s) => acc + (s.timesPracticed || 0), 0);
    return { total, mastered, totalPracticed };
  }, [sentences]);

  const filteredSentences = useMemo(() => {
    if (!searchQuery.trim()) return sentences;
    const q = searchQuery.toLowerCase();
    return sentences.filter(
      (s) =>
        s.german.toLowerCase().includes(q) ||
        s.english.toLowerCase().includes(q) ||
        (s.mediaSourceTitle && s.mediaSourceTitle.toLowerCase().includes(q))
    );
  }, [sentences, searchQuery]);

  // ── Practice Setup ────────────────────────────────────────────────────────
  const startPractice = (mode: SentencePracticeMode | 'mixed') => {
    if (sentences.length === 0) return;
    const shuffled = [...sentences].sort(() => Math.random() - 0.5);
    setPracticeMode(mode);
    setPracticeQueue(shuffled);
    setCurrentIndex(0);
    setSessionCompleted(false);
    setSessionScore({ correct: 0, total: 0 });
    setIsPracticing(true);
    setupExercise(shuffled[0], mode, shuffled);
  };

  const setupExercise = (
    sentence: SavedSentence,
    chosenMode: SentencePracticeMode | 'mixed',
    allQueue: SavedSentence[]
  ) => {
    setSelectedAnswer(null);
    setIsAnswerChecked(false);
    setIsAnswerCorrect(false);
    setShowListenAnswer(false);

    let modeToUse: SentencePracticeMode;
    if (chosenMode === 'mixed') {
      const modes: SentencePracticeMode[] = [
        'make-sentence',
        'translate-en-to-de',
        'translate-de-to-en',
        'cloze',
        'listen',
      ];
      modeToUse = modes[Math.floor(Math.random() * modes.length)];
    } else {
      modeToUse = chosenMode;
    }

    setActiveExerciseMode(modeToUse);

    if (modeToUse === 'make-sentence') {
      const ex = generateScrambleExercise(sentence);
      setScrambleState({
        correctWords: ex.correctWords,
        availableWords: ex.shuffledWords.map((w, idx) => ({ id: `${w}-${idx}`, word: w })),
        chosenWords: [],
      });
      setClozeState(null);
      setChoiceState(null);
    } else if (modeToUse === 'cloze') {
      const ex = generateClozeExercise(sentence, allQueue);
      setClozeState(ex);
      setScrambleState(null);
      setChoiceState(null);
    } else if (modeToUse === 'translate-en-to-de') {
      const ex = generateChoiceExercise(sentence, allQueue, 'en-to-de');
      setChoiceState(ex);
      setScrambleState(null);
      setClozeState(null);
    } else if (modeToUse === 'translate-de-to-en') {
      const ex = generateChoiceExercise(sentence, allQueue, 'de-to-en');
      setChoiceState(ex);
      setScrambleState(null);
      setClozeState(null);
    } else if (modeToUse === 'listen') {
      setScrambleState(null);
      setClozeState(null);
      setChoiceState(null);
      speakGermanWord(sentence.german);
    }
  };

  // ── Scramble Word Tile Handlers ───────────────────────────────────────────
  const handleSelectWordTile = (item: { id: string; word: string }) => {
    if (isAnswerChecked || !scrambleState) return;
    setScrambleState({
      ...scrambleState,
      availableWords: scrambleState.availableWords.filter((w) => w.id !== item.id),
      chosenWords: [...scrambleState.chosenWords, item],
    });
  };

  const handleReturnWordTile = (item: { id: string; word: string }) => {
    if (isAnswerChecked || !scrambleState) return;
    setScrambleState({
      ...scrambleState,
      chosenWords: scrambleState.chosenWords.filter((w) => w.id !== item.id),
      availableWords: [...scrambleState.availableWords, item],
    });
  };

  const handleResetScramble = () => {
    if (isAnswerChecked || !scrambleState) return;
    setScrambleState({
      ...scrambleState,
      availableWords: [...scrambleState.availableWords, ...scrambleState.chosenWords],
      chosenWords: [],
    });
  };

  // ── Exercise Evaluation ───────────────────────────────────────────────────
  const handleCheckAnswer = () => {
    if (isAnswerChecked) return;
    const currentSentence = practiceQueue[currentIndex];
    if (!currentSentence) return;

    let correct = false;

    if (activeExerciseMode === 'make-sentence' && scrambleState) {
      const built = scrambleState.chosenWords.map((w) => w.word.trim()).join(' ');
      const target = scrambleState.correctWords.map((w) => w.trim()).join(' ');
      correct = built.toLowerCase() === target.toLowerCase();
    } else if (activeExerciseMode === 'cloze' && clozeState) {
      correct = (selectedAnswer || '').trim().toLowerCase() === clozeState.missingWord.trim().toLowerCase();
    } else if (
      (activeExerciseMode === 'translate-en-to-de' || activeExerciseMode === 'translate-de-to-en') &&
      choiceState
    ) {
      correct = (selectedAnswer || '').trim() === choiceState.correctAnswer.trim();
    } else if (activeExerciseMode === 'listen') {
      correct = true;
    }

    setIsAnswerCorrect(correct);
    setIsAnswerChecked(true);

    if (correct) {
      speakGermanWord(currentSentence.german);
    }

    recordSentencePracticeResult(currentSentence.id, correct);
    setSessionScore((prev) => ({
      correct: correct ? prev.correct + 1 : prev.correct,
      total: prev.total + 1,
    }));
  };

  const handleNextExercise = () => {
    if (currentIndex + 1 < practiceQueue.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setupExercise(practiceQueue[nextIdx], practiceMode, practiceQueue);
    } else {
      setSessionCompleted(true);
      refreshSentences();
    }
  };

  // ── Manual Add / Export / Import ──────────────────────────────────────────
  const handleAddSentenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGerman.trim()) return;

    saveSentence({
      german: newGerman.trim(),
      english: newEnglish.trim(),
    });

    setNewGerman('');
    setNewEnglish('');
    setIsAddingSentence(false);
    onNotify?.('Sentence added successfully!');
    refreshSentences();
  };

  const handleExport = () => {
    const jsonStr = exportSentencesJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lernkino-sentences-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify?.('Sentences exported successfully!');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const count = importSentencesJson(text);
        onNotify?.(`Imported ${count} new sentences!`);
        refreshSentences();
      } catch {
        onNotify?.('Failed to import JSON file');
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handleSeedSamples = () => {
    saveSentence({
      german: 'Wir arbeiten zusammen, sonst nichts.',
      english: 'We work together, nothing else.',
      mediaSourceTitle: 'Friends S01E01',
      seriesSlug: 'friends-german-dub',
      seasonNumber: 1,
      episodeNumber: 1,
      timestampSeconds: 51,
    });
    saveSentence({
      german: 'Du gehst mit diesem Kerl aus.',
      english: "You're dating this guy.",
      mediaSourceTitle: 'Friends S01E01',
      seriesSlug: 'friends-german-dub',
      seasonNumber: 1,
      episodeNumber: 1,
      timestampSeconds: 54,
    });
    saveSentence({
      german: 'Irgendwas muss doch an ihm faul sein, Monika.',
      english: 'There must be something wrong with him, Monika.',
      mediaSourceTitle: 'Friends S01E01',
      seriesSlug: 'friends-german-dub',
      seasonNumber: 1,
      episodeNumber: 1,
      timestampSeconds: 56,
    });
    saveSentence({
      german: 'Es ist kein Rendezvous, versteht ihr?',
      english: "It's not a date, you know?",
      mediaSourceTitle: 'Friends S01E01',
      seriesSlug: 'friends-german-dub',
      seasonNumber: 1,
      episodeNumber: 1,
      timestampSeconds: 69,
    });
    saveSentence({
      german: 'Männer können gar nicht begreifen, dass für uns Frauen ein Kuss genau so wichtig ist wie alles andere.',
      english: "Men can't understand that for us women a kiss is just as important as anything else.",
      mediaSourceTitle: 'Friends S01E02',
      seriesSlug: 'friends-german-dub',
      seasonNumber: 1,
      episodeNumber: 2,
      timestampSeconds: 3,
    });
    onNotify?.('Seeded 5 sample dialogue sentences from Friends!');
    refreshSentences();
  };

  const currentSentence = practiceQueue[currentIndex];

  return (
    <div className="space-y-6">
      {/* ── Active Practice Arena Modal ────────────────────────────────────── */}
      {isPracticing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl sm:rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                  {currentIndex + 1} / {practiceQueue.length}
                </span>
                <span className="text-xs text-slate-400 capitalize flex items-center gap-1.5 font-medium">
                  {activeExerciseMode === 'make-sentence' && <>🧩 Sentence Builder</>}
                  {activeExerciseMode === 'cloze' && <>🔤 Fill in the Blank</>}
                  {activeExerciseMode === 'translate-en-to-de' && <>🇬🇧➔🇩🇪 Translate to German</>}
                  {activeExerciseMode === 'translate-de-to-en' && <>🇩🇪➔🇬🇧 German to English</>}
                  {activeExerciseMode === 'listen' && <>🎧 Listening Comprehension</>}
                </span>
              </div>
              <button
                onClick={() => setIsPracticing(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                title="Exit Practice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1 bg-white/5">
              <div
                className="h-full bg-cyan-500 transition-all duration-300"
                style={{
                  width: `${((currentIndex + (isAnswerChecked ? 1 : 0.5)) / practiceQueue.length) * 100}%`,
                }}
              />
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {!sessionCompleted && currentSentence ? (
                <>
                  {/* Mode 1: Make Sentence (Sentence Builder) */}
                  {activeExerciseMode === 'make-sentence' && scrambleState && (
                    <div className="space-y-5">
                      {/* English Guide Prompt */}
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1 text-center">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          Build this German sentence
                        </span>
                        <p className="text-base sm:text-lg font-semibold text-yellow-300">
                          {currentSentence.english || 'Translate and construct the sentence'}
                        </p>
                      </div>

                      {/* Drop Zone: Built Sentence */}
                      <div className="min-h-16 p-3 rounded-2xl border-2 border-dashed border-cyan-500/30 bg-cyan-950/20 flex flex-wrap items-center justify-center gap-2 transition-all">
                        {scrambleState.chosenWords.length === 0 ? (
                          <span className="text-xs text-slate-500 italic">
                            Click the word tiles below in the correct order...
                          </span>
                        ) : (
                          scrambleState.chosenWords.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => handleReturnWordTile(item)}
                              disabled={isAnswerChecked}
                              className={`px-3 py-1.5 rounded-xl font-medium text-sm transition-all ${
                                isAnswerChecked
                                  ? isAnswerCorrect
                                    ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 active:scale-95 shadow-[0_0_10px_rgba(0,255,255,0.3)]'
                              }`}
                            >
                              {item.word}
                            </button>
                          ))
                        )}
                      </div>

                      {/* Available Word Tiles Tray */}
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        {scrambleState.availableWords.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleSelectWordTile(item)}
                            disabled={isAnswerChecked}
                            className="px-3.5 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-white border border-white/10 hover:border-cyan-500/40 hover:scale-105 active:scale-95 transition-all shadow-sm"
                          >
                            {item.word}
                          </button>
                        ))}
                      </div>

                      {scrambleState.chosenWords.length > 0 && !isAnswerChecked && (
                        <div className="flex justify-end">
                          <button
                            onClick={handleResetScramble}
                            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" /> Reset tiles
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode 2: Empty Word (Cloze Deletion) */}
                  {activeExerciseMode === 'cloze' && clozeState && (
                    <div className="space-y-5">
                      <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-center">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          Complete the sentence with the missing word
                        </span>
                        <p className="text-lg sm:text-xl font-medium text-white leading-relaxed">
                          {clozeState.sentenceWithBlank.split('_________').map((part, pIdx, arr) => (
                            <React.Fragment key={pIdx}>
                              {part}
                              {pIdx < arr.length - 1 && (
                                <span className="inline-block mx-1.5 px-3 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border-b-2 border-cyan-400 font-bold">
                                  {isAnswerChecked ? clozeState.missingWord : selectedAnswer || '_____'}
                                </span>
                              )}
                            </React.Fragment>
                          ))}
                        </p>
                        {currentSentence.english && (
                          <p className="text-xs text-yellow-300/80 pt-1 font-normal">
                            &ldquo;{currentSentence.english}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        {clozeState.options.map((opt, oIdx) => {
                          const isSelected = selectedAnswer === opt;
                          const isCorrect = opt === clozeState.missingWord;

                          let btnStyle =
                            'bg-slate-800/80 hover:bg-slate-700/80 border-white/10 text-white hover:border-cyan-500/40';
                          if (isAnswerChecked) {
                            if (isCorrect) {
                              btnStyle =
                                'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)]';
                            } else if (isSelected) {
                              btnStyle = 'bg-rose-500/20 border-rose-500 text-rose-300 line-through';
                            } else {
                              btnStyle = 'opacity-40 border-white/5 text-slate-400';
                            }
                          } else if (isSelected) {
                            btnStyle = 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold';
                          }

                          return (
                            <button
                              key={oIdx}
                              onClick={() => !isAnswerChecked && setSelectedAnswer(opt)}
                              disabled={isAnswerChecked}
                              className={`p-3.5 rounded-2xl border text-sm font-medium text-center transition-all ${btnStyle}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Mode 3 & 4: Translation Multiple-Choice (EN->DE or DE->EN) */}
                  {(activeExerciseMode === 'translate-en-to-de' ||
                    activeExerciseMode === 'translate-de-to-en') &&
                    choiceState && (
                      <div className="space-y-5">
                        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                              {activeExerciseMode === 'translate-en-to-de' ? 'English Prompt' : 'German Sentence'}
                            </span>
                            {activeExerciseMode === 'translate-de-to-en' && (
                              <button
                                onClick={() => speakGermanWord(currentSentence.german)}
                                className="p-1 rounded-full text-cyan-400 hover:bg-white/10 transition-colors"
                                title="Listen to pronunciation"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-base sm:text-lg font-semibold text-white">
                            {choiceState.prompt}
                          </p>
                        </div>

                        <div className="space-y-2.5">
                          {choiceState.options.map((opt, oIdx) => {
                            const isSelected = selectedAnswer === opt;
                            const isCorrect = opt === choiceState.correctAnswer;

                            let btnStyle =
                              'bg-slate-800/80 hover:bg-slate-700/80 border-white/10 text-white hover:border-cyan-500/40';
                            if (isAnswerChecked) {
                              if (isCorrect) {
                                btnStyle =
                                  'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)]';
                              } else if (isSelected) {
                                btnStyle = 'bg-rose-500/20 border-rose-500 text-rose-300 line-through';
                              } else {
                                btnStyle = 'opacity-40 border-white/5 text-slate-400';
                              }
                            } else if (isSelected) {
                              btnStyle = 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold';
                            }

                            return (
                              <button
                                key={oIdx}
                                onClick={() => !isAnswerChecked && setSelectedAnswer(opt)}
                                disabled={isAnswerChecked}
                                className={`w-full p-3.5 rounded-2xl border text-sm text-left transition-all flex items-start gap-3 ${btnStyle}`}
                              >
                                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5">
                                  {String.fromCharCode(65 + oIdx)}
                                </span>
                                <span className="leading-snug">{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  {/* Mode 5: Listening Mode */}
                  {activeExerciseMode === 'listen' && (
                    <div className="space-y-6 text-center py-4">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <button
                          onClick={() => speakGermanWord(currentSentence.german)}
                          className="w-20 h-20 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-[0_0_30px_rgba(0,255,255,0.3)]"
                        >
                          <Headphones className="w-8 h-8" />
                        </button>
                        <span className="text-xs text-slate-400">
                          Click to listen to the German audio
                        </span>
                      </div>

                      {showListenAnswer ? (
                        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2 animate-in fade-in duration-200">
                          <p className="text-lg font-bold text-white leading-relaxed">
                            {currentSentence.german}
                          </p>
                          <p className="text-sm text-yellow-300/90 font-medium">
                            {currentSentence.english}
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowListenAnswer(true)}
                          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-slate-200 transition-all"
                        >
                          Reveal Transcription & Meaning
                        </button>
                      )}
                    </div>
                  )}

                  {/* Feedback Banner */}
                  {isAnswerChecked && (
                    <div
                      className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 ${
                        isAnswerCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isAnswerCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        )}
                        <div>
                          <span className="font-bold block">
                            {isAnswerCorrect ? 'Hervorragend! (Correct!)' : 'Noch einmal üben (Incorrect)'}
                          </span>
                          {!isAnswerCorrect && (
                            <span className="text-slate-300">
                              Correct German: <strong>{currentSentence.german}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => speakGermanWord(currentSentence.german)}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                        title="Listen"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* Session Completed Summary Screen */
                <div className="py-8 text-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-cyan-500/20 text-cyan-400 mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(0,255,255,0.4)]">
                    <Trophy className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-white">Practice Session Complete!</h3>
                    <p className="text-xs text-slate-400">
                      Great job practicing whole German sentences from your media deck.
                    </p>
                  </div>

                  <div className="max-w-xs mx-auto p-4 rounded-2xl bg-white/5 border border-white/10 grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 block">Score</span>
                      <span className="text-xl font-bold text-cyan-400 font-mono">
                        {sessionScore.correct} / {sessionScore.total}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 block">Accuracy</span>
                      <span className="text-xl font-bold text-emerald-400 font-mono">
                        {sessionScore.total > 0
                          ? Math.round((sessionScore.correct / sessionScore.total) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => startPractice(practiceMode)}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(0,255,255,0.4)] flex items-center gap-2 transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Practice Again
                    </button>
                    <button
                      onClick={() => setIsPracticing(false)}
                      className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-all"
                    >
                      Return to Studio
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Action Buttons */}
            {!sessionCompleted && (
              <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between shrink-0 bg-white/5">
                <button
                  onClick={() => setIsPracticing(false)}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Exit Session
                </button>

                {!isAnswerChecked ? (
                  <button
                    onClick={handleCheckAnswer}
                    disabled={
                      activeExerciseMode === 'make-sentence'
                        ? !scrambleState || scrambleState.chosenWords.length === 0
                        : activeExerciseMode === 'listen'
                        ? false
                        : !selectedAnswer
                    }
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 shadow-[0_0_20px_rgba(0,255,255,0.4)] transition-all"
                  >
                    Check Answer
                  </button>
                ) : (
                  <button
                    onClick={handleNextExercise}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(0,255,255,0.4)] flex items-center gap-1.5 transition-all"
                  >
                    Next Sentence <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Sentence Modal ─────────────────────────────────────────────── */}
      {isAddingSentence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" /> Add Custom German Sentence
              </h3>
              <button
                onClick={() => setIsAddingSentence(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSentenceSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  German Sentence
                </label>
                <textarea
                  rows={2}
                  value={newGerman}
                  onChange={(e) => setNewGerman(e.target.value)}
                  placeholder="e.g. Wir arbeiten zusammen, sonst nichts."
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  English Translation
                </label>
                <textarea
                  rows={2}
                  value={newEnglish}
                  onChange={(e) => setNewEnglish(e.target.value)}
                  placeholder="e.g. We work together, nothing else."
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingSentence(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-[0_0_15px_rgba(0,255,255,0.4)]"
                >
                  Save Sentence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Studio Header & Quick Stats ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl glass-card border border-white/10">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <span>Sentence Studio</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
              {stats.total} saved
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Whole dialog sentences saved directly from episodes. Practice sentence construction, cloze blanks, and translation quizzes.
          </p>
        </div>

        {/* Practice Mode Launcher Dropdown / Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {sentences.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => startPractice('mixed')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(0,255,255,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Practice Sentences</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setIsAddingSentence(true)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Sentence</span>
          </button>

          <button
            onClick={handleExport}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            title="Export sentences backup"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            title="Import sentences backup"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json,application/json"
            className="hidden"
          />
        </div>
      </div>

      {/* ── Search Bar & Specific Mode Practice Buttons ───────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved sentences..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {sentences.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <span className="text-[11px] text-slate-400 mr-1 hidden lg:inline">Quick Mode:</span>
            <button
              onClick={() => startPractice('make-sentence')}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all flex items-center gap-1"
            >
              🧩 Make Sentence
            </button>
            <button
              onClick={() => startPractice('cloze')}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all flex items-center gap-1"
            >
              🔤 Fill Blank
            </button>
            <button
              onClick={() => startPractice('translate-en-to-de')}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all flex items-center gap-1"
            >
              🇬🇧➔🇩🇪 German Quiz
            </button>
            <button
              onClick={() => startPractice('listen')}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all flex items-center gap-1"
            >
              🎧 Listening
            </button>
          </div>
        )}
      </div>

      {/* ── Saved Sentences List ───────────────────────────────────────────── */}
      {filteredSentences.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl p-6 space-y-3">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">
            {searchQuery ? 'No sentences match your search' : 'No sentences saved yet'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            While watching episodes in LernKino, click the bookmark icon on any subtitle line or in the dictionary modal to save full sentences for practice!
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleSeedSamples}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(0,255,255,0.4)]"
            >
              Seed Sample Sentences from Friends
            </button>
            <Link
              href="/series/friends-german-dub"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 text-slate-300 hover:text-white transition-all border border-white/10"
            >
              <Film className="w-3.5 h-3.5 text-cyan-400" /> Browse Friends Episodes
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSentences.map((sent) => {
            const hasWatchLink = sent.seriesSlug && sent.seasonNumber && sent.episodeNumber;
            const watchUrl = hasWatchLink
              ? `/watch?series=${sent.seriesSlug}&season=${sent.seasonNumber}&episode=${sent.episodeNumber}${
                  sent.timestampSeconds ? `&t=${Math.floor(sent.timestampSeconds)}` : ''
                }`
              : null;

            return (
              <div
                key={sent.id}
                className="p-4 rounded-2xl glass-card border border-white/10 hover:border-cyan-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1.5 flex-1">
                  {/* German Target Sentence with Audio Button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => speakGermanWord(sent.german)}
                      className="p-1 rounded-full text-slate-400 hover:text-cyan-400 hover:bg-white/10 transition-colors shrink-0"
                      title="Pronounce sentence"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <span className="text-sm sm:text-base font-semibold text-white leading-snug">
                      {sent.german}
                    </span>
                  </div>

                  {/* English Translation */}
                  {sent.english && (
                    <p className="text-xs text-yellow-300/90 pl-6 leading-relaxed">
                      {sent.english}
                    </p>
                  )}

                  {/* Context and Mastery Badges */}
                  <div className="flex flex-wrap items-center gap-2 pl-6 pt-0.5">
                    {sent.mediaSourceTitle && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 flex items-center gap-1">
                        <Film className="w-2.5 h-2.5 text-cyan-400" />
                        {sent.mediaSourceTitle}
                        {sent.seasonNumber && sent.episodeNumber
                          ? ` · S${sent.seasonNumber}E${sent.episodeNumber}`
                          : ''}
                      </span>
                    )}

                    {sent.timesPracticed > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        {sent.timesCorrect}/{sent.timesPracticed} correct
                      </span>
                    )}

                    {sent.mastered && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <Trophy className="w-2.5 h-2.5" /> Mastered
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {watchUrl && (
                    <Link
                      href={watchUrl}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30 transition-all flex items-center gap-1"
                      title="Watch scene in context"
                    >
                      <Play className="w-3 h-3 text-cyan-400" />
                      <span className="hidden sm:inline">Scene</span>
                    </Link>
                  )}

                  <button
                    onClick={() => {
                      if (confirm('Delete this saved sentence?')) {
                        deleteSentence(sent.id);
                        refreshSentences();
                        onNotify?.('Sentence deleted');
                      }
                    }}
                    className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete sentence"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
