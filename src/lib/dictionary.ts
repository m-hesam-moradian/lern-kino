/**
 * LernKino Serverless German-English Dictionary Service
 *
 * Fast, 100% client-side dictionary lookup with localStorage caching (lernkino_dict_cache_v2).
 * Multi-tier high-accuracy dictionary architecture:
 *   1. Google Translate Dictionary (gtx API with dt=t, dt=bd for detailed POS and candidate synonyms)
 *   2. English Wiktionary REST API (rich grammatical definitions and German-English example sentences)
 *   3. Strict validation & sanitization (rejects stray punctuation, dots, or unhelpful fragments)
 *   4. Web Speech API authentic German pronunciation (de-DE)
 */

export interface ExamplePair {
  german: string;
  english: string;
}

export interface MeaningGroup {
  partOfSpeech: string;
  meanings: string[];
}

export interface DictionaryEntry {
  word: string;
  cleanWord: string;
  translation: string;
  definitions: string[];
  meaningGroups?: MeaningGroup[];
  partOfSpeech?: string;
  synonyms?: string[];
  examples?: string[];
  examplePairs?: ExamplePair[];
  source: 'cache' | 'google' | 'wiktionary' | 'mymemory' | 'fallback';
  timestamp: number;
}

const DICT_CACHE_KEY_V2 = 'lernkino_dict_cache_v2';
const OLD_CACHE_KEY = 'lernkino_dict_cache';
const MAX_CACHE_ENTRIES = 500;

/**
 * Cleans punctuation, quotes, and symbols from a word token
 * while preserving German umlauts (ä, ö, ü, ß) and internal hyphens/apostrophes.
 * Also strips any residual HTML tags.
 */
export function cleanWord(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, '')
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '')
    .trim();
}

/**
 * Strips HTML tags and normalizes whitespace.
 */
