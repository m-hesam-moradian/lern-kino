'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getLastWatched, formatTimestamp } from '@/lib/watchHistory';
import type { WatchProgress } from '@/types/learning';
import { Play, RotateCcw, X, Clock, Sparkles } from 'lucide-react';

export default function ResumeBanner() {
  const [lastItem, setLastItem] = useState<WatchProgress | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    try {
      const item = getLastWatched();
      if (item && item.currentTime > 3 && !item.completed) {
        setLastItem(item);
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  if (!mounted || dismissed || !lastItem) {
    return null;
  }

  const isMovie = lastItem.type === 'movie';
  const resumeUrl = isMovie
    ? `/watch?type=movie&slug=${lastItem.movieSlug}&resume=1`
    : `/watch?type=episode&series=${lastItem.seriesSlug}&s=${lastItem.seasonNumber}&e=${lastItem.episodeNumber}&resume=1`;

  const restartUrl = isMovie
    ? `/watch?type=movie&slug=${lastItem.movieSlug}&t=0`
    : `/watch?type=episode&series=${lastItem.seriesSlug}&s=${lastItem.seasonNumber}&e=${lastItem.episodeNumber}&t=0`;

  const locationSubtitle = isMovie
    ? 'Movie'
    : `${lastItem.seriesTitle || 'Series'} · Season ${lastItem.seasonNumber} · Episode ${lastItem.episodeNumber}`;

  return (
    <div className="relative rounded-3xl glass-card border border-cyan-500/40 p-6 sm:p-7 shadow-[0_8px_32px_rgba(0,255,255,0.15)] animate-in fade-in slide-in-from-top-3 duration-500 overflow-hidden">
      {/* Background cyan glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-cyan-500/15 dark:bg-cyan-400/10 blur-[80px] pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,255,255,0.25)]">
            <Sparkles className="w-6 h-6 text-cyan-500 animate-pulse" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                Welcome Back
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Resume playback
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {lastItem.title}
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              You left off at <strong className="text-slate-900 dark:text-white font-semibold">{locationSubtitle}</strong> at{' '}
              <strong className="text-cyan-600 dark:text-cyan-400 font-mono font-bold">{formatTimestamp(lastItem.currentTime)}</strong>.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <Link
            href={resumeUrl}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(0,255,255,0.4)] hover:scale-105 active:scale-95 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Resume at {formatTimestamp(lastItem.currentTime)}
          </Link>

          <Link
            href={restartUrl}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold glass-pill text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Start Over
          </Link>

          <button
            onClick={() => setDismissed(true)}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors"
            title="Dismiss banner"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
