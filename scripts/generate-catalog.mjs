#!/usr/bin/env node
/**
 * scripts/generate-catalog.mjs
 *
 * 100% Folder-and-File Driven Media Scanner for LernKino.
 * Zero hardcoded seeds or sample mock creation.
 *
 * Reads:
 *   - public/media/series/<Series Folder Name>/
 *       - Cover: cover.*, poster.*, or any image in folder
 *       - Seasons: seasons/<seasonNumber>/ (or fallback s<seasonNumber>/)
 *       - Episodes: <episodeNumber>/ (or <num> - <Title>/, or flat files)
 *           - url.txt (external video URL) OR local .mp4/.webm
 *           - *.srt (German)
 *           - *.en.srt (English)
 *           - optional thumbnail image
 *   - public/media/movies/<Movie Folder Name>/
 *       - Cover: cover.*, poster.*, or any image in folder
 *       - url.txt (external video URL) OR local .mp4/.webm
 *       - *.srt (German)
 *       - *.en.srt (English)
 *
 * Emits warnings for missing subtitles, missing video, or files > 95 MB.
 * Writes compiled catalog to src/data/catalog.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const MEDIA_DIR = path.join(PROJECT_ROOT, 'public', 'media');
const SERIES_DIR = path.join(MEDIA_DIR, 'series');
const MOVIES_DIR = path.join(MEDIA_DIR, 'movies');
const CATALOG_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'catalog.json');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_GITHUB_FILE_SIZE_MB = 95;

/**
 * Generates clean, URL-safe slug from folder name.
 * e.g. "Friends (German Dub)" -> "friends-german-dub"
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Builds a clean forward-slash web path for assets.
 */
function toWebPath(...parts) {
  const joined = path.posix.join(...parts.map((p) => p.replace(/\\/g, '/')));
  return joined.startsWith('/') ? joined : `/${joined}`;
}

/**
 * Extracts season number from folder name.
 * Matches: 1, 01, s1, S01, season-1, Season 1, etc.
 */
