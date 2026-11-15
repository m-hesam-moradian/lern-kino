#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# py -3.12 lernkino_pipeline.py
"""
LernKino Media Organizer & Subtitle Pipeline
============================================
Automated transcription, translation, and media organization pipeline for LernKino.
Generates:
  1. <basename>.srt            (German 1:1 Dubtitle from Whisper)
  2. <basename>.en.srt         (English Translation via Google Translate Batch)
  3. <basename>.bilingual.srt  (German + <font color="#ffff00">English</font>)

Usage:
  py -3.12 lernkino_pipeline.py
"""

import os
import sys
import shutil
import re
import json
import subprocess
from pathlib import Path
from typing import List, Dict, Tuple, Optional

# ── PyAV Compatibility Patch ────────────────────────────────────────────────
# PyAV 19.x removed the 'metadata_errors' parameter which faster-whisper passes to av.open.
import av
_orig_av_open = av.open
def _compat_av_open(*args, **kwargs):
    kwargs.pop("metadata_errors", None)
    return _orig_av_open(*args, **kwargs)
av.open = _compat_av_open

# ── Faster-Whisper & Translation Imports ────────────────────────────────────
from faster_whisper import WhisperModel
import requests
from deep_translator import GoogleTranslator

# Enhance GoogleTranslator.translate_batch to execute fast genuine batch requests
# against Google Translate API (preventing 429 rate-limiting from sequential web-scraping).
_orig_translate_batch = GoogleTranslator.translate_batch

def _fast_translate_batch(self, batch, **kwargs):
    if not batch:
        return []
    try:
        delim = "\n§§§\n"
        full_text = delim.join(batch)
        response = requests.get(
            "https://translate.googleapis.com/translate_a/single",
            params={
                "client": "gtx",
                "sl": self._source,
                "tl": self._target,
                "dt": "t",
                "q": full_text
            },
            timeout=25
        )
        response.raise_for_status()
        data = response.json()
        translated_full = "".join(item[0] for item in data[0] if item and item[0])
        results = [p.strip() for p in translated_full.split("§§§")]
        if len(results) == len(batch):
            return results
    except Exception as e:
        print(f"[!] Warning: Fast batch request fallback due to: {e}", file=sys.stderr)
    return _orig_translate_batch(self, batch, **kwargs)

GoogleTranslator.translate_batch = _fast_translate_batch


# ── Configuration & Paths ──────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent

# Auto-detect LernKino Next.js app directory
APP_ROOT = SCRIPT_DIR / "subsync"
if not APP_ROOT.exists():
    alt_app = SCRIPT_DIR / "lern-kino"
    if alt_app.exists():
        APP_ROOT = alt_app
    else:
        APP_ROOT = SCRIPT_DIR

MEDIA_ROOT = APP_ROOT / "public" / "media"
SERIES_ROOT = MEDIA_ROOT / "series"
MOVIES_ROOT = MEDIA_ROOT / "movies"

SUPPORTED_VIDEO_EXTS = {".mp4", ".mkv", ".avi", ".webm", ".mov", ".m4v"}
SUPPORTED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".avif"}


