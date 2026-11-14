import React from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { Sparkles, Film, Tv, BookOpen, Activity, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-300/40 dark:border-white/10 bg-slate-100/60 dark:bg-black/30 backdrop-blur-xl transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">

          {/* ── Brand Description ───────────────────────────────────── */}
          <div className="space-y-3 max-w-sm">
            <Link href="/" className="flex items-center gap-3 group">
              <Logo size={36} className="transition-transform group-hover:scale-105" />
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Lern<span className="text-cyan-600 dark:text-cyan-400">Kino</span>
                </span>
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                  Language-Learning Cinema
                </span>
              </div>
            </Link>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Stream German-dubbed cinema and television with synchronized dual subtitles, interactive word lookups, and automated Leitner Box spaced repetition.
            </p>
          </div>

          {/* ── Navigation Links ────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-xs">
            <div className="space-y-2.5">
              <span className="font-mono uppercase tracking-wider font-bold text-slate-400">Explore</span>
              <ul className="space-y-2">
                <li>
                  <Link href="/" className="text-slate-600 dark:text-slate-300 hover:text-cyan-500 transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/series" className="text-slate-600 dark:text-slate-300 hover:text-cyan-500 transition-colors">
                    All Series
                  </Link>
                </li>
                <li>
                  <Link href="/movies" className="text-slate-600 dark:text-slate-300 hover:text-cyan-500 transition-colors">
                    German Cinema
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <span className="font-mono uppercase tracking-wider font-bold text-slate-400">Study</span>
              <ul className="space-y-2">
                <li>
                  <Link href="/vocab" className="text-slate-600 dark:text-slate-300 hover:text-cyan-500 transition-colors flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                    Leitner Deck
                  </Link>
                </li>
                <li>
                  <Link href="/watch?type=episode&series=friends-german-dub&s=1&e=1" className="text-slate-600 dark:text-slate-300 hover:text-cyan-500 transition-colors">
                    Friends S01E01
                  </Link>
                </li>
                <li>
                  <Link href="/status" className="text-slate-600 dark:text-slate-300 hover:text-cyan-500 transition-colors flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-500" />
                    Diagnostics
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5 col-span-2 sm:col-span-1">
              <span className="font-mono uppercase tracking-wider font-bold text-slate-400">Architecture</span>
              <ul className="space-y-2 text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  100% Serverless
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  GitHub Pages Static
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  Client Whisper Dubs
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* ── Sub-Footer Bar ─────────────────────────────────────────── */}
        <div className="mt-10 pt-6 border-t border-slate-300/40 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} LernKino. Crafted for German language acquisition.</p>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Next.js 15 App Router</span>
            <span>•</span>
            <span>Static Export</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
