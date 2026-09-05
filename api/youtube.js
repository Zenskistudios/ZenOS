export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return response.status(503).json({ error: 'YouTube service is not configured' });
  const query = String(request.query.q || 'JavaScript tutorial').trim().slice(0, 120);
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.search = new URLSearchParams({ key, part: 'snippet', type: 'video', maxResults: '24', q: query }).toString();
  try {
    const upstream = await fetch(url);
    const payload = await upstream.json();
    if (!upstream.ok) return response.status(upstream.status).json({ error: payload.error?.message || 'YouTube API request failed' });
    const videos = (payload.items || []).map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || ''
    })).filter(video => video.id);
    return response.status(200).json({ query, videos });
  } catch (error) {
    return response.status(502).json({ error: 'Unable to reach YouTube right now' });
  }
}