function parseSeasonNumber(folderName) {
  const match = folderName.match(/^(?:season[\s._-]*|s)?(\d+)$/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extracts episode number and optional title from episode folder name.
 * Matches:
 *   "1" -> { num: 1, title: null }
 *   "01" -> { num: 1, title: null }
 *   "1 - The Pilot" -> { num: 1, title: "The Pilot" }
 *   "e2 - Sonogram" -> { num: 2, title: "Sonogram" }
 *   "episode 03" -> { num: 3, title: null }
 */
function parseEpisodeFolder(folderName) {
  const match = folderName.match(/^(?:(?:s\d+[\s._-]*)?e|episode)?[\s._-]*(\d+)(?:[\s._-]+(.*))?$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const extraTitle = match[2] ? match[2].trim() : null;
  return { num, title: extraTitle || null };
}

/**
 * Reads the first non-empty line of a url.txt file.
 */
function readUrlFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines[0] || null;
  } catch {
    return null;
  }
}

/**
 * Main catalog generator.
 */
function generateCatalog() {
  console.log('🎬 [LernKino] Scanning media directory (100% folder & file driven)...');
  console.log(`📁 Media root: ${MEDIA_DIR}`);

  // Ensure directories exist with .gitkeep if missing
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFileSync(path.join(MEDIA_DIR, '.gitkeep'), '', 'utf-8');
  }
  if (!fs.existsSync(SERIES_DIR)) {
    fs.mkdirSync(SERIES_DIR, { recursive: true });
    fs.writeFileSync(path.join(SERIES_DIR, '.gitkeep'), '', 'utf-8');
  }
  if (!fs.existsSync(MOVIES_DIR)) {
    fs.mkdirSync(MOVIES_DIR, { recursive: true });
    fs.writeFileSync(path.join(MOVIES_DIR, '.gitkeep'), '', 'utf-8');
  }

  const warnings = [];
  const seriesList = [];
  const moviesList = [];
  let totalEpisodesAcrossAll = 0;

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Scan Series: public/media/series/<Series Folder Name>/
  // ───────────────────────────────────────────────────────────────────────────
  if (fs.existsSync(SERIES_DIR)) {
    const seriesFolders = fs.readdirSync(SERIES_DIR, { withFileTypes: true });

    for (const sFolder of seriesFolders) {
      if (!sFolder.isDirectory()) continue;
      const folderName = sFolder.name;
      const seriesSlug = slugify(folderName);
      const seriesTitle = folderName;
      const seriesPath = path.join(SERIES_DIR, folderName);

      // Check for optional series.json or description.txt
      let description = '';
      let language = 'de';
      let genres = ['Series'];
      let featured = false;
      let videoBaseUrl = undefined;
      let customPoster = null;
      let customBackdrop = null;

      const seriesJsonPath = path.join(seriesPath, 'series.json');
      if (fs.existsSync(seriesJsonPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(seriesJsonPath, 'utf-8'));
          if (parsed.description) description = parsed.description;
          if (parsed.language) language = parsed.language;
          if (Array.isArray(parsed.genres)) genres = parsed.genres;
          if (typeof parsed.featured === 'boolean') featured = parsed.featured;
          if (parsed.videoBaseUrl) videoBaseUrl = parsed.videoBaseUrl;
          if (parsed.poster) customPoster = parsed.poster;
          if (parsed.backdrop) customBackdrop = parsed.backdrop;
        } catch (err) {
          warnings.push(`[${seriesTitle}] Failed to parse series.json: ${err.message}`);
        }
      }

      const descTxtPath = path.join(seriesPath, 'description.txt');
      if (!description && fs.existsSync(descTxtPath)) {
        try {
          description = fs.readFileSync(descTxtPath, 'utf-8').trim();
        } catch {
          // ignore
        }
      }

      // Root images in series folder
      const rootFiles = fs.readdirSync(seriesPath).filter((f) => {
        try {
          return fs.statSync(path.join(seriesPath, f)).isFile();
        } catch {
          return false;
        }
      });

      const coverFile =
        rootFiles.find((f) => /^(cover|poster)\.(jpe?g|png|webp)$/i.test(f)) ||
        rootFiles.find((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase())) ||
        null;

      const backdropFile =
        rootFiles.find((f) => /^(backdrop|banner|hero)\.(jpe?g|png|webp)$/i.test(f)) ||
        coverFile ||
        null;

      const posterSrc = customPoster || (coverFile ? toWebPath('media', 'series', folderName, coverFile) : null);
      const backdropSrc = customBackdrop || (backdropFile ? toWebPath('media', 'series', folderName, backdropFile) : posterSrc);

      // Discover Season directories:
      // Priority 1: seasons/ subfolder
      // Priority 2: direct s1, s2 folders in series root
      const seasonMap = new Map(); // seasonNumber -> seasonPath

      const seasonsSubdir = path.join(seriesPath, 'seasons');
      if (fs.existsSync(seasonsSubdir)) {
        const sEntries = fs.readdirSync(seasonsSubdir, { withFileTypes: true });
        for (const se of sEntries) {
          if (!se.isDirectory()) continue;
          const sNum = parseSeasonNumber(se.name);
          if (sNum !== null) {
            seasonMap.set(sNum, {
              seasonNumber: sNum,
              seasonPath: path.join(seasonsSubdir, se.name),
              webPathSegments: ['media', 'series', folderName, 'seasons', se.name],
            });
          }
        }
      }

      // Fallback: s1, s2 directly inside series folder
      const rootEntries = fs.readdirSync(seriesPath, { withFileTypes: true });
      for (const re of rootEntries) {
        if (!re.isDirectory() || re.name.toLowerCase() === 'seasons') continue;
        const sNum = parseSeasonNumber(re.name);
        if (sNum !== null && !seasonMap.has(sNum)) {
          seasonMap.set(sNum, {
            seasonNumber: sNum,
            seasonPath: path.join(seriesPath, re.name),
            webPathSegments: ['media', 'series', folderName, re.name],
          });
        }
      }

      const sortedSeasonsData = Array.from(seasonMap.values()).sort(
        (a, b) => a.seasonNumber - b.seasonNumber
      );

      const seasons = [];
      let seriesEpCount = 0;

      for (const seasonData of sortedSeasonsData) {
        const { seasonNumber, seasonPath, webPathSegments } = seasonData;
        const seasonTitle = `Season ${seasonNumber}`;
        const entriesInSeason = fs.readdirSync(seasonPath, { withFileTypes: true });

        const epSubdirs = entriesInSeason.filter((e) => e.isDirectory());
        const episodes = [];

        if (epSubdirs.length > 0) {
          // ── Subfolder per episode: e.g. 1/, 2/, 1 - The Pilot/ ──
          const epCandidates = [];
          for (const epDir of epSubdirs) {
            const parsedEp = parseEpisodeFolder(epDir.name);
            if (parsedEp) {
              epCandidates.push({
                folderName: epDir.name,
                episodeNumber: parsedEp.num,
                folderTitle: parsedEp.title,
                epPath: path.join(seasonPath, epDir.name),
                webSegments: [...webPathSegments, epDir.name],
              });
            }
          }

          epCandidates.sort((a, b) => a.episodeNumber - b.episodeNumber);

          for (const epItem of epCandidates) {
            const { episodeNumber, folderTitle, epPath, webSegments } = epItem;
            const epId = `s${String(seasonNumber).padStart(2, '0')}e${String(episodeNumber).padStart(2, '0')}`;
            const epFiles = fs.readdirSync(epPath).filter((f) => {
              try {
                return fs.statSync(path.join(epPath, f)).isFile();
              } catch {
                return false;
              }
            });

            // 1. Title & Meta
            let epTitle = folderTitle || `Episode ${episodeNumber}`;
            let epDesc = undefined;
            let durationSeconds = undefined;

            const metaFile = epFiles.find((f) => f.toLowerCase() === 'meta.json');
            if (metaFile) {
              try {
                const meta = JSON.parse(fs.readFileSync(path.join(epPath, metaFile), 'utf-8'));
                if (meta.title) epTitle = meta.title;
                if (meta.description) epDesc = meta.description;
                if (typeof meta.durationSeconds === 'number') durationSeconds = meta.durationSeconds;
                else if (typeof meta.duration === 'number') durationSeconds = meta.duration;
              } catch {
                // ignore
              }
            }

            // 2. Video Source
            // Priority: url.txt -> meta.json videoUrl -> local .mp4/.webm
            let videoSrc = null;
            let isExternalVideo = false;

            const urlFile = epFiles.find((f) => f.toLowerCase() === 'url.txt');
            if (urlFile) {
              const url = readUrlFile(path.join(epPath, urlFile));
              if (url) {
                videoSrc = url;
                isExternalVideo = true;
              }
            }

            if (!videoSrc) {
              const localVideo = epFiles.find((f) => VIDEO_EXTENSIONS.has(path.extname(f).toLowerCase()));
              if (localVideo) {
                const stat = fs.statSync(path.join(epPath, localVideo));
                const sizeMB = stat.size / (1024 * 1024);
                if (sizeMB > MAX_GITHUB_FILE_SIZE_MB) {
                  warnings.push(
                    `[${seriesTitle} ${epId}] Local video ${localVideo} is ${sizeMB.toFixed(1)} MB (>95 MB). Warning: GitHub enforces a hard 100 MB per-file push limit. Recommended: Use url.txt with an external video URL.`
                  );
                }
                videoSrc = toWebPath(...webSegments, localVideo);
                isExternalVideo = false;
              }
            }

            if (!videoSrc) {
              warnings.push(`[${seriesTitle} ${epId}] Missing video source (no url.txt and no local .mp4/.webm).`);
            }

            // 3. Captions
            // German: *.srt (excluding *.en.srt and *.bilingual.srt)
            const srtFiles = epFiles.filter((f) => f.toLowerCase().endsWith('.srt'));
            const deCandidates = srtFiles.filter((f) => {
              const lower = f.toLowerCase();
              return !lower.endsWith('.en.srt') && !lower.endsWith('.bilingual.srt');
            });
            const deFile = deCandidates.find((f) => f.toLowerCase() === 'de.srt') || deCandidates[0] || null;
            const deSubtitle = deFile ? toWebPath(...webSegments, deFile) : null;

            if (!deSubtitle) {
              warnings.push(`[${seriesTitle} ${epId}] Missing German subtitle (*.srt).`);
            }

            // English: *.en.srt or en.srt
            const enCandidates = srtFiles.filter((f) => {
              const lower = f.toLowerCase();
              return lower === 'en.srt' || (lower.endsWith('.en.srt') && !lower.endsWith('.bilingual.srt'));
            });
            const enFile = enCandidates.find((f) => f.toLowerCase() === 'en.srt') || enCandidates[0] || null;
            const enSubtitle = enFile ? toWebPath(...webSegments, enFile) : null;

            if (!enSubtitle) {
              warnings.push(`[${seriesTitle} ${epId}] Missing English subtitle (*.en.srt).`);
            }

            // 4. Thumbnail
            const thumbFile = epFiles.find((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase())) || null;
            const thumbnailSrc = thumbFile ? toWebPath(...webSegments, thumbFile) : null;

            episodes.push({
              id: epId,
              seriesSlug,
              seasonNumber,
              episodeNumber,
              title: epTitle,
              ...(epDesc ? { description: epDesc } : {}),
              videoSrc,
              isExternalVideo,
              thumbnailSrc,
              subtitles: {
                de: deSubtitle,
                en: enSubtitle,
              },
              ...(typeof durationSeconds === 'number' ? { durationSeconds } : {}),
            });

            seriesEpCount++;
            totalEpisodesAcrossAll++;
          }
        } else {
          // ── Flat files directly in season folder ──
          // Check for single url.txt or single video
          const seasonFiles = entriesInSeason.filter((e) => e.isFile()).map((e) => e.name);
          const urlFile = seasonFiles.find((f) => f.toLowerCase() === 'url.txt');
          const localVideo = seasonFiles.find((f) => VIDEO_EXTENSIONS.has(path.extname(f).toLowerCase()));

          if (urlFile || localVideo) {
            const epId = `s${String(seasonNumber).padStart(2, '0')}e01`;
            let videoSrc = null;
            let isExternalVideo = false;

            if (urlFile) {
              const url = readUrlFile(path.join(seasonPath, urlFile));
              if (url) {
                videoSrc = url;
                isExternalVideo = true;
              }
            } else if (localVideo) {
              videoSrc = toWebPath(...webPathSegments, localVideo);
              isExternalVideo = false;
            }

            const srtFiles = seasonFiles.filter((f) => f.toLowerCase().endsWith('.srt'));
            const deFile = srtFiles.find((f) => !f.toLowerCase().endsWith('.en.srt') && !f.toLowerCase().endsWith('.bilingual.srt')) || null;
            const enFile = srtFiles.find((f) => f.toLowerCase().endsWith('.en.srt') || f.toLowerCase() === 'en.srt') || null;

            episodes.push({
              id: epId,
              seriesSlug,
              seasonNumber,
              episodeNumber: 1,
              title: `${seasonTitle} Episode 1`,
              videoSrc,
              isExternalVideo,
              thumbnailSrc: null,
              subtitles: {
                de: deFile ? toWebPath(...webPathSegments, deFile) : null,
                en: enFile ? toWebPath(...webPathSegments, enFile) : null,
              },
            });

            seriesEpCount++;
            totalEpisodesAcrossAll++;
          }
        }

        if (episodes.length > 0) {
          seasons.push({
            seasonNumber,
            title: seasonTitle,
            episodes,
          });
        }
      }

      seriesList.push({
        slug: seriesSlug,
        title: seriesTitle,
        description,
        language,
        genres,
        featured,
        posterSrc,
        backdropSrc,
        videoBaseUrl,
        totalSeasons: seasons.length,
        totalEpisodes: seriesEpCount,
        seasons,
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Scan Movies: public/media/movies/<Movie Folder Name>/
  // ───────────────────────────────────────────────────────────────────────────
  if (fs.existsSync(MOVIES_DIR)) {
    const movieFolders = fs.readdirSync(MOVIES_DIR, { withFileTypes: true });

    for (const mFolder of movieFolders) {
      if (!mFolder.isDirectory()) continue;
      const folderName = mFolder.name;
      const movieSlug = slugify(folderName);
      const movieTitle = folderName;
      const moviePath = path.join(MOVIES_DIR, folderName);

      const movieFiles = fs.readdirSync(moviePath).filter((f) => {
        try {
          return fs.statSync(path.join(moviePath, f)).isFile();
        } catch {
          return false;
        }
      });

      // Cover image
      const coverFile =
        movieFiles.find((f) => /^(cover|poster)\.(jpe?g|png|webp)$/i.test(f)) ||
        movieFiles.find((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase())) ||
        null;

      const backdropFile =
        movieFiles.find((f) => /^(backdrop|banner|hero)\.(jpe?g|png|webp)$/i.test(f)) ||
        coverFile ||
        null;

      const posterSrc = coverFile ? toWebPath('media', 'movies', folderName, coverFile) : null;
      const backdropSrc = backdropFile ? toWebPath('media', 'movies', folderName, backdropFile) : posterSrc;

      // Video: url.txt (preferred) or local .mp4/.webm
      let videoSrc = null;
      let isExternalVideo = false;

      const urlFile = movieFiles.find((f) => f.toLowerCase() === 'url.txt');
      if (urlFile) {
        const url = readUrlFile(path.join(moviePath, urlFile));
        if (url) {
          videoSrc = url;
          isExternalVideo = true;
        }
      }

      if (!videoSrc) {
        const localVideo = movieFiles.find((f) => VIDEO_EXTENSIONS.has(path.extname(f).toLowerCase()));
        if (localVideo) {
          const stat = fs.statSync(path.join(moviePath, localVideo));
          const sizeMB = stat.size / (1024 * 1024);
          if (sizeMB > MAX_GITHUB_FILE_SIZE_MB) {
            warnings.push(
              `[Movie: ${movieTitle}] Local video ${localVideo} is ${sizeMB.toFixed(1)} MB (>95 MB). Warning: GitHub enforces a hard 100 MB per-file push limit. Recommended: Use url.txt.`
            );
          }
          videoSrc = toWebPath('media', 'movies', folderName, localVideo);
          isExternalVideo = false;
        }
      }

      if (!videoSrc) {
        warnings.push(`[Movie: ${movieTitle}] Missing video source (no url.txt and no local .mp4/.webm).`);
      }

      // Subtitles
      const srtFiles = movieFiles.filter((f) => f.toLowerCase().endsWith('.srt'));
      const deCandidates = srtFiles.filter((f) => {
        const lower = f.toLowerCase();
        return !lower.endsWith('.en.srt') && !lower.endsWith('.bilingual.srt');
      });
      const deFile = deCandidates.find((f) => f.toLowerCase() === 'de.srt') || deCandidates[0] || null;
      const deSubtitle = deFile ? toWebPath('media', 'movies', folderName, deFile) : null;

      if (!deSubtitle) {
        warnings.push(`[Movie: ${movieTitle}] Missing German subtitle (*.srt).`);
      }

      const enCandidates = srtFiles.filter((f) => {
        const lower = f.toLowerCase();
        return lower === 'en.srt' || (lower.endsWith('.en.srt') && !lower.endsWith('.bilingual.srt'));
      });
      const enFile = enCandidates.find((f) => f.toLowerCase() === 'en.srt') || enCandidates[0] || null;
      const enSubtitle = enFile ? toWebPath('media', 'movies', folderName, enFile) : null;

      if (!enSubtitle) {
        warnings.push(`[Movie: ${movieTitle}] Missing English subtitle (*.en.srt).`);
      }

      // Metadata from meta.json or description.txt
      let description = '';
      let language = 'de';
      let genres = ['Movie'];
      let featured = false;
      let durationSeconds = undefined;
      let releaseYear = undefined;

      const metaFile = movieFiles.find((f) => f.toLowerCase() === 'meta.json');
      if (metaFile) {
        try {
          const parsed = JSON.parse(fs.readFileSync(path.join(moviePath, metaFile), 'utf-8'));
          if (parsed.description) description = parsed.description;
          if (parsed.language) language = parsed.language;
          if (Array.isArray(parsed.genres)) genres = parsed.genres;
          if (typeof parsed.featured === 'boolean') featured = parsed.featured;
          if (typeof parsed.durationSeconds === 'number') durationSeconds = parsed.durationSeconds;
          if (typeof parsed.releaseYear === 'number') releaseYear = parsed.releaseYear;
        } catch {
          // ignore
        }
      }

      const descTxt = movieFiles.find((f) => f.toLowerCase() === 'description.txt');
      if (!description && descTxt) {
        try {
          description = fs.readFileSync(path.join(moviePath, descTxt), 'utf-8').trim();
        } catch {
          // ignore
        }
      }

      moviesList.push({
        slug: movieSlug,
        title: movieTitle,
        description,
        language,
        genres,
        featured,
        posterSrc,
        backdropSrc,
        videoSrc,
        isExternalVideo,
        subtitles: {
          de: deSubtitle,
          en: enSubtitle,
        },
        durationSeconds,
        releaseYear,
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Print Warnings & Write Manifest
  // ───────────────────────────────────────────────────────────────────────────
  if (warnings.length > 0) {
    console.warn(`\n⚠️  Asset Validation Warnings (${warnings.length}):`);
    for (const w of warnings) {
      console.warn(`   • ${w}`);
    }
  } else {
    console.log('✨ All assets validated with zero warnings.');
  }

  const firstSeries = seriesList[0] || null;

  const catalog = {
    generatedAt: new Date().toISOString(),
    totalSeries: seriesList.length,
    totalMovies: moviesList.length,
    totalEpisodes: totalEpisodesAcrossAll,
    series: seriesList,
    movies: moviesList,

    // Backward-compat fields
    totalSeasons: firstSeries ? firstSeries.totalSeasons : 0,
    seasons: firstSeries ? firstSeries.seasons : [],
  };

  fs.mkdirSync(path.dirname(CATALOG_PATH), { recursive: true });
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf-8');

  console.log(`\n✅ Media catalog generated successfully!`);
  console.log(`   Output: ${CATALOG_PATH}`);
  console.log(`   Indexed: ${seriesList.length} Series (${totalEpisodesAcrossAll} episodes), ${moviesList.length} Movies\n`);
}

generateCatalog();
