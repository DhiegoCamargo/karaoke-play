import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Search, Play, Pause, SkipForward, Trash2, ArrowUp, ArrowDown, Maximize, Plus, Trophy, ListMusic, Settings as Cog, HelpCircle, History, Tv, X, Upload } from 'lucide-react'
import { type Song, type Settings, type HistoryItem, type Result, DEFAULTS, load, save, rollScore, videoIdFrom, searchYT, oembed } from './lib'
import { YouTubePlayback, LocalPlayback, type Playback, type Events } from './playback'
import { KpTomBridge, type KpTomStatus } from './kpTomBridge'

type Phase = 'IDLE' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'SCORING' | 'COUNTDOWN' | 'AUTOPLAY_BLOCKED' | 'ERROR'
type Tab = 'queue' | 'rank' | 'hist' | 'cfg' | 'help'
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

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULTS, ...load('kp:settings', {}) }))
  const [queue, setQueue] = useState<Song[]>(() => load('kp:queue', []))
  const [history, setHistory] = useState<HistoryItem[]>(() => load('kp:history', []))
  const [singer, setSinger] = useState<string>(() => load('kp:singer', ''))
  const [current, setCurrent] = useState<Song | null>(null)
  const [phase, setPhase] = useState<Phase>('IDLE')
  const [score, setScore] = useState<number | null>(null)
  const [left, setLeft] = useState(0)
  const [paused, setPaused] = useState(false)
  const [tab, setTab] = useState<Tab>('queue')
  const [q, setQ] = useState('')
  const [karaoke, setKaraoke] = useState(true)
  const [results, setResults] = useState<Result[]>([])
  const [more, setMore] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [party, setParty] = useState(false)

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
  const [tone, setTone] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [keep, setKeep] = useState(false)
  const scored = useRef('')
  const tok = useRef(0)
  const phaseRef = useRef(phase); phaseRef.current = phase
  const queueRef = useRef(queue); queueRef.current = queue
  const setRef = useRef(settings); setRef.current = settings
  const toneRef = useRef(0)
  const sourceRef = useRef(source); sourceRef.current = source
  const finishRef = useRef(() => {})
  const startRef = useRef(() => {})

  useEffect(() => save('kp:settings', settings), [settings])
  useEffect(() => save('kp:queue', queue), [queue])
  useEffect(() => save('kp:history', history), [history])
  useEffect(() => save('kp:singer', singer), [singer])

  useEffect(() => {
    if (yt.current || !vid.current) return // adaptadores criados uma única vez (também no StrictMode)
    const ev: Events = {
      ended: () => finishRef.current(),
      playing: () => setPhase('PLAYING'),
      paused: () => { if (phaseRef.current === 'PLAYING') setPhase('PAUSED') },
      error: m => { setNote(m); setPhase('ERROR') },
      blocked: () => setPhase('AUTOPLAY_BLOCKED'),
    }
    const ext = new KpTomBridge()
    bridge.current = ext
    ext.subscribe((status, _state, info) => { setExtensionStatus(status); if (info) setExtensionMessage(info) })
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
  useEffect(() => {
    toneRef.current = tone
    player.current?.setPitch(tone)
    player.current?.setRate(speed)
    if (source === 'youtube' && current) void bridge.current?.setPitch(tone)
  }, [tone, speed, source, current?.id])
  // libera os File que não estão mais na fila nem tocando
  useEffect(() => {
    const live = new Set<string>(queue.map(q => q.id))
    if (current && ['LOADING', 'PLAYING', 'PAUSED', 'AUTOPLAY_BLOCKED'].includes(phase)) live.add(current.id)
    files.current.forEach((_, id) => { if (!live.has(id)) files.current.delete(id) })
  }, [queue, current, phase])

  const play = (s: Song) => {
    const kind = s.source ?? 'youtube'
    const pb = kind === 'youtube' ? yt.current : local.current
    if (!pb?.ready()) { setNote('Player ainda carregando. Tente de novo em instantes.'); setQueue(x => [s, ...x]); return }
    const my = ++tok.current
    ;(pb === yt.current ? local.current : yt.current)?.stop()
    player.current = pb
    setSource(kind); setCurrent(s); setScore(null); setNote(''); setPhase('LOADING')
    if (!keep) { setTone(0); setSpeed(1) }
    pb.load(s, kind === 'file' ? files.current.get(s.id) : s.url)
    setTimeout(() => { if (tok.current === my && phaseRef.current === 'LOADING') setPhase('AUTOPLAY_BLOCKED') }, 6000)
  }
  startRef.current = () => {
    const [n, ...rest] = queueRef.current
    if (!n) { setCurrent(null); setPhase('IDLE'); return }
    setQueue(rest); play(n)
  }
  finishRef.current = () => {
    if (!current || scored.current === current.id) return // evita pontuação duplicada
    scored.current = current.id
    player.current?.stop() // interrompe a mídia antes da nota (vale também para o encerramento manual); eventos do adaptador passam a ser ignorados
    const s = setRef.current
    const sc = s.scoring ? rollScore(s.min, s.max) : null
    setScore(sc)
    setHistory(h => [{ ...current, score: sc, at: Date.now() }, ...h].slice(0, 200))
    setPhase('SCORING')
  }

  // SCORING -> COUNTDOWN (tempo mínimo de leitura da nota)
  useEffect(() => {
    if (phase !== 'SCORING') return
    const t = setTimeout(() => {
      if (queueRef.current.length && setRef.current.autoplay) { setLeft(setRef.current.countdown); setPaused(false); setPhase('COUNTDOWN') }
      else setPhase('IDLE')
    }, SCORE_READ_MS)
    return () => clearTimeout(t)
  }, [phase])
  // COUNTDOWN: um único timer por vez
  useEffect(() => {
    if (phase !== 'COUNTDOWN' || paused) return
    if (left <= 0) { startRef.current(); return }
    const t = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, paused, left])

  const doSearch = async (next?: string) => {
    if (!q.trim()) return
    setBusy(true); setNote('')
    try {
      const id = videoIdFrom(q)
      if (id) { setResults([await oembed(id)]); setMore(undefined) }
      else {
        const term = karaoke && !/karaok/i.test(q) ? `${q} karaokê` : q
        const r = await searchYT(term, next)
        setResults(next ? [...results, ...r.items] : r.items); setMore(r.next)
      }
    } catch (e: any) { setNote(e.message) } finally { setBusy(false) }
  }
  const add = (r: Result & { source?: Song['source']; fileName?: string }, file?: File) => {
    const name = singer.trim()
    if (!name) { setNote('Digite o nome de quem vai cantar (campo no topo).'); return }
    if (r.source === 'file' && !file) { setNote('Para repetir um arquivo local, selecione-o de novo em "MP4 local".'); return }
    if ([...queue, ...(current ? [current] : [])].some(s => s.videoId === r.videoId && s.singer === name)) { setNote('Essa música já está na fila para este cantor.'); return }
    const s: Song = { ...r, id: crypto.randomUUID(), singer: name }
    if (file) files.current.set(s.id, file)
    const pb = (s.source ?? 'youtube') === 'youtube' ? yt.current : local.current
    if (phase === 'IDLE' && !current && pb?.ready()) play(s)
    else setQueue(x => [...x, s])
    setNote(`"${r.title}" adicionada para ${name}.`)
  }
  const onFiles = (list: FileList | null) => { // um arquivo por vez (evita estado defasado entre adições)
    const f = list?.[0]
    if (f) add({ videoId: `file:${f.name}:${f.size}`, title: f.name.replace(/\.[^.]+$/, ''), channel: 'Arquivo local', thumb: LOCAL_THUMB, source: 'file', fileName: f.name }, f)
    if (fileIn.current) fileIn.current.value = ''
  }
  const move = (i: number, d: number) => setQueue(x => { const a = [...x], j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return a })
  const playNow = (i: number) => { const s = queue[i]; setQueue(x => x.filter((_, k) => k !== i)); play(s) }
  const resetSession = () => {
    if (!confirm('Reiniciar sessão? Fila, ranking e histórico serão apagados.')) return
    tok.current++; yt.current?.stop(); local.current?.stop()
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
  const nextUp = queue[0]

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
          <button className={primary} onClick={() => setLeft(0)}>Pular contagem</button>
          <button className={btn} onClick={() => { setPaused(true); setParty(false); setTab('queue') }}>Voltar à fila</button>
          <button className={btn} onClick={() => setPhase('IDLE')}>Cancelar</button>
        </div>
      </Ov>
    ) : phase === 'AUTOPLAY_BLOCKED' ? (
      <Ov><p className="text-xl">O navegador bloqueou o início automático.</p><button className={primary} onClick={() => player.current?.play()}>▶ Iniciar música</button></Ov>
    ) : phase === 'ERROR' ? (
      <Ov><p className="text-lg text-red-300">{note || 'Erro no player.'}</p>{nextUp ? <button className={primary} onClick={() => startRef.current()}>Pular para a próxima</button> : <p className="text-white/60">Escolha outra música.</p>}</Ov>
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

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#2b1163,#0a0720_65%)] text-white">
      {!party && (
        <header className="flex flex-wrap items-center gap-2 border-b border-fuchsia-500/20 p-3">
          <h1 className="bg-gradient-to-r from-violet-400 via-blue-400 to-fuchsia-500 bg-clip-text text-2xl font-extrabold text-transparent">Karaokê Play</h1>
          <input aria-label="Nome do cantor" value={singer} onChange={e => setSinger(e.target.value)} placeholder="Quem vai cantar?" maxLength={24}
            className="w-36 rounded-xl bg-white/10 px-3 py-3 outline-none ring-fuchsia-400 focus:ring-2" />
          <form className="flex min-w-[220px] flex-1 gap-2" onSubmit={e => { e.preventDefault(); doSearch() }}>
            <input aria-label="Pesquisar música ou colar link" value={q} onChange={e => setQ(e.target.value)} placeholder="Música, artista ou link do YouTube"
              className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-3 outline-none ring-fuchsia-400 focus:ring-2" />
            <button className={primary} aria-label="Pesquisar"><Search size={20} /></button>
          </form>
          <input ref={fileIn} type="file" accept="video/mp4,audio/mpeg,video/*,audio/*" className="hidden" onChange={e => onFiles(e.target.files)} />
          <button className={btn} onClick={() => fileIn.current?.click()} aria-label="Adicionar MP4 local" title="MP4 local (com tom e velocidade)"><Upload size={20} /></button>
          <button className={btn} onClick={() => { setParty(true); document.documentElement.requestFullscreen?.().catch(() => {}) }} aria-label="Modo festa"><Tv size={20} /></button>
          <button className={btn} onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()} aria-label="Tela cheia"><Maximize size={20} /></button>
        </header>
      )}
      <main className={party ? 'mx-auto max-w-[1600px] p-4' : 'grid gap-4 p-3 lg:grid-cols-[1fr_380px]'}>
        <section className="min-w-0">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-[0_0_40px_#a21caf66] ring-1 ring-fuchsia-500/40">
            <div className={`absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full ${source === 'youtube' ? '' : 'hidden'}`}><div id="yt" /></div>
            <video ref={vid} playsInline className={`absolute inset-0 h-full w-full bg-black ${source === 'youtube' ? 'hidden' : ''}`} />
            {!current && phase === 'IDLE' && <Ov><p className="text-2xl font-bold">Pesquise uma música, informe seu nome e cante.</p><p className="text-white/60">As notas são sorteadas só por diversão — não avaliam a voz.</p></Ov>}
            {overlay}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className={`truncate font-bold ${party ? 'text-3xl' : 'text-xl'}`}>{current?.title ?? 'Nenhuma música tocando'}</p>
              <p className="truncate text-white/70">{current ? `Cantor(a): ${current.singer}` : ''}</p>
              <p className="truncate text-sm text-violet-300">{nextUp ? `Próxima: ${nextUp.singer} — ${nextUp.title}` : 'Fila vazia'} · {queue.length} na fila</p>
            </div>
            {current && <button className={btn} aria-label={phase === 'PLAYING' ? 'Pausar' : 'Continuar'} onClick={() => phase === 'PLAYING' ? player.current?.pause() : player.current?.play()}>{phase === 'PLAYING' ? <Pause /> : <Play />}</button>}
            {current && (phase === 'PLAYING' || phase === 'PAUSED') && <button className={btn} aria-label="Encerrar música" onClick={() => finishRef.current()}><SkipForward /></button>}
            {party && <button className={btn} onClick={() => setParty(false)} aria-label="Sair do modo festa"><X /></button>}
          </div>
          {!party && current && (
            <div className="mt-3 space-y-2 rounded-xl bg-white/5 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2"><b className="w-20">Tom</b>
                <button className={btn} disabled={source === 'youtube' && extensionStatus !== 'ready'} onClick={() => setTone(t => Math.max(-12, t - 1))} aria-label="Diminuir um semitom">−</button>
                <span className="w-12 text-center text-xl font-bold text-fuchsia-300">{tone > 0 ? '+' : ''}{tone}</span>
                <button className={btn} disabled={source === 'youtube' && extensionStatus !== 'ready'} onClick={() => setTone(t => Math.min(12, t + 1))} aria-label="Aumentar um semitom">+</button>
                <button className={btn} disabled={source === 'youtube' && extensionStatus !== 'ready'} onClick={() => setTone(0)}>Restaurar</button></div>
              {source === 'youtube' && (
                <div className="space-y-1 text-white/70">
                  <p>KP Tom: {extensionStatus === 'ready' ? 'conectada' : extensionStatus === 'denied' ? 'site não autorizado nas opções da extensão' : extensionStatus === 'detecting' ? 'procurando extensão…' : 'não detectada (tom indisponível)'}</p>
                  {extensionStatus !== 'ready' && <button className={btn} onClick={() => void bridge.current?.detect()}>Verificar extensão</button>}
                  {extensionStatus === 'error' && extensionMessage && <p className="text-amber-300">{extensionMessage}</p>}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2"><b className="w-20">Velocidade</b>
                <input type="range" min={0.5} max={1.5} step={0.05} value={speed} onChange={e => setSpeed(+e.target.value)} className="min-w-0 flex-1" aria-label="Velocidade" />
                <span className="w-14 text-center">{speed.toFixed(2)}×</span>
                <button className={btn} onClick={() => setSpeed(1)}>Restaurar</button></div>
              {source === 'youtube' && <p className="text-white/60">No YouTube vale o valor permitido mais próximo.</p>}
              <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={keep} onChange={e => setKeep(e.target.checked)} />Manter tom e velocidade na próxima música</label>
            </div>
          )}
          {!party && note && phase !== 'ERROR' && <p role="status" className="mt-2 rounded-lg bg-fuchsia-500/10 p-2 text-sm">{note}</p>}
          {!party && results.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {results.map(r => (
                <div key={r.videoId} className={row}>
                  <img src={r.thumb} alt="" className="h-14 w-24 rounded object-cover" />
                  <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold">{r.title}</p><p className="truncate text-xs text-white/60">{r.channel}</p></div>
                  <button className={primary} onClick={() => add(r)} aria-label="Adicionar à fila"><Plus size={18} /></button>
                </div>
              ))}
              {more && <button className={btn} disabled={busy} onClick={() => doSearch(more)}>{busy ? 'Carregando…' : 'Mais resultados'}</button>}
            </div>
          )}
          {!party && busy && !results.length && <p className="mt-4 text-white/60">Pesquisando…</p>}
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
                    <button aria-label="Tocar agora" title="Tocar agora" className="p-1" onClick={() => playNow(i)}><Play size={18} /></button>
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
                    <button aria-label="Adicionar de novo" className="p-1" onClick={() => add(h)}><Plus size={18} /></button>
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
              </div>
            )}
          </aside>
        )}
      </main>
    </div>
  )
}
