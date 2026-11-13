export const genres = [
  'Pagode', 'Sertanejo', 'Samba', 'MPB', 'Rock nacional', 'Rock internacional',
  'Forró', 'Gospel', 'Funk', 'Infantil', 'Internacional',
]

export type Result = { videoId: string; title: string; channel: string; thumb: string }
export type Source = 'youtube' | 'file' | 'library'
export type Song = Result & { id: string; singer: string; source?: Source; fileName?: string; url?: string }
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

export const MAX_TERM = 100 // limite do servidor (api/search.ts) para o termo enviado ao YouTube
export const KARAOKE_SUFFIX = ' karaokê'
/** Normaliza a consulta: minúsculas e espaços colapsados. Nunca corta o texto. */
export function normalizeQuery(s: string) {
  return s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
}
export type TermResult = { term: string } | { tooLong: true; max: number }
/** Monta o termo enviado ao servidor. O limite considera o " karaokê" acrescentado; se não couber, avisa em vez de cortar. */
export function buildTerm(raw: string, withKaraoke: boolean): TermResult {
  const base = normalizeQuery(raw)
  const add = withKaraoke && !/karaok/.test(base)
  const max = MAX_TERM - (add ? KARAOKE_SUFFIX.length : 0)
  if (base.length > max) return { tooLong: true, max }
  return { term: add ? base + KARAOKE_SUFFIX : base }
}
/** Junta páginas sem repetir vídeos (inclusive repetidos dentro da própria página recebida). */
export function mergeResults(prev: Result[], more: Result[]): Result[] {
  const seen = new Set<string>(), out: Result[] = []
  for (const r of [...prev, ...more]) { if (!seen.has(r.videoId)) { seen.add(r.videoId); out.push(r) } }
  return out
}

export function mostSungYouTubeSongs(history: HistoryItem[]) {
  const songs = new Map<string, { result: Result; count: number; at: number }>()
  for (const { source, videoId, title, channel, thumb, at } of history) {
    if ((source && source !== 'youtube') || !/^[\w-]{11}$/.test(videoId)) continue
    const entry = songs.get(videoId)
    if (entry) {
      entry.count++
    } else {
      songs.set(videoId, { result: { videoId, title, channel, thumb }, count: 1, at })
    }
  }
  return [...songs.values()].sort((a, b) => b.count - a.count || b.at - a.at).slice(0, 12)
}

type Page = { items: Result[]; next?: string }
// Cache só de pesquisas bem-sucedidas: memória + sessionStorage (some ao fechar a aba), validade de 1 h, até 40 entradas.
const TTL = 60 * 60 * 1000, MAX = 40, PFX = 'kp:sc:'
const mem = new Map<string, { t: number; d: Page }>()
const inflight = new Map<string, Promise<Page>>()
// A chave ignora acentos: "Evidências" e "evidencias" compartilham o cache. O token de página faz parte da chave.
const keyOf = (q: string, token?: string) => q.normalize('NFD').replace(/[̀-ͯ]/g, '') + '|' + (token ?? '')

function getCached(k: string): Page | null {
  const m = mem.get(k)
  if (m) { if (Date.now() - m.t <= TTL) return m.d; mem.delete(k) }
  try {
    const v = sessionStorage.getItem(PFX + k)
    if (!v) return null
    const o = JSON.parse(v)
    if (Date.now() - o.t > TTL || !Array.isArray(o.d?.items)) { sessionStorage.removeItem(PFX + k); return null }
    mem.set(k, o)
    return o.d as Page
  } catch { return null }
}
function setCached(k: string, d: Page) {
  mem.set(k, { t: Date.now(), d })
  try {
    sessionStorage.setItem(PFX + k, JSON.stringify({ t: Date.now(), d }))
    const idx: string[] = JSON.parse(sessionStorage.getItem(PFX + 'idx') ?? '[]').filter((x: string) => x !== k)
    idx.push(k)
    while (idx.length > MAX) { const old = idx.shift()!; sessionStorage.removeItem(PFX + old); mem.delete(old) }
    sessionStorage.setItem(PFX + 'idx', JSON.stringify(idx))
  } catch { /* armazenamento cheio/bloqueado: segue só com a memória */ }
}

// Mensagens para o usuário (os detalhes técnicos ficam no README e no console).
const MSG_OFF = 'A pesquisa por nome não está disponível no momento. Você ainda pode colar o link do vídeo do YouTube.'
const MSG_LIMIT = 'O limite diário de pesquisas foi atingido. Cole o link do vídeo ou tente de novo mais tarde.'
const MSG_FAIL = 'Não foi possível pesquisar agora. Tente novamente em instantes.'
async function fetchPage(q: string, pageToken?: string): Promise<Page> {
  let r: Response
  try { r = await fetch(`/api/search?q=${encodeURIComponent(q)}` + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')) }
  catch { throw new Error('Sem conexão. Verifique a internet e tente de novo.') }
  const d = await r.json().catch(() => null)
  if (r.status === 503 || d?.error === 'missing_key') { console.warn('[pesquisa] YOUTUBE_API_KEY não configurada no servidor.'); throw new Error(MSG_OFF) }
  if (r.status === 404 || r.status === 405) { console.warn('[pesquisa] /api/search não existe neste host (precisa de função serverless).'); throw new Error(MSG_OFF) }
  if (r.status === 429) throw new Error(MSG_LIMIT)
  if (!r.ok) throw new Error(MSG_FAIL)
  if (!Array.isArray(d?.items)) { console.warn('[pesquisa] resposta inesperada de /api/search.'); throw new Error(MSG_OFF) } // ex.: servidor de desenvolvimento devolvendo a página HTML
  return d as Page
}

export async function searchYT(q: string, pageToken?: string): Promise<Page> {
  const k = keyOf(q, pageToken)
  const hit = getCached(k)
  if (hit) return hit
  const going = inflight.get(k) // dois pedidos iguais ao mesmo tempo viram um só
  if (going) return going
  const p = fetchPage(q, pageToken).then(d => { setCached(k, d); return d }).finally(() => inflight.delete(k))
  inflight.set(k, p)
  return p
}
