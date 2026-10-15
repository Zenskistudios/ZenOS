export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return response.status(503).json({ error: 'YouTube service is not configured' });
  const query = String(request.query.q || '').trim().slice(0, 120);
  const ids = String(request.query.ids || '').split(',').map(id => id.trim()).filter(Boolean).slice(0, 50);
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  const params = new URLSearchParams({ key, part: 'snippet,statistics,contentDetails,status', maxResults: '24' });
  if (ids.length) {
    url.pathname = '/youtube/v3/videos';
    params.set('id', ids.join(','));
  } else if (request.query.trending === '1') {
    url.pathname = '/youtube/v3/videos';
    params.set('chart', 'mostPopular');
    params.set('regionCode', 'NG');
  } else {
    params.set('type', 'video');
    params.set('q', query || 'JavaScript tutorial');
  }
  url.search = params.toString();
  try {
    const upstream = await fetch(url);
    const payload = await upstream.json();
    if (!upstream.ok) return response.status(upstream.status).json({ error: payload.error?.message || 'YouTube API request failed' });
    const videos = (payload.items || []).map(item => ({
      id: item.id.videoId || item.id,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
      views: item.statistics?.viewCount || null,
      duration: item.contentDetails?.duration || null
    })).filter(video => video.id);
    return response.status(200).json({ query, videos });
  } catch (error) {
    return response.status(502).json({ error: 'Unable to reach YouTube right now' });
  }
}
