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
  warning = '' // aviso não fatal (ex.: demora na resposta); não desabilita os controles
  private lastDetect = 0

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

  // force=true: tentativa manual/inicial. force=false: chamadas automáticas respeitam 5 s de intervalo quando a extensão não responde.
  async detect(timeoutMs = 1500, force = true): Promise<boolean> {
    if (!force && this.status !== 'ready' && Date.now() - this.lastDetect < 5000) return false
    this.lastDetect = Date.now()
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
    if (this.status !== 'ready' && !(await this.detect(1500, false))) return false
    const v = Math.max(-12, Math.min(12, Math.round(semitones)))
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await this.request({ type: 'setPitch', semitones: v }, 4000)
        if (r.type === 'error') { this.setWarning(r.message ?? 'Erro da extensão.'); return false }
        this.setWarning('')
        return true
      } catch {
        // tenta mais uma vez; se falhar, mantém 'ready' (a extensão já respondia) e apenas avisa
        if (attempt === 1) this.setWarning('A extensão demorou a responder; o tom pode não ter sido aplicado. Tente de novo.')
      }
    }
    return false
  }

  private setWarning(m: string) {
    this.warning = m
    this.emit()
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
    this.listeners.forEach((fn) => fn(this.status, this.state, info ?? (this.warning || undefined)))
  }
}
