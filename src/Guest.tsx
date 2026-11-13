import { useEffect, useRef, useState } from 'react'
import { Mic, Search } from 'lucide-react'
import { buildTerm, genres, load, mergeResults, oembed, save, searchYT, videoIdFrom, type Result } from './lib'
import { RoomError, roomRequest } from './room'

const inputStyle = 'min-w-0 rounded-xl bg-white/10 px-4 py-3 focus:outline-2 focus:outline-fuchsia-400'
const actionStyle = 'rounded-xl bg-violet-700 px-4 py-3 font-semibold hover:bg-violet-600 disabled:opacity-50'

export default function Guest({ room }: { room: string }) {
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('Conectando à sala…')
  const [name, setName] = useState<string>(() => load('kp:guest-name', ''))
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [next, setNext] = useState<string>()
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Result | null>(null)
  const [sending, setSending] = useState(false)
  const term = useRef('')
  const searchId = useRef(0)
  const requestId = useRef('')
  const orderForm = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    roomRequest('status', { room }, controller.signal).then(() => {
      setReady(true)
      setStatus('')
    }).catch(error => {
      if (!controller.signal.aborted) setStatus(error.message)
    })
    return () => controller.abort()
  }, [room])

  useEffect(() => {
    if (selected) orderForm.current?.scrollIntoView?.({ block: 'nearest' })
  }, [selected])

  async function search(raw: string, page?: string) {
    if (!raw.trim() && !page) return
    const id = page ? null : videoIdFrom(raw)
    const built = buildTerm(raw, true)
    if (!page && !id && 'tooLong' in built) {
      setStatus(`Digite até ${built.max} caracteres para pesquisar.`)
      return
    }
    const current = ++searchId.current
    const queryTerm = page ? term.current : 'term' in built ? built.term : ''
    setSearching(true)
    setStatus('')
    if (!page) { setResults([]); setNext(undefined) }
    try {
      const reply = id ? { items: [await oembed(id)], next: undefined } : await searchYT(queryTerm, page)
      if (current !== searchId.current) return
      term.current = queryTerm
      setResults(previous => mergeResults(page ? previous : [], reply.items))
      setNext(reply.next)
      if (!page && !reply.items.length) setStatus('Nenhuma música encontrada.')
    } catch (error) {
      if (current === searchId.current) setStatus((error as Error).message)
    } finally {
      if (current === searchId.current) setSearching(false)
    }
  }

  async function submit() {
    if (!selected || !name.trim() || sending) return
    setSending(true)
    setStatus('')
    try {
      await roomRequest('submit', { room, requestId: requestId.current, song: { ...selected, singer: name.trim() } })
      save('kp:guest-name', name.trim())
      setStatus(`“${selected.title}” entrou na fila para ${name.trim()}.`)
      setSelected(null)
    } catch (error) {
      setStatus((error as Error).message)
      if (error instanceof RoomError && error.code === 'closed') setReady(false)
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#2b1163,#0a0720_65%)] px-4 py-6 text-white">
      <div className="mx-auto max-w-xl space-y-4">
        <p className="font-bold text-violet-300">Karaokê Play</p>
        <h1 className="text-3xl font-extrabold">Escolha sua música</h1>
        {ready && <>
          <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void search(query) }}>
            <input className={`${inputStyle} flex-1`} aria-label="Pesquisar música ou colar link" placeholder="Música, artista ou link" value={query} onChange={event => setQuery(event.target.value)} />
            <button className={actionStyle} aria-label="Pesquisar"><Search size={20} /></button>
          </form>
          <div role="group" aria-label="Pesquisar por estilo" className="flex flex-wrap gap-2">
            {genres.map(genre => <button key={genre} type="button" className="rounded-full bg-white/10 px-3 py-2 text-sm hover:bg-white/20" onClick={() => void search(genre)}>{genre}</button>)}
          </div>
          {selected && (
            <form ref={orderForm} className="space-y-3 rounded-2xl border border-violet-500/60 bg-[#1b1040] p-4" onSubmit={event => { event.preventDefault(); void submit() }}>
              <p className="font-semibold">{selected.title}</p>
              <label className="block">
                <span className="text-sm text-violet-100">Quem vai cantar?</span>
                <input className={`${inputStyle} mt-1 w-full`} placeholder="Nome ou apelido" value={name} onChange={event => setName(event.target.value)} required maxLength={24} disabled={sending} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className={actionStyle} disabled={sending || !name.trim()}>{sending ? 'Enviando…' : 'Adicionar à fila'}</button>
                <button type="button" className="rounded-xl bg-white/10 px-4 py-3" disabled={sending} onClick={() => setSelected(null)}>Cancelar</button>
              </div>
            </form>
          )}
        </>}
        {status && <p role="status" className="rounded-xl bg-white/10 p-3">{status}</p>}
        {ready && <>
          {searching && <p role="status">Pesquisando…</p>}
          <div className="space-y-2">
            {results.map(song => (
              <button key={song.videoId} type="button" disabled={sending} className="flex w-full items-center gap-3 rounded-xl bg-white/10 p-2 text-left hover:bg-white/20" onClick={() => { setSelected(song); setStatus(''); requestId.current = crypto.randomUUID() }}>
                <img src={song.thumb} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
                <span className="min-w-0 flex-1"><span className="line-clamp-2 font-semibold">{song.title}</span><span className="block truncate text-xs text-violet-200">{song.channel}</span></span>
                <Mic size={20} aria-hidden="true" />
              </button>
            ))}
          </div>
          {next && <button className={actionStyle} type="button" disabled={searching} onClick={() => void search(query, next)}>Mais resultados</button>}
        </>}
      </div>
    </main>
  )
}