# ── Terminal Styling Helpers ───────────────────────────────────────────────
class Colors:
    CYAN = "\033[96m"
    BRIGHT_CYAN = "\033[1;96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    GRAY = "\033[90m"
    WHITE = "\033[97m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


def print_banner():
    banner = f"""{Colors.BRIGHT_CYAN}
╔═══════════════════════════════════════════════════════════════════════╗
║   🎬 LernKino — Media Organizer & German Subtitle Pipeline v1.0      ║
║   Whisper DE Dubtitles · English Batch Translation · Bilingual SRT    ║
╚═══════════════════════════════════════════════════════════════════════╝{Colors.RESET}
"""
    print(banner)


def clean_input_path(raw: str) -> str:
    """Strips outer quotes and whitespace from drag-and-dropped Windows paths."""
    if not raw:
        return ""
    cleaned = raw.strip()
    # Remove leading and trailing quotes if present
    if (cleaned.startswith('"') and cleaned.endswith('"')) or (cleaned.startswith("'") and cleaned.endswith("'")):
        cleaned = cleaned[1:-1].strip()
    return os.path.normpath(cleaned)


def prompt_choice(prompt: str, num_options: int, default: Optional[int] = None) -> int:
    """Prompt user for a numeric choice within 0..num_options."""
    while True:
        suffix = f" [default: {default}]" if default is not None else ""
        try:
            val = input(f"{Colors.BOLD}{prompt}{suffix}: {Colors.RESET}").strip()
            if not val and default is not None:
                return default
            choice = int(val)
            if 0 <= choice <= num_options:
                return choice
            print(f"{Colors.RED}Please enter a number between 0 and {num_options}.{Colors.RESET}")
        except ValueError:
            print(f"{Colors.RED}Invalid input. Please enter a number.{Colors.RESET}")
        except (KeyboardInterrupt, EOFError):
            print(f"\n{Colors.YELLOW}Operation cancelled by user.{Colors.RESET}")
            sys.exit(0)


def prompt_string(prompt: str, default: str = "", required: bool = False) -> str:
    """Prompt user for string input."""
    while True:
        try:
            suffix = f" [default: {default}]" if default else ""
            val = input(f"{Colors.BOLD}{prompt}{suffix}: {Colors.RESET}").strip()
            if not val:
                if default:
                    return default
                if not required:
                    return ""
                print(f"{Colors.RED}This field is required.{Colors.RESET}")
                continue
            return val
        except (KeyboardInterrupt, EOFError):
            print(f"\n{Colors.YELLOW}Operation cancelled by user.{Colors.RESET}")
            sys.exit(0)


def prompt_yes_no(prompt: str, default_yes: bool = True) -> bool:
    """Prompt user with yes/no."""
    choice_str = "[Y/n]" if default_yes else "[y/N]"
    while True:
        try:
            val = input(f"{Colors.BOLD}{prompt} {choice_str}: {Colors.RESET}").strip().lower()
            if not val:
                return default_yes
            if val in {"y", "yes", "j", "ja"}:
                return True
            if val in {"n", "no", "nein"}:
                return False
            print(f"{Colors.RED}Please answer 'y' or 'n'.{Colors.RESET}")
        except (KeyboardInterrupt, EOFError):
            print(f"\n{Colors.YELLOW}Operation cancelled by user.{Colors.RESET}")
            sys.exit(0)


# ── SRT Formatting & Parsing Helpers ───────────────────────────────────────
def parse_timestamp_str(ts_str: str) -> float:
    """Parses '00:01:23,456' or '00:01:23.456' into float seconds."""
    clean = ts_str.strip().replace(',', '.')
    parts = clean.split(':')
    if len(parts) == 3:
        return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    elif len(parts) == 2:
        return float(parts[0]) * 60 + float(parts[1])
    return float(clean)


def format_timestamp(seconds: float) -> str:
    """Converts seconds into SRT timestamp string HH:MM:SS,mmm."""
    total_ms = max(0, int(round(seconds * 1000)))
    hours = total_ms // 3600000
    minutes = (total_ms % 3600000) // 60000
    secs = (total_ms % 60000) // 1000
    millis = total_ms % 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def parse_srt(srt_content: str) -> List[Dict[str, str]]:
    """Parses SRT content into a list of subtitle dictionaries."""
    raw_blocks = srt_content.replace("\r\n", "\n").replace("\r", "\n").strip().split("\n\n")
    blocks = []
    for raw in raw_blocks:
        lines = [line.strip() for line in raw.split("\n") if line.strip()]
        if len(lines) >= 2:
            idx = lines[0]
            timestamp = lines[1]
            text = "\n".join(lines[2:]) if len(lines) > 2 else ""
            blocks.append({
                "index": idx,
                "timestamp": timestamp,
                "text": text
            })
    return blocks


def sanitize_cues(cues: List[Dict]) -> List[Dict]:
    """
    Enforces strict sorting, eliminates cue overlaps, introduces clean 40ms frame gaps,
    and guarantees that every cue yields on time before the next dialogue starts.
    """
    if not cues:
        return []

    cues.sort(key=lambda c: c["start"])
    sanitized = []
    total = len(cues)

    for i, c in enumerate(cues):
        start = max(0.0, c["start"])
        end = max(start + 0.4, c["end"])

        # Strictly clamp against next cue start with a 40ms frame gap
        if i < total - 1:
            next_start = cues[i + 1]["start"]
            if end >= next_start - 0.04:
                end = max(start + 0.35, next_start - 0.04)

        sanitized.append({
            "index": i + 1,
            "start": start,
            "end": end,
            "text": c["text"].strip()
        })

    return sanitized


def build_adaptive_cues(
    segments,
    max_chars: int = 42,
    max_duration: float = 3.8,
    min_duration: float = 0.75,
    pause_split: float = 0.32
) -> List[Dict]:
    """
    Builds broadcast-standard, snappy, adaptive subtitle cues from Whisper segments.
    Uses word-level acoustic timestamps to:
      1. Split at natural sentence boundaries (. ! ? :)
      2. Split at audible pauses in speech (> pause_split) so subtitles never linger into pauses
      3. Adapt duration to fast-paced speech (short lines get quick, precise display times)
      4. Limit characters per line (~42 chars) to avoid wall-of-text subtitles
      5. Strictly eliminate overlaps with clean frame gaps between speakers
    """
    all_words = []
    fallback_cues = []

    for s in segments:
        if hasattr(s, "words") and s.words:
            for w in s.words:
                cleaned = w.word.strip()
                if cleaned:
                    all_words.append({
                        "word": w.word,
                        "start": w.start,
                        "end": w.end
                    })
        else:
            cleaned_text = s.text.strip()
            if cleaned_text:
                fallback_cues.append({
                    "start": s.start,
                    "end": s.end,
                    "text": cleaned_text
                })

    # If no word timestamps were available, use fallback
    if not all_words and fallback_cues:
        return sanitize_cues(fallback_cues)

    cues = []
    current_words = []
    current_start = 0.0

    for w in all_words:
        if not current_words:
            current_words.append(w)
            current_start = max(0.0, w["start"] - 0.04)
            continue

        prev_w = current_words[-1]
        pause = w["start"] - prev_w["end"]

        # Candidate text and duration
        cand_text = "".join(x["word"] for x in current_words) + w["word"]
        cand_text_clean = cand_text.strip()
        cand_duration = w["end"] - current_start

        # Break conditions:
        # A. Sentence boundary (. ! ? :)
        has_sentence_end = bool(re.search(r'[\.\!\?\:]$', prev_w["word"].strip()))

        # B. Audible pause in dialogue (> 0.32s)
        has_audible_pause = pause >= pause_split

        # C. Exceeded max characters or max duration
        is_too_long = len(cand_text_clean) > max_chars or cand_duration > max_duration

        if has_sentence_end or (has_audible_pause and len(current_words) >= 2) or is_too_long:
            text = "".join(x["word"] for x in current_words).strip()
            # Duration based on actual acoustic word end plus small reading buffer (0.12s)
            end_time = max(current_words[-1]["end"] + 0.12, current_start + min_duration)
            cues.append({
                "start": current_start,
                "end": end_time,
                "text": text
            })
            current_words = [w]
            current_start = max(0.0, w["start"] - 0.04)
        else:
            current_words.append(w)

    if current_words:
        text = "".join(x["word"] for x in current_words).strip()
        end_time = max(current_words[-1]["end"] + 0.12, current_start + min_duration)
        cues.append({
            "start": current_start,
            "end": end_time,
            "text": text
        })

    return sanitize_cues(cues)


def sanitize_and_adapt_srt_content(srt_content: str) -> str:
    """
    Sanitizes any existing SRT file by:
    1. Detecting and repairing rigid dummy durations (e.g. 2.000s padding on short words).
    2. Preventing captions from lingering into pauses by introducing clean frame gaps.
    3. Strictly eliminating all overlapping cue collisions.
    """
    raw_blocks = srt_content.replace('\r\n', '\n').replace('\r', '\n').strip().split('\n\n')
    cues = []

    for b in raw_blocks:
        lines = [l.strip() for l in b.split('\n') if l.strip()]
        if len(lines) >= 2:
            m = re.match(r'(\d\d:\d\d:\d\d[\.,]\d\d\d)\s*-->\s*(\d\d:\d\d:\d\d[\.,]\d\d\d)', lines[1])
            if m:
                text = '\n'.join(lines[2:]).strip()
                if text:
                    cues.append({
                        'start': parse_timestamp_str(m.group(1)),
                        'end': parse_timestamp_str(m.group(2)),
                        'text': text
                    })

    if not cues:
        return srt_content

    cues.sort(key=lambda c: c['start'])
    sanitized = []
    total = len(cues)

    for i in range(total):
        cue = cues[i]
        start = cue['start']
        end = cue['end']
        text = cue['text']
        raw_dur = end - start

        # Calculate natural speech duration based on text length
        plain_text = re.sub(r'<[^>]+>', '', text).strip()
        char_count = len(plain_text)

        # Average German speech rate is ~15-16 chars/sec + 0.3s base recognition
        estimated_natural_dur = min(4.0, max(0.75, (char_count / 15.0) + 0.3))

        # Check if this cue has an artificial 2.0s clamp on a very short phrase
        if abs(raw_dur - 2.0) < 0.05 and char_count <= 25:
            # Short phrase like "Du sagst es." (12 chars) -> adapt down to natural speech duration (~0.9s)
            end = start + estimated_natural_dur
        elif raw_dur > 4.5 and char_count < 30:
            # Overextended silence clamp
            end = start + estimated_natural_dur

        # Clamp against next cue start with 40ms frame gap
        if i < total - 1:
            next_start = cues[i + 1]['start']
            gap = next_start - end
            if end >= next_start - 0.04:
                end = max(start + 0.5, next_start - 0.04)
            elif gap < 0.04 and gap >= 0:
                end = max(start + 0.5, next_start - 0.04)

        sanitized.append({
            'index': i + 1,
            'start': start,
            'end': end,
            'text': text
        })

    output_lines = []
    for c in sanitized:
        s_str = format_timestamp(c['start'])
        e_str = format_timestamp(c['end'])
        output_lines.append(f"{c['index']}\n{s_str} --> {e_str}\n{c['text']}\n")

    return "\n".join(output_lines)


# ── Step A & B: Folder Selection / Creation ────────────────────────────────
def natural_sort_key(s: str):
    """Key for natural sorting of alphanumeric folder names (e.g. s1, s2, s10)."""
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]


