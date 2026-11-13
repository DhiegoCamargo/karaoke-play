import { loadYT, videoIdFrom, type Song } from './lib'
import { SoundTouchNode } from '@soundtouchjs/audio-worklet'
// ?raw + Blob: correção que funcionou nos testes (evita o erro de MIME do addModule no StackBlitz)
import processorCode from '@soundtouchjs/audio-worklet/processor?raw'

export type Events = { ended(): void; playing(): void; paused(): void; error(m: string): void; blocked(): void }
export interface Playback {
  readonly caps: { pitch: boolean }
  ready(): boolean
  load(s: Song, src?: File | string): void
  play(): void
  pause(): void
  stop(): void
  setPitch(semitones: number): void
}

// ---------- YouTube: só controles oficiais (sem tom) ----------
export class YouTubePlayback implements Playback {
  readonly caps = { pitch: false }
  private p: any
  private videoId = ''
  private hasPlayed = false
  private isReady = false
  constructor(elId: string, private ev: Events, private onIframeReady?: (iframe: HTMLIFrameElement) => void, private onVideoPlaying?: () => void) {
    loadYT().then(YT => {
      this.p = new YT.Player(elId, {
        width: '100%', height: '100%', playerVars: { fs: 0, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e: any) => { this.isReady = true; this.applyRate(); const frame = e.target?.getIframe?.(); if (frame) this.onIframeReady?.(frame) },
          onStateChange: (e: any) => {
            // O iframe pode entregar eventos que já estavam na fila ao trocar de vídeo.
            if (!this.isCurrentVideo(e.target) || e.target.getPlayerState() !== e.data) return
            if (e.data === 0) {
              const duration = e.target.getDuration()
              if (this.hasPlayed && duration > 0 && e.target.getCurrentTime() >= duration - 1) ev.ended()
            } else if (e.data === 1) {
              this.hasPlayed = true
              ev.playing()
              this.applyRate()
              this.onVideoPlaying?.()
            } else if (e.data === 2 && this.hasPlayed) ev.paused()
          },
          onPlaybackRateChange: () => this.applyRate(),
          onError: (e: any) => {
            if (!this.videoId) return
            const reportedId = videoIdFrom(e.target.getVideoUrl?.() ?? '')
            if (reportedId && reportedId !== this.videoId) return
            ev.error([101, 150].includes(e.data) ? 'Este vídeo não permite incorporação.' : e.data === 100 ? 'Vídeo removido ou privado.' : 'Erro ao reproduzir o vídeo.')
          },
          onAutoplayBlocked: () => { if (this.videoId && !this.hasPlayed) ev.blocked() },
        },
      })
    }).catch(() => ev.error('Falha ao carregar o player do YouTube.'))
  }
  ready() { return this.isReady }
  private isCurrentVideo(p: any) {
    return !!this.videoId && videoIdFrom(p.getVideoUrl?.() ?? '') === this.videoId
  }
  load(s: Song) {
    this.videoId = s.videoId
    this.hasPlayed = false
    this.p.loadVideoById(s.videoId)
  }
  play() { if (this.videoId) this.p?.playVideo() }
  pause() { if (this.videoId) this.p?.pauseVideo() }
  stop() { this.videoId = ''; this.p?.stopVideo?.() }
  setPitch() { /* não existe API oficial de tom */ }
  private applyRate() {
    // A velocidade é fixa; o tom continua sob responsabilidade da KP Tom.
    const p = this.p
    if (p?.setPlaybackRate && p.getPlaybackRate?.() !== 1) p.setPlaybackRate(1)
  }
}

