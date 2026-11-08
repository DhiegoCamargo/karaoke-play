/**
 * kpTomBridge — ponte página ↔ extensão "KP Tom" (protocolo kp-tom-v1).
 * Arquivo autocontido para um branch experimental do Karaokê Play:
 *
 *   const bridge = new KpTomBridge()
 *   // no onReady do YT.Player:
 *   bridge.attach(event.target.getIframe())
 *   bridge.setPitch(+3)   // botões Tom −1 / +1 / Restaurar
 *
 * Não interfere em YT.Player, fila, pontuação ou autoplay: só envia postMessage
 * ao iframe do YouTube, onde o content script da extensão escuta.
 */
export const KP_TOM_NS = 'kp-tom-v1'

export type KpTomState = {
  version: string
  world: 'ISOLATED'
  frameOrigin: string
  parentOrigin: string | null
  allowed: boolean
  video: { found: boolean; srcKind?: string; paused?: boolean; sameAsBound?: boolean | null }
  context: { state: string; sampleRate: number; baseLatencyMs: number; outputLatencyMs: number | null } | null
  worklet: 'not-loaded' | 'loading' | 'loaded' | 'error'
  graph: 'none' | 'bypass' | 'processing'
  adShowing: boolean
  semitones: number
  measured: { semitones: number; corr: number; frames: number } | null
  processorLatencyMs: number | null
  needsActivation: boolean
  lastError: string
}

export type KpTomStatus = 'idle' | 'detecting' | 'ready' | 'absent' | 'denied' | 'error'
type Msg = { ns: string; id?: number; type: 'hello' | 'pong' | 'state' | 'error' | 'denied'; state?: KpTomState; message?: string }
type Listener = (status: KpTomStatus, state: KpTomState | null, info?: string) => void

const YT_ORIGINS = ['https://www.youtube.com', 'https://www.youtube-nocookie.com']

export class KpTomBridge {
  status: KpTomStatus = 'idle'
  state: KpTomState | null = null
  private iframe: HTMLIFrameElement | null = null
  private seq = 0
  private pending = new Map<number, (m: Msg) => void>()
  private listeners = new Set<Listener>()

  constructor() {
    window.addEventListener('message', this.onMessage)
  }

  attach(iframe: HTMLIFrameElement | null) {
    this.iframe = iframe
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    fn(this.status, this.state)
    return () => this.listeners.delete(fn)
  }

  async detect(timeoutMs = 1500): Promise<boolean> {
    this.set('detecting')
    try {
      const r = await this.request({ type: 'ping' }, timeoutMs)
      this.set(r.type === 'denied' ? 'denied' : 'ready', r.message)
      return r.type !== 'denied'
    } catch (e) {
      this.set('absent', (e as Error).message)
      return false
    }
  }

  async setPitch(semitones: number): Promise<boolean> {
    if (this.status !== 'ready' && !(await this.detect())) return false
    try {
      const r = await this.request({ type: 'setPitch', semitones: Math.max(-12, Math.min(12, Math.round(semitones))) }, 4000)
      if (r.type === 'error') {
        this.set('error', r.message)
        return false
      }
      return true
    } catch (e) {
      this.set('absent', (e as Error).message)
      return false
    }
  }

  dispose() {
    window.removeEventListener('message', this.onMessage)
    this.pending.clear()
    this.listeners.clear()
  }

  private request(msg: Record<string, unknown>, timeoutMs: number): Promise<Msg> {
    const win = this.iframe?.contentWindow
    let origin: string | null = null
    try {
      origin = this.iframe ? new URL(this.iframe.src).origin : null
    } catch {
      origin = null
    }
    if (!win || !origin || !YT_ORIGINS.includes(origin)) return Promise.reject(new Error('iframe do YouTube indisponível'))
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      const t = window.setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('sem resposta do iframe (extensão ausente/desativada)'))
      }, timeoutMs)
      this.pending.set(id, (m) => {
        window.clearTimeout(t)
        resolve(m)
      })
      win.postMessage({ ns: KP_TOM_NS, id, ...msg }, origin)
    })
  }

  private onMessage = (e: MessageEvent) => {
    if (!YT_ORIGINS.includes(e.origin)) return
    if (this.iframe && e.source !== this.iframe.contentWindow) return
    const d = e.data as Msg
    if (!d || typeof d !== 'object' || d.ns !== KP_TOM_NS) return
    if (d.state) this.state = d.state
    if (d.type === 'hello') this.status = 'ready'
    if (d.type === 'denied') this.status = 'denied'
    if (d.id && this.pending.has(d.id)) {
      this.pending.get(d.id)!(d)
      this.pending.delete(d.id)
    }
    this.emit(d.message)
  }

  private set(s: KpTomStatus, info?: string) {
    this.status = s
    this.emit(info)
  }

  private emit(info?: string) {
    this.listeners.forEach((fn) => fn(this.status, this.state, info))
  }
}
