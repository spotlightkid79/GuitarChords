import type { MelodyLine } from '../store/melodyStore'
import type { MelodyEvent } from './rhythm'

/** Shared JSON export/import primitives for anything shaped as a named collection of MelodyLine[] — used by both lib/melodyFile.ts (personal melodies) and lib/songLibraryFile.ts (library songs). */

export function triggerDownload(filename: string, data: unknown) {
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

export function slugify(name: string, fallback: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return slug || fallback
}

export function isMelodyEvent(value: unknown): value is MelodyEvent {
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

export function isMelodyLine(value: unknown): value is MelodyLine {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.name === 'string' && Array.isArray(v.items) && v.items.every(isMelodyEvent)
}

/** Reassigns ids so imported data never collides with what's already saved locally. */
export function withFreshIds(lines: MelodyLine[]): MelodyLine[] {
  return lines.map((line) => ({
    ...line,
    id: crypto.randomUUID(),
    items: line.items.map((item) => ({ ...item, instanceId: crypto.randomUUID() })),
  }))
}
