/**
 * LernKino Serverless German-English Dictionary Service
 *
 * Fast, 100% client-side dictionary lookup with localStorage caching (lernkino_dict_cache).
 * Fetches definitions and translations from public APIs (MyMemory + Wiktionary)
 * with robust offline/error fallbacks and Web Speech API pronunciation.
 */

export interface DictionaryEntry {
  word: string;
  cleanWord: string;
  translation: string;
  definitions: string[];
  partOfSpeech?: string;
  examples?: string[];
  source: 'cache' | 'mymemory' | 'wiktionary' | 'fallback';
  timestamp: number;
}

const DICT_CACHE_KEY = 'lernkino_dict_cache';
const MAX_CACHE_ENTRIES = 500;

/**
 * Cleans punctuation, quotes, and symbols from a word token
 * while preserving German umlauts (ä, ö, ü, ß) and internal hyphens/apostrophes.
 */
export function cleanWord(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '')
    .trim();
}

/**
 * Reads the dictionary cache from localStorage.
 */
function getDictCache(): Record<string, DictionaryEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DICT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
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

    localStorage.setItem(DICT_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn('[LernKino] Failed to save dictionary cache:', err);
  }
}

/**
 * Looks up a German word in the local cache or fetches from free public APIs.
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

  // 1. Check local cache first
  const cache = getDictCache();
  if (cache[cacheKey]) {
    return { ...cache[cacheKey], source: 'cache' };
  }

  let translation = '';
  let partOfSpeech: string | undefined = undefined;
  const definitions: string[] = [];
  const examples: string[] = [];

  // 2. Fetch from MyMemory Translation API
  try {
    const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleaned)}&langpair=de|en`;
    const res = await fetch(myMemoryUrl);
    if (res.ok) {
      const data = await res.json();
      if (data?.responseData?.translatedText) {
        const primary = data.responseData.translatedText.trim();
        // Ignore echo matches if identical to input
        if (primary.toLowerCase() !== cleaned.toLowerCase()) {
          translation = primary;
        }
      }

      // Collect alternative candidate matches
      if (Array.isArray(data?.matches)) {
        for (const match of data.matches) {
          const trans = match.translation?.trim();
          if (trans && trans.toLowerCase() !== cleaned.toLowerCase() && !definitions.includes(trans)) {
            definitions.push(trans);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[LernKino] MyMemory lookup failed:', err);
  }

  // 3. Fetch grammatical info & definitions from Wiktionary
  try {
    const wiktionaryUrl = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(cleaned.toLowerCase())}`;
    const res = await fetch(wiktionaryUrl);
    if (res.ok) {
      const data = await res.json();
      // Look for German definitions ('de')
      const germanSection = data?.de;
      if (Array.isArray(germanSection) && germanSection.length > 0) {
        const firstCategory = germanSection[0];
        if (firstCategory.partOfSpeech) {
          partOfSpeech = firstCategory.partOfSpeech;
        }

        if (Array.isArray(firstCategory.definitions)) {
          for (const defObj of firstCategory.definitions) {
            // Strip HTML from definition
            const cleanDef = defObj.definition?.replace(/<[^>]+>/g, '').trim();
            if (cleanDef && !definitions.includes(cleanDef)) {
              definitions.push(cleanDef);
            }
            if (Array.isArray(defObj.examples)) {
              for (const ex of defObj.examples) {
                const cleanEx = typeof ex === 'string' ? ex.replace(/<[^>]+>/g, '').trim() : ex?.text?.replace(/<[^>]+>/g, '').trim();
                if (cleanEx && !examples.includes(cleanEx)) {
                  examples.push(cleanEx);
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[LernKino] Wiktionary lookup failed:', err);
  }

  // If no translation yet but we have definitions, use the first definition
  if (!translation && definitions.length > 0) {
    translation = definitions[0];
  }

  const result: DictionaryEntry = {
    word: rawToken,
    cleanWord: cleaned,
    translation: translation || cleaned,
    definitions: definitions.slice(0, 8),
    partOfSpeech,
    examples: examples.slice(0, 4),
    source: translation ? 'mymemory' : 'fallback',
    timestamp: Date.now(),
  };

  // Cache valid lookup results
  if (result.translation) {
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