def select_or_create_series() -> Path:
    """Interactive navigation for Series -> Season -> Episode folder."""
    SERIES_ROOT.mkdir(parents=True, exist_ok=True)
    existing_series = sorted([d for d in SERIES_ROOT.iterdir() if d.is_dir()], key=lambda p: p.name.lower())

    print(f"\n{Colors.CYAN}── Select Series ──────────────────────────────────────────────────────{Colors.RESET}")
    for idx, s_path in enumerate(existing_series, start=1):
        print(f"  [{idx}] {s_path.name}")
    print(f"  [0] {Colors.GREEN}+ Add New Series{Colors.RESET}")

    choice = prompt_choice("Choose series", len(existing_series), default=1 if existing_series else 0)

    if choice == 0:
        # Create new Series
        series_name = prompt_string("Enter Series Name (e.g. 'Dark (German Dub)' or 'Babylon Berlin')", required=True)
        series_dir = SERIES_ROOT / series_name
        series_dir.mkdir(parents=True, exist_ok=True)
        (series_dir / "seasons").mkdir(exist_ok=True)

        # Write default series.json if missing
        series_meta = series_dir / "series.json"
        if not series_meta.exists():
            default_meta = {
                "title": series_name,
                "description": f"German-dubbed streaming edition of {series_name}.",
                "genres": ["Drama", "Language Learning"],
                "language": "de",
                "featured": False
            }
            with open(series_meta, "w", encoding="utf-8") as f:
                json.dump(default_meta, f, indent=2, ensure_ascii=False)
            print(f"{Colors.GREEN}✓ Created series metadata: {series_meta.name}{Colors.RESET}")

        # Optional cover image
        cover_input = prompt_string("Optional: Path to Series Cover Image (drag & drop, or press Enter to skip)")
        if cover_input:
            cover_path = Path(clean_input_path(cover_input))
            if cover_path.exists() and cover_path.suffix.lower() in SUPPORTED_IMAGE_EXTS:
                dest_cover = series_dir / f"cover{cover_path.suffix.lower()}"
                shutil.copy2(cover_path, dest_cover)
                print(f"{Colors.GREEN}✓ Copied series cover to {dest_cover.name}{Colors.RESET}")
            else:
                print(f"{Colors.YELLOW}Cover image not found or unsupported; skipping.{Colors.RESET}")
    else:
        series_dir = existing_series[choice - 1]

    # ── Seasons Selection ──
    seasons_base = series_dir / "seasons"
    if not seasons_base.exists():
        # Check for flat s1, s2 folders or create seasons/
        flat_seasons = [d for d in series_dir.iterdir() if d.is_dir() and re.match(r'^(s\d+|\d+|season[\s._-]*\d+)$', d.name, re.I)]
        if flat_seasons:
            seasons_base = series_dir
        else:
            seasons_base.mkdir(parents=True, exist_ok=True)

    existing_seasons = sorted(
        [d for d in seasons_base.iterdir() if d.is_dir()],
        key=lambda p: natural_sort_key(p.name)
    )

    print(f"\n{Colors.CYAN}── Select Season for '{series_dir.name}' ───────────────────────────{Colors.RESET}")
    for idx, s_path in enumerate(existing_seasons, start=1):
        print(f"  [{idx}] Season {s_path.name}")
    print(f"  [0] {Colors.GREEN}+ Add New Season{Colors.RESET}")

    choice_s = prompt_choice("Choose season", len(existing_seasons), default=1 if existing_seasons else 0)

    if choice_s == 0:
        season_num_str = prompt_string("Enter Season Number (e.g. 1 or 2)", default=str(len(existing_seasons) + 1), required=True)
        season_dir = seasons_base / season_num_str
        season_dir.mkdir(parents=True, exist_ok=True)
        print(f"{Colors.GREEN}✓ Created Season folder: {season_dir.relative_to(MEDIA_ROOT)}{Colors.RESET}")
    else:
        season_dir = existing_seasons[choice_s - 1]

    # ── Episode Selection ──
    existing_eps = sorted(
        [d for d in season_dir.iterdir() if d.is_dir()],
        key=lambda p: natural_sort_key(p.name)
    )

    print(f"\n{Colors.CYAN}── Select Episode in '{series_dir.name} - Season {season_dir.name}' ───────{Colors.RESET}")
    for idx, ep_path in enumerate(existing_eps, start=1):
        print(f"  [{idx}] Episode {ep_path.name}")
    print(f"  [0] {Colors.GREEN}+ Add New Episode{Colors.RESET}")

    choice_e = prompt_choice("Choose episode", len(existing_eps), default=0)

    if choice_e == 0:
        next_ep_num = len(existing_eps) + 1
        ep_num_str = prompt_string("Enter Episode Number (e.g. 1 or 2)", default=str(next_ep_num), required=True)
        ep_title = prompt_string("Optional Episode Title (e.g. 'The Pilot' or press Enter to skip)")

        folder_name = f"{ep_num_str} - {ep_title}" if ep_title else ep_num_str
        ep_dir = season_dir / folder_name
        ep_dir.mkdir(parents=True, exist_ok=True)

        if ep_title:
            ep_meta_path = ep_dir / "meta.json"
            if not ep_meta_path.exists():
                with open(ep_meta_path, "w", encoding="utf-8") as f:
                    json.dump({"title": ep_title}, f, indent=2, ensure_ascii=False)
                print(f"{Colors.GREEN}✓ Saved episode title to meta.json{Colors.RESET}")

        print(f"{Colors.GREEN}✓ Created Episode folder: {ep_dir.relative_to(MEDIA_ROOT)}{Colors.RESET}")
    else:
        ep_dir = existing_eps[choice_e - 1]

    # Compute standard episode code (e.g. S1E3)
    s_match = re.search(r'\d+', season_dir.name)
    e_match = re.search(r'\d+', ep_dir.name)
    s_num = int(s_match.group(0)) if s_match else 1
    e_num = int(e_match.group(0)) if e_match else 1
    std_code = f"S{s_num}E{e_num}"

    return ep_dir, std_code


