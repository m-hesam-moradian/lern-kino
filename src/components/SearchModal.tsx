'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAllSeries, getAllMovies } from '@/lib/catalog';
import {
  Search,
  X,
  Tv,
  Film,
  Play,
  ArrowRight,
  Sparkles,
  Command,
} from 'lucide-react';

export interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  id: string;
  type: 'series' | 'episode' | 'movie';
  title: string;
  subtitle: string;
  url: string;
  badge: string;
  keywords: string;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // ── Build Search Index from Catalog ──────────────────────────────────────────
  const searchIndex: SearchItem[] = useMemo(() => {
    const items: SearchItem[] = [];
    const allSeries = getAllSeries();
    const allMovies = getAllMovies();

    // Index Series & Episodes
    for (const s of allSeries) {
      items.push({
        id: `series-${s.slug}`,
        type: 'series',
        title: s.title,
        subtitle: `${s.totalSeasons} Season(s) · ${s.totalEpisodes} Episodes · ${s.genres.join(', ')}`,
        url: `/series/${s.slug}`,
        badge: 'Series',
        keywords: `${s.title} ${s.genres.join(' ')} ${s.description || ''}`,
      });

      for (const season of s.seasons) {
        for (const ep of season.episodes) {
          items.push({
            id: `ep-${s.slug}-${season.seasonNumber}-${ep.episodeNumber}`,
            type: 'episode',
            title: ep.title,
            subtitle: `${s.title} · S${season.seasonNumber} E${ep.episodeNumber}`,
            url: `/watch?type=episode&series=${s.slug}&s=${season.seasonNumber}&e=${ep.episodeNumber}`,
            badge: `S${season.seasonNumber}E${ep.episodeNumber}`,
            keywords: `${ep.title} ${s.title} s${season.seasonNumber}e${ep.episodeNumber} s${season.seasonNumber} e${ep.episodeNumber} season ${season.seasonNumber} episode ${ep.episodeNumber} ${ep.description || ''}`,
          });
        }
      }
    }

    // Index Movies
    for (const m of allMovies) {
      items.push({
        id: `movie-${m.slug}`,
        type: 'movie',
        title: m.title,
        subtitle: `${m.releaseYear || 'Cinema'} · German Film`,
        url: `/watch?type=movie&slug=${m.slug}`,
        badge: 'Movie',
        keywords: `${m.title} ${m.releaseYear || ''} ${m.description || ''}`,
      });
    }

    return items;
  }, []);

  // ── Filter Results ───────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Return top featured / popular items when query is empty
      return searchIndex.slice(0, 6);
    }

    return searchIndex.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q)
      );
    });
  }, [query, searchIndex]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // ── Keyboard Listener (Navigation, Enter, Esc) ───────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          router.push(selected.url);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, router, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-center pt-20 sm:pt-28 px-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl glass-card bg-zinc-950/95 border border-cyan-500/40 p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.9)] space-y-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Search Input Field ─────────────────────────────────────── */}
        <div className="relative flex items-center gap-3 border-b border-white/10 pb-4">
          <Search className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search series, episodes (e.g. S1 E2, Monica), or movies..."
            className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10">
              Esc to close
            </kbd>
          )}
        </div>

        {/* ── Results List ───────────────────────────────────────────── */}
        <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
          {results.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-300">
                No matching series, episodes, or movies found.
              </p>
              <p className="text-xs text-slate-500">
                Try searching for &quot;Friends&quot;, &quot;S1 E1&quot;, or German keywords.
              </p>
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isEpisode = item.type === 'episode';
              const isSeries = item.type === 'series';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    router.push(item.url);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-white shadow-[0_0_15px_rgba(0,255,255,0.2)]'
                      : 'bg-white/5 border-transparent text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isSeries
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                          : isEpisode
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {isSeries && <Tv className="w-5 h-5" />}
                      {isEpisode && <Play className="w-4 h-4 fill-current" />}
                      {item.type === 'movie' && <Film className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                          {item.title}
                        </h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-cyan-300 border border-white/10 shrink-0">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-4 h-4 transition-transform shrink-0 ${
                      isSelected ? 'translate-x-1 text-cyan-400' : 'text-slate-500'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer Keyboard Hints ──────────────────────────────────── */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-3 border-t border-white/10">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white">↵</kbd>
              Select
            </span>
          </div>

          <span className="text-cyan-400">LernKino Search</span>
        </div>
      </div>
    </div>
  );
}
