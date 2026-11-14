# LernKino (`lern-kino`)

<p align="center">
  <img src="public/icon.svg" width="80" height="80" alt="LernKino Logo" />
</p>

<h3 align="center">Learn German Through Cinema & Television</h3>

<p align="center">
  A 100% serverless, static Next.js 15 video streaming and language-learning web platform designed for free hosting on <strong>GitHub Pages</strong>.
</p>

<p align="center">
  <a href="#-key-features">Key Features</a> •
  <a href="#-folder-structure--media-conventions">Media Structure</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-github-pages-deployment">GitHub Pages Setup</a> •
  <a href="#-architecture">Architecture</a>
</p>

---

## ✨ Key Features

- 🇩🇪 **Simultaneous Dual Subtitles:** Synchronized German dubtitles + English subtitles with customizable font sizes (`sm`, `md`, `lg`, `xl`), English color accents (Yellow, Cyan, White), and timing micro-sync offsets (`±0.1s`, `±0.5s`).
- 📖 **Interactive Word Dictionary:** Click any German or English word directly in active subtitles to pause and look up meanings, grammatical context, and hear authentic German pronunciation via the Web Speech API (`de-DE`).
- 🧠 **5-Box Leitner Spaced Repetition:** Save vocabulary cards directly from video subtitles into a 5-box Leitner deck with due-date scheduling, mastery tracking, and audio repetition.
- ⏯️ **Continuous Resume & Progress Engine:** Automatic persistence of playback time and completed status via `localStorage` and fallback cookie snapshot.
- ⏭️ **Seamless Next-Episode Flow:** Cross-season episode traversal (e.g. S1 Finale $\rightarrow$ S2 E1) with an in-player control button and a 6-second countdown auto-play card upon episode completion.
- 🔍 **Global Spotlight Search (`Ctrl+K` / `⌘K`):** Instant search overlay across Series, Seasons, Episode titles/codes (`S1 E2`), and German Cinema movies.
- 🎨 **Cyan & Grey Glassmorphism:** Cohesive frosted glass UI styled in Cyan (`#00FFFF`) and slate grey with full Dark Mode and Light Mode support.
- 📂 **Client-Side Video & Subtitle Fallbacks:** Drag-and-drop local `.mp4`/`.webm` or `.srt` files straight into the browser for zero-upload instant playback if streaming links are offline.

---

## 📁 Folder Structure & Media Conventions

LernKino scans media at build time using `scripts/generate-catalog.mjs` and generates a static catalog manifest (`src/data/catalog.json`).

Organize your library in `public/media/`:

```text
public/media/
├── series/
│   └── friends-german-dub/
│       ├── series.json                 # Title, description, genres, language, poster
│       ├── cover.jpg                   # Series poster/backdrop image
│       └── seasons/ (or s1, s2...)
│           └── 1/
│               ├── 1/
│               │   ├── url.txt         # External video stream URL (or meta.json)
│               │   ├── de.srt          # German subtitles (or *.srt)
│               │   ├── en.srt          # English subtitles (or *.en.srt)
│               │   ├── cover.jpg       # Optional episode thumbnail
│               │   └── meta.json       # Optional title & external video URL
│               └── 2/
│                   ├── url.txt
│                   ├── de.srt
│                   └── en.srt
└── movies/
    └── run-lola-run/
        ├── meta.json                   # Movie title, director, external video URL
        ├── cover.jpg
        ├── de.srt
        └── en.srt
```

### Video Source Resolution Hierarchy

LernKino resolves episode videos in this order:
1. `meta.json` $\rightarrow$ `"videoUrl": "https://..."`
2. `url.txt` $\rightarrow$ Plain text HTTPS stream link
3. `series.json` $\rightarrow$ `"videoBaseUrl"` + episode filename
4. Bundled local video $\rightarrow$ `episode.mp4` / `episode.webm`
5. In-browser local file picker $\rightarrow$ Drag & drop or pick any `.mp4`/`.webm` from your hard drive with zero server upload.

