'use client';

import React, { useMemo, useState, useEffect } from 'react';
import type { SubtitleCue, SubtitlePreferences } from '@/types/subtitles';
import { findActiveCues, isWordToken } from '@/lib/srtParser';
import {
  SUBTITLE_FONT_SIZE_CLASSES,
  SUBTITLE_EN_COLOR_CLASSES,
  SUBTITLE_BG_CLASSES,
} from '@/lib/subtitlePrefs';
import {
  saveSentence,
  deleteSentenceByGerman,
  isSentenceSaved,
  SENTENCES_UPDATED_EVENT,
} from '@/lib/sentences';
import { BookmarkPlus, BookmarkCheck, Check } from 'lucide-react';

export interface DualSubtitleOverlayProps {
  currentTime: number;
  germanCues: SubtitleCue[];
  englishCues: SubtitleCue[];
  preferences: SubtitlePreferences;
  controlsVisible: boolean;
  onWordClick?: (word: string, language: 'de' | 'en', cue: SubtitleCue, pairedCue?: SubtitleCue) => void;
  mediaSourceTitle?: string;
  seriesSlug?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  movieSlug?: string;
}

export default function DualSubtitleOverlay({
  currentTime,
  germanCues,
  englishCues,
  preferences,
  controlsVisible,
  onWordClick,
  mediaSourceTitle,
  seriesSlug,
  seasonNumber,
  episodeNumber,
  movieSlug,
}: DualSubtitleOverlayProps) {
  const { mode, fontSize, enColor, bgOpacity, offsetSeconds, snappyDialogue = true } = preferences;

  // Adjust playback time by the user's micro-sync offset
  const syncTime = Math.max(0, currentTime + (offsetSeconds || 0));

  // Fast binary-search lookup for active cues (hooks must run unconditionally)
  const rawGermanCues = useMemo(() => {
    if (mode === 'off' || mode === 'en') return [];
    return findActiveCues(germanCues, syncTime);
  }, [germanCues, syncTime, mode]);

  const rawEnglishCues = useMemo(() => {
    if (mode === 'off' || mode === 'de') return [];
    return findActiveCues(englishCues, syncTime);
  }, [englishCues, syncTime, mode]);

  // Snappy Fast Dialogue Mode:
  // When characters speak rapidly and cues overlap, prioritize the newest active cue
  // so the caption box immediately cuts to the current spoken line on time without lingering old text.
  const activeGermanCues = useMemo(() => {
    if (!snappyDialogue || rawGermanCues.length <= 1) return rawGermanCues;
    return [rawGermanCues[rawGermanCues.length - 1]];
  }, [rawGermanCues, snappyDialogue]);

  const activeEnglishCues = useMemo(() => {
    if (!snappyDialogue || rawEnglishCues.length <= 1) return rawEnglishCues;
    return [rawEnglishCues[rawEnglishCues.length - 1]];
  }, [rawEnglishCues, snappyDialogue]);

  const currentGermanText = useMemo(() => activeGermanCues.map((c) => c.text).join(' '), [activeGermanCues]);
  const currentEnglishText = useMemo(() => activeEnglishCues.map((c) => c.text).join(' '), [activeEnglishCues]);

  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Sync sentence saved status
  useEffect(() => {
    if (!currentGermanText) {
      setIsSaved(false);
      return;
    }
    const check = () => setIsSaved(isSentenceSaved(currentGermanText));
    check();
    window.addEventListener(SENTENCES_UPDATED_EVENT, check);
    return () => window.removeEventListener(SENTENCES_UPDATED_EVENT, check);
  }, [currentGermanText]);

  const handleSaveCurrentSentence = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentGermanText) return;

    if (isSaved) {
      deleteSentenceByGerman(currentGermanText);
      setIsSaved(false);
      setSavedToast('Removed from Sentence Practice');
      setTimeout(() => setSavedToast(null), 2000);
      return;
    }

    saveSentence({
      german: currentGermanText,
      english: currentEnglishText,
      timestampSeconds: activeGermanCues[0]?.startTime ?? currentTime,
      mediaSourceTitle,
      seriesSlug,
      seasonNumber,
      episodeNumber,
      movieSlug,
    });
    setIsSaved(true);
    setSavedToast('Saved to Sentence Practice!');
    setTimeout(() => setSavedToast(null), 2500);
  };

  // If captions are turned off, don't render anything
  if (mode === 'off') {
    return null;
  }

  const hasGerman = activeGermanCues.length > 0;
  const hasEnglish = activeEnglishCues.length > 0;

  // If no subtitles active right now, render nothing
  if (!hasGerman && !hasEnglish) {
    return null;
  }

  const fontConfig = SUBTITLE_FONT_SIZE_CLASSES[fontSize] || SUBTITLE_FONT_SIZE_CLASSES.md;
  const enColorClass = SUBTITLE_EN_COLOR_CLASSES[enColor] || SUBTITLE_EN_COLOR_CLASSES.yellow;
  const bgClass = SUBTITLE_BG_CLASSES[bgOpacity] || SUBTITLE_BG_CLASSES.glass;

  // Dynamic vertical lift so captions smoothly dodge the glass controls bar
  const bottomPositionClass = controlsVisible
    ? 'bottom-20 sm:bottom-28'
    : 'bottom-4 sm:bottom-8';

  return (
    <div
      id="lernkino-subtitle-slot"
      className={`absolute left-0 right-0 z-30 flex flex-col items-center justify-end px-2.5 sm:px-4 pointer-events-none transition-all duration-300 ease-out select-none ${bottomPositionClass}`}
      aria-live="polite"
    >
      {/* Toast Notification when a sentence is saved */}
      {savedToast && (
        <div className="mb-2 px-3 py-1 rounded-full bg-cyan-500/95 text-slate-950 font-bold text-xs shadow-[0_0_15px_rgba(0,255,255,0.6)] animate-in fade-in zoom-in-95 pointer-events-none flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          <span>{savedToast}</span>
        </div>
      )}

      <div
        className={`relative pointer-events-auto max-w-4xl rounded-xl sm:rounded-2xl px-4 py-2 sm:px-7 sm:py-3 text-center transition-all duration-200 space-y-1 sm:space-y-1.5 group ${bgClass}`}
      >
        {/* Quick Sentence Bookmark / Practice Button */}
        {hasGerman && (
          <button
            onClick={handleSaveCurrentSentence}
            className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all ${
              isSaved
                ? 'text-cyan-400 bg-cyan-500/20 shadow-[0_0_10px_rgba(0,255,255,0.4)] opacity-100'
                : 'text-slate-400 hover:text-white bg-black/40 hover:bg-white/15 opacity-70 group-hover:opacity-100'
            }`}
            title={isSaved ? 'Sentence saved (Click to remove)' : 'Save full sentence to Practice Deck'}
            type="button"
          >
            {isSaved ? (
              <BookmarkCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
            ) : (
              <BookmarkPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>
        )}

        {/* ── German Subtitle Line (Target Language) ────────────────── */}
        {hasGerman && (
          <div className="space-y-0.5 sm:space-y-1 pr-5">
            {activeGermanCues.map((cue) => (
              <div
                key={`de-${cue.index}`}
                className={`text-white leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] ${fontConfig.de}`}
              >
                {cue.tokens.map((token, tIdx) => {
                  const isWord = isWordToken(token);
                  if (isWord) {
                    return (
                      <span
                        key={tIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          onWordClick?.(token, 'de', cue, activeEnglishCues[0]);
                        }}
                        className="hover:text-cyan-300 hover:drop-shadow-[0_0_8px_rgba(0,255,255,0.7)] hover:underline cursor-pointer transition-all duration-150 inline-block px-0.5 py-0.5 rounded active:scale-95 touch-manipulation"
                        title="Click to inspect German word & add to Leitner Box"
                      >
                        {token}
                      </span>
                    );
                  }
                  // Whitespace or punctuation
                  return <span key={tIdx}>{token}</span>;
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── English Subtitle Line (Translation Reference) ─────────── */}
        {hasEnglish && (
          <div className="space-y-0.5 pr-5">
            {activeEnglishCues.map((cue) => (
              <div
                key={`en-${cue.index}`}
                className={`leading-snug ${enColorClass} ${fontConfig.en}`}
              >
                {cue.tokens.map((token, tIdx) => {
                  const isWord = isWordToken(token);
                  if (isWord) {
                    return (
                      <span
                        key={tIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          onWordClick?.(token, 'en', cue, activeGermanCues[0]);
                        }}
                        className="hover:brightness-125 cursor-pointer transition-all inline-block px-0.5 py-0.5 rounded touch-manipulation"
                      >
                        {token}
                      </span>
                    );
                  }
                  return <span key={tIdx}>{token}</span>;
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
