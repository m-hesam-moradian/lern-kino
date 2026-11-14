import React from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { Home, Tv, Sparkles, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full text-center space-y-6">

        {/* ── Logo & Error Badge ─────────────────────────────────────── */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <Logo size={56} className="animate-pulse" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-widest bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            Error 404 · Szene nicht gefunden
          </div>
        </div>

        {/* ── Headline & Explanation ─────────────────────────────────── */}
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Scene <span className="text-cyan-600 dark:text-cyan-400">Not Found</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Die gesuchte Seite oder Szene existiert nicht. Perhaps the reel was moved or the link was misdirected.
          </p>
        </div>

        {/* ── Action Buttons ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_25px_rgba(0,255,255,0.4)] transition-all hover:scale-105 active:scale-95"
          >
            <Home className="w-4 h-4" />
            Back to Cinema
          </Link>

          <Link
            href="/series"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs font-semibold glass-pill text-slate-700 dark:text-slate-200 hover:text-cyan-500 dark:hover:text-cyan-400 transition-all"
          >
            <Tv className="w-4 h-4" />
            Browse Series
          </Link>

          <Link
            href="/vocab"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs font-semibold glass-pill text-slate-700 dark:text-slate-200 hover:text-cyan-500 dark:hover:text-cyan-400 transition-all"
          >
            <Sparkles className="w-4 h-4 text-cyan-500" />
            Leitner Deck
          </Link>
        </div>

      </div>
    </div>
  );
}
