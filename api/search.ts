
  // Função serverless (Vercel). Mantém YOUTUBE_API_KEY no servidor e cacheia respostas na CDN.
  export default async function handler(req: any, res: any) {
    const key = process.env.YOUTUBE_API_KEY
    if (!key) return res.status(503).json({ error: 'missing_key' })
    const q = String(req.query.q ?? '').trim()
    if (!q || q.length > 100) return res.status(400).json({ error: 'bad_query' })
    const p = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '12', q, key })
    if (req.query.pageToken) p.set('pageToken', String(req.query.pageToken))
    const r = await fetch('https://www.googleapis.com/youtube/v3/search?' + p)
    const d: any = await r.json()
    if (!r.ok) return res.status(r.status === 403 ? 429 : 502).json({ error: d.error?.errors?.[0]?.reason ?? 'upstream' })
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
    res.json({
      next: d.nextPageToken,
      items: d.items.map((i: any) => ({ videoId: i.id.videoId, title: i.snippet.title, channel: i.snippet.channelTitle, thumb: i.snippet.thumbnails?.medium?.url }))
    })
  }
  
