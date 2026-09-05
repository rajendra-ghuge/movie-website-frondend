import axios from 'axios';
import { movieApi, DEFAULT_CONFIG } from '../api.js';

export const COUNTRIES = [
  { code: 'in', name: 'India', flag: '🇮🇳' },
  { code: 'us', name: 'United States', flag: '🇺🇸' },
  { code: 'uk', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'ca', name: 'Canada', flag: '🇨🇦' },
  { code: 'au', name: 'Australia', flag: '🇦🇺' },
  { code: 'de', name: 'Germany', flag: '🇩🇪' },
  { code: 'fr', name: 'France', flag: '🇫🇷' },
  { code: 'pk', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'bd', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'ae', name: 'UAE', flag: '🇦🇪' },
];

export const CATEGORIES = [
  'All',
  'News',
  'Entertainment',
  'Movies',
  'Music',
  'Sports',
  'Kids',
  'Religious',
  'Documentary',
  'Education',
  'General',
];

/**
 * Parses IPTV-org M3U playlist format into an array of channel objects.
 */
export function parseM3U(m3uContent) {
  if (!m3uContent || typeof m3uContent !== 'string') return [];

  const lines = m3uContent.split('\n');
  const channels = [];

  let currentChannel = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      // Extract tvg-id
      const idMatch = line.match(/tvg-id="([^"]*)"/);
      const tvgId = idMatch ? idMatch[1] : '';

      // Extract tvg-logo
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const logo = logoMatch ? logoMatch[1] : '';

      // Extract group-title (category)
      const groupMatch = line.match(/group-title="([^"]*)"/);
      let rawCategory = groupMatch ? groupMatch[1] : 'General';
      // If categories are separated by semicolon, take the primary one
      const categories = rawCategory.split(';').map((c) => c.trim()).filter(Boolean);
      const primaryCategory = categories[0] || 'General';

      // Extract channel name and quality from comma onwards
      const commaIndex = line.lastIndexOf(',');
      let rawName = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : 'Unknown Channel';

      // Extract resolution/quality if present e.g. "(1080p)", "(720p)"
      const qualityMatch = rawName.match(/\((\d{3,4}[pi])\)/i);
      const quality = qualityMatch ? qualityMatch[1] : '';

      // Clean channel name: remove resolution, bracket notes, trailing parenthesis, normalize spaces
      const cleanName = rawName
        .replace(/\(\s*\d{3,4}[pi]\s*\)/gi, '')
        .replace(/\[[^\]]*\]/gi, '')
        .replace(/\s*\)\s*$/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const isGeoBlocked = /Geo-blocked/i.test(rawName);
      const isNot247 = /Not 24\/7/i.test(rawName);

      currentChannel = {
        id: tvgId || `chan_${i}_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name: cleanName || rawName,
        rawName,
        quality,
        logo,
        category: primaryCategory,
        categories,
        isGeoBlocked,
        isNot247,
        streamUrl: ''
      };
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      if (currentChannel) {
        currentChannel.streamUrl = line;
        channels.push(currentChannel);
        currentChannel = null;
      }
    }
  }

  return channels;
}

/**
 * Prioritizes maker-selected favorite channels at the very top (with gold star),
 * followed by popular flagship networks (Star and Zee first)
 * and ranks high-definition (HD) 24/7 feeds highest.
 */
export function prioritizeChannels(channels, countryCode = 'in', favoriteNames = []) {
  if (!Array.isArray(channels)) return [];

  const favCleanList = (favoriteNames || []).map((f) => f.toLowerCase().trim()).filter(Boolean);

  // Tag maker's favorite channels
  channels.forEach((c) => {
    const cName = c.name.toLowerCase().trim();
    const favIdx = favCleanList.findIndex((fav) => {
      if (cName === fav) return true;
      if (cName.startsWith(fav)) return true;
      if (fav.length > 4 && cName.includes(fav)) return true;
      return false;
    });
    c.isFavorite = favIdx !== -1;
    c.favoriteRank = favIdx !== -1 ? favIdx : 9999;
  });

  if (countryCode.toLowerCase() !== 'in') {
    return [...channels].sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      if (a.isFavorite && b.isFavorite) return a.favoriteRank - b.favoriteRank;
      return a.name.localeCompare(b.name);
    });
  }

  return [...channels].sort((a, b) => {
    // 0. Maker favorites ALWAYS show at the very top, in order of defined favorites
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    if (a.isFavorite && b.isFavorite) {
      if (a.favoriteRank !== b.favoriteRank) {
        return a.favoriteRank - b.favoriteRank;
      }
    }

    const getScore = (c) => {
      const name = c.name.toLowerCase();
      let score = 0;

      // 1. Star Network (Star Gold, Star Bharat, Star Plus, Star Movies, Star Sports, etc.)
      if (/^star\b/i.test(name) || /\bstar\s+(gold|plus|bharat|movies|sports|utsav|jalsha|pravah|maa|vijay)\b/i.test(name)) {
        score = 300;
      }
      // 2. Zee Network (Zee Cinema, Zee TV, Zee News, Zee Action, Zee Bollywood, Zee Cafe, etc.)
      else if (/^zee\b/i.test(name) || /\bzee\s+(cinema|tv|news|action|bollywood|classic|bangla|business|marathi|kannada|telugu)\b/i.test(name)) {
        score = 250;
      }
      // 3. Sony & Colors Networks
      else if (/^(sony|colors)\b/i.test(name)) {
        score = 200;
      }
      // 4. Major 24/7 News (Aaj Tak, NDTV, ABP News, India Today)
      else if (/^(aaj tak|ndtv|abp news|india today)\b/i.test(name)) {
        score = 150;
      }

      // Bonus for 1080p / 720p HD feeds
      if (c.quality === '1080p') score += 10;
      else if (c.quality === '720p' || /\bhd\b/i.test(name)) score += 5;

      // Mild penalty for part-time / geo-blocked feeds so always-working streams lead
      if (c.isNot247) score -= 4;
      if (c.isGeoBlocked) score -= 6;

      return score;
    };

    const scoreA = getScore(a);
    const scoreB = getScore(b);

    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

    return a.name.localeCompare(b.name);
  });
}

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hour cache

/**
 * Resolves the M3U playlist URL for a given country code.
 * 1. Primary: VITE_LIVETV_M3U_URL environment variable
 * 2. Secondary fallback: https://iptv-org.github.io/iptv/countries/{country}.m3u if env not given
 */
export function getLiveTvM3uUrl(countryCode = 'in') {
  const code = (countryCode || 'in').toLowerCase();
  const template = import.meta.env?.VITE_LIVETV_M3U_URL?.trim() || 'https://iptv-org.github.io/iptv/countries/{country}.m3u';
  if (template.includes('{country}')) return template.replace(/\{country\}/gi, code);
  if (template.includes('{countryCode}')) return template.replace(/\{countryCode\}/gi, code);
  return template.endsWith('.m3u') ? template : `${template.replace(/\/+$/, '')}/${code}.m3u`;
}

const readCache = (k, tK) => {
  try {
    const data = localStorage.getItem(k) || sessionStorage.getItem(k);
    const time = localStorage.getItem(tK) || sessionStorage.getItem(tK);
    if (data && time && Date.now() - parseInt(time, 10) < CACHE_TTL_MS) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return null;
};

const writeCache = (k, tK, data) => {
  try {
    const sData = JSON.stringify(data);
    const sTime = Date.now().toString();
    try {
      localStorage.setItem(k, sData);
      localStorage.setItem(tK, sTime);
    } catch {
      sessionStorage.setItem(k, sData);
      sessionStorage.setItem(tK, sTime);
    }
  } catch {}
};

/**
 * Fetches and parses IPTV playlist for a specific country code.
 * Uses localStorage for instant zero-latency loading across page refreshes.
 */
export async function fetchLiveChannels(countryCode = 'in') {
  let favoriteList = DEFAULT_CONFIG?.favorite_channels || [];
  try {
    const cfg = await movieApi.getServerConfig();
    if (Array.isArray(cfg?.favorite_channels) && cfg.favorite_channels.length > 0) {
      favoriteList = cfg.favorite_channels;
    }
  } catch {}

  const url = getLiveTvM3uUrl(countryCode);
  const urlSig = url.replace(/[^a-zA-Z0-9]/g, '_').slice(-20);
  const cacheKey = `livetv_m3u_v6_${countryCode}_${urlSig}`;
  const cacheTimeKey = `livetv_m3u_time_v6_${countryCode}_${urlSig}`;

  const cached = readCache(cacheKey, cacheTimeKey);
  if (cached) return cached;

  try {
    const response = await axios.get(url, { timeout: 15000 });
    const rawChannels = parseM3U(response.data);
    const channels = prioritizeChannels(rawChannels, countryCode, favoriteList);
    writeCache(cacheKey, cacheTimeKey, channels);
    return channels;
  } catch (error) {
    console.error(`Failed to fetch IPTV playlist for ${countryCode}:`, error);
    throw error;
  }
}
