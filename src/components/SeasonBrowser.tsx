'use client';

import { useState } from 'react';
import { Play, Check } from 'lucide-react';
import { formatTime } from '@/lib/storage';
import type { EpisodeProgress } from '@/lib/storage';

interface Episode {
  id: string;
  title: string;
  videoUrl: string | null;
  subtitles: { de?: string; en?: string; bilingual?: string };
}

interface Season {
  id: string;
  title: string;
  episodes: Episode[];
}

interface SeasonBrowserProps {
  seasons: Season[];
  activeEpisodeId: string | null;
  episodeProgress: Record<string, EpisodeProgress>;
  onEpisodeSelect: (season: Season, episode: Episode) => void;
}

export default function SeasonBrowser({
  seasons,
  activeEpisodeId,
  episodeProgress,
  onEpisodeSelect,
}: SeasonBrowserProps) {
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState(0);

  if (!seasons.length) return null;

  const activeSeason = seasons[selectedSeasonIndex] ?? seasons[0];

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Season tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {seasons.map((season, idx) => {
          const isActive = idx === selectedSeasonIndex;
          return (
            <button
              key={season.id}
              onClick={() => setSelectedSeasonIndex(idx)}
              className={[
                'flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all',
                isActive
                  ? 'bg-cyan-400 text-black shadow-[0_0_12px_rgba(0,255,255,0.4)]'
                  : [
                      'dark:border dark:border-white/20 dark:text-slate-300 dark:hover:border-cyan-400/50',
                      'border border-slate-300 text-slate-600 hover:border-cyan-400/50',
                      'backdrop-blur-md dark:bg-slate-800/40 bg-white/40',
                    ].join(' '),
              ].join(' ')}
            >
              {season.title}
            </button>
          );
        })}
      </div>

      {/* Episode list / cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5 overflow-y-auto max-h-[70vh] pr-1">
        {activeSeason.episodes.map((episode) => {
          const isActive = episode.id === activeEpisodeId;
          const progress = episodeProgress[episode.id];
          const hasVideo = Boolean(episode.videoUrl);
          const pct =
            progress && progress.duration > 0
              ? Math.min((progress.currentTime / progress.duration) * 100, 100)
              : 0;

          return (
            <button
              key={episode.id}
              disabled={!hasVideo}
              onClick={() => hasVideo && onEpisodeSelect(activeSeason, episode)}
              className={[
                'relative group flex flex-col text-left rounded-2xl overflow-hidden transition-all',
                'backdrop-blur-md',
                'dark:bg-slate-900/60 bg-white/60',
                isActive
                  ? 'border border-cyan-400/70 shadow-[0_0_20px_rgba(0,255,255,0.18)] bg-cyan-400/5'
                  : 'border border-white/10 dark:hover:border-cyan-400/40 hover:border-cyan-400/40',
                !hasVideo ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {/* Card Header & Info */}
              <div className="flex items-center gap-3 p-3.5">
                {/* Play icon thumbnail badge */}
                <div
                  className={[
                    'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
                    isActive
                      ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/40'
                      : 'dark:bg-slate-800 bg-slate-200 dark:text-slate-400 text-slate-600 group-hover:text-cyan-400 group-hover:bg-cyan-400/10',
                  ].join(' ')}
                >
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>

                {/* Title & subtitle info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm dark:text-white text-slate-900 truncate">
                      {episode.title}
                    </span>
                    {progress?.completed && (
                      <span className="flex items-center gap-1 bg-cyan-400 text-black rounded-full px-2 py-0.5 text-[10px] font-bold">
                        <Check className="w-3 h-3 stroke-[3]" />
                        Done
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    {/* Progress duration display */}
                    {progress && progress.duration > 0 ? (
                      <span className="text-xs dark:text-slate-400 text-slate-500 font-mono">
                        {formatTime(progress.currentTime)} / {formatTime(progress.duration)}
                      </span>
                    ) : (
                      <span className="text-xs dark:text-slate-500 text-slate-400">
                        {hasVideo ? 'Ready to stream' : 'No video'}
                      </span>
                    )}

                    {/* Subtitle track badges */}
                    <div className="flex items-center gap-1 ml-auto">
                      {episode.subtitles.de && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded dark:bg-white/10 bg-slate-200 text-slate-400 dark:text-slate-300 font-mono">
                          DE
                        </span>
                      )}
                      {episode.subtitles.en && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded dark:bg-cyan-400/10 bg-cyan-100 text-cyan-500 dark:text-cyan-400 font-mono">
                          EN
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1 dark:bg-white/10 bg-slate-200 overflow-hidden">
                {pct > 0 && (
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${pct}%`, boxShadow: '0 0 6px rgba(0,255,255,0.6)' }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
