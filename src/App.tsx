import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Search, Play, Pause, SkipForward, Trash2, ArrowUp, ArrowDown, Maximize, Plus, Trophy, ListMusic, Settings as Cog, HelpCircle, History, Tv, X, Upload, Mic, RotateCcw, Heart } from 'lucide-react'
import { type Song, type Settings, type HistoryItem, type Result, DEFAULTS, load, save, rollScore, videoIdFrom, genres, searchYT, oembed, buildTerm, mergeResults, mostSungYouTubeSongs } from './lib'
import { YouTubePlayback, LocalPlayback, type Playback, type Events } from './playback'
import RoomPanel from './RoomPanel'
import { RoomError, roomRequest, type QueueState, type RoomOwner } from './room'
import { KpTomBridge, type KpTomStatus, type KpTomState } from './kpTomBridge'

type Phase = 'IDLE' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'SCORING' | 'COUNTDOWN' | 'AUTOPLAY_BLOCKED' | 'ERROR'
type QueueResult = Result & { source?: Song['source']; fileName?: string }
type Tab = 'queue' | 'rank' | 'hist' | 'cfg' | 'help'
type MusicView = 'search' | 'favorites' | 'mostSung'
const musicViews: { value: MusicView; label: string }[] = [
  { value: 'search', label: 'Busca' },
  { value: 'favorites', label: 'Favoritas' },
  { value: 'mostSung', label: 'Mais cantadas' },
]
const SCORE_READ_MS = 5000
const LOCAL_THUMB = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="56"><rect width="96" height="56" fill="#2b1163"/><text x="48" y="34" font-size="22" text-anchor="middle" fill="#e879f9">MP4</text></svg>')
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]
const cheer = (n: number) => pick(n >= 95 ? ['Você arrasou no palco!', 'Nota de estrela!'] : n >= 85 ? ['Que apresentação!', 'O público foi à loucura!'] : ['Boa! Quem canta seus males espanta!', 'Divertido demais, bora de novo!'])

function Ov({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0a0720]/95 p-4 text-center">{children}</div>
}
function Counter({ n, anim }: { n: number; anim: boolean }) {
  const [v, setV] = useState(anim ? 0 : n)
  useEffect(() => {
    if (!anim) { setV(n); return }
    let i = 0
    const t = setInterval(() => { i++; setV(i >= 30 ? n : Math.floor(Math.random() * 101)); if (i >= 30) clearInterval(t) }, 60)
    return () => clearInterval(t)
  }, [n, anim])
  return <div className="text-7xl font-black text-fuchsia-400 drop-shadow-[0_0_24px_#d946ef] sm:text-9xl">{v}<span className="ml-2 text-2xl text-violet-300 sm:text-4xl">PONTOS</span></div>
}
const btn = 'rounded-xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-fuchsia-400'
const primary = 'rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 font-bold shadow-[0_0_18px_#c026d355] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-white'

