import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllSeries, getSeriesBySlug } from '@/lib/catalog';
import SeriesSeasonViewer from '@/components/SeriesSeasonViewer';
import {
  ArrowLeft,
  Sparkles,
  Subtitles,
  Tv,
  Layers,
} from 'lucide-react';

export function generateStaticParams() {
  const seriesList = getAllSeries();
  return seriesList.map((s) => ({
    slug: s.slug,
  }));
}

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const series = getSeriesBySlug(slug);

  if (!series) {
    notFound();
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

      {/* ── Breadcrumb / Back Link ─────────────────────────────────── */}
      <Link
        href="/series"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        Back to All Series
      </Link>

      {/* ── Series Glass Header ────────────────────────────────────── */}
      <header className="relative rounded-3xl glass-card border border-slate-300/50 dark:border-white/10 p-8 sm:p-10 overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30">
              <Tv className="w-3.5 h-3.5" />
              Series
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
              <Subtitles className="w-3.5 h-3.5" />
              DE + EN Dual Subtitles
            </span>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-200/70 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-300/40 dark:border-white/10">
              Language: {series.language?.toUpperCase() || 'DE'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            {series.title}
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            {series.description}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {series.genres.map((g) => (
              <span
                key={g}
                className="px-3 py-1 rounded-xl glass-pill text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                {g}
              </span>
            ))}
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 font-mono">
              {series.totalSeasons} Season(s) • {series.totalEpisodes} Total Episodes
            </span>
          </div>
        </div>
      </header>

      {/* ── Seasons & Episodes Explorer ─────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Episodes Catalog
          </h2>
        </div>

        <SeriesSeasonViewer series={series} />
      </section>

    </main>
  );
}
