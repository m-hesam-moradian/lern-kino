'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Series } from '@/types/media';
import type { WatchProgress } from '@/types/learning';
import {
  Play,
  CheckCircle2,
  Clock,
  Subtitles,
  ExternalLink,
  Film,
} from 'lucide-react';

export default function SeriesSeasonViewer({ series }: { series: Series }) {
  const [activeSeasonNum, setActiveSeasonNum] = useState<number>(
    series.seasons[0]?.seasonNumber || 1
  );
  const [watchHistory, setWatchHistory] = useState<Record<string, WatchProgress>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lernkino_watch_history');
      if (raw) {
        const parsed = JSON.parse(raw) as WatchProgress[];
        if (Array.isArray(parsed)) {
          const map: Record<string, WatchProgress> = {};
          for (const item of parsed) {
            map[item.id] = item;
          }
          setWatchHistory(map);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const activeSeason = series.seasons.find((s) => s.seasonNumber === activeSeasonNum) || series.seasons[0];

  return (
    <div className="space-y-8">
      {/* ── Season Selector Tabs ───────────────────────────────────── */}
      {series.seasons.length > 1 ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-300/40 dark:border-white/10">
          {series.seasons.map((season) => {
            const isSelected = season.seasonNumber === activeSeasonNum;
            return (
              <button
                key={season.seasonNumber}
                onClick={() => setActiveSeasonNum(season.seasonNumber)}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 whitespace-nowrap ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(0,255,255,0.4)] scale-105'
                    : 'glass-pill text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Season {season.seasonNumber} ({season.episodes.length} Episodes)
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-slate-300/40 dark:border-white/10 pb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Season {activeSeason?.seasonNumber || 1}</span>
            <span className="text-xs font-normal text-slate-500">
              ({activeSeason?.episodes.length || 0} Episodes available)
            </span>
          </h3>
        </div>
      )}

      {/* ── Episode Cards Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4">
        {activeSeason?.episodes.map((ep) => {
          const progressKey = `${series.slug}-${ep.seasonNumber}-${ep.episodeNumber}`;
          const progress = watchHistory[progressKey];
          const progressPct =
            progress && progress.duration > 0
              ? Math.min(100, (progress.currentTime / progress.duration) * 100)
              : 0;

          const watchUrl = `/watch?type=episode&series=${series.slug}&s=${ep.seasonNumber}&e=${ep.episodeNumber}`;

          return (
            <div
              key={ep.id}
              className="glass-card glass-card-hover rounded-2xl p-5 sm:p-6 border border-slate-300/40 dark:border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all group"
            >
              <div className="flex items-start gap-4">
                {/* Episode Badge / Number */}
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 flex flex-col items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-cyan-500/20 transition-all">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">EP</span>
                  <span className="text-base font-black font-mono leading-none">{String(ep.episodeNumber).padStart(2, '0')}</span>
                </div>

                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                      {ep.title}
                    </h4>

                    {ep.isExternalVideo && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                        <ExternalLink className="w-3 h-3" />
                        CDN Stream
                      </span>
                    )}
                  </div>

                  {ep.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {ep.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500 dark:text-slate-400">
                    {ep.durationSeconds && (
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="w-3 h-3" />
                        {Math.round(ep.durationSeconds / 60)} min
                      </span>
                    )}

                    {ep.subtitles.de && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        DE Dubtitle
                      </span>
                    )}

                    {ep.subtitles.en && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        EN Translation
                      </span>
                    )}
                  </div>

                  {/* Progress bar if partially watched */}
                  {progressPct > 0 && (
                    <div className="w-48 pt-1">
                      <div className="w-full h-1 bg-slate-300/40 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <Link
                href={watchUrl}
                className="shrink-0 w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500/15 hover:bg-cyan-500 text-cyan-800 dark:text-cyan-300 hover:text-slate-950 border border-cyan-500/30 hover:border-cyan-500 shadow-sm hover:shadow-[0_0_20px_rgba(0,255,255,0.4)] transition-all duration-300"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{progressPct > 5 ? 'Resume Episode' : 'Watch with Subtitles'}</span>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