function SingerModal({ title, thumb, suggestions, onConfirm, onCancel }: {
  title: string; thumb: string; suggestions: string[]
  onConfirm: (name: string) => void; onCancel: () => void
}) {
  const [name, setName] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onCancel])
  const ok = name.trim().length > 0
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <form role="dialog" aria-modal="true" aria-labelledby="singer-title" onSubmit={e => { e.preventDefault(); if (ok) onConfirm(name) }}
        className="w-full max-w-md space-y-3 rounded-2xl border border-fuchsia-500/40 bg-[#14093a] p-4 shadow-[0_0_40px_#a21caf66]">
        <h2 id="singer-title" className="text-lg font-bold">Quem vai cantar?</h2>
        <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2">
          <img src={thumb} alt="" className="h-12 w-20 rounded object-cover" />
          <p className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold">{title}</p>
        </div>
        <input ref={ref} aria-label="Nome do cantor" value={name} onChange={e => setName(e.target.value)} maxLength={24} placeholder="Nome ou apelido"
          className="w-full rounded-xl bg-white/10 px-3 py-3 outline-none ring-fuchsia-400 focus:ring-2" />
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Cantores da sessão">
            {suggestions.map(n => (
              <button type="button" key={n} onClick={() => setName(n)}
                className={`rounded-full px-3 py-2 text-sm hover:bg-white/20 ${n.toLowerCase() === name.trim().toLowerCase() ? 'bg-fuchsia-600/60 ring-1 ring-fuchsia-300' : 'bg-white/10'}`}>{n}</button>
            ))}
          </div>
        )}
        {!ok && <p className="text-sm text-amber-300">Informe quem vai cantar para continuar.</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btn} onClick={onCancel}>Cancelar</button>
          <button type="submit" disabled={!ok} className={`${primary} disabled:cursor-not-allowed disabled:opacity-40`}>Confirmar e adicionar</button>
        </div>
      </form>
    </div>
  )
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULTS, ...load('kp:settings', {}) }))
  const [queueState, setQueueState] = useState<QueueState>(() => load('kp:queue-state', {
    songs: load('kp:queue', []), room: '', cursor: 0,
  }))
  const queue = queueState.songs
  const setQueue = (update: Song[] | ((songs: Song[]) => Song[])) => {
    setQueueState(previous => ({ ...previous, songs: typeof update === 'function' ? update(previous.songs) : update }))
  }
  const [room, setRoom] = useState<RoomOwner | null>(() => load('kp:room-owner', null))
  const [roomPanelOpen, setRoomPanelOpen] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const updateRoom = (value: RoomOwner | null) => {
    save('kp:room-owner', value)
    setRoom(value)
  }
  const [history, setHistory] = useState<HistoryItem[]>(() => load('kp:history', []))
  const [favorites, setFavorites] = useState<Result[]>(() => load('kp:favorites', []))
  const [musicView, setMusicView] = useState<MusicView>('search')
  const [singer, setSinger] = useState<string>(() => load('kp:singer', ''))
  const [current, setCurrent] = useState<Song | null>(null)
  const [phase, updatePhase] = useState<Phase>('IDLE')
  const phaseRef = useRef<Phase>('IDLE')
  const setPhase = (next: Phase) => { phaseRef.current = next; updatePhase(next) }
  const [score, setScore] = useState<number | null>(null)
  const [left, setLeft] = useState(0)
  const [paused, setPaused] = useState(false)
  const [tab, setTab] = useState<Tab>('queue')
  const [q, setQ] = useState('')
  const [karaoke, setKaraoke] = useState(true)
  const [results, setResults] = useState<Result[]>([])
  const [more, setMore] = useState<string>()
  const [empty, setEmpty] = useState(false) // a última pesquisa não encontrou nada
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [playbackError, setPlaybackError] = useState('')
  const [party, setParty] = useState(false)
  const [pending, setPending] = useState<{ result: QueueResult; file?: File } | null>(null)
  const lastTerm = useRef('') // consulta efetiva da última pesquisa: "Mais resultados" usa esta, não o campo de texto
  const searchSeq = useRef(0) // descarta respostas de pesquisas ultrapassadas

  const player = useRef<Playback | null>(null)
  const yt = useRef<YouTubePlayback | null>(null)
  const local = useRef<LocalPlayback | null>(null)
  const vid = useRef<HTMLVideoElement>(null)
  const files = useRef(new Map<string, File>())
  const fileIn = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<'youtube' | 'file' | 'library'>('youtube')
  const bridge = useRef<KpTomBridge | null>(null)
  const [extensionStatus, setExtensionStatus] = useState<KpTomStatus>('idle')
  const [extensionMessage, setExtensionMessage] = useState('')
  const [extState, setExtState] = useState<KpTomState | null>(null)
  const diagOpen = useRef(false)
  const [tone, setTone] = useState(0)
  const [keep, setKeep] = useState(false)
  const activeSong = useRef<Song | null>(null)
  const tok = useRef(0)
  const queueRef = useRef(queue); queueRef.current = queue
  const setRef = useRef(settings); setRef.current = settings
  const toneRef = useRef(0)
  const sourceRef = useRef(source); sourceRef.current = source
  const finishRef = useRef(() => {})
  const startRef = useRef(() => {})
  const failRef = useRef((_message: string) => {})

  const stopPresentation = () => {
    activeSong.current = null
    tok.current++
    player.current?.stop()
    player.current = null
  }

  useEffect(() => save('kp:settings', settings), [settings])
  useLayoutEffect(() => {
    save('kp:queue-state', queueState)
    save('kp:queue', queue)
  }, [queueState, queue])

  useEffect(() => {
    if (!room) return
    const roomId = room.room
    const credentials = { ...room }
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    let cursor = queueState.room === room.room ? queueState.cursor : 0
    async function poll() {
      try {
        const reply = await roomRequest<{ songs: Song[]; cursor: number }>('poll', { ...credentials, cursor }, controller.signal)
        if (controller.signal.aborted) return
        cursor = reply.cursor
        setSyncMessage('')
        if (reply.songs.length) {
          setQueueState(previous => {
            const known = new Set(previous.songs.map(song => song.id))
            return {
              songs: [...previous.songs, ...reply.songs.filter(song => !known.has(song.id))],
              room: roomId,
              cursor: reply.cursor,
            }
          })
        }
      } catch (error) {
        if (controller.signal.aborted) return
        if (error instanceof RoomError && error.code === 'closed') {
          updateRoom(null)
          setSyncMessage(error.message)
          return
        }
        setSyncMessage('Reconectando os pedidos pelo celular…')
      }
      timer = setTimeout(poll, document.hidden ? 12000 : 3500)
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [room])
  useEffect(() => save('kp:history', history), [history])
  useEffect(() => save('kp:favorites', favorites), [favorites])
  useEffect(() => save('kp:singer', singer), [singer])

  useEffect(() => {
    if (yt.current || !vid.current) return // adaptadores criados uma única vez (também no StrictMode)
    const ev: Events = {
      ended: () => finishRef.current(),
      playing: () => { if (activeSong.current) setPhase('PLAYING') },
      paused: () => { if (phaseRef.current === 'PLAYING') setPhase('PAUSED') },
      error: m => failRef.current(m),
      blocked: () => { if (activeSong.current) setPhase('AUTOPLAY_BLOCKED') },
    }
    const ext = new KpTomBridge()
    bridge.current = ext
    ext.subscribe((status, st, info) => {
      setExtensionStatus(status)
      setExtensionMessage(info ?? '')
      // atualiza o diagnóstico só com o painel aberto ou quando um alerta muda (evita render por segundo)
      setExtState(prev => (diagOpen.current || prev?.needsActivation !== st?.needsActivation || prev?.lastError !== st?.lastError ? st : prev))
    })
    yt.current = new YouTubePlayback('yt', ev, (iframe) => {
      ext.attach(iframe)
      // A extensão comunica a presença a partir do iframe já carregado.
      void ext.detect()
    }, () => {
      // Retoma a configuração após o carregamento de outro vídeo do YouTube.
      if (sourceRef.current === 'youtube') void ext.setPitch(toneRef.current)
    })
    local.current = new LocalPlayback(vid.current, ev)
  }, [])
  // A transposição é independente: a reprodução permanece na velocidade nativa (1,00×).
  useEffect(() => {
    toneRef.current = tone
    player.current?.setPitch(tone)
    if (source === 'youtube' && current) void bridge.current?.setPitch(tone)
  }, [tone, source, current?.id])
  // libera os File que não estão mais na fila nem tocando
  useEffect(() => {
    const live = new Set<string>(queue.map(q => q.id))
    if (current && ['LOADING', 'PLAYING', 'PAUSED', 'AUTOPLAY_BLOCKED'].includes(phase)) live.add(current.id)
    files.current.forEach((_, id) => { if (!live.has(id)) files.current.delete(id) })
  }, [queue, current, phase])

  const play = (s: Song) => {
    const kind = s.source ?? 'youtube'
    const pb = kind === 'youtube' ? yt.current : local.current
    if (!pb?.ready()) {
      setNote('O player ainda não está disponível. Tente novamente em instantes.')
      return false
    }
    stopPresentation()
    const my = tok.current
    activeSong.current = s
    player.current = pb
    setSource(kind); setCurrent(s); setScore(null); setNote(''); setPhase('LOADING')
    if (!keep) { toneRef.current = 0; setTone(0) }
    pb.setPitch(keep ? tone : 0)
    pb.load(s, kind === 'file' ? files.current.get(s.id) : s.url)
    setTimeout(() => { if (tok.current === my && phaseRef.current === 'LOADING') setPhase('AUTOPLAY_BLOCKED') }, 6000)
    return true
  }
  startRef.current = () => {
    const [n] = queueRef.current
    if (!n) { setCurrent(null); setPhase('IDLE'); return }
    if (play(n)) setQueue(songs => songs.filter(song => song.id !== n.id))
    else setPhase('IDLE')
  }
  const advance = () => {
    if (queueRef.current.length && setRef.current.autoplay) {
      setLeft(setRef.current.countdown)
      setPaused(false)
      setPhase('COUNTDOWN')
    } else setPhase('IDLE')
  }
  const skip = () => {
    if (!activeSong.current) return
    stopPresentation()
    advance()
  }
  failRef.current = message => {
    if (!activeSong.current) return
    stopPresentation()
    setPlaybackError(message)
    setPhase('ERROR')
  }
  finishRef.current = () => {
    const completed = activeSong.current
    if (!completed) return
    stopPresentation()
    const s = setRef.current
    const sc = s.scoring ? rollScore(s.min, s.max) : null
    setScore(sc)
    setHistory(h => [{ ...completed, score: sc, at: Date.now() }, ...h].slice(0, 200))
    setPhase('SCORING')
  }

  // SCORING -> COUNTDOWN (tempo mínimo de leitura da nota)
  useEffect(() => {
    if (phase !== 'SCORING') return
    const t = setTimeout(advance, SCORE_READ_MS)
    return () => clearTimeout(t)
  }, [phase])
  // COUNTDOWN: um único timer por vez
  useEffect(() => {
    if (phase !== 'COUNTDOWN') return
    if (!queue.length || !settings.autoplay) { setPhase('IDLE'); return }
    if (paused) return
    if (left <= 0) { startRef.current(); return }
    const t = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, paused, left, queue.length, settings.autoplay])

  const doSearch = async (query: string, next?: string) => {
    const raw = query.trim()
    if (next ? !lastTerm.current : !raw) return
    setMusicView('search')
    const id = next ? null : videoIdFrom(raw)
    let term = lastTerm.current // "Mais resultados" continua a consulta original, não o texto atual do campo
    if (!next && !id) {
      const b = buildTerm(raw, karaoke)
      if ('tooLong' in b) { setNote(`Pesquisa muito longa: use até ${b.max} caracteres.`); return } // não corta o nome da música
      term = b.term
    }
    const my = ++searchSeq.current
    setBusy(true); setNote('')
    if (!next) { setResults([]); setMore(undefined); setEmpty(false); lastTerm.current = '' } // nova pesquisa: começa do zero
    try {
      if (id) {
        const v = await oembed(id)
        if (my !== searchSeq.current) return
        setResults([v])
      } else {
        const r = await searchYT(term, next)
        if (my !== searchSeq.current) return // resposta de pesquisa ultrapassada
        lastTerm.current = term
        setResults(prev => mergeResults(next ? prev : [], r.items)); setMore(r.next)
        if (!next && r.items.length === 0) setEmpty(true)
      }
    } catch (e: any) { if (my === searchSeq.current) setNote(e.message) } finally { if (my === searchSeq.current) setBusy(false) }
  }
  const toggleFavorite = (result: Result) => setFavorites(previous =>
    previous.some(item => item.videoId === result.videoId)
      ? previous.filter(item => item.videoId !== result.videoId)
      : [result, ...previous],
  )
  const add = (r: QueueResult, name: string, file?: File) => {
    if (r.source === 'file' && !file) { setNote('Para repetir um arquivo local, selecione-o de novo em "MP4 local".'); return }
    if ([...queue, ...(activeSong.current ? [activeSong.current] : [])].some(s => s.videoId === r.videoId && s.singer === name)) { setNote('Essa música já está na fila para este cantor.'); return }
    const s: Song = { ...r, id: crypto.randomUUID(), singer: name }
    if (file) files.current.set(s.id, file)
    setQueue(x => [...x, s])
    setNote(`"${r.title}" adicionada para ${name}.`)
  }
  const onFiles = (list: FileList | null) => { // um arquivo por vez (evita estado defasado entre adições)
    const f = list?.[0]
    if (f) setPending({ result: { videoId: `file:${f.name}:${f.size}`, title: f.name.replace(/\.[^.]+$/, ''), channel: 'Arquivo local', thumb: LOCAL_THUMB, source: 'file', fileName: f.name }, file: f })
    if (fileIn.current) fileIn.current.value = ''
  }
  const move = (i: number, d: number) => setQueue(x => { const a = [...x], j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return a })
  const playNow = (i: number) => { const s = queue[i]; if (s && play(s)) setQueue(x => x.filter(item => item.id !== s.id)) }
  const resetSession = () => {
    if (!confirm('Reiniciar sessão? Fila, ranking e histórico serão apagados.')) return
    stopPresentation()
    setQueue([]); setHistory([]); setCurrent(null); setScore(null); setPhase('IDLE')
  }
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings(s => ({ ...s, [k]: v }))

  const rank = useMemo(() => {
    const m = new Map<string, number[]>()
    history.forEach(h => { if (h.score != null) m.set(h.singer, [...(m.get(h.singer) ?? []), h.score]) })
    return [...m].map(([n, s]) => ({ n, c: s.length, best: Math.max(...s), avg: s.reduce((a, b) => a + b, 0) / s.length }))
      .sort((a, b) => b.best - a.best || b.avg - a.avg)
  }, [history])
  const msg = useMemo(() => (score != null ? cheer(score) : ''), [score])
  const mostSung = useMemo(() => mostSungYouTubeSongs(history), [history])
  const playCounts = new Map(mostSung.map(({ result, count }) => [result.videoId, count]))
  const visibleSongs = musicView === 'favorites' ? favorites : musicView === 'mostSung' ? mostSung.map(item => item.result) : results
  const nextUp = queue[0]
  // Cantores da sessão (histórico mais recente primeiro, depois quem está tocando e a fila), sem repetir
  const singers = useMemo(() => {
    const seen = new Set<string>(), out: string[] = []
    const push = (n?: string) => { const t = n?.trim(); if (!t || seen.has(t.toLowerCase())) return; seen.add(t.toLowerCase()); out.push(t) }
    push(singer); history.forEach(h => push(h.singer)); push(current?.singer); queue.forEach(x => push(x.singer))
    return out.slice(0, 8)
  }, [singer, history, current, queue])
  const cancelPending = () => setPending(null)
  const confirmSinger = (raw: string) => {
    const typed = raw.trim().slice(0, 24)
    if (!pending || !typed) return
    const name = singers.find(n => n.toLowerCase() === typed.toLowerCase()) ?? typed // mantém a grafia já usada no ranking
    setSinger(name) // vira o "último nome" da próxima vez
    add(pending.result, name, pending.file)
    setPending(null)
  }

  const overlay =
    phase === 'SCORING' ? (
      <Ov>
        <p className="text-xl text-violet-300 sm:text-3xl">{score != null ? `PARABÉNS, ${current?.singer.toUpperCase()}!` : 'APRESENTAÇÃO ENCERRADA'}</p>
        {score != null && <Counter n={score} anim={settings.anim} />}
        {score != null && settings.cheer && <p className="text-lg italic">“{msg}”</p>}
        {nextUp && <p className="text-sm text-white/60">Próximo: {nextUp.singer} — {nextUp.title}</p>}
      </Ov>
    ) : phase === 'COUNTDOWN' && nextUp ? (
      <Ov>
        <p className="text-sm font-bold text-violet-300 sm:text-xl">PRÓXIMA APRESENTAÇÃO</p>
        <p className="text-xl sm:text-3xl">Cantor(a): <b>{nextUp.singer}</b></p>
        <p className="max-w-xl truncate text-base text-white/80 sm:text-xl">Música: {nextUp.title}</p>
        <div className="text-8xl font-black text-fuchsia-400 drop-shadow-[0_0_24px_#d946ef] sm:text-9xl" aria-live="polite">{left}</div>
        <div className="h-2 w-64 overflow-hidden rounded bg-white/10"><div className="h-full bg-fuchsia-500 transition-all duration-1000 ease-linear" style={{ width: `${(left / settings.countdown) * 100}%` }} /></div>
        <div className="flex flex-wrap justify-center gap-2">
          <button className={btn} onClick={() => setPaused(p => !p)}>{paused ? 'Continuar' : 'Pausar'}</button>
          <button className={primary} onClick={() => startRef.current()}>Pular contagem</button>
          <button className={btn} onClick={() => { setPaused(true); setParty(false); setTab('queue') }}>Voltar à fila</button>
          <button className={btn} onClick={() => setPhase('IDLE')}>Cancelar</button>
        </div>
      </Ov>
    ) : phase === 'AUTOPLAY_BLOCKED' ? (
      <Ov><p className="text-xl">A música ainda não começou. Tente iniciar a reprodução ou avance para a próxima.</p><button className={primary} onClick={() => player.current?.play()}>▶ Iniciar música</button><button className={btn} onClick={skip}>Pular música</button></Ov>
    ) : phase === 'ERROR' ? (
      <Ov><p className="text-lg text-red-300">{playbackError}</p>{nextUp ? <button className={primary} onClick={() => startRef.current()}>Pular para a próxima</button> : <p className="text-white/60">Escolha outra música.</p>}</Ov>
    ) : phase === 'IDLE' && current ? (
      <Ov>
        <p className="text-2xl font-bold">{nextUp ? 'Pronto para o próximo?' : 'Sessão encerrada'}</p>
        {nextUp ? <button className={primary} onClick={() => startRef.current()}>Iniciar: {nextUp.singer} — {nextUp.title}</button> : <p className="text-white/70">Pesquise e adicione novas músicas para continuar.</p>}
      </Ov>
    ) : null

  const tabBtn = (t: Tab, icon: ReactNode, label: string) => (
    <button key={t} aria-label={label} title={label} onClick={() => setTab(t)} className={`${btn} ${tab === t ? 'ring-2 ring-fuchsia-400' : ''}`}>{icon}</button>
  )
  const row = 'flex items-center gap-2 rounded-xl bg-white/5 p-2'
  const toneDisabled = source === 'youtube' && extensionStatus !== 'ready'
  const toneControls = (tv = false) => {
    const control = `${btn} disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fuchsia-300 ${tv ? 'min-h-14 min-w-14 text-2xl' : ''}`
    return (
      <div role="group" aria-label="Controles de tom" className="flex flex-wrap items-center gap-2">
        <b className={tv ? 'mr-1 text-lg' : 'w-20'}>Tom</b>
        <button className={control} disabled={toneDisabled} onClick={() => setTone(t => Math.max(-12, t - 1))} aria-label="Diminuir um semitom" title="Diminuir um semitom">−</button>
        <output aria-label="Tom atual" aria-live="polite" className={`text-center font-bold text-fuchsia-300 ${tv ? 'w-14 text-3xl' : 'w-12 text-xl'}`}>{tone > 0 ? '+' : ''}{tone}</output>
        <button className={control} disabled={toneDisabled} onClick={() => setTone(t => Math.min(12, t + 1))} aria-label="Aumentar um semitom" title="Aumentar um semitom">+</button>
        <button className={control} disabled={toneDisabled} onClick={() => setTone(0)} aria-label="Restaurar tom original" title="Restaurar tom original">{tv ? <RotateCcw size={26} aria-hidden="true" /> : 'Restaurar'}</button>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#2b1163,#0a0720_65%)] text-white">
      {!party && (
        <header className="flex flex-wrap items-center gap-2 border-b border-fuchsia-500/20 p-3">
          <h1 className="bg-gradient-to-r from-violet-400 via-blue-400 to-fuchsia-500 bg-clip-text text-2xl font-extrabold text-transparent">Karaokê Play</h1>
          <input aria-label="Nome do cantor" value={singer} onChange={e => setSinger(e.target.value)} placeholder="Quem vai cantar?" maxLength={24}
            className="w-36 rounded-xl bg-white/10 px-3 py-3 outline-none ring-fuchsia-400 focus:ring-2" />
          <form className="flex min-w-[220px] flex-1 gap-2" onSubmit={e => { e.preventDefault(); void doSearch(q) }}>
            <input aria-label="Pesquisar música ou colar link" value={q} onChange={e => setQ(e.target.value)} placeholder="Música, artista ou link do YouTube"
              className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-3 outline-none ring-fuchsia-400 focus:ring-2" />
            <button className={primary} aria-label="Pesquisar"><Search size={20} /></button>
          </form>
          <button className={btn} aria-expanded={roomPanelOpen} onClick={() => setRoomPanelOpen(open => !open)}>QR Code</button>
          <input ref={fileIn} type="file" accept="video/mp4,audio/mpeg,video/*,audio/*" className="hidden" onChange={e => onFiles(e.target.files)} />
          <button className={btn} onClick={() => fileIn.current?.click()} aria-label="Adicionar MP4 local" title="MP4 local (com ajuste de tom)"><Upload size={20} /></button>
          <button className={btn} onClick={() => { setParty(true); document.documentElement.requestFullscreen?.().catch(() => {}) }} aria-label="Modo festa"><Tv size={20} /></button>
          <button className={btn} onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()} aria-label="Tela cheia"><Maximize size={20} /></button>
        </header>
      )}
      <main className={party ? 'mx-auto flex h-dvh max-w-[1920px] flex-col p-3 sm:p-4' : 'grid gap-4 p-3 lg:grid-cols-[1fr_380px]'}>
        <section className={party ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'min-w-0'}>
          <div aria-label="Área do vídeo" className={`relative overflow-hidden rounded-2xl bg-black shadow-[0_0_40px_#a21caf66] ring-1 ring-fuchsia-500/40 ${party ? 'min-h-[140px] flex-1' : 'aspect-video'}`}>
            <div className={`absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full ${source === 'youtube' ? '' : 'hidden'}`}><div id="yt" /></div>
            <video ref={vid} playsInline className={`absolute inset-0 h-full w-full bg-black ${source === 'youtube' ? 'hidden' : ''}`} />
            {!current && phase === 'IDLE' && <Ov><p className="text-2xl font-bold">Pesquise uma música, informe seu nome e cante.</p><p className="text-white/60">As notas são sorteadas só por diversão — não avaliam a voz.</p>{nextUp && <button className={primary} onClick={() => startRef.current()}>Iniciar karaokê</button>}</Ov>}
            {overlay}
            {party && roomPanelOpen && room && <RoomPanel room={room} onRoomChange={updateRoom} syncMessage={syncMessage} tv />}
          </div>
          <div className={`mt-3 shrink-0 ${party ? 'space-y-3' : 'flex flex-wrap items-center gap-3'}`}>
            <div className={party ? 'grid min-w-0 gap-3 md:grid-cols-2 md:gap-x-8' : 'min-w-0 flex-1'}>
              <div className="min-w-0" aria-label="Apresentação atual">
                <p title={current?.title} className={`truncate font-bold ${party ? 'text-2xl lg:text-3xl' : 'text-xl'}`}>{current?.title ?? 'Nenhuma música tocando'}</p>
                {current && <p title={`Cantor(a): ${current.singer}`} className={`truncate font-semibold text-white ${party ? 'mt-1 text-xl lg:text-2xl' : 'text-lg'}`}>Cantor(a): {current.singer}</p>}
              </div>
              {party ? (
                <div className="min-w-0 space-y-1 text-lg lg:text-xl" aria-label="Próxima apresentação">
                  {nextUp ? <>
                    <p title={`Próximo cantor: ${nextUp.singer}`} className="truncate font-semibold text-violet-100">Próximo cantor: {nextUp.singer}</p>
                    <p title={`Próxima música: ${nextUp.title}`} className="truncate text-white"><span className="text-violet-200">Próxima música:</span> {nextUp.title}</p>
                  </> : <p className="text-violet-100">Fila vazia</p>}
                  <p className="text-sm text-violet-200">{queue.length} na fila</p>
                </div>
              ) : <p className="truncate text-sm text-violet-300">{nextUp ? `Próxima: ${nextUp.singer} — ${nextUp.title}` : 'Fila vazia'} · {queue.length} na fila</p>}
            </div>
            <div className={`flex flex-wrap items-center gap-3 ${party ? '[&>button]:min-h-14 [&>button]:min-w-14 [&>button]:text-xl' : ''}`}>
              {party && current && toneControls(true)}
              {(phase === 'PLAYING' || phase === 'PAUSED') && <button className={btn} aria-label={phase === 'PLAYING' ? 'Pausar' : 'Continuar'} title={phase === 'PLAYING' ? 'Pausar' : 'Continuar'} onClick={() => phase === 'PLAYING' ? player.current?.pause() : player.current?.play()}>{phase === 'PLAYING' ? <Pause /> : <Play />}</button>}
              {(phase === 'LOADING' || phase === 'PLAYING' || phase === 'PAUSED') && <button className={btn} aria-label="Pular música" title="Pular música" onClick={skip}><SkipForward /></button>}
              {party && <button className={btn} onClick={() => setParty(false)} aria-label="Sair do modo festa" title="Sair do modo TV"><X /></button>}
            </div>
            {!party && roomPanelOpen &&
              <RoomPanel room={room} onRoomChange={updateRoom} syncMessage={syncMessage} />}
            {party && current && toneDisabled && <p role="status" className="text-sm text-amber-200">Tom indisponível: conecte e autorize a extensão KP Tom.</p>}
          </div>
          {!party && current && (
            <div className="mt-3 space-y-2 rounded-xl bg-white/5 p-3 text-sm">
              {toneControls()}
              {source === 'youtube' && (
                <div className="space-y-1 text-white/70">
                  <p>KP Tom: {extensionStatus === 'ready' ? 'conectada' : extensionStatus === 'denied' ? 'site não autorizado nas opções da extensão' : extensionStatus === 'detecting' ? 'procurando extensão…' : 'não detectada (tom indisponível)'}</p>
                  {extensionStatus !== 'ready' && <button className={btn} onClick={() => void bridge.current?.detect()}>Verificar extensão</button>}
                  {(extensionStatus === 'absent' || extensionStatus === 'denied') && <p>Sem a KP Tom, o tom no YouTube só muda pelo Transpose (controles da própria extensão) ou no modo MP4 local.</p>}
                  {extensionStatus === 'ready' && extensionMessage && <p className="text-amber-300">{extensionMessage}</p>}
                  {extensionStatus === 'ready' && extState?.needsActivation && <p className="text-amber-300">O áudio do player precisa de ativação: clique uma vez no vídeo para o tom valer.</p>}
                  {extensionStatus === 'ready' && extState?.lastError && <p className="text-amber-300">Extensão: {extState.lastError}</p>}
                  <details onToggle={e => { diagOpen.current = (e.currentTarget as HTMLDetailsElement).open }}>
                    <summary className="cursor-pointer">Diagnóstico da extensão</summary>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs">{extState ? [
                      `status: ${extensionStatus} · versão ${extState.version}`,
                      `origem do site: ${extState.parentOrigin ?? 'n/d'} (${extState.allowed ? 'autorizada' : 'NÃO autorizada'})`,
                      `áudio: ${extState.context ? `${extState.context.state} · ${extState.context.sampleRate} Hz · base ${extState.context.baseLatencyMs} ms` : 'sem contexto'}`,
                      `grafo: ${extState.graph} · worklet: ${extState.worklet}`,
                      `tom pedido: ${extState.semitones} · medido: ${extState.measured ? `${extState.measured.semitones} (r=${extState.measured.corr})` : 'n/d'}`,
                      `latência do processador: ${extState.processorLatencyMs ?? 'n/d'} ms · anúncio: ${extState.adShowing ? 'sim' : 'não'}`,
                    ].join('\n') : 'Sem dados (extensão não conectada ou painel recém-aberto).'}</pre>
                  </details>
                </div>
              )}
              <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={keep} onChange={e => setKeep(e.target.checked)} />Manter tom na próxima música</label>
            </div>
          )}
          {!party && note && phase !== 'ERROR' && <p role="status" className="mt-2 rounded-lg bg-fuchsia-500/10 p-2 text-sm">{note}</p>}
          {!party && (
            <div className="mt-4 space-y-3">
              <div role="group" aria-label="Listas de músicas" className="flex flex-wrap gap-2">
                {musicViews.map(({ value, label }) => (
                  <button key={value} type="button" aria-pressed={musicView === value} onClick={() => setMusicView(value)}
                    className={`${btn} aria-pressed:bg-violet-700`}>{label}</button>
                ))}
              </div>
              {musicView === 'search' && (
                <div role="group" aria-label="Pesquisar por estilo" className="flex flex-wrap gap-2">
                  {genres.map(genre => (
                    <button key={genre} type="button" className="rounded-full bg-white/10 px-3 py-2 text-sm hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-fuchsia-400"
                      onClick={() => void doSearch(genre)}>{genre}</button>
                  ))}
                </div>
              )}
              {musicView === 'favorites' && !favorites.length && <p className="text-sm text-white/60">Toque no coração de uma música para guardá-la aqui.</p>}
              {musicView === 'mostSung' && !mostSung.length && <p className="text-sm text-white/60">As músicas do YouTube aparecem aqui após a primeira apresentação concluída.</p>}
            </div>
          )}
          {!party && visibleSongs.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {visibleSongs.map(r => {
                const favorite = favorites.some(item => item.videoId === r.videoId)
                const count = playCounts.get(r.videoId)
                return (
                  <div key={r.videoId} className={`${row} flex-wrap`}>
                    <img src={r.thumb} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
                    <div className="min-w-[7rem] flex-1">
                      <p className="line-clamp-2 text-sm font-semibold">{r.title}</p>
                      <p className="truncate text-xs text-white/60">{r.channel}</p>
                      {musicView === 'mostSung' && <p className="text-xs text-violet-200">{count} {count === 1 ? 'apresentação' : 'apresentações'}</p>}
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      <button type="button" className="rounded-xl bg-white/10 p-3 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-fuchsia-400"
                        aria-pressed={favorite} aria-label={`Favoritar: ${r.title}`} onClick={() => toggleFavorite(r)}>
                        <Heart size={16} className={favorite ? 'fill-fuchsia-400 text-fuchsia-400' : ''} />
                      </button>
                      <button className={`${primary} flex items-center gap-1 px-3 py-2 text-sm`} onClick={() => setPending({ result: r })} aria-label={`Quero essa: ${r.title}`}><Mic size={16} />Quero essa</button>
                    </div>
                  </div>
                )
              })}
              {musicView === 'search' && more && <button className={btn} disabled={busy} onClick={() => void doSearch(q, more)}>{busy ? 'Carregando…' : 'Mais resultados'}</button>}
            </div>
          )}
          {!party && musicView === 'search' && busy && !results.length && <p className="mt-4 text-white/60">Pesquisando…</p>}
          {!party && musicView === 'search' && empty && !busy && <p className="mt-4 text-white/60">Nenhum resultado. Tente outro nome ou cole o link do vídeo.</p>}
        </section>

        {!party && (
          <aside className="space-y-3">
            <nav className="flex gap-2">
              {tabBtn('queue', <ListMusic size={20} />, 'Fila')}{tabBtn('rank', <Trophy size={20} />, 'Ranking')}{tabBtn('hist', <History size={20} />, 'Histórico')}
              {tabBtn('cfg', <Cog size={20} />, 'Configurações')}{tabBtn('help', <HelpCircle size={20} />, 'Ajuda KP Tom')}
            </nav>
            {tab === 'queue' && (
              <div className="space-y-2">
                {!queue.length && <p className="text-white/60">Fila vazia. Pesquise uma música para começar.</p>}
                {queue.map((s, i) => (
                  <div key={s.id} className={row}>
                    <img src={s.thumb} alt="" className="h-12 w-20 rounded object-cover" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{i + 1}. {s.title}</p><p className="truncate text-xs text-violet-300">{s.singer}</p></div>
                    {current && <button aria-label="Tocar agora" title="Tocar agora" className="p-1" onClick={() => playNow(i)}><Play size={18} /></button>}
                    <button aria-label="Subir" className="p-1" onClick={() => move(i, -1)}><ArrowUp size={18} /></button>
                    <button aria-label="Descer" className="p-1" onClick={() => move(i, 1)}><ArrowDown size={18} /></button>
                    <button aria-label="Remover" className="p-1" onClick={() => setQueue(x => x.filter(k => k.id !== s.id))}><Trash2 size={18} /></button>
                  </div>
                ))}
                {queue.length > 0 && <button className={btn} onClick={() => confirm('Limpar toda a fila?') && setQueue([])}>Limpar fila</button>}
              </div>
            )}
            {tab === 'rank' && (
              <div className="space-y-2">
                {!rank.length && <p className="text-white/60">O ranking aparece após a primeira nota.</p>}
                {rank.map((r, i) => (
                  <div key={r.n} className={`${row} ${i < 3 ? 'ring-1 ring-fuchsia-400/60' : ''}`}>
                    <span className="w-8 text-center text-xl">{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
                    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.n}</p><p className="text-xs text-white/60">{r.c} apresentação(ões) · média {r.avg.toFixed(1)}</p></div>
                    <b className="text-xl text-fuchsia-300">{r.best}</b>
                  </div>
                ))}
              </div>
            )}
            {tab === 'hist' && (
              <div className="space-y-2">
                {!history.length && <p className="text-white/60">Nenhuma apresentação ainda.</p>}
                {history.map(h => (
                  <div key={h.id} className={row}>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{h.singer}: {h.title}</p><p className="text-xs text-white/60">{new Date(h.at).toLocaleTimeString('pt-BR')} · nota {h.score ?? '—'}</p></div>
                    <button aria-label="Adicionar de novo" className="p-1" onClick={() => setPending({ result: h })}><Plus size={18} /></button>
                  </div>
                ))}
              </div>
            )}
            {tab === 'cfg' && (
              <div className="space-y-3 text-sm">
                <label className="flex items-center justify-between">Tempo entre músicas
                  <select className="rounded bg-white/10 p-2" value={settings.countdown} onChange={e => set('countdown', +e.target.value)}>{[5, 10, 15].map(n => <option key={n} value={n} className="text-black">{n} s</option>)}</select></label>
                <label className="flex items-center justify-between">Nota mínima
                  <input type="number" min={0} max={settings.max} value={settings.min} onChange={e => set('min', Math.max(0, Math.min(+e.target.value || 0, settings.max)))} className="w-20 rounded bg-white/10 p-2" /></label>
                <label className="flex items-center justify-between">Nota máxima
                  <input type="number" min={settings.min} max={100} value={settings.max} onChange={e => set('max', Math.min(100, Math.max(+e.target.value || 0, settings.min)))} className="w-20 rounded bg-white/10 p-2" /></label>
                {([['scoring', 'Pontuação'], ['autoplay', 'Reprodução automática da fila'], ['anim', 'Animações'], ['cheer', 'Mensagens comemorativas']] as const).map(([k, l]) => (
                  <label key={k} className="flex items-center justify-between">{l}<input type="checkbox" className="h-5 w-5" checked={settings[k]} onChange={e => set(k, e.target.checked)} /></label>
                ))}
                <button className={btn} onClick={() => confirm('Limpar histórico e ranking?') && setHistory([])}>Limpar histórico</button>{' '}
                <button className={btn} onClick={resetSession}>Reiniciar sessão</button>
              </div>
            )}
            {tab === 'help' && (
              <div className="space-y-2 text-sm text-white/80">
                <p>O modo YouTube pode usar a extensão experimental <b>KP Tom</b> para controlar a tonalidade diretamente pelos botões do Karaokê Play.</p>
                <p>Nas opções da extensão, autorize a origem exata deste site e recarregue a página. O modo MP4 continua com SoundTouch integrado, sem extensão.</p>
                <p>Este é um teste experimental para o navegador Chrome em computador.</p>
                <p>Sem a KP Tom, use a extensão Transpose (controles dela na própria página) ou o modo MP4 local.</p>
              </div>
            )}
          </aside>
        )}
      </main>
      {pending && <SingerModal title={pending.result.title} thumb={pending.result.thumb} suggestions={singers} onConfirm={confirmSinger} onCancel={cancelPending} />}
    </div>
  )
}
