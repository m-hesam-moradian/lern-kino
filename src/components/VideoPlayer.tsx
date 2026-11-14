'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { withBasePath } from '@/lib/paths';
import {
  saveWatchProgress,
  getProgressForMedia,
  formatTimestamp,
} from '@/lib/watchHistory';
import type { WatchProgress } from '@/types/learning';
import type {
  SubtitleCue,
  SubtitlePreferences,
  CaptionMode,
  CaptionFontSize,
  CaptionEnColor,
  CaptionBgOpacity,
} from '@/types/subtitles';
import {
  getSubtitlePreferences,
  saveSubtitlePreferences,
  fetchSubtitleTrack,
  loadLocalSubtitleFile,
} from '@/lib/subtitlePrefs';
import { findCurrentOrPreviousCue } from '@/lib/srtParser';
import DualSubtitleOverlay from '@/components/DualSubtitleOverlay';
import WordDictionaryModal from '@/components/WordDictionaryModal';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  FolderOpen,
  Clock,
  Upload,
  CheckCircle2,
  AlertCircle,
  Subtitles,
  X,
  Sliders,
  Sparkles,
  SkipForward,
} from 'lucide-react';

export interface VideoPlayerProps {
  mediaId: string;
  type: 'episode' | 'movie';
  title: string;
  seriesTitle?: string;
  seriesSlug?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  movieSlug?: string;
  initialVideoSrc: string | null;
  subtitles?: {
    de: string | null;
    en: string | null;
  };
  autoResume?: boolean;
  startTime?: number;
  onTimeUpdateCallback?: (currentTime: number) => void;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
  nextEpisodeInfo?: {
    seriesSlug: string;
    seasonNumber: number;
    episodeNumber: number;
    title: string;
    url: string;
  } | null;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5];

