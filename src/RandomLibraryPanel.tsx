import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Music2 } from 'lucide-react'
import { load, save } from './lib'
import { RANDOM_LIBRARY, defaultRandomLibraryState, type RandomLibraryState } from './randomLibrary'

const KEY = 'kp:random-library-v1'

export default function RandomLibraryPanel() {
  const [state, setState] = useState<RandomLibraryState>(() => {
    const saved = load<RandomLibraryState | null>(KEY, null)
    const base = defaultRandomLibraryState()
    if (!saved?.genres) return base
    for (const genre of RANDOM_LIBRARY) {
      const old = saved.genres[genre.id]
      if (!old) continue
      base.genres[genre.id].enabled = old.enabled !== false
      for (const item of genre.songs) {
        if (old.songs && item.id in old.songs) base.genres[genre.id].songs[item.id] = old.songs[item.id] !== false
      }
    }
    return base
  })
  const [open, setOpen] = useState<string | null>(RANDOM_LIBRARY[0]?.id ?? null)

  const update = (next: RandomLibraryState) => {
    setState(next)
    save(KEY, next)
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
        <p className="mt-2 text-xs text-white/55">Nesta etapa você escolhe o repertório. A reprodução automática quando a fila ficar vazia será conectada na próxima etapa.</p>
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