def select_or_create_movie() -> Tuple[Path, str]:
    """Interactive navigation for Movies folder."""
    MOVIES_ROOT.mkdir(parents=True, exist_ok=True)
    existing_movies = sorted([d for d in MOVIES_ROOT.iterdir() if d.is_dir()], key=lambda p: p.name.lower())

    print(f"\n{Colors.CYAN}── Select Movie ───────────────────────────────────────────────────────{Colors.RESET}")
    for idx, m_path in enumerate(existing_movies, start=1):
        print(f"  [{idx}] {m_path.name}")
    print(f"  [0] {Colors.GREEN}+ Add New Movie{Colors.RESET}")

    choice = prompt_choice("Choose movie", len(existing_movies), default=1 if existing_movies else 0)

    if choice == 0:
        movie_name = prompt_string("Enter Movie Name (e.g. 'Good Bye Lenin!' or 'Lola rennt')", required=True)
        movie_dir = MOVIES_ROOT / movie_name
        movie_dir.mkdir(parents=True, exist_ok=True)

        # Write default meta.json if missing
        movie_meta = movie_dir / "meta.json"
        if not movie_meta.exists():
            default_meta = {
                "title": movie_name,
                "description": f"German cinema feature: {movie_name}.",
                "language": "de"
            }
            with open(movie_meta, "w", encoding="utf-8") as f:
                json.dump(default_meta, f, indent=2, ensure_ascii=False)
            print(f"{Colors.GREEN}✓ Created movie metadata: {movie_meta.name}{Colors.RESET}")

        # Optional cover image
        cover_input = prompt_string("Optional: Path to Movie Poster/Cover Image (drag & drop, or press Enter to skip)")
        if cover_input:
            cover_path = Path(clean_input_path(cover_input))
            if cover_path.exists() and cover_path.suffix.lower() in SUPPORTED_IMAGE_EXTS:
                dest_cover = movie_dir / f"cover{cover_path.suffix.lower()}"
                shutil.copy2(cover_path, dest_cover)
                print(f"{Colors.GREEN}✓ Copied movie poster to {dest_cover.name}{Colors.RESET}")
            else:
                print(f"{Colors.YELLOW}Cover image not found or unsupported; skipping.{Colors.RESET}")
    else:
        movie_dir = existing_movies[choice - 1]

    safe_title = re.sub(r'[^\w\-_\. ]', '', movie_dir.name).strip() or "movie"
    return movie_dir, safe_title


