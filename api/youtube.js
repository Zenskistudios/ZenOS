// /api/youtube — Vercel serverless function (keeps YOUTUBE_API_KEY server-side)
//
// Modes:  ?q=term   → search     ?trending=1 → most popular (Nigeria, falls back to global)
//         ?ids=a,b  → look up specific videos
//
// Fixes vs. the old version:
//  1. search.list only accepts part=snippet. Asking it for statistics/contentDetails/status
//     made every search fail with HTTP 400. Search now returns ids, then one videos.list
//     call fills in views, duration and embeddable status.
//  2. videos.list rejects maxResults when filtering by id (400), which broke ids lookups.
//  3. Videos whose owners disabled embedding are filtered out so they never reach the player.
const YT = 'https://www.googleapis.com/youtube/v3';
const PARTS = 'snippet,statistics,contentDetails,status';
const ID_RE = /^[\w-]{11}$/;

async function ytGet(path, params) {
  const url = `${YT}/${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || `YouTube API error (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const toVideo = item => ({
  id: item.id,
  title: item.snippet?.title || '',
  channel: item.snippet?.channelTitle || '',
  publishedAt: item.snippet?.publishedAt || null,
  description: item.snippet?.description || '',
  thumbnail:
    item.snippet?.thumbnails?.high?.url ||
    item.snippet?.thumbnails?.medium?.url ||
    item.snippet?.thumbnails?.default?.url ||
    `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
  views: item.statistics?.viewCount ?? null,
  duration: item.contentDetails?.duration ?? null
});

const playable = item =>
  item.id && item.status?.embeddable !== false && item.status?.privacyStatus !== 'private';

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return response.status(503).json({ error: 'YouTube service is not configured (YOUTUBE_API_KEY missing)' });

  const query = String(request.query.q || '').trim().slice(0, 120);
  const ids = String(request.query.ids || '').split(',').map(s => s.trim()).filter(s => ID_RE.test(s)).slice(0, 50);

  try {
    let items = [];
    if (ids.length) {
      // NOTE: no maxResults here — YouTube rejects it together with `id`.
      const data = await ytGet('videos', { key, part: PARTS, id: ids.join(',') });
      items = data.items || [];
    } else if (request.query.trending === '1') {
      const base = { key, part: PARTS, chart: 'mostPopular', maxResults: '24' };
      let data;
      try { data = await ytGet('videos', { ...base, regionCode: 'NG' }); } catch (e) { data = { items: [] }; }
      if (!data.items?.length) data = await ytGet('videos', { ...base, regionCode: 'US' });
      items = data.items || [];
    } else {
      const found = await ytGet('search', {
        key, part: 'snippet', type: 'video', maxResults: '24',
        q: query || 'JavaScript tutorial', videoEmbeddable: 'true', safeSearch: 'moderate'
      });
      const foundIds = (found.items || []).map(i => i.id?.videoId).filter(Boolean);
      if (foundIds.length) {
        const data = await ytGet('videos', { key, part: PARTS, id: foundIds.join(',') });
        const byId = new Map((data.items || []).map(i => [i.id, i]));
        items = foundIds.map(id => byId.get(id)).filter(Boolean); // keep search ranking
      }
    }
    response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return response.status(200).json({ query, videos: items.filter(playable).map(toVideo) });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
    return response.status(status).json({ error: error.status ? error.message : 'Unable to reach YouTube right now' });
  }
}