> [!TIP]
> **GitHub 100 MB Limit:** GitHub rejects pushes containing files larger than 100 MB. To keep your repository lightweight and fast to deploy, host heavy video files on external cloud storage (e.g. Cloudflare R2, Google Cloud Storage, BunnyCDN, Internet Archive) and reference them via `url.txt` or `meta.json`. Video files are excluded in `.gitignore` by default.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate Media Catalog
```bash
npm run catalog
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view LernKino locally.

### 4. Build Static Production Export
```bash
npm run build
```
Generates a 100% static HTML/JS export in `./out/`, complete with `out/.nojekyll` and `out/404.html`.

---

## 🌐 GitHub Pages Deployment

LernKino uses an automated GitHub Actions workflow (`.github/workflows/deploy.yml`) to build and deploy the static site on every push to `main`.

### One-Time Setup:
1. Push this repository to GitHub.
2. Go to your repository on GitHub: **Settings $\rightarrow$ Pages**.
3. Under **Build and deployment $\rightarrow$ Source**, select **GitHub Actions**.
4. Push a commit to `main` (or trigger manually under **Actions $\rightarrow$ Deploy LernKino to GitHub Pages $\rightarrow$ Run workflow**).
5. Your streaming platform will be live at `https://<username>.github.io/<repo-name>/`!

---

## 🧭 Repository Architecture

```text
subsync/ (lern-kino)
├── .github/workflows/deploy.yml   # Official GitHub Actions Pages pipeline
├── public/
│   ├── .nojekyll                  # Prevents GitHub Pages from ignoring _next/
│   ├── icon.svg                   # Brand favicon
│   └── media/                     # Folder-driven media library
├── scripts/
│   └── generate-catalog.mjs       # Build-time catalog scanner & validator
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout, theme provider, navbar & footer
│   │   ├── not-found.tsx          # Branded glassmorphic 404 error page
│   │   ├── page.tsx               # Homepage with hero, continue watching, series & movies
│   │   ├── series/                # Series overview & episode index pages
│   │   ├── movies/                # German cinema page
│   │   ├── vocab/                 # Leitner Box spaced repetition deck & study session
│   │   ├── watch/                 # Video player view with dual captions & word inspector
│   │   └── status/                # Hidden diagnostics screen
│   ├── components/
│   │   ├── Logo.tsx               # Translucent cyan glass prism SVG mark
│   │   ├── Navbar.tsx             # Responsive header with search shortcut & Leitner badge
│   │   ├── Footer.tsx             # Glassmorphic footer with architecture links
│   │   ├── SearchModal.tsx        # Spotlight search overlay (Ctrl+K)
│   │   ├── VideoPlayer.tsx        # Glassmorphic HTML5 player & up-next flow
│   │   ├── DualSubtitleOverlay.tsx# Dual DE+EN subtitle rendering & word click engine
│   │   └── WordDictionaryModal.tsx# In-player word dictionary & card creator
│   ├── lib/
│   │   ├── catalog.ts             # Strongly-typed catalog queries
│   │   ├── paths.ts               # BasePath resolution helper for GitHub Pages
│   │   ├── watchHistory.ts        # Watch progress persistence engine
│   │   ├── srtParser.ts           # Robust client-side SRT parser with German umlaut support
│   │   ├── subtitlePrefs.ts       # Subtitle appearance and timing preferences
│   │   ├── dictionary.ts          # Serverless German-English lookup & Web Speech API
│   │   └── leitner.ts             # 5-box spaced repetition algorithm
│   └── types/
│       ├── media.ts               # Media, series, episode, and movie types
│       ├── learning.ts            # WatchProgress, LeitnerBoxLevel, SavedVocabCard
│       └── subtitles.ts           # SubtitleCue, SubtitlePreferences
├── next.config.mjs                # Static export configuration & dynamic basePath
└── package.json                   # Dependencies, scripts, and prebuild catalog hook
```

---

## 📜 License
MIT License. Crafted for German language acquisition.