export function cleanHtml(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates that a translation is genuine text and not a stray punctuation mark,
 * single symbol (like '.'), or empty string.
 */
export function isValidTranslation(trans: string | undefined | null, originalWord: string): boolean {
  if (!trans) return false;
  const trimmed = trans.trim();
  if (trimmed.length === 0) return false;
  // Must contain at least one English letter (rejects '.', '-', '123', pure symbols)
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  // Discard if pure punctuation
  if (/^[.\-_,;:\/\\!?'"()[\]{}@#$%^&*+=<>~`|]+$/.test(trimmed)) return false;
  return true;
}

/**
 * Reads the dictionary cache from localStorage.
 * Automatically clears deprecated/poisoned v1 cache entries.
 */
function getDictCache(): Record<string, DictionaryEntry> {
  if (typeof window === 'undefined') return {};
  try {
    if (localStorage.getItem(OLD_CACHE_KEY)) {
      try {
        localStorage.removeItem(OLD_CACHE_KEY);
      } catch {}
    }
    const raw = localStorage.getItem(DICT_CACHE_KEY_V2);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Saves an entry to localStorage dictionary cache.
 */
function saveDictCache(entry: DictionaryEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = getDictCache();
    const key = entry.cleanWord.toLowerCase();
    cache[key] = entry;

    // Prune oldest entries if cache exceeds limit
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
      const oldestKey = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp)[0];
      delete cache[oldestKey];
    }

    localStorage.setItem(DICT_CACHE_KEY_V2, JSON.stringify(cache));
  } catch (err) {
    console.warn('[LernKino] Failed to save dictionary cache:', err);
  }
}

/**
 * Looks up a German word with high accuracy using Google Translate's Dictionary API
 * (with full part-of-speech & synonym breakdown), enriched by Wiktionary with
 * bilingual example sentences.
 */
export async function lookupGermanWord(rawToken: string): Promise<DictionaryEntry> {
  const cleaned = cleanWord(rawToken);
  if (!cleaned) {
    return {
      word: rawToken,
      cleanWord: '',
      translation: '',
      definitions: [],
      source: 'fallback',
      timestamp: Date.now(),
    };
  }

  const cacheKey = cleaned.toLowerCase();

  // 1. Check local cache first (validating that the cached item is not broken or single-dot)
  const cache = getDictCache();
  if (cache[cacheKey] && isValidTranslation(cache[cacheKey].translation, cleaned)) {
    return { ...cache[cacheKey], source: 'cache' };
  } else if (cache[cacheKey]) {
    delete cache[cacheKey];
    try {
      localStorage.setItem(DICT_CACHE_KEY_V2, JSON.stringify(cache));
    } catch {}
  }

  let translation = '';
  let partOfSpeech: string | undefined = undefined;
  const meaningGroups: MeaningGroup[] = [];
  const synonyms: string[] = [];
  const definitions: string[] = [];
  const examples: string[] = [];
  const examplePairs: ExamplePair[] = [];
  let source: DictionaryEntry['source'] = 'fallback';

  // 2. Fetch from Google Translate Dictionary API (High Accuracy + Fast + CORS enabled)
  try {
    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=en&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(cleaned)}`;
    const res = await fetch(gtxUrl);
    if (res.ok) {
      const data = await res.json();

      // Extract primary translation from data[0]
      if (Array.isArray(data?.[0])) {
        const segments = data[0]
          .filter((seg: any) => Array.isArray(seg) && typeof seg[0] === 'string')
          .map((seg: any) => seg[0].trim());
        const fullTrans = segments.join(' ').trim();
        if (isValidTranslation(fullTrans, cleaned)) {
          translation = fullTrans;
          source = 'google';
        }
      }

      // Extract structured dictionary by Part of Speech from data[1]
      if (Array.isArray(data?.[1])) {
        for (const group of data[1]) {
          if (Array.isArray(group) && typeof group[0] === 'string') {
            const pos = group[0].trim();
            if (!partOfSpeech) {
              partOfSpeech = pos.charAt(0).toUpperCase() + pos.slice(1);
            }

            const groupMeanings: string[] = [];
            if (Array.isArray(group[1])) {
              for (const m of group[1]) {
                if (typeof m === 'string' && m.trim()) {
                  const cleanM = m.trim();
                  if (isValidTranslation(cleanM, cleaned) && !groupMeanings.includes(cleanM)) {
                    groupMeanings.push(cleanM);
                    if (!synonyms.includes(cleanM)) {
                      synonyms.push(cleanM);
                    }
                  }
                }
              }
            }

            if (groupMeanings.length > 0) {
              meaningGroups.push({ partOfSpeech: pos, meanings: groupMeanings });
              definitions.push(`${pos}: ${groupMeanings.slice(0, 5).join(', ')}`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[LernKino] Google Translate lookup failed:', err);
  }

  // 3. Enrich with Wiktionary (Detailed linguistic definitions & authentic DE-EN example sentences)
  try {
    const wiktionaryUrl = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(cleaned.toLowerCase())}`;
    const res = await fetch(wiktionaryUrl, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const germanSection = data?.de;
      if (Array.isArray(germanSection) && germanSection.length > 0) {
        for (const cat of germanSection) {
          if (!partOfSpeech && cat.partOfSpeech) {
            partOfSpeech = cat.partOfSpeech;
          }

          if (Array.isArray(cat.definitions)) {
            for (const defObj of cat.definitions) {
              const cleanDef = cleanHtml(defObj.definition);
              if (cleanDef && cleanDef.length > 3 && !definitions.includes(cleanDef)) {
                definitions.push(cleanDef);
              }

              // Extract parsed bilingual example sentences
              if (Array.isArray(defObj.parsedExamples)) {
                for (const pe of defObj.parsedExamples) {
                  const exDe = cleanHtml(pe?.example);
                  const exEn = cleanHtml(pe?.translation);
                  if (exDe && exEn && !examplePairs.some((p) => p.german === exDe)) {
                    examplePairs.push({ german: exDe, english: exEn });
                    examples.push(exDe);
                  }
                }
              } else if (Array.isArray(defObj.examples)) {
                for (const ex of defObj.examples) {
                  const cleanEx = typeof ex === 'string' ? cleanHtml(ex) : cleanHtml(ex?.text);
                  if (cleanEx && !examples.includes(cleanEx)) {
                    examples.push(cleanEx);
                  }
                }
              }
            }
          }
        }
        if (!translation && definitions.length > 0) {
          // If Google wasn't available, extract first clean definition
          const firstDef = definitions[0];
          // Strip leading explanatory phrases like "to be able to -> be able to"
          translation = firstDef.replace(/^to\s+/i, '').split(/[,;.]/)[0].trim() || firstDef;
          source = 'wiktionary';
        }
      }
    }
  } catch (err) {
    console.warn('[LernKino] Wiktionary lookup failed:', err);
  }

  // 4. Fallback: MyMemory API (with strict validation against '.' or garbage)
  if (!isValidTranslation(translation, cleaned)) {
    try {
      const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleaned)}&langpair=de|en`;
      const res = await fetch(myMemoryUrl);
      if (res.ok) {
        const data = await res.json();
        const cand = data?.responseData?.translatedText?.trim();
        if (isValidTranslation(cand, cleaned)) {
          translation = cand;
          source = 'mymemory';
        } else if (Array.isArray(data?.matches)) {
          for (const match of data.matches) {
            const trans = match.translation?.trim();
            if (isValidTranslation(trans, cleaned)) {
              translation = trans;
              source = 'mymemory';
              break;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[LernKino] MyMemory fallback failed:', err);
    }
  }

  // Ensure primary translation is at the start of synonyms if not present
  if (translation && !synonyms.includes(translation)) {
    synonyms.unshift(translation);
  }

  const result: DictionaryEntry = {
    word: rawToken,
    cleanWord: cleaned,
    translation: isValidTranslation(translation, cleaned) ? translation : cleaned,
    definitions: definitions.slice(0, 8),
    meaningGroups: meaningGroups.length > 0 ? meaningGroups : undefined,
    partOfSpeech,
    synonyms: synonyms.slice(0, 10),
    examples: examples.slice(0, 5),
    examplePairs: examplePairs.slice(0, 5),
    source,
    timestamp: Date.now(),
  };

  // Cache valid lookup results
  if (isValidTranslation(result.translation, cleaned)) {
    saveDictCache(result);
  }

  return result;
}

/**
 * Pronounces a German word or phrase using the browser's Web Speech API.
 */
export function speakGermanWord(text: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.88; // Slightly measured rate for language learners
    utterance.pitch = 1.0;

    // Select German voice if available
    const voices = window.speechSynthesis.getVoices();
    const germanVoice = voices.find((v) => v.lang.startsWith('de') || v.lang === 'de-DE');
    if (germanVoice) {
      utterance.voice = germanVoice;
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn('[LernKino] Speech synthesis error:', err);
    return false;
  }
}