export default function VideoPlayer({
  mediaId,
  type,
  title,
  seriesTitle,
  seriesSlug,
  seasonNumber,
  episodeNumber,
  movieSlug,
  initialVideoSrc,
  subtitles,
  autoResume = false,
  startTime,
  onTimeUpdateCallback,
  onNextEpisode,
  hasNextEpisode,
  nextEpisodeInfo,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deSrtInputRef = useRef<HTMLInputElement>(null);
  const enSrtInputRef = useRef<HTMLInputElement>(null);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hudTimerRef = useRef<NodeJS.Timeout | null>(null);
  const upNextIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Throttling ref for watch progress
  const lastSaveTimestampRef = useRef<number>(0);

  // Up Next auto-advance card state
  const [showUpNextCard, setShowUpNextCard] = useState<boolean>(false);
  const [upNextSeconds, setUpNextSeconds] = useState<number>(6);

  // Player core state
  const [videoSrc, setVideoSrc] = useState<string | null>(
    initialVideoSrc ? withBasePath(initialVideoSrc) : null
  );
  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedPct, setBufferedPct] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [hasVideoError, setHasVideoError] = useState<boolean>(false);

  // Subtitle engine state
  const [germanCues, setGermanCues] = useState<SubtitleCue[]>([]);
  const [englishCues, setEnglishCues] = useState<SubtitleCue[]>([]);
  const [subtitlePrefs, setSubtitlePrefs] = useState<SubtitlePreferences>(getSubtitlePreferences());
  const [showCaptionSettings, setShowCaptionSettings] = useState<boolean>(false);
  const [localDeName, setLocalDeName] = useState<string | null>(null);
  const [localEnName, setLocalEnName] = useState<string | null>(null);

  // HUD toast notification state
  const [hudMessage, setHudMessage] = useState<string | null>(null);

  // Resume prompt state
  const [showResumePrompt, setShowResumePrompt] = useState<boolean>(false);
  const [savedResumeTime, setSavedResumeTime] = useState<number>(0);

  // Interactive word dictionary inspection modal state
  const [inspectWord, setInspectWord] = useState<{
    word: string;
    germanSentence?: string;
    englishSentence?: string;
    timestampSeconds: number;
  } | null>(null);
  const [wasPlayingBeforeInspect, setWasPlayingBeforeInspect] = useState<boolean>(false);

  // Scrub bar hover tooltip state
  const [scrubHoverTime, setScrubHoverTime] = useState<number | null>(null);
  const [scrubHoverPos, setScrubHoverPos] = useState<number>(0);

  // ── 0. HUD Notification Helper ──────────────────────────────────────────────
  const showHud = useCallback((message: string) => {
    setHudMessage(message);
    if (hudTimerRef.current) {
      clearTimeout(hudTimerRef.current);
    }
    hudTimerRef.current = setTimeout(() => {
      setHudMessage(null);
    }, 1600);
  }, []);

  // ── 1. Commit Watch Progress Helper ──────────────────────────────────────────
  const commitProgress = useCallback(
    (force = false) => {
      const vid = videoRef.current;
      if (!vid || isNaN(vid.duration) || vid.duration <= 0) return;

      const now = Date.now();
      // Throttle to 2000ms unless force is true
      if (!force && now - lastSaveTimestampRef.current < 2000) {
        return;
      }
      lastSaveTimestampRef.current = now;

      const progressItem: WatchProgress = {
        id: mediaId,
        type,
        seriesSlug,
        seasonNumber,
        episodeNumber,
        movieSlug,
        title,
        seriesTitle,
        currentTime: vid.currentTime,
        duration: vid.duration,
        lastWatchedAt: new Date().toISOString(),
        completed: false, // saveWatchProgress will auto-mark true if >= 95%
      };

      saveWatchProgress(progressItem);
    },
    [mediaId, type, seriesSlug, seasonNumber, episodeNumber, movieSlug, title, seriesTitle]
  );

  // ── 2. Handle Initial Video Source & Resumes ─────────────────────────────────
  useEffect(() => {
    setVideoSrc(initialVideoSrc ? withBasePath(initialVideoSrc) : null);
    setHasVideoError(false);
  }, [initialVideoSrc]);

  // Clean up any generated blob URL on unmount
  useEffect(() => {
    return () => {
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [localBlobUrl]);

  // Check saved progress on mediaId change
  useEffect(() => {
    const saved = getProgressForMedia(mediaId);
    if (saved && saved.currentTime > 5 && !saved.completed) {
      setSavedResumeTime(saved.currentTime);
      if (autoResume) {
        // Will seek in onLoadedMetadata
      } else if (startTime === undefined) {
        setShowResumePrompt(true);
      }
    } else {
      setShowResumePrompt(false);
    }
  }, [mediaId, autoResume, startTime]);

  // ── 3. Fetch Subtitle Tracks ────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function loadTracks() {
      try {
        const [deResult, enResult] = await Promise.all([
          subtitles?.de ? fetchSubtitleTrack(subtitles.de) : Promise.resolve([]),
          subtitles?.en ? fetchSubtitleTrack(subtitles.en) : Promise.resolve([]),
        ]);

        if (active) {
          setGermanCues(deResult);
          setEnglishCues(enResult);
          setLocalDeName(null);
          setLocalEnName(null);
        }
      } catch (err) {
        console.warn('[LernKino] Error loading subtitle tracks:', err);
      }
    }

    loadTracks();

    return () => {
      active = false;
    };
  }, [subtitles?.de, subtitles?.en]);

  // ── 4. Lifecycle Listeners (VisibilityChange & BeforeUnload) ──────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        commitProgress(true);
      }
    };
    const handleBeforeUnload = () => {
      commitProgress(true);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [commitProgress]);

  // ── 5. Controls Auto-Hide Behavior ──────────────────────────────────────────
  const wakeControls = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    if (isPlaying) {
      hideControlsTimerRef.current = setTimeout(() => {
        // Keep controls visible if user has settings popover open
        if (!showCaptionSettings) {
          setShowControls(false);
        }
      }, 3000);
    }
  }, [isPlaying, showCaptionSettings]);

  const handleContainerMouseMove = useCallback(() => {
    wakeControls();
  }, [wakeControls]);

  // ── 6. HTML5 Video Event Handlers ────────────────────────────────────────────
  const handleLoadedMetadata = () => {
    const vid = videoRef.current;
    if (!vid) return;

    setDuration(vid.duration);

    if (startTime !== undefined && startTime > 0) {
      vid.currentTime = startTime;
      setCurrentTime(startTime);
    } else if (autoResume && savedResumeTime > 0) {
      vid.currentTime = savedResumeTime;
      setCurrentTime(savedResumeTime);
    }
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;

    setCurrentTime(vid.currentTime);
    if (onTimeUpdateCallback) {
      onTimeUpdateCallback(vid.currentTime);
    }

    // Calculate buffered percentage
    if (vid.buffered.length > 0 && vid.duration > 0) {
      const bufferedEnd = vid.buffered.end(vid.buffered.length - 1);
      setBufferedPct(Math.min(100, (bufferedEnd / vid.duration) * 100));
    }

    commitProgress(false);
  };

  const handlePlayPause = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (vid.paused) {
      vid.play().catch((err) => console.warn('[LernKino] Video playback error:', err));
    } else {
      vid.pause();
    }
  }, []);

  const handleSeek = useCallback((seconds: number) => {
    const vid = videoRef.current;
    if (!vid || isNaN(vid.duration)) return;
    const target = Math.max(0, Math.min(vid.duration, seconds));
    vid.currentTime = target;
    setCurrentTime(target);
    commitProgress(true);
  }, [commitProgress]);

  const handleSkip = useCallback((deltaSeconds: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    handleSeek(vid.currentTime + deltaSeconds);
  }, [handleSeek]);

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    handleSeek(target);
  };

  const handleScrubHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const clampedPos = Math.max(0, Math.min(1, pos));
    setScrubHoverPos(clampedPos * 100);
    setScrubHoverTime(clampedPos * duration);
  };

  const handleScrubLeave = () => {
    setScrubHoverTime(null);
  };

  const handleToggleMute = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !isMuted;
    setIsMuted(!isMuted);
    showHud(vid.muted ? 'Muted' : 'Unmuted');
  }, [isMuted, showHud]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const vid = videoRef.current;
    if (!vid) return;
    vid.volume = val;
    setVolume(val);
    if (val === 0) {
      vid.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      vid.muted = false;
      setIsMuted(false);
    }
  };

  const handleSpeedChange = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const currentIdx = SPEED_OPTIONS.indexOf(playbackRate);
    const nextSpeed = SPEED_OPTIONS[(currentIdx + 1) % SPEED_OPTIONS.length];
    vid.playbackRate = nextSpeed;
    setPlaybackRate(nextSpeed);
    showHud(`Speed: ${nextSpeed}x`);
  };

  const handleToggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.warn);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.warn);
    }
  }, []);

  // ── 7. Subtitle Interactions: Mode Cycle & Line Repeat ───────────────────────
  const handleCycleCaptionMode = useCallback(() => {
    const modes: CaptionMode[] = ['both', 'de', 'en', 'off'];
    const nextIdx = (modes.indexOf(subtitlePrefs.mode) + 1) % modes.length;
    const nextMode = modes[nextIdx];
    const updated = saveSubtitlePreferences({ mode: nextMode });
    setSubtitlePrefs(updated);

    const labels: Record<CaptionMode, string> = {
      both: 'Captions: German + English',
      de: 'Captions: German Only',
      en: 'Captions: English Only',
      off: 'Captions: Off',
    };
    showHud(labels[nextMode]);
    wakeControls();
  }, [subtitlePrefs.mode, showHud, wakeControls]);

  const handleRepeatCurrentLine = useCallback(() => {
    const cues = germanCues.length > 0 ? germanCues : englishCues;
    if (cues.length === 0) {
      showHud('No subtitle cues available');
      return;
    }

    const targetCue = findCurrentOrPreviousCue(cues, currentTime + subtitlePrefs.offsetSeconds);
    if (targetCue) {
      handleSeek(Math.max(0, targetCue.startTime));
      const previewText = targetCue.text.length > 34 ? `${targetCue.text.slice(0, 34)}…` : targetCue.text;
      showHud(`↺ Replay: "${previewText}"`);
      if (!isPlaying) {
        videoRef.current?.play().catch(console.warn);
      }
    }
  }, [germanCues, englishCues, currentTime, subtitlePrefs.offsetSeconds, handleSeek, showHud, isPlaying]);

  const handleWordClick = useCallback(
    (word: string, lang: 'de' | 'en', clickedCue: SubtitleCue, pairedCue?: SubtitleCue) => {
      const vid = videoRef.current;
      const currentlyPlaying = Boolean(vid && !vid.paused);
      setWasPlayingBeforeInspect(currentlyPlaying);
      if (currentlyPlaying && vid) {
        vid.pause();
        setIsPlaying(false);
      }

      const germanText = lang === 'de' ? clickedCue.text : pairedCue?.text;
      const englishText = lang === 'en' ? clickedCue.text : pairedCue?.text;

      setInspectWord({
        word,
        germanSentence: germanText,
        englishSentence: englishText,
        timestampSeconds: clickedCue.startTime,
      });
    },
    []
  );

  const handleCloseInspect = useCallback((shouldResume?: boolean) => {
    setInspectWord(null);
    if (shouldResume && videoRef.current) {
      videoRef.current.play().catch(console.warn);
    }
  }, []);

  const handleCancelUpNext = useCallback(() => {
    setShowUpNextCard(false);
    if (upNextIntervalRef.current) {
      clearInterval(upNextIntervalRef.current);
    }
  }, []);

  const handlePlayNextNow = useCallback(() => {
    handleCancelUpNext();
    onNextEpisode?.();
  }, [handleCancelUpNext, onNextEpisode]);

  const handleReplayCurrent = useCallback(() => {
    handleCancelUpNext();
    handleSeek(0);
    videoRef.current?.play().catch(console.warn);
  }, [handleCancelUpNext, handleSeek]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (upNextIntervalRef.current) {
        clearInterval(upNextIntervalRef.current);
      }
    };
  }, []);

  // ── 8. Local Video & Subtitle File Loaders ────────────────────────────────────
  const handleLoadLocalVideoFile = (file: File) => {
    if (!file) return;
    if (!/\.(mp4|webm)$/i.test(file.name)) {
      alert('Please select an .mp4 or .webm video file.');
      return;
    }

    if (localBlobUrl) {
      URL.revokeObjectURL(localBlobUrl);
    }

    const newUrl = URL.createObjectURL(file);
    setLocalBlobUrl(newUrl);
    setLocalFileName(file.name);
    setVideoSrc(newUrl);
    setHasVideoError(false);
    showHud(`Loaded video: ${file.name}`);

    // Auto-play the loaded file
    setTimeout(() => {
      videoRef.current?.play().catch(console.warn);
    }, 150);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLoadLocalVideoFile(file);
    }
  };

  const handleLoadLocalSrt = async (e: React.ChangeEvent<HTMLInputElement>, lang: 'de' | 'en') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cues = await loadLocalSubtitleFile(file);
    if (lang === 'de') {
      setGermanCues(cues);
      setLocalDeName(file.name);
      showHud(`Loaded German subtitles (${cues.length} cues)`);
    } else {
      setEnglishCues(cues);
      setLocalEnName(file.name);
      showHud(`Loaded English subtitles (${cues.length} cues)`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (/\.(mp4|webm)$/i.test(file.name)) {
      handleLoadLocalVideoFile(file);
    } else if (/\.srt$/i.test(file.name)) {
      // Check if file name hints at english
      if (/\.en\.srt$/i.test(file.name)) {
        loadLocalSubtitleFile(file).then((cues) => {
          setEnglishCues(cues);
          setLocalEnName(file.name);
          showHud(`Loaded English subtitles (${cues.length} cues)`);
        });
      } else {
        loadLocalSubtitleFile(file).then((cues) => {
          setGermanCues(cues);
          setLocalDeName(file.name);
          showHud(`Loaded German subtitles (${cues.length} cues)`);
        });
      }
    }
  };

  // ── 9. Keyboard Shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          handlePlayPause();
          wakeControls();
          break;
        case 'arrowleft':
          e.preventDefault();
          handleSkip(-5);
          wakeControls();
          break;
        case 'arrowright':
          e.preventDefault();
          handleSkip(5);
          wakeControls();
          break;
        case 'm':
          e.preventDefault();
          handleToggleMute();
          wakeControls();
          break;
        case 'f':
          e.preventDefault();
          handleToggleFullscreen();
          wakeControls();
          break;
        case 'c':
          e.preventDefault();
          handleCycleCaptionMode();
          break;
        case 'r':
          e.preventDefault();
          handleRepeatCurrentLine();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeControls, handlePlayPause, handleSkip, handleToggleMute, handleToggleFullscreen, handleCycleCaptionMode, handleRepeatCurrentLine]);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleContainerMouseMove}
      onMouseLeave={() => isPlaying && !showCaptionSettings && setShowControls(false)}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleDrop}
      className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black select-none border border-slate-300/60 dark:border-white/10 shadow-2xl group"
    >
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={deSrtInputRef}
        type="file"
        accept=".srt"
        onChange={(e) => handleLoadLocalSrt(e, 'de')}
        className="hidden"
      />
      <input
        ref={enSrtInputRef}
        type="file"
        accept=".srt"
        onChange={(e) => handleLoadLocalSrt(e, 'en')}
        className="hidden"
      />

      {/* ── HTML5 Video Element ──────────────────────────────────────── */}
      {videoSrc ? (
        <video
          ref={videoRef}
          src={videoSrc}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => {
            setIsPlaying(true);
            wakeControls();
          }}
          onPause={() => {
            setIsPlaying(false);
            commitProgress(true);
            setShowControls(true);
          }}
          onEnded={() => {
            setIsPlaying(false);
            commitProgress(true);
            setShowControls(true);
            if (nextEpisodeInfo && onNextEpisode) {
              setShowUpNextCard(true);
              setUpNextSeconds(6);
              if (upNextIntervalRef.current) clearInterval(upNextIntervalRef.current);
              upNextIntervalRef.current = setInterval(() => {
                setUpNextSeconds((prev) => {
                  if (prev <= 1) {
                    if (upNextIntervalRef.current) clearInterval(upNextIntervalRef.current);
                    setShowUpNextCard(false);
                    onNextEpisode();
                    return 0;
                  }
                  return prev - 1;
                });
              }, 1000);
            } else if (hasNextEpisode && onNextEpisode) {
              onNextEpisode();
            }
          }}
          onSeeked={() => commitProgress(true)}
          onError={() => setHasVideoError(true)}
          onClick={() => {
            if (!showControls) {
              wakeControls();
            } else {
              handlePlayPause();
            }
          }}
          className="w-full h-full object-contain cursor-pointer"
          playsInline
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-t from-slate-950 via-zinc-900 to-slate-950">
          <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(0,255,255,0.2)]">
            <FolderOpen className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Video Source Attached</h3>
          <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
            This episode does not have a bundled video or external URL. You can stream your local{' '}
            <code className="text-cyan-400">.mp4</code> or <code className="text-cyan-400">.webm</code> file straight from your computer with zero upload.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_25px_rgba(0,255,255,0.4)] transition-all hover:scale-105 active:scale-95"
          >
            <Upload className="w-4 h-4" />
            Select Local Video File
          </button>
        </div>
      )}

      {/* ── Error Fallback Overlay ────────────────────────────────────── */}
      {hasVideoError && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
          <AlertCircle className="w-12 h-12 text-rose-400 mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">Failed to Load Video Source</h3>
          <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
            The configured video stream could not be loaded or was blocked by CORS. You can retry the connection or stream your local file directly.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setHasVideoError(false);
                if (videoRef.current && videoSrc) {
                  videoRef.current.load();
                  videoRef.current.play().catch(console.warn);
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold glass-pill text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/20 transition-all"
            >
              <RotateCw className="w-4 h-4" />
              Retry Stream
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.3)] transition-all"
            >
              <FolderOpen className="w-4 h-4" />
              Open Local Video (.mp4 / .webm)
            </button>
          </div>
        </div>
      )}

      {/* ── Drag & Drop File Overlay ─────────────────────────────────── */}
      {isDraggingFile && (
        <div className="absolute inset-0 bg-cyan-950/85 backdrop-blur-md border-2 border-dashed border-cyan-400 flex flex-col items-center justify-center p-6 text-center z-50 animate-pulse">
          <Upload className="w-16 h-16 text-cyan-400 mb-3" />
          <h3 className="text-2xl font-black text-white">Drop your .mp4, .webm, or .srt file here</h3>
          <p className="text-xs text-cyan-200 mt-1">Instant playback with simultaneous dual German + English captions</p>
        </div>
      )}

      {/* ── Floating Resume Prompt (if opened without &resume=1) ────── */}
      {showResumePrompt && savedResumeTime > 0 && (
        <div className="absolute top-6 left-6 z-30 max-w-sm rounded-2xl glass-card border border-cyan-500/40 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                Resume from {formatTimestamp(savedResumeTime)}?
              </h4>
              <p className="text-[11px] text-slate-300 leading-snug">
                You previously paused this video at {formatTimestamp(savedResumeTime)}.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    handleSeek(savedResumeTime);
                    setShowResumePrompt(false);
                    videoRef.current?.play().catch(console.warn);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.4)] transition-all"
                >
                  Resume
                </button>
                <button
                  onClick={() => {
                    handleSeek(0);
                    setShowResumePrompt(false);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold glass-pill text-slate-300 hover:text-white transition-all"
                >
                  Start Over
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HUD Heads-Up Toast Notification ─────────────────────────── */}
      {hudMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-cyan-500/40 text-xs font-mono font-bold text-cyan-300 shadow-[0_0_25px_rgba(0,255,255,0.35)] animate-in fade-in zoom-in-95 duration-200 pointer-events-none text-center">
          {hudMessage}
        </div>
      )}

      {/* ── Simultaneous Dual-Caption Overlay (Step 4 & 5 Engine) ──── */}
      <DualSubtitleOverlay
        currentTime={currentTime}
        germanCues={germanCues}
        englishCues={englishCues}
        preferences={subtitlePrefs}
        controlsVisible={showControls}
        onWordClick={handleWordClick}
      />

      {/* ── Interactive Word Dictionary & Leitner Modal ────────────── */}
      {inspectWord && (
        <WordDictionaryModal
          word={inspectWord.word}
          germanSentence={inspectWord.germanSentence}
          englishSentence={inspectWord.englishSentence}
          timestampSeconds={inspectWord.timestampSeconds}
          seriesSlug={seriesSlug}
          seasonNumber={seasonNumber}
          episodeNumber={episodeNumber}
          movieSlug={movieSlug}
          mediaSourceTitle={seriesTitle || title}
          onClose={handleCloseInspect}
          wasPlayingBeforeOpen={wasPlayingBeforeInspect}
        />
      )}

      {/* ── Top Header Bar (Title & Local Indicators) ───────────────── */}
      <div
        className={`absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-20 pointer-events-none transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="bg-slate-950/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 pointer-events-auto">
          <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold block">
            {seriesTitle ? `${seriesTitle} · S${seasonNumber}E${episodeNumber}` : 'Cinema'}
          </span>
          <h2 className="text-sm font-bold text-white truncate max-w-md">{title}</h2>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {localFileName && (
            <div className="bg-cyan-500/15 backdrop-blur-md border border-cyan-500/30 px-3 py-1.5 rounded-xl text-[11px] font-mono text-cyan-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="truncate max-w-[140px]">{localFileName}</span>
            </div>
          )}

          {(localDeName || localEnName) && (
            <div className="bg-emerald-500/15 backdrop-blur-md border border-emerald-500/30 px-3 py-1.5 rounded-xl text-[11px] font-mono text-emerald-300 flex items-center gap-1.5">
              <Subtitles className="w-3.5 h-3.5" />
              <span className="truncate max-w-[140px]">{localDeName || localEnName}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Center Play / Pause Splash (visible on pause) ──────────── */}
      {!isPlaying && videoSrc && (
        <button
          onClick={handlePlayPause}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-cyan-500 text-slate-950 shadow-[0_0_40px_rgba(0,255,255,0.7)] flex items-center justify-center transition-transform hover:scale-110 active:scale-95 z-20"
          aria-label="Play video"
        >
          <Play className="w-8 h-8 fill-current translate-x-0.5" />
        </button>
      )}

      {/* ── Caption Settings Popover ────────────────────────────────── */}
      {showCaptionSettings && (
        <div className="absolute bottom-24 right-4 sm:right-6 z-40 w-80 sm:w-96 rounded-3xl glass-card bg-zinc-950/90 backdrop-blur-2xl border border-cyan-500/30 p-5 space-y-4 shadow-[0_16px_48px_rgba(0,0,0,0.85)] animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Caption & Sync Settings
              </h3>
            </div>
            <button
              onClick={() => setShowCaptionSettings(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Caption Mode Switcher */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400">Caption Display</label>
            <div className="grid grid-cols-4 gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              {(['both', 'de', 'en', 'off'] as CaptionMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    const updated = saveSubtitlePreferences({ mode: m });
                    setSubtitlePrefs(updated);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    subtitlePrefs.mode === m
                      ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(0,255,255,0.4)]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {m === 'both' ? 'DE+EN' : m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400">Font Size</label>
            <div className="grid grid-cols-4 gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              {(['sm', 'md', 'lg', 'xl'] as CaptionFontSize[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    const updated = saveSubtitlePreferences({ fontSize: s });
                    setSubtitlePrefs(updated);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    subtitlePrefs.fontSize === s
                      ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(0,255,255,0.4)]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* English Color */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400">English Text Color</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'yellow', label: 'Yellow', color: 'bg-yellow-400' },
                  { id: 'cyan', label: 'Cyan', color: 'bg-cyan-400' },
                  { id: 'white', label: 'White', color: 'bg-slate-200' },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    const updated = saveSubtitlePreferences({ enColor: c.id });
                    setSubtitlePrefs(updated);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                    subtitlePrefs.enColor === c.id
                      ? 'bg-white/15 border-cyan-400 text-white font-bold'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${c.color}`} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Timing Sync Offset */}
          <div className="space-y-2 pt-1 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-400">Timing Micro-Sync</label>
              <span className="text-xs font-mono font-bold text-cyan-400">
                {subtitlePrefs.offsetSeconds > 0 ? '+' : ''}
                {subtitlePrefs.offsetSeconds.toFixed(1)}s
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {[-0.5, -0.1, 0.1, 0.5].map((delta) => (
                <button
                  key={delta}
                  onClick={() => {
                    const newOffset = Math.round((subtitlePrefs.offsetSeconds + delta) * 10) / 10;
                    const updated = saveSubtitlePreferences({ offsetSeconds: newOffset });
                    setSubtitlePrefs(updated);
                  }}
                  className="flex-1 py-1 rounded-lg text-[11px] font-mono glass-pill text-slate-300 hover:text-white hover:bg-white/10 transition-all"
                >
                  {delta > 0 ? `+${delta}` : delta}s
                </button>
              ))}
              <button
                onClick={() => {
                  const updated = saveSubtitlePreferences({ offsetSeconds: 0 });
                  setSubtitlePrefs(updated);
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-white/5 text-slate-400 hover:text-white border border-white/10 transition-all"
                title="Reset offset to 0.0s"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Custom Local SRT Pickers */}
          <div className="space-y-2 pt-1 border-t border-white/10">
            <label className="text-[11px] font-semibold text-slate-400">Custom Subtitle Files</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => deSrtInputRef.current?.click()}
                className="py-1.5 px-2 rounded-xl text-[11px] font-mono border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center gap-1.5 truncate"
                title="Load German .srt file"
              >
                <Upload className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate">{localDeName || 'German .srt'}</span>
              </button>
              <button
                onClick={() => enSrtInputRef.current?.click()}
                className="py-1.5 px-2 rounded-xl text-[11px] font-mono border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center gap-1.5 truncate"
                title="Load English .srt file"
              >
                <Upload className="w-3 h-3 text-yellow-400 shrink-0" />
                <span className="truncate">{localEnName || 'English .srt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Up Next Countdown Card ──────────────────────────────────── */}
      {showUpNextCard && nextEpisodeInfo && (
        <div className="absolute bottom-28 right-4 sm:right-6 z-40 max-w-sm w-[calc(100%-2rem)] sm:w-auto rounded-3xl glass-card bg-zinc-950/95 border border-cyan-500/40 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.85)] space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Up Next in {upNextSeconds}s
            </span>
            <button
              onClick={handleCancelUpNext}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Cancel auto-play"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <span className="text-[10px] font-mono text-slate-400">
              Season {nextEpisodeInfo.seasonNumber} · Episode {nextEpisodeInfo.episodeNumber}
            </span>
            <h4 className="text-sm font-bold text-white line-clamp-1">{nextEpisodeInfo.title}</h4>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 rounded-full transition-all duration-1000 ease-linear shadow-[0_0_12px_rgba(0,255,255,0.8)]"
              style={{ width: `${(upNextSeconds / 6) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handlePlayNextNow}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(0,255,255,0.4)] flex items-center justify-center gap-1.5 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Play Now
            </button>
            <button
              onClick={handleReplayCurrent}
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold glass-pill text-slate-300 hover:text-white transition-all"
            >
              Replay
            </button>
          </div>
        </div>
      )}

      {/* ── Custom Glassmorphic Controls Overlay ───────────────────── */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <div className="rounded-2xl glass-card border border-white/10 p-3 sm:p-4 space-y-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">

          {/* ── Progress Scrubber with Hover Tooltip ─────────────────── */}
          <div
            className="relative group/scrub py-1 cursor-pointer"
            onMouseMove={handleScrubHover}
            onMouseLeave={handleScrubLeave}
          >
            {/* Timestamp hover tooltip */}
            {scrubHoverTime !== null && (
              <div
                className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-lg bg-zinc-900 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 shadow-md pointer-events-none"
                style={{ left: `${scrubHoverPos}%` }}
              >
                {formatTimestamp(scrubHoverTime)}
              </div>
            )}

            {/* Scrubber Rail & Progress */}
            <div className="relative h-2 w-full bg-white/15 rounded-full overflow-hidden">
              {/* Buffered Bar */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-white/20 rounded-full transition-all duration-300"
                style={{ width: `${bufferedPct}%` }}
              />
              {/* Played Bar */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-cyan-400 rounded-full shadow-[0_0_12px_rgba(0,255,255,0.8)]"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Invisible Range Slider */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleScrubberChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Seek video position"
            />
          </div>

          {/* ── Bottom Control Buttons ───────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 text-white">

            {/* Left Controls: Play, Skip, Replay Line, Timestamp */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              <button
                onClick={handlePlayPause}
                className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500 hover:text-slate-950 flex items-center justify-center transition-all shadow-[0_0_15px_rgba(0,255,255,0.2)]"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current translate-x-0.5" />}
              </button>

              <button
                onClick={() => handleSkip(-10)}
                className="p-2 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-colors"
                title="Skip back 10 seconds (Left Arrow)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleSkip(10)}
                className="p-2 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-colors"
                title="Skip forward 10 seconds (Right Arrow)"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {nextEpisodeInfo && (
                <button
                  onClick={handlePlayNextNow}
                  className="p-2 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-colors"
                  title={`Play Next Episode: ${nextEpisodeInfo.title}`}
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              )}

              {/* Repeat Current/Last Subtitle Line Button (Language Learning Shortcut) */}
              <button
                onClick={handleRepeatCurrentLine}
                className="px-2.5 py-1.5 rounded-xl glass-pill text-xs font-mono font-bold text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30 flex items-center gap-1 transition-all"
                title="Repeat Current Line (R)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Replay Line (R)</span>
                <span className="sm:hidden">R</span>
              </button>

              {/* Timestamp */}
              <div className="text-xs font-mono text-slate-300 select-none ml-1 hidden xs:block">
                <span className="text-white font-bold">{formatTimestamp(currentTime)}</span>
                <span className="text-slate-500 mx-1">/</span>
                <span className="text-slate-400">{formatTimestamp(duration)}</span>
              </div>
            </div>

            {/* Right Controls: Volume, Speed, Caption Mode, Settings, Fullscreen */}
            <div className="flex items-center gap-1.5 sm:gap-2">

              {/* Caption Mode Switcher Pill */}
              <button
                onClick={handleCycleCaptionMode}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all border ${
                  subtitlePrefs.mode !== 'off'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(0,255,255,0.25)]'
                    : 'glass-pill text-slate-400 border-white/10 hover:text-white'
                }`}
                title="Caption Mode (C) - Press to cycle: Both -> DE -> EN -> Off"
              >
                {subtitlePrefs.mode === 'both' && 'DE + EN'}
                {subtitlePrefs.mode === 'de' && 'DE'}
                {subtitlePrefs.mode === 'en' && 'EN'}
                {subtitlePrefs.mode === 'off' && 'CC OFF'}
              </button>

              {/* Caption Settings Popover Toggle */}
              <button
                onClick={() => setShowCaptionSettings(!showCaptionSettings)}
                className={`p-2 rounded-xl transition-all ${
                  showCaptionSettings
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(0,255,255,0.4)]'
                    : 'text-slate-300 hover:text-cyan-400 hover:bg-white/10'
                }`}
                title="Subtitle & Sync Settings"
              >
                <Subtitles className="w-4 h-4" />
              </button>

              {/* Volume Slider */}
              <div className="flex items-center gap-1.5 group/vol">
                <button
                  onClick={handleToggleMute}
                  className="p-2 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-colors"
                  title="Toggle mute (M)"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-14 sm:w-20 h-1 bg-white/20 rounded-full accent-cyan-400 cursor-pointer hidden md:block"
                  aria-label="Volume slider"
                />
              </div>

              {/* Playback Speed Pill */}
              <button
                onClick={handleSpeedChange}
                className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold glass-pill text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all hidden sm:block"
                title="Playback Speed"
              >
                {playbackRate}x
              </button>

              {/* Open Local Video File Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-colors"
                title="Load Local Video File (.mp4 / .webm)"
              >
                <FolderOpen className="w-4 h-4" />
              </button>

              {/* Fullscreen Button */}
              <button
                onClick={handleToggleFullscreen}
                className="p-2 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-colors"
                title="Toggle Fullscreen (F)"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
