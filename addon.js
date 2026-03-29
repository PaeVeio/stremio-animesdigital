'use strict';

const { addonBuilder } = require('stremio-addon-sdk');
const scraper = require('./scraper');

// Manifest do addon
const manifest = {
  // Mudança de ID para forçar o Stremio a tratar como um addon NOVO e limpar o cache
  id: 'org.animesdigital.stremio.v16',
  version: '2.1.0',
  name: 'AnimesDigital',
  description: 'Assista animes online em HD Catálogo completo com todos os episódios, lançamentos, legendados e dublados.',
  // Agora usando a imagem personalizada como LOGO
  logo: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663488503845/zEDQBlPBckDCnshz.webp',
  // Background padrão do site
  background: 'https://animesdigital.org/wp-content/uploads/2021/10/assistir-jujutsu-kaisen-todos-os-episodios-online-animesdigital.jpg',
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
      id: 'animesdigital-legendados-home',
      type: 'movie',
      name: 'Animes Legendados',
      extra: [
        { name: 'search', isRequired: false },
        { name: 'skip', isRequired: false }
      ],
    },
    {
      id: 'animesdigital-dublados-home',
      type: 'movie',
      name: 'Animes Dublados',
      extra: [
        { name: 'search', isRequired: false },
        { name: 'skip', isRequired: false }
      ],
    }
  ],
  behaviorHints: {
    adult: false,
    configurable: false,
    configurationRequired: false,
  },
  // Campo de verificação para o stremio-addons.net
  "stremioAddonsConfig": {
    "issuer": "https://stremio-addons.net",
    "signature": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..uaOuGqLp-gBYv4iyoC9-Yw.CXJdoRPoPzWe35BK-Q1Z0ix36vV15_bc4OKxHP9DniYvj5RW-HUmlmtfgL2DViELxUagBDp5CC_ksVJAZWpNAIj9LpphkuCjwo5rwtGQWWJofVEc_KuCGbj4x23H52u8.bLc3vIPmWB2wMrJCoRAeRw"
  }
};

const builder = new addonBuilder(manifest);

/**
 * Handler de Catálogo
 */
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  const skip = parseInt(extra?.skip || 0);
  const page = Math.floor(skip / 30) + 1;

  try {
    let animes = [];

    // Busca por texto (Global)
    if (extra?.search) {
      animes = await scraper.searchAnimes(extra.search);
    } else if (id === 'animesdigital-lancamentos') {
      animes = await scraper.getSpecialCatalog('lancamentos');
    } else if (id === 'animesdigital-legendados-home') {
      animes = await scraper.getCatalog(page, 'legendado');
    } else if (id === 'animesdigital-dublados-home') {
      animes = await scraper.getCatalog(page, 'dublado');
    } else {
      // Fallback para o catálogo geral se o ID não bater
      animes = await scraper.getCatalog(page);
    }

    // Converter para formato Stremio
    const metas = animes.map(anime => ({
      id: anime.id,
      // O tipo DEVE ser o mesmo do catálogo (movie) para não dar EmptyContent
      type: 'movie', 
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
    // Caso seja um vídeo direto (dos catálogos de lançamentos/últimos)
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
      // O tipo deve ser movie para ser compatível com o catálogo da Home
      type: 'movie', 
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