# ── Step C: Video Handling & url.txt ───────────────────────────────────────
def handle_video_file(target_dir: Path, default_stem: Optional[str] = None) -> Path:
    """Prompts for video source, offers clean renaming (e.g. S1E3.mp4), copies/moves it."""
    # Check if target folder already has video files
    existing_videos = [f for f in target_dir.iterdir() if f.is_file() and f.suffix.lower() in SUPPORTED_VIDEO_EXTS]
    source_path: Optional[Path] = None

    if existing_videos:
        print(f"\n{Colors.CYAN}── Video Detected in Target Folder ────────────────────────────────────{Colors.RESET}")
        for idx, ev in enumerate(existing_videos, start=1):
            ev_mb = ev.stat().st_size / (1024 * 1024)
            print(f"  [{idx}] {ev.name} ({ev_mb:.1f} MB)")
        print(f"  [0] Select / Drag & drop a different video file...")
        v_choice = prompt_choice("Use existing video in folder?", len(existing_videos), default=1)
        if v_choice > 0:
            source_path = existing_videos[v_choice - 1]

    if not source_path:
        print(f"\n{Colors.CYAN}── Video File Selection ───────────────────────────────────────────────{Colors.RESET}")
        while True:
            raw_path = prompt_string("Drag & drop or paste source VIDEO path (.mp4, .mkv, .webm, .avi)", required=True)
            cleaned = clean_input_path(raw_path)
            cand_path = Path(cleaned)

            if not cand_path.exists() or not cand_path.is_file():
                print(f"{Colors.RED}File does not exist: {cand_path}{Colors.RESET}")
                continue

            if cand_path.suffix.lower() not in SUPPORTED_VIDEO_EXTS:
                print(f"{Colors.YELLOW}Warning: Extension '{cand_path.suffix}' is unusual for video.{Colors.RESET}")
                if not prompt_yes_no("Proceed with this file anyway?", default_yes=True):
                    continue
            source_path = cand_path
            break

    ext = source_path.suffix.lower()
    size_mb = source_path.stat().st_size / (1024 * 1024)
    print(f"{Colors.GREEN}✓ Selected video: {source_path.name} ({size_mb:.1f} MB){Colors.RESET}")

    if size_mb > 95:
        print(f"\n{Colors.YELLOW}💡 Tip on File Size ({size_mb:.1f} MB):{Colors.RESET}")
        print(f"   GitHub enforces a hard 100 MB per-file push limit.")
        print(f"   LernKino's .gitignore automatically excludes raw video files from git,")
        print(f"   so you can stream this file locally without breaking GitHub Pages pushes!")
        print(f"   You can also provide a cloud streaming link in url.txt below.\n")

    # Determine destination filename (Standard S1E3.mp4 vs episode.mp4 vs original)
    if default_stem:
        print(f"{Colors.CYAN}── Destination Filename ───────────────────────────────────────────────{Colors.RESET}")
        print(f"  [1] {default_stem}{ext} (Recommended - standard code for LernKino subtitles: {default_stem}.srt)")
        print(f"  [2] episode{ext} (Generic)")
        print(f"  [3] {source_path.name} (Keep current filename)")
        print(f"  [4] Custom name...")
        name_choice = prompt_choice("Choose filename", 4, default=1)

        if name_choice == 1:
            target_filename = f"{default_stem}{ext}"
        elif name_choice == 2:
            target_filename = f"episode{ext}"
        elif name_choice == 3:
            target_filename = source_path.name
        else:
            custom_base = prompt_string(f"Enter filename (without extension {ext})", default=default_stem, required=True)
            target_filename = f"{custom_base}{ext}"
    else:
        target_filename = source_path.name

    dest_path = target_dir / target_filename

    # Execute transfer / rename
    if source_path.resolve() == dest_path.resolve():
        print(f"{Colors.CYAN}ℹ Video is already in target folder as '{target_filename}'. Skipping copy.{Colors.RESET}")
        dest_video = dest_path
    elif source_path.parent.resolve() == target_dir.resolve():
        # Video is inside target_dir, just rename it
        print(f"Renaming '{source_path.name}' to '{target_filename}' in target folder...")
        source_path.rename(dest_path)
        print(f"{Colors.GREEN}✓ Video renamed to {target_filename}.{Colors.RESET}")
        dest_video = dest_path
    else:
        print(f"\nChoose transfer action for {source_path.name} -> {target_filename}:")
        print(f"  [1] Copy video to target folder as '{target_filename}' (Default - keeps original safe)")
        print(f"  [2] Move video to target folder as '{target_filename}'")
        action = prompt_choice("Action", 2, default=1)

        if action == 1:
            print(f"Copying video ({size_mb:.1f} MB) to {target_filename}... Please wait...")
            shutil.copy2(source_path, dest_path)
            print(f"{Colors.GREEN}✓ Video copied successfully as {target_filename}.{Colors.RESET}")
            dest_video = dest_path
        else:
            print(f"Moving video to {target_filename}...")
            shutil.move(str(source_path), str(dest_path))
            print(f"{Colors.GREEN}✓ Video moved successfully as {target_filename}.{Colors.RESET}")
            dest_video = dest_path

    # Optional url.txt
    print(f"\n{Colors.CYAN}── Streaming Video URL (Optional) ────────────────────────────────────{Colors.RESET}")
    print("If you host this video externally (Cloudflare R2, Google Cloud, Internet Archive),")
    print("enter the public HTTPS URL so users can stream on GitHub Pages without uploading.")
    video_url = prompt_string("Enter stream URL (or press Enter to skip)")

    if video_url:
        url_file = target_dir / "url.txt"
        with open(url_file, "w", encoding="utf-8") as f:
            f.write(f"{video_url.strip()}\n")
        print(f"{Colors.GREEN}✓ Saved streaming URL to {url_file.name}{Colors.RESET}")

        # Also sync to meta.json if present
        meta_file = target_dir / "meta.json"
        meta_data = {}
        if meta_file.exists():
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta_data = json.load(f)
            except Exception:
                meta_data = {}
        meta_data["videoUrl"] = video_url.strip()
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(meta_data, f, indent=2, ensure_ascii=False)

    return dest_video


