import type { MelodyEvent } from './rhythm'
import type { MelodyLine } from '../store/melodyStore'

const MELODY_FORMAT = 'guitar-notes-melody'
const BACKUP_FORMAT = 'guitar-notes-melody-backup'
const FORMAT_VERSION = 1

export interface ImportedMelody {
  name: string
  lines: MelodyLine[]
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
  return slug || 'melody'
}

export function downloadMelody(name: string, lines: MelodyLine[]) {
  triggerDownload(`${slugify(name)}.json`, {
    format: MELODY_FORMAT,
    version: FORMAT_VERSION,
    name,
    lines,
  })
}

export function downloadAllMelodies(melodies: { name: string; lines: MelodyLine[] }[]) {
  triggerDownload('guitar-melodies-backup.json', {
    format: BACKUP_FORMAT,
    version: FORMAT_VERSION,
    melodies: melodies.map((m) => ({ name: m.name, lines: m.lines })),
  })
}

function isMelodyEvent(value: unknown): value is MelodyEvent {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.instanceId !== 'string') return false
  if (v.type === 'time-signature') return typeof v.beats === 'number' && typeof v.beatValue === 'number'
  if (v.type === 'note') {
    return (
      typeof v.duration === 'string' &&
      typeof v.dotted === 'boolean' &&
      typeof v.note === 'string' &&
      typeof v.stringIndex === 'number' &&
      typeof v.fret === 'number'
    )
  }
  if (v.type === 'rest') return typeof v.duration === 'string' && typeof v.dotted === 'boolean'
  return false
}

function isMelodyLine(value: unknown): value is MelodyLine {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.name === 'string' && Array.isArray(v.items) && v.items.every(isMelodyEvent)
}

/** Reassigns ids so imported data never collides with what's already saved locally. */
function withFreshIds(lines: MelodyLine[]): MelodyLine[] {
  return lines.map((line) => ({
    ...line,
    id: crypto.randomUUID(),
    items: line.items.map((item) => ({ ...item, instanceId: crypto.randomUUID() })),
  }))
}

function normalizeMelody(value: unknown): ImportedMelody | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.name !== 'string' || !Array.isArray(v.lines) || !v.lines.every(isMelodyLine)) return null
  return { name: v.name, lines: withFreshIds(v.lines as MelodyLine[]) }
}

/** Parses an exported melody or backup file. Throws with a user-facing message on invalid input. */
export function parseMelodyFile(raw: string): ImportedMelody[] {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  if (data && typeof data === 'object' && (data as Record<string, unknown>).format === BACKUP_FORMAT) {
    const melodiesField = (data as Record<string, unknown>).melodies
    const melodies = (Array.isArray(melodiesField) ? melodiesField : [])
      .map(normalizeMelody)
      .filter((m): m is ImportedMelody => m !== null)
    if (melodies.length === 0) throw new Error('No valid melodies found in that backup file.')
    return melodies
  }

  const single = normalizeMelody(data)
  if (single) return [single]
  throw new Error('Unrecognized melody file format.')
}
