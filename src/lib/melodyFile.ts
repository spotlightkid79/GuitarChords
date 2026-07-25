import type { MelodyLine } from '../store/melodyStore'
import { isMelodyLine, slugify, triggerDownload, withFreshIds } from './melodyLineFile'

const MELODY_FORMAT = 'guitar-notes-melody'
const BACKUP_FORMAT = 'guitar-notes-melody-backup'
const FORMAT_VERSION = 1

export interface ImportedMelody {
  name: string
  lines: MelodyLine[]
}

export function downloadMelody(name: string, lines: MelodyLine[]) {
  triggerDownload(`${slugify(name, 'melody')}.json`, {
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
