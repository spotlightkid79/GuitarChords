export const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const

export type NoteName = (typeof NOTE_NAMES)[number]

// Standard tuning, string 6 (low E) to string 1 (high E).
export const STANDARD_TUNING: NoteName[] = ['E', 'A', 'D', 'G', 'B', 'E']

const FLAT_TO_SHARP: Record<string, NoteName> = {
  Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#',
}

export function normalizeNote(note: string): NoteName {
  const sharp = FLAT_TO_SHARP[note]
  if (sharp) return sharp
  if ((NOTE_NAMES as readonly string[]).includes(note)) return note as NoteName
  throw new Error(`Unknown note: ${note}`)
}

export function noteIndex(note: string): number {
  return NOTE_NAMES.indexOf(normalizeNote(note))
}

export function transpose(note: string, semitones: number): NoteName {
  const idx = (noteIndex(note) + semitones + 1200) % 12
  return NOTE_NAMES[idx]
}

export function noteAtFret(stringNote: string, fret: number): NoteName {
  return transpose(stringNote, fret)
}

/** Notes of a scale/chord built from `root` using semitone `intervals` (e.g. [0,2,4,5,7,9,11] for major). */
export function getIntervalNotes(root: string, intervals: number[]): NoteName[] {
  return intervals.map((i) => transpose(root, i))
}

export const ALL_ROOTS: NoteName[] = [...NOTE_NAMES]