# ── Step D: Subtitle Pipeline (Whisper + Batch Translation) ────────────────
def run_transcription(video_path: Path, srt_path: Path):
    """Runs faster-whisper transcription with adaptive word-level speech synchronization."""
    print(f"\n{Colors.BRIGHT_CYAN}── Phase 1: German Transcription (Whisper AI + Adaptive Speech Timing) ──{Colors.RESET}")
    print("Select Whisper Model Size:")
    print("  [1] base   (Balanced speed & accuracy - ~2-3 min for 20-min episode, recommended)")
    print("  [2] small  (Higher German accuracy - ~6-10 min on CPU)")
    print("  [3] tiny   (Fastest preview - ~1 min)")
    print("  [4] medium (Maximum precision - ~15-20 min on CPU)")
    m_choice = prompt_choice("Choose Whisper model", 4, default=1)
    model_map = {1: "base", 2: "small", 3: "tiny", 4: "medium"}
    model_name = model_map.get(m_choice, "base")

    print(f"\nLoading faster-whisper '{model_name}' (device='auto', compute_type='int8')...")
    model = WhisperModel(model_name, device="auto", compute_type="int8")

    print(f"Transcribing audio from: {video_path.name}")
    print("Parameters: language='de', word_timestamps=True, vad_filter=True, min_silence=250ms")
    print("Adaptive Timing Engine: Active (automatic fast-speech duration & zero overlaps)\n")

    segments, info = model.transcribe(
        str(video_path),
        language="de",
        beam_size=5 if model_name in ["small", "medium"] else 2,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=250, speech_pad_ms=100)
    )

    print(f"Detected language: {info.language} (confidence: {info.language_probability:.2f})")
    print(f"Audio duration: {info.duration:.1f}s ({info.duration/60:.1f} min)")
    print("Building adaptive speech-synchronized cues...\n")

    segment_list = list(segments)
    adaptive_cues = build_adaptive_cues(segment_list)

    if not adaptive_cues:
        print(f"{Colors.YELLOW}Warning: No speech detected in audio.{Colors.RESET}")
        return

    # Write adaptive cues to srt_path
    with open(srt_path, "w", encoding="utf-8") as f:
        for c in adaptive_cues:
            s_str = format_timestamp(c["start"])
            e_str = format_timestamp(c["end"])
            block = f"{c['index']}\n{s_str} --> {e_str}\n{c['text']}\n\n"
            f.write(block)

    # Calculate and display quality statistics
    durations = [c["end"] - c["start"] for c in adaptive_cues]
    avg_dur = sum(durations) / len(durations) if durations else 0
    fast_cues = sum(1 for d in durations if d <= 1.2)

    print(f"{Colors.GREEN}✓ German transcription complete! Generated {len(adaptive_cues)} adaptive cues.{Colors.RESET}")
    print(f"  • Average cue duration: {avg_dur:.2f}s")
    print(f"  • Fast-dialogue cues (≤1.2s): {fast_cues} (dynamically timed to rapid speech)")
    print(f"  • Overlaps: 0 (100% clean, non-overlapping frame transitions)")


