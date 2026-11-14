'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getWatchHistory, formatTimestamp } from '@/lib/watchHistory';
import type { WatchProgress } from '@/types/learning';
import { Play, Clock, Sparkles } from 'lucide-react';

export default function ContinueWatching() {
  const [history, setHistory] = useState<WatchProgress[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const all = getWatchHistory();
      setHistory(all.filter((item) => !item.completed && item.currentTime > 3));
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  if (history.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-slate-300/40 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-cyan-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Ready to start your German learning journey?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select any episode below. Your watch progress and vocabulary will automatically be saved here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {history.map((item) => {
        const progressPct =
          item.duration > 0 ? Math.min(100, (item.currentTime / item.duration) * 100) : 0;
        const watchUrl =
          item.type === 'episode'
            ? `/watch?type=episode&series=${item.seriesSlug}&s=${item.seasonNumber}&e=${item.episodeNumber}&resume=1`
            : `/watch?type=movie&slug=${item.movieSlug}&resume=1`;

        return (
          <Link
            key={item.id}
            href={watchUrl}
            className="group glass-card glass-card-hover rounded-2xl p-4 flex flex-col justify-between gap-3 block"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  {item.seriesTitle ? `${item.seriesTitle} · S${item.seasonNumber}E${item.episodeNumber}` : 'Movie'}
                </span>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                  {item.title}
                </h4>
              </div>
              <div className="w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Play className="w-3.5 h-3.5 fill-current" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(item.currentTime)}
                </span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-300/40 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
