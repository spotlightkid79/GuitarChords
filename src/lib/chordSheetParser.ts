import type { ChordQuality } from '../data/chords'
import { normalizeNote, type NoteName } from './music-theory'

export interface ParsedChordToken {
  root: NoteName
  quality: ChordQuality
  approximated: boolean
}

// Common spellings that map onto the app's 5 native shapes with no approximation.
const EXACT_QUALITY = new Map<string, ChordQuality>([
  ['', 'maj'],
  ['maj', 'maj'],
  ['M', 'maj'],
  ['m', 'min'],
  ['min', 'min'],
  ['-', 'min'],
  ['7', '7'],
  ['maj7', 'maj7'],
  ['M7', 'maj7'],
  ['Δ', 'maj7'],
  ['Δ7', 'maj7'],
  ['m7', 'min7'],
  ['min7', 'min7'],
  ['-7', 'min7'],
])

// Chord qualities the app doesn't model individually, mapped to the nearest of the 5 native
// shapes (e.g. a sus4 is major-family, a dim is closest to minor). Flagged as approximated.
const APPROX_QUALITY = new Map<string, ChordQuality>([
  // major-family, no altered/extra 7th
  ['sus', 'maj'],
  ['sus2', 'maj'],
  ['sus4', 'maj'],
  ['add9', 'maj'],
  ['add11', 'maj'],
  ['add2', 'maj'],
  ['6', 'maj'],
  ['69', 'maj'],
  ['6/9', 'maj'],
  ['aug', 'maj'],
  ['+', 'maj'],
  ['5', 'maj'],
  // dominant-family extensions/alterations
  ['9', '7'],
  ['11', '7'],
  ['13', '7'],
  ['7sus4', '7'],
  ['7sus2', '7'],
  ['7b5', '7'],
  ['7#5', '7'],
  ['7b9', '7'],
  ['7#9', '7'],
  // diminished/half-diminished, closest to minor
  ['dim', 'min'],
  ['dim7', 'min'],
  ['°', 'min'],
  ['°7', 'min'],
  ['ø', 'min'],
  ['ø7', 'min'],
  ['m7b5', 'min'],
  ['m7-5', 'min'],
  // minor extensions that imply a flat 7th
  ['m6', 'min7'],
  ['m9', 'min7'],
  ['m11', 'min7'],
  ['m13', 'min7'],
  ['min9', 'min7'],
  ['min11', 'min7'],
  ['mmaj7', 'min7'],
  ['m/maj7', 'min7'],
  // major-7 extensions
  ['maj9', 'maj7'],
  ['maj11', 'maj7'],
  ['maj13', 'maj7'],
  ['M9', 'maj7'],
])

const ROOT_RE = /^([A-G])(#|b)?/

function stripPunctuation(token: string): string {
  return token.replace(/^[([]+/, '').replace(/[)\]xX,.]+$/, '')
}

/** Parses one whitespace-delimited chord-chart token (e.g. "Bm", "D/F#", "Csus4") into a root+quality the app can render, or null if it isn't a recognizable chord symbol at all. */
export function parseChordToken(rawToken: string): ParsedChordToken | null {
  const token = stripPunctuation(rawToken).replace(/♭/g, 'b').replace(/♯/g, '#')
  const rootMatch = token.match(ROOT_RE)
  if (!rootMatch) return null

  let root: NoteName
  try {
    root = normalizeNote(rootMatch[1] + (rootMatch[2] ?? ''))
  } catch {
    return null
  }

  // Drop a trailing slash-bass note (e.g. the "/F#" in "D/F#") — the app's chord shapes don't
  // model an alternate bass note, so the base chord above the slash is what gets used.
  const suffix = token.slice(rootMatch[0].length).replace(/\/[A-G](#|b)?$/, '')

  if (EXACT_QUALITY.has(suffix)) return { root, quality: EXACT_QUALITY.get(suffix)!, approximated: false }
  if (APPROX_QUALITY.has(suffix)) return { root, quality: APPROX_QUALITY.get(suffix)!, approximated: true }
  return null
}

/** A line counts as a chord line only if every token on it is a recognizable chord symbol. */
export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  return tokens.every((t) => parseChordToken(t) !== null)
}

export interface ParsedStanza {
  chords: ParsedChordToken[]
}

/** Splits pasted text into blank-line-separated stanzas and collects each one's chords in reading order. */
export function extractStanzas(text: string): ParsedStanza[] {
  const blocks = text.split(/\n\s*\n/)
  const stanzas: ParsedStanza[] = []

  for (const block of blocks) {
    const chords: ParsedChordToken[] = []
    for (const line of block.split('\n')) {
      if (!isChordLine(line)) continue
      for (const token of line.trim().split(/\s+/).filter(Boolean)) {
        const parsed = parseChordToken(token)
        if (parsed) chords.push(parsed)
      }
    }
    if (chords.length > 0) stanzas.push({ chords })
  }

  return stanzas
}
