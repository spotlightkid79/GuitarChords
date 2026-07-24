import { type NoteName, NOTE_NAMES, noteIndex } from '../lib/music-theory'

export type ChordQuality = 'maj' | 'min' | '7' | 'maj7' | 'min7'
export type ChordVoicing = 'open' | 'barre-e' | 'barre-a'

export interface ChordShape {
  id: string
  root: NoteName
  quality: ChordQuality
  voicing: ChordVoicing
  label: string
  qualityName: string
  /** Fret per string, index 0 = low E (6th string) .. index 5 = high E (1st string). */
  frets: (number | 'x')[]
  /** Fret number the diagram window starts at. 1 means "at the nut". */
  baseFret: number
  barre?: { fret: number; fromString: number; toString: number }
}

export const VOICING_LABEL: Record<ChordVoicing, string> = {
  open: 'Open',
  'barre-e': 'Barre · E-shape',
  'barre-a': 'Barre · A-shape',
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
    voicing: 'open',
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

/** Barre voicing for `root`/`quality` using the given movable shape, or null if it would sit at fret 0 (i.e. it's just the open chord). */
function generateBarreVoicing(
  root: NoteName,
  quality: ChordQuality,
  shapeType: 'barre-e' | 'barre-a',
): ChordShape | null {
  const fromNote = shapeType === 'barre-e' ? 'E' : 'A'
  const r = fretsToRoot(fromNote, root)
  if (r === 0) return null
  const template = (shapeType === 'barre-e' ? E_SHAPE : A_SHAPE)[quality]
  const frets = template(r)
  return {
    id: `${root}-${quality}-${shapeType}`,
    root,
    quality,
    voicing: shapeType,
    label: `${root}${QUALITY_LABEL[quality]}`,
    qualityName: QUALITY_NAME[quality],
    frets,
    baseFret: r,
    barre: { fret: r, fromString: shapeType === 'barre-e' ? 0 : 1, toString: 5 },
  }
}

const openKey = (root: string, quality: ChordQuality) => `${root}-${quality}`
const openLookup = new Set(OPEN_CHORDS.map((c) => openKey(c.root, c.quality)))

// Every root's major and minor chord gets both movable barre voicings, in
// addition to any curated open shape above.
const BARRE_CHORDS: ChordShape[] = []
for (const root of NOTE_NAMES) {
  for (const quality of ['maj', 'min'] as ChordQuality[]) {
    for (const shapeType of ['barre-e', 'barre-a'] as const) {
      const voicing = generateBarreVoicing(root, quality, shapeType)
      if (voicing) BARRE_CHORDS.push(voicing)
    }
  }
}

// 7th / maj7 / min7 barre voicings only fill in roots without a curated open shape.
const GENERATED_SEVENTHS: ChordShape[] = []
for (const root of NOTE_NAMES) {
  for (const quality of ['7', 'maj7', 'min7'] as ChordQuality[]) {
    if (openLookup.has(openKey(root, quality))) continue
    const rE = fretsToRoot('E', root)
    const rA = fretsToRoot('A', root)
    const shapeType = rE <= rA ? 'barre-e' : 'barre-a'
    const voicing = generateBarreVoicing(root, quality, shapeType)
    if (voicing) GENERATED_SEVENTHS.push(voicing)
  }
}

const VOICING_ORDER: Record<ChordVoicing, number> = { open: 0, 'barre-e': 1, 'barre-a': 2 }

export const CHORDS: ChordShape[] = [...OPEN_CHORDS, ...BARRE_CHORDS, ...GENERATED_SEVENTHS].sort((a, b) => {
  const rootDiff = NOTE_NAMES.indexOf(a.root) - NOTE_NAMES.indexOf(b.root)
  if (rootDiff !== 0) return rootDiff
  const qualityDiff = CHORD_QUALITIES.indexOf(a.quality) - CHORD_QUALITIES.indexOf(b.quality)
  if (qualityDiff !== 0) return qualityDiff
  return VOICING_ORDER[a.voicing] - VOICING_ORDER[b.voicing]
})
