'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAllSeries, getEpisode, getSeriesBySlug, getMovieBySlug } from '@/lib/catalog';
import VideoPlayer from '@/components/VideoPlayer';
import {
  ArrowLeft,
  ArrowRight,
  Play,
  CheckCircle2,
  Subtitles,
  Tv,
  Film,
  Layers,
  Sparkles,
} from 'lucide-react';

function WatchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const type = (searchParams.get('type') as 'episode' | 'movie') || 'episode';
  const firstSeries = getAllSeries()[0];
  const seriesSlug = searchParams.get('series') || firstSeries?.slug || '';
  const seasonNum = parseInt(searchParams.get('s') || '1', 10);
  const episodeNum = parseInt(searchParams.get('e') || '1', 10);
  const movieSlug = searchParams.get('slug') || '';
  const resumeParam = searchParams.get('resume');
  const tParam = searchParams.get('t');

  const isMovie = type === 'movie';
  const series = !isMovie ? getSeriesBySlug(seriesSlug) : null;
  const currentSeason = series?.seasons.find((s) => s.seasonNumber === seasonNum);
  const episode = !isMovie ? getEpisode(seriesSlug, seasonNum, episodeNum) : null;
  const movie = isMovie ? getMovieBySlug(movieSlug) : null;

  const mediaId = isMovie
    ? `movie-${movieSlug}`
    : `${seriesSlug}-${seasonNum}-${episodeNum}`;

  const title = isMovie
    ? movie?.title || 'Cinema Movie'
    : episode?.title || `Episode ${episodeNum}`;

  const seriesTitle = series?.title;
  const videoSrc = isMovie ? movie?.videoSrc || null : episode?.videoSrc || null;
  const subtitles = isMovie ? movie?.subtitles : episode?.subtitles;

  // Find next and previous episodes (within current season, or across season boundaries)
  interface EpisodeNavigationInfo {
    seriesSlug: string;
    seasonNumber: number;
    episodeNumber: number;
    title: string;
    url: string;
  }

  let nextEpisodeInfo: EpisodeNavigationInfo | null = null;
  let prevEpisodeInfo: EpisodeNavigationInfo | null = null;

  if (!isMovie && series && currentSeason) {
    // 1. Next episode within current season
    const nextInSeason = currentSeason.episodes.find((e) => e.episodeNumber === episodeNum + 1);
    if (nextInSeason) {
      nextEpisodeInfo = {
        seriesSlug,
        seasonNumber: seasonNum,
        episodeNumber: nextInSeason.episodeNumber,
        title: nextInSeason.title,
        url: `/watch?type=episode&series=${seriesSlug}&s=${seasonNum}&e=${nextInSeason.episodeNumber}`,
      };
    } else {
      // 2. Next season first episode
      const nextSeason = series.seasons.find((s) => s.seasonNumber === seasonNum + 1);
      if (nextSeason && nextSeason.episodes.length > 0) {
        const firstEp = nextSeason.episodes[0];
        nextEpisodeInfo = {
          seriesSlug,
          seasonNumber: nextSeason.seasonNumber,
          episodeNumber: firstEp.episodeNumber,
          title: firstEp.title,
          url: `/watch?type=episode&series=${seriesSlug}&s=${nextSeason.seasonNumber}&e=${firstEp.episodeNumber}`,
        };
      }
    }

    // Previous episode check
    const prevInSeason = currentSeason.episodes.find((e) => e.episodeNumber === episodeNum - 1);
    if (prevInSeason) {
      prevEpisodeInfo = {
        seriesSlug,
        seasonNumber: seasonNum,
        episodeNumber: prevInSeason.episodeNumber,
        title: prevInSeason.title,
        url: `/watch?type=episode&series=${seriesSlug}&s=${seasonNum}&e=${prevInSeason.episodeNumber}`,
      };
    } else {
      const prevSeason = series.seasons.find((s) => s.seasonNumber === seasonNum - 1);
      if (prevSeason && prevSeason.episodes.length > 0) {
        const lastEp = prevSeason.episodes[prevSeason.episodes.length - 1];
        prevEpisodeInfo = {
          seriesSlug,
          seasonNumber: prevSeason.seasonNumber,
          episodeNumber: lastEp.episodeNumber,
          title: lastEp.title,
          url: `/watch?type=episode&series=${seriesSlug}&s=${prevSeason.seasonNumber}&e=${lastEp.episodeNumber}`,
        };
      }
    }
  }

  const handleNextEpisode = () => {
    if (nextEpisodeInfo) {
      router.push(nextEpisodeInfo.url);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* ── Top Navigation Breadcrumb ──────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={isMovie ? '/movies' : `/series/${seriesSlug}`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to {isMovie ? 'Movies' : seriesTitle || 'Series'}
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {prevEpisodeInfo && (
            <Link
              href={prevEpisodeInfo.url}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold glass-pill text-slate-700 dark:text-slate-300 hover:text-white transition-all"
              title={`Previous Episode: ${prevEpisodeInfo.title}`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>S{prevEpisodeInfo.seasonNumber}E{prevEpisodeInfo.episodeNumber}</span>
            </Link>
          )}

          {!isMovie && (
            <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              Season {seasonNum} : Episode {episodeNum}
            </span>
          )}

          {nextEpisodeInfo && (
            <Link
              href={nextEpisodeInfo.url}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500 hover:text-slate-950 transition-all group"
              title={`Next Episode: ${nextEpisodeInfo.title}`}
            >
              <span>Next: S{nextEpisodeInfo.seasonNumber}E{nextEpisodeInfo.episodeNumber}</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}

          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
            <Subtitles className="w-3.5 h-3.5" />
            Dual Subtitles Active
          </span>
        </div>
      </div>

      {/* ── Video Player Component ─────────────────────────────────── */}
      <VideoPlayer
        mediaId={mediaId}
        type={type}
        title={title}
        seriesTitle={seriesTitle}
        seriesSlug={seriesSlug}
        seasonNumber={seasonNum}
        episodeNumber={episodeNum}
        movieSlug={movieSlug}
        initialVideoSrc={videoSrc}
        subtitles={subtitles}
        autoResume={resumeParam === '1'}
        startTime={tParam ? parseFloat(tParam) : undefined}
        hasNextEpisode={Boolean(nextEpisodeInfo)}
        nextEpisodeInfo={nextEpisodeInfo}
        onNextEpisode={handleNextEpisode}
      />

      {/* ── Metadata & Media Inspector Details ─────────────────────── */}
      <section className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-300/40 dark:border-white/10 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-300/40 dark:border-white/10 pb-5">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              {seriesTitle ? `${seriesTitle} · Season ${seasonNum}` : 'German Cinema'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {title}
            </h1>
            {episode?.description && (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-3xl leading-relaxed">
                {episode.description}
              </p>
            )}
            {movie?.description && (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-3xl leading-relaxed">
                {movie.description}
              </p>
            )}
          </div>

          {nextEpisodeInfo && (
            <button
              onClick={handleNextEpisode}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500/15 hover:bg-cyan-500 text-cyan-800 dark:text-cyan-300 hover:text-slate-950 border border-cyan-500/30 transition-all shadow-sm group"
            >
              <span>Next Episode: {nextEpisodeInfo.title}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          )}
        </div>

        {/* ── Series Season Quick-Switcher ───────────────────────────── */}
        {!isMovie && currentSeason && currentSeason.episodes.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Season {seasonNum} Episodes ({currentSeason.episodes.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentSeason.episodes.map((ep) => {
                const isCurrent = ep.episodeNumber === episodeNum;
                return (
                  <Link
                    key={ep.id}
                    href={`/watch?type=episode&series=${seriesSlug}&s=${seasonNum}&e=${ep.episodeNumber}`}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-cyan-500/15 border-cyan-500/50 shadow-[0_0_15px_rgba(0,255,255,0.15)] text-cyan-800 dark:text-cyan-300'
                        : 'glass-pill text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/10 border-slate-300/40 dark:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-300/50 dark:bg-zinc-800">
                        {String(ep.episodeNumber).padStart(2, '0')}
                      </span>
                      <span className="text-xs font-semibold truncate">{ep.title}</span>
                    </div>
                    {isCurrent ? (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 animate-pulse" />
                    ) : (
                      <Play className="w-3.5 h-3.5 shrink-0 opacity-50" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>

    </main>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-20 text-center text-slate-400">
          Loading player shell...
        </div>
      }
    >
      <WatchContent />
    </Suspense>
  );
}
