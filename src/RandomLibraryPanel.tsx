import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Music2, Play, Square } from 'lucide-react'
import { load, save } from './lib'
import { RANDOM_LIBRARY, RANDOM_LIBRARY_KEY, normalizeRandomLibraryState, type RandomLibraryState } from './randomLibrary'

export default function RandomLibraryPanel({ active, busy, onStart, onStop }: {
  active: boolean
  busy: boolean
  onStart: () => void
  onStop: () => void
}) {
  const [state, setState] = useState<RandomLibraryState>(() =>
    normalizeRandomLibraryState(load<RandomLibraryState | null>(RANDOM_LIBRARY_KEY, null)),
  )
  const [open, setOpen] = useState<string | null>(RANDOM_LIBRARY[0]?.id ?? null)

  const update = (next: RandomLibraryState) => {
    setState(next)
    save(RANDOM_LIBRARY_KEY, next)
  }

  const selected = useMemo(() => RANDOM_LIBRARY.reduce((total, genre) => {
    const cfg = state.genres[genre.id]
    if (!cfg?.enabled) return total
    return total + genre.songs.filter(item => cfg.songs[item.id] !== false).length
  }, 0), [state])

  const toggleGenre = (genreId: string, enabled: boolean) => {
    update({
      genres: {
        ...state.genres,
        [genreId]: { ...state.genres[genreId], enabled },
      },
    })
  }

  const toggleSong = (genreId: string, songId: string, enabled: boolean) => {
    update({
      genres: {
        ...state.genres,
        [genreId]: {
          ...state.genres[genreId],
          songs: { ...state.genres[genreId].songs, [songId]: enabled },
        },
      },
    })
  }

  return (
    <div className="kp-random-library space-y-3">
      <div className="rounded-xl border border-violet-400/20 bg-violet-500/5 p-3">
        <div className="flex items-center gap-2">
          <Music2 size={18} className="text-violet-300" />
          <div>
            <p className="font-bold">Biblioteca do Modo Aleatório</p>
            <p className="text-xs text-white/60">{selected} músicas ativas em {RANDOM_LIBRARY.filter(g => state.genres[g.id]?.enabled).length} gêneros.</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-white/55">Quando ativo e a fila estiver vazia, o Karaokê Play sorteia músicas desta seleção. Pedidos reais sempre têm prioridade.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {active ? (
            <button type="button" onClick={onStop} className="kp-button inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 font-semibold">
              <Square size={16} /> Encerrar modo aleatório
            </button>
          ) : (
            <button type="button" onClick={onStart} disabled={selected === 0 || busy} className="kp-primary inline-flex items-center gap-2 rounded-xl px-4 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-40">
              <Play size={16} /> {busy ? 'Preparando…' : 'Iniciar modo aleatório'}
            </button>
          )}
          {active && <span className="self-center text-xs font-semibold text-emerald-300">● Modo aleatório ativo</span>}
        </div>
      </div>

      {RANDOM_LIBRARY.map(genre => {
        const cfg = state.genres[genre.id]
        const activeCount = genre.songs.filter(item => cfg?.songs[item.id] !== false).length
        const expanded = open === genre.id
        return (
          <section key={genre.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[.035]">
            <div className="flex items-center gap-2 p-2.5">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(expanded ? null : genre.id)}>
                {expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                <span className="min-w-0 flex-1 truncate font-semibold">{genre.name}</span>
                <span className="text-xs text-white/50">{activeCount}/10</span>
              </button>
              <label className="flex items-center gap-2 text-xs text-white/65">
                Ativo
                <input type="checkbox" className="h-4 w-4" checked={cfg?.enabled !== false} onChange={e => toggleGenre(genre.id, e.target.checked)} />
              </label>
            </div>

            {expanded && (
              <div className="border-t border-white/8 p-2">
                {genre.songs.map((item, index) => (
                  <label key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
                    <span className="w-5 text-right text-xs text-white/35">{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="block truncate text-xs text-white/50">{item.artist}</span>
                    </span>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      disabled={cfg?.enabled === false}
                      checked={cfg?.songs[item.id] !== false}
                      onChange={e => toggleSong(genre.id, item.id, e.target.checked)}
                    />
                  </label>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