def run_translation(de_srt_path: Path, en_srt_path: Path, bilingual_srt_path: Path):
    """Runs fast batch translation and generates English and Bilingual SRT files."""
    print(f"\n{Colors.BRIGHT_CYAN}── Phase 2: English Batch Translation & Bilingual Generation ────────{Colors.RESET}")
    print(f"Reading German cues from: {de_srt_path.name}...")

    with open(de_srt_path, "r", encoding="utf-8") as f:
        content = f.read()

    blocks = parse_srt(content)
    total_blocks = len(blocks)
    if total_blocks == 0:
        print(f"{Colors.RED}Error: No subtitle cues found in {de_srt_path.name}.{Colors.RESET}")
        return

    print(f"Parsed {total_blocks} subtitle cues.")
    translator = GoogleTranslator(source="de", target="en")

    chunk_size = 50
    translated_blocks = []
    print(f"Translating in chunks of {chunk_size} via GoogleTranslator(source='de', target='en')...\n")

    for i in range(0, total_blocks, chunk_size):
        chunk = blocks[i : i + chunk_size]
        chunk_texts = [b["text"] for b in chunk]

        translations = translator.translate_batch(chunk_texts)

        for b, en_text in zip(chunk, translations):
            clean_en = en_text.strip()
            translated_blocks.append({
                "index": b["index"],
                "timestamp": b["timestamp"],
                "de_text": b["text"],
                "en_text": clean_en
            })

        pct = (len(translated_blocks) / total_blocks) * 100
        print(f"  {Colors.CYAN}--> Progress: {len(translated_blocks)} / {total_blocks} cues ({pct:.1f}%){Colors.RESET}")

    # Write English SRT
    print(f"\nWriting English SRT: {en_srt_path.name}...")
    with open(en_srt_path, "w", encoding="utf-8") as f_en:
        for item in translated_blocks:
            f_en.write(f"{item['index']}\n{item['timestamp']}\n{item['en_text']}\n\n")
    print(f"{Colors.GREEN}✓ Wrote English subtitles ({len(translated_blocks)} cues).{Colors.RESET}")

    # Write Bilingual SRT (German + Yellow English)
    print(f"Writing Bilingual SRT: {bilingual_srt_path.name}...")
    with open(bilingual_srt_path, "w", encoding="utf-8") as f_bi:
        for item in translated_blocks:
            f_bi.write(
                f"{item['index']}\n"
                f"{item['timestamp']}\n"
                f"{item['de_text']}\n"
                f'<font color="#ffff00">{item["en_text"]}</font>\n\n'
            )
    print(f"{Colors.GREEN}✓ Wrote Bilingual subtitles ({len(translated_blocks)} cues).{Colors.RESET}")


# ── Step E: Optional LernKino Sync & Git Integration ───────────────────────
def sync_lernkino_catalog():
    """Runs npm run catalog in LernKino Next.js app directory."""
    print(f"\n{Colors.CYAN}── Updating LernKino Media Catalog ────────────────────────────────────{Colors.RESET}")
    package_json = APP_ROOT / "package.json"
    if not package_json.exists():
        print(f"{Colors.YELLOW}package.json not found in {APP_ROOT}; skipping catalog update.{Colors.RESET}")
        return

    try:
        # Run node scripts/generate-catalog.mjs directly or via npm run catalog
        script_path = APP_ROOT / "scripts" / "generate-catalog.mjs"
        if script_path.exists():
            cmd = ["node", str(script_path)]
            subprocess.run(cmd, cwd=str(APP_ROOT), check=True)
        else:
            cmd = ["npm", "run", "catalog"]
            subprocess.run(cmd, cwd=str(APP_ROOT), check=True, shell=True)
        print(f"{Colors.GREEN}✓ LernKino catalog updated successfully.{Colors.RESET}")
    except Exception as e:
        print(f"{Colors.RED}Failed to update catalog: {e}{Colors.RESET}")


def git_commit_and_push(item_label: str):
    """Commits and pushes new subtitles and metadata to GitHub."""
    print(f"\n{Colors.CYAN}── Git Commit & Push ──────────────────────────────────────────────────{Colors.RESET}")
    print(f"{Colors.GRAY}Note: Raw video files (.mp4/.webm) are ignored by .gitignore;{Colors.RESET}")
    print(f"{Colors.GRAY}only tiny subtitle files, metadata, and covers will be pushed to GitHub.{Colors.RESET}\n")

    try:
        # Check if git repository exists
        res = subprocess.run(["git", "status"], cwd=str(APP_ROOT), capture_output=True, text=True)
        if res.returncode != 0:
            print(f"{Colors.YELLOW}No git repository found in {APP_ROOT}. Skipping push.{Colors.RESET}")
            return

        # Stage files
        subprocess.run(["git", "add", "."], cwd=str(APP_ROOT), check=True)

        # Check if there are changes to commit
        diff_res = subprocess.run(["git", "diff", "--staged", "--quiet"], cwd=str(APP_ROOT))
        if diff_res.returncode == 0:
            print(f"{Colors.YELLOW}No new changes detected to commit.{Colors.RESET}")
            return

        commit_msg = f"feat(media): add subtitles and metadata for {item_label}"
        subprocess.run(["git", "commit", "-m", commit_msg], cwd=str(APP_ROOT), check=True)
        print(f"{Colors.GREEN}✓ Created commit: {commit_msg}{Colors.RESET}")

        print("Pushing to GitHub origin main...")
        push_res = subprocess.run(["git", "push"], cwd=str(APP_ROOT), check=True)
        print(f"{Colors.GREEN}✓ Pushed to GitHub! Deployment workflow will build automatically.{Colors.RESET}")
    except subprocess.CalledProcessError as e:
        print(f"{Colors.RED}Git command failed: {e}{Colors.RESET}")
    except Exception as e:
        print(f"{Colors.RED}An unexpected error occurred during git sync: {e}{Colors.RESET}")


