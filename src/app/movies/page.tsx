import Link from 'next/link';
import { getAllMovies } from '@/lib/catalog';
import { Film, Play } from 'lucide-react';

export default function AllMoviesPage() {
  const allMovies = getAllMovies();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 mb-2">
          <Film className="w-3.5 h-3.5" />
          Cinema
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">
          German Movies
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Feature-length cinema with synchronized bilingual subtitles for immersive language learning.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {allMovies.map((movie) => (
          <Link
            key={movie.slug}
            href={`/watch?type=movie&slug=${movie.slug}`}
            className="group glass-card glass-card-hover rounded-3xl overflow-hidden flex flex-col justify-between p-6 border border-slate-300/40 dark:border-white/10 transition-all"
          >
            <div className="space-y-4">
              <div className="relative h-44 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-800/40 to-slate-900/60 dark:from-amber-900/30 dark:via-zinc-900/50 dark:to-zinc-950 p-5 flex flex-col justify-between border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between z-10">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900/70 text-amber-300 backdrop-blur-md border border-amber-500/30">
                    {movie.releaseYear || 'Cinema'}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 backdrop-blur-md border border-emerald-500/30">
                    DE + EN
                  </span>
                </div>

                <div className="z-10">
                  <span className="text-xs font-semibold text-slate-400">Full-Length Feature</span>
                  <h3 className="text-2xl font-black text-white group-hover:text-amber-300 transition-colors">
                    {movie.title}
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                {movie.description}
              </p>
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
        ))}
      </div>
    </main>
  );
}
