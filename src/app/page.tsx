import Link from 'next/link';
import { getAllSeries, getAllMovies, getFeaturedItems } from '@/lib/catalog';
import { withBasePath } from '@/lib/paths';
import ContinueWatching from '@/components/ContinueWatching';
import ResumeBanner from '@/components/ResumeBanner';
import {
  Play,
  Sparkles,
  Subtitles,
  Tv,
  Film,
  ArrowRight,
  Clock,
  BookOpen,
  FolderPlus,
} from 'lucide-react';

export default function HomePage() {
  const allSeries = getAllSeries();
  const allMovies = getAllMovies();
  const { series: featuredSeriesList } = getFeaturedItems();
  const heroSeries = featuredSeriesList[0] || allSeries[0] || null;

  const hasContent = allSeries.length > 0 || allMovies.length > 0;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">

      {/* ── 0. "Welcome Back — Do You Wanna Resume?" Banner ─────────── */}
      <ResumeBanner />

      {/* ── Empty State if no media in public/media ─────────────────── */}
      {!hasContent ? (
        <section className="glass-card rounded-3xl p-10 sm:p-14 text-center border border-slate-300/60 dark:border-white/10 space-y-5 max-w-2xl mx-auto shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(0,255,255,0.2)]">
            <FolderPlus className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              No Media Folders Found
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              LernKino is 100% folder-driven. To start streaming, place your series folder inside{' '}
              <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-slate-200/60 dark:bg-white/5 px-2 py-0.5 rounded">
                public/media/series/&lt;Series Name&gt;/
              </code>{' '}
              with a <code className="text-cyan-600 dark:text-cyan-400 font-mono bg-slate-200/60 dark:bg-white/5 px-2 py-0.5 rounded">seasons/1/1/</code> subfolder.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/status"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.4)] transition-all"
            >
              View System Diagnostics
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* ── 1. Featured Hero Banner ───────────────────────────────── */}
          {heroSeries && (
            <section className="relative overflow-hidden rounded-3xl glass-card border border-slate-300/60 dark:border-white/10 p-8 sm:p-12 lg:p-14 shadow-2xl">
              {/* Optional Cover/Backdrop Image */}
              {heroSeries.backdropSrc || heroSeries.posterSrc ? (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none filter blur-sm"
                  style={{
                    backgroundImage: `url(${withBasePath(heroSeries.backdropSrc || heroSeries.posterSrc)})`,
                  }}
                />
              ) : null}

              {/* Ambient Radial Highlight */}
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-cyan-500/15 dark:bg-cyan-400/10 blur-[100px] pointer-events-none" />

              <div className="relative z-10 max-w-2xl space-y-6">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                    Featured Series
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                    <Subtitles className="w-3.5 h-3.5 text-emerald-500" />
                    DE + EN Dual Subtitles
                  </span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-200/70 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-300/40 dark:border-white/10">
                    {(heroSeries.language || 'de').toUpperCase()} Audio
                  </span>
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                    {heroSeries.title}
                  </h1>
                  {heroSeries.description && (
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                      {heroSeries.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {heroSeries.genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-3 py-1 rounded-xl glass-pill font-medium text-slate-600 dark:text-slate-300"
                    >
                      {genre}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link
                    href={`/watch?type=episode&series=${heroSeries.slug}&s=1&e=1`}
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_25px_rgba(0,255,255,0.4)] hover:shadow-[0_0_35px_rgba(0,255,255,0.6)] hover:scale-105 active:scale-95 transition-all duration-300"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Start Watching S1 E1
                  </Link>

                  <Link
                    href={`/series/${heroSeries.slug}`}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold glass-pill text-slate-800 dark:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-all duration-300"
                  >
                    Browse Episodes ({heroSeries.totalEpisodes})
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* ── 2. Continue Watching / Recent Watches ─────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Continue Watching
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500">Auto-saved locally</span>
            </div>

            <ContinueWatching />
          </section>

          {/* ── 3. Suggested Series ───────────────────────────────────── */}
          {allSeries.length > 0 && (
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Tv className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Series Catalog
                  </h2>
                </div>
                <Link
                  href="/series"
                  className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 hover:underline flex items-center gap-1"
                >
                  View all ({allSeries.length})
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {allSeries.map((series) => {
                  const posterUrl = series.posterSrc ? withBasePath(series.posterSrc) : null;
                  return (
                    <Link
                      key={series.slug}
                      href={`/series/${series.slug}`}
                      className="group glass-card glass-card-hover rounded-3xl overflow-hidden flex flex-col justify-between p-6 border border-slate-300/40 dark:border-white/10 transition-all"
                    >
                      <div className="space-y-4">
                        {/* Dynamic Cover / Stylized Glass Poster Header */}
                        <div
                          className="relative h-44 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-slate-800/40 to-slate-900/60 dark:from-cyan-900/30 dark:via-zinc-900/50 dark:to-zinc-950 p-5 flex flex-col justify-between border border-white/10 overflow-hidden bg-cover bg-center"
                          style={posterUrl ? { backgroundImage: `url(${posterUrl})` } : undefined}
                        >
                          {/* Dark overlay if cover image exists for readability */}
                          {posterUrl && <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" />}

                          <div className="flex items-center justify-between z-10">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900/80 text-cyan-400 backdrop-blur-md border border-cyan-500/30">
                              {(series.language || 'de').toUpperCase()} DUB
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 backdrop-blur-md border border-emerald-500/30">
                              DE + EN
                            </span>
                          </div>

                          <div className="z-10">
                            <h3 className="text-2xl font-black text-white group-hover:text-cyan-300 transition-colors">
                              {series.title}
                            </h3>
                          </div>

                          <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        {series.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            {series.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-300/40 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium">
                          {series.totalSeasons} {series.totalSeasons === 1 ? 'Season' : 'Seasons'} • {series.totalEpisodes} Episodes
                        </span>
                        <span className="font-semibold text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                          Episodes <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── 4. Suggested Movies ───────────────────────────────────── */}
          {allMovies.length > 0 && (
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Film className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    German Movies & Cinema
                  </h2>
                </div>
                <Link
                  href="/movies"
                  className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 hover:underline flex items-center gap-1"
                >
                  View all ({allMovies.length})
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {allMovies.map((movie) => {
                  const posterUrl = movie.posterSrc ? withBasePath(movie.posterSrc) : null;
                  return (
                    <Link
                      key={movie.slug}
                      href={`/watch?type=movie&slug=${movie.slug}`}
                      className="group glass-card glass-card-hover rounded-3xl overflow-hidden flex flex-col justify-between p-6 border border-slate-300/40 dark:border-white/10 transition-all"
                    >
                      <div className="space-y-4">
                        <div
                          className="relative h-44 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-800/40 to-slate-900/60 dark:from-amber-900/30 dark:via-zinc-900/50 dark:to-zinc-950 p-5 flex flex-col justify-between border border-white/10 overflow-hidden bg-cover bg-center"
                          style={posterUrl ? { backgroundImage: `url(${posterUrl})` } : undefined}
                        >
                          {posterUrl && <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" />}

                          <div className="flex items-center justify-between z-10">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900/80 text-amber-300 backdrop-blur-md border border-amber-500/30">
                              {movie.releaseYear || 'Cinema'}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 backdrop-blur-md border border-emerald-500/30">
                              DE + EN
                            </span>
                          </div>

                          <div className="z-10">
                            <h3 className="text-2xl font-black text-white group-hover:text-amber-300 transition-colors">
                              {movie.title}
                            </h3>
                          </div>
                        </div>

                        {movie.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            {movie.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-300/40 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono">
                          {movie.durationSeconds ? `${Math.round(movie.durationSeconds / 60)} min` : 'German Audio'}
                        </span>
                        <span className="font-semibold text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                          Play Movie <Play className="w-3.5 h-3.5 fill-current" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── 5. Pedagogical Learning Pillars ───────────────────────── */}
          <section className="glass-card rounded-3xl p-8 sm:p-10 border border-slate-300/60 dark:border-white/10 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                <Subtitles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                1:1 Whisper Dubtitles
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Synchronized German speech-to-text transcriptions capturing actual conversational colloquialisms word-for-word.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Interactive Subtitle Lookup
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Hover and click any German word in real time to reveal definitions, grammar context, and pronunciation.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Leitner Box Spaced Repetition
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Save difficult dialogue lines straight into your 5-box spaced repetition deck for rapid long-term vocabulary retention.
              </p>
            </div>
          </section>
        </>
      )}

    </main>
  );
}