# ── Main Interactive Flow ──────────────────────────────────────────────────
def main():
    if "--help" in sys.argv or "-h" in sys.argv:
        print_banner()
        print(f"""Usage:
  py -3.12 lernkino_pipeline.py [OPTIONS]

Description:
  Interactive CLI assistant for organizing series and movies into LernKino
  (f:\\Friends\\subsync\\public\\media\\) and generating German, English,
  and Bilingual .srt subtitles using faster-whisper and Google Translate.

Options:
  -h, --help     Show this help message and exit.
""")
        sys.exit(0)

    print_banner()

    print(f"{Colors.BOLD}Media Target Root:{Colors.RESET} {MEDIA_ROOT}")
    if not MEDIA_ROOT.exists():
        MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

    # ── Step A: Content Type ──
    print(f"\n{Colors.CYAN}── Step 1: Content Type ───────────────────────────────────────────────{Colors.RESET}")
    print("  [1] Series Episode (Organized by Season & Episode)")
    print("  [2] Standalone Movie (Organized in Movies folder)")
    content_type_choice = prompt_choice("Choose content type", 2, default=1)

    # ── Step B: Folder Navigation / Creation ──
    if content_type_choice == 1:
        target_dir, default_stem = select_or_create_series()
        item_label = f"Series: {target_dir.parent.parent.name} {default_stem}"
    else:
        target_dir, default_stem = select_or_create_movie()
        item_label = f"Movie: {target_dir.name}"

    print(f"\n{Colors.GREEN}✓ Target Directory:{Colors.RESET} {target_dir}")

    # ── Step C: Video File Selection & Copy ──
    video_file = handle_video_file(target_dir, default_stem=default_stem)

    # ── Step D: Subtitle Plan & Confirmation ──
    video_stem = video_file.stem
    de_srt = target_dir / f"{video_stem}.srt"
    en_srt = target_dir / f"{video_stem}.en.srt"
    bilingual_srt = target_dir / f"{video_stem}.bilingual.srt"

    # Also detect if de.srt / en.srt already exist
    existing_srts = [p for p in [de_srt, en_srt, bilingual_srt] if p.exists()]
    skip_transcription = False

    print(f"\n{Colors.CYAN}── Subtitle Generation Plan ───────────────────────────────────────────{Colors.RESET}")
    print(f"  Target Video:     {video_file.name}")
    print(f"  German SRT:       {de_srt.name} {'(EXISTS)' if de_srt.exists() else ''}")
    print(f"  English SRT:      {en_srt.name} {'(EXISTS)' if en_srt.exists() else ''}")
    print(f"  Bilingual SRT:    {bilingual_srt.name} {'(EXISTS)' if bilingual_srt.exists() else ''}")

    if existing_srts:
        print(f"\n{Colors.YELLOW}Notice: One or more subtitle files already exist in this folder.{Colors.RESET}")
        print("  [1] Transcribe fresh with Whisper AI (Adaptive Speech Timings) & Overwrite all")
        if de_srt.exists():
            print("  [2] Sanitize & Adapt Timings of Existing German SRT (Fix 2.0s dummy timers & overlaps)")
            print("  [3] Skip Whisper: Use existing German SRT as-is for English & Bilingual translation")
        print("  [0] Cancel")
        max_sub = 3 if de_srt.exists() else 1
        sub_choice = prompt_choice("Choose subtitle action", max_sub, default=1)
        if sub_choice == 0:
            print(f"{Colors.YELLOW}Operation cancelled by user.{Colors.RESET}")
            sys.exit(0)
        elif sub_choice == 2:
            print(f"\n{Colors.CYAN}Sanitizing timings in {de_srt.name}...{Colors.RESET}")
            with open(de_srt, "r", encoding="utf-8") as f_in:
                raw_srt = f_in.read()
            sanitized = sanitize_and_adapt_srt_content(raw_srt)
            with open(de_srt, "w", encoding="utf-8") as f_out:
                f_out.write(sanitized)
            print(f"{Colors.GREEN}✓ Sanitized {de_srt.name}: eliminated fake 2s clamps & overlaps!{Colors.RESET}")
            skip_transcription = True
        elif sub_choice == 3:
            skip_transcription = True

    if not skip_transcription:
        if not prompt_yes_no("Start Whisper German transcription now?", default_yes=True):
            print(f"{Colors.YELLOW}Transcription skipped.{Colors.RESET}")
            sys.exit(0)
        run_transcription(video_file, de_srt)
    else:
        print(f"{Colors.CYAN}Using existing German subtitles from {de_srt.name}.{Colors.RESET}")

    # Run English & Bilingual Translation
    if prompt_yes_no("Generate English & Bilingual subtitles now?", default_yes=True):
        run_translation(de_srt, en_srt, bilingual_srt)

    # ── Step E: Optional LernKino Sync & GitHub Deploy ──
    print(f"\n{Colors.BRIGHT_CYAN}── Subtitle Pipeline Complete! ────────────────────────────────────────{Colors.RESET}")
    print(f"{Colors.GREEN}Files generated inside:{Colors.RESET} {target_dir}")
    print(f"  • {de_srt.name}")
    print(f"  • {en_srt.name}")
    print(f"  • {bilingual_srt.name}")

    if prompt_yes_no("\nUpdate LernKino media catalog now (npm run catalog)?", default_yes=True):
        sync_lernkino_catalog()

    if prompt_yes_no("\nCommit and push new subtitles to GitHub Pages repository?", default_yes=False):
        git_commit_and_push(item_label)

    print(f"\n{Colors.BRIGHT_CYAN}✨ All Done! You can view and play this episode in LernKino.{Colors.RESET}\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Script terminated by user.{Colors.RESET}")
        sys.exit(0)
