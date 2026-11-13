import type { Song } from './lib'

export type RoomOwner = { room: string; owner: string }
export type QueueState = { songs: Song[]; room: string; cursor: number }

const messages: Record<string, string> = {
  closed: 'Esta sala foi encerrada. Peça o QR Code da sessão atual.',
  setup: 'Os pedidos por celular ainda não estão configurados neste endereço.',
  full: 'A sala chegou ao limite de pedidos. Avise o anfitrião.',
  invalid: 'Confira os dados e tente novamente.',
  forbidden: 'Este navegador não controla esta sala.',
}

export class RoomError extends Error {
  constructor(readonly code: string) {
    super(messages[code] ?? 'Não foi possível conectar à sala. Tente novamente.')
  }
}

export async function roomRequest<T>(action: string, data: object = {}, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch('/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
    })
  } catch {
    throw new RoomError('unavailable')
  }
  const body = await response.json().catch(() => null)
  if (!response.ok || !body) throw new RoomError(body?.error ?? 'unavailable')
  return body
}
