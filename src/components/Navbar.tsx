'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { getDueCards, LEITNER_UPDATED_EVENT } from '@/lib/leitner';
import Logo from '@/components/Logo';
import SearchModal from '@/components/SearchModal';
import {
  Search,
  Sun,
  Moon,
  Sparkles,
  Menu,
  X,
  Activity,
  Film,
  Command,
} from 'lucide-react';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [dueCount, setDueCount] = useState<number>(0);

  // ── 1. Listen for Leitner Deck Changes ────────────────────────────────────────
  useEffect(() => {
    const updateDue = () => {
      try {
        const due = getDueCards();
        setDueCount(due.length);
      } catch {
        // ignore
      }
    };

    updateDue();

    window.addEventListener(LEITNER_UPDATED_EVENT, updateDue);
    window.addEventListener('storage', updateDue);

    return () => {
      window.removeEventListener(LEITNER_UPDATED_EVENT, updateDue);
      window.removeEventListener('storage', updateDue);
    };
  }, []);

  // ── 2. Global Shortcut: Ctrl+K / Cmd+K to Open Search ─────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Series', href: '/series' },
    { label: 'Movies', href: '/movies' },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-4">

            {/* ── Brand Logo ────────────────────────────────────────────── */}
            <Link href="/" className="flex items-center gap-3 group shrink-0">
              <Logo size={38} className="transition-transform group-hover:scale-105" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                    Lern<span className="text-cyan-600 dark:text-cyan-400">Kino</span>
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                </div>
                <span className="text-[10px] tracking-wider uppercase font-semibold text-slate-500 dark:text-slate-400">
                  German Dual-Subtitles
                </span>
              </div>
            </Link>

            {/* ── Desktop Navigation Links ──────────────────────────────── */}
            <div className="hidden md:flex items-center gap-1.5">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(0,255,255,0.15)]'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {/* Active Vocab & Leitner Box Link with Due Badge */}
              <Link
                href="/vocab"
                className={`ml-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  pathname.startsWith('/vocab')
                    ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(0,255,255,0.2)]'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
                }`}
                title="Leitner Box Spaced Repetition Vocabulary Deck"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                <span>Vocab</span>
                {dueCount > 0 ? (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(0,255,255,0.5)]">
                    {dueCount}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                    Deck
                  </span>
                )}
              </Link>
            </div>

            {/* ── Search & Controls ─────────────────────────────────────── */}
            <div className="hidden lg:flex items-center gap-3">
              {/* Working Search Bar Trigger */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center justify-between pl-3 pr-2.5 py-2 text-xs rounded-xl bg-slate-200/60 dark:bg-zinc-900/60 border border-slate-300/60 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-cyan-500/50 transition-all w-52 text-left group"
                title="Search catalog (Ctrl+K)"
              >
                <span className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                  <span className="truncate">Search catalog...</span>
                </span>
                <kbd className="text-[10px] font-mono text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded bg-white/40 dark:bg-white/5 border border-slate-300/40 dark:border-white/10">
                  Ctrl K
                </kbd>
              </button>

              {/* Diagnostic Route Link */}
              <Link
                href="/status"
                className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-200/50 dark:hover:bg-white/5 border border-transparent hover:border-slate-300/40 dark:hover:border-white/10 transition-colors"
                title="System & Media Catalog Diagnostics"
              >
                <Activity className="w-4 h-4" />
              </Link>

              {/* Dark/Light Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-200/50 dark:hover:bg-white/5 border border-slate-300/50 dark:border-white/10 transition-all duration-300 shadow-sm"
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-cyan-400 transition-transform hover:rotate-45" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700 transition-transform hover:-rotate-12" />
                )}
              </button>
            </div>

            {/* ── Mobile Menu & Search Buttons ──────────────────────────── */}
            <div className="flex items-center gap-1.5 md:hidden">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 border border-slate-300/50 dark:border-white/10 hover:text-cyan-400"
                aria-label="Search catalog"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 border border-slate-300/50 dark:border-white/10"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-cyan-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 border border-slate-300/50 dark:border-white/10"
                aria-label="Open navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>

        {/* ── Mobile Dropdown Menu Drawer ───────────────────────────────── */}
        {mobileMenuOpen && (
          <div className="md:hidden px-4 pt-2 pb-6 space-y-2 border-t border-slate-300/40 dark:border-white/10 bg-slate-100/95 dark:bg-[#090C12]/95 backdrop-blur-2xl">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-500"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/vocab"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Vocab / Leitner Deck
              </span>
              {dueCount > 0 && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950">
                  {dueCount} due
                </span>
              )}
            </Link>
            <Link
              href="/status"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-cyan-500"
            >
              System Diagnostics
            </Link>
          </div>
        )}
      </nav>

      {/* ── Global Search Modal ────────────────────────────────────── */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
