'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');

// Cache: catálogo por 30min, episódios por 15min, streams por 5min
const catalogCache = new NodeCache({ stdTTL: 1800 });
const episodeCache = new NodeCache({ stdTTL: 900 });
const streamCache = new NodeCache({ stdTTL: 300 });

const BASE_URL = 'https://animesdigital.org';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Referer': BASE_URL,
};

async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
      return res.data;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function fetchPageWithFinalUrl(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
      const finalUrl = res.request?.res?.responseUrl || res.config?.url || url;
      return { html: res.data, finalUrl };
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

function extractEpisodeNumber(text) {
  if (!text) return null;
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const match = cleanText.match(/Epis[oó]dio\s+(\d+(?:\.\d+)?)/i) || 
                cleanText.match(/(\d+(?:\.\d+)?)\s*Epis[oó]dio/i) ||
                cleanText.match(/(\d+(?:\.\d+)?)$/);
  return match ? parseFloat(match[1]) : null;
}

function extractVideoId(href) {
  if (!href) return null;
  const match = href.match(/\/video\/[a-z]\/([^/?#]+)/);
  return match ? match[1] : null;
}

function detectTotalPages($) {
  let maxPage = 1;
  $('.content-pagination a').each((i, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const pageMatch = href.match(/\/page\/(\d+)\//) || href.match(/pagina=(\d+)/);
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1], 10);
      if (pageNum > maxPage) maxPage = pageNum;
    }
    const textNum = parseInt(text, 10);
    if (!isNaN(textNum) && textNum > maxPage) maxPage = textNum;
  });
  return maxPage;
}

function extractEpisodesFromPage($, seenVideoIds) {
  const episodes = [];
  $('a[href*="/video/"]').each((i, el) => {
    const href = $(el).attr('href') || '';
    const videoId = extractVideoId(href);
    if (!videoId || seenVideoIds.has(videoId)) return;

    const titleAnime = $(el).find('.title_anime').text().trim();
    const linkText = $(el).text().trim();
    const imgAlt = $(el).find('img').attr('alt') || '';
    const imgTitle = $(el).find('img').attr('title') || '';
    
    const fullText = titleAnime || linkText || imgAlt || imgTitle;
    const epNum = extractEpisodeNumber(fullText);

    if (epNum !== null) {
      seenVideoIds.add(videoId);
      episodes.push({
        number: epNum,
        videoId,
        url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
        title: (titleAnime || linkText || imgAlt).split('\n')[0].trim() || `Episódio ${epNum}`,
      });
    }
  });
  return episodes;
}

async function searchAnimes(query) {
  const cacheKey = `search:${query}`;
  const cached = catalogCache.get(cacheKey);
  if (cached) return cached;

  try {
    const html = await fetchPage(`${BASE_URL}/search/${encodeURIComponent(query)}`);
    const $ = cheerio.load(html);
    const results = [];
    const seen = new Set();

    $('a[href*="/anime/"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (!href || !text || text.length < 2 || seen.has(href)) return;
      seen.add(href);

      const slugMatch = href.match(/\/anime\/[a-z]\/([^/?#]+)/);
      if (!slugMatch) return;

      const slug = slugMatch[1];
      const imgEl = $(el).find('img');
      const poster = imgEl.attr('src') || imgEl.attr('data-src') || '';

      results.push({
        id: `animesdigital:${slug}`,
        type: 'movie', // Forçamos movie para compatibilidade com a Home
        name: text,
        slug,
        url: href,
        poster: poster || null,
      });
    });

    catalogCache.set(cacheKey, results);
    return results;
  } catch (err) {
    console.error(`[scraper] searchAnimes error:`, err.message);
    return [];
  }
}

async function getSpecialCatalog(type) {
  const cacheKey = `special:${type}`;
  const cached = catalogCache.get(cacheKey);
  if (cached) return cached;

  try {
    const html = await fetchPage(`${BASE_URL}/home`);
    const $ = cheerio.load(html);
    const results = [];

    let targetSection = null;
    $('.header_title').each((i, el) => {
      const text = $(el).text().toUpperCase();
      const isMatch = type === 'lancamentos' ? text.includes('LANÇAMENTOS') : text.includes('ÚLTIMOS EPISÓDIOS');
      if (isMatch) {
        targetSection = $(el).next('.b_flex.b_wrap.space');
        return false;
      }
    });

    if (targetSection && targetSection.length) {
      targetSection.find('a[href*="/video/"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const title = $(el).find('.title_anime').text().trim() || $(el).text().trim();
        const poster = $(el).find('img').attr('src') || '';
        const videoId = extractVideoId(href);
        
        if (videoId) {
          results.push({
            id: `animesdigital_video:${videoId}`,
            type: 'movie',
            name: title.split('\n')[0].trim(),
            poster: poster || null,
            url: href
          });
        }
      });
    }

    catalogCache.set(cacheKey, results, 600);
    return results;
  } catch (err) {
    console.error(`[scraper] getSpecialCatalog error:`, err.message);
    return [];
  }
}

async function getCatalog(page = 1, genre = null) {
  const cacheKey = `catalog:${page}:${genre || 'all'}`;
  const cached = catalogCache.get(cacheKey);
  if (cached) return cached;

  try {
    let url;
    if (genre === 'legendado') {
      url = `${BASE_URL}/animes-legendados-online?filter_letter=0&type_url=animes&filter_audio=legendado&filter_order=name&filter_genre_add=&filter_genre_del=&pagina=${page}&search=0&limit=30`;
    } else if (genre === 'dublado') {
      url = `${BASE_URL}/animes-dublado/?filter_letter=0&type_url=animes&filter_audio=dublado&filter_order=name&filter_genre_add=&filter_genre_del=&pagina=${page}&search=0&limit=30`;
    } else if (genre) {
      url = page > 1 ? `${BASE_URL}/genero/${encodeURIComponent(genre)}/page/${page}/` : `${BASE_URL}/genero/${encodeURIComponent(genre)}/`;
    } else {
      url = page > 1 ? `${BASE_URL}/page/${page}/?cat=animes` : `${BASE_URL}/?cat=animes`;
    }

    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    const results = [];
    const seen = new Set();

    $('a[href*="/anime/"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (!href || !text || text.length < 2 || seen.has(href)) return;
      seen.add(href);

      const slugMatch = href.match(/\/anime\/[a-z]\/([^/?#]+)/);
      if (!slugMatch) return;

      const slug = slugMatch[1];
      const imgEl = $(el).find('img');
      const poster = imgEl.attr('src') || imgEl.attr('data-src') || '';

      results.push({
        id: `animesdigital:${slug}`,
        type: 'movie', // Forçamos movie para compatibilidade com a Home
        name: text,
        slug,
        url: href,
        poster: poster || null,
      });
    });

    catalogCache.set(cacheKey, results);
    return results;
  } catch (err) {
    console.error(`[scraper] getCatalog error:`, err.message);
    return [];
  }
}

async function getRecentAnimes() {
  const cacheKey = 'recent_animes';
  const cached = catalogCache.get(cacheKey);
  if (cached) return cached;

  try {
    const html = await fetchPage(`${BASE_URL}/home`);
    const $ = cheerio.load(html);
    const results = [];
    const seen = new Set();

    let animesSection = null;
    $('.header_title').each((i, el) => {
      if ($(el).text().toUpperCase().includes('ÚLTIMOS ANIMES')) {
        animesSection = $(el).next('.b_flex.b_wrap.space');
        return false;
      }
    });

    (animesSection && animesSection.length ? animesSection : $('body')).find('a[href*="/anime/"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (!href || !text || text.length < 2 || seen.has(href)) return;
      seen.add(href);

      const slugMatch = href.match(/\/anime\/[a-z]\/([^/?#]+)/);
      if (!slugMatch) return;

      const slug = slugMatch[1];
      const imgEl = $(el).find('img');
      const poster = imgEl.attr('src') || imgEl.attr('data-src') || '';

      results.push({
        id: `animesdigital:${slug}`,
        type: 'movie', // Forçamos movie para compatibilidade com a Home
        name: text,
        slug,
        url: href,
        poster: poster || null,
      });
    });

    catalogCache.set(cacheKey, results, 300);
    return results;
  } catch (err) {
    console.error('[scraper] getRecentAnimes error:', err.message);
    return [];
  }
}

async function getAnimeInfo(slug) {
  const cacheKey = `anime:${slug}`;
  const cached = episodeCache.get(cacheKey);
  if (cached) return cached;

  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const urlsToTry = [
    `${BASE_URL}/anime/a/${slug}`,
    ...letters.slice(1).map(l => `${BASE_URL}/anime/${l}/${slug}`),
  ];

  let html = null;
  let finalUrl = null;

  for (const url of urlsToTry) {
    try {
      const result = await fetchPageWithFinalUrl(url);
      if (result.html && !result.html.includes('Nada Encontrado') && result.finalUrl !== `${BASE_URL}/` && result.html.includes('/video/')) {
        html = result.html;
        finalUrl = result.finalUrl;
        break;
      }
    } catch (e) {}
  }

  if (!html) return null;

  try {
    const $ = cheerio.load(html);
    const rawTitle = $('h1').first().text().trim() || slug;
    const title = rawTitle.replace(/\s+Todos\s+Epis[oó]dios.*$/i, '').trim();
    const poster = $('meta[property="og:image"]').attr('content') || $('.poster img').attr('src') || '';
    const description = $('.sinopse').text().trim() || '';
    
    const genreSet = new Set();
    $('.genres .genre a, .genres .genre').each((i, el) => {
      const g = $(el).text().trim();
      if (g) genreSet.add(g);
    });

    const totalPages = detectTotalPages($);
    const seenVideoIds = new Set();
    const episodes = [];

    episodes.push(...extractEpisodesFromPage($, seenVideoIds));

    if (totalPages > 1) {
      const baseAnimeUrl = finalUrl.replace(/\/$/, '');
      const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      
      const BATCH_SIZE = 3;
      for (let i = 0; i < pageNumbers.length; i += BATCH_SIZE) {
        const batch = pageNumbers.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map(async (pageNum) => {
            const pageHtml = await fetchPage(`${baseAnimeUrl}/page/${pageNum}/`);
            return extractEpisodesFromPage(cheerio.load(pageHtml), seenVideoIds);
          })
        );
        batchResults.forEach(r => { if (r.status === 'fulfilled') episodes.push(...r.value); });
      }
    }

    episodes.sort((a, b) => a.number - b.number);

    const info = {
      id: `animesdigital:${slug}`,
      type: 'movie', // Forçamos movie para compatibilidade com a Home
      name: title,
      slug,
      poster,
      description,
      genres: Array.from(genreSet),
      episodes,
      url: finalUrl,
    };

    episodeCache.set(cacheKey, info);
    return info;
  } catch (err) {
    console.error(`[scraper] getAnimeInfo error:`, err.message);
    return null;
  }
}

async function getStreams(videoId) {
  const cacheKey = `stream:${videoId}`;
  const cached = streamCache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/video/a/${videoId}/`;
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    const streams = [];

    $('iframe').each((i, el) => {
      const src = $(el).attr('src') || '';
      if (!src) return;

      if (src.includes('api.anivideo.net') && src.includes('videohls.php')) {
        const streamUrl = new URLSearchParams(src.split('?')[1]).get('d');
        if (streamUrl && streamUrl.includes('m3u8')) {
          streams.push({
            url: streamUrl,
            title: '🎬 Player 1 — FHD (HLS)',
            behaviorHints: { notWebReady: false, bingeGroup: 'animesdigital-p1' },
          });
        }
      }

      if (src.startsWith(BASE_URL) && src.includes('bg.mp4')) {
        streams.push({
          url: src,
          title: '🎬 Player 2',
          behaviorHints: { notWebReady: true, bingeGroup: 'animesdigital-p2' },
        });
      }
    });

    if (streams.length === 0) {
      $('script:not([src])').each((i, el) => {
        const content = $(el).html() || '';
        const m3u8Matches = content.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g);
        if (m3u8Matches) {
          m3u8Matches.forEach(streamUrl => {
            if (!streams.some(s => s.url === streamUrl)) {
              streams.push({ url: streamUrl, title: '🎬 Stream HLS', behaviorHints: { notWebReady: false } });
            }
          });
        }
      });
    }

    streamCache.set(cacheKey, streams);
    return streams;
  } catch (err) {
    console.error(`[scraper] getStreams error:`, err.message);
    return [];
  }
}

module.exports = {
  searchAnimes,
  getCatalog,
  getRecentAnimes,
  getAnimeInfo,
  getStreams,
  getSpecialCatalog,
};

