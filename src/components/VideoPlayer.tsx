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
  expectedDuration?: number;
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
  expectedDuration,
  autoResume = false,
  startTime,
  onTimeUpdateCallback,
  onNextEpisode,
  hasNextEpisode,
  nextEpisodeInfo,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubRailRef = useRef<HTMLDivElement>(null);
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
  const [duration, setDuration] = useState<number>(expectedDuration && expectedDuration > 0 ? expectedDuration : 0);
  const [bufferedPct, setBufferedPct] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [hasVideoError, setHasVideoError] = useState<boolean>(false);

  // Smooth scrubbing & drag state
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubbingTime, setScrubbingTime] = useState<number | null>(null);

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

  // ── 0. Multi-Tier Duration Helper ──────────────────────────────────────────
  const getEffectiveDuration = useCallback((): number => {
    const vid = videoRef.current;
    if (vid && typeof vid.duration === 'number' && !isNaN(vid.duration) && isFinite(vid.duration) && vid.duration > 0) {
      return vid.duration;
    }
    if (typeof duration === 'number' && !isNaN(duration) && isFinite(duration) && duration > 0) {
      return duration;
    }
    if (typeof expectedDuration === 'number' && !isNaN(expectedDuration) && isFinite(expectedDuration) && expectedDuration > 0) {
      return expectedDuration;
    }
    // Subtitle cue fallback: find maximum end timestamp
    const allCues = [...germanCues, ...englishCues];
    if (allCues.length > 0) {
      let maxEnd = 0;
      for (const cue of allCues) {
        if (typeof cue.endTime === 'number' && isFinite(cue.endTime) && cue.endTime > maxEnd) {
          maxEnd = cue.endTime;
        }
      }
      if (maxEnd > 0) return maxEnd;
    }
    return 0;
  }, [duration, expectedDuration, germanCues, englishCues]);

  const syncDuration = useCallback(() => {
    const vid = videoRef.current;
    if (vid && typeof vid.duration === 'number' && !isNaN(vid.duration) && isFinite(vid.duration) && vid.duration > 0) {
      setDuration((prev) => (Math.abs(prev - vid.duration) > 0.3 ? vid.duration : prev));
      return;
    }
    const eff = getEffectiveDuration();
    if (eff > 0) {
      setDuration((prev) => (prev <= 0 ? eff : prev));
    }
  }, [getEffectiveDuration]);

  // Re-sync duration whenever subtitles or expectedDuration updates
  useEffect(() => {
    syncDuration();
  }, [syncDuration, germanCues, englishCues, expectedDuration]);

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
      const effDur = getEffectiveDuration();
      if (!vid || effDur <= 0) return;

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
        duration: effDur,
        lastWatchedAt: new Date().toISOString(),
        completed: false, // saveWatchProgress will auto-mark true if >= 95%
      };

      saveWatchProgress(progressItem);
    },
    [mediaId, type, seriesSlug, seasonNumber, episodeNumber, movieSlug, title, seriesTitle, getEffectiveDuration]
  );

  // ── 2. Handle Initial Video Source & Resumes ─────────────────────────────────
  useEffect(() => {
    const src = initialVideoSrc ? withBasePath(initialVideoSrc) : null;
    setVideoSrc(src);
    setHasVideoError(false);
    if (videoRef.current) {
      videoRef.current.load();
    }
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

    syncDuration();

    if (startTime !== undefined && startTime > 0) {
      vid.currentTime = startTime;
      setCurrentTime(startTime);
    } else if (autoResume && savedResumeTime > 0) {
      vid.currentTime = savedResumeTime;
      setCurrentTime(savedResumeTime);
    }
  };

  const handleDurationChange = () => {
    syncDuration();
  };

  const handleCanPlay = () => {
    syncDuration();
    const vid = videoRef.current;
    if (!vid) return;
    if (startTime !== undefined && startTime > 0 && Math.abs(vid.currentTime - startTime) > 1) {
      vid.currentTime = startTime;
      setCurrentTime(startTime);
    } else if (autoResume && savedResumeTime > 0 && Math.abs(vid.currentTime - savedResumeTime) > 1) {
      vid.currentTime = savedResumeTime;
      setCurrentTime(savedResumeTime);
    }
  };

  const handleProgress = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const effDur = getEffectiveDuration();
    if (vid.buffered && vid.buffered.length > 0 && effDur > 0) {
      let activeBufferEnd = 0;
      for (let i = 0; i < vid.buffered.length; i++) {
        const end = vid.buffered.end(i);
        if (end > activeBufferEnd) activeBufferEnd = end;
      }
      setBufferedPct(Math.min(100, Math.max(0, (activeBufferEnd / effDur) * 100)));
    }
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;

    const vTime = vid.currentTime;
    if (!isScrubbing) {
      setCurrentTime(vTime);
      if (onTimeUpdateCallback) {
        onTimeUpdateCallback(vTime);
      }
    }

    if (duration <= 0 && typeof vid.duration === 'number' && isFinite(vid.duration) && vid.duration > 0) {
      setDuration(vid.duration);
    }

    // Calculate buffered percentage
    const effDur = getEffectiveDuration();
    if (vid.buffered && vid.buffered.length > 0 && effDur > 0) {
      let activeBufferEnd = 0;
      for (let i = 0; i < vid.buffered.length; i++) {
        const start = vid.buffered.start(i);
        const end = vid.buffered.end(i);
        if (start <= vTime && vTime <= end) {
          activeBufferEnd = end;
          break;
        }
        if (end > activeBufferEnd) {
          activeBufferEnd = end;
        }
      }
      setBufferedPct(Math.min(100, Math.max(0, (activeBufferEnd / effDur) * 100)));
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

  const handleSeek = useCallback(
    (seconds: number) => {
      const vid = videoRef.current;
      if (!vid) return;
      const effDur = getEffectiveDuration();
      // If duration is known, clamp between 0 and effDur; otherwise just non-negative
      const target = effDur > 0 ? Math.max(0, Math.min(effDur, seconds)) : Math.max(0, seconds);

      if (!isNaN(target) && isFinite(target)) {
        try {
          vid.currentTime = target;
        } catch (err) {
          console.warn('[LernKino] Seek error:', err);
        }
        setCurrentTime(target);
        commitProgress(true);
      }
    },
    [getEffectiveDuration, commitProgress]
  );

  const handleSkip = useCallback(
    (deltaSeconds: number) => {
      const vid = videoRef.current;
      if (!vid) return;
      const baseTime = isScrubbing && scrubbingTime !== null ? scrubbingTime : vid.currentTime;
      handleSeek(baseTime + deltaSeconds);
    },
    [handleSeek, isScrubbing, scrubbingTime]
  );

  // ── Precise Interactive Timeline Pointer Events ──────────────────────────
  const getTimeFromClientX = useCallback(
    (clientX: number): { time: number; pct: number } => {
      const rail = scrubRailRef.current;
      const effDur = getEffectiveDuration();
      if (!rail || effDur <= 0) return { time: 0, pct: 0 };

      const rect = rail.getBoundingClientRect();
      if (rect.width <= 0) return { time: 0, pct: 0 };

      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return {
        time: ratio * effDur,
        pct: ratio * 100,
      };
    },
    [getEffectiveDuration]
  );

  const handleScrubPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const { time, pct } = getTimeFromClientX(e.clientX);
    setIsScrubbing(true);
    setScrubbingTime(time);
    setScrubHoverPos(pct);
    setScrubHoverTime(time);
    handleSeek(time);
    wakeControls();
  };

  const handleScrubPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const { time, pct } = getTimeFromClientX(e.clientX);
    setScrubHoverPos(pct);
    setScrubHoverTime(time);

    if (isScrubbing) {
      setScrubbingTime(time);
      handleSeek(time);
      wakeControls();
    }
  };

  const handleScrubPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isScrubbing) {
      const { time } = getTimeFromClientX(e.clientX);
      handleSeek(time);
      setIsScrubbing(false);
      setScrubbingTime(null);
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleScrubPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsScrubbing(false);
    setScrubbingTime(null);
    setScrubHoverTime(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
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

  const effectiveDur = getEffectiveDuration();
  const displayedTime = isScrubbing && scrubbingTime !== null ? scrubbingTime : currentTime;
  const progressPct =
    effectiveDur > 0
      ? Math.min(100, Math.max(0, (displayedTime / effectiveDur) * 100))
      : 0;

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
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onDurationChange={handleDurationChange}
          onCanPlay={handleCanPlay}
          onLoadedData={handleLoadedMetadata}
          onProgress={handleProgress}
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
        <div className="absolute top-3 left-3 right-3 sm:right-auto sm:top-6 sm:left-6 z-30 max-w-sm rounded-2xl glass-card border border-cyan-500/40 p-3.5 sm:p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
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
        <div className="absolute top-12 sm:top-16 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-cyan-500/40 text-[11px] sm:text-xs font-mono font-bold text-cyan-300 shadow-[0_0_25px_rgba(0,255,255,0.35)] animate-in fade-in zoom-in-95 duration-200 pointer-events-none text-center">
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
        mediaSourceTitle={seriesTitle || title}
        seriesSlug={seriesSlug}
        seasonNumber={seasonNumber}
        episodeNumber={episodeNumber}
        movieSlug={movieSlug}
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
        className={`absolute top-0 left-0 right-0 p-3 sm:p-6 flex items-center justify-between gap-2 z-20 pointer-events-none transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="bg-slate-950/70 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl border border-white/10 pointer-events-auto min-w-0 max-w-[70%] sm:max-w-md">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold block truncate">
            {seriesTitle ? `${seriesTitle} · S${seasonNumber}E${episodeNumber}` : 'Cinema'}
          </span>
          <h2 className="text-xs sm:text-sm font-bold text-white truncate">{title}</h2>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
          {localFileName && (
            <div className="bg-cyan-500/15 backdrop-blur-md border border-cyan-500/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-mono text-cyan-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate max-w-[80px] sm:max-w-[140px]">{localFileName}</span>
            </div>
          )}

          {(localDeName || localEnName) && (
            <div className="bg-emerald-500/15 backdrop-blur-md border border-emerald-500/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-mono text-emerald-300 flex items-center gap-1">
              <Subtitles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate max-w-[80px] sm:max-w-[140px]">{localDeName || localEnName}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Center Play / Pause Splash (visible on pause) ──────────── */}
      {!isPlaying && videoSrc && (
        <button
          onClick={handlePlayPause}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-cyan-500 text-slate-950 shadow-[0_0_35px_rgba(0,255,255,0.7)] flex items-center justify-center transition-transform hover:scale-110 active:scale-95 z-20"
          aria-label="Play video"
        >
          <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-current translate-x-0.5" />
        </button>
      )}

      {/* ── Caption Settings Popover ────────────────────────────────── */}
      {showCaptionSettings && (
        <div className="fixed sm:absolute inset-x-3 bottom-20 sm:inset-x-auto sm:bottom-24 sm:right-6 z-40 w-auto sm:w-96 max-h-[80vh] overflow-y-auto rounded-2xl sm:rounded-3xl glass-card bg-zinc-950/95 backdrop-blur-2xl border border-cyan-500/30 p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-[0_16px_48px_rgba(0,0,0,0.85)] animate-in fade-in slide-in-from-bottom-3 duration-200">
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

          {/* Snappy Fast-Speech Transition */}
          <div className="pt-1 border-t border-white/10">
            <button
              onClick={() => {
                const nextVal = !(subtitlePrefs.snappyDialogue ?? true);
                const updated = saveSubtitlePreferences({ snappyDialogue: nextVal });
                setSubtitlePrefs(updated);
              }}
              className="w-full flex items-center justify-between text-left py-1 group"
              type="button"
            >
              <div>
                <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <span>⚡ Snappy Fast Dialogue</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                    (subtitlePrefs.snappyDialogue ?? true) ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/10 text-slate-400'
                  }`}>
                    {(subtitlePrefs.snappyDialogue ?? true) ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-normal">
                  Advances on time during rapid speech without lingering old lines
                </div>
              </div>
              <div
                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ml-2 ${
                  (subtitlePrefs.snappyDialogue ?? true) ? 'bg-cyan-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white transition-transform ${
                    (subtitlePrefs.snappyDialogue ?? true) ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>
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
        <div className="fixed sm:absolute inset-x-3 bottom-20 sm:inset-x-auto sm:bottom-28 sm:right-6 z-40 max-w-sm w-auto rounded-2xl sm:rounded-3xl glass-card bg-zinc-950/95 border border-cyan-500/40 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.85)] space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
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
        className={`absolute bottom-0 left-0 right-0 p-2 sm:p-4 md:p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-20 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <div className="rounded-2xl glass-card border border-white/10 p-2 sm:p-3.5 space-y-2 sm:space-y-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">

          {/* ── Progress Scrubber with Hover Tooltip ─────────────────── */}
          <div
            ref={scrubRailRef}
            className="relative group/scrub py-2 sm:py-2.5 cursor-pointer touch-none select-none"
            onPointerDown={handleScrubPointerDown}
            onPointerMove={handleScrubPointerMove}
            onPointerUp={handleScrubPointerUp}
            onPointerCancel={handleScrubPointerCancel}
            onMouseLeave={() => {
              if (!isScrubbing) setScrubHoverTime(null);
            }}
          >
            {/* Timestamp hover / scrubbing tooltip */}
            {scrubHoverTime !== null && effectiveDur > 0 && (
              <div
                className="absolute -top-7 -translate-x-1/2 px-2.5 py-0.5 rounded-lg bg-zinc-950/95 border border-cyan-400/50 text-[10px] font-mono font-bold text-cyan-300 shadow-[0_0_12px_rgba(0,0,0,0.8)] pointer-events-none z-30 transition-transform duration-75"
                style={{ left: `${scrubHoverPos}%` }}
              >
                {formatTimestamp(scrubHoverTime)}
              </div>
            )}

            {/* Scrubber Rail & Progress */}
            <div className="relative h-2 group-hover/scrub:h-2.5 w-full bg-white/15 rounded-full overflow-hidden transition-all duration-150">
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

            {/* Scrubber Playhead Thumb */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-cyan-300 border-2 border-slate-950 shadow-[0_0_12px_rgba(0,255,255,1)] transition-transform duration-100 pointer-events-none ${
                isScrubbing ? 'scale-125' : 'group-hover/scrub:scale-110'
              }`}
              style={{ left: `${progressPct}%` }}
            />
          </div>

          {/* ── Bottom Control Buttons ───────────────────────────────── */}
          <div className="flex items-center justify-between gap-1 sm:gap-3 text-white">

            {/* Left Controls: Play, Skip, Replay Line, Timestamp */}
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <button
                onClick={handlePlayPause}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500 hover:text-slate-950 flex items-center justify-center transition-all shadow-[0_0_15px_rgba(0,255,255,0.2)] shrink-0"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current translate-x-0.5" />}
              </button>

              <button
                onClick={() => handleSkip(-10)}
                className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-colors shrink-0"
                title="Skip back 10 seconds (Left Arrow)"
              >
                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                onClick={() => handleSkip(10)}
                className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-colors shrink-0"
                title="Skip forward 10 seconds (Right Arrow)"
              >
                <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {nextEpisodeInfo && (
                <button
                  onClick={handlePlayNextNow}
                  className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-colors shrink-0 hidden xs:flex"
                  title={`Play Next Episode: ${nextEpisodeInfo.title}`}
                >
                  <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}

              {/* Repeat Current/Last Subtitle Line Button (Language Learning Shortcut) */}
              <button
                onClick={handleRepeatCurrentLine}
                className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl glass-pill text-[11px] sm:text-xs font-mono font-bold text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30 flex items-center gap-1 transition-all shrink-0"
                title="Repeat Current Line (R)"
              >
                <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden md:inline">Replay Line (R)</span>
                <span className="md:hidden">Replay</span>
              </button>

              {/* Timestamp */}
              <div className="text-[11px] sm:text-xs font-mono text-slate-300 select-none ml-1 whitespace-nowrap">
                <span className="text-white font-bold">{formatTimestamp(displayedTime)}</span>
                <span className="text-slate-500 mx-0.5 sm:mx-1">/</span>
                <span className="text-slate-400">
                  {effectiveDur > 0 ? formatTimestamp(effectiveDur) : '--:--'}
                </span>
              </div>
            </div>

            {/* Right Controls: Caption Mode, Settings, Volume, Speed, Local File, Fullscreen */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">

              {/* Caption Mode Switcher Pill */}
              <button
                onClick={handleCycleCaptionMode}
                className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-xl text-[11px] sm:text-xs font-mono font-bold transition-all border shrink-0 ${
                  subtitlePrefs.mode !== 'off'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(0,255,255,0.25)]'
                    : 'glass-pill text-slate-400 border-white/10 hover:text-white'
                }`}
                title="Caption Mode (C) - Press to cycle: Both -> DE -> EN -> Off"
              >
                {subtitlePrefs.mode === 'both' && 'DE+EN'}
                {subtitlePrefs.mode === 'de' && 'DE'}
                {subtitlePrefs.mode === 'en' && 'EN'}
                {subtitlePrefs.mode === 'off' && 'OFF'}
              </button>

              {/* Caption Settings Popover Toggle */}
              <button
                onClick={() => setShowCaptionSettings(!showCaptionSettings)}
                className={`p-1.5 sm:p-2 rounded-xl transition-all shrink-0 ${
                  showCaptionSettings
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(0,255,255,0.4)]'
                    : 'text-slate-300 hover:text-cyan-400 hover:bg-white/10'
                }`}
                title="Subtitle & Sync Settings"
              >
                <Subtitles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {/* Volume Slider */}
              <div className="flex items-center gap-1 sm:gap-1.5 group/vol shrink-0">
                <button
                  onClick={handleToggleMute}
                  className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-colors"
                  title="Toggle mute (M)"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-14 sm:w-20 h-1 bg-white/20 rounded-full accent-cyan-400 cursor-pointer hidden lg:block"
                  aria-label="Volume slider"
                />
              </div>

              {/* Playback Speed Pill */}
              <button
                onClick={handleSpeedChange}
                className="px-2 py-1 sm:px-2.5 sm:py-1 rounded-xl text-[11px] sm:text-xs font-mono font-bold glass-pill text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all shrink-0 hidden xs:block"
                title="Playback Speed"
              >
                {playbackRate}x
              </button>

              {/* Open Local Video File Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-colors shrink-0 hidden sm:flex"
                title="Load Local Video File (.mp4 / .webm)"
              >
                <FolderOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {/* Fullscreen Button */}
              <button
                onClick={handleToggleFullscreen}
                className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-colors shrink-0"
                title="Toggle Fullscreen (F)"
              >
                {isFullscreen ? <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