// ---------- MP4/MP3 local (ou, no futuro, URL da biblioteca): tom via SoundTouch, reprodução em 1,00× ----------
export class LocalPlayback implements Playback {
  readonly caps = { pitch: true }
  private ctx?: AudioContext
  private node?: SoundTouchNode
  private graphP?: Promise<void>
  private url = ''
  private active = false
  private busy = false // true durante uma carga: ignora pause/ended/erro do vídeo anterior
  private req = 0 // identifica a carga mais recente; cargas antigas se abandonam
  private pitch = 0
  constructor(private v: HTMLVideoElement, private ev: Events) {
    const isCurrent = () => this.active && v.currentSrc === this.url && !!this.url
    v.onended = () => { if (isCurrent() && v.ended) ev.ended() }
    v.onplaying = () => { if (isCurrent() && !v.paused) ev.playing() }
    v.onpause = () => { if (isCurrent() && !this.busy && v.paused && !v.ended) ev.paused() }
    v.onerror = () => { if (this.active && v.src === this.url && v.error) ev.error('Não foi possível abrir este arquivo (use MP4 H.264/AAC ou MP3).') }
    v.onloadedmetadata = () => this.applyRate() // o navegador zera a taxa ao trocar o src
  }
  ready() { return true }
  // Promessa memorizada: cargas simultâneas não criam dois AudioContext nem dois MediaElementSource.
  private graph() { return (this.graphP ??= this.build().catch(e => { this.graphP = undefined; throw e })) }
  private async build() {
    if (!('audioWorklet' in AudioContext.prototype)) throw new Error('Este navegador não suporta AudioWorklet.')
    const c = new AudioContext({ latencyHint: 'interactive' })
    const blobUrl = URL.createObjectURL(new Blob([processorCode], { type: 'application/javascript' }))
    try { await SoundTouchNode.register(c, blobUrl) } finally { URL.revokeObjectURL(blobUrl) }
    const n = new SoundTouchNode({ context: c })
    const src = c.createMediaElementSource(this.v)
    src.connect(n); n.connect(c.destination)
    n.pitchSemitones.value = this.pitch
    n.playbackRate.value = 1
    this.ctx = c; this.node = n
  }
  private revoke() { if (this.url.startsWith('blob:')) URL.revokeObjectURL(this.url); this.url = '' }
  async load(s: Song, src?: File | string) {
    const my = ++this.req
    const stale = () => my !== this.req
    this.active = true; this.busy = true
    this.v.pause() // a mídia anterior para de forma síncrona, antes de qualquer espera
    try {
      if (!src) throw new Error(`Arquivo não disponível: ${s.fileName ?? s.title}. Adicione-o de novo em "MP4 local".`)
      await this.graph()
      if (stale()) return
      this.revoke()
      // URL remota (biblioteca) exige CORS no servidor; sem isso o áudio do MediaElementSource fica mudo
      this.v.crossOrigin = typeof src === 'string' ? 'anonymous' : null
      this.url = typeof src === 'string' ? src : URL.createObjectURL(src)
      this.v.src = this.url
      this.applyRate()
      await this.ctx!.resume()
      if (stale()) return
      if (this.ctx!.state !== 'running') { this.ev.blocked(); return }
      await this.v.play()
    } catch (e: any) {
      if (stale()) return
      if (e?.name === 'NotAllowedError') this.ev.blocked()
      else if (e?.name === 'NotSupportedError') this.ev.error('Não foi possível abrir este arquivo (use MP4 H.264/AAC ou MP3).')
      else this.ev.error(e?.message ?? 'Erro ao abrir o arquivo.')
    } finally { if (!stale()) this.busy = false }
  }
  play() {
    if (!this.active) return
    const request = this.req
    const current = () => this.active && request === this.req
    const resume = async () => {
      try {
        await this.ctx?.resume()
        if (current()) await this.v.play()
      } catch (e: any) {
        if (!current()) return
        if (e?.name === 'NotAllowedError') this.ev.blocked()
        else this.ev.error(e?.message ?? 'Erro ao continuar a reprodução.')
      }
    }
    void resume()
  }
  pause() { if (this.active) this.v.pause() }
  stop() { // cancela cargas pendentes, para a mídia e libera a URL temporária e o arquivo decodificado
    this.req++; this.active = false; this.busy = false
    this.v.pause(); this.revoke()
    this.v.removeAttribute('src'); this.v.load()
  }
  setPitch(s: number) { this.pitch = s; if (this.node) this.node.pitchSemitones.value = s }
  private applyRate() { // mantém a velocidade nativa, sem alterar o pitch selecionado
    this.v.preservesPitch = false
    this.v.defaultPlaybackRate = 1
    this.v.playbackRate = 1
    if (this.node) this.node.playbackRate.value = 1
  }
}
