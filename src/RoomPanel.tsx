import { useEffect, useState } from 'react'
import { toDataURL } from 'qrcode'
import { roomRequest, type RoomOwner } from './room'

export default function RoomPanel({ room, onRoomChange, syncMessage, tv = false }: {
  room: RoomOwner | null
  onRoomChange: (room: RoomOwner | null) => void
  syncMessage: string
  tv?: boolean
}) {
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'copied' | 'manual' | null>(null)
  const link = room ? new URL(`/?sala=${room.room}`, window.location.origin).href : ''

  useEffect(() => {
    let active = true
    setQr('')
    setCopyStatus(null)
    if (link) {
      void toDataURL(link, { margin: tv ? 4 : 2, width: 360 }).then(data => {
        if (active) setQr(data)
      }).catch(() => {
        if (active) setError('O QR Code não pôde ser exibido. Use o link da sala.')
      })
    }
    return () => { active = false }
  }, [link, tv])

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(link)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('manual')
    }
  }

  async function toggleRoom() {
    setBusy(true)
    setError('')
    try {
      if (room) {
        await roomRequest('close', room)
        onRoomChange(null)
      } else {
        onRoomChange(await roomRequest<RoomOwner>('create'))
      }
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (tv) {
    return qr ? (
      <div className="pointer-events-none absolute right-2 top-2 z-20 flex flex-col items-center gap-1 rounded-lg bg-[#0a0720]/95 p-1.5 sm:right-4 sm:top-4">
        <img src={qr} alt="QR Code para escolher uma música no celular" className="h-24 w-24 rounded-sm sm:h-32 sm:w-32" />
        <p className="text-xs font-semibold text-white">Escaneie para cantar</p>
      </div>
    ) : null
  }

  return (
    <section aria-label="Pedidos pelo celular" className="flex flex-col items-center gap-2 rounded-xl bg-[#1b1040] p-3 text-center sm:w-52">
      {link && <>
        {qr && <img src={qr} alt="QR Code para escolher uma música no celular" className="h-28 w-28 rounded bg-white sm:h-32 sm:w-32" />}
        <p className="text-sm font-semibold">Escaneie para cantar</p>
        <button type="button" className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold hover:bg-violet-600" onClick={() => void copyInvite()}>
          Copiar convite
        </button>
        {copyStatus === 'copied' && <p role="status" className="text-sm text-violet-200">Link copiado!</p>}
        {copyStatus === 'manual' && (
          <label className="w-full space-y-1 text-sm text-violet-200">
            <span>Selecione e copie o link da sala</span>
            <input readOnly value={link} onFocus={event => event.currentTarget.select()} className="w-full rounded-lg bg-black/20 p-2" />
          </label>
        )}
      </>}
      <button className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20 disabled:opacity-50" disabled={busy} onClick={() => void toggleRoom()}>
        {busy ? 'Aguarde…' : room ? 'Encerrar pedidos' : 'Abrir sala por QR Code'}
      </button>
      {(error || syncMessage) && <p role="status" className="text-sm text-amber-200">{error || syncMessage}</p>}
    </section>
  )
}
