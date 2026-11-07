export type Result = { videoId: string; title: string; channel: string; thumb: string }
export type Song = Result & { id: string; singer: string }
export type HistoryItem = Song & { score: number | null; at: number }
export type Settings = { countdown: number; min: number; max: number; scoring: boolean; autoplay: boolean; anim: boolean; cheer: boolean }
export const DEFAULTS: Settings = { countdown: 10, min: 70, max: 100, scoring: true, autoplay: true, anim: true, cheer: true }

declare global { interface Window { YT: any; onYouTubeIframeAPIReady?: () => void } }

export function load<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback } catch { return fallback }
}
export function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* armazenamento cheio/bloqueado */ } }

// Inteiro uniforme em [min,max] usando crypto (rejeição evita viés de módulo).
export function rollScore(min: number, max: number) {
  const span = max - min + 1, lim = Math.floor(0x100000000 / span) * span, b = new Uint32Array(1)
  do { crypto.getRandomValues(b) } while (b[0] >= lim)
  return min + (b[0] % span)
}

export function videoIdFrom(s: string): string | null {
  const m = s.trim().match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/)
  return m ? m[1] : null
}

let yt: Promise<any> | undefined
export function loadYT() {
  return (yt ??= new Promise((res, rej) => {
    if (window.YT?.Player) return res(window.YT)
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.onerror = () => rej(new Error('yt'))
    window.onYouTubeIframeAPIReady = () => res(window.YT)
    document.head.appendChild(s)
  }))
}

export async function oembed(id: string): Promise<Result> {
  const u = encodeURIComponent('https://www.youtube.com/watch?v=' + id)
  const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${u}`)
  if (!r.ok) throw new Error('Vídeo indisponível, privado ou removido.')
  const d = await r.json()
  return { videoId: id, title: d.title, channel: d.author_name, thumb: d.thumbnail_url }
}

const cache = new Map<string, { items: Result[]; next?: string }>()
export async function searchYT(q: string, pageToken?: string) {
  const key = q + '|' + (pageToken ?? '')
  if (cache.has(key)) return cache.get(key)!
  let r: Response
  try { r = await fetch(`/api/search?q=${encodeURIComponent(q)}` + (pageToken ? `&pageToken=${pageToken}` : '')) }
  catch { throw new Error('Sem conexão com o servidor de pesquisa.') }
  const d = await r.json().catch(() => ({}))
  if (r.status === 503 || d.error === 'missing_key') throw new Error('Pesquisa não configurada: defina YOUTUBE_API_KEY no servidor (veja o README).')
  if (r.status === 429) throw new Error('Limite diário da API do YouTube atingido. Tente novamente mais tarde.')
  if (!r.ok) throw new Error('Falha na pesquisa. Tente novamente.')
  cache.set(key, d)
  return d as { items: Result[]; next?: string }
}
