import { type NoteName, NOTE_NAMES, noteIndex } from '../lib/music-theory'

export type ChordQuality = 'maj' | 'min' | '7' | 'maj7' | 'min7'

export interface ChordShape {
  id: string
  root: NoteName
  quality: ChordQuality
  label: string
  qualityName: string
  /** Fret per string, index 0 = low E (6th string) .. index 5 = high E (1st string). */
  frets: (number | 'x')[]
  /** Fret number the diagram window starts at. 1 means "at the nut". */
  baseFret: number
  barre?: { fret: number; fromString: number; toString: number }
}

export const QUALITY_LABEL: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  '7': '7',
  maj7: 'maj7',
  min7: 'm7',
}

export const QUALITY_NAME: Record<ChordQuality, string> = {
  maj: 'Major',
  min: 'Minor',
  '7': 'Dominant 7th',
  maj7: 'Major 7th',
  min7: 'Minor 7th',
}

export const CHORD_QUALITIES: ChordQuality[] = ['maj', 'min', '7', 'maj7', 'min7']

function shape(
  root: NoteName,
  quality: ChordQuality,
  frets: (number | 'x')[],
): ChordShape {
  return {
    id: `${root}-${quality}-open`,
    root,
    quality,
    label: `${root}${QUALITY_LABEL[quality]}`,
    qualityName: QUALITY_NAME[quality],
    frets,
    baseFret: 1,
  }
}

// Curated "campfire" open-position shapes for the roots that support them.
const OPEN_CHORDS: ChordShape[] = [
  shape('C', 'maj', ['x', 3, 2, 0, 1, 0]),
  shape('C', '7', ['x', 3, 2, 3, 1, 0]),
  shape('C', 'maj7', ['x', 3, 2, 0, 0, 0]),

  shape('A', 'maj', ['x', 0, 2, 2, 2, 0]),
  shape('A', 'min', ['x', 0, 2, 2, 1, 0]),
  shape('A', '7', ['x', 0, 2, 0, 2, 0]),
  shape('A', 'maj7', ['x', 0, 2, 1, 2, 0]),
  shape('A', 'min7', ['x', 0, 2, 0, 1, 0]),

  shape('G', 'maj', [3, 2, 0, 0, 0, 3]),
  shape('G', '7', [3, 2, 0, 0, 0, 1]),
  shape('G', 'maj7', [3, 'x', 0, 0, 0, 2]),

  shape('E', 'maj', [0, 2, 2, 1, 0, 0]),
  shape('E', 'min', [0, 2, 2, 0, 0, 0]),
  shape('E', '7', [0, 2, 0, 1, 0, 0]),
  shape('E', 'maj7', [0, 2, 1, 1, 0, 0]),
  shape('E', 'min7', [0, 2, 0, 0, 0, 0]),

  shape('D', 'maj', ['x', 'x', 0, 2, 3, 2]),
  shape('D', 'min', ['x', 'x', 0, 2, 3, 1]),
  shape('D', '7', ['x', 'x', 0, 2, 1, 2]),
  shape('D', 'maj7', ['x', 'x', 0, 2, 2, 2]),
  shape('D', 'min7', ['x', 'x', 0, 2, 1, 1]),
]

type Frets6 = (number | 'x')[]
type ShapeTemplate = (r: number) => Frets6

// Movable shapes derived from the open E and open A chord fingerings.
const E_SHAPE: Record<ChordQuality, ShapeTemplate> = {
  maj: (r) => [r, r + 2, r + 2, r + 1, r, r],
  min: (r) => [r, r + 2, r + 2, r, r, r],
  '7': (r) => [r, r + 2, r, r + 1, r, r],
  maj7: (r) => [r, r + 2, r + 1, r + 1, r, r],
  min7: (r) => [r, r + 2, r, r, r, r],
}

const A_SHAPE: Record<ChordQuality, ShapeTemplate> = {
  maj: (r) => ['x', r, r + 2, r + 2, r + 2, r],
  min: (r) => ['x', r, r + 2, r + 2, r + 1, r],
  '7': (r) => ['x', r, r + 2, r, r + 2, r],
  maj7: (r) => ['x', r, r + 2, r + 1, r + 2, r],
  min7: (r) => ['x', r, r + 2, r, r + 1, r],
}

function fretsToRoot(fromNote: NoteName, root: NoteName): number {
  return (noteIndex(root) - noteIndex(fromNote) + 12) % 12
}

function generateBarreChord(root: NoteName, quality: ChordQuality): ChordShape {
  const rE = fretsToRoot('E', root)
  const rA = fretsToRoot('A', root)
  const useE = rE <= rA
  const r = useE ? rE : rA
  const frets = (useE ? E_SHAPE : A_SHAPE)[quality](r)
  return {
    id: `${root}-${quality}-barre`,
    root,
    quality,
    label: `${root}${QUALITY_LABEL[quality]}`,
    qualityName: QUALITY_NAME[quality],
    frets,
    baseFret: r,
    barre: { fret: r, fromString: useE ? 0 : 1, toString: 5 },
  }
}

const openKey = (root: string, quality: ChordQuality) => `${root}-${quality}`
const openLookup = new Set(OPEN_CHORDS.map((c) => openKey(c.root, c.quality)))

const GENERATED_CHORDS: ChordShape[] = []
for (const root of NOTE_NAMES) {
  for (const quality of CHORD_QUALITIES) {
    if (openLookup.has(openKey(root, quality))) continue
    GENERATED_CHORDS.push(generateBarreChord(root, quality))
  }
}

export const CHORDS: ChordShape[] = [...OPEN_CHORDS, ...GENERATED_CHORDS]
