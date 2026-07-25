import type { MelodyLine } from '../store/melodyStore'
import { isMelodyLine, slugify, triggerDownload, withFreshIds } from './melodyLineFile'

const SONG_FORMAT = 'guitar-notes-library-song'
const BACKUP_FORMAT = 'guitar-notes-library-backup'
const FORMAT_VERSION = 1

export interface ImportedLibrarySong {
  title: string
  artist: string
  lines: MelodyLine[]
}

export function downloadLibrarySong(title: string, artist: string, lines: MelodyLine[]) {
  triggerDownload(`${slugify(`${artist}-${title}`, 'song')}.json`, {
    format: SONG_FORMAT,
    version: FORMAT_VERSION,
    title,
    artist,
    lines,
  })
}

export function downloadAllLibrarySongs(songs: { title: string; artist: string; lines: MelodyLine[] }[]) {
  triggerDownload('guitar-song-library-backup.json', {
    format: BACKUP_FORMAT,
    version: FORMAT_VERSION,
    songs: songs.map((s) => ({ title: s.title, artist: s.artist, lines: s.lines })),
  })
}

function normalizeSong(value: unknown): ImportedLibrarySong | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.title !== 'string' || typeof v.artist !== 'string' || !Array.isArray(v.lines) || !v.lines.every(isMelodyLine)) {
    return null
  }
  return { title: v.title, artist: v.artist, lines: withFreshIds(v.lines as MelodyLine[]) }
}

/** Parses an exported library song or backup file. Throws with a user-facing message on invalid input. */
export function parseLibrarySongFile(raw: string): ImportedLibrarySong[] {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  if (data && typeof data === 'object' && (data as Record<string, unknown>).format === BACKUP_FORMAT) {
    const songsField = (data as Record<string, unknown>).songs
    const songs = (Array.isArray(songsField) ? songsField : [])
      .map(normalizeSong)
      .filter((s): s is ImportedLibrarySong => s !== null)
    if (songs.length === 0) throw new Error('No valid songs found in that backup file.')
    return songs
  }

  const single = normalizeSong(data)
  if (single) return [single]
  throw new Error('Unrecognized song file format.')
}
