import type { BoardLine } from '../store/progressionStore'

const SONG_FORMAT = 'guitar-chords-song'
const BACKUP_FORMAT = 'guitar-chords-song-backup'
const FORMAT_VERSION = 1

export interface ImportedSong {
  name: string
  lines: BoardLine[]
}

function triggerDownload(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function slugify(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return slug || 'song'
}

export function downloadSong(name: string, lines: BoardLine[]) {
  triggerDownload(`${slugify(name)}.json`, {
    format: SONG_FORMAT,
    version: FORMAT_VERSION,
    name,
    lines,
  })
}

export function downloadAllSongs(songs: { name: string; lines: BoardLine[] }[]) {
  triggerDownload('guitar-songs-backup.json', {
    format: BACKUP_FORMAT,
    version: FORMAT_VERSION,
    songs: songs.map((s) => ({ name: s.name, lines: s.lines })),
  })
}

function isBoardItem(value: unknown): value is { instanceId: string; chordId: string } {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.instanceId === 'string' && typeof v.chordId === 'string'
}

function isBoardLine(value: unknown): value is BoardLine {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.name === 'string' && Array.isArray(v.items) && v.items.every(isBoardItem)
}

/** Reassigns ids so imported data never collides with what's already saved locally. */
function withFreshIds(lines: BoardLine[]): BoardLine[] {
  return lines.map((line) => ({
    ...line,
    id: crypto.randomUUID(),
    items: line.items.map((item) => ({ ...item, instanceId: crypto.randomUUID() })),
  }))
}

function normalizeSong(value: unknown): ImportedSong | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.name !== 'string' || !Array.isArray(v.lines) || !v.lines.every(isBoardLine)) return null
  return { name: v.name, lines: withFreshIds(v.lines as BoardLine[]) }
}

/** Parses an exported song or backup file. Throws with a user-facing message on invalid input. */
export function parseSongFile(raw: string): ImportedSong[] {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  if (data && typeof data === 'object' && (data as Record<string, unknown>).format === BACKUP_FORMAT) {
    const songsField = (data as Record<string, unknown>).songs
    const songs = (Array.isArray(songsField) ? songsField : []).map(normalizeSong).filter((s): s is ImportedSong => s !== null)
    if (songs.length === 0) throw new Error('No valid songs found in that backup file.')
    return songs
  }

  const single = normalizeSong(data)
  if (single) return [single]
  throw new Error('Unrecognized song file format.')
}
