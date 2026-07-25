import { Settings, importer, model } from '@coderline/alphatab'
import type { MelodyLine } from '../store/melodyStore'
import { STANDARD_TUNING, midiForOpenString, noteAtFret } from './music-theory'
import type { DurationCode, MelodyEvent } from './rhythm'

export interface TrackOption {
  index: number
  name: string
}

export interface ImportWarnings {
  /** Beats that were a full chord in the source file; only the highest note was kept. */
  droppedChordNotes: number
  /** Beats using a tuplet (e.g. triplet) — imported as their base duration, no tuplet ratio. */
  approximatedTuplets: number
  /** Durations finer than a 16th note (or double-dots), clamped/simplified to what our engine supports. */
  clampedDurations: number
  /** The track's tuning doesn't match standard EADGBE — frets are kept as-is, but the sounding pitch shown/played will be wrong. */
  tuningMismatch: boolean
}

export interface ParsedGpFile {
  title: string
  artist: string
  tracks: TrackOption[]
  score: model.Score
}

/** Parses raw Guitar Pro file bytes (.gp3/.gp4/.gp5/.gpx/.gp) into score metadata + a track list to choose from. */
export function parseGuitarProFile(bytes: Uint8Array): ParsedGpFile {
  const settings = new Settings()
  const score = importer.ScoreLoader.loadScoreFromBytes(bytes, settings)

  const tracks: TrackOption[] = score.tracks
    .map((track, index) => ({ index, name: track.name || `Track ${index + 1}`, isStringed: track.staves[0]?.isStringed ?? false }))
    .filter((t) => t.isStringed)
    .map(({ index, name }) => ({ index, name }))

  return {
    title: score.title || 'Untitled',
    artist: score.artist || 'Unknown Artist',
    tracks,
    score,
  }
}

/** alphaTab's Duration enum values are literally the note-value denominator (1=whole, 2=half, 4=quarter, ...). */
function mapDuration(atDuration: number): { duration: DurationCode; clamped: boolean } {
  if (atDuration <= 1) return { duration: 'w', clamped: false }
  if (atDuration === 2) return { duration: 'h', clamped: false }
  if (atDuration === 4) return { duration: 'q', clamped: false }
  if (atDuration === 8) return { duration: '8', clamped: false }
  if (atDuration === 16) return { duration: '16', clamped: false }
  return { duration: '16', clamped: true }
}

function tuningMatchesStandard(tuning: number[]): boolean {
  if (tuning.length !== 6) return false
  const standard = STANDARD_TUNING.map((_, i) => midiForOpenString(i)).sort((a, b) => a - b)
  const actual = [...tuning].sort((a, b) => a - b)
  return standard.every((v, i) => v === actual[i])
}

/** Maps one track's first staff/voice into our MelodyLine format (monophonic — only the top note of any chord is kept). */
export function mapTrackToLines(score: model.Score, trackIndex: number): { lines: MelodyLine[]; warnings: ImportWarnings } {
  const track = score.tracks[trackIndex]
  const staff = track.staves[0]
  const warnings: ImportWarnings = {
    droppedChordNotes: 0,
    approximatedTuplets: 0,
    clampedDurations: 0,
    tuningMismatch: staff.isStringed && !tuningMatchesStandard(staff.tuning ?? []),
  }

  const items: MelodyEvent[] = []
  let runningSig: { beats: number; beatValue: number } | null = null

  for (const bar of staff.bars) {
    const beats = bar.masterBar.timeSignatureNumerator
    const beatValue = bar.masterBar.timeSignatureDenominator
    if (!runningSig || runningSig.beats !== beats || runningSig.beatValue !== beatValue) {
      items.push({ instanceId: crypto.randomUUID(), type: 'time-signature', beats, beatValue })
      runningSig = { beats, beatValue }
    }

    const voice = bar.voices[0]
    if (!voice) continue

    for (const beat of voice.beats) {
      const { duration, clamped } = mapDuration(beat.duration)
      const dotted = beat.dots >= 1
      if (clamped || beat.dots >= 2) warnings.clampedDurations++
      if (beat.hasTuplet) warnings.approximatedTuplets++

      if (beat.isRest) {
        items.push({ instanceId: crypto.randomUUID(), type: 'rest', duration, dotted })
        continue
      }

      if (beat.notes.length > 1) warnings.droppedChordNotes += beat.notes.length - 1
      const note = beat.maxNote ?? beat.notes[0]
      if (!note) continue

      const stringIndex = note.string - 1
      if (stringIndex < 0 || stringIndex > 5) continue // outside standard 6-string range (extended-range instruments)

      items.push({
        instanceId: crypto.randomUUID(),
        type: 'note',
        note: noteAtFret(STANDARD_TUNING[stringIndex], note.fret),
        stringIndex,
        fret: note.fret,
        duration,
        dotted,
      })
    }
  }

  const lines: MelodyLine[] = [{ id: crypto.randomUUID(), name: track.name || 'Imported', items }]
  return { lines, warnings }
}
