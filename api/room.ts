import { createHash, randomBytes } from 'node:crypto'

const sessionSeconds = 8 * 60 * 60
const tokenPattern = /^[a-f0-9]{32}$/
const videoPattern = /^[\w-]{11}$/
const requestPattern = /^[a-f0-9-]{36}$/
const digest = (value: string) => createHash('sha256').update(value).digest('hex')

// Keep validation, deduplication and the append atomic across serverless instances.
const roomCommand = `
local raw = redis.call('GET', KEYS[1])
if not raw then return cjson.encode({error = 'closed'}) end
local room = cjson.decode(raw)
local action = ARGV[1]
if action == 'status' then return '{}' end
if action == 'submit' then
  local song = cjson.decode(ARGV[2])
  for _, entry in ipairs(room.requests) do
    if entry.id == song.id then return '{}' end
  end
  if #room.requests >= 200 then return cjson.encode({error = 'full'}) end
  table.insert(room.requests, song)
  redis.call('SET', KEYS[1], cjson.encode(room), 'KEEPTTL')
  return '{}'
end
if room.owner ~= ARGV[2] then return cjson.encode({error = 'forbidden'}) end
if action == 'close' then
  redis.call('DEL', KEYS[1])
  return '{}'
end
local songs = {}
for index = tonumber(ARGV[3]) + 1, #room.requests do
  table.insert(songs, room.requests[index])
end
return cjson.encode({songs = songs, cursor = #room.requests})
`

const field = (value: unknown, limit: number) => typeof value === 'string'
  ? value.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, limit)
  : ''

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const { action, room, owner, cursor, requestId, song } = req.body ?? {}
  if (!['create', 'status', 'submit', 'poll', 'close'].includes(action)) {
    return res.status(400).json({ error: 'invalid' })
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!redisUrl || !redisToken) return res.status(503).json({ error: 'setup' })

  const redis = async (command: unknown[]) => {
    const response = await fetch(redisUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(5000),
    })
    const data = await response.json()
    if (!response.ok || data.error) throw new Error('Redis command failed')
    return data.result
  }

  try {
    if (action === 'create') {
      const roomId = randomBytes(16).toString('hex')
      const ownerToken = randomBytes(16).toString('hex')
      const saved = await redis([
        'SET', `kp:room:${roomId}`, JSON.stringify({ owner: digest(ownerToken), requests: [] }),
        'EX', sessionSeconds, 'NX',
      ])
      if (saved !== 'OK') return res.status(503).json({ error: 'unavailable' })
      return res.status(201).json({ room: roomId, owner: ownerToken })
    }

    if (typeof room !== 'string' || !tokenPattern.test(room)) return res.status(400).json({ error: 'invalid' })
    let argument = ''
    if (action === 'submit') {
      const singer = field(song?.singer, 24)
      const title = field(song?.title, 220)
      const videoId = typeof song?.videoId === 'string' ? song.videoId : ''
      if (!singer || !title || !videoPattern.test(videoId) ||
          typeof requestId !== 'string' || !requestPattern.test(requestId)) {
        return res.status(400).json({ error: 'invalid' })
      }
      argument = JSON.stringify({
        id: requestId, videoId, singer, title, channel: field(song.channel, 120),
        source: 'youtube', thumb: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      })
    }
    if (action === 'poll' || action === 'close') {
      if (typeof owner !== 'string' || !tokenPattern.test(owner)) {
        return res.status(403).json({ error: 'forbidden' })
      }
      argument = digest(owner)
    }
    const offset = Number.isInteger(cursor) && cursor >= 0 && cursor <= 200 ? cursor : 0
    const reply = JSON.parse(await redis(['EVAL', roomCommand, 1, `kp:room:${room}`, action, argument, offset]))
    const status = { closed: 404, forbidden: 403, full: 409 }[reply.error as 'closed' | 'forbidden' | 'full'] ?? 200
    if (action === 'poll' && !Array.isArray(reply.songs) && !reply.error) reply.songs = []
    return res.status(status).json(reply)
  } catch {
    return res.status(503).json({ error: 'unavailable' })
  }
}
