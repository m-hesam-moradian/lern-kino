import { getCatalog } from '@/lib/catalog';
import { withBasePath } from '@/lib/paths';
import Link from 'next/link';
import {
  Film,
  FolderTree,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  HardDrive,
  Layers,
  Sparkles,
  Subtitles,
  Tv,
  ArrowLeft,
} from 'lucide-react';

export default function StatusDiagnosticPage() {
  const catalog = getCatalog();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  return (
    <main className="min-h-screen bg-[#090C12] text-slate-100 antialiased py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* ── Top Navigation & Diagnostic Header ────────────────────────── */}
        <header className="border-b border-white/10 pb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to LernKino Streaming App
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                LernKino System Diagnostics
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Film className="w-8 h-8 text-cyan-400" />
                Media Catalog & Static Indexer Status
              </h1>
              <p className="mt-1 text-sm text-slate-400 max-w-2xl">
                Diagnostic screen verifying static media discovery across Series, Movies, and Whisper dubtitle tracks.
              </p>
            </div>
            <div className="flex flex-col items-end text-xs text-slate-400 bg-zinc-900/80 px-4 py-3 rounded-xl border border-white/10">
              <span className="font-mono text-slate-300">Target: GitHub Pages</span>
              <span className="font-mono text-slate-500 mt-1">basePath: {basePath || '"" (Local root)'}</span>
              <span className="font-mono text-slate-500">output: export (out/)</span>
            </div>
          </div>
        </header>

        {/* ── KPI Summary Cards ──────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/60 rounded-2xl p-5 border border-white/10 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Tv className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{catalog.totalSeries}</div>
              <div className="text-xs text-slate-400 font-medium">Total Series</div>
            </div>
          </div>

          <div className="bg-zinc-900/60 rounded-2xl p-5 border border-white/10 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{catalog.totalMovies}</div>
              <div className="text-xs text-slate-400 font-medium">Total Movies</div>
            </div>
          </div>

          <div className="bg-zinc-900/60 rounded-2xl p-5 border border-white/10 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{catalog.totalEpisodes}</div>
              <div className="text-xs text-slate-400 font-medium">Total Episodes</div>
            </div>
          </div>

          <div className="bg-zinc-900/60 rounded-2xl p-5 border border-white/10 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-slate-200 truncate max-w-[150px]">
                {catalog.generatedAt ? new Date(catalog.generatedAt).toLocaleTimeString() : 'N/A'}
              </div>
              <div className="text-xs text-slate-400 font-medium">Indexed Time</div>
            </div>
          </div>
        </section>

        {/* ── Series Breakdown ────────────────────────────────────────── */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-cyan-400" />
            Series Catalog ({catalog.totalSeries})
          </h2>

          <div className="space-y-6">
            {catalog.series.map((s) => (
              <div key={s.slug} className="bg-zinc-900/50 rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-6 py-4 bg-zinc-900 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                      {s.slug}
                    </span>
                    <h3 className="text-base font-semibold text-white">{s.title}</h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    {s.totalSeasons} Season(s) • {s.totalEpisodes} Episode(s)
                  </span>
                </div>

                <div className="p-6 space-y-4">
                  <p className="text-xs text-slate-400">{s.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {s.genres.map((g) => (
                      <span key={g} className="px-2 py-0.5 rounded bg-zinc-800 text-slate-300">
                        {g}
                      </span>
                    ))}
                  </div>

                  {s.seasons.map((season) => (
                    <div key={season.seasonNumber} className="border-t border-white/10 pt-4 space-y-3">
                      <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                        {season.title} ({season.episodes.length} Episodes)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {season.episodes.map((ep) => (
                          <div key={ep.id} className="p-3 rounded-xl bg-zinc-950/70 border border-white/5 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono text-cyan-400 font-semibold">{ep.id}</span>
                              <span className="text-slate-300 font-medium truncate max-w-[200px]">{ep.title}</span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
                              <div className="truncate">video: {ep.videoSrc ? withBasePath(ep.videoSrc) : 'null'}</div>
                              <div className="truncate">de: {ep.subtitles.de ? withBasePath(ep.subtitles.de) : 'null'}</div>
                              <div className="truncate">en: {ep.subtitles.en ? withBasePath(ep.subtitles.en) : 'null'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Movies Breakdown ─────────────────────────────────────────── */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Film className="w-5 h-5 text-amber-400" />
            Movies Catalog ({catalog.totalMovies})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {catalog.movies.map((m) => (
              <div key={m.slug} className="p-6 rounded-2xl bg-zinc-900/50 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">{m.title}</h3>
                  <span className="text-xs font-mono text-cyan-400">{m.slug}</span>
                </div>
                <p className="text-xs text-slate-400">{m.description}</p>
                <div className="text-[11px] font-mono text-slate-400 space-y-1 bg-zinc-950/80 p-3 rounded-xl border border-white/5">
                  <div className="truncate">video: {m.videoSrc ? withBasePath(m.videoSrc) : 'null'}</div>
                  <div className="truncate">de: {m.subtitles.de ? withBasePath(m.subtitles.de) : 'null'}</div>
                  <div className="truncate">en: {m.subtitles.en ? withBasePath(m.subtitles.en) : 'null'}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
