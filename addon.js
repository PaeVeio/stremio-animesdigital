'use strict';

const { addonBuilder } = require('stremio-addon-sdk');
const scraper = require('./scraper');

// Manifest do addon
const manifest = {
  id: 'org.animesdigital.stremio',
  version: '1.3.0',
  name: 'AnimesDigital',
  description: 'Assista animes online em HD diretamente do AnimesDigital.org. Catálogo completo com todos os episódios, lançamentos e últimos episódios.',
  logo: 'https://animesdigital.org/wp-content/uploads/2021/10/cropped-favicon-animes-digital-192x192.png',
  background: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663488503845/zEDQBlPBckDCnshz.webp',
  resources: ['catalog', 'meta', 'stream'],
  types: ['series', 'movie'],
  idPrefixes: ['animesdigital:', 'animesdigital_video:'],
  catalogs: [
    {
      id: 'animesdigital-lancamentos',
      type: 'movie',
      name: 'Animes Lançamentos',
      extra: [{ name: 'search', isRequired: false }],
    },
    {
      id: 'animesdigital-ultimos',
      type: 'movie',
      name: 'Últimos Episódios',
      extra: [{ name: 'search', isRequired: false }],
    },
    {
      id: 'animesdigital-recentes',
      type: 'series',
      name: 'AnimesDigital - Recentes',
      extra: [
        { name: 'search', isRequired: false },
        { name: 'skip', isRequired: false },
      ],
    },
    {
      id: 'animesdigital-dublado',
      type: 'series',
      name: 'AnimesDigital - Dublado',
      extra: [{ name: 'skip', isRequired: false }],
    },
  ],
  behaviorHints: {
    adult: false,
    configurable: false,
    configurationRequired: false,
  },
};
{
  "stremioAddonsConfig": {
    "issuer": "https://stremio-addons.net",
    "signature": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..N1y7U0Hvzqqk11ddDcExNw.Slm77tFZ2QqgwbxGk-dAWKvbSzXmAeye_HhbcaeTkNCyJHv553ozryUAYVLwlcW7FCEMW_x4a7qGtb0VvsNnf8zB5APRQ6gyzR-QwZN1EfeTxWE4pwp57O6s9HW4WXtF.2mVTYqR4kDCsqR6ANme5TA"
  }
}
const builder = new addonBuilder(manifest);

/**
 * Handler de Catálogo
 */
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  const skip = parseInt(extra?.skip || 0);
  const page = Math.floor(skip / 10) + 1;

  try {
    let animes = [];

    // Busca por texto
    if (extra?.search) {
      animes = await scraper.searchAnimes(extra.search);
    } else if (id === 'animesdigital-lancamentos') {
      animes = await scraper.getSpecialCatalog('lancamentos');
    } else if (id === 'animesdigital-ultimos') {
      animes = await scraper.getSpecialCatalog('ultimos');
    } else if (id === 'animesdigital-recentes') {
      animes = await scraper.getRecentAnimes();
      if (animes.length === 0 || skip > 0) {
        const catalogPage = await scraper.getCatalog(page);
        animes = skip > 0 ? catalogPage : [...animes, ...catalogPage];
      }
    } else if (id === 'animesdigital-dublado') {
      animes = await scraper.getCatalog(page, 'dublado');
    } else {
      animes = await scraper.getCatalog(page);
    }

    // Converter para formato Stremio
    const metas = animes.map(anime => ({
      id: anime.id,
      type: anime.type || 'series',
      name: anime.name,
      poster: anime.poster || undefined,
      posterShape: 'poster',
    }));

    return { metas };
  } catch (err) {
    console.error('[addon] catalogHandler error:', err.message);
    return { metas: [] };
  }
});

/**
 * Handler de Metadados
 */
builder.defineMetaHandler(async ({ type, id }) => {
  try {
    if (id.startsWith('animesdigital_video:')) {
      const videoId = id.split(':')[1];
      return {
        meta: {
          id: id,
          type: 'movie',
          name: 'Carregando vídeo...',
          background: manifest.background,
          logo: manifest.logo
        }
      };
    }

    if (!id.startsWith('animesdigital:')) return { meta: null };
    const slug = id.replace('animesdigital:', '');

    const info = await scraper.getAnimeInfo(slug);
    if (!info) return { meta: null };

    // Construir lista de vídeos (episódios)
    const videos = info.episodes.map(ep => ({
      id: `animesdigital_video:${ep.videoId}`,
      title: ep.title,
      season: 1,
      episode: ep.number,
      released: new Date(0).toISOString(),
      overview: `${info.name} - ${ep.title}`,
      thumbnail: info.poster || undefined,
    }));

    const meta = {
      id,
      type: 'series',
      name: info.name,
      poster: info.poster || undefined,
      posterShape: 'poster',
      background: info.poster || manifest.background,
      description: info.description || undefined,
      genres: info.genres.length > 0 ? info.genres : undefined,
      videos,
      links: [
        {
          name: 'AnimesDigital',
          category: 'Source',
          url: info.url,
        },
      ],
    };

    return { meta };
  } catch (err) {
    console.error(`[addon] metaHandler error for "${id}":`, err.message);
    return { meta: null };
  }
});

/**
 * Handler de Streams
 */
builder.defineStreamHandler(async ({ type, id }) => {
  try {
    let videoId;
    if (id.startsWith('animesdigital_video:')) {
      videoId = id.split(':')[1];
    } else if (id.startsWith('animesdigital:')) {
      const parts = id.split(':');
      if (parts.length < 3) return { streams: [] };
      videoId = parts[parts.length - 1];
    } else {
      return { streams: [] };
    }

    const rawStreams = await scraper.getStreams(videoId);
    const streams = rawStreams.map(s => ({
      url: s.url,
      title: s.title,
      behaviorHints: s.behaviorHints || {},
    }));

    return { streams };
  } catch (err) {
    console.error(`[addon] streamHandler error for "${id}":`, err.message);
    return { streams: [] };
  }
});

module.exports = builder.getInterface();
